from fastapi import APIRouter, Depends, HTTPException
from typing import List
from datetime import datetime
import uuid

from ....domain.entities.enterprise import Contest, ContestStatus, ContestType
from ....domain.services.enterprise_usecase import EnterpriseUseCase
from ....infrastructure.repositories.sqlite_repos import SQLiteEnterpriseRepository
from ....core.config import settings
from ....core.deps import get_current_user

router = APIRouter(prefix="/enterprise", tags=["enterprise"])

# DI
def get_enterprise_usecase():
    repo = SQLiteEnterpriseRepository(settings.DATABASE_URL.replace("sqlite:///", ""))
    return EnterpriseUseCase(repo)

@router.post("/contests")
async def create_contest(
    title: str, 
    description: str, 
    start_time: datetime, 
    end_time: datetime,
    current_user: dict = Depends(get_current_user),
    usecase: EnterpriseUseCase = Depends(get_enterprise_usecase)
):
    if current_user.get("role") not in ["admin", "creator"]:
        raise HTTPException(status_code=403, detail="Not authorized to create contest")
    
    contest = Contest(
        id=str(uuid.uuid4()),
        title=title,
        description=description,
        start_time=start_time,
        end_time=end_time,
        organizer_id=current_user["id"],
        status=ContestStatus.UPCOMING,
        type=ContestType.PUBLIC
    )
    return await usecase.create_new_contest(contest)

@router.post("/contests/{contest_id}/register")
async def register_contest(
    contest_id: str,
    current_user: dict = Depends(get_current_user),
    usecase: EnterpriseUseCase = Depends(get_enterprise_usecase)
):
    success = await usecase.register_for_contest(contest_id, current_user["id"])
    if not success:
        raise HTTPException(status_code=400, detail="Registration failed or contest not found")
    return {"message": "Registered successfully"}

@router.get("/profile/{user_id}/skills")
async def get_skills(
    user_id: str,
    usecase: EnterpriseUseCase = Depends(get_enterprise_usecase)
):
    return await usecase.get_user_career_profile(user_id)

@router.post("/certifications")
async def issue_certification(
    user_id: str,
    title: str,
    metadata: dict = None,
    usecase: EnterpriseUseCase = Depends(get_enterprise_usecase)
):
    # Tạm thời chưa có repository certification, sẽ mở rộng sau
    return {"message": "Certification issued (mock)", "user_id": user_id, "title": title}

@router.get("/")
async def list_enterprises(
    current_user: dict = Depends(get_current_user),
    usecase: EnterpriseUseCase = Depends(get_enterprise_usecase)
):
    if current_user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Not authorized")
    # Mock data for demonstration as repository for Enterprise entities is not fully implemented for listing
    return {"data": [
        {"id": "1", "name": "Company A", "description": "Tech Innovators", "owner_id": "admin", "created_at": "2026-07-29T10:00:00Z"},
        {"id": "2", "name": "Company B", "description": "Educational Solutions", "owner_id": "admin", "created_at": "2026-07-29T11:00:00Z"}
    ]}
