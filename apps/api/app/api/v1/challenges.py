"""Challenge + Skill Graph + AI Mentor + Activity + Creator + Discussion routers."""

from fastapi import APIRouter, Depends
from typing import Any

from app.core.deps import get_current_user
from app.core.response import api_response
from app.services import skill_graph as sg
from app.services import ai_challenge_generator as gen
from app.services import community as com
from app.services.llm import is_llm_available
from app.services.skill_graph import seed_skills

router = APIRouter(prefix="/challenges", tags=["challenges"])
skills_router = APIRouter(prefix="/skills", tags=["skills"])
activity_router = APIRouter(prefix="/activity", tags=["activity"])
creators_router = APIRouter(prefix="/creators", tags=["creators"])
mentor_router = APIRouter(prefix="/mentor", tags=["mentor"])

UserDep = Depends(get_current_user)


# ── Challenges ────────────────────────────────────────────────────────────────

@router.post("/generate")
async def generate_challenge(
    body: dict,
    user: dict = UserDep,
):
    result = await gen.generate_challenge(
        topic=body.get("topic", ""),
        domain=body.get("domain", "technology"),
        difficulty=body.get("difficulty", "medium"),
        challenge_type=body.get("type", "theory"),
        skills=body.get("skills"),
    )
    if result.get("error"):
        return api_response({"error": result["message"]})
    return api_response({"challenge": result, "llm_available": is_llm_available()})


@router.get("/recommended")
async def recommended_challenges(user: dict = UserDep, limit: int = 10):
    recs = await sg.get_recommended_challenges_for_user(user["id"], limit=limit)
    return api_response({"challenges": recs})


@router.get("")
async def list_challenges(
    skill: str | None = None,
    difficulty: str | None = None,
    source: str | None = None,
    sort: str = "newest",
    page: int = 1,
    per_page: int = 20,
):
    query: dict[str, Any] = {"status": "published"}
    if skill:
        query["skills"] = f"skill-{skill.lower().replace(' ', '-')}"
    if difficulty:
        query["difficulty"] = difficulty
    if source:
        query["source"] = source

    from app.db.mongodb import get_read_db
    db = get_read_db()
    total = await db.challenges.count_documents(query)
    cursor = db.challenges.find(query)
    if sort == "popular":
        cursor = cursor.sort("stats.attempts", -1)
    elif sort == "rating":
        cursor = cursor.sort("stats.avg_rating", -1)
    elif sort == "quality":
        cursor = cursor.sort("quality_score", -1)
    else:
        cursor = cursor.sort("created_at", -1)
    challenges = await cursor.skip((page - 1) * per_page).to_list(length=per_page)
    return api_response({"challenges": challenges, "total": total, "page": page, "per_page": per_page})


@router.get("/{challenge_id}")
async def get_challenge(challenge_id: str):
    from app.db.mongodb import get_read_db
    challenge = await get_read_db().challenges.find_one({"_id": challenge_id})
    if not challenge:
        return api_response({"error": "Challenge not found"})
    return api_response({"challenge": challenge})


@router.get("/{challenge_id}/attempts")
async def get_attempts(challenge_id: str, user: dict = UserDep):
    from app.db.mongodb import get_read_db
    attempts = await get_read_db().challenge_attempts.find(
        {"challenge_id": challenge_id, "user_id": user["id"]},
    ).sort("created_at", -1).to_list(length=50)
    return api_response({"attempts": attempts})


@router.post("/{challenge_id}/submit")
async def submit(challenge_id: str, body: dict, user: dict = UserDep):
    result = await com.submit_challenge(
        user["id"], challenge_id, body.get("answer"), body.get("time_seconds"),
    )
    if result.get("error"):
        return api_response({"error": result["message"]})
    return api_response(result)


@router.post("")
async def create_challenge(body: dict, user: dict = UserDep):
    """Creator tạo challenge thủ công."""
    from app.db.mongodb import get_db
    from app.services.skill_graph import resolve_skill_ids
    import re
    from datetime import datetime, timezone

    slug = re.sub(r"[^a-z0-9]+", "-", body.get("title", "").lower()).strip("-")
    challenge_id = f"ch-{slug[:60]}-{int(datetime.now(timezone.utc).timestamp() * 1000)}"
    skill_ids = await resolve_skill_ids(body.get("skills", []))
    doc = {
        "_id": challenge_id,
        "title": body.get("title", ""),
        "description": body.get("description", ""),
        "topic": body.get("topic", ""),
        "domain": body.get("domain", "technology"),
        "difficulty": body.get("difficulty", "medium"),
        "difficulty_score": body.get("difficulty_score", 5),
        "type": body.get("type", "theory"),
        "content": body.get("content", {}),
        "explanation": body.get("explanation", ""),
        "skills": skill_ids,
        "skills_raw": body.get("skills", []),
        "source": "user",
        "creator_id": user["id"],
        "status": body.get("status", "draft"),
        "quality_score": body.get("quality_score", 0.5),
        "stats": {"attempts": 0, "completion_rate": 0.0, "avg_rating": 0.0, "bookmarks": 0},
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    await get_db().challenges.insert_one(doc)
    await com.create_activity(user["id"], "challenge_created", {
        "challenge_id": challenge_id, "challenge_title": doc["title"],
    })
    return api_response({"challenge_id": challenge_id, "challenge": doc})


# ── Skill Graph ───────────────────────────────────────────────────────────────

@skills_router.get("")
async def list_skills():
    skills = await sg.get_all_skills()
    return api_response({"skills": skills})


@skills_router.get("/my")
async def my_skills(user: dict = UserDep):
    skills = await sg.get_user_skills(user["id"])
    weak = await sg.get_weak_skills(user["id"], limit=5)
    strong = await sg.get_strong_skills(user["id"], limit=5)
    return api_response({
        "skills": skills,
        "weak_skills": weak,
        "strong_skills": strong,
        "weak_count": len(weak),
        "strong_count": len(strong),
    })


@skills_router.get("/{skill_id}/challenges")
async def skill_challenges(skill_id: str, user: dict = UserDep, limit: int = 10):
    recs = await sg.get_next_challenges_for_skill(user["id"], skill_id, limit=limit)
    return api_response({"challenges": recs})


# ── AI Mentor ─────────────────────────────────────────────────────────────────

@mentor_router.get("/analysis/{attempt_id}")
async def mentor_analysis(attempt_id: str, user: dict = UserDep):
    analysis = await com.analyze_attempt(attempt_id)
    if analysis.get("error"):
        return api_response({"error": analysis["message"]})
    return api_response(analysis)


@mentor_router.get("/recommendations")
async def mentor_recommendations(user: dict = UserDep, limit: int = 5):
    recs = await sg.get_recommended_challenges_for_user(user["id"], limit=limit)
    return api_response({"recommendations": recs})


# ── Activity Feed ─────────────────────────────────────────────────────────────

@activity_router.get("")
async def activity_feed(limit: int = 30, user: dict = Depends(get_current_user)):
    feed = await com.get_public_feed(limit=limit, include_user_id=user["id"])
    return api_response({"events": feed})


@activity_router.get("/my")
async def my_activity(user: dict = UserDep, limit: int = 30):
    events = await com.get_my_activity(user["id"], limit=limit)
    return api_response({"events": events})


# ── Creator System ────────────────────────────────────────────────────────────

@creators_router.get("/me")
async def creator_me(user: dict = UserDep):
    profile = await com.get_creator_profile(user["id"])
    return api_response(profile)


@creators_router.get("/{user_id}")
async def creator_profile(user_id: str):
    profile = await com.get_creator_profile(user_id)
    return api_response(profile)


@creators_router.post("/follow")
async def follow(body: dict, user: dict = UserDep):
    result = await com.follow_creator(user["id"], body.get("creator_id", ""))
    return api_response(result)


@creators_router.delete("/follow/{creator_id}")
async def unfollow(creator_id: str, user: dict = UserDep):
    result = await com.unfollow_creator(user["id"], creator_id)
    return api_response(result)


async def init_community_extension() -> None:
    """Seed skills taxonomy khi app khởi động."""
    try:
        await seed_skills()
    except Exception:
        pass