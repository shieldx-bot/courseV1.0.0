"""Community services: Challenge grading (shim) + AI Mentor + Activity Feed + Creator.

Phase 7 hardening: challenge grading (`_grade_challenge`, `submit_challenge`,
`analyze_attempt`) moved to `app/services/challenges_service.py`. This module
re-exports them so the `challenges` router keeps working unchanged.
"""

import logging
from datetime import datetime, timezone
from typing import Any

from app.db.mongodb import get_db, get_read_db
from app.services.challenges_service import (  # noqa: F401  (re-export shim)
    _grade_challenge,
    analyze_attempt,
    submit_challenge,
)

logger = logging.getLogger(__name__)


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


# ── Activity Feed ─────────────────────────────────────────────────────────────

ACTIVITY_LABELS = {
    "challenge_completed": "hoàn thành challenge",
    "challenge_created": "đã tạo challenge mới",
    "skill_milestone": "đạt level",
    "badge_earned": "nhận badge",
    "creator_level_up": "lên cấp creator",
    "top_rank": "lọt Top",
}


async def create_activity(user_id: str, event_type: str, payload: dict, visibility: str = "public") -> dict:
    db = get_db()
    doc = {
        "_id": f"act-{event_type}-{user_id}-{int(datetime.now(timezone.utc).timestamp() * 1000)}",
        "user_id": user_id, "type": event_type, "payload": payload,
        "visibility": visibility, "created_at": _now(),
    }
    await db.activity_events.insert_one(doc)
    return doc


async def get_public_feed(limit: int = 30, include_user_id: str | None = None) -> list[dict[str, Any]]:
    db = get_read_db()
    query: dict[str, Any] = {"visibility": "public"}
    if include_user_id:
        prof = await db.creator_profiles.find_one({"_id": f"cp-{include_user_id}"})
        followed_ids = [f["user_id"] for f in prof.get("followers", [])] if prof else []
        query = {"$or": [{"visibility": "public"}, {"user_id": {"$in": followed_ids + [include_user_id]}}]}

    events = await db.activity_events.find(query).sort("created_at", -1).to_list(length=limit)
    result = []
    for ev in events:
        user = await db.users.find_one({"_id": ev["user_id"]})
        result.append({
            "id": ev["_id"], "user_id": ev["user_id"],
            "user_name": user.get("name") if user else "Unknown",
            "type": ev["type"], "label": ACTIVITY_LABELS.get(ev["type"], ev["type"]),
            "payload": ev.get("payload", {}), "created_at": ev["created_at"],
        })
    return result


async def get_my_activity(user_id: str, limit: int = 30) -> list[dict[str, Any]]:
    db = get_read_db()
    events = await db.activity_events.find({"user_id": user_id}).sort("created_at", -1).to_list(length=limit)
    return [{
        "id": e["_id"], "type": e["type"],
        "label": ACTIVITY_LABELS.get(e["type"], e["type"]),
        "payload": e.get("payload", {}), "created_at": e["created_at"],
    } for e in events]


# ── Creator System ────────────────────────────────────────────────────────────

async def get_creator_profile(user_id: str) -> dict[str, Any]:
    db = get_read_db()
    doc_id = f"cp-{user_id}"
    profile = await db.creator_profiles.find_one({"_id": doc_id})
    if not profile:
        await get_db().creator_profiles.insert_one({
            "_id": doc_id, "user_id": user_id, "level": "beginner", "level_score": 0.0,
            "total_challenges": 0, "published_challenges": 0, "total_attempts_received": 0,
            "avg_completion_rate": 0.0, "avg_rating": 0.0, "followers": [], "badges": [],
            "created_at": _now(), "updated_at": _now(),
        })
        profile = await db.creator_profiles.find_one({"_id": doc_id})

    user = await db.users.find_one({"_id": user_id})
    return {
        "user_id": user_id,
        "user_name": user.get("name") if user else "Unknown",
        "level": profile.get("level", "beginner"),
        "level_score": round(profile.get("level_score", 0.0), 1),
        "total_challenges": profile.get("total_challenges", 0),
        "published_challenges": profile.get("published_challenges", 0),
        "total_attempts_received": profile.get("total_attempts_received", 0),
        "avg_completion_rate": round(profile.get("avg_completion_rate", 0.0), 2),
        "avg_rating": round(profile.get("avg_rating", 0.0), 1),
        "followers_count": len(profile.get("followers", [])),
        "badges": profile.get("badges", []),
    }


async def _update_creator_stats(user_id: str) -> None:
    db = get_db()
    doc_id = f"cp-{user_id}"
    profile = await db.creator_profiles.find_one({"_id": doc_id})
    if not profile:
        return
    challenges = await db.challenges.find({"creator_id": user_id}).to_list(length=500)
    total_attempts = sum(c.get("stats", {}).get("attempts", 0) for c in challenges)
    published = await db.challenges.count_documents({"creator_id": user_id, "status": "published"})
    level_score = min(100.0, published * 10 + total_attempts * 0.5)
    level = _creator_level(level_score)
    await db.creator_profiles.update_one({"_id": doc_id}, {"$set": {
        "total_attempts_received": total_attempts,
        "published_challenges": published,
        "level_score": round(level_score, 1), "level": level, "updated_at": _now(),
    }})


def _creator_level(score: float) -> str:
    if score >= 85:
        return "legend"
    if score >= 65:
        return "expert"
    if score >= 40:
        return "trusted"
    return "beginner"


async def bookmark_challenge(user_id: str, challenge_id: str) -> dict:
    """Bookmark a challenge for later."""
    db = get_db()
    challenge = await db.challenges.find_one({"_id": challenge_id})
    if not challenge:
        return {"error": True, "message": "Challenge not found."}

    doc_id = f"bm-{user_id}-{challenge_id}"
    existing = await db.bookmarks.find_one({"_id": doc_id})
    if existing:
        return {"success": True, "bookmarked": True}
    await db.bookmarks.insert_one({
        "_id": doc_id, "user_id": user_id, "challenge_id": challenge_id,
        "created_at": _now(),
    })
    await db.challenges.update_one({"_id": challenge_id}, {"$inc": {"stats.bookmarks": 1}})
    return {"success": True, "bookmarked": True}


async def unbookmark_challenge(user_id: str, challenge_id: str) -> dict:
    db = get_db()
    doc_id = f"bm-{user_id}-{challenge_id}"
    result = await db.bookmarks.delete_many({"_id": doc_id})
    challenge = await db.challenges.find_one({"_id": challenge_id})
    if challenge and challenge.get("stats", {}).get("bookmarks", 0) > 0:
        await db.challenges.update_one({"_id": challenge_id}, {"$inc": {"stats.bookmarks": -1}})
    return {"success": True, "bookmarked": False}


async def get_my_bookmarks(user_id: str, limit: int = 50) -> list[dict[str, Any]]:
    db = get_read_db()
    bms = await db.bookmarks.find({"user_id": user_id}).sort("created_at", -1).to_list(length=limit)
    challenges = []
    for bm in bms:
        c = await db.challenges.find_one({"_id": bm["challenge_id"], "status": "published"})
        if c:
            challenges.append(c)
    return challenges


async def rate_challenge(user_id: str, challenge_id: str, rating: int) -> dict:
    """Rate a challenge 1-5."""
    db = get_db()
    if rating < 1 or rating > 5:
        return {"error": True, "message": "Rating must be between 1 and 5."}
    challenge = await db.challenges.find_one({"_id": challenge_id})
    if not challenge:
        return {"error": True, "message": "Challenge not found."}

    doc_id = f"rate-{user_id}-{challenge_id}"
    existing = await db.ratings.find_one({"_id": doc_id})
    if existing:
        await db.ratings.update_one({"_id": doc_id}, {"$set": {"rating": rating, "updated_at": _now()}})
    else:
        await db.ratings.insert_one({
            "_id": doc_id, "user_id": user_id, "challenge_id": challenge_id,
            "rating": rating, "created_at": _now(),
        })

    # Recompute average
    ratings = await db.ratings.find({"challenge_id": challenge_id}).to_list(length=10000)
    avg = sum(r["rating"] for r in ratings) / len(ratings) if ratings else 0.0
    await db.challenges.update_one({"_id": challenge_id}, {"$set": {"stats.avg_rating": round(avg, 2)}})

    # Publish domain event — challenge author notification reacts.
    from app.core.events import Event, bus
    await bus.publish(Event(
        name="RatingChanged",
        producer="community.rate_challenge",
        payload={
            "challenge_id": challenge_id,
            "challenge_title": challenge.get("title", ""),
            "creator_id": challenge.get("creator_id"),
            "user_id": user_id,
            "rating": int(rating),
            "avg_rating": round(avg, 2),
        },
    ))
    return {"success": True, "avg_rating": round(avg, 2), "rated": True}


async def delete_challenge(user_id: str, challenge_id: str, is_admin: bool = False) -> dict:
    """Delete a challenge if owner or admin."""
    db = get_db()
    challenge = await db.challenges.find_one({"_id": challenge_id})
    if not challenge:
        return {"error": True, "message": "Challenge not found."}
    if not is_admin and challenge.get("creator_id") != user_id:
        return {"error": True, "message": "Not authorized to delete this challenge."}
    await db.challenges.delete_many({"_id": challenge_id})
    await db.challenge_attempts.delete_many({"challenge_id": challenge_id})
    await db.bookmarks.delete_many({"challenge_id": challenge_id})
    await db.ratings.delete_many({"challenge_id": challenge_id})
    return {"success": True}


async def update_challenge(user_id: str, challenge_id: str, body: dict, is_admin: bool = False) -> dict:
    """Update a challenge if owner or admin."""
    db = get_db()
    challenge = await db.challenges.find_one({"_id": challenge_id})
    if not challenge:
        return {"error": True, "message": "Challenge not found."}
    if not is_admin and challenge.get("creator_id") != user_id:
        return {"error": True, "message": "Not authorized to update this challenge."}

    allowed = {
        "title", "description", "topic", "domain", "difficulty", "difficulty_score",
        "type", "content", "explanation", "skills", "skills_raw", "status",
    }
    updates = {}
    for k, v in body.items():
        if k in allowed:
            updates[k] = v
    current_type = challenge.get("type")
    if "content" in updates:
        content = updates["content"]
        ctype = updates.get("type", current_type)
        if ctype == "theory" and "options" in content:
            # Keep structure aligned with type
            content.setdefault("correct", content.get("correct", 0))
        elif "expected_answer" in content:
            content.setdefault("expected_answer", content.get("expected_answer", ""))
        updates["content"] = content
    updates["updated_at"] = _now()
    await db.challenges.update_one({"_id": challenge_id}, {"$set": updates})
    updated = await db.challenges.find_one({"_id": challenge_id})
    return {"success": True, "challenge": updated}


async def publish_challenge(user_id: str, challenge_id: str) -> dict:
    """Publish a challenge if owner or admin."""
    db = get_db()
    challenge = await db.challenges.find_one({"_id": challenge_id})
    if not challenge:
        return {"error": True, "message": "Challenge not found."}
    if challenge.get("creator_id") != user_id:
        return {"error": True, "message": "Not authorized to publish this challenge."}
    await db.challenges.update_one({"_id": challenge_id}, {"$set": {"status": "published", "updated_at": _now()}})
    await _update_creator_stats(user_id)
    await create_activity(user_id, "challenge_created", {
        "challenge_id": challenge_id, "challenge_title": challenge.get("title", ""),
    })

    # Publish domain event — follower fan-out / creator analytics react.
    from app.core.events import Event, bus
    await bus.publish(Event(
        name="ChallengePublished",
        producer="community.publish_challenge",
        payload={
            "challenge_id": challenge_id,
            "challenge_title": challenge.get("title", ""),
            "creator_id": user_id,
            "difficulty": challenge.get("difficulty", "medium"),
        },
    ))
    return {"success": True, "status": "published"}


async def get_user_created_challenges(user_id: str, limit: int = 50) -> list[dict[str, Any]]:
    db = get_read_db()
    return await db.challenges.find({"creator_id": user_id}).sort("created_at", -1).to_list(length=limit)


async def follow_creator(follower_id: str, creator_id: str) -> dict:
    db = get_db()
    doc_id = f"cp-{creator_id}"
    profile = await db.creator_profiles.find_one({"_id": doc_id})
    if not profile:
        return {"error": True, "message": "Creator not found."}
    followers = [f for f in profile.get("followers", []) if f["user_id"] != follower_id]
    followers.append({"user_id": follower_id, "since": _now()})
    await db.creator_profiles.update_one({"_id": doc_id}, {"$set": {"followers": followers}})

    # Publish domain event — creator notification / analytics react.
    from app.core.events import Event, bus
    await bus.publish(Event(
        name="CreatorFollowed",
        producer="community.follow_creator",
        payload={
            "creator_id": creator_id,
            "follower_id": follower_id,
        },
    ))
    return {"success": True}


async def unfollow_creator(follower_id: str, creator_id: str) -> dict:
    db = get_db()
    doc_id = f"cp-{creator_id}"
    profile = await db.creator_profiles.find_one({"_id": doc_id})
    if not profile:
        return {"error": True, "message": "Creator not found."}
    followers = [f for f in profile.get("followers", []) if f["user_id"] != follower_id]
    await db.creator_profiles.update_one({"_id": doc_id}, {"$set": {"followers": followers}})
    return {"success": True}
