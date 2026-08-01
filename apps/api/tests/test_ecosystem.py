"""Integration tests for the Ecosystem phase — Creator Economy, Events, Moderation, Intelligence."""
import os

os.environ["MONGODB_URI"] = "memory://test"

from fastapi.testclient import TestClient
from app.main import app


def _login(client, email: str = "admin@ascendly.io") -> str:
    res = client.post("/api/v1/auth/login", json={"email": email, "password": "password"})
    assert res.status_code == 200, res.text
    return res.json()["data"]["access_token"]


def _auth(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


def test_notifications_flow():
    """Verify notification list, mark-as-read, and unread count endpoints."""
    with TestClient(app) as client:
        token = _login(client)
        # Initial state
        res = client.get("/api/v1/notifications", headers=_auth(token))
        assert res.status_code == 200, res.text
        data = res.json()["data"]
        assert "notifications" in data
        assert "unread_count" in data

        # Unread count
        res = client.get("/api/v1/notifications/unread-count", headers=_auth(token))
        assert res.status_code == 200, res.text
        assert "unread_count" in res.json()["data"]

        # Preferences
        res = client.get("/api/v1/notifications/preferences", headers=_auth(token))
        assert res.status_code == 200, res.text
        prefs = res.json()["data"]
        assert prefs["in_app_enabled"] is True

        # Update preferences
        res = client.put(
            "/api/v1/notifications/preferences",
            headers=_auth(token),
            json={"email_enabled": False},
        )
        assert res.status_code == 200, res.text
        assert res.json()["data"]["email_enabled"] is False

        # Mark all read works even with zero notifications
        res = client.post("/api/v1/notifications/read-all", headers=_auth(token))
        assert res.status_code == 200, res.text
        assert res.json()["data"]["success"] is True


def test_error_responses_return_proper_http_status():
    """Service-level errors must yield 4xx + success:false, not fake 200 success."""
    with TestClient(app) as client:
        token = _login(client)
        # Bookmark nonexistent collection -> 404
        res = client.post("/api/v1/ecosystem/collections/nope/bookmark", headers=_auth(token))
        assert res.status_code == 404, res.text
        assert res.json()["success"] is False

        # Join nonexistent event -> 404 (message contains "not found")
        res = client.post("/api/v1/ecosystem/events/nope/join", headers=_auth(token))
        assert res.status_code == 404, res.text
        assert res.json()["success"] is False

        # Version a nonexistent challenge -> 404
        res = client.post("/api/v1/ecosystem/challenges/nope/versions", headers=_auth(token), json={"change_note": "test"})
        assert res.status_code == 404, res.text
        assert res.json()["success"] is False

        # Invalid report category -> 400
        res = client.post("/api/v1/ecosystem/reports", headers=_auth(token), json={"target_type": "challenge", "target_id": "x", "category": "bogus"})
        assert res.status_code == 400, res.text
        assert res.json()["success"] is False

        # Admin resolve nonexistent report -> 404
        res = client.post("/api/v1/admin/ecosystem/moderation/nope/resolve", headers=_auth(token), json={"action": "dismiss"})
        assert res.status_code == 404, res.text
        assert res.json()["success"] is False

        # Admin verify nonexistent creator -> 404
        res = client.post("/api/v1/admin/ecosystem/creators/nope/verify", headers=_auth(token), json={"approve": True})
        assert res.status_code == 404, res.text
        assert res.json()["success"] is False


def test_creator_verification_flow():
    with TestClient(app) as client:
        token = _login(client)
        # Request verification
        res = client.post(
            "/api/v1/ecosystem/creators/verify/request",
            headers=_auth(token),
            json={"full_name": "Jane Dev", "expertise_area": "Python", "note": "10 yrs experience"},
        )
        assert res.status_code == 200, res.text
        assert res.json()["data"]["status"] == "pending"

        # Creator analytics endpoint works
        res = client.get("/api/v1/ecosystem/creators/me/analytics?days=30", headers=_auth(token))
        assert res.status_code == 200, res.text
        data = res.json()["data"]
        assert "profile" in data
        assert "totals" in data
        assert "per_challenge" in data

        # Refresh achievements
        res = client.post("/api/v1/ecosystem/creators/me/refresh", headers=_auth(token))
        assert res.status_code == 200, res.text
        assert "achievements" in res.json()["data"]

        # Creator leaderboard
        res = client.get("/api/v1/ecosystem/creators/leaderboard?limit=5")
        assert res.status_code == 200, res.text
        assert "creators" in res.json()["data"]