"""Proactive support endpoints.

User-facing routes for behavioral event tracking; admin routes for
intervention management (list, summary, resolve).
"""

from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field

from app.core.deps import get_current_user, require_admin
from app.core.response import api_response
from app.services.proactive_support import (
    get_active_interventions,
    get_intervention,
    get_intervention_summary,
    list_interventions,
    resolve_intervention,
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


# ── Admin intervention management ────────────────────────────────────────────


@admin_router.get("/interventions")
async def list_admin_interventions(
    type: str | None = Query(default=None),
    status: str | None = Query(default=None),
    user_id: str | None = Query(default=None),
    _=Depends(require_admin),
):
    filters: dict[str, Any] = {}
    if type:
        filters["type"] = type
    if status:
        filters["status"] = status
    if user_id:
        filters["user_id"] = user_id
    interventions = await list_interventions(filters or None)
    return api_response(interventions)


@admin_router.get("/interventions/summary")
async def admin_intervention_summary(_=Depends(require_admin)):
    summary = await get_intervention_summary()
    return api_response(summary)


@admin_router.get("/interventions/{user_id}")
async def get_user_interventions(user_id: str, _=Depends(require_admin)):
    interventions = await get_active_interventions(user_id)
    return api_response(interventions)


@admin_router.get("/interventions/id/{intervention_id}")
async def admin_intervention_detail(intervention_id: str, _=Depends(require_admin)):
    intervention = await get_intervention(intervention_id)
    if not intervention:
        raise HTTPException(status_code=404, detail="Intervention not found")
    return api_response(intervention)


@admin_router.post("/interventions/{intervention_id}/resolve")
async def admin_resolve_intervention(intervention_id: str, _=Depends(require_admin)):
    intervention = await resolve_intervention(intervention_id)
    if not intervention:
        raise HTTPException(status_code=404, detail="Intervention not found")
    return api_response(intervention)
