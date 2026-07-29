"""Proactive support endpoints.

Internal/worker-facing routes for behavioral event tracking and
periodic intervention checks.
"""

from datetime import datetime, timezone, timedelta
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field

from app.core.deps import get_current_user, require_admin
from app.core.response import api_response
from app.db.mongodb import get_db
from app.services.proactive_support import (
    detect_checkout_drop,
    detect_learning_stall,
    detect_quiz_low_score,
    detect_video_rewatch,
    get_active_interventions,
    track_event,
)

router = APIRouter()
admin_router = APIRouter()


class EventIn(BaseModel):
    event_type: str = Field(min_length=1, max_length=50)
    metadata: dict[str, Any] | None = None
    page: str | None = None


@router.post("/events")
async def track_user_event(event: EventIn, user=Depends(get_current_user)):
    await track_event(
        user_id=user["id"],
        event_type=event.event_type,
        metadata=event.metadata,
        page=event.page,
    )
    return api_response({"tracked": True})


@admin_router.get("/interventions/{user_id}")
async def get_user_interventions(user_id: str, _=Depends(require_admin)):
    interventions = await get_active_interventions(user_id)
    return api_response(interventions)


@admin_router.get("/interventions")
async def list_recent_interventions(_=Depends(require_admin)):
    db = get_db()
    now = datetime.now(timezone.utc)
    cutoff = (now - timedelta(days=7)).isoformat()
    events = await db.user_behavior_events.find({
        "event_type": {"$in": ["video_rewatch", "checkout_drop", "learning_stall", "quiz_low_score"]},
        "created_at": {"$gte": cutoff},
    }).sort("created_at", -1).to_list(200)
    return api_response(events)
