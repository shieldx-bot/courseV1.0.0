from abc import ABC, abstractmethod
from typing import Any, Dict
from ..entities.exam import Question

class GradingStrategy(ABC):
    @abstractmethod
    def grade(self, question: Question, user_answer: Any) -> tuple[bool, int, str]:
        """
        Returns: (is_correct, score_earned, feedback)
        """
        pass

class MultipleChoiceStrategy(GradingStrategy):
    def grade(self, question: Question, user_answer: Any) -> tuple[bool, int, str]:
        # user_answer is the ID of the selected option
        correct_options = [opt.id for opt in question.options if opt.is_correct]
        is_correct = user_answer in correct_options
        score = question.points if is_correct else 0
        feedback = "Correct!" if is_correct else f"Incorrect. The correct answer was: {[opt.content for opt in question.options if opt.is_correct]}"
        return is_correct, score, feedback

class FillBlankStrategy(GradingStrategy):
    def grade(self, question: Question, user_answer: Any) -> tuple[bool, int, str]:
        # Simplified string match
        correct_answer = question.metadata.get("correct_answer", "").strip().lower()
        is_correct = str(user_answer).strip().lower() == correct_answer
        score = question.points if is_correct else 0
        return is_correct, score, "Correct!" if is_correct else f"Incorrect. Expected: {correct_answer}"

class CodingStrategy(GradingStrategy):
    def grade(self, question: Question, user_answer: Any) -> tuple[bool, int, str]:
        # In a real MVP, this would call a sandbox service
        # For now, we mock the logic or do simple pattern matching
        return False, 0, "Coding submission received. Grading via sandbox is pending implementation."

class ContestCodingStrategy(GradingStrategy):
    def grade(self, question: Question, user_answer: Any) -> tuple[bool, int, str]:
        # Logically specific to Contests: Strict time limit/memory enforcement
        # For MVP: Same as CodingStrategy but with higher point multiplier
        is_correct, score, feedback = CodingStrategy().grade(question, user_answer)
        return is_correct, score * 2, feedback

class GradingService:
    def __init__(self):
        self._strategies: Dict[str, GradingStrategy] = {
            "multiple_choice": MultipleChoiceStrategy(),
            "fill_blank": FillBlankStrategy(),
            "coding": CodingStrategy(),
            # Add other strategies here
        }

    def grade_answer(self, question: Question, user_answer: Any, is_contest: bool = False) -> tuple[bool, int, str]:
        if is_contest and question.type == "coding":
            strategy = ContestCodingStrategy()
        else:
            strategy = self._strategies.get(question.type)
        
        if not strategy:
            return False, 0, f"No grading strategy found for type: {question.type}"
        return strategy.grade(question, user_answer)
