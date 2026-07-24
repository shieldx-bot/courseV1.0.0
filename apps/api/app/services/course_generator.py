import json
import logging
import re
from typing import Any
from app.core.config import settings

logger = logging.getLogger(__name__)


def _build_summary_prompt(course: dict) -> str:
    title = course.get("title", "")
    category = course.get("category_name", "")
    syllabus = course.get("syllabus", [])
    lesson_titles = "\n".join(f"- {l.get('title', '')}" for l in syllabus[:15])

    return f"""Generate course content for an online learning platform.

Course title: {title}
Category: {category}
Lesson list:
{lesson_titles}

Return ONLY valid JSON (no markdown, no code fences):
{{
  "short_description": "A compelling 2-3 sentence description (50-100 words) for the course card",
  "long_description": "A detailed 3-4 paragraph marketing description for the course detail page (150-250 words). Include what makes this course valuable, who it's for, and key benefits.",
  "learning_outcomes": ["Outcome 1", "Outcome 2", "Outcome 3", "Outcome 4", "Outcome 5"],
  "thumbnail_prompt": "A detailed prompt for generating a course thumbnail image, describing style, colors, and subject matter"
}}

Rules:
- short_description: concise, benefit-driven, suitable for a course card
- long_description: detailed, persuasive, for course detail page
- learning_outcomes: exactly 5 actionable outcomes, each starting with a verb
- thumbnail_prompt: describe a professional, clean thumbnail with course-relevant imagery
- All content must be in Vietnamese
- Return ONLY valid JSON, no other text"""


def _build_thumbnail_prompt(course: dict) -> str:
    title = course.get("title", "")
    category = course.get("category_name", "")
    return (
        f"A professional online course thumbnail for '{title}' in {category}. "
        "Clean design, modern gradient background, relevant iconography, "
        "text overlay with course title. Style: Udemy/Coursera style, "
        "1280x720 resolution, vibrant colors, minimalist."
    )


def generate_course_content(course: dict) -> dict[str, Any]:
    """Generate AI-powered content for a course using Groq LLM.

    Returns short_description, long_description, learning_outcomes,
    thumbnail_prompt.
    Falls back to rule-based content if LLM is unavailable.
    """
    if not settings.openai_api_key:
        return _fallback_content(course)

    try:
        import openai

        client = openai.OpenAI(
            api_key=settings.openai_api_key,
            base_url=settings.openai_base_url,
        )

        prompt = _build_summary_prompt(course)

        kwargs = {
            "model": settings.openai_model,
            "messages": [{"role": "user", "content": prompt}],
            "max_tokens": 1000,
            "temperature": 0.7,
        }

        try:
            kwargs["response_format"] = {"type": "json_object"}
            response = client.chat.completions.create(**kwargs)
        except Exception:
            kwargs.pop("response_format", None)
            response = client.chat.completions.create(**kwargs)

        text = response.choices[0].message.content or ""
        text = re.sub(r'^```(?:json)?\s*', '', text.strip())
        text = re.sub(r'\s*```$', '', text)

        result = json.loads(text)

        return {
            "short_description": result.get("short_description", ""),
            "long_description": result.get("long_description", ""),
            "learning_outcomes": result.get("learning_outcomes", []),
            "thumbnail_prompt": result.get(
                "thumbnail_prompt", _build_thumbnail_prompt(course)
            ),
            "source": "openai",
            "model": settings.openai_model,
        }
    except Exception as e:
        logger.warning("LLM course content generation failed: %s", e)
        return _fallback_content(course, str(e))


def _fallback_content(
    course: dict, error: str | None = None
) -> dict[str, Any]:
    title = course.get("title", "")
    category = course.get("category_name", "")
    syllabus = course.get("syllabus", [])
    lesson_count = len(syllabus)

    result = {
        "short_description": (
            f"Khóa học {title} thuộc danh mục {category} với {lesson_count} bài học, "
            "giúp bạn nắm vững kiến thức từ cơ bản đến nâng cao."
        ),
        "long_description": (
            f"Khóa học {title} được thiết kế dành cho những người muốn tìm hiểu "
            f"và làm chủ lĩnh vực {category}. Với {lesson_count} bài học được biên "
            "soạn kỹ lưỡng, bạn sẽ được hướng dẫn từ những khái niệm cơ bản nhất "
            "đến các kỹ thuật nâng cao.\n\n"
            "Khóa học phù hợp cho cả người mới bắt đầu và những người đã có kiến "
            "thức nền tảng muốn hệ thống hóa lại kiến thức của mình."
        ),
        "learning_outcomes": [
            f"Nắm vững kiến thức nền tảng về {category}",
            "Áp dụng kiến thức vào thực tế",
            "Xây dựng dự án hoàn chỉnh",
            "Phát triển tư duy phân tích và giải quyết vấn đề",
            "Tự tin làm việc trong lĩnh vực chuyên môn",
        ],
        "thumbnail_prompt": _build_thumbnail_prompt(course),
        "source": "rule-based",
        "model": settings.openai_model if settings.openai_api_key else "none",
    }
    if error:
        result["error"] = error
    return result
