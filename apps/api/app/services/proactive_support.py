"""Proactive support service.

Detects when users are struggling and triggers helpful interventions:
- Video rewatches
- Checkout abandonment
- Learning stall
- Quiz low scores
"""

import logging
from datetime import datetime, timezone, timedelta
from typing import Any

from app.core.config import settings
from app.db.mongodb import get_db

logger = logging.getLogger(__name__)


async def track_event(
    user_id: str,
    event_type: str,
    metadata: dict[str, Any] | None = None,
    page: str | None = None,
) -> None:
    db = get_db()
    await db.user_behavior_events.insert_one({
        "_id": f"bev-{user_id}-{int(datetime.now(timezone.utc).timestamp() * 1000)}",
        "event_type": event_type,
        "user_id": user_id,
        "metadata": metadata or {},
        "page": page,
        "created_at": datetime.now(timezone.utc).isoformat(),
    })


async def detect_video_rewatch(user_id: str, lesson_id: str) -> dict[str, Any] | None:
    db = get_db()
    now = datetime.now(timezone.utc)
    window = (now - timedelta(hours=1)).isoformat()
    events = await db.user_behavior_events.find({
        "user_id": user_id,
        "event_type": "video_seek",
        "metadata.lesson_id": lesson_id,
        "created_at": {"$gte": window},
    }).to_list(100)

    sections = {}
    for e in events:
        section = e.get("metadata", {}).get("section_seconds", 0)
        sections[section] = sections.get(section, 0) + 1

    struggling_sections = [s for s, c in sections.items() if c >= 3]
    if struggling_sections:
        return {
            "intervention_type": "video_rewatch",
            "lesson_id": lesson_id,
            "sections": struggling_sections,
            "message": "Need help? Ask our AI assistant about this section.",
        }
    return None


async def detect_checkout_drop(user_id: str) -> dict[str, Any] | None:
    db = get_db()
    now = datetime.now(timezone.utc)
    window = (now - timedelta(hours=2)).isoformat()
    events = await db.user_behavior_events.find({
        "user_id": user_id,
        "event_type": "checkout_started",
        "created_at": {"$gte": window},
    }).to_list(10)
    completed = await db.user_behavior_events.count_documents({
        "user_id": user_id,
        "event_type": "checkout_completed",
        "created_at": {"$gte": window},
    })
    if events and not completed:
        return {
            "intervention_type": "checkout_drop",
            "message": "Having trouble with payment? We can help you complete your purchase.",
        }
    return None


async def detect_learning_stall(user_id: str) -> dict[str, Any] | None:
    db = get_db()
    user = await db.users.find_one({"_id": user_id})
    if not user:
        return None
    last_active = user.get("last_active_at") or user.get("created_at")
    if not last_active:
        return None
    try:
        last_dt = datetime.fromisoformat(last_active)
        if last_dt.tzinfo is None:
            last_dt = last_dt.replace(tzinfo=timezone.utc)
    except Exception:
        return None
    if datetime.now(timezone.utc) - last_dt >= timedelta(days=3):
        return {
            "intervention_type": "learning_stall",
            "message": "Your course is waiting. Need a hand to get back on track?",
        }
    return None


async def detect_quiz_low_score(user_id: str, quiz_id: str) -> dict[str, Any] | None:
    db = get_db()
    quiz = await db.quizzes.find_one({"_id": quiz_id})
    if not quiz:
        return None
    attempts = await db.quiz_attempts.count_documents({
        "user_id": user_id,
        "quiz_id": quiz_id,
    })
    if attempts == 0:
        return None
    best = await db.quiz_attempts.find_one(
        {"user_id": user_id, "quiz_id": quiz_id},
        sort=[("score", -1)],
    )
    if best and best.get("score", 0) < 50:
        return {
            "intervention_type": "quiz_low_score",
            "quiz_id": quiz_id,
            "score": best.get("score"),
            "message": "Review these lessons to improve your understanding.",
        }
    return None


async def get_active_interventions(user_id: str) -> list[dict[str, Any]]:
    interventions = []
    db = get_db()
    now = datetime.now(timezone.utc)
    cutoff = (now - timedelta(days=7)).isoformat()
    events = await db.user_behavior_events.find({
        "user_id": user_id,
        "event_type": {"$in": ["video_rewatch", "checkout_drop", "learning_stall", "quiz_low_score"]},
        "created_at": {"$gte": cutoff},
    }).to_list(100)
    for e in events:
        interventions.append({
            "type": e["event_type"],
            "message": e.get("metadata", {}).get("message", ""),
            "created_at": e["created_at"],
        })
    return interventions
