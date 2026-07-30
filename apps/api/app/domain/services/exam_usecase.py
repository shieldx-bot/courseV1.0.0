from typing import List, Any, Dict
from ..entities.exam import Exam, Question
from ..interfaces.repositories import IExamRepository, IQuestionRepository, IProfileRepository
from .grading import GradingService

class ExamUseCase:
    def __init__(
        self, 
        exam_repo: IExamRepository, 
        question_repo: IQuestionRepository,
        profile_repo: IProfileRepository,
        grading_service: GradingService
    ):
        self.exam_repo = exam_repo
        self.question_repo = question_repo
        self.profile_repo = profile_repo
        self.grading_service = grading_service

    async def submit_exam(self, user_id: str, exam_id: str, user_answers: List[Dict[str, Any]]):
        exam = await self.exam_repo.get_by_id(exam_id)
        if not exam:
            raise ValueError("Exam not found")

        questions = await self.question_repo.get_by_exam(exam_id)
        question_map = {q.id: q for q in questions}

        total_score = 0
        total_possible = sum(q.points for q in questions)
        feedback_list = []

        for ans in user_answers:
            q_id = ans.get("question_id")
            val = ans.get("user_answer")
            
            if q_id in question_map:
                question = question_map[q_id]
                is_correct, score, feedback = self.grading_service.grade_answer(question, val)
                total_score += score
                feedback_list.append({
                    "question_id": q_id,
                    "is_correct": is_correct,
                    "score": score,
                    "feedback": feedback
                })

        # Gamification logic
        user_profile = await self.profile_repo.get_by_user_id(user_id)
        current_streak = user_profile.streak if user_profile else 0
        
        difficulty_multipliers = {
            "easy": 1.0,
            "medium": 1.5,
            "hard": 2.0,
            "expert": 3.0,
            "legendary": 4.0
        }
        
        multiplier = difficulty_multipliers.get(exam.difficulty.value, 1.0)
        score_percentage = (total_score / total_possible) if total_possible > 0 else 0
        
        # XP_earned = (BaseXP * DifficultyMultiplier * ScorePercentage) + StreakBonus
        # TimeBonus assumed 0 for now as actual time is not provided
        streak_bonus = min(current_streak * 5, 50)
        xp_gain = int((100 * multiplier * score_percentage) + streak_bonus)
        
        await self.profile_repo.update_stats(user_id, xp_gain, solved_increment=True)

        return {
            "score": total_score,
            "total_points": total_possible,
            "passed": total_score >= (total_possible * 0.5),
            "feedback": feedback_list,
            "xp_gained": xp_gain
        }
