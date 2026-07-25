from fastapi import APIRouter, Depends, HTTPException, Query
from app.core.deps import get_current_user
from app.core.response import api_response, error_response
from app.services.experiments import (
    get_user_experiments,
    get_user_variant_map,
    track_experiment_event,
    create_experiment,
    update_experiment,
    list_experiments,
    get_experiment_stats,
    delete_experiment,
)

router = APIRouter()


# ─── Public endpoints ───────────────────────────────────────────────


@router.get("/experiments/active")
async def get_active_experiments(user: dict = Depends(get_current_user)):
    """
    Get active experiments with the current user's assigned variants.
    Only returns experiments the user is bucketed into (based on traffic_split).
    """
    experiments = await get_user_experiments(user["id"])
    return api_response(experiments)


@router.get("/experiments/variant-map")
async def get_variant_map(user: dict = Depends(get_current_user)):
    """
    Get a map of experiment_slug -> variant for quick frontend lookup.
    Useful for SSR / middleware to inject experiment variants.
    """
    variant_map = await get_user_variant_map(user["id"])
    return api_response(variant_map)


@router.post("/experiments/track")
async def track_event(
    experiment_slug: str = Query(...),
    variant_name: str = Query(...),
    variant_index: int = Query(...),
    event_type: str = Query(...),
    user: dict = Depends(get_current_user),
):
    """
    Track an experiment event (e.g., 'click', 'conversion', 'view').
    Used for analytics and A/B test result computation.
    """
    await track_experiment_event(
        experiment_slug=experiment_slug,
        variant_name=variant_name,
        variant_index=variant_index,
        user_id=user["id"],
        event_type=event_type,
        metadata={"user_role": user.get("role")},
    )
    return api_response({"tracked": True})


# ─── Admin endpoints ────────────────────────────────────────────────


@router.get("/admin/experiments")
async def admin_list_experiments(user: dict = Depends(get_current_user)):
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    experiments = await list_experiments()
    return api_response(experiments)


@router.post("/admin/experiments")
async def admin_create_experiment(data: dict, user: dict = Depends(get_current_user)):
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    try:
        experiment = await create_experiment(data)
        return api_response(experiment)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@router.put("/admin/experiments/{experiment_id}")
async def admin_update_experiment(
    experiment_id: str,
    data: dict,
    user: dict = Depends(get_current_user),
):
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    experiment = await update_experiment(experiment_id, data)
    if not experiment:
        raise HTTPException(status_code=404, detail="Experiment not found")
    return api_response(experiment)


@router.delete("/admin/experiments/{experiment_id}")
async def admin_delete_experiment(
    experiment_id: str,
    user: dict = Depends(get_current_user),
):
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    deleted = await delete_experiment(experiment_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Experiment not found")
    return api_response({"deleted": True})


@router.get("/admin/experiments/stats")
async def admin_experiment_stats(
    experiment_slug: str | None = Query(None),
    user: dict = Depends(get_current_user),
):
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    stats = await get_experiment_stats(experiment_slug)
    return api_response(stats)