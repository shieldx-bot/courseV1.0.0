from datetime import datetime
from typing import List, Optional
from ..entities.enterprise import Contest, ContestParticipant, SkillPoint, ContestStatus
from ..interfaces.repositories import IEnterpriseRepository

class EnterpriseUseCase:
    def __init__(self, enterprise_repo: IEnterpriseRepository):
        self.enterprise_repo = enterprise_repo

    async def create_new_contest(self, contest: Contest) -> Contest:
        return await self.enterprise_repo.create_contest(contest)

    async def register_for_contest(self, contest_id: str, user_id: str) -> bool:
        contest = await self.enterprise_repo.get_contest(contest_id)
        if not contest:
            return False
        
        # Check if contest is still open for registration
        if contest.status != ContestStatus.UPCOMING:
            return False

        participant = ContestParticipant(
            contest_id=contest_id,
            user_id=user_id,
            registered_at=datetime.now()
        )
        return await self.enterprise_repo.register_participant(participant)

    async def get_user_career_profile(self, user_id: str) -> List[SkillPoint]:
        return await self.enterprise_repo.get_user_skills(user_id)

    async def award_skill_points(self, user_id: str, skill_name: str, xp_gain: int):
        skills = await self.enterprise_repo.get_user_skills(user_id)
        current_skill = next((s for s in skills if s.skill_name == skill_name), None)
        
        if current_skill:
            current_skill.xp += xp_gain
            # Simple level up logic: every 1000 XP
            current_skill.level = (current_skill.xp // 1000) + 1
            current_skill.last_updated = datetime.now()
            await self.enterprise_repo.update_skill_points(current_skill)
        else:
            new_skill = SkillPoint(
                user_id=user_id,
                skill_name=skill_name,
                xp=xp_gain,
                level=(xp_gain // 1000) + 1,
                last_updated=datetime.now()
            )
            await self.enterprise_repo.update_skill_points(new_skill)
