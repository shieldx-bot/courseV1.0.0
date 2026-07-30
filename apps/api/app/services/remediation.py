"""Remediation Service.

Detects knowledge gaps (weak concepts) and generates remediation content.
- Phase 1: basic gap detection + lesson linking.
- Phase 3: AI-generated explanations, micro-exercises, and analogies with Redis caching.
"""

import json
import logging
import re
from datetime import datetime, timezone
from typing import Any

from app.core.config import settings
from app.services.concept_mastery import (
    DEFAULT_MASTERY,
    get_all_concepts_for_course,
    get_concept_definition,
    get_weak_concepts,
)
from app.services.llm import call_llm, is_llm_available

logger = logging.getLogger(__name__)

REDIS_TTL_SECONDS = 60 * 60  # 1 hour


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
        weak_prereqs = [p for p in prereqs if mastery_map.get(p, 0) < 4.0]
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


async def generate_remedial_content(user_id: str, course_id: str, concept_id: str) -> dict[str, Any]:
    """Generate AI-powered remedial content for a weak concept.

    Returns cached content when available.
    """
    cache_key = f"remediation:{user_id}:{concept_id}"
    cached = await _get_redis_cache(cache_key)
    if cached:
        return json.loads(cached)

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
        await _set_redis_cache(cache_key, json.dumps(content), REDIS_TTL_SECONDS)
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

    await _set_redis_cache(cache_key, json.dumps(content), REDIS_TTL_SECONDS)
    return content


async def get_or_create_remedial_content(
    user_id: str,
    course_id: str,
    concept_id: str,
) -> dict[str, Any]:
    """Public helper used by frontends/APIs to obtain remedial content."""
    return await generate_remedial_content(user_id, course_id, concept_id)


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


async def _get_course_doc(course_id: str) -> dict[str, Any] | None:
    from app.db.mongodb import get_read_db
    return await get_read_db().courses.find_one({"_id": course_id})
