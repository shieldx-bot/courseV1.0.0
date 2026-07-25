from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from typing import Optional

from app.core.deps import get_current_user, get_optional_user
from app.core.response import api_response
from app.services.quiz_generator import generate_quiz, _fallback_quiz

router = APIRouter()


class QuizQuestion(BaseModel):
    question: str
    options: list[str]
    correct: int
    explanation: str


class QuizResponse(BaseModel):
    lesson_id: str
    lesson_title: str
    questions: list[QuizQuestion]


class GenerateQuizRequest(BaseModel):
    transcript: str = Field(..., min_length=50, max_length=10000)
    num_questions: int = Field(default=3, ge=1, le=10)


@router.post("/courses/{course_id}/lessons/{lesson_id}/quiz/generate")
async def generate_lesson_quiz(
    course_id: str,
    lesson_id: str,
    body: GenerateQuizRequest,
    user: dict = Depends(get_current_user),
):
    """Generate quiz questions for a lesson from transcript (admin/teacher only)."""
    # TODO: Add admin/teacher check
    questions = await generate_quiz(
        lesson_title=lesson_id,  # We'll fetch actual title
        transcript=body.transcript,
        num_questions=body.num_questions,
    )
    return api_response({"questions": questions})


@router.get("/courses/{course_id}/lessons/{lesson_id}/quiz")
async def get_lesson_quiz(
    course_id: str,
    lesson_id: str,
    user: dict = Depends(get_optional_user),
):
    """Get quiz for a lesson. Returns generated quiz if exists, or generates on-the-fly."""
    # In production, you'd store generated quizzes in DB
    # For now, return empty to indicate no pre-generated quiz
    return api_response({
        "lesson_id": lesson_id,
        "questions": [],
        "generated": False
    })


@router.post("/courses/{course_id}/lessons/{lesson_id}/quiz/submit")
async def submit_quiz(
    course_id: str,
    lesson_id: str,
    answers: dict[int, int],  # question_index -> selected_option_index
    user: dict = Depends(get_current_user),
):
    """Submit quiz answers and get score."""
    # In production, fetch quiz from DB and grade
    return api_response({
        "score": 0,
        "total": len(answers),
        "passed": False,
        "details": []
    })