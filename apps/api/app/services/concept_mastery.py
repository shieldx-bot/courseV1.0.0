"""Concept Mastery Service.

Tracks per-concept mastery scores (0.0-10.0) for each user per course.
Used by the Adaptive Learning Engine to personalize quiz difficulty
and suggest remediation for weak concepts.
"""

import logging
from datetime import datetime, timezone
from typing import Any

from app.db.mongodb import get_db, get_read_db

logger = logging.getLogger(__name__)

MASTERY_MIN = 0.0
MASTERY_MAX = 10.0
DEFAULT_MASTERY = 5.0
MASTERY_MAP_CACHE_TTL = 120  # seconds (Phase 5: read-through cache, NV5)


def _slugify(title: str) -> str:
    slug = title.lower().strip()
    slug = __import__("re").sub(r"[^a-z0-9]+", "-", slug)
    return slug.strip("-")


def _mastery_id(user_id: str, concept_id: str) -> str:
    return f"mast-{user_id}-{concept_id}"


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _clamp_score(score: float) -> float:
    return round(max(MASTERY_MIN, min(MASTERY_MAX, score)), 2)


def _update_score_elo(
    current: float,
    attempts: int,
    correct: bool,
    difficulty: int,
    time_seconds: float | None,
) -> float:
    """Phase 2 mastery update: ELO-inspired algorithm.

    - expected = probability user answers correctly given difficulty vs current mastery
    - k-factor decreases as user practices more (stabilizes over time)
    - faster answers = slightly higher score reward
    """
    expected = 1.0 / (1.0 + 10 ** ((difficulty - current) / 400))
    k = 32.0 / (1.0 + max(attempts, 1) / 10.0)

    time_factor = 1.0
    if time_seconds is not None:
        if time_seconds < 5:
            time_factor = 1.2
        elif time_seconds > 60:
            time_factor = 0.8

    actual = 1.0 if correct else 0.0
    new_score = current + k * time_factor * (actual - expected)
    return _clamp_score(new_score)


def _update_score_phase1(
    current: float,
    attempts: int,
    correct: bool,
    difficulty: int,
    time_seconds: float | None,
) -> float:
    """Phase 1 mastery update: simple win-rate with difficulty weighting.

    Kept as fallback; Phase 2 uses _update_score_elo by default.
    """
    correct_weight = 1.0 + (difficulty / 10.0)
    if correct:
        delta = correct_weight * 0.5
    else:
        delta = -0.3
    new = current + delta / max(attempts, 1)
    return _clamp_score(new)


async def get_or_create_mastery(user_id: str, course_id: str, concept_id: str) -> dict[str, Any]:
    db = get_db()
    mastery_id = _mastery_id(user_id, concept_id)
    existing = await db.concept_mastery.find_one({"_id": mastery_id})
    if existing:
        return _format_mastery(existing)

    now = _now()
    doc = {
        "_id": mastery_id,
        "user_id": user_id,
        "course_id": course_id,
        "concept_id": concept_id,
        "mastery_score": DEFAULT_MASTERY,
        "attempts": 0,
        "correct_attempts": 0,
        "last_practiced_at": None,
        "trend": "stable",
        "created_at": now,
        "updated_at": now,
    }
    await db.concept_mastery.insert_one(doc)
    await _invalidate_mastery_cache(user_id, course_id)
    return _format_mastery(doc)


async def get_mastery(user_id: str, concept_id: str) -> dict[str, Any] | None:
    db = get_read_db()
    doc = await db.concept_mastery.find_one({"_id": _mastery_id(user_id, concept_id)})
    return _format_mastery(doc) if doc else None


async def get_course_mastery_map(user_id: str, course_id: str) -> dict[str, float]:
    """Read-through cached mastery map (TTL 120s), invalidated on every write."""
    from app.services.cache import get_or_cache

    async def _fetch() -> dict[str, float]:
        db = get_read_db()
        rows = await db.concept_mastery.find({"user_id": user_id, "course_id": course_id}).to_list(1000)
        return {r["concept_id"]: r.get("mastery_score", DEFAULT_MASTERY) for r in rows}

    return await get_or_cache(
        "mastery_map", MASTERY_MAP_CACHE_TTL, _fetch,
        user_id=user_id, course_id=course_id,
    )


async def _invalidate_mastery_cache(user_id: str, course_id: str) -> None:
    """Drop the cached mastery map for a user+course after any write."""
    from app.services.cache import invalidate_pattern

    # Cache keys are built from alphabetically sorted params (see
    # cache._build_cache_key), so course_id sorts before user_id.
    try:
        await invalidate_pattern(f"mastery_map:course_id={course_id}:user_id={user_id}*")
    except Exception as exc:  # cache invalidation must never break writes
        logger.warning("Failed to invalidate mastery cache for %s/%s: %s", user_id, course_id, exc)


async def get_course_mastery_details(user_id: str, course_id: str) -> list[dict[str, Any]]:
    db = get_read_db()
    query: dict[str, Any] = {"course_id": course_id}
    if user_id:
        query["user_id"] = user_id
    rows = await db.concept_mastery.find(query).to_list(1000)
    return [_format_mastery(r) for r in rows]


async def get_all_course_mastery(course_id: str) -> list[dict[str, Any]]:
    """Get all mastery records for a course across all users (for admin stats)."""
    db = get_read_db()
    rows = await db.concept_mastery.find({"course_id": course_id}).to_list(5000)
    return [_format_mastery(r) for r in rows]


async def update_mastery(
    user_id: str,
    course_id: str,
    concept_id: str,
    correct: bool,
    difficulty: int = 5,
    time_seconds: float | None = None,
) -> dict[str, Any]:
    db = get_db()
    mastery_id = _mastery_id(user_id, concept_id)

    existing = await db.concept_mastery.find_one({"_id": mastery_id})
    if not existing:
        existing = {
            "_id": mastery_id,
            "user_id": user_id,
            "course_id": course_id,
            "concept_id": concept_id,
            "mastery_score": DEFAULT_MASTERY,
            "attempts": 0,
            "correct_attempts": 0,
            "last_practiced_at": None,
            "trend": "stable",
            "created_at": _now(),
        }

    current_score = existing.get("mastery_score", DEFAULT_MASTERY)
    attempts = existing.get("attempts", 0) + 1
    correct_attempts = existing.get("correct_attempts", 0) + (1 if correct else 0)
    old_score = current_score
    new_score = _update_score_elo(current_score, attempts, correct, difficulty, time_seconds)

    if new_score > old_score + 0.05:
        trend = "improving"
    elif new_score < old_score - 0.05:
        trend = "declining"
    else:
        trend = "stable"

    now = _now()
    update = {
        "user_id": user_id,
        "course_id": course_id,
        "concept_id": concept_id,
        "mastery_score": new_score,
        "attempts": attempts,
        "correct_attempts": correct_attempts,
        "last_practiced_at": now,
        "trend": trend,
        "updated_at": now,
    }

    await db.concept_mastery.update_one(
        {"_id": mastery_id},
        {
            "$set": update,
            "$setOnInsert": {"created_at": existing.get("created_at", now)},
        },
        upsert=True,
    )
    doc = await db.concept_mastery.find_one({"_id": mastery_id})
    await _invalidate_mastery_cache(user_id, course_id)
    return _format_mastery(doc)


async def get_weak_concepts(user_id: str, course_id: str, threshold: float = 3.0) -> list[dict[str, Any]]:
    details = await get_course_mastery_details(user_id, course_id)
    return [d for d in details if d.get("mastery_score", DEFAULT_MASTERY) < threshold]


async def get_strong_concepts(user_id: str, course_id: str, threshold: float = 7.0) -> list[dict[str, Any]]:
    details = await get_course_mastery_details(user_id, course_id)
    return [d for d in details if d.get("mastery_score", DEFAULT_MASTERY) >= threshold]


async def get_prerequisites(course_id: str, concept_id: str) -> list[dict[str, Any]]:
    db = get_read_db()
    concept = await db.concept_definitions.find_one({"_id": concept_id, "course_id": course_id})
    if not concept:
        return []
    prereq_ids = concept.get("prerequisite_concepts", [])
    if not prereq_ids:
        return []
    return await db.concept_definitions.find({"_id": {"$in": prereq_ids}, "course_id": course_id}).to_list(100)


async def get_all_concepts_for_course(course_id: str) -> list[dict[str, Any]]:
    db = get_read_db()
    return await db.concept_definitions.find({"course_id": course_id, "is_active": True}).to_list(1000)


async def get_concept_definition(concept_id: str) -> dict[str, Any] | None:
    db = get_read_db()
    doc = await db.concept_definitions.find_one({"_id": concept_id})
    return _format_concept(doc) if doc else None


async def get_concepts_by_lesson(course_id: str, lesson_id: str) -> list[dict[str, Any]]:
    db = get_read_db()
    return await db.concept_definitions.find({
        "course_id": course_id,
        "lesson_ids": lesson_id,
        "is_active": True,
    }).to_list(1000)


async def get_ready_concepts(user_id: str, course_id: str) -> list[str]:
    mastery_map = await get_course_mastery_map(user_id, course_id)
    all_concepts = await get_all_concepts_for_course(course_id)
    ready = []
    for c in all_concepts:
        prereqs = c.get("prerequisite_concepts", [])
        if all(mastery_map.get(p, 0) >= 6.0 for p in prereqs):
            ready.append(c["_id"])
    return ready


def _format_mastery(doc: dict[str, Any]) -> dict[str, Any]:
    if not doc:
        return {}
    return {
        "id": doc["_id"],
        "user_id": doc.get("user_id", ""),
        "course_id": doc.get("course_id", ""),
        "concept_id": doc.get("concept_id", ""),
        "mastery_score": doc.get("mastery_score", DEFAULT_MASTERY),
        "attempts": doc.get("attempts", 0),
        "correct_attempts": doc.get("correct_attempts", 0),
        "last_practiced_at": doc.get("last_practiced_at"),
        "trend": doc.get("trend", "stable"),
        "created_at": doc.get("created_at", ""),
        "updated_at": doc.get("updated_at", ""),
    }


def _format_concept(doc: dict[str, Any]) -> dict[str, Any]:
    if not doc:
        return {}
    return {
        "id": doc["_id"],
        "course_id": doc.get("course_id", ""),
        "name": doc.get("name", ""),
        "slug": doc.get("slug", ""),
        "description": doc.get("description", ""),
        "difficulty_base": doc.get("difficulty_base", 5),
        "tags": doc.get("tags", []),
        "lesson_ids": doc.get("lesson_ids", []),
        "prerequisite_concepts": doc.get("prerequisite_concepts", []),
        "is_active": doc.get("is_active", True),
        "created_at": doc.get("created_at", ""),
        "updated_at": doc.get("updated_at", ""),
    }
