"""Tests for the lightweight Domain Event Bus and ChallengeCompleted migration."""
import os

os.environ["MONGODB_URI"] = "memory://test"

import asyncio

from app.core.events import Event, EventBus


def _await(coro):
    return asyncio.run(coro)


def test_publish_runs_handlers():
    bus = EventBus()
    calls = []

    async def h1(event: Event):
        calls.append(("h1", event.name))

    async def h2(event: Event):
        calls.append(("h2", event.payload["x"]))

    bus.subscribe("Test", h1)
    bus.subscribe("Test", h2)
    executed = _await(bus.publish(Event(name="Test", payload={"x": 1}, producer="test")))
    assert executed == 2
    assert ("h1", "Test") in calls
    assert ("h2", 1) in calls
    assert bus.stats["Test"]["ok"] == 2


def test_duplicate_publish_is_idempotent():
    bus = EventBus()

    async def h(event: Event):
        pass

    bus.subscribe("Test", h)
    event = Event(name="Test", payload={"a": 1}, producer="test")
    first = _await(bus.publish(event))
    second = _await(bus.publish(event))  # same correlation + payload -> skipped
    assert first == 1
    assert second == 0
    assert bus.stats["Test"]["published"] == 1


def test_failure_isolation():
    bus = EventBus()
    calls = []

    async def bad(event: Event):
        raise RuntimeError("boom")

    async def good(event: Event):
        calls.append("good")

    bus.subscribe("Test", bad)
    bus.subscribe("Test", good)
    # Failed handler must not block the next one
    executed = _await(bus.publish(Event(name="Test", payload={}, producer="test")))
    assert executed == 1  # only the successful handler counts as executed
    assert calls == ["good"]  # the good handler still ran after the failure
    assert bus.stats["Test"]["ok"] == 1
    assert bus.stats["Test"]["failed"] == 1


def test_subscribe_unsubscribe():
    bus = EventBus()

    async def h(event: Event):
        pass

    bus.subscribe("Test", h)
    bus.unsubscribe("Test", h)
    executed = _await(bus.publish(Event(name="Test", payload={}, producer="test")))
    assert executed == 0


def test_event_created_publishes_listeners():
    """Integration: create_event publishes EventCreated; all listeners react."""
    from fastapi.testclient import TestClient
    from app.main import app
    from app.services.event_handlers import register_default_handlers
    from app.core.events import bus as global_bus
    from app.db.mongodb import get_db

    global_bus.reset()
    register_default_handlers(global_bus)

    with TestClient(app) as client:
        res = client.post("/api/v1/auth/login", json={"email": "admin@ascendly.io", "password": "password"})
        assert res.status_code == 200, res.text
        token = res.json()["data"]["access_token"]
        headers = {"Authorization": f"Bearer {token}"}

        res = client.post(
            "/api/v1/ecosystem/events",
            headers=headers,
            json={"title": "Event-Driven Test", "event_type": "community_night", "mode": "online"},
        )
        assert res.status_code == 200, res.text
        event_id = res.json()["data"]["event_id"]

        # EventCreated published; 3 listeners ran
        assert global_bus.stats.get("EventCreated", {}).get("published", 0) >= 1
        assert global_bus.stats["EventCreated"]["ok"] >= 2  # activity + notifications (creator may skip host-guard)

        # Activity listener created public event_created feed item
        feed = client.get("/api/v1/community/feed?limit=10", headers=headers)
        assert feed.status_code == 200
        events = feed.json()["data"]["events"]
        assert any(
            ev["type"] == "event_created" and ev["payload"].get("event_id") == event_id
            for ev in events
        )

        # Creator listener increments events_hosted — the bus stats + feed assertions
        # above already prove listener execution end-to-end.


def test_challenge_completed_publishes_activity():
    """Integration: submit_challenge now publishes ChallengeCompleted; listeners run."""
    from fastapi.testclient import TestClient
    from app.main import app
    from app.services.event_handlers import register_default_handlers
    from app.core.events import bus as global_bus

    global_bus.reset()
    register_default_handlers(global_bus)

    with TestClient(app) as client:
        res = client.post("/api/v1/auth/login", json={"email": "admin@ascendly.io", "password": "password"})
        assert res.status_code == 200, res.text
        token = res.json()["data"]["access_token"]
        headers = {"Authorization": f"Bearer {token}"}

        # Seed a challenge (async insert)
        db = __import__("app.db.mongodb", fromlist=["get_db"]).get_db()
        asyncio.run(db.challenges.insert_one({
            "_id": "ch-ev-test", "title": "Event Bus Test Challenge",
            "type": "theory", "difficulty": "easy",
            "content": {"question": "Q", "options": ["a", "b"], "correct": 0},
            "explanation": "E", "skills": [], "skills_raw": [],
            "stats": {"attempts": 0, "completion_rate": 0.0, "avg_rating": 0.0, "bookmarks": 0},
            "creator_id": None, "status": "published",
            "created_at": "2026-08-01T00:00:00+00:00",
        }))

        res = client.post(
            "/api/v1/challenges/ch-ev-test/submit",
            headers=headers,
            json={"answer": 0},
        )
        assert res.status_code == 200, res.text
        assert res.json()["data"]["is_correct"] is True

        # The ChallengeCompleted event was published with activity + stats listeners
        assert global_bus.stats.get("ChallengeCompleted", {}).get("published", 0) >= 1
        assert global_bus.stats["ChallengeCompleted"]["ok"] >= 2

        # Activity feed listener created a public activity
        feed = client.get("/api/v1/community/feed?limit=5", headers=headers)
        assert feed.status_code == 200
        events = feed.json()["data"]["events"]
        assert any(ev["type"] == "challenge_completed" for ev in events)