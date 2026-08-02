from typing import List, Optional
from datetime import datetime
from ..entities.battle import Tournament, BattleSession, BattleStatus
from ..interfaces.repositories import IEnterpriseRepository

class TournamentUseCase:
    def __init__(self, enterprise_repo: IEnterpriseRepository):
        self.enterprise_repo = enterprise_repo

    async def create_tournament(self, tournament: Tournament) -> Tournament:
        return await self.enterprise_repo.create_tournament(tournament)

    async def register_participant(self, tournament_id: str, user_id: str) -> bool:
        # Check tournament capacity
        tournament = await self.enterprise_repo.get_tournament(tournament_id)
        if len(tournament.participants) >= tournament.max_participants:
            return False
        
        tournament.participants.append(user_id)
        return await self.enterprise_repo.update_tournament(tournament)

    async def start_battle(self, creator_id: str, exam_id: str) -> BattleSession:
        # Create a private battle session
        session = BattleSession(
            id=f"battle_{datetime.now().timestamp()}",
            creator_id=creator_id,
            exam_id=exam_id,
            status=BattleStatus.WAITING
        )
        return await self.enterprise_repo.create_battle(session)