from typing import List, Optional
from datetime import datetime
from ..entities.exam import Exam
from ..interfaces.repositories import IExamRepository

class ChallengeUseCase:
    def __init__(self, exam_repo: IExamRepository):
        self.exam_repo = exam_repo

    async def get_daily_challenge(self) -> Optional[Exam]:
        # Implementation to fetch today's challenge
        # Logic: Select an exam flagged as "daily" for the current date
        # For MVP: Return the latest published exam
        exams = await self.exam_repo.list_published(difficulty=None)
        return exams[0] if exams else None

    async def get_weekly_tournament(self) -> List[Exam]:
        # Implementation to fetch weekly tournament exams
        return await self.exam_repo.list_published(difficulty="hard")