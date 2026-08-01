"""Ecosystem API — Creator Economy, Learning Marketplace, Events, Trust, Platform Intelligence."""

from typing import Optional

from fastapi import APIRouter, Depends, Query

from app.core.deps import get_current_user, require_admin, get_optional_user
from app.core.response import api_response, error_response
from app.services import ecosystem as eco

router = APIRouter(prefix="/ecosystem", tags=["ecosystem"])
admin_router = APIRouter(prefix="/admin/ecosystem", tags=["admin-ecosystem"])

UserDep = Depends(get_current_user)
AdminDep = Depends(require_admin)


def _or_error(result: dict):
    """Return a proper 4xx JSONResponse when a service returns an error dict."""
    if result.get("error"):
        return error_response(result.get("message", "Request failed"), 404 if "not found" in str(result.get("message", "")).lower() else 400)
    return api_response(result)


# ── Creator Economy ───────────────────────────────────────────────────────────

@router.post("/creators/verify/request")
async def request_creator_verification(body: dict, user: dict = UserDep):
    """Request creator verification (identity / expertise)."""
    result = await eco.request_creator_verification(user["id"], body)
    return api_response(result)


@router.get("/creators/me/analytics")
async def creator_analytics(days: int = Query(30, ge=7, le=90), user: dict = UserDep):
    """Creator dashboard analytics."""
    result = await eco.get_creator_analytics(user["id"], days=days)
    return api_response(result)


@router.post("/creators/me/refresh")
async def refresh_creator_achievements(user: dict = UserDep):
    """Evaluate milestones and award achievements / badges."""
    result = await eco.refresh_achievements(user["id"])
    return api_response(result)


@router.get("/creators/leaderboard")
async def creator_leaderboard(limit: int = Query(20, ge=1, le=100)):
    """Public creator leaderboard."""
    result = await eco.get_creator_leaderboard(limit=limit)
    return api_response({"creators": result})


@router.get("/creators/{user_id}/trust")
async def creator_trust(user_id: str):
    """Public trust score for a creator."""
    result = await eco.compute_creator_trust(user_id)
    return api_response(result)


# ── Learning Marketplace (Collections / Series / Bundles) ─────────────────────

@router.post("/collections")
async def create_collection(body: dict, user: dict = UserDep):
    """Create a collection, series, bundle, or practice kit."""
    result = await eco.create_collection(user["id"], body)
    return api_response(result)


@router.get("/collections")
async def list_collections(
    kind: Optional[str] = None,
    limit: int = Query(50, ge=1, le=100),
    user: dict = Depends(get_optional_user),
):
    """Browse public marketplace collections."""
    result = await eco.list_collections(kind=kind, limit=limit)
    return api_response({"collections": result})


@router.get("/collections/mine")
async def my_collections(limit: int = Query(50, ge=1, le=100), user: dict = UserDep):
    """My collections / series."""
    result = await eco.list_collections(user_id=user["id"], public_only=False, limit=limit)
    return api_response({"collections": result})


@router.post("/collections/{collection_id}/bookmark")
async def bookmark_collection(collection_id: str, user: dict = UserDep):
    result = await eco.bookmark_collection(user["id"], collection_id)
    return _or_error(result)


# ── Challenge Versioning ──────────────────────────────────────────────────────

@router.post("/challenges/{challenge_id}/versions")
async def create_version(challenge_id: str, body: dict, user: dict = UserDep):
    """Snapshot a challenge version and log change note."""
    result = await eco.create_challenge_version(user["id"], challenge_id, body)
    return _or_error(result)


@router.get("/challenges/{challenge_id}/versions")
async def challenge_versions(challenge_id: str, limit: int = Query(20, ge=1, le=50)):
    """List version history for a challenge."""
    result = await eco.get_challenge_versions(challenge_id, limit=limit)
    return api_response({"versions": result})


# ── Event Platform ────────────────────────────────────────────────────────────

@router.post("/events")
async def create_event(body: dict, user: dict = UserDep):
    """Create a community event (weekly challenge, AMA, hackathon, livestream...)."""
    result = await eco.create_event(user["id"], body)
    return api_response(result)


@router.get("/events")
async def list_events(
    status: Optional[str] = None,
    event_type: Optional[str] = None,
    limit: int = Query(50, ge=1, le=100),
):
    """List upcoming / live community events."""
    result = await eco.list_events(status=status, event_type=event_type, limit=limit)
    return api_response({"events": result})


@router.post("/events/{event_id}/join")
async def join_event(event_id: str, user: dict = UserDep):
    result = await eco.join_event(user["id"], event_id)
    return _or_error(result)


@router.post("/events/{event_id}/leave")
async def leave_event(event_id: str, user: dict = UserDep):
    result = await eco.leave_event(user["id"], event_id)
    return api_response(result)


# ── Trust & Moderation ────────────────────────────────────────────────────────

@router.post("/reports")
async def submit_report(body: dict, user: dict = UserDep):
    """Report inappropriate content / behavior."""
    result = await eco.submit_report(user["id"], body)
    return _or_error(result)


# ── Platform Intelligence ─────────────────────────────────────────────────────

@router.get("/intelligence")
async def platform_intelligence():
    """Public-facing trend signals (popular skills, emerging topics, knowledge gaps)."""
    result = await eco.platform_intelligence()
    return api_response(result)


# ── Admin: Moderation & Verification ──────────────────────────────────────────

@admin_router.get("/moderation")
async def moderation_queue(status: str = "pending", limit: int = Query(50, ge=1, le=100), user: dict = AdminDep):
    result = await eco.list_moderation_queue(status=status, limit=limit)
    return api_response({"reports": result})


@admin_router.post("/moderation/{report_id}/resolve")
async def resolve_report(report_id: str, body: dict, user: dict = AdminDep):
    """Resolve a report: warn | remove | ban | dismiss."""
    result = await eco.resolve_report(user["id"], report_id, body.get("action", "dismiss"), body.get("note", ""))
    return _or_error(result)


@admin_router.get("/moderation/stats")
async def moderation_stats(user: dict = AdminDep):
    result = await eco.moderation_stats()
    return api_response(result)


@admin_router.post("/creators/{creator_id}/verify")
async def review_creator_verification(creator_id: str, body: dict, user: dict = AdminDep):
    """Approve / reject a creator verification request."""
    result = await eco.review_creator_verification(user["id"], creator_id, body.get("approve", False), body.get("note", ""))
    return _or_error(result)
