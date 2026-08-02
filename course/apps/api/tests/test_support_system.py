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


def test_article_feedback_requires_auth_and_increments():
    with TestClient(app) as client:
        res = client.get("/api/v1/help/articles")
        article = res.json()["data"][0]
        article_id = article["id"]
        before = article["helpful_count"]

        # Anonymous feedback is rejected (401) — feedback is a logged-in action.
        res = client.post(f"/api/v1/help/articles/{article_id}/feedback", json={"helpful": True})
        assert res.status_code == 401

        # Logged-in user feedback increments helpful_count.
        headers = {"Authorization": f"Bearer {_user_token(client, email='fb@test.com')}"}
        res = client.post(f"/api/v1/help/articles/{article_id}/feedback", json={"helpful": True}, headers=headers)
        assert res.status_code == 200
        assert res.json()["data"]["id"] == article_id
        assert res.json()["data"]["helpful_count"] == before + 1

        # GET /articles/{slug} increments views.
        res = client.get(f"/api/v1/help/articles/{article['slug']}")
        assert res.status_code == 200
        assert res.json()["data"]["views"] >= 1


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


# ── Admin assign + admin reply note (exercises add_message import) ───────────


def test_admin_assign_and_note():
    with TestClient(app) as client:
        admin_headers = {"Authorization": f"Bearer {_admin_token(client)}"}
        user_headers = {"Authorization": f"Bearer {_user_token(client, email='assign@test.com')}"}

        res = client.post("/api/v1/support/tickets", json={
            "subject": "Assign me",
            "message": "Please assign.",
        }, headers=user_headers)
        ticket_id = res.json()["data"]["id"]

        res = client.post(f"/api/v1/admin/support/tickets/{ticket_id}/assign",
                          json={"admin_id": "user-admin@ascendly.io"}, headers=admin_headers)
        assert res.status_code == 200
        assert res.json()["data"]["assigned_to"] == "user-admin@ascendly.io"

        res = client.post(f"/api/v1/admin/support/tickets/{ticket_id}/status",
                          json={"status": "in_progress", "note": "Investigating now"}, headers=admin_headers)
        assert res.status_code == 200
        assert res.json()["data"]["status"] == "in_progress"

        # The admin note is appended as a message (add_message path now imported).
        res = client.get(f"/api/v1/support/tickets/{ticket_id}", headers=user_headers)
        detail = res.json()["data"]
        assert len(detail["messages"]) == 2
        assert detail["messages"][-1]["content"] == "Investigating now"


# ── Satisfaction + admin stats ───────────────────────────────────────────────


def test_rate_ticket_and_admin_stats():
    with TestClient(app) as client:
        admin_headers = {"Authorization": f"Bearer {_admin_token(client)}"}
        user_headers = {"Authorization": f"Bearer {_user_token(client, email='sat@test.com')}"}

        res = client.post("/api/v1/support/tickets", json={
            "subject": "Resolve + rate",
            "message": "Fixed.",
        }, headers=user_headers)
        ticket_id = res.json()["data"]["id"]

        # Cannot rate before resolved.
        res = client.post(f"/api/v1/support/tickets/{ticket_id}/satisfaction",
                          json={"rating": 5}, headers=user_headers)
        assert res.status_code == 400

        client.post(f"/api/v1/admin/support/tickets/{ticket_id}/status",
                    json={"status": "resolved"}, headers=admin_headers)

        res = client.post(f"/api/v1/support/tickets/{ticket_id}/satisfaction",
                          json={"rating": 5}, headers=user_headers)
        assert res.status_code == 200
        assert res.json()["data"]["satisfaction_rating"] == 5

        res = client.get("/api/v1/admin/support/stats", headers=admin_headers)
        assert res.status_code == 200
        stats = res.json()["data"]
        assert stats["total"] >= 1
        assert "by_status" in stats
        assert "by_category" in stats
        assert stats["avg_satisfaction_rating"] == 5.0


# ── SLA breach check ─────────────────────────────────────────────────────────


def test_check_sla_breaches_detects_overdue():
    import asyncio
    from datetime import datetime, timedelta, timezone
    from app.db.mongodb import get_db
    from app.services.support_tickets import check_sla_breaches

    async def _seed():
        db = get_db()
        db.support_tickets.delete_many({})
        old = (datetime.now(timezone.utc) - timedelta(hours=48)).isoformat()
        await db.support_tickets.insert_one({
            "_id": "tkt-sla-overdue",
            "user_id": "u1", "user_email": "u1@test.com", "user_name": "U1",
            "subject": "Lost access", "message": "urgent", "category": "technical",
            "priority": "P1", "status": "open", "created_at": old,
            "updated_at": old, "resolved_at": None, "assigned_to": None,
            "satisfaction_rating": None, "ai_summary": "",
        })
        await db.support_tickets.insert_one({
            "_id": "tkt-sla-fresh",
            "user_id": "u2", "user_email": "u2@test.com", "user_name": "U2",
            "subject": "New ticket", "message": "hi", "category": "other",
            "priority": "P3", "status": "open", "created_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat(),
            "resolved_at": None, "assigned_to": None, "satisfaction_rating": None, "ai_summary": "",
        })

    asyncio.run(_seed())
    breaches = asyncio.run(check_sla_breaches())
    ids = [b["ticket_id"] for b in breaches]
    assert "tkt-sla-overdue" in ids
    assert "tkt-sla-fresh" not in ids
    overdue = next(b for b in breaches if b["ticket_id"] == "tkt-sla-overdue")
    assert overdue["priority"] == "P1"
    assert overdue["sla_hours"] == 4


# ── Knowledge base: admin CRUD + permissions ────────────────────────────────


def test_admin_knowledge_crud_and_regular_user_forbidden():
    with TestClient(app) as client:
        admin_headers = {"Authorization": f"Bearer {_admin_token(client)}"}
        user_headers = {"Authorization": f"Bearer {_user_token(client, email='kbl@test.com')}"}

        # Regular user cannot create articles.
        res = client.post("/api/v1/admin/help/articles", json={
            "title": "Nope", "content": "x", "summary": "x",
        }, headers=user_headers)
        assert res.status_code == 403

        # Admin creates.
        res = client.post("/api/v1/admin/help/articles", json={
            "title": "Refund Steps",
            "category": "billing",
            "content": "Step by step refund.",
            "summary": "How to request a refund.",
            "tags": ["refund"],
        }, headers=admin_headers)
        assert res.status_code == 200
        article_id = res.json()["data"]["id"]

        # Admin updates.
        res = client.put(f"/api/v1/admin/help/articles/{article_id}", json={
            "title": "Refund Steps Updated",
        }, headers=admin_headers)
        assert res.status_code == 200
        assert res.json()["data"]["title"] == "Refund Steps Updated"

        # Search finds it via tag.
        res = client.get("/api/v1/help/articles/search?q=refund")
        assert any(a["id"] == article_id or "refund" in a["title"].lower() for a in res.json()["data"])

        # Admin deletes.
        res = client.delete(f"/api/v1/admin/help/articles/{article_id}", headers=admin_headers)
        assert res.status_code == 200
        assert res.json()["data"]["deleted"] is True


def test_admin_assign_and_note():
    with TestClient(app) as client:
        admin_headers = {"Authorization": f"Bearer {_admin_token(client)}"}
        user_headers = {"Authorization": f"Bearer {_user_token(client, email='assign@test.com')}"}

        res = client.post("/api/v1/support/tickets", json={
            "subject": "Assign me",
            "message": "Please assign.",
        }, headers=user_headers)
        ticket_id = res.json()["data"]["id"]

        res = client.post(f"/api/v1/admin/support/tickets/{ticket_id}/assign",
                          json={"admin_id": "user-admin@ascendly.io"}, headers=admin_headers)
        assert res.status_code == 200
        assert res.json()["data"]["assigned_to"] == "user-admin@ascendly.io"

        res = client.post(f"/api/v1/admin/support/tickets/{ticket_id}/status",
                          json={"status": "in_progress", "note": "Investigating now"}, headers=admin_headers)
        assert res.status_code == 200
        assert res.json()["data"]["status"] == "in_progress"

        # The admin note is appended as a message (add_message path now imported).
        res = client.get(f"/api/v1/support/tickets/{ticket_id}", headers=user_headers)
        detail = res.json()["data"]
        assert len(detail["messages"]) == 2
        assert detail["messages"][-1]["content"] == "Investigating now"


def test_rate_ticket_and_admin_stats():
    with TestClient(app) as client:
        admin_headers = {"Authorization": f"Bearer {_admin_token(client)}"}
        user_headers = {"Authorization": f"Bearer {_user_token(client, email='sat@test.com')}"}

        res = client.post("/api/v1/support/tickets", json={
            "subject": "Resolve + rate",
            "message": "Fixed.",
        }, headers=user_headers)
        ticket_id = res.json()["data"]["id"]

        # Cannot rate before resolved.
        res = client.post(f"/api/v1/support/tickets/{ticket_id}/satisfaction",
                          json={"rating": 5}, headers=user_headers)
        assert res.status_code == 400

        client.post(f"/api/v1/admin/support/tickets/{ticket_id}/status",
                    json={"status": "resolved"}, headers=admin_headers)

        res = client.post(f"/api/v1/support/tickets/{ticket_id}/satisfaction",
                          json={"rating": 5}, headers=user_headers)
        assert res.status_code == 200
        assert res.json()["data"]["satisfaction_rating"] == 5

        res = client.get("/api/v1/admin/support/stats", headers=admin_headers)
        assert res.status_code == 200
        stats = res.json()["data"]
        assert stats["total"] >= 1
        assert "by_status" in stats
        assert "by_category" in stats
        assert stats["avg_satisfaction_rating"] == 5.0


def test_check_sla_breaches_detects_overdue():
    import asyncio
    from datetime import datetime, timedelta, timezone
    from app.db.mongodb import get_db
    from app.services.support_tickets import check_sla_breaches

    async def _seed():
        db = get_db()
        db.support_tickets.delete_many({})
        old = (datetime.now(timezone.utc) - timedelta(hours=48)).isoformat()
        await db.support_tickets.insert_one({
            "_id": "tkt-sla-overdue",
            "user_id": "u1", "user_email": "u1@test.com", "user_name": "U1",
            "subject": "Lost access", "message": "urgent", "category": "technical",
            "priority": "P1", "status": "open", "created_at": old,
            "updated_at": old, "resolved_at": None, "assigned_to": None,
            "satisfaction_rating": None, "ai_summary": "",
        })
        await db.support_tickets.insert_one({
            "_id": "tkt-sla-fresh",
            "user_id": "u2", "user_email": "u2@test.com", "user_name": "U2",
            "subject": "New ticket", "message": "hi", "category": "other",
            "priority": "P3", "status": "open", "created_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat(),
            "resolved_at": None, "assigned_to": None, "satisfaction_rating": None, "ai_summary": "",
        })

    asyncio.run(_seed())
    breaches = asyncio.run(check_sla_breaches())
    ids = [b["ticket_id"] for b in breaches]
    assert "tkt-sla-overdue" in ids
    assert "tkt-sla-fresh" not in ids
    overdue = next(b for b in breaches if b["ticket_id"] == "tkt-sla-overdue")
    assert overdue["priority"] == "P1"
    assert overdue["sla_hours"] == 4


def test_admin_knowledge_crud_and_regular_user_forbidden():
    with TestClient(app) as client:
        admin_headers = {"Authorization": f"Bearer {_admin_token(client)}"}
        user_headers = {"Authorization": f"Bearer {_user_token(client, email='kbl@test.com')}"}

        # Regular user cannot create articles.
        res = client.post("/api/v1/admin/help/articles", json={
            "title": "Nope", "content": "x", "summary": "x",
        }, headers=user_headers)
        assert res.status_code == 403

        # Admin creates.
        res = client.post("/api/v1/admin/help/articles", json={
            "title": "Refund Steps",
            "category": "billing",
            "content": "Step by step refund.",
            "summary": "How to request a refund.",
            "tags": ["refund"],
        }, headers=admin_headers)
        assert res.status_code == 200
        article_id = res.json()["data"]["id"]

        # Admin updates.
        res = client.put(f"/api/v1/admin/help/articles/{article_id}", json={
            "title": "Refund Steps Updated",
        }, headers=admin_headers)
        assert res.status_code == 200
        assert res.json()["data"]["title"] == "Refund Steps Updated"

        # Search finds it via tag.
        res = client.get("/api/v1/help/articles/search?q=refund")
        assert any(a["id"] == article_id or "refund" in a["title"].lower() for a in res.json()["data"])

        # Admin deletes.
        res = client.delete(f"/api/v1/admin/help/articles/{article_id}", headers=admin_headers)
        assert res.status_code == 200
        assert res.json()["data"]["deleted"] is True
