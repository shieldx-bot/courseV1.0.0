"""Phase 8 Production Readiness tests.

CO1: ``activity_events`` / ``notifications`` no longer declare TTL indexes
(their ``created_at`` is an ISO string, so MongoDB TTL would never expire them
— AI-B's retention cron owns cleanup). Every document written to either
collection must carry a valid ISO ``created_at`` so that retention can enforce
the window. NV3: ``Settings`` fails fast on an unknown ``environment`` value.
"""
import os

os.environ["MONGODB_URI"] = "memory://test"

import asyncio
from datetime import datetime

import pytest

from app.core.collections import Collections as C
from app.db.mongodb import get_db
from app.services import community, notifications, remediation


def _await(coro):
    return asyncio.run(coro)


def _assert_valid_iso(value) -> None:
    assert isinstance(value, str) and value, f"expected non-empty ISO string, got {value!r}"
    parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    assert parsed.tzinfo is not None, f"created_at must be timezone-aware: {value!r}"


# ── CO1 — no TTL indexes on the two ISO-created_at collections ───────────────

def test_no_ttl_index_for_activity_events_and_notifications():
    from app.db import indexes as idx

    for col in (C.ACTIVITY_EVENTS, C.NOTIFICATIONS):
        models = idx.COLLECTION_INDEXES[col]
        assert models, f"{col} should keep a plain created_at index"
        assert all(
            m.document.get("expireAfterSeconds") is None for m in models
        ), f"{col} must not declare a TTL index"
        names = {m.document["name"] for m in models}
        assert "created_at_1_ttl" not in names, f"stale TTL name still used on {col}"


def test_ttl_indexes_still_kept_where_field_is_bson_date():
    from app.db import indexes as idx

    def _ttl(col):
        return {m.document["name"]: m.document.get("expireAfterSeconds")
                for m in idx.COLLECTION_INDEXES[col]}

    assert _ttl(C.INTELLIGENCE_SNAPSHOTS).get("expire_at_1_ttl") == 0
    assert _ttl(C.EVENT_DELIVERIES).get("processed_at_1_ttl") == 30 * 24 * 3600


def test_create_indexes_safe_on_in_memory_backend():
    from app.db.indexes import create_indexes

    _await(create_indexes(get_db()))  # must not raise (no index metadata in-memory)


# ── CO1 — every writer stores a valid ISO created_at ─────────────────────────

def test_create_activity_stores_valid_iso_created_at():
    db = get_db()
    db.activity_events.delete_many({})
    doc = _await(community.create_activity("p8-user", "challenge_completed", {"course_id": "c"}))

    _assert_valid_iso(doc["created_at"])
    stored = _await(db.activity_events.find_one({"_id": doc["_id"]}))
    assert stored is not None
    _assert_valid_iso(stored["created_at"])
    assert stored["created_at"] == doc["created_at"]


def test_create_notification_stores_valid_iso_created_at():
    db = get_db()
    db.notifications.delete_many({})
    doc = _await(notifications.create_notification("p8-user", "welcome", {"k": 1}))

    assert doc is not None
    _assert_valid_iso(doc["created_at"])
    stored = _await(db.notifications.find_one({"_id": doc["_id"]}))
    assert stored is not None
    _assert_valid_iso(stored["created_at"])


def test_remediation_feedback_event_stores_valid_iso_created_at():
    db = get_db()
    db.activity_events.delete_many({})
    result = _await(remediation.submit_remediation_feedback(
        "p8-user", "course-p8", "con-p8", helpful=True,
    ))
    assert result["recorded"] is True

    events = _await(db.activity_events.find({"type": "remediation_feedback"}).to_list(10))
    assert events, "remediation feedback must persist an activity event"
    _assert_valid_iso(events[0]["created_at"])


# ── NV3 — environment validator (fail fast on typo) ──────────────────────────

def test_settings_accepts_allowed_environments():
    from app.core.config import Settings

    for env in ("development", "staging", "production"):
        s = Settings(_env_file=None, environment=env)
        assert s.environment == env


def test_settings_rejects_unknown_environment():
    from pydantic import ValidationError

    from app.core.config import Settings

    with pytest.raises(ValidationError):
        Settings(_env_file=None, environment="prod-typo")
