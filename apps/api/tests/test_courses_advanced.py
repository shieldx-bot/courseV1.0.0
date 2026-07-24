import os

os.environ["MONGODB_URI"] = "memory://test"

from fastapi.testclient import TestClient
from app.main import app


def test_course_search():
    with TestClient(app) as client:
        res = client.get("/api/v1/courses?search=excel")
        assert res.status_code == 200
        courses = res.json()
        assert any("excel" in c["title"].lower() for c in courses)


def test_course_search_with_q_param():
    with TestClient(app) as client:
        res = client.get("/api/v1/courses?q=excel")
        assert res.status_code == 200
        courses = res.json()
        assert any("excel" in c["title"].lower() for c in courses)


def test_course_filter_by_category():
    with TestClient(app) as client:
        res = client.get("/api/v1/courses?category=data")
        assert res.status_code == 200
        courses = res.json()
        assert all(c["category_slug"] == "data" for c in courses)


def test_course_detail():
    with TestClient(app) as client:
        res = client.get("/api/v1/courses/excel-for-busy-professionals")
        assert res.status_code == 200
        course = res.json()
        assert course["title"] == "Excel for Busy Professionals"
        assert len(course["syllabus"]) > 0
        assert "instructor" in course


def test_public_stats():
    with TestClient(app) as client:
        res = client.get("/api/v1/stats")
        assert res.status_code == 200
        data = res.json()
        assert "total_courses" in data
        assert "total_members" in data
        assert "average_rating" in data
