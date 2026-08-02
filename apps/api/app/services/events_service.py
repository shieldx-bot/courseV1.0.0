"""Community Events platform services — events, scheduling, attendance.

Extracted from the former `ecosystem` monolith (Phase 7 hardening) without any
behavioral change. `app/services/ecosystem.py` remains a facade re-exporting
this public API, so call sites never change.
"""

import logging
import re
from datetime import datetime, timezone
from typing import Any, Optional

from app.core.collections import Collections as C
from app.db.mongodb import get_db, get_read_db
from app.services.notifications import create_notification

logger = logging.getLogger(__name__)


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _ts() -> int:
    return int(datetime.now(timezone.utc).timestamp() * 1000)


def _slug(text: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")[:60]


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
    await db[C.EVENTS].insert_one(doc)

    # Publish domain event — Creator/Community/Notification domains react
    # independently (events_hosted tracking, public feed, follower fan-out).
    from app.core.events import Event, bus
    await bus.publish(Event(
        name="EventCreated",
        producer="ecosystem.create_event",
        payload={
            "event_id": eid,
            "event_title": doc["title"],
            "host_id": user_id,
            "requested_host_id": body.get("host_id"),
            "event_type": event_type,
        },
    ))

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
    docs = await db[C.EVENTS].find(query).sort("start_time", 1).to_list(length=limit)
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
    event = await db[C.EVENTS].find_one({"_id": event_id})
    if not event:
        return {"error": True, "message": "Event not found."}
    attendees = event.get("attendee_ids", []) or []
    if user_id in attendees:
        return {"success": True, "joined": True}
    if event.get("capacity") and len(attendees) >= event["capacity"]:
        return {"error": True, "message": "Event is full."}
    await db[C.EVENTS].update_one({"_id": event_id}, {"$push": {"attendee_ids": user_id}})
    await create_notification(user_id, "event_joined_confirmation", {"event_title": event.get("title", "Event"), "event_id": event_id}, link=f"/events")

    # Publish domain event — host notification + event analytics react.
    from app.core.events import Event, bus
    await bus.publish(Event(
        name="EventJoined",
        producer="ecosystem.join_event",
        payload={
            "event_id": event_id,
            "event_title": event.get("title", "Event"),
            "host_id": event.get("host_id"),
            "user_id": user_id,
        },
    ))
    return {"success": True, "joined": True}


async def leave_event(user_id: str, event_id: str) -> dict:
    db = get_db()
    await db[C.EVENTS].update_one({"_id": event_id}, {"$pull": {"attendee_ids": user_id}})
    return {"success": True, "joined": False}


# ── Private helpers (batch loaders shared with creator/moderation) ───────────

async def _load_users_batch(db, user_ids: list) -> dict:
    from app.services.creator import _load_users_batch as _impl
    return await _impl(db, user_ids)
