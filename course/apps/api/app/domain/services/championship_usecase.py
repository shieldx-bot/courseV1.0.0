from typing import List
from datetime import datetime
from ..entities.battle import Tournament
from ..interfaces.repositories import IEnterpriseRepository

class ChampionshipUseCase:
    def __init__(self, enterprise_repo: IEnterpriseRepository):
        self.enterprise_repo = enterprise_repo

    async def organize_seasonal_championship(self, name: str, season: str) -> Tournament:
        # Business logic for seasonal events
        championship = Tournament(
            id=f"season_{season}_{name}",
            name=f"{name} {season} Championship",
            description=f"Grand seasonal championship for {season}",
            start_time=datetime.now(),
            end_time=datetime.now(), # Needs proper calculation
            registration_deadline=datetime.now(),
            max_participants=10000
        )
        return await self.enterprise_repo.create_tournament(championship)

    async def get_champion_leaderboard(self, championship_id: str) -> List[dict]:
        # Implementation to fetch global rankings for a championship
        return await self.enterprise_repo.get_tournament_leaderboard(championship_id)