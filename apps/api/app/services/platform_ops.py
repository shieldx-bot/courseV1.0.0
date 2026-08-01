"""Platform Ops — the workflow engine that turns intelligence into action.

Platform Intelligence answers "what is happening?"; Platform Ops answers
"what should happen next?"  The core primitive is the Task System:

  Recommendations → Workflow → Task → Execution → Measurement → Outcome

Every task tracks: title, description, priority, category, status, owner,
created/due/completed times, related entity, related recommendation, and an
audit history. Tasks are created either manually or automatically by
`sync_from_intelligence()` which maps intelligence recommendations into
actionable workflows (deduplicated, with notification fan-out).

Reuses existing architecture: intelligence service, notifications service,
api_response/require_admin — no new infrastructure.
"""

import logging
from datetime import datetime, timedelta, timezone
from typing import Any, Optional

from app.db.mongodb import get_db, get_read_db

logger = logging.getLogger(__name__)


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _ts() -> int:
    return int(datetime.now(timezone.utc).timestamp() * 1000)


# ── Task categories (workflows) ──────────────────────────────────────────────

WORKFLOWS = {
    "challenge-quality": "Challenge Quality Review",
    "creator-verification": "Creator Verification Review",
    "moderation": "Moderation Investigation",
    "notification-optimization": "Notification Optimization",
    "ai-content": "AI Content Review",
    "learning-path": "Learning Path Improvement",
    "badge-rebalance": "Badge Rebalancing",
    "arena-balance": "Arena Balancing",
    "general": "General Investigation",
}

# Recommendation kind → workflow category (for automation)
REC_TO_WORKFLOW: dict[str, str] = {
    "challenge-abandoned": "challenge-quality",
    "challenge-quality": "challenge-quality",
    "creator-verify": "creator-verification",
    "creator-inactive": "creator-verification",
    "notifications-ignored": "notification-optimization",
    "moderation-backlog": "moderation",
}

VALID_STATUSES = {"open", "assigned", "in_progress", "resolved", "closed"}


# ── Core task operations ─────────────────────────────────────────────────────

async def create_task(
    title: str,
    description: str,
    *,
    priority: str = "info",  # critical | warning | info
    category: str = "general",
    owner: Optional[str] = None,
    due_days: Optional[int] = None,
    related_entity: Optional[dict] = None,   # {"type": "challenge", "id": "..."}
    related_recommendation: Optional[str] = None,
    actor: str = "system",
) -> dict:
    """Create an actionable task.

    Category must be a known workflow. Priority normalized to a valid value.
    Appends an initial audit entry (created by `actor`).
    """
    db = get_db()
    if category not in WORKFLOWS:
        return {"error": True, "message": f"Unknown workflow category: {category}"}
    if priority not in ("critical", "warning", "info"):
        priority = "info"

    tid = f"task-{_ts()}-{abs(hash(title)) % 100000}"
    now = _now()
    doc = {
        "_id": tid,
        "title": title,
        "description": description,
        "priority": priority,
        "category": category,
        "workflow": WORKFLOWS[category],
        "status": "open",
        "owner": owner,
        "created_at": now,
        "due_date": (datetime.now(timezone.utc) + timedelta(days=due_days)).isoformat() if due_days else None,
        "completed_at": None,
        "related_entity": related_entity,
        "related_recommendation": related_recommendation,
        "history": [
            {"ts": now, "actor": actor, "action": "created", "note": f"Task created ({category})"},
        ],
        "outcome": None,
    }
    await db.ops_tasks.insert_one(doc)
    return {"success": True, "task_id": tid, "task": doc}


async def list_tasks(status: Optional[str] = None, category: Optional[str] = None, limit: int = 50) -> list[dict]:
    db = get_read_db()
    query: dict[str, Any] = {}
    if status:
        query["status"] = status
    if category:
        query["category"] = category
    docs = await db.ops_tasks.find(query).sort("created_at", -1).to_list(length=limit)
    return docs


async def get_task(task_id: str) -> Optional[dict]:
    db = get_read_db()
    return await db.ops_tasks.find_one({"_id": task_id})


async def update_task_status(task_id: str, status: str, actor: str = "admin", note: str = "") -> dict:
    """Transition a task status and append an audit-history entry.

    From open → assigned/in_progress → resolved/closed. Closing sets completed_at.
    """
    db = get_db()
    if status not in VALID_STATUSES:
        return {"error": True, "message": f"Invalid status: {status}"}
    task = await db.ops_tasks.find_one({"_id": task_id})
    if not task:
        return {"error": True, "message": "Task not found."}

    now = _now()
    entries = list(task.get("history", []) or [])
    entries.append({"ts": now, "actor": actor, "action": status, "note": note or f"Moved to {status}"})
    updates: dict[str, Any] = {"status": status, "history": entries}
    if status in ("resolved", "closed"):
        updates["completed_at"] = now
    await db.ops_tasks.update_one({"_id": task_id}, {"$set": updates})
    updated = await db.ops_tasks.find_one({"_id": task_id})
    return {"success": True, "task": updated}


# ── Automation: intelligence → actionable tasks ──────────────────────────────

async def sync_from_intelligence(actor: str = "system") -> dict:
    """Pull intelligence recommendations and create tasks (deduplicated).

    Reuses `intelligence.self_recommendations()`. A task is only created if
    no OPEN task exists for the same (recommendation kind + entity id).
    """
    from app.services import intelligence as intel

    db = get_db()
    recs = await intel.self_recommendations()
    created: list[str] = []
    skipped = 0

    for rec in recs:
        kind = rec.get("kind")
        entity_id = rec.get("entity_id")
        category = REC_TO_WORKFLOW.get(kind)
        if not category:
            continue
        # Deduplicate: skip if an open task already exists for this seed
        existing = await db.ops_tasks.find_one({
            "related_recommendation": kind,
            "related_entity.id": entity_id,
            "status": {"$in": ["open", "assigned", "in_progress"]},
        })
        if existing:
            skipped += 1
            continue
        related = {"type": "critical" if rec.get("severity") == "critical" else "recommendation", "id": entity_id} if entity_id else None
        result = await create_task(
            title=WORKFLOWS[category],
            description=rec.get("message", ""),
            priority=rec.get("severity", "info"),
            category=category,
            related_entity=related,
            related_recommendation=kind,
            actor=actor,
        )
        if result.get("success"):
            created.append(result["task_id"])
            # Notify admins/watcher via existing notification system
            try:
                from app.services.notifications import create_notification
                await create_notification(
                    "user-admin@ascendly.io", "system_announcement",
                    {"note": f"New ops task: {WORKFLOWS[category]} — {rec.get('message', '')[:120]}"},
                    link="/admin/ops",
                )
            except Exception:
                pass

    return {"created": created, "created_count": len(created), "skipped_duplicates": skipped, "recommendations_seen": len(recs)}


async def overview() -> dict:
    """Operational dashboard: open tasks, critical incidents, recent decisions."""
    db = get_read_db()
    open_tasks = await db.ops_tasks.find({"status": {"$in": ["open", "assigned", "in_progress"]}}).sort("priority", 1).to_list(length=100)
    critical = [t for t in open_tasks if t.get("priority") == "critical"]
    recent = await db.ops_tasks.find({}).sort("created_at", -1).to_list(length=10)
    return {
        "open_tasks_count": len(open_tasks),
        "critical_count": len(critical),
        "open_tasks": open_tasks,
        "recent_decisions": [{"id": t["_id"], "title": t.get("title"), "status": t.get("status"), "owner": t.get("owner"), "updated_at": (t.get("history") or [{}])[-1].get("ts") if t.get("history") else t.get("created_at")} for t in recent],
        "generated_at": _now(),
    }