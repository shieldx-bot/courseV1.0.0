from fastapi import APIRouter, Depends, HTTPException, Query
from app.core.deps import get_optional_user, get_current_user
from app.core.response import api_response
from app.services.learning_paths import (
    get_all_paths,
    get_path_by_slug,
    get_path_by_id,
    get_paths_by_goal,
    enroll_user_in_path,
    get_user_enrollments,
    seed_learning_paths,
    get_user_enrollment_for_path,
)

router = APIRouter()


@router.get("/learning-paths")
async def list_paths(
    goal: str = "",
    limit: int = Query(20, ge=1, le=50),
):
    if goal:
        paths = await get_paths_by_goal(goal, limit)
    else:
        paths = await get_all_paths(limit)
    return api_response(paths)


@router.get("/learning-paths/my", dependencies=[Depends(get_current_user)])
async def my_paths(user: dict = Depends(get_current_user)):
    paths = await get_user_enrollments(user["id"])
    return api_response(paths)


@router.get("/learning-paths/{slug}")
async def get_path(slug: str, user: dict | None = Depends(get_optional_user)):
    path = await get_path_by_slug(slug)
    if not path:
        raise HTTPException(status_code=404, detail="Learning path not found")

    if user:
        enrollment = await get_user_enrollment_for_path(user["id"], path["id"])
        if enrollment:
            path["progress"] = enrollment.get("progress")

    return api_response(path)


@router.post("/learning-paths/seed")
async def seed_paths():
    await seed_learning_paths()
    return api_response({"seeded": True})


@router.post("/learning-paths/enroll", dependencies=[Depends(get_current_user)])
async def enroll_path(path_id: str = Query(...), user: dict = Depends(get_current_user)):
    try:
        result = await enroll_user_in_path(user["id"], path_id)
        return api_response(result)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
