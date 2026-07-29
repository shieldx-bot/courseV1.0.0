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
