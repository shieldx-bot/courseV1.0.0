import os

os.environ["MONGODB_URI"] = "memory://test"

from fastapi.testclient import TestClient
from app.main import app


def _admin_token(client):
    res = client.post("/api/v1/auth/login", json={"email": "admin@ascendly.io", "password": "password"})
    return res.json()["access_token"]


def _user_token(client, email="order@test.com"):
    res = client.post("/api/v1/auth/signup", json={"email": email, "password": "password123", "name": "User"})
    return res.json()["access_token"]


def test_admin_dashboard():
    with TestClient(app) as client:
        token = _admin_token(client)
        res = client.get("/api/v1/admin/dashboard", headers={"Authorization": f"Bearer {token}"})
        assert res.status_code == 200
        data = res.json()
        assert "total_members" in data
        assert "total_revenue" in data
        assert "recent_revenue" in data


def test_admin_users():
    with TestClient(app) as client:
        token = _admin_token(client)
        res = client.get("/api/v1/admin/users", headers={"Authorization": f"Bearer {token}"})
        assert res.status_code == 200
        users = res.json()
        assert len(users) > 0


def test_admin_users_search():
    with TestClient(app) as client:
        token = _admin_token(client)
        res = client.get("/api/v1/admin/users?search=admin", headers={"Authorization": f"Bearer {token}"})
        assert res.status_code == 200
        users = res.json()
        assert any("admin" in u["email"] for u in users)


def test_admin_users_role_filter():
    with TestClient(app) as client:
        token = _admin_token(client)
        res = client.get("/api/v1/admin/users?role=admin", headers={"Authorization": f"Bearer {token}"})
        assert res.status_code == 200
        users = res.json()
        assert all(u["role"] == "admin" for u in users)


def test_admin_orders():
    with TestClient(app) as client:
        admin_token = _admin_token(client)
        user_token = _user_token(client)
        client.post("/api/v1/checkout/session", json={"tier_id": "tier-1mo", "payment_provider": "test"}, headers={"Authorization": f"Bearer {user_token}"})

        res = client.get("/api/v1/admin/orders", headers={"Authorization": f"Bearer {admin_token}"})
        assert res.status_code == 200
        orders = res.json()
        assert len(orders) > 0
