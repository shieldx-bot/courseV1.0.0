"""Tests for Platform Intelligence — self-observing health KPIs + recommendations."""
import os

os.environ["MONGODB_URI"] = "memory://test"

import asyncio

from app.services import intelligence as intel


def _await(coro):
    return asyncio.run(coro)


def test_platform_health_shape():
    """Health KPIs: DAU/WAU/MAU, retention, success rate, creator growth, CTR."""
    data = _await(intel.platform_health())
    assert "users_total" in data
    assert "active_users" in data
    assert {"dau", "wau", "mau"} <= set(data["active_users"])
    assert "retention" in data
    assert "avg_session_minutes" in data
    assert "challenge_success_rate" in data
    assert "notification_ctr" in data
    assert data["active_users"]["dau"] >= 0


def test_challenge_intelligence_returns_list():
    data = _await(intel.challenge_intelligence())
    assert isinstance(data, list)
    for row in data:
        assert "challenge_id" in row
        assert "completion_rate" in row
        assert "signals" in row


def test_self_recommendations_ordered():
    """Recommendations sorted critical → warning → info, with entity refs."""
    recs = _await(intel.self_recommendations())
    order = {"critical": 0, "warning": 1, "info": 2}
    levels = [order[r["severity"]] for r in recs]
    assert levels == sorted(levels)
    for r in recs:
        assert r["message"]
        assert "entity_id" in r


def test_overview_shapes():
    """Admin overview bundles health + urgent + growth."""
    data = _await(intel.overview())
    assert "health" in data
    assert "recommendations" in data
    assert "urgent_problems" in data
    assert "growth_opportunities" in data
    assert data["urgent_problems"] == [r for r in data["recommendations"] if r["severity"] == "critical"]