"""Adaptive Quiz Service.

Generates adaptive quiz questions based on concept mastery levels
and grades submissions to update mastery scores.
"""

import json
import logging
import re
from datetime import datetime, timezone
from typing import Any

from app.core.config import settings
from app.db.mongodb import get_db, get_read_db
from app.services.concept_mastery import (
    get_concepts_by_lesson,
    get_course_mastery_map,
    get_concept_definition,
    update_mastery,
    DEFAULT_MASTERY,
)
from app.services.llm import call_llm, is_llm_available

logger = logging.getLogger(__name__)


def _quiz_attempt_id(user_id: str, course_id: str) -> str:
    return f"qa-{user_id}-{course_id}-{int(datetime.now(timezone.utc).timestamp() * 1000)}"


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


async def generate_adaptive_quiz(
    user_id: str,
    course_id: str,
    lesson_id: str,
    num_questions: int = 5,
) -> dict[str, Any]:
    """Generate an adaptive quiz for a lesson.

    Question selection strategy (Phase 1):
    1. Get all concepts for the lesson
    2. Get mastery map for the user
    3. Sort concepts by mastery (weakest first)
    4. Pick top min(num_questions, len(concepts)) concepts
    5. For each concept, generate a question via LLM
    6. Return quiz with questions ordered weak → strong
    """
    concepts = await get_concepts_by_lesson(course_id, lesson_id)
    mastery_map = await get_course_mastery_map(user_id, course_id)

    if not concepts:
        return {
            "quiz_id": None,
            "course_id": course_id,
            "lesson_id": lesson_id,
            "mode": "adaptive",
            "questions": [],
            "message": "No concepts defined for this lesson yet.",
        }

    concepts_sorted = sorted(
        concepts,
        key=lambda c: mastery_map.get(c["_id"], DEFAULT_MASTERY),
    )
    selected = concepts_sorted[: min(num_questions, len(concepts_sorted))]

    questions: list[dict[str, Any]] = []
    for concept in selected:
        concept_id = concept["_id"]
        concept_name = concept.get("name", concept_id)
        concept_desc = concept.get("description", "")
        difficulty = concept.get("difficulty_base", 5)
        mastery = mastery_map.get(concept_id, DEFAULT_MASTERY)

        question = await _generate_question_for_concept(
            concept_name=concept_name,
            concept_desc=concept_desc,
            difficulty=difficulty,
            mastery=mastery,
            course_id=course_id,
        )
        if question:
            questions.append({
                "concept_id": concept_id,
                "concept_name": concept_name,
                "difficulty": difficulty,
                **question,
            })

    quiz_id = _quiz_attempt_id(user_id, course_id)
    return {
        "quiz_id": quiz_id,
        "course_id": course_id,
        "lesson_id": lesson_id,
        "mode": "adaptive",
        "questions": questions,
        "total_questions": len(questions),
    }


async def grade_quiz(
    user_id: str,
    course_id: str,
    quiz_id: str,
    answers: dict[int, int],
    questions: list[dict[str, Any]],
) -> dict[str, Any]:
    """Grade a submitted quiz and update mastery scores.

    Args:
        user_id: submitting user
        course_id: course id
        quiz_id: quiz attempt id
        answers: mapping of question_index -> selected_option_index
        questions: the quiz questions (must match the quiz that was generated)
    """
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

    attempt = {
        "_id": quiz_id,
        "user_id": user_id,
        "course_id": course_id,
        "lesson_id": questions[0].get("lesson_id") if questions else None,
        "mode": "adaptive",
        "questions": [
            {
                "concept_id": q.get("concept_id"),
                "difficulty": q.get("difficulty"),
                "correct": results[i]["correct"],
            }
            for i, q in enumerate(questions)
        ],
        "score": correct_count,
        "total_questions": total,
        "score_pct": score_pct,
        "passed": score_pct >= 60,
        "concept_results": list(concept_results.values()),
        "created_at": _now(),
    }
    await db.quiz_attempts.insert_one(attempt)

    return {
        "quiz_id": quiz_id,
        "score": correct_count,
        "total_questions": total,
        "score_pct": score_pct,
        "passed": score_pct >= 60,
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
