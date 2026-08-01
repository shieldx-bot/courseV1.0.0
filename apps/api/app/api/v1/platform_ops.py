"""Platform Ops API — workflow engine that turns intelligence into action."""
from typing import Optional

from fastapi import APIRouter, Depends, Query

from app.core.deps import require_admin
from app.core.response import api_response
from app.services import platform_ops as ops

router = APIRouter(prefix="/admin/ops", tags=["admin-ops"])
AdminDep = Depends(require_admin)


@router.get("/tasks")
async def list_tasks(status: Optional[str] = None, category: Optional[str] = None, limit: int = Query(50, ge=1, le=100), user: dict = AdminDep):
    return api_response({"tasks": await ops.list_tasks(status=status, category=category, limit=limit)})


@router.post("/tasks")
async def create_task(body: dict, user: dict = AdminDep):
    return api_response(await ops.create_task(
        body.get("title", "Untitled task"), body.get("description", ""),
        priority=body.get("priority", "info"), category=body.get("category", "general"),
        owner=body.get("owner"), due_days=body.get("due_days"),
        related_entity=body.get("related_entity"), related_recommendation=body.get("related_recommendation"),
        actor=user.get("id", "admin"),
    ))


@router.post("/tasks/{task_id}/status")
async def update_status(task_id: str, body: dict, user: dict = AdminDep):
    return api_response(await ops.update_task_status(task_id, body.get("status", "in_progress"), actor=user.get("id", "admin"), note=body.get("note", "")))


@router.post("/sync")
async def sync_tasks(user: dict = AdminDep):
    """Pull intelligence recommendations into tracked tasks (deduplicated)."""
    return api_response(await ops.sync_from_intelligence(actor=user.get("id", "admin")))


@router.get("/overview")
async def ops_overview(user: dict = AdminDep):
    return api_response(await ops.overview())