"""Challenge + Skill Graph + AI Mentor + Activity + Creator + Discussion routers."""

from fastapi import APIRouter, Depends
from typing import Any

from app.core.deps import get_current_user, require_admin
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
admin_router = APIRouter(prefix="/admin/challenges", tags=["admin-challenges"])

UserDep = Depends(get_current_user)
AdminDep = Depends(require_admin)


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


@router.get("/bookmarked")
async def my_bookmarks(user: dict = UserDep, limit: int = 50):
    challenges = await com.get_my_bookmarks(user["id"], limit=limit)
    return api_response({"challenges": challenges})


@router.get("/my")
async def my_challenges(user: dict = UserDep, limit: int = 50):
    challenges = await com.get_user_created_challenges(user["id"], limit=limit)
    return api_response({"challenges": challenges})


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


@router.post("/{challenge_id}/bookmark")
async def bookmark(challenge_id: str, user: dict = UserDep):
    result = await com.bookmark_challenge(user["id"], challenge_id)
    if result.get("error"):
        return api_response({"error": result["message"]})
    return api_response(result)


@router.delete("/{challenge_id}/bookmark")
async def unbookmark(challenge_id: str, user: dict = UserDep):
    result = await com.unbookmark_challenge(user["id"], challenge_id)
    return api_response(result)


@router.post("/{challenge_id}/rate")
async def rate(challenge_id: str, body: dict, user: dict = UserDep):
    result = await com.rate_challenge(user["id"], challenge_id, int(body.get("rating", 0)))
    if result.get("error"):
        return api_response({"error": result["message"]})
    return api_response(result)


@router.put("/{challenge_id}")
async def update_challenge(challenge_id: str, body: dict, user: dict = UserDep):
    result = await com.update_challenge(user["id"], challenge_id, body)
    if result.get("error"):
        return api_response({"error": result["message"]})
    return api_response(result)


@router.delete("/{challenge_id}")
async def delete_challenge(challenge_id: str, user: dict = UserDep):
    result = await com.delete_challenge(user["id"], challenge_id)
    if result.get("error"):
        return api_response({"error": result["message"]})
    return api_response(result)


@router.post("/{challenge_id}/publish")
async def publish(challenge_id: str, user: dict = UserDep):
    result = await com.publish_challenge(user["id"], challenge_id)
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


# ── Admin Challenge Management ────────────────────────────────────────────────

@admin_router.get("/stats")
async def admin_challenge_stats(user: dict = AdminDep):
    from app.db.mongodb import get_read_db
    from datetime import datetime, timezone
    db = get_read_db()

    total = await db.challenges.count_documents({})
    published = await db.challenges.count_documents({"status": "published"})
    drafts = await db.challenges.count_documents({"status": "draft"})
    attempts_pipeline = [
        {"$group": {"_id": None, "count": {"$sum": 1}, "correct": {"$sum": {"$cond": ["$is_correct", 1, 0]}}}}
    ]
    attempts_doc = await db.challenge_attempts.aggregate(attempts_pipeline).to_list(length=1)
    total_attempts = attempts_doc[0]["count"] if attempts_doc else 0
    correct_count = attempts_doc[0]["correct"] if attempts_doc else 0
    completion_rate = (correct_count / total_attempts) if total_attempts > 0 else 0.0

    by_difficulty = {}
    diff_cursor = db.challenges.aggregate([
        {"$group": {"_id": "$difficulty", "count": {"$sum": 1}}}
    ])
    async for doc in diff_cursor:
        if doc["_id"]:
            by_difficulty[doc["_id"]] = doc["count"]

    by_source = {}
    source_cursor = db.challenges.aggregate([
        {"$group": {"_id": "$source", "count": {"$sum": 1}}}
    ])
    async for doc in source_cursor:
        if doc["_id"]:
            by_source[doc["_id"]] = doc["count"]

    return api_response({
        "total": total,
        "published": published,
        "drafts": drafts,
        "total_attempts": total_attempts,
        "completion_rate": completion_rate,
        "by_difficulty": by_difficulty,
        "by_source": by_source,
    })


@admin_router.get("")
async def admin_list_challenges(
    search: str | None = None,
    status: str | None = None,
    difficulty: str | None = None,
    source: str | None = None,
    sort: str = "newest",
    page: int = 1,
    per_page: int = 20,
    user: dict = AdminDep,
):
    from app.db.mongodb import get_read_db
    db = get_read_db()
    query: dict[str, Any] = {}
    if search:
        import re
        regex = re.compile(re.escape(search), re.IGNORECASE)
        query["$or"] = [
            {"title": regex},
            {"description": regex},
            {"skills_raw": regex},
        ]
    if status:
        query["status"] = status
    if difficulty:
        query["difficulty"] = difficulty
    if source:
        query["source"] = source

    total = await db.challenges.count_documents(query)
    cursor = db.challenges.find(query)
    if sort == "popular":
        cursor = cursor.sort("stats.attempts", -1)
    elif sort == "quality":
        cursor = cursor.sort("quality_score", -1)
    else:
        cursor = cursor.sort("created_at", -1)
    challenges = await cursor.skip((page - 1) * per_page).to_list(length=per_page)
    return api_response({"challenges": challenges, "total": total, "page": page, "per_page": per_page})


@admin_router.get("/{challenge_id}")
async def admin_get_challenge(challenge_id: str, user: dict = AdminDep):
    from app.db.mongodb import get_read_db
    db = get_read_db()
    challenge = await db.challenges.find_one({"_id": challenge_id})
    if not challenge:
        return api_response({"error": "Challenge not found"})
    attempts = await db.challenge_attempts.find(
        {"challenge_id": challenge_id},
    ).sort("created_at", -1).to_list(length=100)
    return api_response({"challenge": challenge, "attempts": attempts})


@admin_router.put("/{challenge_id}")
async def admin_update_challenge(challenge_id: str, body: dict, user: dict = AdminDep):
    from app.db.mongodb import get_db
    from datetime import datetime, timezone
    db = get_db()
    challenge = await db.challenges.find_one({"_id": challenge_id})
    if not challenge:
        return api_response({"error": "Challenge not found"})

    allowed_fields = {
        "title", "description", "topic", "domain", "difficulty", "type",
        "content", "explanation", "skills", "skills_raw", "status", "quality_score",
    }
    update_fields = {k: v for k, v in body.items() if k in allowed_fields and v is not None}
    if not update_fields:
        return api_response({"error": "No valid fields to update"})

    update_fields["updated_at"] = datetime.now(timezone.utc).isoformat()
    await db.challenges.update_one(
        {"_id": challenge_id},
        {"$set": update_fields},
    )
    updated = await db.challenges.find_one({"_id": challenge_id})
    return api_response({"success": True, "challenge": updated})


@admin_router.post("/{challenge_id}/publish")
async def admin_publish_challenge(challenge_id: str, user: dict = AdminDep):
    from app.db.mongodb import get_db
    from datetime import datetime, timezone
    db = get_db()
    challenge = await db.challenges.find_one({"_id": challenge_id})
    if not challenge:
        return api_response({"error": "Challenge not found"})
    await db.challenges.update_one(
        {"_id": challenge_id},
        {"$set": {"status": "published", "updated_at": datetime.now(timezone.utc).isoformat()}},
    )
    return api_response({"success": True, "status": "published"})


@admin_router.post("/{challenge_id}/unpublish")
async def admin_unpublish_challenge(challenge_id: str, user: dict = AdminDep):
    from app.db.mongodb import get_db
    from datetime import datetime, timezone
    db = get_db()
    challenge = await db.challenges.find_one({"_id": challenge_id})
    if not challenge:
        return api_response({"error": "Challenge not found"})
    await db.challenges.update_one(
        {"_id": challenge_id},
        {"$set": {"status": "draft", "updated_at": datetime.now(timezone.utc).isoformat()}},
    )
    return api_response({"success": True, "status": "draft"})


@admin_router.delete("/{challenge_id}")
async def admin_delete_challenge(challenge_id: str, user: dict = AdminDep):
    from app.db.mongodb import get_db
    db = get_db()
    challenge = await db.challenges.find_one({"_id": challenge_id})
    if not challenge:
        return api_response({"error": "Challenge not found"})
    await db.challenges.delete_one({"_id": challenge_id})
    await db.challenge_attempts.delete_many({"challenge_id": challenge_id})
    await db.challenge_ratings.delete_many({"challenge_id": challenge_id})
    await db.challenge_bookmarks.delete_many({"challenge_id": challenge_id})
    return api_response({"success": True, "deleted": challenge_id})


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