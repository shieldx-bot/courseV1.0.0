"""Phase 3 — Proactive Support tests.

Covers:
- track_event persistence
- All four detectors (single + batch) returning signals
- run_proactive_support_checks invoking all 4 detections
- trigger_intervention: intervention + notification + email + 7-day dedupe
- User endpoint GET /support/interventions/active
- Admin stats + SLA-breaches endpoints
- Admin intervention summary endpoint
- Search no-click behavior tracking
"""

import os

os.environ["MONGODB_URI"] = "memory://test"

import asyncio
from datetime import datetime, timedelta, timezone
from unittest.mock import AsyncMock, patch

from fastapi.testclient import TestClient

from app.db.mongodb import seed_db
from app.main import app

# Ensure the seeded admin user (and other seed data) exists even when this
# module runs before any other test file opens the app. seed_db is idempotent,
# so it is a no-op when another module already seeded the shared DB.
asyncio.run(seed_db())


def _user_token(client, email="proactive@test.com"):
    res = client.post("/api/v1/auth/signup", json={"email": email, "password": "password123", "name": "Proactive User"})
    body = res.json()
    if "data" in body:
        body = body["data"]
    return body["access_token"]


def _admin_token(client):
    res = client.post("/api/v1/auth/login", json={"email": "admin@ascendly.io", "password": "password"})
    body = res.json()
    if "data" in body:
        body = body["data"]
    return body["access_token"]


def _iso(days_ago=0):
    return (datetime.now(timezone.utc) - timedelta(days=days_ago)).isoformat()


# ── Behavior event tracking ──────────────────────────────────────────────────


def test_track_event_stores_behavior_event():
    from app.db.mongodb import get_db
    from app.services.proactive_support import track_event

    async def _run():
        await track_event("u-events", "video_seek", metadata={"lesson_id": "sql-1"}, page="/learn")
        db = get_db()
        events = await db.user_behavior_events.find({"user_id": "u-events", "event_type": "video_seek"}).to_list(10)
        return events

    events = asyncio.run(_run())
    assert len(events) == 1
    assert events[0]["user_id"] == "u-events"
    assert events[0]["event_type"] == "video_seek"
    assert events[0]["metadata"]["lesson_id"] == "sql-1"
    assert events[0]["page"] == "/learn"
    assert events[0]["created_at"]


# ── Detectors ────────────────────────────────────────────────────────────────


def test_detect_video_rewatch_signal():
    from app.db.mongodb import get_db
    from app.services.proactive_support import detect_video_rewatch

    async def _run():
        db = get_db()
        for _ in range(3):
            await db.user_behavior_events.insert_one({
                "_id": f"bev-test-{datetime.now(timezone.utc).timestamp()}-{_}",
                "user_id": "u-rewatch",
                "event_type": "video_seek",
                "metadata": {"lesson_id": "sql-1", "section_seconds": 120},
                "page": None,
                "created_at": datetime.now(timezone.utc).isoformat(),
            })
        return await detect_video_rewatch("u-rewatch", "sql-1")

    signal = asyncio.run(_run())
    assert signal is not None
    assert signal["intervention_type"] == "video_rewatch"
    assert 120 in signal["sections"]
    assert signal["message"]


def test_detect_video_rewatch_batch_groups_by_user_lesson():
    from app.db.mongodb import get_db
    from app.services.proactive_support import detect_video_rewatch_batch

    async def _run():
        db = get_db()
        for i in range(3):
            await db.user_behavior_events.insert_one({
                "_id": f"bev-batch-{i}",
                "user_id": "u-batch",
                "event_type": "video_seek",
                "metadata": {"lesson_id": "sql-2", "section_seconds": 60},
                "page": None,
                "created_at": datetime.now(timezone.utc).isoformat(),
            })
        return await detect_video_rewatch_batch(db, user_ids=["u-batch"])

    signals = asyncio.run(_run())
    assert any(s["user_id"] == "u-batch" and s["lesson_id"] == "sql-2" for s in signals)


def test_detect_checkout_drop_signal():
    from app.db.mongodb import get_db
    from app.services.proactive_support import detect_checkout_drop

    async def _run():
        db = get_db()
        await db.user_behavior_events.insert_one({
            "_id": "bev-cod-1",
            "user_id": "u-cod",
            "event_type": "checkout_started",
            "metadata": {"tier_id": "tier-1mo"},
            "page": None,
            "created_at": datetime.now(timezone.utc).isoformat(),
        })
        return await detect_checkout_drop("u-cod")

    signal = asyncio.run(_run())
    assert signal is not None
    assert signal["intervention_type"] == "checkout_drop"


def test_detect_checkout_drop_none_when_completed():
    from app.db.mongodb import get_db
    from app.services.proactive_support import detect_checkout_drop

    async def _run():
        db = get_db()
        await db.user_behavior_events.insert_one({
            "_id": "bev-cod2-1",
            "user_id": "u-cod2",
            "event_type": "checkout_started",
            "metadata": {"tier_id": "tier-1mo"},
            "page": None,
            "created_at": datetime.now(timezone.utc).isoformat(),
        })
        await db.user_behavior_events.insert_one({
            "_id": "bev-cod2-2",
            "user_id": "u-cod2",
            "event_type": "checkout_completed",
            "metadata": {"order_id": "ord-1"},
            "page": None,
            "created_at": datetime.now(timezone.utc).isoformat(),
        })
        return await detect_checkout_drop("u-cod2")

    assert asyncio.run(_run()) is None


def test_detect_learning_stall_signal():
    from app.db.mongodb import get_db
    from app.services.proactive_support import detect_learning_stall

    async def _run():
        db = get_db()
        await db.users.update_one(
            {"_id": "u-stall"},
            {"$set": {"email": "stall@test.com", "last_active_at": _iso(days_ago=4)}},
            upsert=True,
        )
        return await detect_learning_stall("u-stall")

    signal = asyncio.run(_run())
    assert signal is not None
    assert signal["intervention_type"] == "learning_stall"


def test_detect_quiz_low_score_batch_signal():
    from app.db.mongodb import get_db
    from app.services.proactive_support import detect_quiz_low_score_batch

    async def _run():
        db = get_db()
        await db.quiz_attempts.insert_one({
            "_id": "qa-low-1",
            "user_id": "u-quiz",
            "course_id": "course-sql",
            "lesson_id": "sql-1",
            "score": 2,
            "total_questions": 5,
            "score_pct": 40.0,
            "created_at": datetime.now(timezone.utc).isoformat(),
        })
        return await detect_quiz_low_score_batch(db, user_ids=["u-quiz"])

    signals = asyncio.run(_run())
    assert len(signals) == 1
    assert signals[0]["intervention_type"] == "quiz_low_score"
    assert signals[0]["score_pct"] == 40.0


def test_detect_quiz_low_score_batch_ignores_pass():
    from app.db.mongodb import get_db
    from app.services.proactive_support import detect_quiz_low_score_batch

    async def _run():
        db = get_db()
        await db.quiz_attempts.insert_one({
            "_id": "qa-high-1",
            "user_id": "u-quiz-pass",
            "course_id": "course-sql",
            "score_pct": 90.0,
            "created_at": datetime.now(timezone.utc).isoformat(),
        })
        return await detect_quiz_low_score_batch(db, user_ids=["u-quiz-pass"])

    assert asyncio.run(_run()) == []


# ── Scheduled job ────────────────────────────────────────────────────────────


def test_run_proactive_support_checks_invokes_all_four_detects():
    import app.core.tasks as tasks_module
    from app.core.tasks import run_proactive_support_checks

    signals = [
        {"user_id": "u-job", "intervention_type": "learning_stall", "message": "m1"},
        {"user_id": "u-job", "intervention_type": "video_rewatch", "lesson_id": "sql-1", "message": "m2"},
        {"user_id": "u-job", "intervention_type": "checkout_drop", "message": "m3"},
        {"user_id": "u-job", "intervention_type": "quiz_low_score", "score_pct": 30.0, "message": "m4"},
    ]
    mocks = {}
    for name in ("detect_learning_stall_batch", "detect_video_rewatch_batch",
                 "detect_checkout_drop_batch", "detect_quiz_low_score_batch"):
        mocks[name] = AsyncMock(return_value=[])
    mocks["detect_learning_stall_batch"].return_value = [signals[0]]
    mocks["detect_video_rewatch_batch"].return_value = [signals[1]]
    mocks["detect_checkout_drop_batch"].return_value = [signals[2]]
    mocks["detect_quiz_low_score_batch"].return_value = [signals[3]]
    mocks["trigger"] = AsyncMock(return_value={"_id": "intv-x"})

    async def _run():
        with patch.object(tasks_module, "detect_learning_stall_batch", mocks["detect_learning_stall_batch"]), \
             patch.object(tasks_module, "detect_video_rewatch_batch", mocks["detect_video_rewatch_batch"]), \
             patch.object(tasks_module, "detect_checkout_drop_batch", mocks["detect_checkout_drop_batch"]), \
             patch.object(tasks_module, "detect_quiz_low_score_batch", mocks["detect_quiz_low_score_batch"]), \
             patch.object(tasks_module, "trigger_intervention", mocks["trigger"]):
            return await run_proactive_support_checks({})

    result = asyncio.run(_run())
    assert result["signals"] == 4
    assert result["triggered"] == 4
    assert result["by_type"] == {
        "learning_stall": 1, "video_rewatch": 1, "checkout_drop": 1, "quiz_low_score": 1,
    }
    for name in ("detect_learning_stall_batch", "detect_video_rewatch_batch",
                 "detect_checkout_drop_batch", "detect_quiz_low_score_batch"):
        mocks[name].assert_awaited()
    assert mocks["trigger"].await_count == 4


# ── Intervention trigger ─────────────────────────────────────────────────────


def test_trigger_intervention_creates_intervention_notification_and_email():
    from app.db.mongodb import get_db
    from app.services.proactive_support import trigger_intervention

    async def _run():
        db = get_db()
        await db.users.update_one(
            {"_id": "u-trigger"},
            {"$set": {"email": "trigger@test.com", "name": "Trigger"}},
            upsert=True,
        )
        with patch("app.services.email.send_proactive_help") as mock_email:
            doc = await trigger_intervention("u-trigger", "learning_stall", context={"days": 4})
        interventions = await db.interventions.find({"user_id": "u-trigger"}).to_list(10)
        notifications = await db.notifications.find({"user_id": "u-trigger"}).to_list(10)
        return doc, interventions, notifications, mock_email

    doc, interventions, notifications, mock_email = asyncio.run(_run())
    assert doc is not None
    assert doc["intervention_type"] == "learning_stall"
    assert doc["status"] == "active"
    assert doc["context"] == {"days": 4}
    assert doc["email_sent"] is True
    assert len(interventions) == 1
    assert len(notifications) == 1
    assert notifications[0]["type"] == "learning_stall"
    mock_email.assert_called_once()


def test_trigger_intervention_dedupe_7_days():
    from app.db.mongodb import get_db
    from app.services.proactive_support import trigger_intervention

    async def _run():
        db = get_db()
        await db.users.update_one(
            {"_id": "u-dedupe"},
            {"$set": {"email": "dedupe@test.com"}},
            upsert=True,
        )
        with patch("app.services.email.send_proactive_help"):
            first = await trigger_intervention("u-dedupe", "learning_stall")
            second = await trigger_intervention("u-dedupe", "learning_stall")
        count = await db.interventions.count_documents({"user_id": "u-dedupe"})
        return first, second, count

    first, second, count = asyncio.run(_run())
    assert first is not None
    assert second is None
    assert count == 1


# ── API endpoints ────────────────────────────────────────────────────────────


def test_get_support_interventions_active_endpoint():
    from app.db.mongodb import get_db
    from app.services.proactive_support import trigger_intervention

    with TestClient(app) as client:
        token = _user_token(client, email="act-intv@test.com")
        headers = {"Authorization": f"Bearer {token}"}

        # Auth stores users under _id = f"user-{email}", so the authenticated
        # user id is "user-act-intv@test.com".
        async def _seed():
            db = get_db()
            await db.users.update_one(
                {"_id": "user-act-intv@test.com"},
                {"$set": {"email": "act-intv@test.com"}},
                upsert=True,
            )
            await trigger_intervention("user-act-intv@test.com", "video_rewatch", context={"lesson_id": "sql-1"})

        asyncio.run(_seed())

        res = client.get("/api/v1/support/interventions/active", headers=headers)
        assert res.status_code == 200
        data = res.json()["data"]
        assert any(i["type"] == "video_rewatch" for i in data)
        assert all(i["type"] in ("video_rewatch", "checkout_drop", "learning_stall", "quiz_low_score") for i in data)


def test_admin_stats_endpoint_shape():
    with TestClient(app) as client:
        headers = {"Authorization": f"Bearer {_admin_token(client)}"}
        res = client.get("/api/v1/admin/support/stats", headers=headers)
        assert res.status_code == 200
        stats = res.json()["data"]
        assert stats["total"] >= 0
        for key in ("by_status", "by_category", "by_priority", "avg_resolution_hours", "avg_satisfaction_rating"):
            assert key in stats


def test_admin_sla_breaches_endpoint():
    from app.db.mongodb import get_db

    with TestClient(app) as client:
        headers = {"Authorization": f"Bearer {_admin_token(client)}"}

        async def _seed():
            db = get_db()
            old = (datetime.now(timezone.utc) - timedelta(hours=48)).isoformat()
            await db.support_tickets.update_one(
                {"_id": "tkt-sla-endpoint"},
                {"$set": {
                    "user_id": "u-sla", "user_email": "sla@test.com", "user_name": "SLA",
                    "subject": "Overdue", "message": "urgent", "category": "technical",
                    "priority": "P1", "status": "open", "created_at": old,
                    "updated_at": old, "resolved_at": None, "assigned_to": None,
                    "satisfaction_rating": None, "ai_summary": "",
                }},
                upsert=True,
            )

        asyncio.run(_seed())
        res = client.get("/api/v1/admin/support/sla-breaches", headers=headers)
        assert res.status_code == 200
        breaches = res.json()["data"]
        assert any(b["ticket_id"] == "tkt-sla-endpoint" for b in breaches)


def test_admin_intervention_summary_endpoint():
    from app.db.mongodb import get_db
    from app.services.proactive_support import trigger_intervention

    with TestClient(app) as client:
        headers = {"Authorization": f"Bearer {_admin_token(client)}"}

        async def _seed():
            db = get_db()
            await db.users.update_one(
                {"_id": "summary-user@test.com"},
                {"$set": {"email": "summary-user@test.com"}},
                upsert=True,
            )
            with patch("app.services.email.send_proactive_help"):
                await trigger_intervention("summary-user@test.com", "learning_stall")

        asyncio.run(_seed())
        res = client.get("/api/v1/admin/proactive/interventions/summary", headers=headers)
        assert res.status_code == 200
        summary = res.json()["data"]
        assert summary["total"] >= 1
        assert summary["by_type"].get("learning_stall", 0) >= 1
        assert "active" in summary["by_status"]


def test_admin_regular_user_forbidden_on_sla_breaches():
    with TestClient(app) as client:
        user_headers = {"Authorization": f"Bearer {_user_token(client, email='not-admin@test.com')}"}
        res = client.get("/api/v1/admin/support/sla-breaches", headers=user_headers)
        assert res.status_code == 403


# ── Search no-click tracking (fallback path, no Meilisearch in tests) ────────


def test_search_no_click_tracked_for_zero_results():
    from app.db.mongodb import get_db

    with TestClient(app) as client:
        token = _user_token(client, email="search-nc@test.com")
        headers = {"Authorization": f"Bearer {token}"}

        res = client.get("/api/v1/courses?search=zzzz_nothing_matches_12345", headers=headers)
        assert res.status_code == 200
        assert res.json()["data"] == []

        async def _check():
            db = get_db()
            events = await db.user_behavior_events.find({
                "user_id": "user-search-nc@test.com",
                "event_type": "search_no_click",
            }).to_list(10)
            return events

        events = asyncio.run(_check())
        assert len(events) >= 1
        assert events[0]["metadata"]["query"] == "zzzz_nothing_matches_12345"
