from fastapi import APIRouter, Depends, HTTPException
from typing import List
from ...domain.entities.community import Discussion, ExamReview
from ...domain.services.community_usecase import CommunityUseCase
from ...core.deps import get_current_user

router = APIRouter()

# Dependency injection setup (mocked for now, assume proper DI is in place)
def get_community_usecase():
    return CommunityUseCase(community_repo=None, profile_repo=None)

@router.post("/discussions")
async def create_discussion(
    discussion: Discussion,
    usecase: CommunityUseCase = Depends(get_community_usecase),
    user: dict = Depends(get_current_user)
):
    discussion.user_id = user["id"]
    return await usecase.post_discussion(discussion)

@router.post("/reviews")
async def submit_review(
    review: ExamReview,
    usecase: CommunityUseCase = Depends(get_community_usecase),
    user: dict = Depends(get_current_user)
):
    review.user_id = user["id"]
    return await usecase.submit_review(review)