import os

os.environ["MONGODB_URI"] = "memory://test"

from fastapi.testclient import TestClient
from app.main import app


def test_health():
    with TestClient(app) as client:
        response = client.get("/api/v1/health")
        assert response.status_code == 200
        assert response.json()["status"] == "ok"


def test_categories_and_courses():
    with TestClient(app) as client:
        cats = client.get("/api/v1/categories")
        assert cats.status_code == 200
        assert len(cats.json()) > 0

        courses = client.get("/api/v1/courses")
        assert courses.status_code == 200
        assert len(courses.json()) > 0
