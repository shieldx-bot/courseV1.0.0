"""Unified Notification System — the retention loop that connects every ecosystem.

Every meaningful action on the platform emits a notification:
  - Arena battles finished, matches won/lost
  - Creators followed, challenges published, ratings received
  - Community replies, mentions, discussion votes
  - Events starting soon, events you joined
  - Achievements / badges / level ups unlocked
  - Creator verification status changed
  - Moderation actions applied to your content
  - Learning milestones (skills leveled, certificates issued)

Pattern: services call `create_notification(...)` after a meaningful action.
User-facing list groups by type, tracks read/unread, and supports preferences.
"""

import logging
from datetime import datetime, timedelta, timezone
from typing import Any, Optional

from app.db.mongodb import get_db, get_read_db

logger = logging.getLogger(__name__)


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _ts() -> int:
    return int(datetime.now(timezone.utc).timestamp() * 1000)


# ── Notification type registry ──────────────────────────────────────────────

NOTIFICATION_TYPES = {
    # Arena / competition
    "arena_battle_finished": {"label": "Battle finished", "emoji": "⚔️"},
    "arena_match_won": {"label": "You won!", "emoji": "🏆"},
    "arena_match_lost": {"label": "Match lost", "emoji": "⚔️"},
    "arena_rankup": {"label": "New rank", "emoji": "⭐"},
    "tournament_starts_soon": {"label": "Tournament starts soon", "emoji": "🎪"},

    # Creator economy
    "creator_new_follower": {"label": "New follower", "emoji": "👥"},
    "creator_challenge_published": {"label": "Challenge published", "emoji": "🚀"},
    "creator_rating_received": {"label": "New rating", "emoji": "⭐"},
    "creator_achievement_unlocked": {"label": "Achievement unlocked", "emoji": "🏅"},
    "creator_verified": {"label": "You're verified!", "emoji": "✅"},
    "creator_verification_rejected": {"label": "Verification update", "emoji": "📋"},

    # Community
    "community_reply": {"label": "New reply", "emoji": "💬"},
    "community_mention": {"label": "You were mentioned", "emoji": "📢"},
    "community_vote": {"label": "Upvote received", "emoji": "👍"},
    "community_event_created": {"label": "New event", "emoji": "🎉"},

    # Events
    "event_starts_soon": {"label": "Event starting soon", "emoji": "⏰"},
    "event_joined_confirmation": {"label": "Event joined", "emoji": "✅"},

    # Learning
    "skill_levelup": {"label": "Skill level up", "emoji": "📈"},
    "certificate_issued": {"label": "Certificate issued", "emoji": "📜"},
    "course_completed": {"label": "Course completed", "emoji": "🎓"},
    "path_completed": {"label": "Path completed", "emoji": "🗺️"},

    # Moderation / trust
    "moderation_content_removed": {"label": "Content removed", "emoji": "⚠️"},
    "moderation_warning": {"label": "Warning received", "emoji": "⚠️"},

    # System / account
    "account_updated": {"label": "Account updated", "emoji": "🔐"},
    "system_announcement": {"label": "Announcement", "emoji": "📣"},
    "welcome": {"label": "Welcome", "emoji": "👋"},
}


# ── Core service ─────────────────────────────────────────────────────────────

async def create_notification(
    user_id: str,
    notification_type: str,
    payload: Optional[dict] = None,
    *,
    actor_id: Optional[str] = None,
    link: Optional[str] = None,
    importance: str = "normal",  # low | normal | high
) -> Optional[dict]:
    """Create a notification for a user.

    Called by other services after meaningful actions. Respects user preferences.
    """
    if notification_type not in NOTIFICATION_TYPES:
        logger.warning("Unknown notification type: %s", notification_type)
        notification_type = "system_announcement"
    if not user_id:
        return None

    db = get_db()
    # Respect mute preferences
    prefs = await db.notification_preferences.find_one({"_id": f"np-{user_id}"})
    if prefs:
        muted = prefs.get("muted_types", []) or []
        if notification_type in muted:
            return None
        if prefs.get("email_enabled") is False and prefs.get("in_app_enabled") is False:
            return None

    nid = f"ntf-{user_id}-{_ts()}"
    doc = {
        "_id": nid,
        "user_id": user_id,
        "type": notification_type,
        "label": NOTIFICATION_TYPES[notification_type]["label"],
        "emoji": NOTIFICATION_TYPES[notification_type]["emoji"],
        "payload": payload or {},
        "actor_id": actor_id,
        "link": link,
        "importance": importance,
        "is_read": False,
        "read_at": None,
        "created_at": _now(),
    }
    await db.notifications.insert_one(doc)

    # Cap per-user old notifications (keep at most 500)
    total = await db.notifications.count_documents({"user_id": user_id})
    if total > 500:
        old = await db.notifications.find({"user_id": user_id}).sort("created_at", 1).to_list(length=total - 500)
        for o in old:
            await db.notifications.delete_one({"_id": o["_id"]})

    return doc


async def list_notifications(
    user_id: str,
    unread_only: bool = False,
    limit: int = 50,
    before: Optional[str] = None,
) -> dict:
    """List notifications newest-first with unread count."""
    db = get_read_db()
    query: dict[str, Any] = {"user_id": user_id}
    if unread_only:
        query["is_read"] = False
    if before:
        query["created_at"] = {"$lt": before}

    docs = await db.notifications.find(query).sort("created_at", -1).to_list(length=limit)
    unread = await db.notifications.count_documents({"user_id": user_id, "is_read": False})

    out = []
    for n in docs:
        actor = None
        if n.get("actor_id"):
            u = await db.users.find_one({"_id": n["actor_id"]})
            if u:
                actor = {"user_id": u["_id"], "name": u.get("name", "Anonymous"), "avatar_url": u.get("avatar_url")}
        out.append({
            "id": n["_id"],
            "type": n.get("type", "system_announcement"),
            "label": n.get("label", "Update"),
            "emoji": n.get("emoji", "📣"),
            "payload": n.get("payload", {}),
            "actor": actor,
            "link": n.get("link"),
            "importance": n.get("importance", "normal"),
            "is_read": n.get("is_read", False),
            "created_at": n.get("created_at", ""),
        })

    return {"notifications": out, "unread_count": unread, "total": len(out)}


async def mark_notification_read(user_id: str, notification_id: str) -> dict:
    db = get_db()
    await db.notifications.update_one(
        {"_id": notification_id, "user_id": user_id},
        {"$set": {"is_read": True, "read_at": _now()}},
    )
    return {"success": True}


async def mark_all_read(user_id: str) -> dict:
    db = get_db()
    await db.notifications.update_many(
        {"user_id": user_id, "is_read": False},
        {"$set": {"is_read": True, "read_at": _now()}},
    )
    return {"success": True}


async def get_unread_count(user_id: str) -> int:
    db = get_read_db()
    return await db.notifications.count_documents({"user_id": user_id, "is_read": False})


# ── Preferences ──────────────────────────────────────────────────────────────

DEFAULT_PREFERENCES: dict[str, Any] = {
    "in_app_enabled": True,
    "email_enabled": True,
    "muted_types": [],
    "quiet_hours": {"enabled": False, "start": "22:00", "end": "07:00"},
}


async def get_preferences(user_id: str) -> dict:
    db = get_db()
    prefs = await db.notification_preferences.find_one({"_id": f"np-{user_id}"})
    if not prefs:
        prefs = {"_id": f"np-{user_id}", "user_id": user_id, **DEFAULT_PREFERENCES}
        await db.notification_preferences.insert_one(prefs)
    return {k: v for k, v in prefs.items() if k not in ("_id", "user_id")}


async def update_preferences(user_id: str, body: dict) -> dict:
    db = get_db()
    doc_id = f"np-{user_id}"
    updates: dict[str, Any] = {"updated_at": _now()}
    for key in ("in_app_enabled", "email_enabled"):
        if key in body:
            updates[key] = bool(body[key])
    if "muted_types" in body and isinstance(body["muted_types"], list):
        updates["muted_types"] = [t for t in body["muted_types"] if t in NOTIFICATION_TYPES]
    if "quiet_hours" in body and isinstance(body["quiet_hours"], dict):
        current = DEFAULT_PREFERENCES["quiet_hours"]
        current.update({k: v for k, v in body["quiet_hours"].items() if k in ("enabled", "start", "end")})
        updates["quiet_hours"] = current
    if "all_muted" in body:
        updates["muted_types"] = list(NOTIFICATION_TYPES.keys()) if body["all_muted"] else []
    await db.notification_preferences.update_one({"_id": doc_id}, {"$set": updates}, upsert=True)
    return await get_preferences(user_id)


# ── Convenience wrappers for other services ──────────────────────────────────

async def notify_followers(creator_id: str, event_payload: dict) -> None:
    """Notify all followers of a creator about their new activity."""
    db = get_read_db()
    profile = await db.creator_profiles.find_one({"_id": f"cp-{creator_id}"})
    if not profile:
        return
    followers = profile.get("followers", []) or []
    for f in followers[:200]:  # cap fan-out
        await create_notification(
            f.get("user_id"),
            "creator_challenge_published",
            {**event_payload, "creator_id": creator_id},
            actor_id=creator_id,
        )


async def notify_event_attendees(event_id: str, notification_type: str, payload: dict, link: str) -> None:
    """Notify all attendees of an event (e.g., starts soon, cancelled)."""
    db = get_read_db()
    event = await db.events.find_one({"_id": event_id})
    if not event:
        return
    for uid in (event.get("attendee_ids", []) or [])[:500]:
        await create_notification(uid, notification_type, {**payload, "event_id": event_id}, link=link)