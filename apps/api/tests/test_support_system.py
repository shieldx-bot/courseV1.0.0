import os

os.environ["MONGODB_URI"] = "memory://test"

from fastapi.testclient import TestClient
from app.main import app


def _user_token(client, email="support@test.com"):
    res = client.post("/api/v1/auth/signup", json={"email": email, "password": "password123", "name": "Support User"})
    body = res.json()
    if "data" in body:
        body = body["data"]
    return body["access_token"]


def _admin_token(client):
    res = client.post("/api/v1/auth/login", json={"email": "admin@ascendly.io", "password": "password"})
    body = res.json()
    if "data" in body:
        body = body["data"]
    return body["access_token"]


# ── Support Tickets (User) ───────────────────────────────────────────────────


def test_create_and_list_ticket():
    with TestClient(app) as client:
        token = _user_token(client, email="tkt1@test.com")
        headers = {"Authorization": f"Bearer {token}"}

        res = client.post("/api/v1/support/tickets", json={
            "subject": "Billing issue",
            "message": "I was charged twice.",
            "category": "billing",
        }, headers=headers)
        assert res.status_code == 200
        ticket = res.json()["data"]
        assert ticket["subject"] == "Billing issue"
        assert ticket["status"] == "open"
        assert ticket["category"] == "billing"
        ticket_id = ticket["id"]

        res = client.get("/api/v1/support/tickets", headers=headers)
        assert res.status_code == 200
        tickets = res.json()["data"]
        assert any(t["id"] == ticket_id for t in tickets)


def test_get_ticket_detail_includes_initial_message():
    with TestClient(app) as client:
        token = _user_token(client, email="tkt2@test.com")
        headers = {"Authorization": f"Bearer {token}"}

        res = client.post("/api/v1/support/tickets", json={
            "subject": "Video not playing",
            "message": "Buffering on lesson 3.",
        }, headers=headers)
        ticket_id = res.json()["data"]["id"]

        res = client.get(f"/api/v1/support/tickets/{ticket_id}", headers=headers)
        assert res.status_code == 200
        detail = res.json()["data"]
        assert detail["id"] == ticket_id
        assert len(detail["messages"]) == 1
        assert detail["messages"][0]["content"] == "Buffering on lesson 3."


def test_ticket_detail_forbidden_for_other_user():
    with TestClient(app) as client:
        token_a = _user_token(client, email="ownera@test.com")
        token_b = _user_token(client, email="ownerb@test.com")
        headers_a = {"Authorization": f"Bearer {token_a}"}
        headers_b = {"Authorization": f"Bearer {token_b}"}

        res = client.post("/api/v1/support/tickets", json={
            "subject": "Private ticket",
            "message": "Secret",
        }, headers=headers_a)
        ticket_id = res.json()["data"]["id"]

        res = client.get(f"/api/v1/support/tickets/{ticket_id}", headers=headers_b)
        assert res.status_code == 403


# ── Admin Support ────────────────────────────────────────────────────────────


def test_admin_list_and_filter_tickets():
    with TestClient(app) as client:
        admin_headers = {"Authorization": f"Bearer {_admin_token(client)}"}
        user_headers = {"Authorization": f"Bearer {_user_token(client, email="admintkt@test.com")}"}

        client.post("/api/v1/support/tickets", json={
            "subject": "Admin list test",
            "message": "Please see.",
            "category": "technical",
        }, headers=user_headers)

        res = client.get("/api/v1/admin/support/tickets", headers=admin_headers)
        assert res.status_code == 200
        tickets = res.json()["data"]
        assert any(t["subject"] == "Admin list test" for t in tickets)

        res = client.get("/api/v1/admin/support/tickets?category=technical", headers=admin_headers)
        assert res.status_code == 200
        assert all(t["category"] == "technical" for t in res.json()["data"])


def test_admin_update_ticket_status():
    with TestClient(app) as client:
        admin_headers = {"Authorization": f"Bearer {_admin_token(client)}"}
        user_headers = {"Authorization": f"Bearer {_user_token(client, email="statustkt@test.com")}"}

        res = client.post("/api/v1/support/tickets", json={
            "subject": "Status change",
            "message": "Need update.",
        }, headers=user_headers)
        ticket_id = res.json()["data"]["id"]

        res = client.post(f"/api/v1/admin/support/tickets/{ticket_id}/status", json={
            "status": "in_progress",
        }, headers=admin_headers)
        assert res.status_code == 200
        assert res.json()["data"]["status"] == "in_progress"

        res = client.get(f"/api/v1/support/tickets/{ticket_id}", headers=user_headers)
        assert res.status_code == 200
        assert res.json()["data"]["status"] == "in_progress"


# ── Knowledge Base ───────────────────────────────────────────────────────────


def test_list_and_search_articles():
    with TestClient(app) as client:
        res = client.get("/api/v1/help/articles")
        assert res.status_code == 200
        articles = res.json()["data"]
        assert len(articles) > 0

        res = client.get("/api/v1/help/articles/search?q=subscription")
        assert res.status_code == 200
        results = res.json()["data"]
        assert any("subscription" in a["title"].lower() for a in results)


def test_article_feedback():
    with TestClient(app) as client:
        res = client.get("/api/v1/help/articles")
        article = res.json()["data"][0]
        article_id = article["id"]

        res = client.post(f"/api/v1/help/articles/{article_id}/feedback", json={"helpful": True})
        assert res.status_code == 200
        assert res.json()["data"]["id"] == article_id


# ── Support Chat ─────────────────────────────────────────────────────────────


def test_support_chat_history_lifecycle():
    with TestClient(app) as client:
        token = _user_token(client, email="chat@test.com")
        headers = {"Authorization": f"Bearer {token}"}

        res = client.get("/api/v1/support/chat/history", headers=headers)
        assert res.status_code == 200
        assert res.json()["data"] == []

        res = client.post("/api/v1/support/chat", json={"message": "How do I cancel?"}, headers=headers)
        assert res.status_code == 200
        data = res.json()["data"]
        assert "answer" in data

        res = client.get("/api/v1/support/chat/history", headers=headers)
        assert res.status_code == 200
        history = res.json()["data"]
        assert len(history) >= 2
