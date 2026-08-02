"""AI Challenge Generator — tạo challenge bằng LLM + tự đánh giá chất lượng."""

import json
import logging
import re
from datetime import datetime, timezone
from typing import Any

from app.core.config import settings
from app.services.llm import call_llm, is_llm_available
from app.services.skill_graph import resolve_skill_ids

logger = logging.getLogger(__name__)

VALID_TYPES = ["theory", "debug", "coding", "scenario", "analysis"]
VALID_DIFFICULTIES = ["easy", "medium", "hard", "expert"]
DIFFICULTY_SCORE = {"easy": 2, "medium": 5, "hard": 8, "expert": 9}


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _make_id(title: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", title.lower()).strip("-")
    return f"ch-{slug[:60]}-{int(datetime.now(timezone.utc).timestamp() * 1000)}"


async def generate_challenge(
    topic: str,
    domain: str = "technology",
    difficulty: str = "medium",
    challenge_type: str = "theory",
    skills: list[str] | None = None,
) -> dict[str, Any]:
    """Generate một challenge bằng AI.

    Quy trình:
    1. Gọi LLM tạo nội dung question + đáp án + giải thích + skills.
    2. Gọi LLM lần 2 để tự đánh giá chất lượng (self-critique) → quality_score.
    3. Lưu vào collection `challenges` với status draft.
    """
    if difficulty not in VALID_DIFFICULTIES:
        difficulty = "medium"
    if challenge_type not in VALID_TYPES:
        challenge_type = "theory"

    prompt = _build_generation_prompt(topic, domain, difficulty, challenge_type, skills)

    try:
        text = await call_llm(
            messages=[{"role": "user", "content": prompt}],
            max_tokens=1500,
            temperature=0.7,
            response_format={"type": "json_object"},
        )
    except Exception:
        text = await call_llm(
            messages=[{"role": "user", "content": prompt}],
            max_tokens=1500,
            temperature=0.7,
        )

    data = _parse_json(text)
    if not data:
        return {"error": True, "message": "AI generation failed — invalid response format."}

    # ── Resolve skills ──
    skill_ids = await resolve_skill_ids(data.get("skills", skills or []))

    challenge: dict[str, Any] = {
        "_id": _make_id(data.get("title", topic)),
        "title": data.get("title", topic),
        "description": data.get("description", ""),
        "topic": topic,
        "domain": data.get("domain", domain),
        "difficulty": difficulty,
        "difficulty_score": data.get("difficulty_score") or DIFFICULTY_SCORE.get(difficulty, 5),
        "type": data.get("type") or challenge_type,
        "content": {
            "question": data.get("question", ""),
            "options": data.get("options", []),
            "correct": data.get("correct", 0),
            "scenario": data.get("scenario", ""),
            "expected_answer": data.get("expected_answer", ""),
        },
        "explanation": data.get("explanation", ""),
        "skills_related": data.get("related_knowledge", []),
        "skills": skill_ids,
        "skills_raw": data.get("skills", skills or []),
        "test_cases": data.get("test_cases", []),
        "source": "ai",
        "creator_id": None,
        "status": "draft",
        "quality_score": 0.0,
        "stats": {"attempts": 0, "completion_rate": 0.0, "avg_rating": 0.0, "bookmarks": 0},
        "created_at": _now(),
        "updated_at": _now(),
    }

    # ── Self-critique / quality assessment ──
    challenge["quality_score"] = await _self_critique(challenge)

    from app.db.mongodb import get_db
    await get_db().challenges.insert_one(challenge)
    return challenge


async def _self_critique(challenge: dict[str, Any]) -> float:
    """AI tự đánh giá chất lượng câu hỏi (0.0 - 1.0)."""
    if not is_llm_available():
        return 0.5

    prompt = f"""You are a senior technical question reviewer. Evaluate the quality of this challenge on a scale of 0.0 to 1.0.

Challenge:
Title: {challenge['title']}
Type: {challenge['type']}
Difficulty: {challenge['difficulty']} ({challenge.get('difficulty_score')}/10)
Question: {challenge['content'].get('question', '')}
Options: {json.dumps(challenge['content'].get('options', []), ensure_ascii=False)}
Explanation: {challenge['explanation']}
Skills: {challenge.get('skills_raw', [])}

Scoring criteria:
- Clarity (0-0.3): Is the question unambiguous and well-written?
- Answer quality (0-0.3): Is the explanation accurate and educational?
- Difficulty accuracy (0-0.2): Does the difficulty match the question complexity?
- Skill alignment (0-0.2): Do the skills match the question content?

Return ONLY a JSON object: {{"quality_score": 0.0, "issues": ["...", "..."]}}"""

    try:
        text = await call_llm(
            messages=[{"role": "user", "content": prompt}],
            max_tokens=300,
            temperature=0.1,
            response_format={"type": "json_object"},
        )
    except Exception:
        text = await call_llm(
            messages=[{"role": "user", "content": prompt}],
            max_tokens=300,
            temperature=0.1,
        )

    data = _parse_json(text)
    if data and isinstance(data.get("quality_score"), (int, float)):
        return max(0.0, min(1.0, float(data["quality_score"])))
    return 0.5


def _build_generation_prompt(
    topic: str, domain: str, difficulty: str, challenge_type: str, skills: list[str] | None
) -> str:
    skills_line = f"Relevant skills (use standard names like 'Kubernetes', 'AWS', 'Linux', 'Docker', 'Python'): {', '.join(skills)}" if skills else \
        "Relevant skills: infer from the topic using standard names (e.g. 'Kubernetes', 'CNI', 'AWS', 'Linux')."
    type_instructions = {
        "theory": "A multiple-choice question with 4 options and 1 correct answer.",
        "debug": "A scenario describing a broken system/configuration. Provide the correct command/config to fix it and an expected answer.",
        "coding": "A coding task with test cases [{input, expected}]. Provide an expected solution approach.",
        "scenario": "A real-world architecture/operational scenario with a question and expected_answer.",
        "analysis": "An analysis task requiring reasoning. Provide expected_answer.",
    }
    return f"""You are an expert technical content creator for a competitive learning platform (like LeetCode + TryHackMe).

Create ONE high-quality {challenge_type} challenge for a {difficulty} difficulty level.

Topic: {topic}
Domain: {domain}
Type instructions: {type_instructions.get(challenge_type, type_instructions['theory'])}
{skills_line}

Return ONLY valid JSON (no markdown fences):
{{
  "title": "Short punchy title",
  "description": "1-2 sentence summary",
  "question": "The full question/scenario text",
  "options": ["A", "B", "C", "D"],
  "correct": 0,
  "explanation": "Detailed explanation of the correct answer and why others are wrong",
  "related_knowledge": ["Sub-topic 1", "Sub-topic 2"],
  "skills": ["Skill1", "Skill2"],
  "difficulty_score": 5,
  "test_cases": [],
  "expected_answer": "For non-MCQ types, the expected answer",
  "type": "{challenge_type}"
}}

Rules:
- The question must test understanding, not trivial recall.
- Wrong options must be tempting but clearly wrong to someone who understands.
- Difficulty {difficulty} maps to a difficulty_score of {DIFFICULTY_SCORE.get(difficulty, 5)}/10.
- Keep explanation under 150 words."""


def _parse_json(text: str) -> dict[str, Any] | None:
    if not text:
        return None
    text = re.sub(r"^```(?:json)?\s*", "", text.strip())
    text = re.sub(r"\s*```$", "", text)
    try:
        data = json.loads(text)
        return data if isinstance(data, dict) else None
    except Exception:
        # Try to find JSON object in text
        match = re.search(r"\{.*\}", text, re.DOTALL)
        if match:
            try:
                data = json.loads(match.group(0))
                return data if isinstance(data, dict) else None
            except Exception:
                return None
        return None