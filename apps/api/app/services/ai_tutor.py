"""AI Tutor — RAG-based Q&A for each lesson.

Uses Groq/OpenAI-compatible LLM to answer learner questions based on
course/lesson context. Stores conversation history per user per lesson
in MongoDB for continuity.
"""

import json
import logging
import re
from datetime import datetime, timezone
from typing import Any

from app.core.config import settings
from app.services.llm import call_llm, is_llm_available
from app.db.mongodb import get_db

logger = logging.getLogger(__name__)


# ── Prompts ──────────────────────────────────────────────────────────────────

_SYSTEM_PROMPT = """You are an AI tutor for an online learning platform. Your role is to help learners understand the lesson material.

Rules:
1. Answer based ONLY on the provided lesson context. If the context doesn't contain the answer, say "I don't have enough information from this lesson to answer that."
2. Be concise, clear, and encouraging — like a real tutor.
3. Use examples when helpful.
4. If the learner seems confused, suggest reviewing specific parts of the lesson.
5. Keep answers under 200 words unless the topic requires more depth.
6. Respond in the SAME language as the question (Vietnamese or English).
7. NEVER provide answers unrelated to the lesson context.
8. If asked about code, provide short, focused code examples.
9. If the question is not related to the lesson, politely redirect them to the lesson topic."""


def _build_lesson_context(course: dict, lesson: dict) -> str:
    """Build a text context string from course and lesson data."""
    lines = []
    lines.append(f"Course: {course.get('title', '')}")
    lines.append(f"Category: {course.get('category_name', '')}")
    lines.append(f"Description: {course.get('description', '')}")

    syllabus = course.get("syllabus", [])
    all_lessons = "\n".join(
        f"  {i+1}. {l.get('title', '')} ({l.get('duration_seconds', 0)}s)"
        for i, l in enumerate(syllabus)
    )
    lines.append(f"All lessons in course:\n{all_lessons}")

    current_order = next(
        (i + 1 for i, l in enumerate(syllabus) if l["id"] == lesson.get("id")),
        0,
    )
    lines.append(f"\n--- Current lesson ({current_order}/{len(syllabus)}) ---")
    lines.append(f"Lesson title: {lesson.get('title', '')}")
    lines.append(f"Duration: {lesson.get('duration_seconds', 0)} seconds")

    outcomes = course.get("outcome", [])
    if outcomes:
        lines.append(f"Learning outcomes: {', '.join(outcomes)}")

    return "\n".join(lines)


async def get_or_create_session(
    user_id: str,
    course_id: str,
    lesson_id: str,
) -> dict[str, Any]:
    """Get existing AI tutor session or create a new one."""
    db = get_db()
    session = await db.ai_tutor_sessions.find_one({
        "user_id": user_id,
        "course_id": course_id,
        "lesson_id": lesson_id,
    })
    if session:
        return session

    session_id = f"ait-{user_id}-{course_id}-{lesson_id}"
    doc = {
        "_id": session_id,
        "user_id": user_id,
        "course_id": course_id,
        "lesson_id": lesson_id,
        "messages": [],
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.ai_tutor_sessions.insert_one(doc)
    return doc


async def ask_ai_tutor(
    user_id: str,
    course: dict,
    lesson: dict,
    question: str,
) -> dict[str, Any]:
    """Ask a question to the AI tutor for a specific lesson.

    Uses RAG: retrieves lesson context, builds prompt, calls LLM,
    stores conversation history.
    """
    db = get_db()
    lesson_context = _build_lesson_context(course, lesson)

    session = await get_or_create_session(
        user_id, course["_id"], lesson["id"]
    )
    messages = session.get("messages", [])

    # Build chat messages for LLM
    chat_messages = [
        {"role": "system", "content": _SYSTEM_PROMPT},
        {"role": "user", "content": f"Here is the lesson context:\n\n{lesson_context}"},
    ]

    # Add recent history (last 4 exchanges for context)
    for msg in messages[-8:]:  # last 4 user + 4 assistant
        chat_messages.append({
            "role": msg["role"],
            "content": msg["content"],
        })

    chat_messages.append({"role": "user", "content": question})

    try:
        answer = await _call_llm(chat_messages)

        # Store in session
        messages.append({
            "role": "user",
            "content": question,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        })
        messages.append({
            "role": "assistant",
            "content": answer,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        })

        await db.ai_tutor_sessions.update_one(
            {"_id": session["_id"]},
            {
                "$set": {
                    "messages": messages,
                    "updated_at": datetime.now(timezone.utc).isoformat(),
                }
            },
        )

        return {
            "answer": answer,
            "session_id": session["_id"],
            "message_count": len(messages) // 2,
        }

    except Exception as e:
        logger.error("AI Tutor LLM call failed: %s", e)
        return {
            "answer": "Xin lỗi, tôi không thể xử lý câu hỏi của bạn ngay lúc này. Vui lòng thử lại sau.",
            "session_id": session["_id"],
            "message_count": len(messages) // 2,
            "error": str(e),
        }


async def get_chat_history(
    user_id: str,
    course_id: str,
    lesson_id: str,
) -> list[dict[str, str]]:
    """Get the conversation history for a lesson."""
    db = get_db()
    session = await db.ai_tutor_sessions.find_one({
        "user_id": user_id,
        "course_id": course_id,
        "lesson_id": lesson_id,
    })
    if not session:
        return []
    return [
        {"role": m["role"], "content": m["content"], "timestamp": m.get("timestamp", "")}
        for m in session.get("messages", [])
    ]


async def clear_chat_history(
    user_id: str,
    course_id: str,
    lesson_id: str,
) -> bool:
    """Clear the conversation history for a lesson."""
    db = get_db()
    result = await db.ai_tutor_sessions.update_one(
        {"user_id": user_id, "course_id": course_id, "lesson_id": lesson_id},
        {"$set": {"messages": [], "updated_at": datetime.now(timezone.utc).isoformat()}},
    )
    return result.modified_count > 0


async def _call_llm(messages: list[dict[str, str]]) -> str:
    """Call the LLM (multi-provider) with the given messages."""
    if not is_llm_available():
        return "AI Tutor is not available at the moment. Please try again later."

    return await call_llm(
        messages=messages,
        max_tokens=500,
        temperature=0.3,
    )
