"""Collection name contracts — single source of truth for collection names.

Services must reference collection names through these constants instead of
hardcoded string literals so that renames / retention policy changes stay in
one place (see also app/db/indexes.py).
"""


class Collections:
    USERS = "users"
    CHALLENGES = "challenges"
    CHALLENGE_ATTEMPTS = "challenge_attempts"
    CHALLENGE_VERSIONS = "challenge_versions"
    RATINGS = "ratings"
    BOOKMARKS = "bookmarks"
    COLLECTIONS = "collections"
    COLLECTION_BOOKMARKS = "collection_bookmarks"
    CREATOR_PROFILES = "creator_profiles"
    EVENTS = "events"
    MODERATION_REPORTS = "moderation_reports"
    ACTIVITY_EVENTS = "activity_events"
    NOTIFICATIONS = "notifications"
    NOTIFICATION_PREFERENCES = "notification_preferences"
    SKILLS = "skills"
    CONCEPT_MASTERY = "concept_mastery"
    CONCEPT_DEFINITIONS = "concept_definitions"
    CERTIFICATES = "certificates"
    OPS_TASKS = "ops_tasks"
    INTELLIGENCE_SNAPSHOTS = "intelligence_snapshots"
    EVENT_DELIVERIES = "event_deliveries"
    DISCUSSIONS = "discussions"
