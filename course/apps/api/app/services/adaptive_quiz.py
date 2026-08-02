"""Adaptive Quiz Service.

Generates adaptive quiz questions based on concept mastery levels
and grades submissions to update mastery scores.

Phase 5 (NV2) additions:
- ``mode`` = ``lesson`` (default, requires ``lesson_id``) or ``mastery-check``
  (whole course, weakest first, interleaved across lessons, no ``lesson_id``).
- Dynamic per-question difficulty: ``clamp(round(mastery) ± 1..2, 1, 10)``
  instead of a fixed ``difficulty_base``; cold-start users keep ``difficulty_base``.
- Question bank reuse (``quiz_questions`` collection) before LLM generation.
- Interleaving so consecutive questions come from different concepts/lessons.
- Full attempt recording (``user_answer`` / ``time_seconds`` per question).
- Phase 5 metrics M1 (generated), M2 (submitted), M3 (submit duration).
"""

import json
import logging
import random
import re
import time
import uuid
from datetime import datetime, timezone
from typing import Any, Callable

from app.core.telemetry import (
    ADAPTIVE_QUIZ_GENERATED,
    ADAPTIVE_QUIZ_SUBMIT_DURATION,
    ADAPTIVE_QUIZ_SUBMITTED,
)
from app.db.mongodb import get_db, get_read_db
from app.services.concept_mastery import (
    get_all_concepts_for_course,
    get_concepts_by_lesson,
    get_course_mastery_map,
    update_mastery,
    DEFAULT_MASTERY,
)
from app.services.llm import call_llm, is_llm_available

logger = logging.getLogger(__name__)


def _quiz_attempt_id(user_id: str, course_id: str) -> str:
    return f"qa-{user_id}-{course_id}-{int(datetime.now(timezone.utc).timestamp() * 1000)}"


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _pick_difficulty(
    mastery: float | None,
    difficulty_base: int,
    jitter: int | None = None,
) -> int:
    """Dynamic difficulty target ≈ user mastery ± 1..2, clamped to [1, 10].

    Cold start (no mastery record → ``mastery is None``) falls back to the
    concept's static ``difficulty_base``.
    """
    if mastery is None:
        return difficulty_base
    if jitter is None:
        jitter = random.choice([-2, -1, 1, 2])
    return max(1, min(10, round(mastery) + jitter))


async def generate_adaptive_quiz(
    user_id: str,
    course_id: str,
    lesson_id: str | None = None,
    num_questions: int = 5,
    mode: str = "lesson",
) -> dict[str, Any]:
    """Generate an adaptive quiz.

    Args:
        user_id: learner id
        course_id: course id
        lesson_id: required when ``mode=lesson``
        num_questions: number of questions (clamped to available concepts)
        mode: ``lesson`` (default) or ``mastery-check``
    """
    if mode == "mastery-check":
        concepts = await get_all_concepts_for_course(course_id)
    else:
        concepts = await get_concepts_by_lesson(course_id, lesson_id or "")

    mastery_map = await get_course_mastery_map(user_id, course_id)

    if not concepts:
        return {
            "quiz_id": None,
            "course_id": course_id,
            "lesson_id": lesson_id,
            "mode": mode,
            "questions": [],
            "message": (
                "No concepts defined for this lesson yet."
                if mode == "lesson"
                else "No concepts defined for this course yet."
            ),
        }

    if mode == "mastery-check":
        # Weakest across the whole course first; mastery < 4 prioritized.
        concepts_sorted = sorted(
            concepts,
            key=lambda c: (
                mastery_map.get(c["_id"], DEFAULT_MASTERY) >= 4.0,
                mastery_map.get(c["_id"], DEFAULT_MASTERY),
            ),
        )
    else:
        concepts_sorted = sorted(
            concepts,
            key=lambda c: mastery_map.get(c["_id"], DEFAULT_MASTERY),
        )
    selected = concepts_sorted[: min(num_questions, len(concepts_sorted))]

    used_bank_ids: set[str] = set()
    pending: list[tuple[str, dict[str, Any]]] = []  # (lesson_key, question)
    for concept in selected:
        concept_id = concept["_id"]
        concept_name = concept.get("name", concept_id)
        concept_desc = concept.get("description", "")
        mastery = mastery_map.get(concept_id)  # None → cold start
        difficulty = _pick_difficulty(mastery, concept.get("difficulty_base", 5))

        question = await _get_or_generate_question(
            course_id=course_id,
            concept_id=concept_id,
            concept_name=concept_name,
            concept_desc=concept_desc,
            difficulty=difficulty,
            mastery=mastery if mastery is not None else DEFAULT_MASTERY,
            used_bank_ids=used_bank_ids,
        )
        if question:
            lesson_ids = concept.get("lesson_ids") or []
            lesson_key = lesson_ids[0] if lesson_ids else lesson_id or ""
            pending.append((lesson_key, question))

    interleave_key: Callable[[Any], str] = (
        (lambda item: item[0])
        if mode == "mastery-check"
        else (lambda item: item[1]["concept_id"])
    )
    pending = _interleave(pending, interleave_key)
    questions = [item[1] for item in pending]

    quiz_id = _quiz_attempt_id(user_id, course_id)
    ADAPTIVE_QUIZ_GENERATED.labels(mode=mode, course_id=course_id).inc()
    return {
        "quiz_id": quiz_id,
        "course_id": course_id,
        "lesson_id": lesson_id,
        "mode": mode,
        "questions": questions,
        "total_questions": len(questions),
    }


async def _get_or_generate_question(
    course_id: str,
    concept_id: str,
    concept_name: str,
    concept_desc: str,
    difficulty: int,
    mastery: float,
    used_bank_ids: set[str],
) -> dict[str, Any] | None:
    """Return a question for the concept, reusing the question bank first.

    If no banked question matches (difficulty tolerance ±1) it is generated
    (LLM, or deterministic template when the LLM is offline) and persisted so
    later generation reuses it instead of regenerating.
    """
    for bank_doc in await _query_bank(course_id, concept_id, difficulty):
        bid = bank_doc["_id"]
        if bid in used_bank_ids:
            continue
        used_bank_ids.add(bid)
        try:
            await _mark_bank_used(bid)
        except Exception as exc:  # metrics/usage bump must not break the quiz
            logger.debug("Failed to bump bank usage for %s: %s", bid, exc)
        return {
            "concept_id": concept_id,
            "concept_name": concept_name,
            "difficulty": difficulty,
            "question": bank_doc.get("question", ""),
            "options": bank_doc.get("options", []),
            "correct": bank_doc.get("correct", 0),
            "explanation": bank_doc.get("explanation", ""),
        }

    question = await _generate_question_for_concept(
        concept_name=concept_name,
        concept_desc=concept_desc,
        difficulty=difficulty,
        mastery=mastery,
        course_id=course_id,
    )
    if not question:
        return None
    await _save_to_bank(course_id, concept_id, concept_name, difficulty, question)
    return {
        "concept_id": concept_id,
        "concept_name": concept_name,
        "difficulty": difficulty,
        **question,
    }


async def _query_bank(
    course_id: str, concept_id: str, difficulty: int
) -> list[dict[str, Any]]:
    """Return banked questions for the concept, closest difficulty first."""
    db = get_read_db()
    docs = await db.quiz_questions.find({
        "course_id": course_id,
        "concept_id": concept_id,
    }).to_list(100)
    lo, hi = max(1, difficulty - 1), min(10, difficulty + 1)
    docs = [d for d in docs if lo <= d.get("difficulty", difficulty) <= hi]
    docs.sort(key=lambda d: abs(d.get("difficulty", difficulty) - difficulty))
    return docs


async def _save_to_bank(
    course_id: str,
    concept_id: str,
    concept_name: str,
    difficulty: int,
    question: dict[str, Any],
) -> str:
    db = get_db()
    doc = {
        "_id": f"qb-{uuid.uuid4().hex[:12]}",
        "course_id": course_id,
        "concept_id": concept_id,
        "concept_name": concept_name,
        "difficulty": difficulty,
        "question": question.get("question", ""),
        "options": question.get("options", []),
        "correct": question.get("correct", 0),
        "explanation": question.get("explanation", ""),
        "source": "llm",
        "used_count": 0,
        "created_at": _now(),
    }
    await db.quiz_questions.insert_one(doc)
    return doc["_id"]


async def _mark_bank_used(question_id: str) -> None:
    db = get_db()
    await db.quiz_questions.update_one(
        {"_id": question_id}, {"$inc": {"used_count": 1}}
    )


def _interleave(items: list[Any], key: Callable[[Any], str]) -> list[Any]:
    """Reorder items so no two consecutive share the same key (best effort).

    Greedy: repeatedly take from the largest group that does not equal the
    last chosen key.
    """
    groups: dict[str, list[Any]] = {}
    for item in items:
        groups.setdefault(key(item), []).append(item)
    sorted_groups = sorted(groups.values(), key=len, reverse=True)
    pointers = [0] * len(sorted_groups)
    result: list[Any] = []
    last_key: str | None = None

    while True:
        candidates = [
            i
            for i in range(len(sorted_groups))
            if pointers[i] < len(sorted_groups[i])
        ]
        if not candidates:
            break

        def sort_key(i: int):
            return (
                key(sorted_groups[i][pointers[i]]) == last_key,
                -(len(sorted_groups[i]) - pointers[i]),
            )

        candidates.sort(key=sort_key)
        chosen = candidates[0]
        item = sorted_groups[chosen][pointers[chosen]]
        result.append(item)
        last_key = key(item)
        pointers[chosen] += 1

    return result


async def grade_quiz(
    user_id: str,
    course_id: str,
    quiz_id: str,
    answers: dict[int, int],
    questions: list[dict[str, Any]],
    mode: str = "lesson",
) -> dict[str, Any]:
    """Grade a submitted quiz and update mastery scores.

    Args:
        user_id: submitting user
        course_id: course id
        quiz_id: quiz attempt id
        answers: mapping of question_index -> selected_option_index
        questions: the quiz questions (must match the generated quiz)
        mode: quiz mode (``lesson`` | ``mastery-check``)
    """
    start = time.monotonic()
    db = get_db()
    results: list[dict[str, Any]] = []
    total = len(questions)
    correct_count = 0
    concept_results: dict[str, dict[str, Any]] = {}

    for idx, q in enumerate(questions):
        concept_id = q.get("concept_id", "")
        selected = answers.get(idx, -1)
        correct_idx = q.get("correct", 0)
        is_correct = selected == correct_idx
        if is_correct:
            correct_count += 1

        mastery_delta = None
        if concept_id:
            mastery_before = await _get_concept_mastery_score(user_id, concept_id)
            updated = await update_mastery(
                user_id=user_id,
                course_id=course_id,
                concept_id=concept_id,
                correct=is_correct,
                difficulty=q.get("difficulty", 5),
                time_seconds=q.get("time_seconds"),
            )
            mastery_after = updated.get("mastery_score", mastery_before)
            mastery_delta = round(mastery_after - mastery_before, 2)
            concept_results[concept_id] = {
                "concept_id": concept_id,
                "concept_name": q.get("concept_name", concept_id),
                "mastery_before": mastery_before,
                "mastery_after": mastery_after,
                "mastery_delta": mastery_delta,
                "correct": is_correct,
            }

        results.append({
            "question_index": idx,
            "concept_id": concept_id,
            "correct": is_correct,
            "selected_answer": selected,
            "correct_answer": correct_idx,
            "explanation": q.get("explanation", ""),
            "mastery_delta": mastery_delta,
        })

    score_pct = round(correct_count / total * 100, 1) if total else 0.0
    passed = score_pct >= 60

    attempt = {
        "_id": quiz_id,
        "user_id": user_id,
        "course_id": course_id,
        "lesson_id": questions[0].get("lesson_id") if questions else None,
        "mode": mode,
        "questions": [
            {
                "concept_id": q.get("concept_id"),
                "difficulty": q.get("difficulty"),
                "correct": results[i]["correct"],
                "user_answer": answers.get(i, -1),
                "time_seconds": q.get("time_seconds"),
            }
            for i, q in enumerate(questions)
        ],
        "score": correct_count,
        "total_questions": total,
        "score_pct": score_pct,
        "passed": passed,
        "concept_results": list(concept_results.values()),
        "created_at": _now(),
    }
    await db.quiz_attempts.insert_one(attempt)

    ADAPTIVE_QUIZ_SUBMIT_DURATION.labels(course_id=course_id).observe(
        time.monotonic() - start
    )
    ADAPTIVE_QUIZ_SUBMITTED.labels(
        mode=mode, passed="true" if passed else "false"
    ).inc()

    return {
        "quiz_id": quiz_id,
        "score": correct_count,
        "total_questions": total,
        "score_pct": score_pct,
        "passed": passed,
        "results": results,
        "concept_results": list(concept_results.values()),
        "weak_concepts": [
            c for c in concept_results.values()
            if c.get("mastery_after", DEFAULT_MASTERY) < 3.0
        ],
    }


async def _get_concept_mastery_score(user_id: str, concept_id: str) -> float:
    mastery = await _get_mastery_doc(user_id, concept_id)
    return mastery.get("mastery_score", DEFAULT_MASTERY) if mastery else DEFAULT_MASTERY


async def _get_mastery_doc(user_id: str, concept_id: str) -> dict[str, Any] | None:
    db = get_read_db()
    return await db.concept_mastery.find_one({"_id": f"mast-{user_id}-{concept_id}"})


async def _generate_question_for_concept(
    concept_name: str,
    concept_desc: str,
    difficulty: int,
    mastery: float,
    course_id: str,
) -> dict[str, Any] | None:
    """Generate a single quiz question via LLM.

    Falls back to a deterministic template if LLM is unavailable.
    """
    if not is_llm_available():
        return _fallback_question(concept_name, difficulty)

    try:
        course = await get_read_db().courses.find_one({"_id": course_id})
        course_title = course.get("title", "this course") if course else "this course"

        prompt = f"""Generate 1 multiple-choice quiz question for the concept "{concept_name}" in the course "{course_title}".

Concept description: {concept_desc}
Difficulty level: {difficulty}/10
Student current mastery: {mastery}/10

Requirements:
- Difficulty should match the level above (1=easy, 10=hard)
- The question should test understanding, not trivial recall
- Include 4 plausible options
- Make the wrong answers tempting but clearly wrong to someone who understands

Return ONLY valid JSON (no markdown, no code fences):
{{"question": "...", "options": ["A", "B", "C", "D"], "correct": 0, "explanation": "..."}}

Where "correct" is the 0-based index of the correct answer."""

        try:
            response_format = {"type": "json_object"}
            text = await call_llm(
                messages=[{"role": "user", "content": prompt}],
                max_tokens=600,
                temperature=0.5,
                response_format=response_format,
            )
        except Exception:
            text = await call_llm(
                messages=[{"role": "user", "content": prompt}],
                max_tokens=600,
                temperature=0.5,
            )

        text = re.sub(r"^```(?:json)?\s*", "", text.strip())
        text = re.sub(r"\s*```$", "", text)
        data = json.loads(text)

        if isinstance(data, dict) and all(k in data for k in ("question", "options", "correct", "explanation")):
            if len(data.get("options", [])) == 4 and isinstance(data.get("correct"), int) and 0 <= data["correct"] < 4:
                return data
        logger.warning("LLM returned invalid question format for concept %s: %s", concept_name, data)
        return _fallback_question(concept_name, difficulty)

    except Exception as exc:
        logger.warning("LLM question generation failed for concept %s: %s", concept_name, exc)
        return _fallback_question(concept_name, difficulty)


def _fallback_question(concept_name: str, difficulty: int) -> dict[str, Any]:
    """Deterministic fallback question when LLM is unavailable."""
    difficulty_label = "basic" if difficulty <= 3 else "intermediate" if difficulty <= 6 else "advanced"
    return {
        "question": f"[{difficulty_label}] Which statement best describes {concept_name}?",
        "options": [
            "A fundamental concept used across many contexts",
            "A specialized technique for advanced scenarios only",
            "An outdated approach no longer in common use",
            "A syntactic sugar with no practical impact",
        ],
        "correct": 0 if difficulty <= 5 else 1,
        "explanation": f"This is a fallback question for {concept_name}. LLM-generated questions will appear when configured.",
    }