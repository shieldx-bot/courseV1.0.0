"""Remediation Service.

Detects knowledge gaps (weak concepts) and generates remediation content.
- Phase 1: basic gap detection + lesson linking.
- Phase 3: AI-generated explanations, micro-exercises, and analogies with Redis caching.
- Phase 6: prioritized remediation queue (``get_recommended_remediation``),
  cross-user persisted content reuse (``remedial_content`` collection),
  micro-exercise grading that updates mastery, and feedback metrics (M6/M7).
"""

import hashlib
import json
import logging
import re
from datetime import datetime, timezone
from typing import Any

from app.core.config import settings
from app.core.telemetry import (
    ADAPTIVE_REMEDIATION_EXERCISE_SUBMITTED,
    ADAPTIVE_REMEDIATION_FEEDBACK,
    ADAPTIVE_REMEDIATION_GENERATED,
)
from app.db.mongodb import get_db, get_read_db
from app.services.concept_mastery import (
    DEFAULT_MASTERY,
    get_all_concepts_for_course,
    get_concept_definition,
    get_course_mastery_map,
    get_mastery,
    get_weak_concepts,
    update_mastery,
)
from app.services.llm import call_llm, is_llm_available

logger = logging.getLogger(__name__)

REDIS_TTL_SECONDS = 60 * 60  # 1 hour

# Mastery below which a concept is considered a prerequisite gap (4.0 matches
# get_prerequisite_gaps' threshold).
PREREQ_GAP_THRESHOLD = 4.0


async def detect_gaps(user_id: str, course_id: str, threshold: float = 3.0) -> list[dict[str, Any]]:
    """Return concepts where user mastery is below threshold, sorted by severity."""
    weak = await get_weak_concepts(user_id, course_id, threshold=threshold)
    weak.sort(key=lambda c: c.get("mastery_score", DEFAULT_MASTERY))
    return weak


async def get_prerequisite_gaps(user_id: str, course_id: str) -> list[dict[str, Any]]:
    """Return concepts whose prerequisites are not yet mastered."""
    from app.services.concept_mastery import get_course_mastery_map

    mastery_map = await get_course_mastery_map(user_id, course_id)
    all_concepts = await get_all_concepts_for_course(course_id)

    gaps = []
    for c in all_concepts:
        prereqs = c.get("prerequisite_concepts", [])
        weak_prereqs = [p for p in prereqs if mastery_map.get(p, 0) < PREREQ_GAP_THRESHOLD]
        if weak_prereqs:
            gaps.append({
                "concept_id": c["_id"],
                "concept_name": c.get("name", c["_id"]),
                "weak_prerequisites": weak_prereqs,
                "suggestion": f"Review prerequisites before studying {c.get('name', c['_id'])}",
            })

    return gaps


async def get_remediation_suggestions(user_id: str, course_id: str) -> list[dict[str, Any]]:
    """Get remediation suggestions for weak concepts.

    Phase 3: includes AI-generated explanations and micro-exercises when available.
    """
    gaps = await detect_gaps(user_id, course_id)
    if not gaps:
        return []

    all_concepts = {c["_id"]: c for c in await get_all_concepts_for_course(course_id)}

    suggestions = []
    for gap in gaps:
        concept_id = gap.get("concept_id", "")
        concept = all_concepts.get(concept_id, {})
        suggestions.append({
            "concept_id": concept_id,
            "concept_name": concept.get("name", concept_id),
            "mastery_score": gap.get("mastery_score", DEFAULT_MASTERY),
            "trend": gap.get("trend", "stable"),
            "lesson_ids": concept.get("lesson_ids", []),
            "prerequisite_concepts": concept.get("prerequisite_concepts", []),
            "suggestion": _build_suggestion(gap, concept),
        })

    return suggestions


async def get_recommended_remediation(
    user_id: str, course_id: str, threshold: float = 3.0
) -> list[dict[str, Any]]:
    """Build a prioritized remediation queue for a user in a course.

    Combines ``detect_gaps`` (weak concepts below ``threshold``) with
    ``get_prerequisite_gaps`` (concepts whose prerequisites are unmastered).
    Weak concepts that are themselves prerequisites are prioritized first;
    within each priority level, severity (lower mastery) comes first.

    Each queue item keeps the existing suggestion shape and adds ``priority``
    (1 = prerequisite gap, 2 = regular weak concept).
    """
    suggestions = await get_remediation_suggestions(user_id, course_id)
    prereq_gaps = await get_prerequisite_gaps(user_id, course_id)
    mastery_map = await get_course_mastery_map(user_id, course_id)
    all_concepts = {c["_id"]: c for c in await get_all_concepts_for_course(course_id)}

    prereq_weak_ids: set[str] = set()
    for gap in prereq_gaps:
        prereq_weak_ids.update(gap.get("weak_prerequisites", []))

    by_concept: dict[str, dict[str, Any]] = {}
    for item in suggestions:
        cid = item.get("concept_id", "")
        if not cid:
            continue
        by_concept[cid] = {
            **item,
            "priority": 1 if cid in prereq_weak_ids else 2,
        }

    # Include weak prerequisites not already covered (e.g. mastery in the
    # [threshold, 4.0) band that detect_gaps does not flag as weak).
    for gap in prereq_gaps:
        dependent = all_concepts.get(gap.get("concept_id", ""), {})
        for pid in gap.get("weak_prerequisites", []):
            if pid in by_concept:
                continue
            concept = all_concepts.get(pid, {})
            concept_name = concept.get("name", pid)
            by_concept[pid] = {
                "concept_id": pid,
                "concept_name": concept_name,
                "mastery_score": mastery_map.get(pid, DEFAULT_MASTERY),
                "trend": "stable",
                "lesson_ids": concept.get("lesson_ids", []),
                "prerequisite_concepts": concept.get("prerequisite_concepts", []),
                "suggestion": (
                    f"Review prerequisite {concept_name} before studying "
                    f"{dependent.get('name', gap.get('concept_id', ''))}"
                ),
                "priority": 1,
            }

    return sorted(
        by_concept.values(),
        key=lambda item: (item.get("priority", 2), item.get("mastery_score", DEFAULT_MASTERY)),
    )


async def generate_remedial_content(user_id: str, course_id: str, concept_id: str) -> dict[str, Any]:
    """Generate AI-powered remedial content for a weak concept.

    Cache layers (Phase 6): per-user Redis cache (fast) → ``remedial_content``
    collection (cross-user reuse, avoids regenerating LLM content for every
    new user) → LLM generation persisted to both.
    """
    cache_key = f"remediation:{user_id}:{concept_id}"
    cached = await _get_redis_cache(cache_key)
    if cached:
        ADAPTIVE_REMEDIATION_GENERATED.labels(concept_id=concept_id).inc()
        return json.loads(cached)

    stored = await _get_persisted_remedial_content(course_id, concept_id)
    if stored:
        await _set_redis_cache(cache_key, json.dumps(stored), REDIS_TTL_SECONDS)
        ADAPTIVE_REMEDIATION_GENERATED.labels(concept_id=concept_id).inc()
        return stored

    concept = await get_concept_definition(concept_id)
    if not concept:
        return {"concept_id": concept_id, "error": "Concept not found"}

    course = await _get_course_doc(course_id)
    course_title = course.get("title", "this course") if course else "this course"
    concept_name = concept.get("name", concept_id)
    concept_desc = concept.get("description", "")

    content: dict[str, Any] = {
        "concept_id": concept_id,
        "concept_name": concept_name,
        "explanation": "",
        "exercise": {"questions": []},
        "analogies": [],
        "generated": False,
    }

    if not is_llm_available():
        content["explanation"] = (
            f"{concept_name} needs more practice. Review the related lessons and try again."
        )
        await _save_remedial_content(course_id, concept_id, content)
        await _set_redis_cache(cache_key, json.dumps(content), REDIS_TTL_SECONDS)
        ADAPTIVE_REMEDIATION_GENERATED.labels(concept_id=concept_id).inc()
        return content

    try:
        llm_content = await _generate_llm_content(course_title, concept_name, concept_desc)
        if llm_content:
            content.update(llm_content)
            content["generated"] = True
    except Exception as exc:
        logger.warning("Remediation content generation failed for %s: %s", concept_id, exc)
        content["explanation"] = (
            f"{concept_name} needs more practice. Review the related lessons and try again."
        )

    await _save_remedial_content(course_id, concept_id, content)
    await _set_redis_cache(cache_key, json.dumps(content), REDIS_TTL_SECONDS)
    ADAPTIVE_REMEDIATION_GENERATED.labels(concept_id=concept_id).inc()
    return content


async def get_or_create_remedial_content(
    user_id: str,
    course_id: str,
    concept_id: str,
) -> dict[str, Any]:
    """Public helper used by frontends/APIs to obtain remedial content."""
    return await generate_remedial_content(user_id, course_id, concept_id)


async def submit_remedial_exercise(
    user_id: str,
    course_id: str,
    concept_id: str,
    answers: dict[int, int],
) -> dict[str, Any]:
    """Grade a remedial micro-exercise submission and update mastery (Elo).

    Grading uses the ``correct`` answers persisted in ``remedial_content``.
    Each answered question feeds ``update_mastery`` (same Elo path as quiz
    grading) so remediation effectiveness is measurable via mastery deltas.

    Returns ``{correct_count, total, mastery_before, mastery_after, passed}``
    and increments M7 (``adaptive_remediation_exercise_submitted_total``).
    """
    stored = await _get_persisted_remedial_content(course_id, concept_id)
    if not stored:
        raise ValueError("Remedial content not found for this concept")

    questions = (stored.get("exercise") or {}).get("questions", []) if isinstance(stored, dict) else []
    if not questions:
        raise ValueError("Remedial content has no micro-exercise questions")

    concept = await get_concept_definition(concept_id)
    difficulty = int((concept or {}).get("difficulty_base", 5) or 5)

    mastery_doc = await get_mastery(user_id, concept_id)
    mastery_before = mastery_doc.get("mastery_score", DEFAULT_MASTERY) if mastery_doc else DEFAULT_MASTERY

    correct_count = 0
    mastery_after = mastery_before
    for idx, q in enumerate(questions):
        selected = answers.get(idx, -1)
        is_correct = selected == q.get("correct", -1)
        if is_correct:
            correct_count += 1
        updated = await update_mastery(
            user_id=user_id,
            course_id=course_id,
            concept_id=concept_id,
            correct=is_correct,
            difficulty=difficulty,
        )
        mastery_after = updated.get("mastery_score", mastery_after)

    total = len(questions)
    passed = correct_count / total >= 0.6 if total else False

    ADAPTIVE_REMEDIATION_EXERCISE_SUBMITTED.labels(
        concept_id=concept_id, passed="true" if passed else "false"
    ).inc()

    return {
        "concept_id": concept_id,
        "correct_count": correct_count,
        "total": total,
        "mastery_before": round(mastery_before, 2),
        "mastery_after": round(mastery_after, 2),
        "passed": passed,
    }


async def flush_remedial_content(
    concept_id: str, course_id: str | None = None
) -> dict[str, Any]:
    """Invalidate persisted + cached remedial content for a concept.

    Phase 6 follow-up (refresh policy): ``remedial_content`` docs are keyed by
    ``rc-{concept_id}-{hash}`` and reused across users, so stale LLM content
    would otherwise live forever. This removes the persisted docs (optionally
    scoped to one course) and the per-user Redis entries for the concept; the
    next ``generate_remedial_content`` call regenerates fresh content.

    Returns ``{concept_id, course_id, deleted, flushed}``.
    """
    db = get_db()
    query: dict[str, Any] = {"concept_id": concept_id}
    if course_id:
        query["course_id"] = course_id
    result = await db.remedial_content.delete_many(query)
    await _flush_redis_cache_for_concept(concept_id)
    return {
        "concept_id": concept_id,
        "course_id": course_id,
        "deleted": result.deleted_count,
        "flushed": True,
    }


async def submit_remediation_feedback(
    user_id: str,
    course_id: str,
    concept_id: str,
    helpful: bool,
) -> dict[str, Any]:
    """Record remediation feedback.

    Increments M6 (``adaptive_remediation_feedback_total{helpful}``) and stores
    an event in ``activity_events`` for analytics.
    """
    ADAPTIVE_REMEDIATION_FEEDBACK.labels(helpful="true" if helpful else "false").inc()

    db = get_db()
    event = {
        "_id": f"rf-{user_id}-{concept_id}-{int(datetime.now(timezone.utc).timestamp() * 1000)}",
        "user_id": user_id,
        "type": "remediation_feedback",
        "payload": {"course_id": course_id, "concept_id": concept_id, "helpful": helpful},
        "visibility": "private",
        "created_at": _now_iso(),
    }
    try:
        await db.activity_events.insert_one(event)
    except Exception as exc:
        logger.warning("Failed to store remediation feedback event for %s: %s", user_id, exc)

    return {"recorded": True, "helpful": helpful}


async def _get_persisted_remedial_content(
    course_id: str, concept_id: str
) -> dict[str, Any] | None:
    """Return the latest persisted remedial content for a concept (cross-user reuse)."""
    try:
        db = get_read_db()
        docs = await db.remedial_content.find(
            {"course_id": course_id, "concept_id": concept_id}
        ).to_list(50)
        if not docs:
            return None
        docs.sort(key=lambda d: d.get("updated_at", ""), reverse=True)
        content = docs[0].get("content")
        return content if isinstance(content, dict) else None
    except Exception as exc:
        logger.warning("Failed to read persisted remedial content for %s: %s", concept_id, exc)
        return None


async def _save_remedial_content(course_id: str, concept_id: str, content: dict[str, Any]) -> str:
    """Persist remedial content keyed by concept + content hash (dedupes)."""
    db = get_db()
    content_hash = hashlib.sha1(
        json.dumps(content, sort_keys=True, default=str).encode("utf-8")
    ).hexdigest()
    doc_id = f"rc-{concept_id}-{content_hash[:12]}"
    now = _now_iso()
    await db.remedial_content.update_one(
        {"_id": doc_id},
        {
            "$set": {
                "course_id": course_id,
                "concept_id": concept_id,
                "content_hash": content_hash,
                "content": content,
                "updated_at": now,
            },
            "$setOnInsert": {"created_at": now},
        },
        upsert=True,
    )
    return content_hash


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _build_suggestion(gap: dict[str, Any], concept: dict[str, Any]) -> str:
    score = gap.get("mastery_score", DEFAULT_MASTERY)
    name = concept.get("name", gap.get("concept_id", "this concept"))
    lesson_ids = concept.get("lesson_ids", [])

    if score < 2.0:
        base = f"You're struggling with {name}. We recommend reviewing the related lessons first."
    elif score < 3.0:
        base = f"{name} needs more practice. Try the related exercises."
    else:
        base = f"{name} is still below target. A quick review will help."

    if lesson_ids:
        base += f" Related lessons: {', '.join(lesson_ids)}."

    return base


async def _generate_llm_content(course_title: str, concept_name: str, concept_desc: str) -> dict[str, Any] | None:
    prompt = f"""You are an expert tutor. A student is struggling with "{concept_name}" in the course "{course_title}".

Concept: {concept_desc}

Generate 3 things in JSON:
1. "explanation": a 2-3 sentence simplified explanation of this concept
2. "exercise": {{"questions": [{{"question": "...", "options": ["A", "B", "C", "D"], "correct": 0, "explanation": "..."}}]}} with 2-3 multiple-choice questions
3. "analogies": ["1-2 real-world analogies to help understanding"]

Return ONLY valid JSON:
{{"explanation": "...", "exercise": {{"questions": [...]}}, "analogies": ["...", "..."]}}"""

    try:
        text = await call_llm(
            messages=[{"role": "user", "content": prompt}],
            max_tokens=1200,
            temperature=0.5,
        )
    except Exception as exc:
        logger.warning("LLM call failed during remediation generation: %s", exc)
        return None

    try:
        text = re.sub(r"^```(?:json)?\s*", "", text.strip())
        text = re.sub(r"\s*```$", "", text)
        data = json.loads(text)
        if not isinstance(data, dict):
            return None

        explanation = str(data.get("explanation", "")).strip()
        exercise = data.get("exercise", {})
        questions = exercise.get("questions", []) if isinstance(exercise, dict) else []
        analogies = data.get("analogies", [])
        if not isinstance(analogies, list):
            analogies = [str(analogies)]

        validated_questions = []
        for q in questions[:3]:
            if (
                isinstance(q, dict)
                and q.get("question")
                and isinstance(q.get("options"), list)
                and len(q.get("options", [])) == 4
                and isinstance(q.get("correct"), int)
                and 0 <= q.get("correct", -1) < 4
            ):
                validated_questions.append({
                    "question": q["question"],
                    "options": q["options"],
                    "correct": q["correct"],
                    "explanation": q.get("explanation", ""),
                })

        return {
            "explanation": explanation or f"{concept_name} needs more practice.",
            "exercise": {"questions": validated_questions},
            "analogies": [str(a) for a in analogies[:2]],
        }
    except Exception as exc:
        logger.warning("Failed to parse LLM remediation output for %s: %s", concept_name, exc)
        return None


async def _get_redis_cache(key: str) -> str | None:
    try:
        import redis as _redis
        client = _redis.from_url(settings.redis_url)
        value = await client.get(key)
        if value and isinstance(value, bytes):
            return value.decode()
        if isinstance(value, str):
            return value
    except Exception:
        pass
    return None


async def _set_redis_cache(key: str, value: str, ttl_seconds: int) -> None:
    try:
        import redis as _redis
        client = _redis.from_url(settings.redis_url)
        await client.setex(key, ttl_seconds, value)
    except Exception:
        pass


async def _flush_redis_cache_for_concept(concept_id: str) -> None:
    """Delete all per-user Redis remediation cache keys for a concept."""
    try:
        import redis as _redis
        client = _redis.from_url(settings.redis_url)
        async for key in client.scan_iter(match=f"remediation:*:{concept_id}", count=500):
            await client.delete(key)
    except Exception:
        pass


async def _get_course_doc(course_id: str) -> dict[str, Any] | None:
    from app.db.mongodb import get_read_db
    return await get_read_db().courses.find_one({"_id": course_id})
