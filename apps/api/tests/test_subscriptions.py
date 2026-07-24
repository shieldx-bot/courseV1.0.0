import os

os.environ["MONGODB_URI"] = "memory://test"

from fastapi.testclient import TestClient
from app.main import app


def _get_token(client, email="sub@test.com"):
    res = client.post("/api/v1/auth/signup", json={"email": email, "password": "password123", "name": "Sub"})
    return res.json()["access_token"]


def test_list_tiers():
    with TestClient(app) as client:
        res = client.get("/api/v1/subscriptions/tiers")
        assert res.status_code == 200
        tiers = res.json()
        assert len(tiers) > 0
        assert tiers[0]["label"]


def test_checkout_creates_subscription():
    with TestClient(app) as client:
        token = _get_token(client)

        res = client.post(
            "/api/v1/checkout/session",
            json={"tier_id": "tier-1mo", "payment_provider": "test"},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert res.status_code == 200
        data = res.json()
        assert data["provider"] == "test"

        res = client.get("/api/v1/subscriptions/me", headers={"Authorization": f"Bearer {token}"})
        assert res.status_code == 200
        assert res.json()["status"] == "active"


def test_cancel_subscription():
    with TestClient(app) as client:
        token = _get_token(client, email="cancel@test.com")

        client.post("/api/v1/checkout/session", json={"tier_id": "tier-1mo", "payment_provider": "test"}, headers={"Authorization": f"Bearer {token}"})

        res = client.post("/api/v1/subscriptions/cancel", headers={"Authorization": f"Bearer {token}"})
        assert res.status_code == 200
        assert res.json()["canceled"] is True

        res = client.get("/api/v1/subscriptions/me", headers={"Authorization": f"Bearer {token}"})
        assert res.json() is None
