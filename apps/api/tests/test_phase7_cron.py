"""Tests for Phase 7 cron wiring + retention cleanup (NV2).

Asserts the arq cron schedule (snapshot 01:30, sync 05:00, retention 06:00) is
registered in WorkerSettings.cron_jobs, and that the retention job deletes
only documents older than the retention window (the in-memory backend has no
TTL index, so the explicit-cleanup fallback path is exercised).
"""
import asyncio
from datetime import datetime, timedelta, timezone

from app.db.mongodb import get_db
from app.worker import WorkerSettings


def _iso(days_ago: int) -> str:
    return (datetime.now(timezone.utc) - timedelta(days=days_ago)).isoformat()


def test_phase7_crons_registered():
    schedule = {
        c.name: (c.hour, c.minute)
        for c in WorkerSettings.cron_jobs
        if c.name in ("cron:run_intelligence_snapshot", "cron:run_intelligence_sync", "cron:run_retention_cleanup")
    }
    assert schedule.get("cron:run_intelligence_snapshot") == (1, 30), schedule
    assert schedule.get("cron:run_intelligence_sync") == (5, 0), schedule
    assert schedule.get("cron:run_retention_cleanup") == (6, 0), schedule


def test_intelligence_snapshot_task_runs_or_skips():
    """Must return a structured result whether or not AI-A has delivered."""
    from app.core.tasks import run_intelligence_snapshot, run_intelligence_sync

    result_snap = asyncio.run(run_intelligence_snapshot({"job_try": 0}))
    result_sync = asyncio.run(run_intelligence_sync({"job_try": 0}))
    assert result_snap["status"] in ("success", "skipped"), result_snap
    assert result_sync["status"] in ("success", "skipped"), result_sync


def test_retention_cleanup_deletes_only_expired_documents():
    from app.core.tasks import run_retention_cleanup

    db = get_db()
    db.activity_events.data.clear()
    db.notifications.data.clear()
    db.intelligence_snapshots.data.clear()

    async def seed():
        await db.activity_events.insert_one({
            "_id": "act-old-1", "user_id": "u1", "type": "challenge_completed",
            "payload": {}, "visibility": "public", "created_at": _iso(200),
        })
        await db.activity_events.insert_one({
            "_id": "act-recent-1", "user_id": "u1", "type": "challenge_completed",
            "payload": {}, "visibility": "public", "created_at": _iso(1),
        })
        await db.notifications.insert_one({
            "_id": "notif-old-1", "user_id": "u1", "type": "system_announcement",
            "title": "old", "body": "old", "is_read": False, "created_at": _iso(100),
        })
        await db.notifications.insert_one({
            "_id": "notif-recent-1", "user_id": "u1", "type": "system_announcement",
            "title": "recent", "body": "recent", "is_read": False, "created_at": _iso(1),
        })
        await db.intelligence_snapshots.insert_one({
            "_id": "snap-old-1", "type": "overview", "data": {}, "generated_at": _iso(40),
        })
        await db.intelligence_snapshots.insert_one({
            "_id": "snap-recent-1", "type": "overview", "data": {}, "generated_at": _iso(1),
        })

    asyncio.run(seed())
    result = asyncio.run(run_retention_cleanup({"job_try": 0}))

    activity_ids = {d["_id"] for d in db.activity_events.data}
    notification_ids = {d["_id"] for d in db.notifications.data}
    snapshot_ids = {d["_id"] for d in db.intelligence_snapshots.data}

    assert "act-old-1" not in activity_ids and "act-recent-1" in activity_ids
    assert "notif-old-1" not in notification_ids and "notif-recent-1" in notification_ids
    assert "snap-old-1" not in snapshot_ids and "snap-recent-1" in snapshot_ids

    collections = result["collections"]
    assert collections["activity_events"]["deleted"] == 1
    assert collections["notifications"]["deleted"] == 1
    assert collections["intelligence_snapshots"]["deleted"] == 1
