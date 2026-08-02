from typing import List, Optional, Any, Dict
from pydantic import BaseModel, Field, ConfigDict
from datetime import datetime
from ..domain.entities.exam import Difficulty, QuestionType, ExamStatus

# --- Exam Schemas ---
class ExamBase(BaseModel):
    title: str
    description: str
    category: str
    difficulty: Difficulty
    tags: List[str]
    estimated_time: int

class ExamCreate(ExamBase):
    pass

class ExamUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    category: Optional[str] = None
    difficulty: Optional[Difficulty] = None
    tags: Optional[List[str]] = None
    estimated_time: Optional[int] = None
    status: Optional[ExamStatus] = None

class ExamResponse(ExamBase):
    id: str
    author_id: str
    status: ExamStatus
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)

# --- Question Schemas ---
class OptionSchema(BaseModel):
    content: str
    is_correct: bool
    order_index: int

class QuestionCreate(BaseModel):
    type: QuestionType
    title: str
    content: str
    explanation: Optional[str] = None
    points: int = 10
    order_index: int
    options: List[OptionSchema] = []
    metadata: Dict[str, Any] = {}

class QuestionResponse(BaseModel):
    id: str
    type: QuestionType
    title: str
    content: str
    points: int
    order_index: int
    options: List[OptionSchema]
    # explanation is hidden during exam

# --- Submission Schemas ---
class AnswerSubmission(BaseModel):
    question_id: str
    user_answer: Any # Could be choice id, string, or code

class ExamSubmit(BaseModel):
    answers: List[AnswerSubmission]

class SubmissionResult(BaseModel):
    submission_id: str
    score: int
    total_points: int
    passed: bool
    feedback: List[Dict[str, Any]]
    xp_gained: int
