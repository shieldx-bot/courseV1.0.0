"""Mastery Engine Service (Phase 5).

Completes the Adaptive Learning mastery lifecycle:

- ``apply_decay``: forgetting-curve decay for concepts that haven't been
  practiced recently (7 days → ~5%, +5% per additional 7 days, floored at 1.0).
- ``recalculate_mastery``: recompute a concept's mastery from the raw
  ``quiz_attempts`` history by replaying the Elo updates.
- ``get_recommended_sequence``: dependency-sorted lesson plan with
  ``normal | remedial | ready-to-skip`` statuses (extracted from the former
  inline endpoint logic in ``app/api/v1/adaptive.py``).

The per-attempt snapshot timeline already lives in ``quiz_attempts``
(``concept_results`` with ``mastery_before/after``) — no extra collection.
"""

import logging
from datetime import datetime, timezone
from typing import Any

from app.db.mongodb import get_db, get_read_db
from app.services.concept_mastery import (
    DEFAULT_MASTERY,
    _update_score_elo,
    get_all_concepts_for_course,
    get_course_mastery_map,
)

logger = logging.getLogger(__name__)

DECAY_FLOOR = 1.0          # mastery never decays below this
DECAY_THRESHOLD_DAYS = 7   # first decay kicks in after 7 idle days
DECAY_RATE = 0.05          # 5% per idle window
DECAY_MAX = 0.30           # cap total decay at 30%


def _parse_dt(value: Any) -> datetime | None:
    if not value:
        return None
    if isinstance(value, datetime):
        return value
    try:
        return datetime.fromisoformat(str(value))
    except (TypeError, ValueError):
        return None


def _decay_rate_for_days(idle_days: float) -> float:
    """Decay fraction for a given number of idle days (0.05/7 days, capped)."""
    if idle_days < DECAY_THRESHOLD_DAYS:
        return 0.0
    windows = (idle_days - DECAY_THRESHOLD_DAYS) // DECAY_THRESHOLD_DAYS + 1
    return min(DECAY_RATE * windows, DECAY_MAX)


async def apply_decay(user_id: str, course_id: str) -> dict[str, Any]:
    """Apply forgetting-curve decay to a user's mastery in a course.

    Concepts with ``last_practiced_at`` older than 7 days lose 5% per idle
    window (14 days → 10%, …), capped at 30% total, and never drop below
    ``DECAY_FLOOR``. Trend is set to ``declining`` when a decay happened.
    """
    db = get_db()
    now = datetime.now(timezone.utc)
    rows = await db.concept_mastery.find(
        {"user_id": user_id, "course_id": course_id}
    ).to_list(1000)

    decayed: list[dict[str, Any]] = []
    for row in rows:
        last = _parse_dt(row.get("last_practiced_at"))
        if last is None:
            continue
        idle_days = max(0.0, (now - last).total_seconds() / 86400.0)
        rate = _decay_rate_for_days(idle_days)
        if rate <= 0.0:
            continue

        old_score = row.get("mastery_score", DEFAULT_MASTERY)
        new_score = round(max(DECAY_FLOOR, old_score * (1.0 - rate)), 2)
        if abs(new_score - old_score) < 0.01:
            continue

        update: dict[str, Any] = {
            "mastery_score": new_score,
            "trend": "declining",
            "updated_at": now.isoformat(),
        }
        await db.concept_mastery.update_one(
            {"_id": row["_id"]}, {"$set": update}
        )
        decayed.append({
            "concept_id": row.get("concept_id", ""),
            "mastery_before": old_score,
            "mastery_after": new_score,
            "idle_days": round(idle_days, 1),
        })

    if decayed:
        await _invalidate_mastery_cache(user_id, course_id)

    return {
        "user_id": user_id,
        "course_id": course_id,
        "decayed": decayed,
        "concepts_decayed": len(decayed),
    }


async def recalculate_mastery(
    user_id: str, course_id: str, concept_id: str
) -> dict[str, Any]:
    """Recompute mastery for one concept by replaying ``quiz_attempts``.

    Every answered question for the concept is fed through ``_update_score_elo``
    in chronological order starting from ``DEFAULT_MASTERY``. The result is
    persisted and the cache invalidated.
    """
    db = get_db()
    read_db = get_read_db()

    attempts = await read_db.quiz_attempts.find(
        {"user_id": user_id, "course_id": course_id}
    ).to_list(5000)
    attempts.sort(key=lambda a: a.get("created_at", ""))

    score = DEFAULT_MASTERY
    attempts_count = 0
    correct_count = 0
    for attempt in attempts:
        for q in attempt.get("questions", []):
            if q.get("concept_id") != concept_id:
                continue
            attempts_count += 1
            correct = bool(q.get("correct", False))
            if correct:
                correct_count += 1
            difficulty = int(q.get("difficulty", 5) or 5)
            time_seconds = q.get("time_seconds")
            score = _update_score_elo(
                score, attempts_count, correct, difficulty, time_seconds
            )

    trend = "stable"
    if attempts_count == 0:
        score = DEFAULT_MASTERY

    mastery_id = f"mast-{user_id}-{concept_id}"
    now = datetime.now(timezone.utc).isoformat()
    await db.concept_mastery.update_one(
        {"_id": mastery_id},
        {
            "$set": {
                "user_id": user_id,
                "course_id": course_id,
                "concept_id": concept_id,
                "mastery_score": score,
                "attempts": attempts_count,
                "correct_attempts": correct_count,
                "trend": trend,
                "updated_at": now,
            },
            "$setOnInsert": {
                "last_practiced_at": None,
                "created_at": now,
            },
        },
        upsert=True,
    )
    await _invalidate_mastery_cache(user_id, course_id)

    return {
        "user_id": user_id,
        "course_id": course_id,
        "concept_id": concept_id,
        "mastery_score": score,
        "attempts": attempts_count,
        "correct_attempts": correct_count,
        "trend": trend,
    }


async def get_recommended_sequence(
    user_id: str, course_id: str
) -> dict[str, Any]:
    """Build the dependency-ordered recommended lesson sequence.

    Response shape is frozen (Phase 5 contract §4, consumed by AI-C):
    ``{course_id, sequence: [{lesson_id, title, order, status, is_synthetic,
    weak_concepts, strong_concepts}]}``. Synthetic remedial items also carry
    ``target_lesson_id``.
    """
    mastery_map = await get_course_mastery_map(user_id, course_id)
    all_concepts = await get_all_concepts_for_course(course_id)
    concept_by_id = {c["_id"]: c for c in all_concepts}

    course = await get_read_db().courses.find_one({"_id": course_id})
    syllabus = course.get("syllabus", []) if course else []

    lesson_concepts: dict[str, list[dict[str, Any]]] = {}
    for lesson in syllabus:
        lesson_id = lesson.get("id", "")
        lesson_concepts[lesson_id] = [
            c for c in all_concepts if lesson_id in c.get("lesson_ids", [])
        ]

    ordered_lessons = _topo_sort_lessons(syllabus, lesson_concepts, concept_by_id)

    seen_lessons: set[str] = set()
    sequence: list[dict[str, Any]] = []

    for lesson in ordered_lessons:
        lesson_id = lesson.get("id", "")
        lc = lesson_concepts.get(lesson_id, [])

        weak = [c for c in lc if mastery_map.get(c["_id"], DEFAULT_MASTERY) < 3.0]
        strong = [c for c in lc if mastery_map.get(c["_id"], DEFAULT_MASTERY) >= 7.0]

        # Prerequisite-aware rerouting: unmastered prerequisites (< 4.0) on any
        # concept of this lesson → synthetic remedial item inserted just before.
        prerequisite_concept_ids: list[str] = []
        for c in lc:
            for p in c.get("prerequisite_concepts", []):
                if (
                    p in concept_by_id
                    and mastery_map.get(p, 0) < 4.0
                    and p not in prerequisite_concept_ids
                ):
                    prerequisite_concept_ids.append(p)

        if prerequisite_concept_ids and lesson_id not in seen_lessons:
            sequence.append({
                "lesson_id": f"remedial-{lesson_id}",
                "title": f"Prerequisite practice for {lesson.get('title', lesson_id)}",
                "order": lesson.get("order", 0),
                "status": "remedial",
                "is_synthetic": True,
                "target_lesson_id": lesson_id,
                "weak_concepts": [
                    concept_by_id.get(cid, {}).get("name", cid)
                    for cid in prerequisite_concept_ids
                ],
                "strong_concepts": [],
            })

        if lesson_id in seen_lessons:
            continue

        if weak:
            status = "remedial"
        elif lc and len(strong) == len(lc):
            status = "ready-to-skip"
        else:
            status = "normal"

        sequence.append({
            "lesson_id": lesson_id,
            "title": lesson.get("title", ""),
            "order": lesson.get("order", 0),
            "status": status,
            "is_synthetic": False,
            "weak_concepts": [
                concept_by_id.get(c["_id"], {}).get("name", c["_id"]) for c in weak
            ],
            "strong_concepts": [
                concept_by_id.get(c["_id"], {}).get("name", c["_id"]) for c in strong
            ],
        })
        seen_lessons.add(lesson_id)

    return {"course_id": course_id, "sequence": sequence}


def _topo_sort_lessons(
    syllabus: list[dict[str, Any]],
    lesson_concepts: dict[str, list[dict[str, Any]]],
    concept_by_id: dict[str, dict[str, Any]],
) -> list[dict[str, Any]]:
    """Order lessons so prerequisites come before dependents.

    Edges come from ``prerequisite_concepts`` on the lesson's concepts; ties
    keep the original syllabus order (Kahn's algorithm with a stable queue).
    """
    lesson_ids = [lesson.get("id", "") for lesson in syllabus]
    index = {lid: i for i, lid in enumerate(lesson_ids)}

    concept_lessons: dict[str, set[str]] = {}
    for lid, concepts in lesson_concepts.items():
        for c in concepts:
            concept_lessons.setdefault(c["_id"], set()).add(lid)

    deps: dict[str, set[str]] = {lid: set() for lid in lesson_ids}
    for lid, concepts in lesson_concepts.items():
        for c in concepts:
            for pid in c.get("prerequisite_concepts", []):
                if pid not in concept_by_id:
                    continue
                owners = [o for o in concept_lessons.get(pid, set()) if o != lid]
                if owners:
                    owner = min(owners, key=lambda o: index.get(o, 0))
                    deps[lid].add(owner)

    ready = sorted(
        (lid for lid in lesson_ids if not deps[lid]),
        key=lambda lid: index.get(lid, 0),
    )
    remaining = dict(deps)
    ordered: list[str] = []
    while ready:
        lid = ready.pop(0)
        ordered.append(lid)
        for candidate in sorted(
            (c for c, d in remaining.items() if lid in d),
            key=lambda c: index.get(c, 0),
        ):
            remaining[candidate].discard(lid)
            if not remaining[candidate]:
                ready.append(candidate)

    leftovers = [lid for lid in lesson_ids if lid not in ordered]
    ordered.extend(sorted(leftovers, key=lambda lid: index.get(lid, 0)))

    by_id = {lesson.get("id", ""): lesson for lesson in syllabus}
    return [by_id[lid] for lid in ordered if lid in by_id]


async def _invalidate_mastery_cache(user_id: str, course_id: str) -> None:
    from app.services.cache import invalidate_pattern

    # Cache keys are built from alphabetically sorted params (see
    # cache._build_cache_key), so course_id sorts before user_id.
    try:
        await invalidate_pattern(f"mastery_map:course_id={course_id}:user_id={user_id}*")
    except Exception as exc:
        logger.warning(
            "Failed to invalidate mastery cache for %s/%s: %s",
            user_id, course_id, exc,
        )
