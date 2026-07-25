from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from app.core.deps import get_current_user
from app.core.response import api_response
from app.db.mongodb import get_read_db
from app.services.ai_tutor import ask_ai_tutor, get_chat_history, clear_chat_history

router = APIRouter()


class AskQuestionIn(BaseModel):
    question: str = Field(..., min_length=1, max_length=2000)


@router.post("/courses/{course_id}/lessons/{lesson_id}/ai-tutor/ask")
async def ask_question(
    course_id: str,
    lesson_id: str,
    body: AskQuestionIn,
    user: dict = Depends(get_current_user),
):
    """Ask a question to the AI tutor for a specific lesson."""
    db = get_read_db()

    course = await db.courses.find_one({"_id": course_id})
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")

    lesson = None
    for l in course.get("syllabus", []):
        if l["id"] == lesson_id:
            lesson = l
            break
    if not lesson:
        raise HTTPException(status_code=404, detail="Lesson not found")

    result = await ask_ai_tutor(user["id"], course, lesson, body.question)
    return api_response(result)


@router.get("/courses/{course_id}/lessons/{lesson_id}/ai-tutor/history")
async def get_history(
    course_id: str,
    lesson_id: str,
    user: dict = Depends(get_current_user),
):
    """Get AI tutor conversation history for a lesson."""
    history = await get_chat_history(user["id"], course_id, lesson_id)
    return api_response({"messages": history})


@router.delete("/courses/{course_id}/lessons/{lesson_id}/ai-tutor/history")
async def delete_history(
    course_id: str,
    lesson_id: str,
    user: dict = Depends(get_current_user),
):
    """Clear AI tutor conversation history for a lesson."""
    cleared = await clear_chat_history(user["id"], course_id, lesson_id)
    return api_response({"cleared": cleared})