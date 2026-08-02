"""Phase 6 — Remediation + AI Tutor + Dynamic Sequencing tests.

Covers:
- NV2: ``get_recommended_remediation`` priority ordering (prereq first, then
  severity), cross-user ``remedial_content`` reuse, micro-exercise submit
  (mastery update + M7), feedback (M6 + activity event).
- NV3: ``POST /adaptive/skip`` returns additive ``updated_sequence``.
- NV1: AI Tutor weak-concept context injection (response shape unchanged).
- NV4: M6/M7 series exposed on /metrics.
"""

import asyncio
import os
from datetime import datetime, timezone

os.environ["MONGODB_URI"] = "memory://test"

from app.db.mongodb import get_db


def _now():
    return datetime.now(timezone.utc).isoformat()


def _user_token(client, email):
    res = client.post(
        "/api/v1/auth/signup",
        json={"email": email, "password": "password123", "name": "Phase6 User"},
    )
    body = res.json()
    if "data" in body:
        body = body["data"]
    return body["access_token"]


# ── NV2: get_recommended_remediation ordering ────────────────────────────────


def test_get_recommended_remediation_prereq_before_severity():
    from app.services.remediation import get_recommended_remediation

    async def _run():
        db = get_db()
        uid, cid = "user-reco-1", "course-reco"
        await db.concept_definitions.insert_many([
            {"_id": "conc-reco-a", "course_id": cid, "name": "Prereq A", "slug": "prereq-a",
             "is_active": True, "lesson_ids": ["l1"], "prerequisite_concepts": []},
            {"_id": "conc-reco-b", "course_id": cid, "name": "Dependent B", "slug": "dependent-b",
             "is_active": True, "lesson_ids": ["l2"], "prerequisite_concepts": ["conc-reco-a"]},
            {"_id": "conc-reco-c", "course_id": cid, "name": "Severe C", "slug": "severe-c",
             "is_active": True, "lesson_ids": ["l3"], "prerequisite_concepts": []},
            {"_id": "conc-reco-d", "course_id": cid, "name": "Prereq D", "slug": "prereq-d",
             "is_active": True, "lesson_ids": ["l4"], "prerequisite_concepts": []},
            {"_id": "conc-reco-e", "course_id": cid, "name": "Dependent E", "slug": "dependent-e",
             "is_active": True, "lesson_ids": ["l5"], "prerequisite_concepts": ["conc-reco-d"]},
        ])
        now = _now()
        await db.concept_mastery.insert_many([
            {"_id": f"mast-{uid}-conc-reco-a", "user_id": uid, "course_id": cid,
             "concept_id": "conc-reco-a", "mastery_score": 2.5, "attempts": 3,
             "correct_attempts": 1, "trend": "declining", "last_practiced_at": None,
             "created_at": now, "updated_at": now},
            {"_id": f"mast-{uid}-conc-reco-b", "user_id": uid, "course_id": cid,
             "concept_id": "conc-reco-b", "mastery_score": 2.0, "attempts": 3,
             "correct_attempts": 1, "trend": "declining", "last_practiced_at": None,
             "created_at": now, "updated_at": now},
            {"_id": f"mast-{uid}-conc-reco-c", "user_id": uid, "course_id": cid,
             "concept_id": "conc-reco-c", "mastery_score": 1.5, "attempts": 3,
             "correct_attempts": 1, "trend": "declining", "last_practiced_at": None,
             "created_at": now, "updated_at": now},
            {"_id": f"mast-{uid}-conc-reco-d", "user_id": uid, "course_id": cid,
             "concept_id": "conc-reco-d", "mastery_score": 3.5, "attempts": 3,
             "correct_attempts": 1, "trend": "stable", "last_practiced_at": None,
             "created_at": now, "updated_at": now},
        ])
        return await get_recommended_remediation(uid, cid)

    queue = asyncio.run(_run())
    ids = [q["concept_id"] for q in queue]
    assert ids == ["conc-reco-a", "conc-reco-d", "conc-reco-c", "conc-reco-b"]

    by_id = {q["concept_id"]: q for q in queue}
    assert by_id["conc-reco-a"]["priority"] == 1, "prereq gap must be priority 1"
    assert by_id["conc-reco-d"]["priority"] == 1
    assert by_id["conc-reco-c"]["priority"] == 2
    assert by_id["conc-reco-b"]["priority"] == 2
    assert by_id["conc-reco-a"]["lesson_ids"] == ["l1"]
    assert by_id["conc-reco-a"]["concept_name"] == "Prereq A"
    assert "suggestion" in by_id["conc-reco-a"]
    assert by_id["conc-reco-c"]["mastery_score"] == 1.5


def test_get_recommended_remediation_empty_when_no_gaps():
    from app.services.remediation import get_recommended_remediation

    async def _run():
        db = get_db()
        uid, cid = "user-reco-empty", "course-reco-empty"
        now = _now()
        await db.concept_definitions.insert_one({
            "_id": "conc-ok", "course_id": cid, "name": "OK", "slug": "ok",
            "is_active": True, "lesson_ids": ["l1"], "prerequisite_concepts": [],
        })
        await db.concept_mastery.insert_one({
            "_id": f"mast-{uid}-conc-ok", "user_id": uid, "course_id": cid,
            "concept_id": "conc-ok", "mastery_score": 8.0, "attempts": 5,
            "correct_attempts": 4, "trend": "improving", "last_practiced_at": None,
            "created_at": now, "updated_at": now,
        })
        return await get_recommended_remediation(uid, cid)

    assert asyncio.run(_run()) == []


# ── NV2: cross-user remedial content reuse ───────────────────────────────────


def test_remedial_content_reused_across_users():
    import json
    from unittest.mock import patch

    from app.services import remediation as rem

    calls = {"n": 0}
    canned = json.dumps({
        "explanation": "Simplified explanation",
        "exercise": {"questions": [
            {"question": "Q1?", "options": ["a", "b", "c", "d"], "correct": 0, "explanation": "e"},
            {"question": "Q2?", "options": ["a", "b", "c", "d"], "correct": 1, "explanation": "e"},
        ]},
        "analogies": ["like a bridge"],
    })

    async def fake_call_llm(messages, **kwargs):
        calls["n"] += 1
        return canned

    async def _run():
        db = get_db()
        cid = "course-reuse"
        await db.concept_definitions.insert_one({
            "_id": "conc-reuse", "course_id": cid, "name": "Reuse Concept",
            "slug": "reuse", "description": "desc", "is_active": True,
            "lesson_ids": ["l1"], "prerequisite_concepts": [],
        })
        first = await rem.generate_remedial_content("user-reuse-1", cid, "conc-reuse")
        second = await rem.generate_remedial_content("user-reuse-2", cid, "conc-reuse")
        return first, second, calls["n"]

    with patch.object(rem, "is_llm_available", return_value=True), \
         patch.object(rem, "call_llm", side_effect=fake_call_llm):
        first, second, total_calls = asyncio.run(_run())

    assert first["generated"] is True
    assert first["concept_id"] == "conc-reuse"
    assert second["explanation"] == "Simplified explanation"
    assert total_calls == 1, "second user must reuse persisted content without calling the LLM"


# ── NV2: micro-exercise submit ───────────────────────────────────────────────


async def _seed_exercise(db, uid, cid, concept_id, mastery=5.0):
    now = _now()
    await db.concept_definitions.insert_one({
        "_id": concept_id, "course_id": cid, "name": "Exercise Concept",
        "slug": "ex", "description": "d", "difficulty_base": 5, "is_active": True,
        "lesson_ids": ["l1"], "prerequisite_concepts": [],
    })
    await db.concept_mastery.insert_one({
        "_id": f"mast-{uid}-{concept_id}", "user_id": uid, "course_id": cid,
        "concept_id": concept_id, "mastery_score": mastery, "attempts": 1,
        "correct_attempts": 0, "trend": "stable", "last_practiced_at": None,
        "created_at": now, "updated_at": now,
    })
    await db.remedial_content.insert_one({
        "_id": f"rc-{concept_id}-abc", "course_id": cid, "concept_id": concept_id,
        "content_hash": "abc", "created_at": now, "updated_at": now,
        "content": {
            "concept_id": concept_id, "concept_name": "Exercise Concept",
            "explanation": "x", "analogies": [],
            "exercise": {"questions": [
                {"question": "Q1?", "options": ["a", "b", "c", "d"], "correct": 0, "explanation": "e"},
                {"question": "Q2?", "options": ["a", "b", "c", "d"], "correct": 1, "explanation": "e"},
            ]},
        },
    })


def test_exercise_submit_updates_mastery_and_m7():
    from app.core.telemetry import ADAPTIVE_REMEDIATION_EXERCISE_SUBMITTED
    from app.services.remediation import submit_remedial_exercise

    async def _run():
        db = get_db()
        uid, cid, concept_id = "user-ex-1", "course-ex", "conc-ex"
        await _seed_exercise(db, uid, cid, concept_id)
        before = ADAPTIVE_REMEDIATION_EXERCISE_SUBMITTED.labels(
            concept_id=concept_id, passed="true")._value.get()
        result = await submit_remedial_exercise(uid, cid, concept_id, {0: 0, 1: 1})
        after = ADAPTIVE_REMEDIATION_EXERCISE_SUBMITTED.labels(
            concept_id=concept_id, passed="true")._value.get()
        return result, before, after

    result, before, after = asyncio.run(_run())
    assert result["correct_count"] == 2
    assert result["total"] == 2
    assert result["mastery_after"] > result["mastery_before"]
    assert result["passed"] is True
    assert after == before + 1, "M7 must increment on exercise submit"


def test_exercise_submit_wrong_answers_decreases_mastery():
    from app.core.telemetry import ADAPTIVE_REMEDIATION_EXERCISE_SUBMITTED
    from app.services.remediation import submit_remedial_exercise

    async def _run():
        db = get_db()
        uid, cid, concept_id = "user-ex-2", "course-ex-2", "conc-ex-2"
        await _seed_exercise(db, uid, cid, concept_id)
        before = ADAPTIVE_REMEDIATION_EXERCISE_SUBMITTED.labels(
            concept_id=concept_id, passed="false")._value.get()
        result = await submit_remedial_exercise(uid, cid, concept_id, {0: 1, 1: 0})
        after = ADAPTIVE_REMEDIATION_EXERCISE_SUBMITTED.labels(
            concept_id=concept_id, passed="false")._value.get()
        return result, before, after

    result, before, after = asyncio.run(_run())
    assert result["correct_count"] == 0
    assert result["passed"] is False
    assert result["mastery_after"] < result["mastery_before"]
    assert after == before + 1


def test_exercise_submit_missing_content_raises():
    import pytest

    from app.services.remediation import submit_remedial_exercise

    async def _run():
        return await submit_remedial_exercise("user-ex-3", "course-ex-3", "conc-ex-3", {0: 0})

    with pytest.raises(ValueError):
        asyncio.run(_run())


# ── NV2: feedback ────────────────────────────────────────────────────────────


def test_feedback_increments_m6_and_stores_event():
    from app.core.telemetry import ADAPTIVE_REMEDIATION_FEEDBACK
    from app.services.remediation import submit_remediation_feedback

    async def _run():
        db = get_db()
        before = ADAPTIVE_REMEDIATION_FEEDBACK.labels(helpful="true")._value.get()
        result = await submit_remediation_feedback("user-fb-1", "course-fb", "conc-fb", True)
        after = ADAPTIVE_REMEDIATION_FEEDBACK.labels(helpful="true")._value.get()
        event = await db.activity_events.find_one({
            "type": "remediation_feedback", "user_id": "user-fb-1",
        })
        return result, before, after, event

    result, before, after, event = asyncio.run(_run())
    assert result["recorded"] is True
    assert result["helpful"] is True
    assert after == before + 1, "M6 must increment on feedback"
    assert event is not None
    assert event["payload"]["course_id"] == "course-fb"
    assert event["payload"]["concept_id"] == "conc-fb"
    assert event["payload"]["helpful"] is True


# ── NV4: M6/M7 exposed on /metrics ───────────────────────────────────────────


def test_phase6_metrics_series_exposed():
    from fastapi.testclient import TestClient

    from app.core.telemetry import (
        ADAPTIVE_REMEDIATION_EXERCISE_SUBMITTED,
        ADAPTIVE_REMEDIATION_FEEDBACK,
    )
    from app.main import app

    ADAPTIVE_REMEDIATION_FEEDBACK.labels(helpful="false").inc()
    ADAPTIVE_REMEDIATION_EXERCISE_SUBMITTED.labels(concept_id="conc-m6m7", passed="true").inc()

    with TestClient(app) as client:
        res = client.get("/metrics")
        assert res.status_code == 200
        body = res.text

    assert 'adaptive_remediation_feedback_total{helpful="false"}' in body
    assert (
        'adaptive_remediation_exercise_submitted_total{concept_id="conc-m6m7",passed="true"}'
        in body
    )


# ── NV1: AI Tutor context injection ──────────────────────────────────────────


def _tutor_course_and_lesson():
    course = {
        "_id": "course-sql",
        "title": "SQL for Data Analysis",
        "category_name": "Data & Analytics",
        "description": "SQL course",
        "syllabus": [
            {"id": "sql-1", "title": "SELECT & FROM", "order": 1, "duration_seconds": 360},
        ],
        "outcome": ["Write queries"],
    }
    lesson = {"id": "sql-1", "title": "SELECT & FROM", "order": 1, "duration_seconds": 360}
    return course, lesson


def test_ai_tutor_injects_weak_concept_context():
    from unittest.mock import AsyncMock, patch

    from app.services import ai_tutor as at

    captured = {}

    async def fake_call_llm(messages):
        captured["messages"] = messages
        return "Here is the answer."

    course, lesson = _tutor_course_and_lesson()
    with patch.object(at, "_call_llm", side_effect=fake_call_llm), \
         patch.object(at, "get_concepts_by_lesson", new=AsyncMock(return_value=[
             {"_id": "conc-course-sql-select-from", "name": "SELECT & FROM"},
         ])), \
         patch.object(at, "get_remediation_suggestions", new=AsyncMock(return_value=[
             {
                 "concept_id": "conc-course-sql-select-from",
                 "concept_name": "SELECT & FROM",
                 "mastery_score": 2.0,
                 "trend": "declining",
                 "lesson_ids": ["sql-1"],
                 "prerequisite_concepts": [],
                 "suggestion": "Review the basics of SELECT & FROM.",
             },
         ])):
        result = asyncio.run(
            at.ask_ai_tutor("user-tutor-weak", course, lesson, "What is SELECT?")
        )

    context_msg = next(
        m for m in captured["messages"]
        if m["role"] == "user" and "lesson context" in m["content"].lower()
    )
    assert "Student is weak at SELECT & FROM" in context_msg["content"]
    assert "Review the basics of SELECT & FROM." in context_msg["content"]
    # Response shape is frozen (Phase 6 contract): unchanged.
    assert set(result.keys()) == {"answer", "session_id", "message_count"}
    assert result["answer"] == "Here is the answer."


def test_ai_tutor_skips_context_when_no_weak_concepts():
    from unittest.mock import AsyncMock, patch

    from app.services import ai_tutor as at

    captured = {}

    async def fake_call_llm(messages):
        captured["messages"] = messages
        return "All good."

    course, lesson = _tutor_course_and_lesson()
    with patch.object(at, "_call_llm", side_effect=fake_call_llm), \
         patch.object(at, "get_concepts_by_lesson", new=AsyncMock(return_value=[
             {"_id": "conc-course-sql-select-from", "name": "SELECT & FROM"},
         ])), \
         patch.object(at, "get_remediation_suggestions", new=AsyncMock(return_value=[])):
        result = asyncio.run(
            at.ask_ai_tutor("user-tutor-strong", course, lesson, "What is SELECT?")
        )

    context_msg = next(
        m for m in captured["messages"]
        if m["role"] == "user" and "lesson context" in m["content"].lower()
    )
    assert "Student is weak at" not in context_msg["content"]
    assert set(result.keys()) == {"answer", "session_id", "message_count"}


# ── NV3: skip returns updated_sequence ───────────────────────────────────────


def test_skip_returns_updated_sequence():
    from fastapi.testclient import TestClient

    from app.main import app

    with TestClient(app) as client:
        token = _user_token(client, "skip-seq@test.com")
        headers = {"Authorization": f"Bearer {token}"}
        uid = "user-skip-seq@test.com"

        async def _setup():
            from app.db.mongodb import seed_db
            from app.services.concept_mastery import update_mastery

            await seed_db()
            db = get_db()
            now = _now()
            # seed_concepts() is skipped once concept_definitions is non-empty,
            # so insert the lesson concept directly to keep this test hermetic.
            await db.concept_definitions.insert_one({
                "_id": "conc-course-sql-select-from",
                "course_id": "course-sql",
                "name": "SELECT & FROM",
                "slug": "select-and-from",
                "description": "sql-1 concept",
                "difficulty_base": 2,
                "lesson_ids": ["sql-1"],
                "prerequisite_concepts": [],
                "is_active": True,
                "created_at": now,
                "updated_at": now,
            })
            # One correct answer on difficulty 10 drives mastery to 10.0 (Elo cap).
            await update_mastery(uid, "course-sql", "conc-course-sql-select-from",
                                 correct=True, difficulty=10)

        asyncio.run(_setup())

        res = client.post("/api/v1/adaptive/skip/course-sql/sql-1", headers=headers)
        assert res.status_code == 200, res.text
        data = res.json()["data"]
        assert data["skipped"] is True
        assert data["lesson_id"] == "sql-1"
        assert "updated_sequence" in data, "skip must return additive updated_sequence"
        assert data["updated_sequence"]["course_id"] == "course-sql"
        assert isinstance(data["updated_sequence"]["sequence"], list)


# ── HTTP endpoint coverage for Phase 6 ───────────────────────────────────────


def test_remediation_endpoint_returns_priority_queue():
    from fastapi.testclient import TestClient

    from app.main import app

    with TestClient(app) as client:
        token = _user_token(client, "reco-http@test.com")
        headers = {"Authorization": f"Bearer {token}"}
        uid = "user-reco-http@test.com"

        async def _setup():
            db = get_db()
            cid = "course-reco-http"
            now = _now()
            await db.concept_definitions.insert_many([
                {"_id": "conc-reco-http-a", "course_id": cid, "name": "Weak A",
                 "slug": "weak-a", "is_active": True, "lesson_ids": ["l1"],
                 "prerequisite_concepts": []},
                {"_id": "conc-reco-http-b", "course_id": cid, "name": "Weak B",
                 "slug": "weak-b", "is_active": True, "lesson_ids": ["l2"],
                 "prerequisite_concepts": []},
            ])
            for cid_conc, score in (("conc-reco-http-a", 2.0), ("conc-reco-http-b", 1.0)):
                await db.concept_mastery.insert_one({
                    "_id": f"mast-{uid}-{cid_conc}", "user_id": uid, "course_id": cid,
                    "concept_id": cid_conc, "mastery_score": score, "attempts": 2,
                    "correct_attempts": 0, "trend": "declining", "last_practiced_at": None,
                    "created_at": now, "updated_at": now,
                })

        asyncio.run(_setup())

        res = client.get("/api/v1/adaptive/remediation/course-reco-http", headers=headers)
        assert res.status_code == 200
        data = res.json()["data"]
        assert isinstance(data, list)
        assert len(data) == 2
        assert all("priority" in item for item in data)
        assert all("concept_name" in item for item in data)
        # Most severe first within the same priority.
        assert data[0]["concept_id"] == "conc-reco-http-b"


def test_exercise_submit_endpoint_returns_mastery_delta():
    from fastapi.testclient import TestClient

    from app.main import app

    with TestClient(app) as client:
        token = _user_token(client, "ex-http@test.com")
        headers = {"Authorization": f"Bearer {token}"}
        uid = "user-ex-http@test.com"

        async def _setup():
            db = get_db()
            await _seed_exercise(db, uid, "course-ex-http", "conc-ex-http")

        asyncio.run(_setup())

        res = client.post(
            "/api/v1/adaptive/remediation/course-ex-http/exercise/conc-ex-http/submit",
            json={"answers": {"0": 0, "1": 1}},
            headers=headers,
        )
        assert res.status_code == 200, res.text
        data = res.json()["data"]
        assert data["correct_count"] == 2
        assert data["total"] == 2
        assert data["mastery_after"] > data["mastery_before"]
        assert data["passed"] is True


def test_exercise_submit_endpoint_404_without_content():
    from fastapi.testclient import TestClient

    from app.main import app

    with TestClient(app) as client:
        token = _user_token(client, "ex-404@test.com")
        headers = {"Authorization": f"Bearer {token}"}
        res = client.post(
            "/api/v1/adaptive/remediation/course-ex-404/exercise/conc-ex-404/submit",
            json={"answers": {"0": 0}},
            headers=headers,
        )
        assert res.status_code == 404


def test_feedback_endpoint_records_event():
    from fastapi.testclient import TestClient

    from app.main import app

    with TestClient(app) as client:
        token = _user_token(client, "fb-http@test.com")
        headers = {"Authorization": f"Bearer {token}"}
        uid = "user-fb-http@test.com"

        res = client.post(
            "/api/v1/adaptive/remediation/course-fb-http/feedback/conc-fb-http",
            json={"helpful": False},
            headers=headers,
        )
        assert res.status_code == 200, res.text
        data = res.json()["data"]
        assert data["recorded"] is True
        assert data["helpful"] is False

        async def _find_event():
            return await get_db().activity_events.find_one({
                "type": "remediation_feedback", "user_id": uid,
            })

        event = asyncio.run(_find_event())
        assert event is not None
        assert event["payload"]["helpful"] is False
