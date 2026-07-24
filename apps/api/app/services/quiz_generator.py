import json
import logging
from typing import Any
from app.core.config import settings

logger = logging.getLogger(__name__)


def _build_prompt(lesson_title: str, transcript: str, num_questions: int = 3) -> str:
    return f"""Based on this lesson content, generate {num_questions} multiple-choice quiz questions to test understanding.

Lesson title: {lesson_title}
Content: {transcript[:5000]}

Return ONLY valid JSON array (no markdown, no code fences):
[{{"question": "...", "options": ["A", "B", "C", "D"], "correct": 0, "explanation": "..."}}]

Rules:
- Each question must have exactly 4 options
- "correct" is the 0-based index of the correct answer
- Questions should test understanding, not trivial recall
- Provide a brief explanation for the correct answer
- Return ONLY the JSON array, no other text`