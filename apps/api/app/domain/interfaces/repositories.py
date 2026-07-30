from abc import ABC, abstractmethod
from typing import List, Optional
from ..entities.exam import Exam, Question, UserProfile
from ..entities.enterprise import Contest, ContestParticipant, SkillPoint
from ..entities.community import Discussion, ExamReview, ActivityFeed, CreatorStats

class ICommunityRepository(ABC):
    @abstractmethod
    async def create_discussion(self, discussion: Discussion) -> Discussion:
        pass

    @abstractmethod
    async def get_discussions(self, target_id: str) -> List[Discussion]:
        pass

    @abstractmethod
    async def create_review(self, review: ExamReview) -> ExamReview:
        pass

    @abstractmethod
    async def get_activity_feed(self, user_id: str) -> List[ActivityFeed]:
        pass

    @abstractmethod
    async def update_creator_stats(self, user_id: str, xp_gain: int) -> None:
        pass

class IExamRepository(ABC):
    @abstractmethod
    async def get_by_id(self, exam_id: str) -> Optional[Exam]:
        pass

    @abstractmethod
    async def list_published(self, category: Optional[str] = None, difficulty: Optional[str] = None) -> List[Exam]:
        pass

    @abstractmethod
    async def create(self, exam: Exam) -> Exam:
        pass

    @abstractmethod
    async def update(self, exam_id: str, data: dict) -> Exam:
        pass

class IQuestionRepository(ABC):
    @abstractmethod
    async def get_by_exam(self, exam_id: str) -> List[Question]:
        pass

    @abstractmethod
    async def create_bulk(self, questions: List[Question]) -> None:
        pass

class IProfileRepository(ABC):
    @abstractmethod
    async def get_by_user_id(self, user_id: str) -> Optional[UserProfile]:
        pass

    @abstractmethod
    async def update_stats(self, user_id: str, xp_gain: int, solved_increment: bool) -> UserProfile:
        pass

    @abstractmethod
    async def get_leaderboard(self, category_id: Optional[str] = None, limit: int = 10) -> List[UserProfile]:
        pass

class IEnterpriseRepository(ABC):
    @abstractmethod
    async def create_contest(self, contest: Contest) -> Contest:
        pass

    @abstractmethod
    async def get_contest(self, contest_id: str) -> Optional[Contest]:
        pass

    @abstractmethod
    async def register_participant(self, participant: ContestParticipant) -> bool:
        pass

    @abstractmethod
    async def update_skill_points(self, skill_point: SkillPoint) -> SkillPoint:
        pass

    @abstractmethod
    async def get_user_skills(self, user_id: str) -> List[SkillPoint]:
        pass
