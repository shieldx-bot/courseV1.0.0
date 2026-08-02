"""Proactive support service.

Detects when users are struggling and triggers helpful interventions:
- Video rewatches
- Checkout abandonment
- Learning stall
- Quiz low scores

Interventions are persisted in a dedicated ``interventions`` collection
(source of truth) and surfaced to users as in-app notifications. Each
intervention type is deduplicated per user (1 per 7 days) to avoid
notification spam. A ``learning_stall`` intervention additionally sends a
proactive help email.
"""

import logging
from datetime import datetime, timezone, timedelta
from typing import Any

from app.core.config import settings
from app.db.mongodb import get_db
from app.services.notifications import create_notification

logger = logging.getLogger(__name__)

# The four supported intervention types.
INTERVENTION_TYPES = (
    "video_rewatch",
    "checkout_drop",
    "learning_stall",
    "quiz_low_score",
)

# Default human-facing message per intervention type.
INTERVENTION_MESSAGES: dict[str, str] = {
    "video_rewatch": "Need help? Ask our AI assistant about this section.",
    "checkout_drop": "Having trouble with payment? We can help you complete your purchase.",
    "learning_stall": "Your course is waiting. Need a hand to get back on track?",
    "quiz_low_score": "Review these lessons to improve your understanding.",
}

# Per-type dedupe window (days). One intervention of the same type per user
# within this window is enough — anything newer is suppressed.
DEDUPE_DAYS = 7

# Active-intervention visibility window for the user-facing list.
ACTIVE_WINDOW_DAYS = 7

# Max users scanned per cron run (bounded cost — no full-DB scan).
BATCH_LIMIT = 200


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _iso_before(**kwargs: Any) -> str:
    return (datetime.now(timezone.utc) - timedelta(**kwargs)).isoformat()


_IDS = 0


def _event_id(user_id: str) -> str:
    global _IDS
    _IDS += 1
    return f"bev-{user_id}-{int(datetime.now(timezone.utc).timestamp() * 1000)}-{_IDS}"


def _intervention_id(user_id: str) -> str:
    global _IDS
    _IDS += 1
    return f"intv-{user_id}-{int(datetime.now(timezone.utc).timestamp() * 1000)}-{_IDS}"


# ── Behavior event tracking ──────────────────────────────────────────────────


async def track_event(
    user_id: str,
    event_type: str,
    metadata: dict[str, Any] | None = None,
    page: str | None = None,
) -> None:
    db = get_db()
    await db.user_behavior_events.insert_one({
        "_id": _event_id(user_id),
        "event_type": event_type,
        "user_id": user_id,
        "metadata": metadata or {},
        "page": page,
        "created_at": _now_iso(),
    })


# ── Single-entity detectors (kept for direct/inline use) ─────────────────────


async def detect_video_rewatch(user_id: str, lesson_id: str) -> dict[str, Any] | None:
    db = get_db()
    window = _iso_before(hours=1)
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
            "message": INTERVENTION_MESSAGES["video_rewatch"],
        }
    return None


async def detect_checkout_drop(user_id: str) -> dict[str, Any] | None:
    db = get_db()
    window = _iso_before(hours=2)
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
            "message": INTERVENTION_MESSAGES["checkout_drop"],
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
            "message": INTERVENTION_MESSAGES["learning_stall"],
        }
    return None


async def detect_quiz_low_score(user_id: str, quiz_id: str) -> dict[str, Any] | None:
    db = get_db()
    quiz = await db.quizzes.find_one({"_id": quiz_id})
    if not quiz:
        return None
    attempts = await db.quiz_attempts.find({
        "user_id": user_id,
        "quiz_id": quiz_id,
    }).to_list(100)
    if not attempts:
        return None
    best = max(attempts, key=lambda a: _attempt_score_pct(a))
    if best and _attempt_score_pct(best) < 50:
        return {
            "intervention_type": "quiz_low_score",
            "quiz_id": quiz_id,
            "score": _attempt_score_pct(best),
            "message": INTERVENTION_MESSAGES["quiz_low_score"],
        }
    return None


# ── Batch detectors (used by the scheduled job) ──────────────────────────────


async def detect_learning_stall_batch(
    db: Any,
    user_ids: list[str] | None = None,
    days: int = 3,
) -> list[dict[str, Any]]:
    """Return learning-stall signals for a bounded set of users."""
    query: dict[str, Any] = {}
    if user_ids:
        query["_id"] = {"$in": user_ids}
    users = await db.users.find(query).to_list(len(user_ids) if user_ids else 5000)
    signals = []
    for user in users:
        uid = user.get("_id")
        last_active = user.get("last_active_at") or user.get("created_at")
        if not last_active:
            continue
        try:
            last_dt = datetime.fromisoformat(last_active)
            if last_dt.tzinfo is None:
                last_dt = last_dt.replace(tzinfo=timezone.utc)
        except Exception:
            continue
        if datetime.now(timezone.utc) - last_dt >= timedelta(days=days):
            signals.append({
                "user_id": uid,
                "intervention_type": "learning_stall",
                "message": INTERVENTION_MESSAGES["learning_stall"],
            })
    return signals


async def detect_video_rewatch_batch(
    db: Any,
    user_ids: list[str] | None = None,
    window_hours: int = 1,
    min_rewatch: int = 3,
) -> list[dict[str, Any]]:
    """Group recent ``video_seek`` events and emit rewatch signals.

    A signal is emitted per (user, lesson) when any section of that lesson
    was revisited at least ``min_rewatch`` times within the window.
    """
    query: dict[str, Any] = {
        "event_type": "video_seek",
        "created_at": {"$gte": _iso_before(hours=window_hours)},
    }
    if user_ids:
        query["user_id"] = {"$in": user_ids}
    events = await db.user_behavior_events.find(query).to_list(1000)

    # (user_id, lesson_id) -> {section_seconds: count}
    grouped: dict[tuple[str, str], dict[int, int]] = {}
    for e in events:
        uid = e.get("user_id")
        meta = e.get("metadata") or {}
        lesson_id = meta.get("lesson_id")
        if not uid or not lesson_id:
            continue
        section = meta.get("section_seconds", 0)
        key = (uid, str(lesson_id))
        counts = grouped.setdefault(key, {})
        counts[section] = counts.get(section, 0) + 1

    signals = []
    for (uid, lesson_id), counts in grouped.items():
        struggling = [s for s, c in counts.items() if c >= min_rewatch]
        if struggling:
            signals.append({
                "user_id": uid,
                "intervention_type": "video_rewatch",
                "lesson_id": lesson_id,
                "sections": struggling,
                "message": INTERVENTION_MESSAGES["video_rewatch"],
            })
    return signals


async def detect_checkout_drop_batch(
    db: Any,
    user_ids: list[str] | None = None,
    window_hours: int = 2,
) -> list[dict[str, Any]]:
    """Emit a drop signal for users who started checkout but never completed."""
    query: dict[str, Any] = {
        "event_type": "checkout_started",
        "created_at": {"$gte": _iso_before(hours=window_hours)},
    }
    if user_ids:
        query["user_id"] = {"$in": user_ids}
    started = await db.user_behavior_events.find(query).to_list(500)
    started_ids = {e.get("user_id") for e in started if e.get("user_id")}
    if not started_ids:
        return []

    completed = await db.user_behavior_events.find({
        "event_type": "checkout_completed",
        "user_id": {"$in": list(started_ids)},
        "created_at": {"$gte": _iso_before(hours=window_hours)},
    }).to_list(500)
    completed_ids = {c.get("user_id") for c in completed if c.get("user_id")}

    signals = []
    for uid in started_ids:
        if uid not in completed_ids:
            signals.append({
                "user_id": uid,
                "intervention_type": "checkout_drop",
                "message": INTERVENTION_MESSAGES["checkout_drop"],
            })
    return signals


def _attempt_score_pct(attempt: dict[str, Any]) -> float:
    """Normalize a quiz attempt to a 0-100 percentage."""
    pct = attempt.get("score_pct")
    if pct is not None:
        try:
            return float(pct)
        except (TypeError, ValueError):
            pass
    score = attempt.get("score", 0) or 0
    total = attempt.get("total_questions", 0) or 0
    if total:
        return float(score) / float(total) * 100
    return float(score)


async def detect_quiz_low_score_batch(
    db: Any,
    user_ids: list[str] | None = None,
    window_hours: int = 7 * 24,
    threshold: float = 50.0,
) -> list[dict[str, Any]]:
    """Emit a low-score signal per user based on their best recent attempt.

    Only attempts below ``threshold`` percent are considered, and a user is
    reported at most once (their worst-best attempt within the window).
    """
    query: dict[str, Any] = {"created_at": {"$gte": _iso_before(hours=window_hours)}}
    if user_ids:
        query["user_id"] = {"$in": user_ids}
    attempts = await db.quiz_attempts.find(query).to_list(1000)

    best: dict[str, tuple[float, dict[str, Any]]] = {}
    for attempt in attempts:
        uid = attempt.get("user_id")
        if not uid:
            continue
        pct = _attempt_score_pct(attempt)
        if pct >= threshold:
            continue
        if uid not in best or pct < best[uid][0]:
            best[uid] = (pct, attempt)

    signals = []
    for uid, (pct, attempt) in best.items():
        signals.append({
            "user_id": uid,
            "intervention_type": "quiz_low_score",
            "quiz_id": attempt.get("_id"),
            "score_pct": pct,
            "message": INTERVENTION_MESSAGES["quiz_low_score"],
        })
    return signals


# ── Intervention lifecycle ───────────────────────────────────────────────────


async def trigger_intervention(
    user_id: str,
    intervention_type: str,
    context: dict[str, Any] | None = None,
    message: str | None = None,
) -> dict[str, Any] | None:
    """Create an intervention for a user (deduplicated 1 per 7 days).

    - Persists into the ``interventions`` collection (source of truth).
    - Creates an in-app notification.
    - Sends a proactive help email for ``learning_stall``.

    Returns the intervention document, or ``None`` if it was suppressed by
    the 7-day dedupe rule or the type is unknown.
    """
    if intervention_type not in INTERVENTION_TYPES:
        logger.warning("Unknown intervention type: %s", intervention_type)
        return None

    db = get_db()
    cutoff = _iso_before(days=DEDUPE_DAYS)
    existing = await db.interventions.find_one({
        "user_id": user_id,
        "intervention_type": intervention_type,
        "created_at": {"$gte": cutoff},
    })
    if existing:
        logger.info(
            "Dedupe hit: intervention %s for user %s already exists at %s",
            intervention_type, user_id, existing.get("created_at"),
        )
        return None

    doc: dict[str, Any] = {
        "_id": _intervention_id(user_id),
        "user_id": user_id,
        "intervention_type": intervention_type,
        "message": message or INTERVENTION_MESSAGES.get(intervention_type, ""),
        "context": context or {},
        "status": "active",
        "notification_id": None,
        "email_sent": False,
        "created_at": _now_iso(),
        "resolved_at": None,
    }

    # In-app notification.
    try:
        note = await create_notification(
            user_id,
            intervention_type,
            payload={**doc["context"], "intervention_type": intervention_type},
            link="/support/interventions",
            importance="high",
        )
        if note:
            doc["notification_id"] = note.get("_id")
    except Exception as exc:
        logger.warning("Failed to create in-app notification for %s: %s", user_id, exc)

    # Proactive help email (learning stall only, per product decision).
    if intervention_type == "learning_stall":
        try:
            user = await db.users.find_one({"_id": user_id})
            if user and user.get("email"):
                from app.services.email import send_proactive_help
                send_proactive_help(user["email"], intervention_type, doc["message"])
                doc["email_sent"] = True
        except Exception as exc:
            logger.warning("Failed to send proactive help email for %s: %s", user_id, exc)

    await db.interventions.insert_one(doc)
    logger.info("Triggered %s intervention for user %s", intervention_type, user_id)
    return doc


async def get_active_interventions(user_id: str) -> list[dict[str, Any]]:
    """Return the user's active interventions within the visibility window.

    Reads the ``interventions`` collection (source of truth) and merges any
    legacy intervention signals stored as behavior events (backward compat).
    """
    db = get_db()
    cutoff = _iso_before(days=ACTIVE_WINDOW_DAYS)

    interventions: list[dict[str, Any]] = []
    seen_types: set[str] = set()

    docs = await db.interventions.find({
        "user_id": user_id,
        "status": "active",
        "created_at": {"$gte": cutoff},
    }).to_list(100)
    for d in docs:
        seen_types.add(d.get("intervention_type", ""))
        interventions.append({
            "id": d.get("_id"),
            "type": d.get("intervention_type", ""),
            "message": d.get("message", ""),
            "context": d.get("context", {}),
            "status": d.get("status", "active"),
            "created_at": d.get("created_at", ""),
        })

    # Legacy signals recorded directly as behavior events (deduped by type,
    # keeping the most recent event per type).
    events = await db.user_behavior_events.find({
        "user_id": user_id,
        "event_type": {"$in": list(INTERVENTION_TYPES)},
        "created_at": {"$gte": cutoff},
    }).to_list(100)
    latest_event: dict[str, dict[str, Any]] = {}
    for e in events:
        etype = e.get("event_type", "")
        if etype in seen_types:
            continue
        prev = latest_event.get(etype)
        if prev is None or (e.get("created_at") or "") >= (prev.get("created_at") or ""):
            latest_event[etype] = e
    for e in latest_event.values():
        etype = e.get("event_type", "")
        interventions.append({
            "id": e.get("_id"),
            "type": etype,
            "message": (e.get("metadata") or {}).get("message", ""),
            "context": e.get("metadata", {}) or {},
            "status": "active",
            "created_at": e.get("created_at", ""),
        })

    interventions.sort(key=lambda x: x.get("created_at", ""), reverse=True)
    return interventions


async def list_interventions(
    filters: dict[str, Any] | None = None,
    limit: int = 200,
) -> list[dict[str, Any]]:
    """Admin listing of interventions with optional type/status filters."""
    db = get_db()
    query: dict[str, Any] = {}
    if filters:
        if filters.get("type"):
            query["intervention_type"] = filters["type"]
        if filters.get("status"):
            query["status"] = filters["status"]
        if filters.get("user_id"):
            query["user_id"] = filters["user_id"]
    docs = await db.interventions.find(query).sort("created_at", -1).to_list(limit)
    docs.sort(key=lambda d: d.get("created_at", ""), reverse=True)
    return docs


async def get_intervention(intervention_id: str) -> dict[str, Any] | None:
    db = get_db()
    return await db.interventions.find_one({"_id": intervention_id})


async def resolve_intervention(intervention_id: str) -> dict[str, Any] | None:
    """Mark an intervention as handled/resolved. Returns updated doc or None."""
    db = get_db()
    existing = await db.interventions.find_one({"_id": intervention_id})
    if not existing:
        return None
    await db.interventions.update_one(
        {"_id": intervention_id},
        {"$set": {"status": "resolved", "resolved_at": _now_iso()}},
    )
    return await db.interventions.find_one({"_id": intervention_id})


async def get_intervention_summary() -> dict[str, Any]:
    """Admin aggregate: active vs resolved interventions by type."""
    db = get_db()
    docs = await db.interventions.find().to_list(5000)
    cutoff = _iso_before(days=ACTIVE_WINDOW_DAYS)

    by_type: dict[str, int] = {}
    by_status: dict[str, int] = {}
    recent = 0
    for d in docs:
        t = d.get("intervention_type", "unknown")
        s = d.get("status", "active")
        by_type[t] = by_type.get(t, 0) + 1
        by_status[s] = by_status.get(s, 0) + 1
        if d.get("created_at", "") >= cutoff:
            recent += 1

    return {
        "total": len(docs),
        "active": by_status.get("active", 0),
        "resolved": by_status.get("resolved", 0),
        "last_7_days": recent,
        "by_type": by_type,
        "by_status": by_status,
    }
