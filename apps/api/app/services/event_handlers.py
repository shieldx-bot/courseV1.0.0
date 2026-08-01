"""Domain Event Handlers — decoupled, self-documented listeners.

Each handler knows only about the Event (name + payload), never the producer.
Handlers are failure-isolated by the bus: one failing never blocks others.
Handlers must be idempotent — duplicate events never double side-effects.

Every event is documented via an immutable EventSpec passed to bus.register().
The Event Catalog + dependency graph + diagnostics are DERIVED from these
registrations at runtime — never maintained manually.

Registered in main.py at startup via `register_default_handlers()`.
"""

import logging

from app.core.events import Event, EventBus, EventSpec
from app.services.community import create_activity

logger = logging.getLogger(__name__)


# ── Observability helpers ────────────────────────────────────────────────────

def _log_started(name: str, producer: str) -> None:
    logger.info("⏩ handling %s (producer=%s)", name, producer)


def _log_finished(name: str, outcome: str = "ok") -> None:
    logger.info("⏹ %s → %s", name, outcome)


# ── ChallengeCompleted listeners ─────────────────────────────────────────────

async def _on_challenge_completed__activity(event: Event) -> None:
    """Community domain: append to the user's public activity feed."""
    _log_started(event.name, event.producer)
    payload = event.payload
    user_id = payload.get("user_id")
    if not user_id:
        return
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
    """Creator domain: recompute the challenge author's reputation/level."""
    _log_started(event.name, event.producer)
    payload = event.payload
    creator_id = payload.get("creator_id")
    if creator_id:
        from app.services.community import _update_creator_stats

        await _update_creator_stats(creator_id)
    _log_finished(event.name)


async def _on_challenge_completed__reserved(event: Event) -> None:
    """Reserved: future notification listener (currently a NOOP).

    Registered with documentation so the catalog reflects the intended
    notification consumer without emitting duplicate notifications today.
    """
    _log_started(event.name, event.producer)
    _log_finished(event.name, outcome="noop")


# ── EventCreated listeners ───────────────────────────────────────────────────

async def _on_event_created__creator_tracking(event: Event) -> None:
    """Creator domain: increment events_hosted + refresh achievements."""
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


# ── Event Catalog entries ─────────────────────────────────────────────────────

CHALLENGE_COMPLETED_SPEC = EventSpec(
    name="ChallengeCompleted",
    version=1,
    description="A user submitted an attempt to a challenge (correct or incorrect).",
    producer="community.submit_challenge",
    payload_schema={
        "user_id": "str — the solver",
        "challenge_id": "str — the challenge",
        "challenge_title": "str — display title",
        "difficulty": "str — easy|medium|hard|expert",
        "is_correct": "bool — grading result",
        "attempt_id": "str — unique attempt (idempotency key)",
        "creator_id": "str|null — challenge author",
    },
    side_effects=("community feed event", "creator stats recomputation"),
    idempotency="attempt_id unique; duplicate publishes skipped by correlation+payload",
    example_payload={
        "user_id": "u-1", "challenge_id": "ch-1", "challenge_title": "chmod",
        "difficulty": "easy", "is_correct": True, "attempt_id": "att-u1-ch1-123", "creator_id": "u-2",
    },
    related_events=("EventCreated",),
)

EVENT_CREATED_SPEC = EventSpec(
    name="EventCreated",
    version=1,
    description="A community event (challenge, AMA, hackathon...) was created.",
    producer="ecosystem.create_event",
    payload_schema={
        "event_id": "str — new event id (idempotency key)",
        "event_title": "str — display title",
        "host_id": "str — authenticated host",
        "requested_host_id": "str|null — client-supplied host (guard)",
        "event_type": "str — weekly_challenge|ama|...",
    },
    side_effects=("creator events_hosted+achievements", "community feed event", "follower notifications"),
    idempotency="event_id unique; host-guard prevents accidental tracking",
    example_payload={
        "event_id": "evt-code-123", "event_title": "Weekly Code",
        "host_id": "u-1", "requested_host_id": "u-1", "event_type": "weekly_challenge",
    },
    related_events=("ChallengeCompleted",),
)


# ── Registration ─────────────────────────────────────────────────────────────

def register_default_handlers(bus: EventBus) -> None:
    """Register all default listeners with their EventSpec documentation.

    Called once at application startup (see app/main.py lifespan).
    """

    # ChallengeCompleted — producers: community.submit_challenge
    bus.register(_on_challenge_completed__activity, domain="community", event_name="ChallengeCompleted", spec=CHALLENGE_COMPLETED_SPEC)
    bus.register(_on_challenge_completed__creator_stats, domain="creator", event_name="ChallengeCompleted", spec=None)
    bus.register(_on_challenge_completed__reserved, domain="notifications", event_name="ChallengeCompleted", spec=None)

    # EventCreated — producers: ecosystem.create_event
    bus.register(_on_event_created__creator_tracking, domain="creator", event_name="EventCreated", spec=EVENT_CREATED_SPEC)
    bus.register(_on_event_created__activity, domain="community", event_name="EventCreated", spec=None)
    bus.register(_on_event_created__notify_followers, domain="notifications", event_name="EventCreated", spec=None)