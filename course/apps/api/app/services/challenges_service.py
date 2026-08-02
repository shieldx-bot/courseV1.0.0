"""Challenge grading services — submit, grade, AI mentor analysis.

Phase 7 hardening: grading logic moved out of the community monolith into a
focused service. `app/services/community.py` re-exports this public API, so
the `challenges` router never changes.
"""

import json
import logging
import re
from datetime import datetime, timezone
from typing import Any

from app.core.collections import Collections as C
from app.db.mongodb import get_db, get_read_db
from app.services.llm import call_llm, is_llm_available
from app.services.skill_graph import (
    get_next_challenges_for_skill,
    get_recommended_challenges_for_user,
    get_user_skill,
    update_user_skill,
)

logger = logging.getLogger(__name__)


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _grade_challenge(challenge: dict, answer: Any) -> dict:
    ctype = challenge.get("type", "theory")
    if ctype == "theory":
        correct = challenge.get("content", {}).get("correct", 0)
        is_correct = int(answer or 0) == int(correct)
        return {"is_correct": is_correct, "score": 1.0 if is_correct else 0.0}
    expected = (challenge.get("content", {}).get("expected_answer") or "").strip().lower()
    ans = str(answer or "").strip().lower()
    is_correct = bool(expected) and (expected in ans or ans in expected)
    return {"is_correct": is_correct, "score": 1.0 if is_correct else 0.0}


async def submit_challenge(
    user_id: str, challenge_id: str, answer: Any, time_seconds: float | None = None,
) -> dict[str, Any]:
    """Submit → grade → update skills → record attempt → create activity."""
    db = get_db()
    challenge = await db[C.CHALLENGES].find_one({"_id": challenge_id})
    if not challenge:
        return {"error": True, "message": "Challenge not found."}

    result = _grade_challenge(challenge, answer)
    attempt_id = f"att-{user_id}-{challenge_id}-{int(datetime.now(timezone.utc).timestamp() * 1000)}"

    skill_updates = []
    for skill_id in challenge.get("skills", []):
        upd = await update_user_skill(
            user_id, skill_id,
            correct=result["is_correct"],
            difficulty_score=challenge.get("difficulty_score", 5),
            time_seconds=time_seconds,
        )
        skill_updates.append(upd)
        if upd.get("reached_milestone"):
            from app.services.community import create_activity
            await create_activity(user_id, "skill_milestone", {
                "skill_id": skill_id, "level": upd["level"], "challenge_id": challenge_id,
            })

    attempt = {
        "_id": attempt_id, "user_id": user_id, "challenge_id": challenge_id,
        "answer": answer, "score": result["score"], "is_correct": result["is_correct"],
        "passed": result["is_correct"], "time_seconds": time_seconds,
        "skills_tested": challenge.get("skills", []),
        "mentor_analysis": None, "created_at": _now(),
    }
    await db[C.CHALLENGE_ATTEMPTS].insert_one(attempt)

    stats = challenge.get("stats", {})
    attempts = stats.get("attempts", 0) + 1
    cr = stats.get("completion_rate", 0.0)
    cr = ((cr * (attempts - 1)) + (1.0 if result["is_correct"] else 0.0)) / attempts
    await db[C.CHALLENGES].update_one({"_id": challenge_id}, {"$set": {
        "stats.attempts": attempts, "stats.completion_rate": round(cr, 3),
    }})

    # Publish domain event — listeners react to activity feed, creator stats,
    # and (future) notifications independently. This decouples the submission
    # flow from cross-cutting systems.
    from app.core.events import Event, bus
    await bus.publish(Event(
        name="ChallengeCompleted",
        producer="community.submit_challenge",
        payload={
            "user_id": user_id,
            "challenge_id": challenge_id,
            "challenge_title": challenge.get("title", ""),
            "difficulty": challenge.get("difficulty", "medium"),
            "is_correct": result["is_correct"],
            "attempt_id": attempt_id,
            "creator_id": challenge.get("creator_id"),
        },
    ))

    return {
        "attempt_id": attempt_id,
        "is_correct": result["is_correct"],
        "score": result["score"],
        "explanation": challenge.get("explanation", ""),
        "correct_answer": challenge.get("content", {}).get("correct", 0) if challenge.get("type") == "theory" else challenge.get("content", {}).get("expected_answer", ""),
        "skill_updates": skill_updates,
    }


# ── AI Mentor ─────────────────────────────────────────────────────────────────

async def analyze_attempt(attempt_id: str) -> dict[str, Any]:
    """AI mentor: phân tích vì sao sai + thiếu kiến thức gì + đề xuất bài tiếp theo."""
    db = get_read_db()
    attempt = await db[C.CHALLENGE_ATTEMPTS].find_one({"_id": attempt_id})
    if not attempt:
        return {"error": True, "message": "Attempt not found."}

    challenge = await db[C.CHALLENGES].find_one({"_id": attempt["challenge_id"]})
    skill_ids = attempt.get("skills_tested", challenge.get("skills", []) if challenge else [])
    weak_skills = []
    for sid in skill_ids:
        us = await get_user_skill(attempt["user_id"], sid)
        if us and us["mastery_score"] < 70:
            weak_skills.append({
                "skill_id": sid, "name": us["name"],
                "mastery_score": us["mastery_score"], "level": us["level"],
            })

    analysis: dict[str, Any] = {"weak_concepts": weak_skills, "recommendations": []}

    if not attempt.get("is_correct") and is_llm_available():
        try:
            prompt = f"""Analyze why a student got this challenge wrong and recommend what to learn next.

Challenge: {challenge.get('title', '')}
Question: {challenge.get('content', {}).get('question', '')}
Explanation: {challenge.get('explanation', '')}
Student's answer: {attempt.get('answer')}
Correct answer: {challenge.get('content', {}).get('correct', 0)}
Weak skills: {json.dumps(weak_skills, ensure_ascii=False)}

Return ONLY JSON:
{{"reason": "why wrong (1-2 sentences)", "missing_knowledge": ["concept 1"], "study_tips": ["tip 1"], "recommended_topics": ["topic 1"]}}"""
            text = await call_llm(messages=[{"role": "user", "content": prompt}], max_tokens=500, temperature=0.3)
            text = re.sub(r"^```(?:json)?\s*", "", text.strip())
            text = re.sub(r"\s*```$", "", text)
            data = json.loads(text)
            if isinstance(data, dict):
                analysis.update(data)
        except Exception as exc:
            logger.warning("AI mentor LLM failed: %s", exc)

    for ws in weak_skills[:3]:
        next_ch = await get_next_challenges_for_skill(
            attempt["user_id"], ws["skill_id"], limit=3,
            exclude_challenge_ids=[attempt["challenge_id"]],
        )
        for c in next_ch:
            analysis["recommendations"].append({
                "challenge_id": c["_id"], "title": c.get("title", ""),
                "difficulty": c.get("difficulty", "medium"),
                "skill_id": ws["skill_id"], "skill_name": ws["name"],
            })
    if not analysis["recommendations"]:
        recs = await get_recommended_challenges_for_user(
            attempt["user_id"], limit=3, exclude_challenge_ids=[attempt["challenge_id"]],
        )
        analysis["recommendations"] = [{
            "challenge_id": c["_id"], "title": c.get("title", ""),
            "difficulty": c.get("difficulty", "medium"),
        } for c in recs[:3]]

    await get_db()[C.CHALLENGE_ATTEMPTS].update_one({"_id": attempt_id}, {"$set": {"mentor_analysis": analysis}})
    return analysis
