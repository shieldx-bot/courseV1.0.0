"""Integration tests for Community + AI Intelligence Phase."""
import os

os.environ["MONGODB_URI"] = "memory://test"

import asyncio
from fastapi.testclient import TestClient
from app.main import app
from app.db.mongodb import get_db


def _login(client) -> str:
    res = client.post("/api/v1/auth/login", json={"email": "admin@ascendly.io", "password": "password"})
    assert res.status_code == 200, res.text
    return res.json()["data"]["access_token"]


def _auth(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


def _seed_challenge(db):
    from app.services.skill_graph import seed_skills

    asyncio.get_event_loop().run_until_complete(seed_skills())
    cid = "ch-test-linux-permissions"
    db.challenges.insert_one({
        "_id": cid, "title": "Linux File Permissions", "description": "chmod",
        "topic": "Linux", "domain": "technology", "difficulty": "easy",
        "difficulty_score": 2, "type": "theory",
        "content": {
            "question": "What does chmod 755 mean?",
            "options": ["r--r--r--", "rwxr-xr-x", "rw-------", "rwxrwxrwx"],
            "correct": 1, "scenario": "", "expected_answer": "",
        },
        "explanation": "755 = rwxr-xr-x.",
        "skills": ["skill-linux"], "skills_raw": ["Linux"],
        "source": "user", "creator_id": None, "status": "published", "quality_score": 4.2,
        "stats": {"attempts": 0, "completion_rate": 0.0, "avg_rating": 0.0, "bookmarks": 0},
        "created_at": "2026-07-31T00:00:00+00:00", "updated_at": "2026-07-31T00:00:00+00:00",
    })
    return cid


def test_skills_seeded():
    with TestClient(app) as client:
        token = _login(client)
        res = client.get("/api/v1/skills", headers=_auth(token))
    assert res.status_code == 200
    names = {s["name"] for s in res.json()["data"]["skills"]}
    assert {"Linux", "Docker", "Kubernetes"}.issubset(names)


def test_submit_skill_activity_mentor():
    db = get_db()
    _seed_challenge(db)
    with TestClient(app) as client:
        token = _login(client)
        ok = client.post(
            "/api/v1/challenges/ch-test-linux-permissions/submit",
            json={"answer": 1, "time_seconds": 30}, headers=_auth(token))
        assert ok.status_code == 200, ok.text
        assert ok.json()["data"]["is_correct"] is True

        skills = client.get("/api/v1/skills/my", headers=_auth(token)).json()["data"]["skills"]
        linux = next(s for s in skills if s["skill_id"] == "skill-linux")
        assert linux["mastery_score"] > 0

        feed = client.get("/api/v1/activity", headers=_auth(token)).json()["data"]["events"]
        assert feed and feed[0]["type"] == "challenge_completed"

        bad = client.post(
            "/api/v1/challenges/ch-test-linux-permissions/submit",
            json={"answer": 0}, headers=_auth(token))
        attempt_id = bad.json()["data"]["attempt_id"]
        analysis = client.get(
            f"/api/v1/mentor/analysis/{attempt_id}", headers=_auth(token)).json()["data"]
        assert isinstance(analysis["weak_concepts"], list)
        assert isinstance(analysis["recommendations"], list)


def test_creator_follow_and_list():
    db = get_db()
    _seed_challenge(db)
    with TestClient(app) as client:
        token = _login(client)
        me = client.get("/api/v1/creators/me", headers=_auth(token)).json()["data"]
        assert me["level"] in ["beginner", "trusted", "expert", "legend"]

        client.post("/api/v1/creators/follow",
                    json={"creator_id": "admin@ascendly.io"}, headers=_auth(token))
        prof = client.get("/api/v1/creators/admin@ascendly.io", headers=_auth(token)).json()["data"]
        assert prof["followers_count"] >= 1

        res = client.get("/api/v1/challenges?skill=linux&difficulty=easy", headers=_auth(token))
        assert res.json()["data"]["total"] >= 1

        rec = client.get("/api/v1/challenges/recommended", headers=_auth(token)).json()["data"]
        assert isinstance(rec["challenges"], list)