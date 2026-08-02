from pydantic import BaseModel
from datetime import datetime
from typing import Optional

class Discussion(BaseModel):
    id: str
    target_type: str # exam, question
    target_id: str
    user_id: str
    content: str
    is_pinned: bool = False
    likes_count: int = 0
    created_at: datetime = datetime.now()

class ExamReview(BaseModel):
    id: str
    exam_id: str
    user_id: str
    rating: int
    tags: Optional[str] = None
    comment: Optional[str] = None
    created_at: datetime = datetime.now()

class ActivityFeed(BaseModel):
    id: str
    user_id: str
    action_type: str # completed_exam, earned_badge, created_exam
    target_id: Optional[str] = None
    metadata: Optional[str] = None
    created_at: datetime = datetime.now()

class CreatorStats(BaseModel):
    user_id: str
    reputation_score: int = 0
    total_followers: int = 0
    total_exam_reviews: int = 0
    avg_rating: float = 0.0