from pydantic import BaseModel
from datetime import datetime
from typing import List, Optional
from enum import Enum

class BattleStatus(Enum):
    WAITING = "waiting"
    ACTIVE = "active"
    FINISHED = "finished"
    CANCELLED = "cancelled"

class BattleSession(BaseModel):
    id: str
    creator_id: str
    opponent_id: Optional[str] = None
    status: BattleStatus = BattleStatus.WAITING
    exam_id: str
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    winner_id: Optional[str] = None
    rules_json: Optional[str] = None

class Tournament(BaseModel):
    id: str
    name: str
    description: Optional[str] = None
    start_time: datetime
    end_time: datetime
    registration_deadline: datetime
    max_participants: int
    participants: List[str] = []
    status: str = "open"
    leaderboard_id: Optional[str] = None