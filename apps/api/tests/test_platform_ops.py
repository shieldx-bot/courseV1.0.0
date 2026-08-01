"""Tests for Platform Ops — task system that turns intelligence into action."""
import os

os.environ["MONGODB_URI"] = "memory://test"

import asyncio

from app.services import platform_ops as ops


def _await(coro):
    return asyncio.run(coro)


def _reset_db():
    from app.db.mongodb import get_db
    db = get_db()
    _await(db.ops_tasks.delete_many({}))


def test_create_task_lifecycle():
    """Create → update status → audit history + completion timestamp."""
    _reset_db()
    r = _await(ops.create_task("Fix abandoned challenge", "Completion rate is 5%", priority="critical", category="challenge-quality", actor="admin"))
    assert r["success"] is True
    tid = r["task_id"]
    task = r["task"]
    assert task["status"] == "open"
    assert task["workflow"] == "Challenge Quality Review"
    assert len(task["history"]) == 1

    r2 = _await(ops.update_task_status(tid, "in_progress", actor="admin-2", note="Investigating"))
    assert r2["success"] is True
    assert r2["task"]["status"] == "in_progress"
    assert r2["task"]["history"][-1]["actor"] == "admin-2"

    r3 = _await(ops.update_task_status(tid, "resolved", actor="admin", note="Fixed"))
    assert r3["success"] is True
    assert r3["task"]["status"] == "resolved"
    assert r3["task"]["completed_at"] is not None
    assert r3["task"]["history"][-1]["action"] == "resolved"


def test_update_status_errors():
    """Invalid statuses and missing tasks return proper errors."""
    _reset_db()
    bad = _await(ops.update_task_status("nope", "bogus"))
    assert bad.get("error") is True
    missing = _await(ops.update_task_status("nope", "resolved"))
    assert missing.get("error") is True


def test_sync_from_intelligence_deduplicates():
    """Recommendations create tasks; second sync doesn't duplicate."""
    _reset_db()
    r1 = _await(ops.sync_from_intelligence(actor="system"))
    assert "created_count" in r1
    first_count = r1["created_count"]

    r2 = _await(ops.sync_from_intelligence(actor="system"))
    assert r2["created_count"] == 0
    assert r2["skipped_duplicates"] >= first_count


def test_overview_reports_counts():
    """Overview shows open tasks, critical count, recent decisions."""
    _reset_db()
    _await(ops.create_task("Critical incident", "Something broke", priority="critical", category="general", actor="admin"))
    _await(ops.create_task("Info task", "Just info", priority="info", category="challenge-quality", actor="admin"))

    data = _await(ops.overview())
    assert data["open_tasks_count"] == 2
    assert data["critical_count"] == 1
    assert len(data["recent_decisions"]) == 2