"""Ecosystem services — facade over the split domain services.

Phase 7 hardening: the former 833-line monolith was split into focused
services while preserving the EXACT public API (module name + functions) so
routers and call sites never change:

  - app.services.creator        — Creator Economy (profiles, verification,
                                  trust, achievements, analytics)
  - app.services.marketplace    — Collections / series / bundles + challenge
                                  versioning
  - app.services.events_service — Community events platform
  - app.services.moderation     — Reports, review queue, moderation actions
  - app.services.intelligence   — Platform intelligence signals

This facade re-exports the complete public API of the old module. Do NOT add
new logic here — put it in the owning domain service.
"""

from app.services.creator import (
    CREATOR_BADGES,
    CREATOR_MILESTONES,
    compute_creator_trust,
    get_creator_analytics,
    get_creator_leaderboard,
    get_or_create_creator_profile,
    refresh_achievements,
    request_creator_verification,
    review_creator_verification,
)
from app.services.events_service import (
    EVENT_TEMPLATES,
    create_event,
    join_event,
    leave_event,
    list_events,
)
from app.services.intelligence import platform_intelligence
from app.services.marketplace import (
    bookmark_collection,
    create_challenge_version,
    create_collection,
    get_challenge_versions,
    list_collections,
)
from app.services.moderation import (
    MODERATION_CATEGORIES,
    list_moderation_queue,
    moderation_stats,
    resolve_report,
    submit_report,
)

__all__ = [
    "CREATOR_BADGES",
    "CREATOR_MILESTONES",
    "EVENT_TEMPLATES",
    "MODERATION_CATEGORIES",
    "bookmark_collection",
    "compute_creator_trust",
    "create_challenge_version",
    "create_collection",
    "create_event",
    "get_challenge_versions",
    "get_creator_analytics",
    "get_creator_leaderboard",
    "get_or_create_creator_profile",
    "join_event",
    "leave_event",
    "list_collections",
    "list_events",
    "list_moderation_queue",
    "moderation_stats",
    "platform_intelligence",
    "refresh_achievements",
    "request_creator_verification",
    "resolve_report",
    "review_creator_verification",
    "submit_report",
]
