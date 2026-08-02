import json
import logging
import re
from typing import Any

from app.core.config import settings
from app.services.llm import call_llm, is_llm_available

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
- Return ONLY the JSON array, no other text
"""


async def generate_quiz(lesson_title: str, transcript: str, num_questions: int = 3) -> list[dict[str, Any]]:
    """Generate quiz questions from lesson transcript using LLM."""
    if not is_llm_available():
        logger.warning("No LLM provider configured, returning empty quiz")
        return []

    try:
        prompt = _build_prompt(lesson_title, transcript, num_questions)

        try:
            response_format = {"type": "json_object"}
            text = await call_llm(
                messages=[{"role": "user", "content": prompt}],
                max_tokens=1500,
                temperature=0.5,
                response_format=response_format,
            )
        except Exception:
            text = await call_llm(
                messages=[{"role": "user", "content": prompt}],
                max_tokens=1500,
                temperature=0.5,
            )

        text = re.sub(r'^```(?:json)?\s*', '', text.strip())
        text = re.sub(r'\s*```$', '', text)

        result = json.loads(text)

        # Validate structure
        if isinstance(result, dict) and "questions" in result:
            result = result["questions"]

        validated = []
        for q in result:
            if all(k in q for k in ("question", "options", "correct", "explanation")):
                if len(q["options"]) == 4 and isinstance(q["correct"], int) and 0 <= q["correct"] < 4:
                    validated.append(q)

        return validated[:num_questions]

    except Exception as e:
        logger.warning("Quiz generation failed: %s", e)
        return []


def _fallback_quiz(lesson_title: str, num_questions: int = 3) -> list[dict[str, Any]]:
    """Generate simple fallback quiz if LLM fails."""
    return [
        {
            "question": f"Key concept from '{lesson_title}': What was the main topic?",
            "options": [
                "Basic introduction",
                "Advanced techniques", 
                "Practical applications",
                "All of the above"
            ],
            "correct": 3,
            "explanation": f"This lesson covered multiple aspects of {lesson_title}."
        }
        for _ in range(num_questions)
    ]