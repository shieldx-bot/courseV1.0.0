import os
os.environ["MONGODB_URI"] = "memory://test"

import json
from unittest.mock import patch, MagicMock

from app.services import course_generator
from app.core.config import settings


def _make_course() -> dict:
    return {
        "_id": "course-test",
        "category_id": "cat-data",
        "category_slug": "data",
        "category_name": "Data & Analytics",
        "title": "Python for Data Science",
        "slug": "python-for-data-science",
        "description": "",
        "image_url": "",
        "instructor": {"name": "John Doe", "bio": "Data scientist"},
        "lesson_count": 3,
        "syllabus": [
            {"id": "l1", "title": "Introduction to Python", "order": 1, "duration_seconds": 600},
            {"id": "l2", "title": "NumPy Basics", "order": 2, "duration_seconds": 900},
            {"id": "l3", "title": "Pandas for Data Analysis", "order": 3, "duration_seconds": 1200},
        ],
        "outcome": [],
    }


def test_build_summary_prompt_contains_course_info():
    course = _make_course()
    prompt = course_generator._build_summary_prompt(course)
    assert "Python for Data Science" in prompt
    assert "Data & Analytics" in prompt
    assert "Introduction to Python" in prompt
    assert "NumPy Basics" in prompt


def test_build_summary_prompt_includes_json_format():
    course = _make_course()
    prompt = course_generator._build_summary_prompt(course)
    assert "short_description" in prompt
    assert "long_description" in prompt
    assert "learning_outcomes" in prompt
    assert "thumbnail_prompt" in prompt


def test_build_thumbnail_prompt():
    course = _make_course()
    prompt = course_generator._build_thumbnail_prompt(course)
    assert "Python for Data Science" in prompt
    assert "Data & Analytics" in prompt
    assert "thumbnail" in prompt.lower()


def test_fallback_content_structure():
    course = _make_course()
    result = course_generator._fallback_content(course)
    assert result["source"] == "rule-based"
    assert "short_description" in result
    assert "long_description" in result
    assert "learning_outcomes" in result
    assert "thumbnail_prompt" in result
    assert len(result["learning_outcomes"]) == 5
    assert "error" not in result


def test_fallback_content_with_error():
    course = _make_course()
    result = course_generator._fallback_content(course, error="API error")
    assert result["error"] == "API error"
    assert result["source"] == "rule-based"


def test_fallback_content_includes_course_title():
    course = _make_course()
    result = course_generator._fallback_content(course)
    assert "Python for Data Science" in result["short_description"]
    assert "Data & Analytics" in result["long_description"]


def test_generate_course_content_no_api_key():
    course = _make_course()
    original_key = settings.openai_api_key
    settings.openai_api_key = ""
    try:
        result = course_generator.generate_course_content(course)
        assert result["source"] in ("rule-based", "none")
        assert "short_description" in result
    finally:
        settings.openai_api_key = original_key


@patch("app.services.course_generator.openai.OpenAI")
def test_generate_course_content_with_openai(mock_openai):
    mock_client = MagicMock()
    mock_response = MagicMock()
    mock_response.choices = [
        MagicMock(message=MagicMock(content=json.dumps({
            "short_description": "Learn Python for data science",
            "long_description": "A comprehensive course on Python.",
            "learning_outcomes": ["Write Python code", "Use NumPy", "Analyze data with Pandas",
                                  "Create visualizations", "Build ML models"],
            "thumbnail_prompt": "A clean thumbnail with Python logo and data charts",
        })))
    ]
    mock_client.chat.completions.create.return_value = mock_response
    mock_openai.return_value = mock_client

    course = _make_course()
    result = course_generator.generate_course_content(course)

    assert result["source"] == "openai"
    assert result["short_description"] == "Learn Python for data science"
    assert len(result["learning_outcomes"]) == 5
    assert "thumbnail_prompt" in result
    mock_client.chat.completions.create.assert_called_once()


@patch("app.services.course_generator.openai.OpenAI")
def test_generate_course_content_openai_fallback_on_error(mock_openai):
    mock_client = MagicMock()
    mock_client.chat.completions.create.side_effect = Exception("API Error")
    mock_openai.return_value = mock_client

    course = _make_course()
    result = course_generator.generate_course_content(course)

    assert result["source"] == "rule-based"
    assert "error" in result
    assert "short_description" in result


@patch("app.services.course_generator.openai.OpenAI")
def test_generate_course_content_openai_fallback_on_invalid_json(mock_openai):
    mock_client = MagicMock()
    mock_response = MagicMock()
    mock_response.choices = [
        MagicMock(message=MagicMock(content="Not valid json at all"))
    ]
    mock_client.chat.completions.create.return_value = mock_response
    mock_openai.return_value = mock_client

    course = _make_course()
    result = course_generator.generate_course_content(course)

    assert result["source"] == "rule-based"
    assert "error" in result


def test_generate_for_course_with_empty_syllabus():
    course = _make_course()
    course["syllabus"] = []
    course["lesson_count"] = 0
    result = course_generator._fallback_content(course)
    assert result["source"] == "rule-based"
    assert "short_description" in result
    assert "0 bài học" in result["short_description"]
