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


def test_retention_cleanup_iso_string_collections_never_skipped():
    """CO1: activity_events/notifications store ISO strings, which MongoDB TTL
    cannot expire — the cron must ALWAYS run the explicit delete (status
    success), never skip based on a TTL index definition."""
    from app.core.tasks import run_retention_cleanup

    db = get_db()
    db.activity_events.data.clear()
    db.notifications.data.clear()
    db.intelligence_snapshots.data.clear()

    # Simulate MongoDB owning expiry for intelligence_snapshots only (real TTL
    # on `expire_at`); the in-memory backend has no index metadata, so stub it.
    async def _stub_index_info():
        return {"expire_at_1_ttl": {"expireAfterSeconds": 0}}

    db.intelligence_snapshots.index_information = _stub_index_info
    try:
        result = asyncio.run(run_retention_cleanup({"job_try": 0}))
    finally:
        del db.intelligence_snapshots.index_information

    assert result["collections"]["activity_events"]["status"] == "success"
    assert result["collections"]["notifications"]["status"] == "success"
    assert result["collections"]["intelligence_snapshots"]["status"] == "skipped"
    assert result["collections"]["intelligence_snapshots"]["reason"] == "ttl_index"


def test_retention_cleanup_mixed_offset_iso_parsing():
    """CO1: ISO timestamps with non-UTC offsets must compare by parsed instant,
    not lexicographically. A doc 1 minute older than the cutoff, written in
    +07:00, sorts AFTER the cutoff string yet must still be deleted."""
    from datetime import timedelta

    from app.core.tasks import run_retention_cleanup

    db = get_db()
    db.activity_events.data.clear()
    db.notifications.data.clear()
    db.intelligence_snapshots.data.clear()

    now = datetime.now(timezone.utc)
    tz_hanoi = timezone(timedelta(hours=7))

    async def seed():
        # Instant: cutoff - 1 minute (must be deleted), rendered in +07:00 so
        # its wall-clock string sorts ABOVE the UTC cutoff string.
        just_before_cutoff = (now - timedelta(days=180) - timedelta(minutes=1)).astimezone(tz_hanoi)
        recent = now - timedelta(days=1)
        await db.activity_events.insert_one({
            "_id": "act-old-offset", "user_id": "u1", "type": "challenge_completed",
            "payload": {}, "visibility": "public", "created_at": just_before_cutoff.isoformat(),
        })
        await db.activity_events.insert_one({
            "_id": "act-recent-offset", "user_id": "u1", "type": "challenge_completed",
            "payload": {}, "visibility": "public", "created_at": recent.isoformat(),
        })

    asyncio.run(seed())
    result = asyncio.run(run_retention_cleanup({"job_try": 0}))

    ids = {d["_id"] for d in db.activity_events.data}
    assert "act-old-offset" not in ids
    assert "act-recent-offset" in ids
    assert result["collections"]["activity_events"]["deleted"] == 1


def test_retention_cleanup_m9_counter_labels():
    """CO1: M9 retention_cleanup_runs_total{collection,status} increments per
    collection with the real status emitted by the job."""
    from app.core import telemetry
    from app.core.tasks import run_retention_cleanup

    db = get_db()
    db.activity_events.data.clear()
    db.notifications.data.clear()
    db.intelligence_snapshots.data.clear()

    counter = telemetry.RETENTION_CLEANUP_RUNS
    before_success = {
        coll: counter.labels(collection=coll, status="success")._value.get()
        for coll in ("activity_events", "notifications", "intelligence_snapshots")
    }
    before_error = {
        coll: counter.labels(collection=coll, status="error")._value.get()
        for coll in ("activity_events", "notifications", "intelligence_snapshots")
    }

    asyncio.run(run_retention_cleanup({"job_try": 0}))

    for coll in ("activity_events", "notifications", "intelligence_snapshots"):
        assert (
            counter.labels(collection=coll, status="success")._value.get()
            == before_success[coll] + 1
        ), f"M9 did not increment success for {coll}"
        assert (
            counter.labels(collection=coll, status="error")._value.get()
            == before_error[coll]
        ), f"M9 error incremented unexpectedly for {coll}"
