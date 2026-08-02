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
        assert quiz["mode"] == "adaptive"
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
