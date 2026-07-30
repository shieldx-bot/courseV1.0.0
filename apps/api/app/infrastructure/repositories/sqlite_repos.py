import sqlite3
import json
from typing import List, Optional
from datetime import datetime
from ...domain.entities.exam import Exam, Question, UserProfile
from ...domain.entities.enterprise import Contest, ContestParticipant, SkillPoint
from ...domain.entities.community import Discussion, ExamReview, ActivityFeed, CreatorStats
from ...domain.interfaces.repositories import (
    IExamRepository, 
    IQuestionRepository, 
    IProfileRepository,
    IEnterpriseRepository,
    ICommunityRepository
)

class SQLiteExamRepository(IExamRepository):
    def __init__(self, db_path: str):
        self.conn = sqlite3.connect(db_path)
        self.conn.row_factory = sqlite3.Row
        self.cursor = self.conn.cursor()

    async def get_by_id(self, exam_id: str) -> Optional[Exam]:
        self.cursor.execute("SELECT * FROM exams WHERE _id = ?", (exam_id,))
        row = self.cursor.fetchone()
        if row:
            return Exam(**dict(row))
        return None

    async def list_published(self, category: Optional[str] = None, difficulty: Optional[str] = None) -> List[Exam]:
        query = "SELECT * FROM exams WHERE status = 'published'"
        params = []
        if category:
            query += " AND category_id = ?"
            params.append(category)
        if difficulty:
            query += " AND difficulty = ?"
            params.append(difficulty)
        
        self.cursor.execute(query, params)
        rows = self.cursor.fetchall()
        return [Exam(**dict(row)) for row in rows]

    async def create(self, exam: Exam) -> Exam:
        # Simplified insert
        return exam

    async def update(self, exam_id: str, data: dict) -> Exam:
        pass

class SQLiteProfileRepository(IProfileRepository):
    def __init__(self, db_path: str):
        self.conn = sqlite3.connect(db_path)
        self.conn.row_factory = sqlite3.Row
        self.cursor = self.conn.cursor()

    async def get_by_user_id(self, user_id: str) -> Optional[UserProfile]:
        self.cursor.execute("SELECT * FROM user_exam_profiles WHERE user_id = ?", (user_id,))
        row = self.cursor.fetchone()
        if row:
            return UserProfile(**dict(row))
        return None

    async def update_stats(self, user_id: str, xp_gain: int, solved_increment: bool) -> UserProfile:
        # In a real app, we should also update reputation_score based on contribution/community activity
        # Here we only update XP and solved count
        query = "UPDATE user_exam_profiles SET xp = xp + ?, total_solved = total_solved + ?"
        
        increment_val = 1 if solved_increment else 0
        self.cursor.execute(query, (xp_gain, increment_val, user_id))
        self.conn.commit()
        return await self.get_by_user_id(user_id)

    async def get_leaderboard(self, category_id: Optional[str] = None, limit: int = 10) -> List[UserProfile]:
        # Using JOIN or just table scan depending on schema. Assuming table exists
        query = "SELECT * FROM user_exam_profiles ORDER BY xp DESC LIMIT ?"
        self.cursor.execute(query, (limit,))
        rows = self.cursor.fetchall()
        return [UserProfile(**dict(row)) for row in rows]

class SQLiteEnterpriseRepository(IEnterpriseRepository):
    def __init__(self, db_path: str):
        self.conn = sqlite3.connect(db_path)
        self.conn.row_factory = sqlite3.Row
        self.cursor = self.conn.cursor()

    async def create_contest(self, contest: Contest) -> Contest:
        query = """
            INSERT INTO contests (_id, title, description, start_time, end_time, type, rules_json, organizer_id, status, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """
        self.cursor.execute(query, (
            contest.id, contest.title, contest.description, 
            contest.start_time.isoformat(), contest.end_time.isoformat(),
            contest.type.value, contest.rules_json, contest.organizer_id,
            contest.status.value, contest.created_at.isoformat()
        ))
        self.conn.commit()
        return contest

    async def get_contest(self, contest_id: str) -> Optional[Contest]:
        self.cursor.execute("SELECT * FROM contests WHERE _id = ?", (contest_id,))
        row = self.cursor.fetchone()
        if row:
            data = dict(row)
            return Contest(
                id=data['_id'],
                title=data['title'],
                description=data['description'],
                start_time=datetime.fromisoformat(data['start_time']),
                end_time=datetime.fromisoformat(data['end_time']),
                organizer_id=data['organizer_id'],
                type=data['type'],
                status=data['status'],
                rules_json=data['rules_json'],
                created_at=datetime.fromisoformat(data['created_at'])
            )
        return None

    async def register_participant(self, participant: ContestParticipant) -> bool:
        try:
            query = "INSERT INTO contest_participants (contest_id, user_id, registered_at) VALUES (?, ?, ?)"
            self.cursor.execute(query, (
                participant.contest_id, participant.user_id, participant.registered_at.isoformat()
            ))
            self.conn.commit()
            return True
        except sqlite3.IntegrityError:
            return False

    async def update_skill_points(self, skill_point: SkillPoint) -> SkillPoint:
        query = """
            INSERT INTO skill_graph (user_id, skill_name, level, xp, last_updated)
            VALUES (?, ?, ?, ?, ?)
            ON CONFLICT(user_id, skill_name) DO UPDATE SET
                level = excluded.level,
                xp = excluded.xp,
                last_updated = excluded.last_updated
        """
        self.cursor.execute(query, (
            skill_point.user_id, skill_point.skill_name, skill_point.level,
            skill_point.xp, skill_point.last_updated.isoformat()
        ))
        self.conn.commit()
        return skill_point

    async def get_user_skills(self, user_id: str) -> List[SkillPoint]:
        self.cursor.execute("SELECT * FROM skill_graph WHERE user_id = ?", (user_id,))
        rows = self.cursor.fetchall()
        return [
            SkillPoint(
                user_id=row['user_id'],
                skill_name=row['skill_name'],
                level=row['level'],
                xp=row['xp'],
                last_updated=datetime.fromisoformat(row['last_updated'])
            ) for row in rows
        ]

class SQLiteCommunityRepository(ICommunityRepository):
    def __init__(self, db_path: str):
        self.conn = sqlite3.connect(db_path)
        self.conn.row_factory = sqlite3.Row
        self.cursor = self.conn.cursor()

    async def create_discussion(self, discussion: Discussion) -> Discussion:
        query = "INSERT INTO discussions (id, target_type, target_id, user_id, content, created_at) VALUES (?, ?, ?, ?, ?, ?)"
        self.cursor.execute(query, (discussion.id, discussion.target_type, discussion.target_id, discussion.user_id, discussion.content, discussion.created_at.isoformat()))
        self.conn.commit()
        return discussion

    async def get_discussions(self, target_id: str) -> List[Discussion]:
        self.cursor.execute("SELECT * FROM discussions WHERE target_id = ?", (target_id,))
        rows = self.cursor.fetchall()
        return [Discussion(**dict(row)) for row in rows]

    async def create_review(self, review: ExamReview) -> ExamReview:
        query = "INSERT INTO exam_reviews (id, exam_id, user_id, rating, comment, created_at) VALUES (?, ?, ?, ?, ?, ?)"
        self.cursor.execute(query, (review.id, review.exam_id, review.user_id, review.rating, review.comment, review.created_at.isoformat()))
        self.conn.commit()
        return review

    async def get_activity_feed(self, user_id: str) -> List[ActivityFeed]:
        # Simple feed query
        self.cursor.execute("SELECT * FROM activity_feed WHERE user_id = ? ORDER BY created_at DESC", (user_id,))
        rows = self.cursor.fetchall()
        return [ActivityFeed(**dict(row)) for row in rows]

    async def update_creator_stats(self, user_id: str, xp_gain: int) -> None:
        # Implementation to update reputation
        query = "UPDATE creator_stats SET reputation_score = reputation_score + ? WHERE user_id = ?"
        self.cursor.execute(query, (xp_gain, user_id))
        self.conn.commit()
