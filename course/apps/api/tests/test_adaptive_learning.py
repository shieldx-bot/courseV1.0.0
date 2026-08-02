import asyncio
import os

os.environ["MONGODB_URI"] = "memory://test"

from fastapi.testclient import TestClient
from app.main import app


def _user_token(client, email="adaptive@test.com"):
    res = client.post("/api/v1/auth/signup", json={"email": email, "password": "password123", "name": "Adaptive User"})
    body = res.json()
    if "data" in body:
        body = body["data"]
    return body["access_token"]


# ── NV2: Elo algorithm unit tests (direct function calls, in-memory DB) ──────


def test_elo_correct_hard_question_increases_score():
    from app.services.concept_mastery import update_mastery

    async def _run():
        first = await update_mastery("user-elo-up", "course-elo", "conc-elo-a", correct=True, difficulty=10)
        second = await update_mastery("user-elo-up", "course-elo", "conc-elo-a", correct=True, difficulty=10)
        return first, second

    first, second = asyncio.run(_run())
    assert first["mastery_score"] > 5.0, "correct answer on a hard question must increase mastery"
    assert second["mastery_score"] >= first["mastery_score"]


def test_elo_wrong_easy_question_decreases_score():
    from app.services.concept_mastery import update_mastery

    async def _run():
        first = await update_mastery("user-elo-down", "course-elo", "conc-elo-b", correct=False, difficulty=1)
        second = await update_mastery("user-elo-down", "course-elo", "conc-elo-b", correct=False, difficulty=1)
        return first, second

    first, second = asyncio.run(_run())
    assert first["mastery_score"] < 5.0, "wrong answer on an easy question must decrease mastery"
    assert second["mastery_score"] <= first["mastery_score"]


def test_elo_k_factor_decreases_with_attempts():
    from app.services.concept_mastery import _update_score_elo

    # From a mid-range starting score with a correct answer the single-step
    # delta stays inside [0, 10] for these attempt counts (no clamping), so
    # the shrinking deltas isolate the k-factor effect.
    deltas = [
        abs(_update_score_elo(5.0, attempts=a, correct=True, difficulty=5, time_seconds=None) - 5.0)
        for a in (30, 50, 100)
    ]
    assert deltas[0] > deltas[1] > deltas[2], "k-factor must shrink as attempts grow"


def test_elo_score_clamped_to_range():
    from app.services.concept_mastery import _update_score_elo

    low = _update_score_elo(5.0, attempts=1, correct=False, difficulty=1, time_seconds=None)
    high = _update_score_elo(5.0, attempts=1, correct=True, difficulty=10, time_seconds=None)
    repeat = _update_score_elo(10.0, attempts=1, correct=True, difficulty=10, time_seconds=None)
    for score in (low, high, repeat):
        assert 0.0 <= score <= 10.0
    assert low >= 0.0
    assert high <= 10.0
    assert repeat <= 10.0


def test_grade_quiz_updates_multiple_concepts_and_returns_breakdown():
    from app.services.adaptive_quiz import grade_quiz
    from app.services.concept_mastery import get_mastery

    async def _run():
        questions = [
            {"concept_id": "conc-grade-a", "concept_name": "Concept A", "difficulty": 5, "correct": 0},
            {"concept_id": "conc-grade-b", "concept_name": "Concept B", "difficulty": 7, "correct": 1},
            {"concept_id": "conc-grade-c", "concept_name": "Concept C", "difficulty": 3, "correct": 2},
        ]
        answers = {0: 0, 1: 1, 2: 0}  # A correct, B correct, C wrong
        result = await grade_quiz(
            user_id="user-grade-1",
            course_id="course-grade",
            quiz_id="qa-grade-test-1",
            answers=answers,
            questions=questions,
        )
        return result

    result = asyncio.run(_run())
    assert result["score"] == 2
    assert result["total_questions"] == 3
    assert len(result["concept_results"]) == 3
    assert {r["concept_id"] for r in result["concept_results"]} == {"conc-grade-a", "conc-grade-b", "conc-grade-c"}
    for r in result["concept_results"]:
        assert "mastery_before" in r and "mastery_after" in r and "mastery_delta" in r


def test_weak_strong_concepts_respect_thresholds():
    from app.services.concept_mastery import update_mastery, get_weak_concepts, get_strong_concepts

    async def _run():
        uid = "user-thresh-1"
        for _ in range(3):
            await update_mastery(uid, "course-thresh", "conc-thresh-weak", correct=False, difficulty=5)
        for _ in range(3):
            await update_mastery(uid, "course-thresh", "conc-thresh-strong", correct=True, difficulty=10)
        weak = await get_weak_concepts(uid, "course-thresh", threshold=3.0)
        strong = await get_strong_concepts(uid, "course-thresh", threshold=7.0)
        return weak, strong

    weak, strong = asyncio.run(_run())
    weak_ids = {w["concept_id"] for w in weak}
    strong_ids = {s["concept_id"] for s in strong}
    assert "conc-thresh-weak" in weak_ids
    assert "conc-thresh-strong" in strong_ids
    assert "conc-thresh-strong" not in weak_ids
    assert "conc-thresh-weak" not in strong_ids


# ── NV3: /mastery/{course_id} route ──────────────────────────────────────────


def test_mastery_route_returns_concept_breakdown():
    with TestClient(app) as client:
        token = _user_token(client, email="adapt-mastery@test.com")
        headers = {"Authorization": f"Bearer {token}"}

        res = client.get("/api/v1/adaptive/mastery/course-sql", headers=headers)
        assert res.status_code == 200
        data = res.json()["data"]
        assert isinstance(data, list)
        assert len(data) > 0
        for item in data:
            assert set(item.keys()) == {"concept_id", "name", "mastery_score", "trend", "attempts"}
            assert 0.0 <= item["mastery_score"] <= 10.0
        scores = [i["mastery_score"] for i in data]
        assert scores == sorted(scores)


# ── NV1: seed idempotency + prerequisites ────────────────────────────────────


def test_seed_concepts_idempotent_and_includes_prerequisites():
    from app.db.mongodb import get_db
    from app.db.seed_concepts import seed_concepts

    async def _run():
        db = get_db()
        await seed_concepts()
        first = await db.concept_definitions.count_documents({})
        await seed_concepts()
        second = await db.concept_definitions.count_documents({})
        joins = await db.concept_definitions.find_one({"course_id": "course-sql", "slug": "joins"})
        return first, second, joins

    first, second, joins = asyncio.run(_run())
    assert first == second, "seeding must be idempotent"
    assert first >= 16, "expected 5+5+6 sample concepts"
    assert joins is not None
    assert joins["prerequisite_concepts"] == [
        "conc-course-sql-select-from",
        "conc-course-sql-where-filtering",
    ]


# ── NV4: worker job metrics hooks ────────────────────────────────────────────


def test_worker_job_metrics_hooks_increment_counters():
    from app.core.telemetry import WORKER_JOBS_COMPLETED
    from app.worker import _tracked

    async def _fake(ctx, x):
        return x * 2

    async def _boom(ctx):
        raise ValueError("boom")

    async def _run():
        tracked = _tracked(_fake)
        assert await tracked({"job_id": "j1"}, 21) == 42

        before = WORKER_JOBS_COMPLETED.labels(task="_fake", status="success")._value.get()
        await tracked({"job_id": "j2"}, 1)
        after = WORKER_JOBS_COMPLETED.labels(task="_fake", status="success")._value.get()
        assert after == before + 1

        failing = _tracked(_boom)
        f_before = WORKER_JOBS_COMPLETED.labels(task="_boom", status="failed")._value.get()
        try:
            await failing({"job_id": "j3"})
        except ValueError:
            pass
        else:
            raise AssertionError("expected ValueError to propagate")
        f_after = WORKER_JOBS_COMPLETED.labels(task="_boom", status="failed")._value.get()
        assert f_after == f_before + 1

    asyncio.run(_run())


def test_seeded_concepts_are_available():
    with TestClient(app) as client:
        token = _user_token(client, email="adapt1@test.com")
        headers = {"Authorization": f"Bearer {token}"}

        res = client.get("/api/v1/adaptive/concepts/course-python-data", headers=headers)
        assert res.status_code == 200
        data = res.json()["data"]
        assert len(data) > 0, "Expected seeded concepts for python-data course"
        names = {c["name"] for c in data}
        assert "Pandas DataFrames" in names


def test_adaptive_quiz_generation():
    with TestClient(app) as client:
        token = _user_token(client, email="adapt2@test.com")
        headers = {"Authorization": f"Bearer {token}"}

        res = client.post("/api/v1/adaptive/quiz/course-js/generate?lesson_id=js-2&num_questions=3", headers=headers)
        assert res.status_code == 200
        quiz = res.json()["data"]
        assert quiz["mode"] == "lesson"
        assert "questions" in quiz
        assert len(quiz["questions"]) <= 3


def test_quiz_submission_updates_mastery():
    with TestClient(app) as client:
        token = _user_token(client, email="adapt3@test.com")
        headers = {"Authorization": f"Bearer {token}"}

        res = client.post("/api/v1/adaptive/quiz/course-sql/generate?lesson_id=sql-1&num_questions=2", headers=headers)
        quiz = res.json()["data"]
        assert len(quiz["questions"]) > 0

        answers = {i: 0 for i in range(len(quiz["questions"]))}
        res = client.post("/api/v1/adaptive/quiz/course-sql/submit", json={
            "quiz_id": quiz["quiz_id"],
            "answers": answers,
            "questions": quiz["questions"],
        }, headers=headers)
        assert res.status_code == 200
        result = res.json()["data"]
        assert "score" in result
        assert "concept_results" in result


def test_weak_concepts_endpoint():
    with TestClient(app) as client:
        token = _user_token(client, email="adapt4@test.com")
        headers = {"Authorization": f"Bearer {token}"}

        res = client.get("/api/v1/adaptive/weak/course-python-data", headers=headers)
        assert res.status_code == 200
        data = res.json()["data"]
        assert isinstance(data, list)


def test_admin_can_list_concepts():
    with TestClient(app) as client:
        admin_res = client.post("/api/v1/auth/login", json={"email": "admin@ascendly.io", "password": "password"})
        admin_token = admin_res.json()["data"]["access_token"]
        headers = {"Authorization": f"Bearer {admin_token}"}

        res = client.get("/api/v1/admin/adaptive/concepts?course_id=course-python-data", headers=headers)
        assert res.status_code == 200
        data = res.json()["data"]
        assert len(data) > 0


# ── Phase 5 / NV1: admin concept CRUD after `_now()` fix ─────────────────────


def _admin_headers(client):
    admin_res = client.post("/api/v1/auth/login", json={"email": "admin@ascendly.io", "password": "password"})
    return {"Authorization": f"Bearer {admin_res.json()['data']['access_token']}"}


def test_admin_concept_create_update_and_prereq_reference_update():
    with TestClient(app) as client:
        headers = _admin_headers(client)

        res = client.post("/api/v1/admin/adaptive/concepts", json={
            "course_id": "course-admin-crud",
            "name": "Alpha Concept",
            "description": "alpha",
            "difficulty_base": 4,
        }, headers=headers)
        assert res.status_code == 200, res.text
        alpha = res.json()["data"]
        alpha_id = alpha["id"]
        assert alpha_id == "conc-course-admin-crud-alpha-concept"
        assert alpha["created_at"] and alpha["updated_at"]

        res = client.post("/api/v1/admin/adaptive/concepts", json={
            "course_id": "course-admin-crud",
            "name": "Beta Concept",
            "description": "beta",
            "prerequisite_concepts": [alpha_id],
        }, headers=headers)
        assert res.status_code == 200, res.text
        beta_id = res.json()["data"]["id"]

        res = client.get("/api/v1/admin/adaptive/concepts?course_id=course-admin-crud", headers=headers)
        listed = {c["id"] for c in res.json()["data"]}
        assert alpha_id in listed and beta_id in listed

        # Renaming alpha changes its _id and must rewrite Beta's prereq reference.
        res = client.put(f"/api/v1/admin/adaptive/concepts/{alpha_id}", json={"name": "Alpha Renamed"}, headers=headers)
        assert res.status_code == 200, res.text
        renamed = res.json()["data"]
        assert renamed["id"] == "conc-course-admin-crud-alpha-renamed"
        assert renamed["name"] == "Alpha Renamed"

        async def _fetch():
            from app.db.mongodb import get_db
            db = get_db()
            beta = await db.concept_definitions.find_one({"_id": beta_id})
            return beta

        beta = asyncio.run(_fetch())
        assert renamed["id"] in beta["prerequisite_concepts"]
        assert alpha_id not in beta["prerequisite_concepts"]


def test_admin_bulk_create_concepts_idempotent():
    with TestClient(app) as client:
        headers = _admin_headers(client)
        payload = {
            "course_id": "course-admin-bulk",
            "concepts": [
                {"name": "Bulk One", "description": "one", "difficulty_base": 3},
                {"name": "Bulk Two", "description": "two"},
            ],
        }

        res = client.post("/api/v1/admin/adaptive/concepts/bulk", json=payload, headers=headers)
        assert res.status_code == 200, res.text
        assert res.json()["data"]["created"] == 2

        res = client.post("/api/v1/admin/adaptive/concepts/bulk", json=payload, headers=headers)
        assert res.status_code == 200, res.text
        assert res.json()["data"]["created"] == 0
        assert res.json()["data"]["skipped"] == 2

        async def _count():
            from app.db.mongodb import get_db
            return await get_db().concept_definitions.count_documents({"course_id": "course-admin-bulk"})

        assert asyncio.run(_count()) == 2


# ── Phase 5 / NV2: quiz engine ───────────────────────────────────────────────


def test_dynamic_difficulty_targets_mastery():
    from app.services.adaptive_quiz import _pick_difficulty

    assert _pick_difficulty(None, 7) == 7, "cold start must use difficulty_base"
    assert _pick_difficulty(None, 2) == 2
    assert _pick_difficulty(8.0, 5, jitter=2) == 10, "clamped at 10"
    assert _pick_difficulty(1.0, 5, jitter=-2) == 1, "clamped at 1"
    assert _pick_difficulty(6.4, 5, jitter=1) == 7
    for _ in range(50):
        d = _pick_difficulty(6.4, 5)
        assert max(1, 6 - 2) <= d <= min(10, 6 + 2)


def test_quiz_difficulty_uses_difficulty_base_on_cold_start():
    with TestClient(app) as client:
        token = _user_token(client, email="adapt-diff@test.com")
        headers = {"Authorization": f"Bearer {token}"}

        res = client.post("/api/v1/adaptive/quiz/course-sql/generate?lesson_id=sql-1&num_questions=1", headers=headers)
        assert res.status_code == 200
        quiz = res.json()["data"]
        assert quiz["questions"], quiz
        # sql-1's SELECT & FROM has difficulty_base=2; cold start keeps it.
        assert all(q["difficulty"] == 2 for q in quiz["questions"])


def test_interleave_avoids_adjacent_same_concept():
    from app.services.adaptive_quiz import _interleave

    items = [
        {"concept_id": "A"},
        {"concept_id": "A"},
        {"concept_id": "B"},
        {"concept_id": "B"},
        {"concept_id": "C"},
    ]
    result = _interleave(items, lambda q: q["concept_id"])
    assert len(result) == len(items)
    for prev, nxt in zip(result, result[1:]):
        assert prev["concept_id"] != nxt["concept_id"], result


def test_question_bank_reuse_skips_llm():
    import json
    from unittest.mock import patch

    from app.db.seed_concepts import seed_concepts
    from app.services import adaptive_quiz as aq

    calls = {"n": 0}
    canned = {"question": "Banked question?", "options": ["a", "b", "c", "d"], "correct": 0, "explanation": "exp"}

    async def fake_call_llm(messages, **kwargs):
        calls["n"] += 1
        return json.dumps(canned)

    async def _run():
        await seed_concepts()
        from app.db.mongodb import get_db as _get_db
        await _get_db().quiz_questions.delete_many({})  # isolate from other tests
        uid = "user-bank-1"
        first = await aq.generate_adaptive_quiz(uid, "course-js", lesson_id="js-2", num_questions=3, mode="lesson")
        first_calls = calls["n"]
        second = await aq.generate_adaptive_quiz(uid, "course-js", lesson_id="js-2", num_questions=3, mode="lesson")
        from app.db.mongodb import get_db
        bank_count = await get_db().quiz_questions.count_documents({})
        return first, second, first_calls, calls["n"], bank_count

    with patch.object(aq, "is_llm_available", return_value=True), \
         patch.object(aq, "call_llm", side_effect=fake_call_llm):
        first, second, first_calls, total_calls, bank_count = asyncio.run(_run())

    assert len(first["questions"]) == 3
    assert first_calls == 3, "first generation must generate via LLM"
    assert total_calls == first_calls, "second generation must reuse the bank, not call LLM"
    assert bank_count >= 3
    assert second["questions"][0]["question"] == "Banked question?"


def test_mastery_check_mode_without_lesson_id():
    with TestClient(app) as client:
        token = _user_token(client, email="adapt-mc@test.com")
        headers = {"Authorization": f"Bearer {token}"}

        res = client.post("/api/v1/adaptive/quiz/course-sql/generate?mode=mastery-check&num_questions=4", headers=headers)
        assert res.status_code == 200
        quiz = res.json()["data"]
        assert quiz["mode"] == "mastery-check"
        assert quiz["lesson_id"] is None
        assert len(quiz["questions"]) == 4
        assert len({q["concept_id"] for q in quiz["questions"]}) >= 2

        res = client.post("/api/v1/adaptive/quiz/course-sql/generate?num_questions=3", headers=headers)
        assert res.status_code == 400, "mode=lesson requires lesson_id"

        res = client.post("/api/v1/adaptive/quiz/course-sql/generate?mode=bogus&num_questions=3", headers=headers)
        assert res.status_code == 400


def test_quiz_attempt_records_answers_and_time_seconds():
    from app.db.mongodb import get_db
    from app.services.adaptive_quiz import grade_quiz

    async def _run():
        questions = [
            {"concept_id": "conc-att-a", "concept_name": "A", "difficulty": 5, "correct": 0, "time_seconds": 4.2},
            {"concept_id": "conc-att-b", "concept_name": "B", "difficulty": 7, "correct": 1, "time_seconds": 12.7},
        ]
        answers = {0: 0, 1: 0}  # A correct, B wrong
        await grade_quiz("user-att-1", "course-att", "qa-att-1", answers, questions)
        return await get_db().quiz_attempts.find_one({"_id": "qa-att-1"})

    doc = asyncio.run(_run())
    assert doc["questions"][0]["user_answer"] == 0
    assert doc["questions"][0]["time_seconds"] == 4.2
    assert doc["questions"][0]["correct"] is True
    assert doc["questions"][1]["user_answer"] == 0
    assert doc["questions"][1]["time_seconds"] == 12.7
    assert doc["questions"][1]["correct"] is False
    assert len(doc["concept_results"]) == 2, "snapshot timeline must be stored"


# ── Phase 5 / NV5: mastery map cache invalidation ────────────────────────────


def test_mastery_map_cache_invalidated_on_update():
    from app.services.concept_mastery import get_course_mastery_map, update_mastery

    async def _run():
        uid = "user-cache-1"
        first = await get_course_mastery_map(uid, "course-cache")
        assert first == {}
        await update_mastery(uid, "course-cache", "conc-cache-a", correct=True, difficulty=10)
        return await get_course_mastery_map(uid, "course-cache")

    second = asyncio.run(_run())
    assert second.get("conc-cache-a", 0) > 5.0, "cache must be invalidated after mastery update"


# ── Phase 5 / NV6: adaptive metrics contract M1–M5 ───────────────────────────


def test_adaptive_metrics_series_exposed():
    from app.core.telemetry import (
        ADAPTIVE_MASTERY_DECAY_RUNS,
        ADAPTIVE_QUIZ_GENERATED,
        ADAPTIVE_QUIZ_SUBMIT_DURATION,
        ADAPTIVE_QUIZ_SUBMITTED,
        ADAPTIVE_REMEDIATION_GENERATED,
    )

    ADAPTIVE_QUIZ_GENERATED.labels(mode="lesson", course_id="course-sql").inc()
    ADAPTIVE_QUIZ_SUBMITTED.labels(mode="lesson", passed="true").inc()
    ADAPTIVE_QUIZ_SUBMIT_DURATION.labels(course_id="course-sql").observe(0.5)
    ADAPTIVE_MASTERY_DECAY_RUNS.labels(status="success").inc()
    ADAPTIVE_REMEDIATION_GENERATED.labels(concept_id="conc-x").inc()

    with TestClient(app) as client:
        res = client.get("/metrics")
        assert res.status_code == 200
        body = res.text

    assert 'adaptive_quiz_generated_total{course_id="course-sql",mode="lesson"}' in body
    assert 'adaptive_quiz_submitted_total{mode="lesson",passed="true"}' in body
    assert 'adaptive_quiz_submit_duration_seconds_count{course_id="course-sql"}' in body
    assert 'adaptive_mastery_decay_runs_total{status="success"}' in body
    assert 'adaptive_remediation_generated_total{concept_id="conc-x"}' in body
