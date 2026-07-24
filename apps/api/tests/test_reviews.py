import os

os.environ["MONGODB_URI"] = "memory://test"

from fastapi.testclient import TestClient
from app.main import app


def test_list_reviews():
    with TestClient(app) as client:
        res = client.get("/api/v1/reviews")
        assert res.status_code == 200
        reviews = res.json()
        assert len(reviews) > 0


def test_create_review():
    with TestClient(app) as client:
        res = client.post("/api/v1/reviews", json={
            "name": "Test User",
            "role": "Developer",
            "rating": 5,
            "outcome": "Learned a lot",
            "quote": "Great course",
        })
        assert res.status_code == 200
        data = res.json()
        assert data["name"] == "Test User"
        assert data["rating"] == 5
