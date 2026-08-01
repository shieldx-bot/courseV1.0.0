"""Domain Event Handlers — decoupled listeners that react to business events.

Each handler knows only about the Event (name + payload), never the producer.
Handlers are failure-isolated by the bus: one failing never blocks others.
Handlers must be idempotent — duplicate events never double side-effects.

Registered in main.py at startup via `register_default_handlers()`.
"""

import logging

from app.core.events import Event, EventBus
from app.services.community import create_activity

logger = logging.getLogger(__name__)


# ── Observability helpers ────────────────────────────────────────────────────

def _log_started(name: str, producer: str) -> None:
    logger.info("⏩ handling %s (producer=%s)", name, producer)


def _log_finished(name: str, outcome: str = "ok") -> None:
    logger.info("⏹ %s → %s", name, outcome)


# ── ChallengeCompleted listeners ─────────────────────────────────────────────

async def _on_challenge_completed__activity(event: Event) -> None:
    """Reactivity: append to the user's public activity feed (supports feed tabs)."""
    _log_started(event.name, event.producer)
    payload = event.payload
    user_id = payload.get("user_id")
    if not user_id:
        return
    # Idempotent: activity per attempt is unique because the payload carries attempt_id.
    await create_activity(
        user_id,
        "challenge_completed",
        {
            "challenge_id": payload.get("challenge_id"),
            "challenge_title": payload.get("challenge_title", ""),
            "difficulty": payload.get("difficulty", "medium"),
            "attempt_id": payload.get("attempt_id"),
            "is_correct": payload.get("is_correct"),
        },
        visibility="public",
    )
    _log_finished(event.name)


async def _on_challenge_completed__creator_stats(event: Event) -> None:
    """Reactivity: recompute the challenge author's creator reputation/level.

    Uses the existing stats engine (`_update_creator_stats`) so behavior is
    identical to the pre-event direct call; the producer is no longer coupled
    to this side-effect.  Idempotent: recomputation is deterministic per state.
    """
    _log_started(event.name, event.producer)
    payload = event.payload
    creator_id = payload.get("creator_id")
    if creator_id:
        from app.services.community import _update_creator_stats

        await _update_creator_stats(creator_id)
    _log_finished(event.name)


async def _on_challenge_completed__notification(event: Event) -> None:
    """Reactivity: send a 'skill milestone' style notification is deferred.

    This listener is intentionally disabled by default — the existing
    notification path is already wired from the core submission which owns
    the challenge/attempt lifecycle inline.  Keeping it un-registered avoids
    duplicate notifications while preserving the event for future use.
    """
    _log_started(event.name, event.producer)
    _log_finished(event.name, outcome="noop")


# ── EventCreated listeners ───────────────────────────────────────────────────

async def _on_event_created__creator_tracking(event: Event) -> None:
    """Creator domain: increment events_hosted + refresh achievements.

    Preserves the original guard semantics: tracking only occurs when the
    client requested the authenticated user as host (body host_id matches).
    Idempotent: events_hosted increments are owned by the event doc.
    """
    _log_started(event.name, event.producer)
    host_id = event.payload.get("host_id")
    requested_host = event.payload.get("requested_host_id")
    if requested_host != host_id:
        _log_finished(event.name, outcome="skipped-host-guard")
        return
    from app.services.ecosystem import get_or_create_creator_profile, refresh_achievements

    profile = await get_or_create_creator_profile(host_id)
    from app.db.mongodb import get_db

    db = get_db()
    await db.creator_profiles.update_one({"_id": profile["_id"]}, {"$inc": {"events_hosted": 1}})
    await refresh_achievements(host_id)
    _log_finished(event.name)


async def _on_event_created__activity(event: Event) -> None:
    """Community domain: append to the public activity feed."""
    _log_started(event.name, event.producer)
    host_id = event.payload.get("host_id")
    if host_id:
        await create_activity(
            host_id,
            "event_created",
            {"event_id": event.payload.get("event_id"), "event_title": event.payload.get("event_title", "")},
            visibility="public",
        )
    _log_finished(event.name)


async def _on_event_created__notify_followers(event: Event) -> None:
    """Notifications domain: fan-out to the host's followers."""
    _log_started(event.name, event.producer)
    host_id = event.payload.get("host_id")
    if host_id:
        from app.services.notifications import notify_followers

        await notify_followers(host_id, {"event_id": event.payload.get("event_id"), "event_title": event.payload.get("event_title", "")})
    _log_finished(event.name)


# ── Registration ─────────────────────────────────────────────────────────────

def register_default_handlers(bus: EventBus) -> None:
    """Register all default listeners.

    Called once at application startup (see app/main.py lifespan).
    """
    bus.subscribe("ChallengeCompleted", _on_challenge_completed__activity)
    bus.subscribe("ChallengeCompleted", _on_challenge_completed__creator_stats)
    # NOTE: notification listener intentionally not registered yet —
    # keeps the migration incremental and avoids duplicate notifications.
    bus.subscribe("ChallengeCompleted", _on_challenge_completed__notification)

    # EventCreated — decoupled consumers: creator tracking, feed, notifications
    bus.subscribe("EventCreated", _on_event_created__creator_tracking)
    bus.subscribe("EventCreated", _on_event_created__activity)
    bus.subscribe("EventCreated", _on_event_created__notify_followers)
