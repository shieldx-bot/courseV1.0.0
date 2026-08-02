"""Tests for the AI support service: RAG context, action detection, ticket
automation, user context injection, and the SSE streaming endpoint.

The LLM is always mocked — no real provider is ever called.
"""
import os

os.environ["MONGODB_URI"] = "memory://test"

import asyncio  # noqa: E402
from unittest.mock import AsyncMock, patch  # noqa: E402

from fastapi.testclient import TestClient  # noqa: E402

from app.main import app  # noqa: E402


def _run(coro):
    return asyncio.run(coro)


def _user_token(client, email="ai@test.com"):
    res = client.post("/api/v1/auth/signup", json={"email": email, "password": "password123", "name": "AI User"})
    body = res.json()
    if "data" in body:
        body = body["data"]
    return body["access_token"]


# ── RAG context building ─────────────────────────────────────────────────────


def test_build_context_includes_article_fields():
    from app.services.support_ai import _build_context

    articles = [{"_id": "a1", "title": "Cancel", "summary": "How to cancel", "content": "Go to Settings."}]
    ctx = _build_context(articles)
    assert "Cancel" in ctx
    assert "How to cancel" in ctx
    assert "Go to Settings." in ctx

    assert _build_context([]) == "No relevant articles found."


def test_search_articles_category_and_helpful_boost():
    from app.db.mongodb import get_db
    from app.services.knowledge_base import search_articles

    db = get_db()

    async def _seed():
        await db.help_articles.delete_many({"_id": {"$in": ["art-refund", "art-video"]}})
        await db.help_articles.insert_many([
            {
                "_id": "art-refund",
                "slug": "refund",
                "title": "Refund Policy",
                "category": "billing",
                "summary": "Money back guarantee for subscriptions.",
                "content": "Full refund within 30 days.",
                "tags": ["refund"],
                "is_published": True,
                "helpful_count": 20,
                "views": 0,
                "not_helpful_count": 0,
                "created_at": "2026-01-01T00:00:00+00:00",
                "updated_at": "2026-01-01T00:00:00+00:00",
            },
            {
                "_id": "art-video",
                "slug": "video",
                "title": "Video Not Playing",
                "category": "technical",
                "summary": "Troubleshooting streaming issues.",
                "content": "Clear your browser cache.",
                "tags": ["video"],
                "is_published": True,
                "helpful_count": 0,
                "views": 0,
                "not_helpful_count": 0,
                "created_at": "2026-01-01T00:00:00+00:00",
                "updated_at": "2026-01-01T00:00:00+00:00",
            },
        ])

    _run(_seed())

    # A billing query must rank the billing article first, boosted by
    # category affinity + helpful_count.
    results = _run(search_articles("I want a refund for my payment"))
    assert results, "expected at least one article"
    assert results[0]["_id"] == "art-refund"

    # A technical query must rank technical articles above billing ones.
    results = _run(search_articles("the video will not play"))
    assert results, "expected at least one article"
    assert results[0]["category"] == "technical"
    tech_pos = next(i for i, a in enumerate(results) if a["_id"] == "art-video")
    billing_pos = next(i for i, a in enumerate(results) if a["_id"] == "art-refund")
    assert tech_pos < billing_pos


# ── Chat: RAG + actions + user context ──────────────────────────────────────


def test_chat_detects_create_ticket_action():
    from app.services.support_ai import chat

    async def _run_chat():
        with patch("app.services.support_ai.is_llm_available", return_value=True):
            with patch(
                "app.services.support_ai.call_llm",
                new=AsyncMock(return_value="I can't resolve this here. [ACTION: create_ticket] - I'll create a ticket for you."),
            ):
                with patch("app.services.support_ai.search_articles", new=AsyncMock(return_value=[])):
                    return await chat("u-action", "I lost access to my account")

    result = _run(_run_chat())
    assert result["answer"]
    assert "create_ticket" not in result["answer"]
    assert any(a["type"] == "create_ticket" for a in result["actions"])


def test_chat_includes_user_context_in_prompt():
    from app.db.mongodb import get_db
    from app.services.support_ai import chat

    db = get_db()
    captured = {}

    async def _fake_call_llm(messages, max_tokens=800, temperature=0.4, **kwargs):
        captured["messages"] = messages
        return "You can cancel from Settings → Billing."

    async def _run_chat():
        await db.users.insert_one({"_id": "u-ctx", "email": "ctx@test.com", "name": "Context User", "role": "learner"})
        await db.subscriptions.insert_one({
            "_id": "sub-ctx",
            "user_id": "u-ctx",
            "tier": "1mo",
            "status": "active",
            "starts_at": "2026-01-01T00:00:00+00:00",
            "ends_at": "2026-02-01T00:00:00+00:00",
        })
        with patch("app.services.support_ai.is_llm_available", return_value=True):
            with patch("app.services.support_ai.call_llm", new=AsyncMock(side_effect=_fake_call_llm)):
                with patch("app.services.support_ai.search_articles", new=AsyncMock(return_value=[])):
                    return await chat("u-ctx", "How do I cancel?")

    result = _run(_run_chat())
    assert result["answer"]
    system_prompt = captured["messages"][0]["content"]
    assert "active plan '1mo'" in system_prompt
    assert "Context User" in system_prompt


def test_chat_returns_articles_action():
    from app.services.support_ai import chat

    articles = [{"_id": "a-cancel", "title": "Cancel subscription", "slug": "cancel", "summary": "s", "content": "c"}]

    async def _run_chat():
        with patch("app.services.support_ai.is_llm_available", return_value=True):
            with patch("app.services.support_ai.call_llm", new=AsyncMock(return_value="Go to Settings.")):
                with patch("app.services.support_ai.search_articles", new=AsyncMock(return_value=articles)):
                    return await chat("u-art", "How do I cancel my subscription?")

    result = _run(_run_chat())
    assert any(a["type"] == "articles" for a in result["actions"])


def test_chat_llm_unavailable_fallback():
    from app.services.support_ai import chat

    result = _run(chat("u-fallback", "hello"))
    assert result["error"] == "LLM not configured"
    assert "not available" in result["answer"]


# ── Ticket automation ────────────────────────────────────────────────────────


def test_create_ticket_from_conversation():
    from app.db.mongodb import get_db
    from app.services.support_ai import create_ticket_from_conversation

    db = get_db()

    async def _go():
        await db.users.insert_one({"_id": "u-ticket", "email": "ticket@test.com", "name": "Ticket User"})
        return await create_ticket_from_conversation(
            "u-ticket",
            "I was charged twice on my card",
            "Our team will review the double charge and refund it.",
        )

    ticket = _run(_go())
    assert ticket["user_id"] == "u-ticket"
    assert ticket["category"] == "billing"
    assert ticket["status"] == "open"
    assert "charged" in ticket["subject"]
    assert "double charge" in ticket["ai_summary"]


def test_escalate_to_human():
    from app.db.mongodb import get_db
    from app.services.support_tickets import create_ticket, escalate_to_human, get_ticket_messages

    db = get_db()

    async def _go():
        await db.users.insert_one({"_id": "u-esc", "email": "esc@test.com", "name": "Esc User"})
        ticket = await create_ticket("u-esc", "esc@test.com", "Esc User", "Need a human", "Please escalate me")
        updated = await escalate_to_human(ticket["_id"], "User requested a human agent")
        messages = await get_ticket_messages(ticket["_id"])
        return updated, messages

    updated, messages = _run(_go())
    assert updated["status"] == "in_progress"
    assert updated["escalated"] is True
    assert updated["escalation_reason"] == "User requested a human agent"
    assert any("User requested a human agent" in m["content"] for m in messages)


# ── API endpoints ────────────────────────────────────────────────────────────


def test_convert_chat_to_ticket_endpoint():
    with TestClient(app) as client:
        token = _user_token(client, email="conv@test.com")
        headers = {"Authorization": f"Bearer {token}"}

        res = client.post("/api/v1/support/chat/convert-to-ticket", json={
            "question": "My video is buffering endlessly",
            "answer": "Our team will investigate the stream.",
        }, headers=headers)
        assert res.status_code == 200
        data = res.json()["data"]
        assert data["status"] == "open"
        assert data["category"] == "technical"
        assert data["ai_summary"] == "Our team will investigate the stream."


def test_escalate_endpoint():
    with TestClient(app) as client:
        token = _user_token(client, email="escep@test.com")
        headers = {"Authorization": f"Bearer {token}"}

        res = client.post("/api/v1/support/tickets", json={
            "subject": "Escalate me",
            "message": "I need a human.",
        }, headers=headers)
        ticket_id = res.json()["data"]["id"]

        res = client.post(f"/api/v1/support/tickets/{ticket_id}/escalate",
                          json={"reason": "Complex issue"}, headers=headers)
        assert res.status_code == 200
        data = res.json()["data"]
        assert data["status"] == "in_progress"
        assert data["escalated"] is True

        # Another user cannot escalate someone else's ticket.
        other_token = _user_token(client, email="other@test.com")
        other_headers = {"Authorization": f"Bearer {other_token}"}
        res = client.post(f"/api/v1/support/tickets/{ticket_id}/escalate",
                          json={"reason": "Nope"}, headers=other_headers)
        assert res.status_code == 403


def test_chat_stream_sse_event_sequence():
    chunks = ["Hello", " there", ". [ACTION: create_ticket]"]

    async def _fake_stream(messages, max_tokens=800, temperature=0.4, **kwargs):
        for chunk in chunks:
            yield chunk

    with TestClient(app) as client:
        token = _user_token(client, email="sse@test.com")
        headers = {"Authorization": f"Bearer {token}"}

        with patch("app.services.support_ai.is_llm_available", return_value=True):
            with patch("app.services.support_ai.call_llm_stream", new=_fake_stream):
                with patch(
                    "app.services.support_ai.search_articles",
                    new=AsyncMock(return_value=[{"_id": "a-sse", "title": "Cancel", "slug": "cancel", "summary": "s", "content": "c"}]),
                ):
                    with client.stream("POST", "/api/v1/support/chat/stream",
                                       json={"message": "hi"}, headers=headers) as res:
                        assert res.status_code == 200
                        assert res.headers["content-type"].startswith("text/event-stream")
                        body = "".join(res.iter_text())

        assert "event: context" in body
        assert "event: message" in body
        assert "event: actions" in body
        assert "event: done" in body
        # Order matters: context → messages → actions → done.
        assert body.index("event: context") < body.index("event: message")
        assert body.index("event: message") < body.index("event: actions")
        assert body.index("event: actions") < body.index("event: done")
        # Message chunks must be delivered in order.
        assert body.index("Hello") < body.index(" there")
        # The create_ticket marker surfaced as an action, not in the streamed text.
        assert body.index('"type": "create_ticket"') > 0


def test_chat_stream_persists_history():
    from app.db.mongodb import get_db

    async def _fake_stream(messages, max_tokens=800, temperature=0.4, **kwargs):
        yield "Persistence works."

    with TestClient(app) as client:
        token = _user_token(client, email="ssepersist@test.com")
        headers = {"Authorization": f"Bearer {token}"}

        with patch("app.services.support_ai.is_llm_available", return_value=True):
            with patch("app.services.support_ai.call_llm_stream", new=_fake_stream):
                with patch("app.services.support_ai.search_articles", new=AsyncMock(return_value=[])):
                    with client.stream("POST", "/api/v1/support/chat/stream",
                                       json={"message": "remember me"}, headers=headers) as res:
                        assert res.status_code == 200
                        "".join(res.iter_text())

        res = client.get("/api/v1/support/chat/history", headers=headers)
        history = res.json()["data"]
        assert len(history) >= 2
        assert history[-1]["content"] == "Persistence works."
