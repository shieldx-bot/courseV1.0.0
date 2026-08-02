"""Support ticket service.

Handles CRUD for support tickets, ticket messages, status transitions,
assignment, and priority auto-classification.
"""

import logging
from datetime import datetime, timezone
from typing import Any

from app.core.config import settings
from app.db.mongodb import get_db

logger = logging.getLogger(__name__)

VALID_STATUSES = {"open", "in_progress", "waiting_user", "resolved", "closed"}
VALID_CATEGORIES = {"billing", "technical", "content", "account", "other"}
VALID_PRIORITIES = {"P1", "P2", "P3"}


def _ticket_id(user_id: str) -> str:
    return f"tkt-{user_id}-{int(datetime.now(timezone.utc).timestamp() * 1000)}"


def _message_id(ticket_id: str) -> str:
    return f"tmsg-{ticket_id}-{int(datetime.now(timezone.utc).timestamp() * 1000)}"


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _auto_priority(subject: str, message: str) -> str:
    text = f"{subject} {message}".lower()
    billing_keywords = ["refund", "charge", "payment", "cancel", "billing", "invoice", "money"]
    critical_keywords = ["error 5", "crash", "lost access", "can't access", "cannot access", "urgent"]

    if any(k in text for k in billing_keywords) and any(k in text for k in critical_keywords):
        return "P1"
    if any(k in text for k in critical_keywords):
        return "P1"
    if any(k in text for k in billing_keywords):
        return "P2"
    return "P3"


def _normalize_category(category: str | None) -> str:
    if not category:
        return "other"
    c = category.lower()
    if c in VALID_CATEGORIES:
        return c
    return "other"


async def create_ticket(
    user_id: str,
    user_email: str,
    user_name: str,
    subject: str,
    message: str,
    category: str | None = None,
    priority: str | None = None,
    ai_summary: str | None = None,
) -> dict[str, Any]:
    db = get_db()
    ticket_id = _ticket_id(user_id)
    now = _now()
    norm_category = _normalize_category(category)
    auto_priority = _auto_priority(subject, message)

    doc = {
        "_id": ticket_id,
        "user_id": user_id,
        "user_email": user_email,
        "user_name": user_name,
        "category": norm_category,
        "priority": priority or auto_priority,
        "subject": subject,
        "status": "open",
        "ai_summary": ai_summary or "",
        "created_at": now,
        "updated_at": now,
        "resolved_at": None,
        "assigned_to": None,
        "satisfaction_rating": None,
    }
    await db.support_tickets.insert_one(doc)
    await add_message(ticket_id, "user", user_id, user_name, message)
    return doc


async def add_message(
    ticket_id: str,
    sender_type: str,
    sender_id: str,
    sender_name: str,
    content: str,
) -> dict[str, Any]:
    db = get_db()
    msg_id = _message_id(ticket_id)
    doc = {
        "_id": msg_id,
        "ticket_id": ticket_id,
        "sender_type": sender_type,
        "sender_id": sender_id,
        "sender_name": sender_name,
        "content": content,
        "created_at": _now(),
    }
    await db.ticket_messages.insert_one(doc)
    await db.support_tickets.update_one(
        {"_id": ticket_id},
        {"$set": {"updated_at": _now()}},
    )
    return doc


async def get_ticket(ticket_id: str) -> dict[str, Any] | None:
    db = get_db()
    return await db.support_tickets.find_one({"_id": ticket_id})


async def get_ticket_messages(ticket_id: str) -> list[dict[str, Any]]:
    db = get_db()
    return await db.ticket_messages.find({"ticket_id": ticket_id}).sort("created_at", 1).to_list(1000)


async def get_user_tickets(user_id: str) -> list[dict[str, Any]]:
    db = get_db()
    return (
        await db.support_tickets.find({"user_id": user_id})
        .sort("created_at", -1)
        .to_list(1000)
    )


async def escalate_to_human(
    ticket_id: str,
    reason: str = "Escalated to human support",
) -> dict[str, Any] | None:
    """Flag a ticket for human review: set status ``in_progress`` and log it.

    Returns the updated ticket, or ``None`` if the ticket does not exist.
    """
    db = get_db()
    ticket = await get_ticket(ticket_id)
    if not ticket:
        return None
    await db.support_tickets.update_one(
        {"_id": ticket_id},
        {
            "$set": {
                "status": "in_progress",
                "escalated": True,
                "escalation_reason": reason,
                "updated_at": _now(),
            }
        },
    )
    await add_message(ticket_id, "system", "system", "System", reason)
    return await get_ticket(ticket_id)


async def list_tickets(filters: dict[str, Any] | None = None) -> list[dict[str, Any]]:
    db = get_db()
    query: dict[str, Any] = {}
    if filters:
        if filters.get("status"):
            query["status"] = filters["status"]
        if filters.get("category"):
            query["category"] = filters["category"]
        if filters.get("assigned_to"):
            query["assigned_to"] = filters["assigned_to"]
        if filters.get("user_id"):
            query["user_id"] = filters["user_id"]
        if filters.get("search"):
            query["subject"] = {"$regex": filters["search"], "$options": "i"}

    return await db.support_tickets.find(query).sort("created_at", -1).to_list(1000)


async def update_ticket_status(ticket_id: str, status: str) -> dict[str, Any] | None:
    if status not in VALID_STATUSES:
        raise ValueError(f"Invalid status: {status}")
    db = get_db()
    now = _now()
    update: dict[str, Any] = {"status": status, "updated_at": now}
    if status == "resolved":
        update["resolved_at"] = now

    await db.support_tickets.update_one({"_id": ticket_id}, {"$set": update})
    return await get_ticket(ticket_id)


async def assign_ticket(ticket_id: str, admin_id: str) -> dict[str, Any] | None:
    db = get_db()
    await db.support_tickets.update_one(
        {"_id": ticket_id},
        {"$set": {"assigned_to": admin_id, "updated_at": _now()}},
    )
    return await get_ticket(ticket_id)


async def rate_ticket(ticket_id: str, rating: int) -> dict[str, Any] | None:
    if rating < 1 or rating > 5:
        raise ValueError("Rating must be between 1 and 5")
    db = get_db()
    await db.support_tickets.update_one(
        {"_id": ticket_id},
        {"$set": {"satisfaction_rating": rating, "updated_at": _now()}},
    )
    return await get_ticket(ticket_id)


async def get_stats() -> dict[str, Any]:
    db = get_db()
    tickets = await db.support_tickets.find().to_list(10000)

    total = len(tickets)
    by_status: dict[str, int] = {}
    by_category: dict[str, int] = {}
    by_priority: dict[str, int] = {}
    resolution_times: list[float] = []

    for t in tickets:
        by_status[t.get("status", "open")] = by_status.get(t.get("status", "open"), 0) + 1
        by_category[t.get("category", "other")] = by_category.get(t.get("category", "other"), 0) + 1
        by_priority[t.get("priority", "P3")] = by_priority.get(t.get("priority", "P3"), 0) + 1

        if t.get("resolved_at") and t.get("created_at"):
            try:
                created = datetime.fromisoformat(t["created_at"])
                resolved = datetime.fromisoformat(t["resolved_at"])
                diff_hours = (resolved - created).total_seconds() / 3600
                resolution_times.append(diff_hours)
            except Exception:
                pass

    avg_resolution_hours = (
        sum(resolution_times) / len(resolution_times) if resolution_times else None
    )

    ratings = [t["satisfaction_rating"] for t in tickets if t.get("satisfaction_rating")]
    avg_rating = sum(ratings) / len(ratings) if ratings else None

    return {
        "total": total,
        "by_status": by_status,
        "by_category": by_category,
        "by_priority": by_priority,
        "avg_resolution_hours": avg_resolution_hours,
        "avg_satisfaction_rating": avg_rating,
    }


SLA_HOURS = {"P1": 4, "P2": 24, "P3": 72}


async def check_sla_breaches() -> list[dict[str, Any]]:
    db = get_db()
    now = datetime.now(timezone.utc)
    open_tickets = await db.support_tickets.find({
        "status": {"$nin": ["resolved", "closed"]},
    }).to_list(1000)

    breached = []
    for t in open_tickets:
        created = t.get("created_at")
        if not created:
            continue
        try:
            created_dt = datetime.fromisoformat(created)
            if created_dt.tzinfo is None:
                created_dt = created_dt.replace(tzinfo=timezone.utc)
        except Exception:
            continue

        priority = t.get("priority", "P3")
        sla_hours = SLA_HOURS.get(priority, 72)
        age_hours = (now - created_dt).total_seconds() / 3600

        if age_hours > sla_hours:
            breached.append({
                "ticket_id": t["_id"],
                "subject": t.get("subject", ""),
                "priority": priority,
                "sla_hours": sla_hours,
                "age_hours": round(age_hours, 1),
                "user_id": t.get("user_id"),
                "user_email": t.get("user_email"),
            })

    return breached


async def send_ticket_notification(ticket_id: str, message: str) -> None:
    db = get_db()
    ticket = await get_ticket(ticket_id)
    if not ticket:
        return
    user_email = ticket.get("user_email")
    if not user_email:
        return
    subject = f"Ticket update: {ticket.get('subject', '')}"
    body = (
        f"Hi {ticket.get('user_name', '')},\n\n"
        f"{message}\n\n"
        f"Ticket ID: {ticket_id}\n"
        f"View your tickets: {settings.frontend_url}/support/tickets\n\n"
        f"Thanks,\nAscendly Support Team"
    )
    try:
        from app.services.email import _send
        _send(to=user_email, subject=subject, body=body)
    except Exception as exc:
        logger.warning("Failed to send ticket notification to %s: %s", user_email, exc)
