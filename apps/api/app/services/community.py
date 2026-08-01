"""Community services: Challenge grading + AI Mentor + Activity Feed + Creator."""

import json
import logging
import re
from datetime import datetime, timezone
from typing import Any

from app.db.mongodb import get_db, get_read_db
from app.services.llm import call_llm, is_llm_available
from app.services.skill_graph import (
    update_user_skill, get_user_skill, get_recommended_challenges_for_user,
    get_next_challenges_for_skill,
)

logger = logging.getLogger(__name__)


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


# ── Challenge Grading ─────────────────────────────────────────────────────────

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
    challenge = await db.challenges.find_one({"_id": challenge_id})
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
    await db.challenge_attempts.insert_one(attempt)

    stats = challenge.get("stats", {})
    attempts = stats.get("attempts", 0) + 1
    cr = stats.get("completion_rate", 0.0)
    cr = ((cr * (attempts - 1)) + (1.0 if result["is_correct"] else 0.0)) / attempts
    await db.challenges.update_one({"_id": challenge_id}, {"$set": {
        "stats.attempts": attempts, "stats.completion_rate": round(cr, 3),
    }})

    # Update creator stats
    creator_id = challenge.get("creator_id")
    if creator_id:
        await _update_creator_stats(creator_id)

    if result["is_correct"]:
        await create_activity(user_id, "challenge_completed", {
            "challenge_id": challenge_id, "challenge_title": challenge.get("title", ""),
            "difficulty": challenge.get("difficulty", "medium"),
        })

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
    attempt = await db.challenge_attempts.find_one({"_id": attempt_id})
    if not attempt:
        return {"error": True, "message": "Attempt not found."}

    challenge = await db.challenges.find_one({"_id": attempt["challenge_id"]})
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

    await get_db().challenge_attempts.update_one({"_id": attempt_id}, {"$set": {"mentor_analysis": analysis}})
    return analysis


# ── Activity Feed ─────────────────────────────────────────────────────────────

ACTIVITY_LABELS = {
    "challenge_completed": "hoàn thành challenge",
    "challenge_created": "đã tạo challenge mới",
    "skill_milestone": "đạt level",
    "badge_earned": "nhận badge",
    "creator_level_up": "lên cấp creator",
    "top_rank": "lọt Top",
}


async def create_activity(user_id: str, event_type: str, payload: dict, visibility: str = "public") -> dict:
    db = get_db()
    doc = {
        "_id": f"act-{event_type}-{user_id}-{int(datetime.now(timezone.utc).timestamp() * 1000)}",
        "user_id": user_id, "type": event_type, "payload": payload,
        "visibility": visibility, "created_at": _now(),
    }
    await db.activity_events.insert_one(doc)
    return doc


async def get_public_feed(limit: int = 30, include_user_id: str | None = None) -> list[dict[str, Any]]:
    db = get_read_db()
    query: dict[str, Any] = {"visibility": "public"}
    if include_user_id:
        prof = await db.creator_profiles.find_one({"_id": f"cp-{include_user_id}"})
        followed_ids = [f["user_id"] for f in prof.get("followers", [])] if prof else []
        query = {"$or": [{"visibility": "public"}, {"user_id": {"$in": followed_ids + [include_user_id]}}]}

    events = await db.activity_events.find(query).sort("created_at", -1).to_list(length=limit)
    result = []
    for ev in events:
        user = await db.users.find_one({"_id": ev["user_id"]})
        result.append({
            "id": ev["_id"], "user_id": ev["user_id"],
            "user_name": user.get("name") if user else "Unknown",
            "type": ev["type"], "label": ACTIVITY_LABELS.get(ev["type"], ev["type"]),
            "payload": ev.get("payload", {}), "created_at": ev["created_at"],
        })
    return result


async def get_my_activity(user_id: str, limit: int = 30) -> list[dict[str, Any]]:
    db = get_read_db()
    events = await db.activity_events.find({"user_id": user_id}).sort("created_at", -1).to_list(length=limit)
    return [{
        "id": e["_id"], "type": e["type"],
        "label": ACTIVITY_LABELS.get(e["type"], e["type"]),
        "payload": e.get("payload", {}), "created_at": e["created_at"],
    } for e in events]


# ── Creator System ────────────────────────────────────────────────────────────

async def get_creator_profile(user_id: str) -> dict[str, Any]:
    db = get_read_db()
    doc_id = f"cp-{user_id}"
    profile = await db.creator_profiles.find_one({"_id": doc_id})
    if not profile:
        await get_db().creator_profiles.insert_one({
            "_id": doc_id, "user_id": user_id, "level": "beginner", "level_score": 0.0,
            "total_challenges": 0, "published_challenges": 0, "total_attempts_received": 0,
            "avg_completion_rate": 0.0, "avg_rating": 0.0, "followers": [], "badges": [],
            "created_at": _now(), "updated_at": _now(),
        })
        profile = await db.creator_profiles.find_one({"_id": doc_id})

    user = await db.users.find_one({"_id": user_id})
    return {
        "user_id": user_id,
        "user_name": user.get("name") if user else "Unknown",
        "level": profile.get("level", "beginner"),
        "level_score": round(profile.get("level_score", 0.0), 1),
        "total_challenges": profile.get("total_challenges", 0),
        "published_challenges": profile.get("published_challenges", 0),
        "total_attempts_received": profile.get("total_attempts_received", 0),
        "avg_completion_rate": round(profile.get("avg_completion_rate", 0.0), 2),
        "avg_rating": round(profile.get("avg_rating", 0.0), 1),
        "followers_count": len(profile.get("followers", [])),
        "badges": profile.get("badges", []),
    }


async def _update_creator_stats(user_id: str) -> None:
    db = get_db()
    doc_id = f"cp-{user_id}"
    profile = await db.creator_profiles.find_one({"_id": doc_id})
    if not profile:
        return
    challenges = await db.challenges.find({"creator_id": user_id}).to_list(length=500)
    total_attempts = sum(c.get("stats", {}).get("attempts", 0) for c in challenges)
    published = await db.challenges.count_documents({"creator_id": user_id, "status": "published"})
    level_score = min(100.0, published * 10 + total_attempts * 0.5)
    level = _creator_level(level_score)
    await db.creator_profiles.update_one({"_id": doc_id}, {"$set": {
        "total_attempts_received": total_attempts,
        "published_challenges": published,
        "level_score": round(level_score, 1), "level": level, "updated_at": _now(),
    }})


def _creator_level(score: float) -> str:
    if score >= 85:
        return "legend"
    if score >= 65:
        return "expert"
    if score >= 40:
        return "trusted"
    return "beginner"


async def follow_creator(follower_id: str, creator_id: str) -> dict:
    db = get_db()
    doc_id = f"cp-{creator_id}"
    profile = await db.creator_profiles.find_one({"_id": doc_id})
    if not profile:
        return {"error": True, "message": "Creator not found."}
    followers = [f for f in profile.get("followers", []) if f["user_id"] != follower_id]
    followers.append({"user_id": follower_id, "since": _now()})
    await db.creator_profiles.update_one({"_id": doc_id}, {"$set": {"followers": followers}})
    return {"success": True}


async def unfollow_creator(follower_id: str, creator_id: str) -> dict:
    db = get_db()
    doc_id = f"cp-{creator_id}"
    profile = await db.creator_profiles.find_one({"_id": doc_id})
    if not profile:
        return {"error": True, "message": "Creator not found."}
    followers = [f for f in profile.get("followers", []) if f["user_id"] != follower_id]
    await db.creator_profiles.update_one({"_id": doc_id}, {"$set": {"followers": followers}})
    return {"success": True}