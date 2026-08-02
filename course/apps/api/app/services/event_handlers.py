"""Domain Event Handlers — decoupled, self-documented listeners.

Each handler knows only about the Event (name + payload), never the producer.
Handlers are failure-isolated by the bus: one failing never blocks others.
Handlers must be idempotent — duplicate deliveries (re-registration, replay)
never double side-effects: every state-changing handler first checks a
per-correlation delivery marker (`event_deliveries`), so a second run of the
same (correlation + action) is a no-op.

Every event is documented via an immutable EventSpec passed to bus.register().
The Event Catalog + dependency graph + diagnostics are DERIVED from these
registrations at runtime — never maintained manually.

Registered in main.py at startup via `register_default_handlers()`.
"""

import logging
from datetime import datetime, timezone

from app.core.collections import Collections as C
from app.core.events import Event, EventBus, EventSpec
from app.db.mongodb import get_db
from app.services.community import create_activity

logger = logging.getLogger(__name__)


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


# ── Observability helpers ────────────────────────────────────────────────────

def _log_started(name: str, producer: str) -> None:
    logger.info("⏩ handling %s (producer=%s)", name, producer)


def _log_finished(name: str, outcome: str = "ok") -> None:
    logger.info("⏹ %s → %s", name, outcome)


# ── Idempotency guard ────────────────────────────────────────────────────────

async def _is_processed(event: Event, action: str) -> bool:
    """Return True if this (event correlation + action) was already applied.

    A marker doc is inserted once per (correlation_id, action). Any later run
    of the same handler for the same event instance is skipped, preventing
    duplicate activities, notifications, and double counters even if handlers
    are registered more than once (startup + test) or an event is replayed.
    """
    db = get_db()
    marker_id = f"evd-{event.correlation_id}-{action}"
    existing = await db[C.EVENT_DELIVERIES].find_one({"_id": marker_id})
    if existing:
        return True
    await db[C.EVENT_DELIVERIES].insert_one({
        "_id": marker_id,
        "event_name": event.name,
        "correlation_id": event.correlation_id,
        "action": action,
        "processed_at": _now_iso(),
    })
    return False


# ── ChallengeCompleted listeners ─────────────────────────────────────────────

async def _on_challenge_completed__activity(event: Event) -> None:
    """Community domain: append to the user's public activity feed."""
    _log_started(event.name, event.producer)
    if await _is_processed(event, "activity"):
        _log_finished(event.name, outcome="dedup")
        return
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
            "event_correlation_id": event.correlation_id,
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
    """Reserved: future notification listener (currently a NOOP)."""
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
    if await _is_processed(event, "creator_tracking"):
        _log_finished(event.name, outcome="dedup")
        return
    from app.services.ecosystem import get_or_create_creator_profile, refresh_achievements

    profile = await get_or_create_creator_profile(host_id)
    db = get_db()
    await db[C.CREATOR_PROFILES].update_one({"_id": profile["_id"]}, {"$inc": {"events_hosted": 1}})
    await refresh_achievements(host_id)
    _log_finished(event.name)


async def _on_event_created__activity(event: Event) -> None:
    """Community domain: append to the public activity feed."""
    _log_started(event.name, event.producer)
    if await _is_processed(event, "activity"):
        _log_finished(event.name, outcome="dedup")
        return
    host_id = event.payload.get("host_id")
    if host_id:
        await create_activity(
            host_id,
            "event_created",
            {
                "event_id": event.payload.get("event_id"),
                "event_title": event.payload.get("event_title", ""),
                "event_correlation_id": event.correlation_id,
            },
            visibility="public",
        )
    _log_finished(event.name)


async def _on_event_created__notify_followers(event: Event) -> None:
    """Notifications domain: fan-out to the host's followers."""
    _log_started(event.name, event.producer)
    if await _is_processed(event, "notify_followers"):
        _log_finished(event.name, outcome="dedup")
        return
    host_id = event.payload.get("host_id")
    if host_id:
        from app.services.notifications import notify_followers

        await notify_followers(host_id, {"event_id": event.payload.get("event_id"), "event_title": event.payload.get("event_title", "")})
    _log_finished(event.name)


# ── ChallengePublished listeners ─────────────────────────────────────────────

async def _on_challenge_published__notify_followers(event: Event) -> None:
    """Notifications domain: fan-out to the creator's followers."""
    _log_started(event.name, event.producer)
    if await _is_processed(event, "notify_followers"):
        _log_finished(event.name, outcome="dedup")
        return
    creator_id = event.payload.get("creator_id")
    if creator_id:
        from app.services.notifications import notify_followers

        await notify_followers(creator_id, {
            "challenge_id": event.payload.get("challenge_id"),
            "challenge_title": event.payload.get("challenge_title", ""),
            "difficulty": event.payload.get("difficulty", "medium"),
            "event_correlation_id": event.correlation_id,
        })
    _log_finished(event.name)


# ── CreatorFollowed listeners ────────────────────────────────────────────────

async def _on_creator_followed__notify(event: Event) -> None:
    """Notifications domain: tell the creator they gained a follower."""
    _log_started(event.name, event.producer)
    if await _is_processed(event, "notify_creator"):
        _log_finished(event.name, outcome="dedup")
        return
    creator_id = event.payload.get("creator_id")
    if creator_id:
        from app.services.notifications import create_notification

        await create_notification(
            creator_id,
            "creator_new_follower",
            {
                "follower_id": event.payload.get("follower_id"),
                "event_correlation_id": event.correlation_id,
            },
            link="/creators",
        )
    _log_finished(event.name)


# ── CreatorVerified listeners ────────────────────────────────────────────────

async def _on_creator_verified__reserved(event: Event) -> None:
    """Reserved: direct producer code already creates activity + notification.

    Registered with documentation so the catalog reflects the intended
    trust/audit consumer without emitting duplicate notifications today.
    """
    _log_started(event.name, event.producer)
    _log_finished(event.name, outcome="noop")


# ── RatingChanged listeners ──────────────────────────────────────────────────

async def _on_rating_changed__notify_creator(event: Event) -> None:
    """Notifications domain: tell the challenge author about a new rating."""
    _log_started(event.name, event.producer)
    if await _is_processed(event, "notify_creator"):
        _log_finished(event.name, outcome="dedup")
        return
    creator_id = event.payload.get("creator_id")
    if creator_id:
        from app.services.notifications import create_notification

        await create_notification(
            creator_id,
            "creator_rating_received",
            {
                "challenge_id": event.payload.get("challenge_id"),
                "challenge_title": event.payload.get("challenge_title", ""),
                "rating": event.payload.get("rating"),
                "avg_rating": event.payload.get("avg_rating"),
                "event_correlation_id": event.correlation_id,
            },
            link="/creators",
        )
    _log_finished(event.name)


# ── CertificateIssued listeners ──────────────────────────────────────────────

async def _on_certificate_issued__notify(event: Event) -> None:
    """Notifications domain: congratulate the learner on their certificate."""
    _log_started(event.name, event.producer)
    if await _is_processed(event, "notify_user"):
        _log_finished(event.name, outcome="dedup")
        return
    user_id = event.payload.get("user_id")
    if user_id:
        from app.services.notifications import create_notification

        await create_notification(
            user_id,
            "certificate_issued",
            {
                "certificate_id": event.payload.get("certificate_id"),
                "course_id": event.payload.get("course_id"),
                "course_title": event.payload.get("course_title", ""),
                "event_correlation_id": event.correlation_id,
            },
            link="/certificates",
        )
    _log_finished(event.name)


# ── ReportSubmitted listeners ────────────────────────────────────────────────

async def _on_report_submitted__notify_admins(event: Event) -> None:
    """Notifications domain: alert admins/watchers of a new moderation report."""
    _log_started(event.name, event.producer)
    if await _is_processed(event, "notify_admins"):
        _log_finished(event.name, outcome="dedup")
        return
    from app.services.notifications import create_notification

    await create_notification(
        "user-admin@ascendly.io",
        "system_announcement",
        {
            "note": f"New {event.payload.get('category', 'other')} report ({event.payload.get('target_type', '?')}) — {event.payload.get('report_id')}",
            "report_id": event.payload.get("report_id"),
            "event_correlation_id": event.correlation_id,
        },
        link="/admin/ecosystem/moderation",
    )
    _log_finished(event.name)


# ── ModerationCompleted listeners ────────────────────────────────────────────

async def _on_moderation_completed__notify_reporter(event: Event) -> None:
    """Notifications domain: update the reporter on the resolution outcome."""
    _log_started(event.name, event.producer)
    if await _is_processed(event, "notify_reporter"):
        _log_finished(event.name, outcome="dedup")
        return
    reporter_id = event.payload.get("reporter_id")
    if reporter_id:
        from app.services.notifications import create_notification

        await create_notification(
            reporter_id,
            "system_announcement",
            {
                "note": f"Your report {event.payload.get('report_id')} was {event.payload.get('status')} (action: {event.payload.get('action')})",
                "report_id": event.payload.get("report_id"),
                "event_correlation_id": event.correlation_id,
            },
            link="/admin/ecosystem/moderation",
        )
    _log_finished(event.name)


# ── SkillMastered listeners ──────────────────────────────────────────────────

async def _on_skill_mastered__notify(event: Event) -> None:
    """Learning domain: celebrate reaching mastery threshold for a concept."""
    _log_started(event.name, event.producer)
    if await _is_processed(event, "notify_user"):
        _log_finished(event.name, outcome="dedup")
        return
    user_id = event.payload.get("user_id")
    if user_id:
        from app.services.notifications import create_notification

        await create_notification(
            user_id,
            "skill_levelup",
            {
                "concept_id": event.payload.get("concept_id"),
                "course_id": event.payload.get("course_id"),
                "mastery_score": event.payload.get("mastery_score"),
                "event_correlation_id": event.correlation_id,
            },
            link="/adaptive",
        )
    _log_finished(event.name)


# ── UserRegistered listeners ─────────────────────────────────────────────────

async def _on_user_registered__welcome(event: Event) -> None:
    """Notifications domain: onboard a brand-new user with a welcome ping."""
    _log_started(event.name, event.producer)
    if await _is_processed(event, "welcome"):
        _log_finished(event.name, outcome="dedup")
        return
    user_id = event.payload.get("user_id")
    if user_id:
        from app.services.notifications import create_notification

        await create_notification(
            user_id,
            "welcome",
            {
                "name": event.payload.get("name", ""),
                "event_correlation_id": event.correlation_id,
            },
            link="/",
        )
    _log_finished(event.name)


# ── EventJoined listeners ────────────────────────────────────────────────────

async def _on_event_joined__notify_host(event: Event) -> None:
    """Notifications domain: tell the event host someone just joined."""
    _log_started(event.name, event.producer)
    if await _is_processed(event, "notify_host"):
        _log_finished(event.name, outcome="dedup")
        return
    host_id = event.payload.get("host_id")
    user_id = event.payload.get("user_id")
    if host_id and user_id and host_id != user_id:
        from app.services.notifications import create_notification

        await create_notification(
            host_id,
            "event_attendee_joined",
            {
                "event_id": event.payload.get("event_id"),
                "event_title": event.payload.get("event_title", ""),
                "joiner_id": user_id,
                "event_correlation_id": event.correlation_id,
            },
            link="/events",
        )
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
    idempotency="attempt_id unique; correlation-delivery marker prevents duplicate side effects",
    example_payload={
        "user_id": "u-1", "challenge_id": "ch-1", "challenge_title": "chmod",
        "difficulty": "easy", "is_correct": True, "attempt_id": "att-u1-ch1-123", "creator_id": "u-2",
    },
    related_events=("EventCreated", "RatingChanged", "ChallengePublished"),
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
    idempotency="event_id unique; host-guard prevents accidental tracking; correlation-delivery marker",
    example_payload={
        "event_id": "evt-code-123", "event_title": "Weekly Code",
        "host_id": "u-1", "requested_host_id": "u-1", "event_type": "weekly_challenge",
    },
    related_events=("ChallengeCompleted", "EventJoined"),
)

CHALLENGE_PUBLISHED_SPEC = EventSpec(
    name="ChallengePublished",
    version=1,
    description="A creator published a challenge (status → published).",
    producer="community.publish_challenge",
    payload_schema={
        "challenge_id": "str — published challenge",
        "challenge_title": "str — display title",
        "creator_id": "str — challenge author",
        "difficulty": "str — easy|medium|hard|expert",
    },
    side_effects=("follower notifications",),
    idempotency="correlation-delivery marker prevents duplicate fan-out",
    example_payload={"challenge_id": "ch-1", "challenge_title": "chmod", "creator_id": "u-2", "difficulty": "easy"},
    related_events=("ChallengeCompleted", "CreatorFollowed"),
)

CREATOR_FOLLOWED_SPEC = EventSpec(
    name="CreatorFollowed",
    version=1,
    description="A user started following a creator.",
    producer="community.follow_creator",
    payload_schema={
        "creator_id": "str — creator being followed",
        "follower_id": "str — the follower",
    },
    side_effects=("creator new-follower notification",),
    idempotency="correlation-delivery marker prevents duplicate notification",
    example_payload={"creator_id": "u-2", "follower_id": "u-1"},
    related_events=("ChallengePublished",),
)

CREATOR_VERIFIED_SPEC = EventSpec(
    name="CreatorVerified",
    version=1,
    description="An admin approved/rejected a creator verification request.",
    producer="creator.review_creator_verification",
    payload_schema={
        "creator_id": "str — the creator",
        "reviewer_id": "str — the admin",
        "approved": "bool — approval result",
        "status": "str — verified|rejected",
        "note": "str — review note",
    },
    side_effects=("reserved: producer already creates activity+notification",),
    idempotency="producer-side idempotent (single status transition); no handler side effects",
    example_payload={"creator_id": "u-2", "reviewer_id": "admin-1", "approved": True, "status": "verified", "note": "ok"},
    related_events=("CreatorFollowed",),
)

RATING_CHANGED_SPEC = EventSpec(
    name="RatingChanged",
    version=1,
    description="A user rated a challenge (1-5) or updated their rating.",
    producer="community.rate_challenge",
    payload_schema={
        "challenge_id": "str — the challenge",
        "challenge_title": "str — display title",
        "creator_id": "str|null — challenge author",
        "user_id": "str — the rater",
        "rating": "int — 1-5",
        "avg_rating": "float — new average",
    },
    side_effects=("challenge author rating notification",),
    idempotency="correlation-delivery marker prevents duplicate notification",
    example_payload={"challenge_id": "ch-1", "challenge_title": "chmod", "creator_id": "u-2", "user_id": "u-1", "rating": 5, "avg_rating": 4.5},
    related_events=("ChallengeCompleted",),
)

CERTIFICATE_ISSUED_SPEC = EventSpec(
    name="CertificateIssued",
    version=1,
    description="A certificate was issued to a learner who completed a course.",
    producer="certificate.issue_certificate",
    payload_schema={
        "certificate_id": "str — new certificate id (idempotency key)",
        "user_id": "str — the learner",
        "course_id": "str — the course",
        "course_title": "str — display title",
    },
    side_effects=("learner certificate notification",),
    idempotency="certificate_id unique (cert-{user}-{course}); correlation-delivery marker",
    example_payload={"certificate_id": "cert-u-1-c-1", "user_id": "u-1", "course_id": "c-1", "course_title": "SQL"},
    related_events=("UserRegistered",),
)

REPORT_SUBMITTED_SPEC = EventSpec(
    name="ReportSubmitted",
    version=1,
    description="A user submitted a moderation report.",
    producer="moderation.submit_report",
    payload_schema={
        "report_id": "str — new report id (idempotency key)",
        "reporter_id": "str — the reporter",
        "target_type": "str — challenge|user|discussion|...",
        "target_id": "str — reported entity",
        "category": "str — spam|abuse|...",
    },
    side_effects=("admin moderation alert",),
    idempotency="report_id unique; correlation-delivery marker",
    example_payload={"report_id": "rep-1", "reporter_id": "u-1", "target_type": "challenge", "target_id": "ch-1", "category": "spam"},
    related_events=("ModerationCompleted",),
)

MODERATION_COMPLETED_SPEC = EventSpec(
    name="ModerationCompleted",
    version=1,
    description="A moderation report was resolved or dismissed.",
    producer="moderation.resolve_report",
    payload_schema={
        "report_id": "str — the report",
        "reporter_id": "str|null — the reporter",
        "target_type": "str — challenge|user|discussion|...",
        "target_id": "str|null — reported entity",
        "action": "str — warn|remove|ban|dismiss",
        "status": "str — resolved|dismissed",
        "reviewer_id": "str — the admin",
    },
    side_effects=("reporter resolution notification",),
    idempotency="correlation-delivery marker prevents duplicate notification",
    example_payload={"report_id": "rep-1", "reporter_id": "u-1", "target_type": "challenge", "target_id": "ch-1", "action": "remove", "status": "resolved", "reviewer_id": "admin-1"},
    related_events=("ReportSubmitted",),
)

SKILL_MASTERED_SPEC = EventSpec(
    name="SkillMastered",
    version=1,
    description="A user's concept mastery crossed the mastered threshold (>= 7.0).",
    producer="concept_mastery.update_mastery",
    payload_schema={
        "user_id": "str — the learner",
        "course_id": "str — the course",
        "concept_id": "str — the mastered concept",
        "mastery_score": "float — new score (>= 7.0)",
    },
    side_effects=("learner skill level-up notification",),
    idempotency="only published on threshold crossing; correlation-delivery marker",
    example_payload={"user_id": "u-1", "course_id": "c-1", "concept_id": "con-1", "mastery_score": 7.2},
    related_events=("CertificateIssued",),
)

USER_REGISTERED_SPEC = EventSpec(
    name="UserRegistered",
    version=1,
    description="A new user account was created via signup.",
    producer="auth.signup",
    payload_schema={
        "user_id": "str — new user id (idempotency key)",
        "email": "str — account email",
        "name": "str — display name",
    },
    side_effects=("welcome notification",),
    idempotency="user_id unique; correlation-delivery marker",
    example_payload={"user_id": "user-a@b.com", "email": "a@b.com", "name": "A"},
    related_events=("CertificateIssued",),
)

EVENT_JOINED_SPEC = EventSpec(
    name="EventJoined",
    version=1,
    description="A user joined a community event.",
    producer="ecosystem.join_event",
    payload_schema={
        "event_id": "str — the event",
        "event_title": "str — display title",
        "host_id": "str — event host",
        "user_id": "str — the joiner",
    },
    side_effects=("host new-attendee notification",),
    idempotency="correlation-delivery marker prevents duplicate notification",
    example_payload={"event_id": "evt-1", "event_title": "Weekly Code", "host_id": "u-1", "user_id": "u-2"},
    related_events=("EventCreated",),
)


# ── Registration ─────────────────────────────────────────────────────────────

def register_default_handlers(bus: EventBus) -> None:
    """Register all default listeners with their EventSpec documentation.

    Called at application startup (see app/main.py lifespan). Each handler is
    idempotent via the per-correlation delivery marker, so registering twice
    (startup + tests) never double-applies state.
    """

    # ChallengeCompleted — producer: community.submit_challenge
    bus.register(_on_challenge_completed__activity, domain="community", event_name="ChallengeCompleted", spec=CHALLENGE_COMPLETED_SPEC)
    bus.register(_on_challenge_completed__creator_stats, domain="creator", event_name="ChallengeCompleted", spec=None)
    bus.register(_on_challenge_completed__reserved, domain="notifications", event_name="ChallengeCompleted", spec=None)

    # EventCreated — producer: ecosystem.create_event
    bus.register(_on_event_created__creator_tracking, domain="creator", event_name="EventCreated", spec=EVENT_CREATED_SPEC)
    bus.register(_on_event_created__activity, domain="community", event_name="EventCreated", spec=None)
    bus.register(_on_event_created__notify_followers, domain="notifications", event_name="EventCreated", spec=None)

    # ChallengePublished — producer: community.publish_challenge
    bus.register(_on_challenge_published__notify_followers, domain="notifications", event_name="ChallengePublished", spec=CHALLENGE_PUBLISHED_SPEC)

    # CreatorFollowed — producer: community.follow_creator
    bus.register(_on_creator_followed__notify, domain="notifications", event_name="CreatorFollowed", spec=CREATOR_FOLLOWED_SPEC)

    # CreatorVerified — producer: creator.review_creator_verification
    bus.register(_on_creator_verified__reserved, domain="trust", event_name="CreatorVerified", spec=CREATOR_VERIFIED_SPEC)

    # RatingChanged — producer: community.rate_challenge
    bus.register(_on_rating_changed__notify_creator, domain="notifications", event_name="RatingChanged", spec=RATING_CHANGED_SPEC)

    # CertificateIssued — producer: certificate.issue_certificate
    bus.register(_on_certificate_issued__notify, domain="notifications", event_name="CertificateIssued", spec=CERTIFICATE_ISSUED_SPEC)

    # ReportSubmitted — producer: moderation.submit_report
    bus.register(_on_report_submitted__notify_admins, domain="notifications", event_name="ReportSubmitted", spec=REPORT_SUBMITTED_SPEC)

    # ModerationCompleted — producer: moderation.resolve_report
    bus.register(_on_moderation_completed__notify_reporter, domain="notifications", event_name="ModerationCompleted", spec=MODERATION_COMPLETED_SPEC)

    # SkillMastered — producer: concept_mastery.update_mastery
    bus.register(_on_skill_mastered__notify, domain="learning", event_name="SkillMastered", spec=SKILL_MASTERED_SPEC)

    # UserRegistered — producer: auth.signup
    bus.register(_on_user_registered__welcome, domain="notifications", event_name="UserRegistered", spec=USER_REGISTERED_SPEC)

    # EventJoined — producer: ecosystem.join_event
    bus.register(_on_event_joined__notify_host, domain="notifications", event_name="EventJoined", spec=EVENT_JOINED_SPEC)
