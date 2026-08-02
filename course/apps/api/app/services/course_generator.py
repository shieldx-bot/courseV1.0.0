import json
import logging
import re
from typing import Any

from app.core.config import settings
from app.services.llm import call_llm, is_llm_available
from app.services.web_search import format_search_results_for_prompt, search_web

logger = logging.getLogger(__name__)

_CONTENT_TASK_PROVIDERS = ["openrouter"]


async def _get_search_context(title: str, category: str) -> str:
    """Retrieve web context to make generated content factually grounded."""
    if not settings.tavily_api_key and not settings.google_search_api_key and not settings.serpapi_api_key:
        return ""
    try:
        query = f"{title} {category} learning outcomes best practices"
        results = await search_web(query, max_results=5)
        if results:
            return format_search_results_for_prompt(results)
        return ""
    except Exception as e:
        logger.warning("Web search failed: %s", e)
        return ""


def _build_summary_prompt(course: dict, search_context: str = "") -> str:
    title = course.get("title", "")
    category = course.get("category_name", "")
    syllabus = course.get("syllabus", [])
    lesson_titles = "\n".join(f"- {l.get('title', '')}" for l in syllabus[:15])

    research_section = ""
    if search_context:
        research_section = (
            "\n=== RESEARCH CONTEXT FROM THE WEB (use for factual accuracy) ===\n"
            f"{search_context}\n"
            "=== END RESEARCH CONTEXT ===\n"
        )

    return f"""You are an expert Curriculum Designer and Educational Content Specialist. Your task is to generate high-quality, factually accurate course content for an online learning platform using BOTH the provided course information AND web research context below.

COURSE INFORMATION:
- Course title: {title}
- Category: {category}
- Lesson list:
{lesson_titles}
{research_section}
Return ONLY valid JSON (no markdown, no code fences):
{{
  "short_description": "A compelling 2-3 sentence description (50-100 words) for the course card",
  "long_description": "A detailed 3-4 paragraph marketing description for the course detail page (150-250 words). Include what makes this course valuable, who it's for, and key benefits.",
  "learning_outcomes": ["Outcome 1", "Outcome 2", "Outcome 3", "Outcome 4", "Outcome 5"],
  "thumbnail_prompt": "A detailed prompt for generating a course thumbnail image, describing style, colors, and subject matter"
}}

RULES:
- short_description: concise, benefit-driven, suitable for a course card
- long_description: detailed, persuasive, for course detail page. MUST include 3 paragraphs: 1) course overview and value proposition, 2) target audience and prerequisites, 3) key benefits and career outcomes
- learning_outcomes: exactly 5 actionable outcomes, each starting with a verb. Base them on real skills/competencies taught in this subject
- thumbnail_prompt: describe a professional, clean thumbnail with course-relevant imagery
- All content must be in Vietnamese
- Use the RESEARCH CONTEXT above to make content factual and up-to-date. Do not invent facts, Dates, statistics, or tool names that are not supported by the research
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


async def generate_course_content(course: dict) -> dict[str, Any]:
    """Generate AI-powered content for a course using multi-provider LLM.

    Uses web search to ground content in factual information when available.
    Returns short_description, long_description, learning_outcomes,
    thumbnail_prompt.
    Falls back to rule-based content if LLM is unavailable.
    """
    if not is_llm_available():
        return _fallback_content(course)

    try:
        title = course.get("title", "")
        category = course.get("category_name", "")
        search_context = await _get_search_context(title, category)
        prompt = _build_summary_prompt(course, search_context=search_context)

        providers = _CONTENT_TASK_PROVIDERS

        try:
            response_format = {"type": "json_object"}
            text = await call_llm(
                messages=[{"role": "user", "content": prompt}],
                max_tokens=1200,
                temperature=0.7,
                response_format=response_format,
                provider_override=providers[0] if providers else None,
            )
        except Exception:
            text = await call_llm(
                messages=[{"role": "user", "content": prompt}],
                max_tokens=1200,
                temperature=0.7,
            )

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
            "source": "llm",
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
