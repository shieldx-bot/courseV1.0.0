"""Unified Notification API — list, read, and preferences."""

from typing import Optional

from fastapi import APIRouter, Depends, Query

from app.core.deps import get_current_user
from app.core.response import api_response
from app.services import notifications as notif

router = APIRouter(prefix="/notifications", tags=["notifications"])
UserDep = Depends(get_current_user)


@router.get("")
async def list_notifications(
    unread_only: bool = Query(False),
    limit: int = Query(50, ge=1, le=100),
    before: Optional[str] = None,
    user: dict = UserDep,
):
    result = await notif.list_notifications(user["id"], unread_only=unread_only, limit=limit, before=before)
    return api_response(result)


@router.get("/unread-count")
async def unread_count(user: dict = UserDep):
    count = await notif.get_unread_count(user["id"])
    return api_response({"unread_count": count})


@router.post("/{notification_id}/read")
async def mark_read(notification_id: str, user: dict = UserDep):
    result = await notif.mark_notification_read(user["id"], notification_id)
    return api_response(result)


@router.post("/read-all")
async def mark_all_read(user: dict = UserDep):
    result = await notif.mark_all_read(user["id"])
    return api_response(result)


@router.get("/preferences")
async def get_prefs(user: dict = UserDep):
    result = await notif.get_preferences(user["id"])
    return api_response(result)


@router.put("/preferences")
async def update_prefs(body: dict, user: dict = UserDep):
    result = await notif.update_preferences(user["id"], body)
    return api_response(result)