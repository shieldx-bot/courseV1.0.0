"""Community Hub — live aggregation for the public /community page.

Powers the feed, platform pulse stats, cross-course trending discussions,
and top members with REAL data. Empty collections render honest empty states.
"""

import asyncio
import logging
from datetime import datetime, timedelta, timezone
from typing import Any, Optional

from fastapi import APIRouter, Depends, Query

from app.core.deps import get_optional_user
from app.core.response import api_response
from app.db.mongodb import get_read_db
from app.services.community import get_public_feed

logger = logging.getLogger(__name__)
router = APIRouter()


async def _platform_stats(db) -> dict[str, Any]:
    since = (datetime.now(timezone.utc) - timedelta(hours=24)).isoformat()
    async def count(col, match=None):
        try:
            return await db[col].count_documents(match or {})
        except Exception:
            return 0
    try:
        active = await db.activity_events.aggregate([
            {"$match": {"created_at": {"$gte": since}}},
            {"$group": {"_id": "$user_id"}},
            {"$count": "total"},
        ]).to_list(1)
        active_members = active[0]["total"] if active else 0
    except Exception:
        active_members = 0
    return {
        "members": await count("users"),
        "events_last_24h": await count("activity_events", {"created_at": {"$gte": since}}),
        "challenges_solved_24h": await count("challenge_attempts", {"created_at": {"$gte": since}}),
        "discussions_total": await count("discussions"),
        "challenges_published": await count("challenges", {"status": "published"}),
        "active_members_24h": active_members,
    }


async def _trending_discussions(db, user_id: Optional[str], limit: int) -> list[dict[str, Any]]:
    try:
        docs = await db.discussions.aggregate([
            {"$match": {"is_locked": {"$ne": True}}},
            {"$sort": {"vote_score": -1, "reply_count": -1, "created_at": -1}},
            {"$limit": limit},
        ]).to_list(length=limit)
    except Exception as exc:
        logger.warning("Hub discussions failed: %s", exc)
        return []
    out = []
    for d in docs:
        user = await db.users.find_one({"_id": d.get("user_id")})
        course_title = None
        if d.get("course_id"):
            try:
                course = await db.courses.find_one({"_id": d["course_id"]}, {"title": 1})
                course_title = course.get("title") if course else None
            except Exception:
                pass
        user_vote = 0
        if user_id:
            try:
                v = await db.discussion_votes.find_one({"discussion_id": d["_id"], "user_id": user_id})
                user_vote = v.get("vote", 0) if v else 0
            except Exception:
                pass
        out.append({
            "id": d["_id"], "lesson_id": d.get("lesson_id"), "course_id": d.get("course_id"),
            "course_title": course_title, "user_id": d.get("user_id"),
            "user_name": user.get("name", "Anonymous") if user else "Anonymous",
            "title": d.get("title", ""), "excerpt": (d.get("content", "") or "")[:180],
            "reply_count": d.get("reply_count", 0) or 0, "vote_score": d.get("vote_score", 0) or 0,
            "user_vote": user_vote, "is_pinned": d.get("is_pinned", False),
            "is_locked": d.get("is_locked", False),
            "created_at": d.get("created_at"), "updated_at": d.get("updated_at"),
        })
    return out


async def _top_members(db, limit: int) -> list[dict[str, Any]]:
    try:
        docs = await db.creator_profiles.find({}).sort([
            ("level_score", -1), ("published_challenges", -1),
        ]).limit(limit).to_list(length=limit)
    except Exception as exc:
        logger.warning("Hub members failed: %s", exc)
        return []
    out = []
    for p in docs:
        user = await db.users.find_one({"_id": p.get("user_id")}, {"name": 1, "role": 1})
        out.append({
            "user_id": p.get("user_id"),
            "user_name": user.get("name", "Anonymous") if user else "Anonymous",
            "role": user.get("role", "student") if user else "student",
            "level": p.get("level", "beginner"), "level_score": p.get("level_score", 0),
            "published_challenges": p.get("published_challenges", 0),
            "followers": len(p.get("followers", []) or []),
            "avg_rating": p.get("avg_rating", 0), "badges": p.get("badges", []),
        })
    return out


@router.get("/community/hub")
async def get_community_hub(
    feed_limit: int = Query(30, ge=1, le=100),
    discussions_limit: int = Query(6, ge=1, le=20),
    members_limit: int = Query(8, ge=1, le=20),
    user: Optional[dict] = Depends(get_optional_user),
):
    db = get_read_db()
    user_id = user.get("id") if user else None
    feed, stats, discussions, members = await asyncio.gather(
        get_public_feed(limit=feed_limit, include_user_id=user_id),
        _platform_stats(db),
        _trending_discussions(db, user_id, discussions_limit),
        _top_members(db, members_limit),
    )
    return api_response({"feed": feed, "stats": stats, "discussions": discussions, "members": members})


@router.get("/community/feed")
async def get_community_feed(
    limit: int = Query(30, ge=1, le=100),
    user: Optional[dict] = Depends(get_optional_user),
):
    user_id = user.get("id") if user else None
    feed = await get_public_feed(limit=limit, include_user_id=user_id)
    return api_response({"events": feed})