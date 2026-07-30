from enum import Enum
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field
from datetime import datetime

class Difficulty(str, Enum):
    EASY = "easy"
    MEDIUM = "medium"
    HARD = "hard"
    EXPERT = "expert"
    LEGENDARY = "legendary"

class QuestionType(str, Enum):
    MULTIPLE_CHOICE = "multiple_choice"
    MULTIPLE_ANSWER = "multiple_answer"
    TRUE_FALSE = "true_false"
    FILL_BLANK = "fill_blank"
    CODING = "coding"
    TERMINAL_COMMAND = "terminal_command"
    LINUX_LAB = "linux_lab"
    SQL_QUERY = "sql_query"

class UserRole(str, Enum):
    ADMIN = "admin"
    CREATOR = "creator"
    USER = "user"

class ExamStatus(str, Enum):
    DRAFT = "draft"
    PUBLISHED = "published"

class QuestionOption(BaseModel):
    id: str
    content: str
    is_correct: bool
    order_index: int

class Question(BaseModel):
    id: str
    exam_id: str
    type: QuestionType
    title: str
    content: str
    explanation: Optional[str] = None
    points: int = 10
    order_index: int
    options: List[QuestionOption] = []
    metadata: Dict[str, Any] = {} # For labs, coding testcases, etc.

class Exam(BaseModel):
    id: str
    title: str
    description: str
    category: str
    difficulty: Difficulty
    tags: List[str]
    estimated_time: int # in minutes
    author_id: str
    status: ExamStatus = ExamStatus.DRAFT
    created_at: datetime
    updated_at: datetime

class UserProfile(BaseModel):
    user_id: str
    avatar: Optional[str] = None
    bio: Optional[str] = None
    country: Optional[str] = None
    rank: str = "Bronze"
    xp: int = 0
    reputation_score: int = 0
    streak: int = 0
    total_solved: int = 0
    total_created: int = 0
    achievements: List[str] = []
    badges: List[str] = []
