"""Creator Economy services — profiles, verification, trust, achievements.

Extracted from the former `ecosystem` monolith (Phase 7 hardening) without any
behavioral change. `app/services/ecosystem.py` remains a facade re-exporting
this public API, so call sites (routers, handlers) never change.
"""

import logging
import re
from datetime import datetime, timedelta, timezone
from typing import Any

from app.core.collections import Collections as C
from app.db.mongodb import get_db, get_read_db
from app.services.community import create_activity
from app.services.notifications import create_notification

logger = logging.getLogger(__name__)


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _ts() -> int:
    return int(datetime.now(timezone.utc).timestamp() * 1000)


def _slug(text: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")[:60]


CREATOR_BADGES = {
    "first_publish": {"label": "First Publish", "icon": "🚀", "description": "Published your first challenge"},
    "quality_10": {"label": "Quality Star", "icon": "⭐", "description": "Reached 10 quality reviews"},
    "popular_100": {"label": "Crowd Favorite", "icon": "🔥", "description": "100+ attempts on your challenges"},
    "mentor_5": {"label": "Community Mentor", "icon": "🎓", "description": "5+ uses of your creator profile"},
    "verified": {"label": "Verified Creator", "icon": "✅", "description": "Identity verified by platform"},
    "veteran_10": {"label": "Content Veteran", "icon": "🏆", "description": "Published 10+ challenges"},
    "series_1": {"label": "Series Author", "icon": "📚", "description": "Created your first learning series"},
    "event_host": {"label": "Event Host", "icon": "🎪", "description": "Hosted your first community event"},
    "collab_1": {"label": "Collaborator", "icon": "🤝", "description": "Co-authored a challenge with another creator"},
}

CREATOR_MILESTONES = [
    {"id": "m_publish_1", "label": "First Challenge", "target": 1, "metric": "published_challenges"},
    {"id": "m_publish_5", "label": "5 Challenges Published", "target": 5, "metric": "published_challenges"},
    {"id": "m_publish_10", "label": "10 Challenges Published", "target": 10, "metric": "published_challenges"},
    {"id": "m_attempts_50", "label": "50 Attempts Received", "target": 50, "metric": "total_attempts_received"},
    {"id": "m_attempts_500", "label": "500 Attempts Received", "target": 500, "metric": "total_attempts_received"},
    {"id": "m_rating_45", "label": "4.5★ Average Rating", "target": 45, "metric": "avg_rating_x10"},
    {"id": "m_followers_10", "label": "10 Followers", "target": 10, "metric": "followers"},
    {"id": "m_followers_100", "label": "100 Followers", "target": 100, "metric": "followers"},
    {"id": "m_series_1", "label": "First Series", "target": 1, "metric": "series_count"},
    {"id": "m_event_1", "label": "First Event Hosted", "target": 1, "metric": "events_hosted"},
]


async def get_or_create_creator_profile(user_id: str) -> dict:
    db = get_db()
    doc_id = f"cp-{user_id}"
    profile = await db[C.CREATOR_PROFILES].find_one({"_id": doc_id})
    if not profile:
        profile = {
            "_id": doc_id, "user_id": user_id, "level": "beginner", "level_score": 0.0,
            "total_challenges": 0, "published_challenges": 0, "total_attempts_received": 0,
            "avg_completion_rate": 0.0, "avg_rating": 0.0, "followers": [],
            "verification": {"status": "unverified", "requested_at": None, "reviewed_at": None,
                             "reviewer_id": None, "note": None},
            "trust_score": 0.0, "badges": [], "achievements": [],
            "collections": [], "series": [], "analytics": {"views_7d": 0, "attempts_7d": 0,
                                                            "new_followers_7d": 0, "ratings_7d": []},
            "events_hosted": 0, "collaborations": [],
            "created_at": _now(), "updated_at": _now(),
        }
        await db[C.CREATOR_PROFILES].insert_one(profile)
    return profile


async def request_creator_verification(user_id: str, body: dict) -> dict:
    """Request creator verification (identity / expertise check)."""
    db = get_db()
    profile = await get_or_create_creator_profile(user_id)
    doc_id = profile["_id"]
    verification = dict(profile.get("verification", {}))
    verification.update({
        "status": "pending",
        "requested_at": _now(),
        "full_name": body.get("full_name", ""),
        "expertise_area": body.get("expertise_area", ""),
        "evidence_urls": body.get("evidence_urls", []),
        "note": body.get("note", ""),
    })
    await db[C.CREATOR_PROFILES].update_one({"_id": doc_id}, {"$set": {"verification": verification, "updated_at": _now()}})
    return {"success": True, "status": "pending"}


async def review_creator_verification(reviewer_id: str, creator_id: str, approve: bool, note: str = "") -> dict:
    """Admin approves/rejects a creator verification request."""
    db = get_db()
    doc_id = f"cp-{creator_id}"
    profile = await db[C.CREATOR_PROFILES].find_one({"_id": doc_id})
    if not profile:
        return {"error": True, "message": "Creator profile not found."}
    verification = dict(profile.get("verification", {}))
    verification["status"] = "verified" if approve else "rejected"
    verification["reviewed_at"] = _now()
    verification["reviewer_id"] = reviewer_id
    verification["note"] = note
    updates: dict[str, Any] = {"verification": verification, "updated_at": _now()}
    if approve:
        updates["badges"] = list(set(profile.get("badges", []) + ["verified"]))
        await create_activity(creator_id, "creator_verified", {"note": note})
        await create_notification(creator_id, "creator_verified", {"note": note}, link="/creator")
    else:
        await create_notification(creator_id, "creator_verification_rejected", {"note": note}, link="/creator")
    await db[C.CREATOR_PROFILES].update_one({"_id": doc_id}, {"$set": updates})

    # Publish domain event — trust / achievements / audit domains react.
    from app.core.events import Event, bus
    await bus.publish(Event(
        name="CreatorVerified",
        producer="creator.review_creator_verification",
        payload={
            "creator_id": creator_id,
            "reviewer_id": reviewer_id,
            "approved": bool(approve),
            "status": verification["status"],
            "note": note,
        },
    ))

    return {"success": True, "status": verification["status"]}


def _trust_score(profile: dict) -> float:
    """Compute a 0-100 trust score from verifiable signals."""
    score = 0.0
    if profile.get("verification", {}).get("status") == "verified":
        score += 30
    score += min(30, profile.get("published_challenges", 0) * 3)
    score += min(20, profile.get("total_attempts_received", 0) * 0.1)
    score += min(10, profile.get("followers", []).__len__() * 0.5)
    score += min(10, len(profile.get("badges", [])) * 2)
    return round(min(100, score), 1)


async def _load_users_batch(db, user_ids: list) -> dict:
    """Batch-load user docs by id (eliminates N+1 in list endpoints)."""
    ids = list(dict.fromkeys([u for u in user_ids if u]))
    if not ids:
        return {}
    docs = await db[C.USERS].find({"$or": [{"_id": i} for i in ids]}).to_list(length=len(ids))
    return {d["_id"]: d for d in docs}


async def _load_challenges_batch(db, challenge_ids: list) -> dict:
    """Batch-load challenge docs by id (eliminates N+1 in list endpoints)."""
    ids = list(dict.fromkeys([c for c in challenge_ids if c]))
    if not ids:
        return {}
    docs = await db[C.CHALLENGES].find({"$or": [{"_id": c} for c in ids]}).to_list(length=len(ids))
    return {d["_id"]: d for d in docs}


async def compute_creator_trust(user_id: str) -> dict:
    db = get_db()
    profile = await get_or_create_creator_profile(user_id)
    trust = _trust_score(profile)
    await db[C.CREATOR_PROFILES].update_one({"_id": profile["_id"]}, {"$set": {"trust_score": trust, "updated_at": _now()}})
    return {"trust_score": trust, "level": profile.get("level", "beginner")}


async def refresh_achievements(user_id: str) -> dict:
    """Evaluate milestones and award achievements/badges automatically."""
    db = get_db()
    profile = await get_or_create_creator_profile(user_id)
    doc_id = profile["_id"]
    challenges = await db[C.CHALLENGES].find({"creator_id": user_id}).to_list(length=1000)
    published = [c for c in challenges if c.get("status") == "published"]
    total_attempts = sum(c.get("stats", {}).get("attempts", 0) for c in challenges)
    ratings = await db[C.RATINGS].find({"challenge_id": {"$in": [c["_id"] for c in published]}}).to_list(length=10000)
    avg_rating_x10 = round(sum(r.get("rating", 0) for r in ratings) / len(ratings) * 10) if ratings else 0

    metrics = {
        "published_challenges": len(published),
        "total_attempts_received": total_attempts,
        "avg_rating_x10": avg_rating_x10,
        "followers": len(profile.get("followers", []) or []),
        "series_count": len(profile.get("series", []) or []),
        "events_hosted": profile.get("events_hosted", 0) or 0,
    }

    earned = set(profile.get("achievements", []) or [])
    new_achievements = []
    for m in CREATOR_MILESTONES:
        if m["id"] not in earned and metrics.get(m["metric"], 0) >= m["target"]:
            earned.add(m["id"])
            new_achievements.append(m)

    # Badge auto-grants
    badges = set(profile.get("badges", []) or [])
    if len(published) >= 1:
        badges.add("first_publish")
    if total_attempts >= 100:
        badges.add("popular_100")
    if len(published) >= 10:
        badges.add("veteran_10")
    if len(profile.get("series", []) or []) >= 1:
        badges.add("series_1")
    if (profile.get("events_hosted", 0) or 0) >= 1:
        badges.add("event_host")

    new_badges = list(badges - set(profile.get("badges", []) or []))
    for b in new_badges:
        await create_activity(user_id, "badge_earned", {"badge": CREATOR_BADGES.get(b, {}).get("label", b)})

    # Level score
    level_score = min(100.0, len(published) * 8 + total_attempts * 0.3 + len(badges) * 3 + len(earned) * 2)
    level = "legend" if level_score >= 85 else "expert" if level_score >= 65 else "trusted" if level_score >= 40 else "beginner"

    if level != profile.get("level", "beginner") and new_badges:
        await create_activity(user_id, "creator_level_up", {"level": level})

    await db[C.CREATOR_PROFILES].update_one({"_id": doc_id}, {"$set": {
        "achievements": sorted(earned),
        "badges": sorted(badges),
        "level_score": round(level_score, 1),
        "level": level,
        "trust_score": _trust_score({**profile, "achievements": earned, "badges": badges}),
        "updated_at": _now(),
    }})

    return {
        "new_achievements": new_achievements,
        "new_badges": new_badges,
        "achievements": sorted(earned),
        "badges": sorted(badges),
        "level": level,
        "level_score": round(level_score, 1),
    }


async def get_creator_analytics(user_id: str, days: int = 30) -> dict:
    """Creator analytics — challenge performance, audience, recent activity."""
    db = get_read_db()
    profile = await get_or_create_creator_profile(user_id)
    since = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()
    challenges = await db[C.CHALLENGES].find({"creator_id": user_id}).to_list(length=1000)
    published = [c for c in challenges if c.get("status") == "published"]

    # Attempts in window
    attempt_docs = await db[C.CHALLENGE_ATTEMPTS].find({
        "created_at": {"$gte": since},
        "challenge_id": {"$in": [c["_id"] for c in published]},
    }).to_list(length=10000)
    attempts_in = len(attempt_docs)
    correct_in = sum(1 for a in attempt_docs if a.get("is_correct"))

    # Followers gained in window
    followers = profile.get("followers", []) or []
    new_followers = [f for f in followers if f.get("since", "") >= since]

    # Ratings in window
    ratings = await db[C.RATINGS].find({
        "challenge_id": {"$in": [c["_id"] for c in published]},
        "created_at": {"$gte": since},
    }).to_list(length=5000)

    # Per-challenge breakdown
    per_challenge = []
    for c in sorted(published, key=lambda x: x.get("stats", {}).get("attempts", 0), reverse=True)[:10]:
        per_challenge.append({
            "challenge_id": c["_id"],
            "title": c.get("title", ""),
            "difficulty": c.get("difficulty", "medium"),
            "attempts": c.get("stats", {}).get("attempts", 0),
            "completion_rate": c.get("stats", {}).get("completion_rate", 0.0),
            "avg_rating": c.get("stats", {}).get("avg_rating", 0.0),
            "bookmarks": c.get("stats", {}).get("bookmarks", 0),
            "created_at": c.get("created_at", ""),
        })

    return {
        "days": days,
        "profile": {
            "level": profile.get("level", "beginner"),
            "level_score": profile.get("level_score", 0.0),
            "trust_score": profile.get("trust_score", 0.0),
            "verification": profile.get("verification", {}).get("status", "unverified"),
            "followers": len(followers),
            "badges": profile.get("badges", []),
            "achievements": profile.get("achievements", []),
        },
        "totals": {
            "published_challenges": len(published),
            "total_challenges": len(challenges),
            "total_attempts_received": sum(c.get("stats", {}).get("attempts", 0) for c in challenges),
            "avg_completion_rate": round(sum(c.get("stats", {}).get("completion_rate", 0.0) for c in published) / len(published), 3) if published else 0.0,
            "avg_rating": round(sum(c.get("stats", {}).get("avg_rating", 0.0) for c in published) / len(published), 2) if published else 0.0,
        },
        "window": {
            "attempts": attempts_in,
            "correct": correct_in,
            "completion_rate": round(correct_in / attempts_in, 3) if attempts_in else 0.0,
            "new_followers": len(new_followers),
            "ratings_received": len(ratings),
            "avg_rating_window": round(sum(r.get("rating", 0) for r in ratings) / len(ratings), 2) if ratings else 0.0,
        },
        "per_challenge": per_challenge,
    }


async def get_creator_leaderboard(limit: int = 20) -> list[dict]:
    db = get_read_db()
    docs = await db[C.CREATOR_PROFILES].find({}).sort([
        ("level_score", -1), ("published_challenges", -1), ("trust_score", -1),
    ]).limit(limit).to_list(length=limit)
    users = await _load_users_batch(db, [p.get("user_id") for p in docs])
    out = []
    for i, p in enumerate(docs, 1):
        user = users.get(p.get("user_id"))
        out.append({
            "rank": i,
            "user_id": p.get("user_id"),
            "user_name": user.get("name", "Anonymous") if user else "Anonymous",
            "avatar_url": user.get("avatar_url") if user else None,
            "level": p.get("level", "beginner"),
            "level_score": p.get("level_score", 0.0),
            "published_challenges": p.get("published_challenges", 0),
            "total_attempts_received": p.get("total_attempts_received", 0),
            "followers": len(p.get("followers", []) or []),
            "trust_score": p.get("trust_score", 0.0),
            "verified": p.get("verification", {}).get("status") == "verified",
            "badges": p.get("badges", []),
        })
    return out
