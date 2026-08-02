from typing import List, Dict, Any
from ..entities.community import Discussion, ExamReview, CreatorStats
from ..interfaces.repositories import ICommunityRepository, IProfileRepository

class CommunityUseCase:
    def __init__(
        self,
        community_repo: ICommunityRepository,
        profile_repo: IProfileRepository
    ):
        self.community_repo = community_repo
        self.profile_repo = profile_repo

    async def post_discussion(self, discussion: Discussion) -> Discussion:
        # Business logic for validating discussion content could go here
        return await self.community_repo.create_discussion(discussion)

    async def submit_review(self, review: ExamReview, xp_reward: int = 50) -> ExamReview:
        # Logic to submit review and grant XP to reviewer
        await self.profile_repo.update_stats(review.user_id, xp_reward, solved_increment=False)
        # Update creator reputation
        await self.community_repo.update_creator_stats(review.user_id, xp_reward)
        return await self.community_repo.create_review(review)