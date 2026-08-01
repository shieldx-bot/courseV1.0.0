"""Ecosystem services — Creator Economy, Learning Marketplace, Events, Trust, Platform Intelligence.

Complements the existing challenge/creator stack with the network-effect layer:
  - Creator verification & trust scores
  - Creator analytics & milestones / achievements
  - Collections, series, and learning bundles (marketplace)
  - Scheduled + recurring events (weekly challenges, AMAs, office hours, live streams)
  - Moderation: reports, content review queue, anti-abuse signals
  - Platform intelligence: quality signals, trends, knowledge gaps
"""

import logging
import re
from datetime import datetime, timedelta, timezone
from typing import Any, Optional

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


# ────────────────────────────────────────────────────────────────────────────
# CREATOR ECONOMY
# ────────────────────────────────────────────────────────────────────────────

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
    profile = await db.creator_profiles.find_one({"_id": doc_id})
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
        await db.creator_profiles.insert_one(profile)
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
    await db.creator_profiles.update_one({"_id": doc_id}, {"$set": {"verification": verification, "updated_at": _now()}})
    return {"success": True, "status": "pending"}


async def review_creator_verification(reviewer_id: str, creator_id: str, approve: bool, note: str = "") -> dict:
    """Admin approves/rejects a creator verification request."""
    db = get_db()
    doc_id = f"cp-{creator_id}"
    profile = await db.creator_profiles.find_one({"_id": doc_id})
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
    await db.creator_profiles.update_one({"_id": doc_id}, {"$set": updates})
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
    docs = await db.users.find({"$or": [{"_id": i} for i in ids]}).to_list(length=len(ids))
    return {d["_id"]: d for d in docs}


async def _load_challenges_batch(db, challenge_ids: list) -> dict:
    """Batch-load challenge docs by id (eliminates N+1 in list endpoints)."""
    ids = list(dict.fromkeys([c for c in challenge_ids if c]))
    if not ids:
        return {}
    docs = await db.challenges.find({"$or": [{"_id": c} for c in ids]}).to_list(length=len(ids))
    return {d["_id"]: d for d in docs}


async def compute_creator_trust(user_id: str) -> dict:
    db = get_db()
    profile = await get_or_create_creator_profile(user_id)
    trust = _trust_score(profile)
    await db.creator_profiles.update_one({"_id": profile["_id"]}, {"$set": {"trust_score": trust, "updated_at": _now()}})
    return {"trust_score": trust, "level": profile.get("level", "beginner")}


async def refresh_achievements(user_id: str) -> dict:
    """Evaluate milestones and award achievements/badges automatically."""
    db = get_db()
    profile = await get_or_create_creator_profile(user_id)
    doc_id = profile["_id"]
    challenges = await db.challenges.find({"creator_id": user_id}).to_list(length=1000)
    published = [c for c in challenges if c.get("status") == "published"]
    total_attempts = sum(c.get("stats", {}).get("attempts", 0) for c in challenges)
    ratings = await db.ratings.find({"challenge_id": {"$in": [c["_id"] for c in published]}}).to_list(length=10000)
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

    await db.creator_profiles.update_one({"_id": doc_id}, {"$set": {
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
    challenges = await db.challenges.find({"creator_id": user_id}).to_list(length=1000)
    published = [c for c in challenges if c.get("status") == "published"]

    # Attempts in window
    attempts_in = 0
    correct_in = 0
    attempt_docs = await db.challenge_attempts.find({
        "created_at": {"$gte": since},
        "challenge_id": {"$in": [c["_id"] for c in published]},
    }).to_list(length=10000)
    attempts_in = len(attempt_docs)
    correct_in = sum(1 for a in attempt_docs if a.get("is_correct"))

    # Followers gained in window
    followers = profile.get("followers", []) or []
    new_followers = [f for f in followers if f.get("since", "") >= since]

    # Ratings in window
    ratings = await db.ratings.find({
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
    docs = await db.creator_profiles.find({}).sort([
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


# ────────────────────────────────────────────────────────────────────────────
# LEARNING MARKETPLACE — collections, series, bundles
# ────────────────────────────────────────────────────────────────────────────

async def create_collection(user_id: str, body: dict) -> dict:
    db = get_db()
    cid = f"col-{_slug(body.get('name', ''))}-{_ts()}" if body.get("name") else f"col-{_ts()}"
    doc = {
        "_id": cid,
        "name": body.get("name", "Untitled Collection"),
        "description": body.get("description", ""),
        "kind": body.get("kind", "collection"),  # collection | series | bundle | kit
        "creator_id": user_id,
        "challenge_ids": body.get("challenge_ids", []),
        "skill_ids": body.get("skill_ids", []),
        "tags": body.get("tags", []),
        "is_public": body.get("is_public", True),
        "is_premium": body.get("is_premium", False),
        "price_points": body.get("price_points", 0),
        "cover_emoji": body.get("cover_emoji", "📦"),
        "metadata": body.get("metadata", {}),
        "bookmark_count": 0,
        "created_at": _now(),
        "updated_at": _now(),
    }
    await db.collections.insert_one(doc)
    # Track on creator profile (series increments series count)
    profile = await get_or_create_creator_profile(user_id)
    kind = doc["kind"]
    if kind in ("series", "bundle"):
        await db.creator_profiles.update_one({"_id": profile["_id"]}, {"$push": {"series": {"collection_id": cid, "name": doc["name"], "kind": kind, "created_at": _now()}}})
    else:
        await db.creator_profiles.update_one({"_id": profile["_id"]}, {"$push": {"collections": {"collection_id": cid, "name": doc["name"], "created_at": _now()}}})
    await refresh_achievements(user_id)
    await create_activity(user_id, "collection_created", {"collection_id": cid, "name": doc["name"], "kind": kind})
    return {"collection_id": cid, "collection": doc}


async def list_collections(kind: Optional[str] = None, user_id: Optional[str] = None, public_only: bool = True, limit: int = 50) -> list[dict]:
    db = get_read_db()
    query: dict[str, Any] = {}
    if public_only:
        query["is_public"] = True
    if kind:
        query["kind"] = kind
    if user_id:
        query["creator_id"] = user_id
    docs = await db.collections.find(query).sort("created_at", -1).to_list(length=limit)
    users = await _load_users_batch(db, [d.get("creator_id") for d in docs])
    all_challenge_ids = []
    for d in docs:
        all_challenge_ids.extend((d.get("challenge_ids", []) or [])[:5])
    challenges = await _load_challenges_batch(db, all_challenge_ids)
    out = []
    for d in docs:
        creator = users.get(d.get("creator_id"))
        # Resolve challenge titles
        titles = []
        for cid in (d.get("challenge_ids", []) or [])[:5]:
            ch = challenges.get(cid)
            if ch:
                titles.append({"challenge_id": cid, "title": ch.get("title", ""), "difficulty": ch.get("difficulty", "medium")})
        out.append({
            "id": d["_id"], "name": d.get("name", ""), "description": d.get("description", ""),
            "kind": d.get("kind", "collection"), "creator_id": d.get("creator_id"),
            "creator_name": creator.get("name", "Anonymous") if creator else "Anonymous",
            "challenge_count": len(d.get("challenge_ids", []) or []),
            "challenge_preview": titles,
            "cover_emoji": d.get("cover_emoji", "📦"),
            "is_premium": d.get("is_premium", False),
            "bookmark_count": d.get("bookmark_count", 0),
            "created_at": d.get("created_at", ""),
        })
    return out


async def bookmark_collection(user_id: str, collection_id: str) -> dict:
    db = get_db()
    col = await db.collections.find_one({"_id": collection_id})
    if not col:
        return {"error": True, "message": "Collection not found."}
    doc_id = f"colbm-{user_id}-{collection_id}"
    existing = await db.collection_bookmarks.find_one({"_id": doc_id})
    if existing:
        return {"success": True, "bookmarked": True}
    await db.collection_bookmarks.insert_one({"_id": doc_id, "user_id": user_id, "collection_id": collection_id, "created_at": _now()})
    await db.collections.update_one({"_id": collection_id}, {"$inc": {"bookmark_count": 1}})
    return {"success": True, "bookmarked": True}


# ────────────────────────────────────────────────────────────────────────────
# CHALLENGE VERSIONING
# ────────────────────────────────────────────────────────────────────────────

async def create_challenge_version(user_id: str, challenge_id: str, body: dict) -> dict:
    """Snapshot current challenge content, then apply updates."""
    db = get_db()
    challenge = await db.challenges.find_one({"_id": challenge_id})
    if not challenge:
        return {"error": True, "message": "Challenge not found."}
    if challenge.get("creator_id") != user_id:
        return {"error": True, "message": "Not authorized."}

    version_id = f"ver-{challenge_id}-{_ts()}"
    version_doc = {
        "_id": version_id,
        "challenge_id": challenge_id,
        "author_id": user_id,
        "snapshot": {k: v for k, v in challenge.items() if k not in ("_id",)},
        "change_note": body.get("change_note", ""),
        "major_version": body.get("major_version", False),
        "created_at": _now(),
    }
    await db.challenge_versions.insert_one(version_doc)

    # Store version history on challenge
    await db.challenges.update_one({"_id": challenge_id}, {"$push": {"version_history": {
        "version_id": version_id, "version": len(challenge.get("version_history", []) or []) + 1,
        "change_note": body.get("change_note", ""), "created_at": _now(),
    }}})
    return {"success": True, "version_id": version_id, "version": len(challenge.get("version_history", []) or []) + 1}


async def get_challenge_versions(challenge_id: str, limit: int = 20) -> list[dict]:
    db = get_read_db()
    docs = await db.challenge_versions.find({"challenge_id": challenge_id}).sort("created_at", -1).to_list(length=limit)
    return [{
        "version_id": d["_id"],
        "change_note": d.get("change_note", ""),
        "major_version": d.get("major_version", False),
        "created_at": d.get("created_at", ""),
        "challenge_title": d.get("snapshot", {}).get("title", ""),
    } for d in docs]


# ────────────────────────────────────────────────────────────────────────────
# EVENT PLATFORM
# ────────────────────────────────────────────────────────────────────────────

EVENT_TEMPLATES = {
    "weekly_challenge": {"name": "Weekly Challenge", "interval_days": 7, "emoji": "⚡"},
    "monthly_championship": {"name": "Monthly Championship", "interval_days": 30, "emoji": "🏆"},
    "hackathon": {"name": "Hackathon", "interval_days": 0, "emoji": "💻"},
    "community_night": {"name": "Community Night", "interval_days": 14, "emoji": "🌙"},
    "office_hours": {"name": "Office Hours", "interval_days": 7, "emoji": "🕐"},
    "creator_livestream": {"name": "Creator Livestream", "interval_days": 0, "emoji": "📺"},
    "ama": {"name": "AMA Session", "interval_days": 0, "emoji": "🎤"},
    "certification_week": {"name": "Certification Week", "interval_days": 0, "emoji": "📜"},
    "university_cup": {"name": "University Cup", "interval_days": 0, "emoji": "🎓"},
    "company_event": {"name": "Company Event", "interval_days": 0, "emoji": "🏢"},
}


async def create_event(user_id: str, body: dict) -> dict:
    db = get_db()
    event_type = body.get("event_type", "community_night")
    template = EVENT_TEMPLATES.get(event_type, {"name": "Community Event", "interval_days": 0, "emoji": "🎉"})
    eid = f"evt-{_slug(body.get('title', template['name']))}-{_ts()}"
    start = body.get("start_time") or _now()
    doc = {
        "_id": eid,
        "title": body.get("title", f"{template['name']} #{_ts() % 10000}"),
        "description": body.get("description", ""),
        "event_type": event_type,
        "emoji": body.get("emoji", template["emoji"]),
        "host_id": user_id,
        "host_name": body.get("host_name", "Platform"),
        "mode": body.get("mode", "online"),
        "location": body.get("location", ""),
        "start_time": start,
        "end_time": body.get("end_time"),
        "recurring": body.get("recurring", template["interval_days"] > 0),
        "interval_days": body.get("interval_days", template["interval_days"]),
        "challenge_id": body.get("challenge_id"),
        "capacity": body.get("capacity"),
        "attendee_ids": body.get("attendee_ids", []),
        "tags": body.get("tags", []),
        "is_featured": body.get("is_featured", False),
        "status": "upcoming",  # upcoming | live | completed | cancelled
        "created_at": _now(),
        "updated_at": _now(),
    }
    await db.events.insert_one(doc)

    # Track events hosted by creator
    if body.get("host_id") == user_id:
        profile = await get_or_create_creator_profile(user_id)
        await db.creator_profiles.update_one({"_id": profile["_id"]}, {"$inc": {"events_hosted": 1}})
        await refresh_achievements(user_id)
    await create_activity(user_id, "event_created", {"event_id": eid, "event_title": doc["title"]})
    # Notify followers of the host
    try:
        from app.services.notifications import notify_followers
        await notify_followers(user_id, {"event_title": doc["title"], "event_id": eid})
    except Exception:
        pass
    return {"event_id": eid, "event": doc}


async def list_events(status: Optional[str] = None, event_type: Optional[str] = None, limit: int = 50) -> list[dict]:
    db = get_read_db()
    query: dict[str, Any] = {}
    if status:
        query["status"] = status
    else:
        query["status"] = {"$in": ["upcoming", "live"]}
    if event_type:
        query["event_type"] = event_type
    docs = await db.events.find(query).sort("start_time", 1).to_list(length=limit)
    # Auto-promote past events? Keep simple: enrich hosts
    hosts = await _load_users_batch(db, [d.get("host_id") for d in docs])
    out = []
    for d in docs:
        host = hosts.get(d.get("host_id"))
        out.append({
            "id": d["_id"], "title": d.get("title", ""), "description": d.get("description", ""),
            "event_type": d.get("event_type", ""), "emoji": d.get("emoji", "🎉"),
            "host_id": d.get("host_id"), "host_name": d.get("host_name") or (host.get("name", "Platform") if host else "Platform"),
            "mode": d.get("mode", "online"), "location": d.get("location", ""),
            "start_time": d.get("start_time", ""), "end_time": d.get("end_time"),
            "recurring": d.get("recurring", False), "interval_days": d.get("interval_days", 0),
            "challenge_id": d.get("challenge_id"), "capacity": d.get("capacity"),
            "attendee_count": len(d.get("attendee_ids", []) or []),
            "is_featured": d.get("is_featured", False), "status": d.get("status", "upcoming"),
            "created_at": d.get("created_at", ""),
        })
    return out


async def join_event(user_id: str, event_id: str) -> dict:
    db = get_db()
    event = await db.events.find_one({"_id": event_id})
    if not event:
        return {"error": True, "message": "Event not found."}
    attendees = event.get("attendee_ids", []) or []
    if user_id in attendees:
        return {"success": True, "joined": True}
    if event.get("capacity") and len(attendees) >= event["capacity"]:
        return {"error": True, "message": "Event is full."}
    await db.events.update_one({"_id": event_id}, {"$push": {"attendee_ids": user_id}})
    await create_notification(user_id, "event_joined_confirmation", {"event_title": event.get("title", "Event"), "event_id": event_id}, link=f"/events")
    return {"success": True, "joined": True}


async def leave_event(user_id: str, event_id: str) -> dict:
    db = get_db()
    await db.events.update_one({"_id": event_id}, {"$pull": {"attendee_ids": user_id}})
    return {"success": True, "joined": False}


# ────────────────────────────────────────────────────────────────────────────
# TRUST & MODERATION
# ────────────────────────────────────────────────────────────────────────────

MODERATION_CATEGORIES = {
    "spam": "Spam",
    "abuse": "Abuse / Harassment",
    "inappropriate": "Inappropriate Content",
    "copyright": "Copyright Violation",
    "low_quality": "Low Quality",
    "cheating": "Cheating / Plagiarism",
    "other": "Other",
}


async def submit_report(user_id: str, body: dict) -> dict:
    db = get_db()
    rid = f"rep-{_ts()}"
    category = body.get("category", "other")
    if category not in MODERATION_CATEGORIES:
        return {"error": True, "message": "Invalid category."}
    doc = {
        "_id": rid,
        "reporter_id": user_id,
        "target_type": body.get("target_type", ""),  # challenge | user | discussion | comment | collection | event
        "target_id": body.get("target_id", ""),
        "category": category,
        "reason": body.get("reason", ""),
        "status": "pending",  # pending | reviewing | resolved | dismissed
        "created_at": _now(),
        "updated_at": _now(),
    }
    await db.moderation_reports.insert_one(doc)
    return {"success": True, "report_id": rid}


async def list_moderation_queue(status: str = "pending", limit: int = 50) -> list[dict]:
    db = get_read_db()
    query: dict[str, Any] = {}
    if status:
        query["status"] = status
    docs = await db.moderation_reports.find(query).sort("created_at", 1).to_list(length=limit)
    out = []
    for d in docs:
        reporter = await db.users.find_one({"_id": d.get("reporter_id")})
        target = None
        if d.get("target_type") == "challenge":
            target = await db.challenges.find_one({"_id": d.get("target_id")})
            target = {"id": d["target_id"], "title": target.get("title", "") if target else "Unknown", "creator_id": target.get("creator_id") if target else None} if target else {"id": d["target_id"], "title": "Unknown"}
        elif d.get("target_type") == "user":
            t = await db.users.find_one({"_id": d.get("target_id")})
            target = {"id": d["target_id"], "title": t.get("name", "Unknown") if t else "Unknown"}
        elif d.get("target_type") == "discussion":
            t = await db.discussions.find_one({"_id": d.get("target_id")})
            target = {"id": d["target_id"], "title": t.get("title", "Unknown") if t else "Unknown"}
        out.append({
            "id": d["_id"],
            "reporter_id": d.get("reporter_id"),
            "reporter_name": reporter.get("name", "Anonymous") if reporter else "Anonymous",
            "target_type": d.get("target_type", ""),
            "target": target,
            "category": d.get("category", "other"),
            "category_label": MODERATION_CATEGORIES.get(d.get("category", "other"), "Other"),
            "reason": d.get("reason", ""),
            "status": d.get("status", "pending"),
            "created_at": d.get("created_at", ""),
        })
    return out


async def resolve_report(reviewer_id: str, report_id: str, action: str, note: str = "") -> dict:
    db = get_db()
    report = await db.moderation_reports.find_one({"_id": report_id})
    if not report:
        return {"error": True, "message": "Report not found."}
    status = "resolved" if action in ("warn", "remove", "ban") else "dismissed"
    updates: dict[str, Any] = {
        "status": status, "reviewer_id": reviewer_id, "review_note": note,
        "action_taken": action, "updated_at": _now(),
    }
    await db.moderation_reports.update_one({"_id": report_id}, {"$set": updates})

    # Apply action
    if action == "remove" and report.get("target_type"):
        target_id = report.get("target_id")
        if report["target_type"] == "challenge" and target_id:
            await db.challenges.update_one({"_id": target_id}, {"$set": {"status": "removed", "removal_note": note}})
        elif report["target_type"] == "discussion" and target_id:
            await db.discussions.update_one({"_id": target_id}, {"$set": {"is_locked": True, "is_removed": True}})
        elif report["target_type"] == "user" and target_id:
            await db.users.update_one({"_id": target_id}, {"$set": {"moderation_flag": "restricted"}})
    elif action == "warn" and report.get("target_type") == "user":
        target_id = report.get("target_id")
        if target_id:
            await db.users.update_one({"_id": target_id}, {"$inc": {"warnings": 1}})
    return {"success": True, "status": status}


async def moderation_stats() -> dict:
    db = get_read_db()
    total = await db.moderation_reports.count_documents({})
    pending = await db.moderation_reports.count_documents({"status": "pending"})
    resolved = await db.moderation_reports.count_documents({"status": "resolved"})
    dismissed = await db.moderation_reports.count_documents({"status": "dismissed"})
    # In-memory DB lacks aggregation — compute category stats client-side
    by_category: dict[str, int] = {}
    try:
        cursor = db.moderation_reports.aggregate([{"$group": {"_id": "$category", "count": {"$sum": 1}}}])
        async for doc in cursor:
            if doc["_id"]:
                by_category[doc["_id"]] = doc["count"]
    except Exception:
        all_reports = await db.moderation_reports.find({}).to_list(length=100000)
        for r in all_reports:
            cat = r.get("category", "other")
            by_category[cat] = by_category.get(cat, 0) + 1
    return {
        "total": total, "pending": pending, "resolved": resolved, "dismissed": dismissed,
        "by_category": by_category,
    }


# ────────────────────────────────────────────────────────────────────────────
# PLATFORM INTELLIGENCE
# ────────────────────────────────────────────────────────────────────────────

async def platform_intelligence() -> dict:
    """Automated signals: quality issues, trends, knowledge gaps, top creators."""
    db = get_read_db()
    now = _now()
    week_ago = (datetime.now(timezone.utc) - timedelta(days=7)).isoformat()

    # 1. Low-quality challenges (published, low rating + low completion + high delete/removal)
    low_quality = await db.challenges.find({
        "status": "published",
        "$or": [
            {"quality_score": {"$lt": 0.4}},
            {"stats.avg_rating": {"$lt": 2.5}},
        ],
        "stats.attempts": {"$gte": 3},
    }).sort("quality_score", 1).to_list(length=10)
    low_quality = [{
        "challenge_id": c["_id"], "title": c.get("title", ""),
        "quality_score": c.get("quality_score", 0.0),
        "avg_rating": c.get("stats", {}).get("avg_rating", 0.0),
        "completion_rate": c.get("stats", {}).get("completion_rate", 0.0),
        "attempts": c.get("stats", {}).get("attempts", 0),
    } for c in low_quality]

    # 2. Outdated / stale content (published 90+ days, no updates, low recent activity)
    stale_since = (datetime.now(timezone.utc) - timedelta(days=90)).isoformat()
    stale = []
    stale_candidates = await db.challenges.find({"status": "published"}).sort("stats.attempts", -1).to_list(length=100)
    for c in stale_candidates:
        recent = await db.challenge_attempts.count_documents({"challenge_id": c["_id"], "created_at": {"$gte": week_ago}})
        if recent == 0:
            stale.append({"challenge_id": c["_id"], "title": c.get("title", ""), "last_activity": "no_attempts_7d", "created_at": c.get("created_at", "")})
        if len(stale) >= 10:
            break

    # 3. Popular skills (most attempts in last 7 days)
    popular_attempts = await db.challenge_attempts.find({}).to_list(length=5000)
    skill_counts: dict[str, int] = {}
    for att in popular_attempts:
        for sid in (att.get("skills_tested", []) or []):
            skill_counts[sid] = skill_counts.get(sid, 0) + 1
    popular = sorted(skill_counts.items(), key=lambda x: x[1], reverse=True)[:10]
    popular_skills = []
    for sid, count in popular:
        skill = await db.skills.find_one({"_id": sid})
        popular_skills.append({
            "skill_id": sid,
            "name": skill.get("name", sid) if skill else sid,
            "category": skill.get("category", "") if skill else "",
            "attempts_7d": count,
        })

    # 4. Emerging technologies (skills with new challenges in last 14 days)
    emerging_since = (datetime.now(timezone.utc) - timedelta(days=14)).isoformat()
    emerging_skills = []
    skill_challenge_counts: dict[str, int] = {}
    new_challenges = await db.challenges.find({"status": "published"}).to_list(length=500)
    for ch in new_challenges:
        if ch.get("created_at", "") >= emerging_since:
            for sid in (ch.get("skills", []) or []):
                skill_challenge_counts[sid] = skill_challenge_counts.get(sid, 0) + 1
    for sid, count in sorted(skill_challenge_counts.items(), key=lambda x: x[1], reverse=True)[:10]:
        skill = await db.skills.find_one({"_id": sid})
        emerging_skills.append({
            "skill_id": sid,
            "name": skill.get("name", sid) if skill else sid,
            "category": skill.get("category", "") if skill else "",
            "new_challenges_14d": count,
        })

    # 5. Knowledge gaps (skill with few challenges but high demand/attempts)
    gap_candidates = []
    for p in popular[:20]:
        ch_count = await db.challenges.count_documents({"skills": p["_id"], "status": "published"})
        if ch_count <= 3:
            skill = await db.skills.find_one({"_id": p["_id"]})
            gap_candidates.append({
                "skill_id": p["_id"],
                "name": skill.get("name", p["_id"]) if skill else p["_id"],
                "category": skill.get("category", "") if skill else "",
                "attempts_7d": p["count"],
                "challenges_available": ch_count,
            })
        if len(gap_candidates) >= 5:
            break

    # 6. Creator quality ranking
    top_creators = await db.creator_profiles.find({}).sort([
        ("trust_score", -1), ("level_score", -1),
    ]).limit(5).to_list(length=5)
    creator_list = []
    for c in top_creators:
        u = await db.users.find_one({"_id": c.get("user_id")})
        creator_list.append({
            "user_id": c.get("user_id"), "user_name": u.get("name", "Anonymous") if u else "Anonymous",
            "trust_score": c.get("trust_score", 0.0), "level": c.get("level", "beginner"),
            "published_challenges": c.get("published_challenges", 0),
        })

    return {
        "generated_at": now,
        "low_quality": low_quality,
        "stale_content": stale,
        "popular_skills": popular_skills,
        "emerging_skills": emerging_skills,
        "knowledge_gaps": gap_candidates,
        "top_creators": creator_list,
        "summary": {
            "low_quality_count": len(low_quality),
            "stale_count": len(stale),
            "popular_skills_count": len(popular_skills),
            "emerging_skills_count": len(emerging_skills),
            "knowledge_gaps_count": len(gap_candidates),
        },
    }