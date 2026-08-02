"""Phase 7 Architecture Hardening tests.

Covers: ecosystem facade split regression, challenges_service extraction,
10 new domain events with idempotent handlers, intelligence snapshots,
TTL index declarations, and cron-friendly ops sync from snapshot.
"""
import os

os.environ["MONGODB_URI"] = "memory://test"

import asyncio  # noqa: E402

from app.core.events import Event, bus as global_bus  # noqa: E402
from app.db.mongodb import get_db, get_read_db  # noqa: E402
from app.services import challenges_service  # noqa: E402
from app.services import community  # noqa: E402
from app.services import ecosystem as eco  # noqa: E402
from app.services import creator, events_service, intelligence, marketplace, moderation  # noqa: E402
from app.services.event_handlers import register_default_handlers  # noqa: E402


def _await(coro):
    return asyncio.run(coro)


def _count(db, col, query):
    return _await(db[col].count_documents(query))


# ── NV1/NV2 — split regression ───────────────────────────────────────────────

def test_ecosystem_facade_reexports_public_api():
    """Facade exposes every legacy function as the same object from the split services."""
    pairs = [
        (eco.get_or_create_creator_profile, creator.get_or_create_creator_profile),
        (eco.request_creator_verification, creator.request_creator_verification),
        (eco.review_creator_verification, creator.review_creator_verification),
        (eco.compute_creator_trust, creator.compute_creator_trust),
        (eco.refresh_achievements, creator.refresh_achievements),
        (eco.get_creator_analytics, creator.get_creator_analytics),
        (eco.get_creator_leaderboard, creator.get_creator_leaderboard),
        (eco.create_collection, marketplace.create_collection),
        (eco.list_collections, marketplace.list_collections),
        (eco.bookmark_collection, marketplace.bookmark_collection),
        (eco.create_challenge_version, marketplace.create_challenge_version),
        (eco.get_challenge_versions, marketplace.get_challenge_versions),
        (eco.create_event, events_service.create_event),
        (eco.list_events, events_service.list_events),
        (eco.join_event, events_service.join_event),
        (eco.leave_event, events_service.leave_event),
        (eco.submit_report, moderation.submit_report),
        (eco.list_moderation_queue, moderation.list_moderation_queue),
        (eco.resolve_report, moderation.resolve_report),
        (eco.moderation_stats, moderation.moderation_stats),
        (eco.platform_intelligence, intelligence.platform_intelligence),
    ]
    for facade_fn, impl_fn in pairs:
        assert facade_fn is impl_fn, f"facade mismatch for {facade_fn.__name__}"
    # Public API surface preserved (functions + module-level constants)
    for name in eco.__all__:
        assert hasattr(eco, name), f"{name} missing on facade"
    for fn_name in [n for n in eco.__all__ if not n.isupper()]:
        assert callable(getattr(eco, fn_name)), f"{fn_name} not callable on facade"


def test_ecosystem_router_still_works():
    """Router call sites unchanged — endpoints keep working through the facade."""
    from fastapi.testclient import TestClient
    from app.main import app

    with TestClient(app) as client:
        res = client.post("/api/v1/auth/login", json={"email": "admin@ascendly.io", "password": "password"})
        assert res.status_code == 200, res.text
        token = res.json()["data"]["access_token"]
        headers = {"Authorization": f"Bearer {token}"}

        res = client.post("/api/v1/ecosystem/creators/verify/request", headers=headers,
                          json={"full_name": "Phase7", "expertise_area": "Python", "note": "ok"})
        assert res.status_code == 200, res.text

        res = client.get("/api/v1/ecosystem/creators/leaderboard?limit=5", headers=headers)
        assert res.status_code == 200, res.text
        assert "creators" in res.json()["data"]

        res = client.get("/api/v1/ecosystem/intelligence", headers=headers)
        assert res.status_code == 200, res.text
        assert "summary" in res.json()["data"]


def test_challenges_service_grade_submit_analyze():
    """Grading moved to challenges_service; community.py shims it."""
    assert community.submit_challenge is challenges_service.submit_challenge
    assert community.analyze_attempt is challenges_service.analyze_attempt
    assert community._grade_challenge is challenges_service._grade_challenge

    # _grade_challenge pure function
    ch = {"type": "theory", "content": {"correct": 2}}
    assert challenges_service._grade_challenge(ch, 2)["is_correct"] is True
    assert challenges_service._grade_challenge(ch, 1)["is_correct"] is False
    code = {"type": "coding", "content": {"expected_answer": "  def foo() "}}
    assert challenges_service._grade_challenge(code, "def foo(): pass")["is_correct"] is True

    # submit + analyze end-to-end
    db = get_db()
    _await(db.challenges.insert_one({
        "_id": "ch-p7-grade", "title": "Phase7 Grade", "type": "theory",
        "difficulty": "easy", "content": {"question": "Q", "options": ["a", "b"], "correct": 1},
        "explanation": "E", "skills": [], "skills_raw": [],
        "stats": {"attempts": 0, "completion_rate": 0.0, "avg_rating": 0.0, "bookmarks": 0},
        "creator_id": None, "status": "published",
        "created_at": "2026-08-01T00:00:00+00:00",
    }))
    res = _await(challenges_service.submit_challenge("p7-user", "ch-p7-grade", 1, time_seconds=10))
    assert res["is_correct"] is True
    assert res["score"] == 1.0
    analysis = _await(challenges_service.analyze_attempt(res["attempt_id"]))
    assert isinstance(analysis["weak_concepts"], list)
    assert isinstance(analysis["recommendations"], list)


# ── NV3 — event publish + handler idempotency ────────────────────────────────

def _count_notifs(user_id, ntype):
    db = get_db()
    return _count(db, "notifications", {"user_id": user_id, "type": ntype})


def _publish_twice(event, expect_published: int = 1):
    """Publish once with duplicate registration, then re-publish the same event."""
    global_bus.reset()
    register_default_handlers(global_bus)
    register_default_handlers(global_bus)  # simulate duplicate registration
    _await(global_bus.publish(event))
    # Re-publishing the identical event must be a bus-level no-op
    second = _await(global_bus.publish(event))
    assert second == 0
    assert global_bus.stats.get(event.name, {}).get("published", 0) == expect_published
    return global_bus.stats[event.name]["ok"]


def test_event_challenge_published_idempotent():
    db = get_db()
    _await(db.creator_profiles.insert_one({
        "_id": "cp-p7-creator", "user_id": "p7-creator",
        "followers": [{"user_id": "p7-fan", "since": "2026-08-01T00:00:00+00:00"}],
        "published_challenges": 1, "badges": [], "achievements": [],
    }))
    event = Event(name="ChallengePublished", producer="test", payload={
        "challenge_id": "ch-p7-1", "challenge_title": "P7", "creator_id": "p7-creator",
        "difficulty": "easy",
    })
    _publish_twice(event)
    assert _count_notifs("p7-fan", "creator_challenge_published") == 1


def test_event_creator_followed_idempotent():
    event = Event(name="CreatorFollowed", producer="test", payload={
        "creator_id": "p7-followed", "follower_id": "p7-follower",
    })
    _publish_twice(event)
    assert _count_notifs("p7-followed", "creator_new_follower") == 1


def test_event_creator_verified_idempotent():
    """Reserved handler — no duplicate side effects."""
    event = Event(name="CreatorVerified", producer="test", payload={
        "creator_id": "p7-verified", "reviewer_id": "p7-admin",
        "approved": True, "status": "verified", "note": "ok",
    })
    _publish_twice(event)
    # Producer (review_creator_verification) creates activity/notification directly;
    # the registered handler is a documented no-op, so nothing is duplicated.
    assert _count_notifs("p7-verified", "creator_verified") == 0


def test_event_rating_changed_idempotent():
    event = Event(name="RatingChanged", producer="test", payload={
        "challenge_id": "ch-p7-rate", "challenge_title": "P7", "creator_id": "p7-rated",
        "user_id": "p7-rater", "rating": 5, "avg_rating": 4.5,
    })
    _publish_twice(event)
    assert _count_notifs("p7-rated", "creator_rating_received") == 1


def test_event_certificate_issued_idempotent():
    event = Event(name="CertificateIssued", producer="test", payload={
        "certificate_id": "cert-p7-1", "user_id": "p7-learner",
        "course_id": "c-p7", "course_title": "SQL",
    })
    _publish_twice(event)
    assert _count_notifs("p7-learner", "certificate_issued") == 1


def test_event_report_submitted_idempotent():
    event = Event(name="ReportSubmitted", producer="test", payload={
        "report_id": "rep-p7-1", "reporter_id": "p7-reporter",
        "target_type": "challenge", "target_id": "ch-p7-x", "category": "spam",
    })
    _publish_twice(event)
    assert _count_notifs("user-admin@ascendly.io", "system_announcement") == 1


def test_event_moderation_completed_idempotent():
    event = Event(name="ModerationCompleted", producer="test", payload={
        "report_id": "rep-p7-2", "reporter_id": "p7-reporter2",
        "target_type": "challenge", "target_id": "ch-p7-y",
        "action": "remove", "status": "resolved", "reviewer_id": "p7-admin",
    })
    _publish_twice(event)
    assert _count_notifs("p7-reporter2", "system_announcement") == 1


def test_event_skill_mastered_idempotent():
    event = Event(name="SkillMastered", producer="test", payload={
        "user_id": "p7-master", "course_id": "c-p7", "concept_id": "con-p7", "mastery_score": 7.5,
    })
    _publish_twice(event)
    assert _count_notifs("p7-master", "skill_levelup") == 1


def test_event_user_registered_idempotent():
    event = Event(name="UserRegistered", producer="test", payload={
        "user_id": "p7-newuser", "email": "p7@x.io", "name": "P7",
    })
    _publish_twice(event)
    assert _count_notifs("p7-newuser", "welcome") == 1


def test_event_event_joined_idempotent():
    event = Event(name="EventJoined", producer="test", payload={
        "event_id": "evt-p7", "event_title": "P7", "host_id": "p7-host", "user_id": "p7-joiner",
    })
    _publish_twice(event)
    assert _count_notifs("p7-host", "event_attendee_joined") == 1


def test_event_catalog_contains_all_phase7_events():
    global_bus.reset()
    register_default_handlers(global_bus)
    names = {e["name"] for e in global_bus.catalog()}
    expected = {
        "ChallengeCompleted", "EventCreated",
        "ChallengePublished", "CreatorFollowed", "CreatorVerified", "RatingChanged",
        "CertificateIssued", "ReportSubmitted", "ModerationCompleted", "SkillMastered",
        "UserRegistered", "EventJoined",
    }
    assert expected.issubset(names)
    for entry in global_bus.catalog():
        assert entry["description"]
        assert entry["payload_schema"]
        assert entry["idempotency"]


# ── NV5 — intelligence snapshot ──────────────────────────────────────────────

def _clear_snapshots():
    _await(get_db()["intelligence_snapshots"].delete_many({}))


def test_intelligence_overview_falls_back_live_without_snapshot():
    _clear_snapshots()
    data = _await(intelligence.overview())
    assert "health" in data
    assert "recommendations" in data
    assert data.get("source") is None  # live computation (no snapshot yet)


def test_intelligence_snapshot_build_and_read():
    _clear_snapshots()
    built = _await(intelligence.build_intelligence_snapshot())
    assert "health" in built

    data = _await(intelligence.overview())
    assert data["source"] == "snapshot"
    assert data["snapshot_generated_at"]
    assert data["health"]["users_total"] == built["health"]["users_total"]

    # Rebuilding appends a newer snapshot; reads pick the newest.
    _await(intelligence.build_intelligence_snapshot())
    data2 = _await(intelligence.overview())
    assert data2["source"] == "snapshot"
    assert data2["snapshot_generated_at"] >= data["snapshot_generated_at"]


def test_intelligence_endpoint_reads_snapshot():
    from fastapi.testclient import TestClient
    from app.main import app

    _clear_snapshots()
    _await(intelligence.build_intelligence_snapshot())
    with TestClient(app) as client:
        res = client.post("/api/v1/auth/login", json={"email": "admin@ascendly.io", "password": "password"})
        assert res.status_code == 200, res.text
        token = res.json()["data"]["access_token"]
        headers = {"Authorization": f"Bearer {token}"}
        res = client.get("/api/v1/admin/intelligence/overview", headers=headers)
        assert res.status_code == 200, res.text
        data = res.json()["data"]
        assert data["source"] == "snapshot"
        assert "health" in data
    _clear_snapshots()


def test_ops_sync_from_snapshot_creates_tasks():
    from app.services import platform_ops as ops

    _clear_snapshots()
    db = get_db()
    _await(db["intelligence_snapshots"].insert_one({
        "_id": "snap-overview-seed",
        "type": "overview",
        "generated_at": "2026-08-02T00:00:00+00:00",
        "data": {
            "health": {"users_total": 0},
            "recommendations": [
                {"severity": "warning", "kind": "moderation-backlog", "entity_id": None,
                 "message": "5 reports pending."},
                {"severity": "info", "kind": "creator-verify", "entity_id": "u-x",
                 "message": "Creator u-x deserves review."},
            ],
            "urgent_problems": [],
            "growth_opportunities": [],
        },
    }))
    result = _await(ops.sync_from_intelligence_snapshot())
    assert result["created_count"] >= 2
    # Running again (same snapshot) deduplicates — no new tasks
    result2 = _await(ops.sync_from_intelligence_snapshot())
    assert result2["created_count"] == 0
    _clear_snapshots()


# ── NV5 — TTL index declarations ─────────────────────────────────────────────

def test_ttl_indexes_declared():
    from app.db import indexes as idx
    assert "activity_events" in idx.COLLECTION_INDEXES
    assert "notifications" in idx.COLLECTION_INDEXES
    assert "intelligence_snapshots" in idx.COLLECTION_INDEXES

    def _ttl(col):
        return {m.document["name"]: m.document.get("expireAfterSeconds")
                for m in idx.COLLECTION_INDEXES[col]}

    # Phase 8 (CO1): activity_events / notifications must NOT declare a TTL
    # index — their created_at is an ISO string, so MongoDB TTL would never
    # expire them; AI-B's retention cron owns cleanup instead. Plain non-TTL
    # indexes are kept for the created_at read paths.
    activity = _ttl("activity_events")
    assert activity.get("created_at_1_ttl") is None, activity
    assert all(v is None for v in activity.values()), activity
    notifications = _ttl("notifications")
    assert notifications.get("created_at_1_ttl") is None, notifications
    assert all(v is None for v in notifications.values()), notifications
    snapshots = _ttl("intelligence_snapshots")
    assert snapshots.get("expire_at_1_ttl") == 0  # absolute expiry on expire_at
    deliveries = _ttl("event_deliveries")
    assert deliveries.get("processed_at_1_ttl") == 30 * 24 * 3600  # 30 days
