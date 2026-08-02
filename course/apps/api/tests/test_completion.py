"""Completion pass — A1 analytics, A2 remedial_content refresh, A3 focus_concepts.

Covers:
- A1: ``remediation_effectiveness`` aggregation from ``quiz_attempts.concept_results``
  (improved_pct / avg_mastery_delta / avg_gap_resolution_days / by_concept),
  ``window_days`` filtering, empty-window zero shape, and the admin HTTP
  endpoint (require_admin + envelope) the Grafana panel will connect to.
- A2: ``flush_remedial_content`` (persisted docs + Redis keys) and the admin
  ``POST /admin/adaptive/remediation/flush/{concept_id}`` endpoint; concept
  edits invalidate stale content automatically (Cách A refresh policy).
- A3: additive ``focus_concepts`` field on the AI Tutor response (drives the
  AI-C "Focus:" hint), weak -> concept names, mastered -> [].
"""

import asyncio
import os
from datetime import datetime, timedelta, timezone

os.environ["MONGODB_URI"] = "memory://test"

import pytest

from app.db.mongodb import get_db


def _now():
    return datetime.now(timezone.utc).isoformat()


def _days_ago(days):
    return (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()


def _user_token(client, email):
    res = client.post(
        "/api/v1/auth/signup",
        json={"email": email, "password": "password123", "name": "Completion User"},
    )
    body = res.json()
    if "data" in body:
        body = body["data"]
    return body["access_token"]


def _admin_headers(client):
    res = client.post(
        "/api/v1/auth/login", json={"email": "admin@ascendly.io", "password": "password"}
    )
    return {"Authorization": f"Bearer {res.json()['data']['access_token']}"}


# ── A1: remediation effectiveness analytics ──────────────────────────────────


def test_remediation_effectiveness_metrics_from_quiz_attempts():
    from app.services.analytics import remediation_effectiveness

    async def _run():
        db = get_db()
        cid = "course-ana-metrics"
        await db.quiz_attempts.insert_many([
            {
                "_id": "qa-ana-1",
                "user_id": "user-ana-1",
                "course_id": cid,
                "created_at": _days_ago(2),
                "concept_results": [
                    {"concept_id": "conc-a", "concept_name": "Concept A",
                     "mastery_before": 2.0, "mastery_after": 2.5, "mastery_delta": 0.5},
                ],
            },
            {
                "_id": "qa-ana-2",
                "user_id": "user-ana-1",
                "course_id": cid,
                "created_at": _now(),
                "concept_results": [
                    {"concept_id": "conc-a", "concept_name": "Concept A",
                     "mastery_before": 2.5, "mastery_after": 5.0, "mastery_delta": 2.5},
                    {"concept_id": "conc-b", "concept_name": "Concept B",
                     "mastery_before": 4.0, "mastery_after": 4.5, "mastery_delta": 0.5},
                ],
            },
            {
                "_id": "qa-ana-3",
                "user_id": "user-ana-2",
                "course_id": cid,
                "created_at": _now(),
                "concept_results": [
                    {"concept_id": "conc-a", "concept_name": "Concept A",
                     "mastery_before": 2.0, "mastery_after": 1.7, "mastery_delta": -0.3},
                ],
            },
        ])
        return await remediation_effectiveness(window_days=30, course_id=cid)

    result = asyncio.run(_run())
    assert result["total_users"] == 2
    # user-ana-1 avg +1.17 (improved), user-ana-2 avg -0.3 (not) -> 1/2.
    assert result["improved_pct"] == 50.0
    assert result["avg_mastery_delta"] == pytest.approx(0.8)
    # Weak at -2d (2.0), crossed the weak threshold (>=3.0) today.
    assert result["avg_gap_resolution_days"] == 2.0
    assert result["course_id"] == "course-ana-metrics"
    assert result["window_days"] == 30

    by_concept = {c["concept_id"]: c for c in result["by_concept"]}
    assert set(by_concept) == {"conc-a", "conc-b"}
    assert by_concept["conc-a"]["weak_events"] == 3
    assert by_concept["conc-a"]["avg_mastery_delta"] == pytest.approx(0.9)
    assert by_concept["conc-b"]["weak_events"] == 0
    # Most-weak concept first for the dashboard.
    assert result["by_concept"][0]["concept_id"] == "conc-a"


def test_remediation_effectiveness_window_filters_old_attempts():
    from app.services.analytics import remediation_effectiveness

    async def _run():
        db = get_db()
        cid = "course-ana-window"
        await db.quiz_attempts.insert_many([
            {
                "_id": "qa-win-fresh",
                "user_id": "user-win-1",
                "course_id": cid,
                "created_at": _now(),
                "concept_results": [
                    {"concept_id": "conc-x", "concept_name": "X",
                     "mastery_before": 2.0, "mastery_after": 3.0, "mastery_delta": 1.0},
                ],
            },
            {
                "_id": "qa-win-old",
                "user_id": "user-win-2",
                "course_id": cid,
                "created_at": _days_ago(90),
                "concept_results": [
                    {"concept_id": "conc-x", "concept_name": "X",
                     "mastery_before": 1.0, "mastery_after": 9.0, "mastery_delta": 8.0},
                ],
            },
        ])
        return await remediation_effectiveness(window_days=30, course_id=cid)

    result = asyncio.run(_run())
    assert result["total_users"] == 1, "attempt older than window_days must be excluded"
    assert result["avg_mastery_delta"] == pytest.approx(1.0)
    assert result["improved_pct"] == 100.0


def test_remediation_effectiveness_empty_window_zero_shape():
    from app.services.analytics import remediation_effectiveness

    result = asyncio.run(
        remediation_effectiveness(window_days=30, course_id="course-ana-empty")
    )
    assert result["total_users"] == 0
    assert result["improved_pct"] == 0.0
    assert result["avg_mastery_delta"] == 0.0
    assert result["avg_gap_resolution_days"] == 0.0
    assert result["by_concept"] == []


def test_remediation_effectiveness_endpoint_requires_admin():
    from fastapi.testclient import TestClient

    from app.main import app

    with TestClient(app) as client:
        token = _user_token(client, "ana-403@test.com")
        headers = {"Authorization": f"Bearer {token}"}
        res = client.get(
            "/api/v1/admin/adaptive/analytics/remediation-effectiveness", headers=headers
        )
        assert res.status_code == 403


def test_remediation_effectiveness_endpoint_returns_envelope():
    from fastapi.testclient import TestClient

    from app.main import app

    async def _seed():
        db = get_db()
        cid = "course-ana-http"
        await db.quiz_attempts.insert_one({
            "_id": "qa-http-1",
            "user_id": "user-http-1",
            "course_id": cid,
            "created_at": _now(),
            "concept_results": [
                {"concept_id": "conc-h", "concept_name": "H",
                 "mastery_before": 2.0, "mastery_after": 4.0, "mastery_delta": 2.0},
            ],
        })

    asyncio.run(_seed())
    with TestClient(app) as client:
        headers = _admin_headers(client)
        res = client.get(
            "/api/v1/admin/adaptive/analytics/remediation-effectiveness"
            "?window_days=30&course_id=course-ana-http",
            headers=headers,
        )
        assert res.status_code == 200, res.text
        body = res.json()
        assert body["success"] is True
        assert body["error"] is None
        data = body["data"]
        assert data["total_users"] == 1
        assert data["improved_pct"] == 100.0
        assert isinstance(data["by_concept"], list)


# ── A2: remedial_content refresh (flush, Cách A) ─────────────────────────────


def test_flush_remedial_content_deletes_persisted_docs():
    from app.services.remediation import flush_remedial_content

    async def _run():
        db = get_db()
        now = _now()
        concept_id = "conc-flush-1"
        await db.remedial_content.insert_many([
            {"_id": "rc-flush1-aaa", "course_id": "course-flush", "concept_id": concept_id,
             "content_hash": "aaa", "content": {"concept_id": concept_id},
             "created_at": now, "updated_at": now},
            {"_id": "rc-flush1-bbb", "course_id": "course-flush", "concept_id": concept_id,
             "content_hash": "bbb", "content": {"concept_id": concept_id},
             "created_at": now, "updated_at": now},
        ])
        result = await flush_remedial_content(concept_id, "course-flush")
        remaining = await db.remedial_content.find({"concept_id": concept_id}).to_list(10)
        return result, remaining

    result, remaining = asyncio.run(_run())
    assert result["flushed"] is True
    assert result["deleted"] == 2
    assert result["concept_id"] == "conc-flush-1"
    assert remaining == []


def test_flush_remedial_content_course_scoped():
    from app.services.remediation import flush_remedial_content

    async def _run():
        db = get_db()
        now = _now()
        concept_id = "conc-flush-scope"
        await db.remedial_content.insert_many([
            {"_id": "rc-scope-aaa", "course_id": "course-scope-a", "concept_id": concept_id,
             "content_hash": "aaa", "content": {}, "created_at": now, "updated_at": now},
            {"_id": "rc-scope-bbb", "course_id": "course-scope-b", "concept_id": concept_id,
             "content_hash": "bbb", "content": {}, "created_at": now, "updated_at": now},
        ])
        result = await flush_remedial_content(concept_id, "course-scope-a")
        remaining = await db.remedial_content.find({"concept_id": concept_id}).to_list(10)
        return result, remaining

    result, remaining = asyncio.run(_run())
    assert result["deleted"] == 1
    assert len(remaining) == 1
    assert remaining[0]["course_id"] == "course-scope-b"


def test_flush_endpoint_invalidates_content_and_regenerates():
    from fastapi.testclient import TestClient

    from app.main import app

    async def _seed():
        db = get_db()
        now = _now()
        cid = "course-flush-http"
        concept_id = "conc-flush-http"
        await db.concept_definitions.insert_one({
            "_id": concept_id, "course_id": cid, "name": "Flush Concept",
            "slug": "flush", "description": "d", "difficulty_base": 5,
            "is_active": True, "lesson_ids": ["l1"], "prerequisite_concepts": [],
        })
        await db.remedial_content.insert_one({
            "_id": "rc-flush-http-old", "course_id": cid, "concept_id": concept_id,
            "content_hash": "old", "created_at": now, "updated_at": now,
            "content": {"concept_id": concept_id, "explanation": "stale"},
        })
        return concept_id, cid

    concept_id, cid = asyncio.run(_seed())

    async def _remaining():
        return await get_db().remedial_content.find({"concept_id": concept_id}).to_list(10)

    with TestClient(app) as client:
        headers = _admin_headers(client)
        res = client.post(f"/api/v1/admin/adaptive/remediation/flush/{concept_id}", headers=headers)
        assert res.status_code == 200, res.text
        data = res.json()["data"]
        assert data["flushed"] is True
        assert data["deleted"] == 1
        assert asyncio.run(_remaining()) == []

        # The next content request regenerates fresh content for the concept.
        user_token = _user_token(client, "flush-user@test.com")
        uheaders = {"Authorization": f"Bearer {user_token}"}
        res = client.post(
            f"/api/v1/adaptive/remediation/{cid}/content/{concept_id}", headers=uheaders
        )
        assert res.status_code == 200, res.text
        assert res.json()["data"]["concept_id"] == concept_id
        assert len(asyncio.run(_remaining())) == 1


def test_concept_update_flushes_stale_remedial_content():
    from fastapi.testclient import TestClient

    from app.main import app

    async def _seed():
        db = get_db()
        now = _now()
        cid = "course-flush-update"
        concept_id = "conc-flush-update"
        await db.concept_definitions.insert_one({
            "_id": concept_id, "course_id": cid, "name": "Old Name",
            "slug": "old-name", "description": "d", "difficulty_base": 5,
            "is_active": True, "lesson_ids": ["l1"], "prerequisite_concepts": [],
        })
        await db.remedial_content.insert_one({
            "_id": "rc-update-old", "course_id": cid, "concept_id": concept_id,
            "content_hash": "old", "created_at": now, "updated_at": now,
            "content": {"concept_id": concept_id, "explanation": "stale"},
        })
        return concept_id

    concept_id = asyncio.run(_seed())

    async def _remaining():
        return await get_db().remedial_content.find({"concept_id": concept_id}).to_list(10)

    with TestClient(app) as client:
        headers = _admin_headers(client)
        res = client.put(
            f"/api/v1/admin/adaptive/concepts/{concept_id}",
            json={"name": "New Name"},
            headers=headers,
        )
        assert res.status_code == 200, res.text
        assert asyncio.run(_remaining()) == [], "concept edit must flush stale content"


# ── A3: AI Tutor focus_concepts (additive) ───────────────────────────────────


def _seed_tutor_weak_mastery(uid):
    async def _run():
        db = get_db()
        now = _now()
        if not await db.concept_definitions.find_one({"_id": "conc-course-sql-select-from"}):
            await db.concept_definitions.insert_one({
                "_id": "conc-course-sql-select-from", "course_id": "course-sql",
                "name": "SELECT & FROM", "slug": "select-and-from",
                "description": "sql-1 concept", "difficulty_base": 2,
                "lesson_ids": ["sql-1"], "prerequisite_concepts": [],
                "is_active": True, "created_at": now, "updated_at": now,
            })
        if not await db.concept_mastery.find_one({"_id": f"mast-{uid}-conc-course-sql-select-from"}):
            await db.concept_mastery.insert_one({
                "_id": f"mast-{uid}-conc-course-sql-select-from", "user_id": uid,
                "course_id": "course-sql", "concept_id": "conc-course-sql-select-from",
                "mastery_score": 2.0, "attempts": 3, "correct_attempts": 1,
                "trend": "declining", "last_practiced_at": None,
                "created_at": now, "updated_at": now,
            })

    asyncio.run(_run())


def test_ai_tutor_endpoint_returns_focus_concepts_for_weak_user():
    from fastapi.testclient import TestClient

    from app.main import app

    with TestClient(app) as client:
        token = _user_token(client, "tutor-focus@test.com")
        headers = {"Authorization": f"Bearer {token}"}
        _seed_tutor_weak_mastery("user-tutor-focus@test.com")

        res = client.post(
            "/api/v1/courses/course-sql/lessons/sql-1/ai-tutor/ask",
            json={"question": "What is SELECT?"},
            headers=headers,
        )
        assert res.status_code == 200, res.text
        data = res.json()["data"]
        assert data["focus_concepts"] == ["SELECT & FROM"]
        assert set(data) >= {"answer", "session_id", "message_count", "focus_concepts"}


def test_ai_tutor_endpoint_empty_focus_concepts_for_mastered_user():
    from fastapi.testclient import TestClient

    from app.main import app

    with TestClient(app) as client:
        token = _user_token(client, "tutor-strong@test.com")
        headers = {"Authorization": f"Bearer {token}"}
        # Cold start (no mastery rows) -> no weak concepts -> empty focus list.
        res = client.post(
            "/api/v1/courses/course-sql/lessons/sql-1/ai-tutor/ask",
            json={"question": "What is SELECT?"},
            headers=headers,
        )
        assert res.status_code == 200, res.text
        data = res.json()["data"]
        assert data["focus_concepts"] == []
        assert "answer" in data
