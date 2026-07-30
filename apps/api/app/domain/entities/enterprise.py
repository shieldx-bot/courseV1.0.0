from dataclasses import dataclass, field
from datetime import datetime
from typing import List, Optional, Dict
from enum import Enum

class ContestStatus(str, Enum):
    UPCOMING = "upcoming"
    ACTIVE = "active"
    FINISHED = "finished"

class ContestType(str, Enum):
    PUBLIC = "public"
    PRIVATE = "private"
    COMPANY = "company"

@dataclass
class Contest:
    id: str
    title: str
    description: str
    start_time: datetime
    end_time: datetime
    organizer_id: str
    type: ContestType = ContestType.PUBLIC
    status: ContestStatus = ContestStatus.UPCOMING
    rules_json: Optional[str] = None
    created_at: datetime = field(default_factory=datetime.now)

@dataclass
class ContestParticipant:
    contest_id: str
    user_id: str
    registered_at: datetime
    final_rank: Optional[int] = None
    final_score: Optional[float] = None

@dataclass
class SkillPoint:
    user_id: str
    skill_name: str
    level: int = 1
    xp: int = 0
    last_updated: datetime = field(default_factory=datetime.now)

@dataclass
class Certification:
    id: str
    user_id: str
    title: str
    issue_date: datetime
    expiry_date: Optional[datetime] = None
    credential_url: Optional[str] = None
    metadata: Optional[Dict] = None
