import os

os.environ["MONGODB_URI"] = "memory://test"

from fastapi.testclient import TestClient
from app.main import app


def test_signup_and_login():
    with TestClient(app) as client:
        # Signup
        res = client.post("/api/v1/auth/signup", json={"email": "test@test.com", "password": "password123", "name": "Test User"})
        assert res.status_code == 200
        data = res.json()
        assert data["user"]["email"] == "test@test.com"
        assert "access_token" in data

        # Login
        res = client.post("/api/v1/auth/login", json={"email": "test@test.com", "password": "password123"})
        assert res.status_code == 200
        data = res.json()
        assert data["user"]["email"] == "test@test.com"
        assert "access_token" in data

        # Bad login
        res = client.post("/api/v1/auth/login", json={"email": "test@test.com", "password": "wrong"})
        assert res.status_code == 401


def test_get_me():
    with TestClient(app) as client:
        res = client.post("/api/v1/auth/signup", json={"email": "me@test.com", "password": "password123", "name": "Me"})
        token = res.json()["access_token"]

        res = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"})
        assert res.status_code == 200
        assert res.json()["email"] == "me@test.com"


def test_admin_login_from_seed():
    with TestClient(app) as client:
        res = client.post("/api/v1/auth/login", json={"email": "admin@ascendly.io", "password": "password"})
        assert res.status_code == 200
        data = res.json()
        assert data["user"]["role"] == "admin"
        assert "access_token" in data
