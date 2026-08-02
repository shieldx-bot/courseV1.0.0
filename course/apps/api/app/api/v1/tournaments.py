from fastapi import APIRouter, Depends, HTTPException
from typing import List
from ...domain.entities.battle import Tournament, BattleSession
from ...domain.services.tournament_usecase import TournamentUseCase
from ...core.deps import get_current_user

router = APIRouter()

# Mock DI
def get_tournament_usecase():
    return TournamentUseCase(enterprise_repo=None)

@router.post("/tournaments")
async def create_tournament(
    tournament: Tournament,
    usecase: TournamentUseCase = Depends(get_tournament_usecase),
    user: dict = Depends(get_current_user)
):
    return await usecase.create_tournament(tournament)

@router.post("/tournaments/{tournament_id}/register")
async def register(
    tournament_id: str,
    usecase: TournamentUseCase = Depends(get_tournament_usecase),
    user: dict = Depends(get_current_user)
):
    success = await usecase.register_participant(tournament_id, user["id"])
    if not success:
        raise HTTPException(status_code=400, detail="Registration failed")
    return {"message": "Registered"}

@router.post("/battles/start")
async def start_battle(
    exam_id: str,
    usecase: TournamentUseCase = Depends(get_tournament_usecase),
    user: dict = Depends(get_current_user)
):
    return await usecase.start_battle(user["id"], exam_id)