"""Trust & Moderation services — reports, review queue, moderation actions.

Extracted from the former `ecosystem` monolith (Phase 7 hardening) without any
behavioral change. `app/services/ecosystem.py` remains a facade re-exporting
this public API, so call sites never change.
"""

import logging
from datetime import datetime, timezone
from typing import Any

from app.core.collections import Collections as C
from app.db.mongodb import get_db, get_read_db
from app.services.creator import _load_challenges_batch, _load_users_batch

logger = logging.getLogger(__name__)


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _ts() -> int:
    return int(datetime.now(timezone.utc).timestamp() * 1000)


MODERATION_CATEGORIES = {
    "spam": "Spam",
    "abuse": "Abuse / Harassment",
    "inappropriate": "Inappropriate Content",
    "copyright": "Copyright Violation",
    "low_quality": "Low Quality",
    "cheating": "Cheating / Plagiarism",
    "other": "Other",
}


async def submit_report(user_id: str, body: dict) -> dict:
    db = get_db()
    rid = f"rep-{_ts()}"
    category = body.get("category", "other")
    if category not in MODERATION_CATEGORIES:
        return {"error": True, "message": "Invalid category."}
    doc = {
        "_id": rid,
        "reporter_id": user_id,
        "target_type": body.get("target_type", ""),  # challenge | user | discussion | comment | collection | event
        "target_id": body.get("target_id", ""),
        "category": category,
        "reason": body.get("reason", ""),
        "status": "pending",  # pending | reviewing | resolved | dismissed
        "created_at": _now(),
        "updated_at": _now(),
    }
    await db[C.MODERATION_REPORTS].insert_one(doc)

    # Publish domain event — moderation queue / admin notification domains react.
    from app.core.events import Event, bus
    await bus.publish(Event(
        name="ReportSubmitted",
        producer="moderation.submit_report",
        payload={
            "report_id": rid,
            "reporter_id": user_id,
            "target_type": doc["target_type"],
            "target_id": doc["target_id"],
            "category": category,
        },
    ))
    return {"success": True, "report_id": rid}


async def list_moderation_queue(status: str = "pending", limit: int = 50) -> list[dict]:
    db = get_read_db()
    query: dict[str, Any] = {}
    if status:
        query["status"] = status
    docs = await db[C.MODERATION_REPORTS].find(query).sort("created_at", 1).to_list(length=limit)
    reporters = await _load_users_batch(db, [d.get("reporter_id") for d in docs])
    challenge_targets = await _load_challenges_batch(db, [d.get("target_id") for d in docs if d.get("target_type") == "challenge"])
    user_targets = await _load_users_batch(db, [d.get("target_id") for d in docs if d.get("target_type") == "user"])
    discussion_ids = [d.get("target_id") for d in docs if d.get("target_type") == "discussion"]
    discussions = {}
    if discussion_ids:
        ddocs = await db[C.DISCUSSIONS].find({"$or": [{"_id": c} for c in discussion_ids]}).to_list(length=len(discussion_ids))
        discussions = {d["_id"]: d for d in ddocs}
    out = []
    for d in docs:
        reporter = reporters.get(d.get("reporter_id"))
        target = None
        if d.get("target_type") == "challenge":
            target_doc = challenge_targets.get(d.get("target_id"))
            target = {"id": d["target_id"], "title": target_doc.get("title", "") if target_doc else "Unknown", "creator_id": target_doc.get("creator_id") if target_doc else None} if target_doc else {"id": d["target_id"], "title": "Unknown"}
        elif d.get("target_type") == "user":
            t = user_targets.get(d.get("target_id"))
            target = {"id": d["target_id"], "title": t.get("name", "Unknown") if t else "Unknown"}
        elif d.get("target_type") == "discussion":
            t = discussions.get(d.get("target_id"))
            target = {"id": d["target_id"], "title": t.get("title", "Unknown") if t else "Unknown"}
        out.append({
            "id": d["_id"],
            "reporter_id": d.get("reporter_id"),
            "reporter_name": reporter.get("name", "Anonymous") if reporter else "Anonymous",
            "target_type": d.get("target_type", ""),
            "target": target,
            "category": d.get("category", "other"),
            "category_label": MODERATION_CATEGORIES.get(d.get("category", "other"), "Other"),
            "reason": d.get("reason", ""),
            "status": d.get("status", "pending"),
            "created_at": d.get("created_at", ""),
        })
    return out


async def resolve_report(reviewer_id: str, report_id: str, action: str, note: str = "") -> dict:
    db = get_db()
    report = await db[C.MODERATION_REPORTS].find_one({"_id": report_id})
    if not report:
        return {"error": True, "message": "Report not found."}
    status = "resolved" if action in ("warn", "remove", "ban") else "dismissed"
    updates: dict[str, Any] = {
        "status": status, "reviewer_id": reviewer_id, "review_note": note,
        "action_taken": action, "updated_at": _now(),
    }
    await db[C.MODERATION_REPORTS].update_one({"_id": report_id}, {"$set": updates})

    # Apply action
    if action == "remove" and report.get("target_type"):
        target_id = report.get("target_id")
        if report["target_type"] == "challenge" and target_id:
            await db[C.CHALLENGES].update_one({"_id": target_id}, {"$set": {"status": "removed", "removal_note": note}})
        elif report["target_type"] == "discussion" and target_id:
            await db[C.DISCUSSIONS].update_one({"_id": target_id}, {"$set": {"is_locked": True, "is_removed": True}})
        elif report["target_type"] == "user" and target_id:
            await db[C.USERS].update_one({"_id": target_id}, {"$set": {"moderation_flag": "restricted"}})
    elif action == "warn" and report.get("target_type") == "user":
        target_id = report.get("target_id")
        if target_id:
            await db[C.USERS].update_one({"_id": target_id}, {"$inc": {"warnings": 1}})

    # Publish domain event — reporter / target notification domains react.
    from app.core.events import Event, bus
    await bus.publish(Event(
        name="ModerationCompleted",
        producer="moderation.resolve_report",
        payload={
            "report_id": report_id,
            "reporter_id": report.get("reporter_id"),
            "target_type": report.get("target_type", ""),
            "target_id": report.get("target_id"),
            "action": action,
            "status": status,
            "reviewer_id": reviewer_id,
        },
    ))
    return {"success": True, "status": status}


async def moderation_stats() -> dict:
    db = get_read_db()
    total = await db[C.MODERATION_REPORTS].count_documents({})
    pending = await db[C.MODERATION_REPORTS].count_documents({"status": "pending"})
    resolved = await db[C.MODERATION_REPORTS].count_documents({"status": "resolved"})
    dismissed = await db[C.MODERATION_REPORTS].count_documents({"status": "dismissed"})
    # In-memory DB lacks aggregation — compute category stats client-side
    by_category: dict[str, int] = {}
    try:
        cursor = db[C.MODERATION_REPORTS].aggregate([{"$group": {"_id": "$category", "count": {"$sum": 1}}}])
        async for doc in cursor:
            if doc["_id"]:
                by_category[doc["_id"]] = doc["count"]
    except Exception:
        all_reports = await db[C.MODERATION_REPORTS].find({}).to_list(length=100000)
        for r in all_reports:
            cat = r.get("category", "other")
            by_category[cat] = by_category.get(cat, 0) + 1
    return {
        "total": total, "pending": pending, "resolved": resolved, "dismissed": dismissed,
        "by_category": by_category,
    }
