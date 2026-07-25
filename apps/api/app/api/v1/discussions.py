from datetime import datetime, timezone
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from bson import ObjectId
from app.db.mongodb import get_db, get_read_db, get_read_db
from app.core.response import api_response
from app.core.deps import get_current_user, get_optional_user
from app.core.exceptions import NotFoundError, ForbiddenError

router = APIRouter()


class DiscussionIn(BaseModel):
    lesson_id: str = Field(..., min_length=1)
    title: str = Field(..., min_length=1, max_length=200)
    content: str = Field(..., min_length=1, max_length=10000)


class DiscussionOut(BaseModel):
    id: str
    lesson_id: str
    course_id: str
    user_id: str
    user_name: str
    user_role: str
    title: str
    content: str
    reply_count: int
    vote_score: int
    user_vote: int
    is_pinned: bool
    is_locked: bool
    created_at: datetime
    updated_at: datetime


class ReplyIn(BaseModel):
    content: str = Field(..., min_length=1, max_length=5000)
    parent_reply_id: Optional[str] = None


class ReplyOut(BaseModel):
    id: str
    discussion_id: str
    user_id: str
    user_name: str
    user_role: str
    content: str
    parent_reply_id: Optional[str]
    vote_score: int
    user_vote: int
    is_instructor_answer: bool
    created_at: datetime
    updated_at: datetime


class VoteIn(BaseModel):
    vote: int = Field(..., ge=-1, le=1)


async def _get_course_id(db, lesson_id: str) -> Optional[str]:
    course = await db.courses.find_one({"syllabus.id": lesson_id})
    return course["_id"] if course else None


async def _enrich_discussion(db, discussion: dict, user_id: Optional[str]) -> DiscussionOut:
    user = await db.users.find_one({"_id": discussion["user_id"]})
    user_vote = 0
    if user_id:
        vote_doc = await db.discussion_votes.find_one({"discussion_id": discussion["_id"], "user_id": user_id})
        if vote_doc:
            user_vote = vote_doc["vote"]
    return DiscussionOut(
        id=discussion["_id"],
        lesson_id=discussion["lesson_id"],
        course_id=discussion["course_id"],
        user_id=discussion["user_id"],
        user_name=user.get("name", "Anonymous") if user else "Anonymous",
        user_role=user.get("role", "student") if user else "student",
        title=discussion["title"],
        content=discussion["content"],
        reply_count=discussion.get("reply_count", 0),
        vote_score=discussion.get("vote_score", 0),
        user_vote=user_vote,
        is_pinned=discussion.get("is_pinned", False),
        is_locked=discussion.get("is_locked", False),
        created_at=discussion["created_at"],
        updated_at=discussion["updated_at"],
    )


async def _enrich_reply(db, reply: dict, user_id: Optional[str]) -> ReplyOut:
    user = await db.users.find_one({"_id": reply["user_id"]})
    user_vote = 0
    if user_id:
        vote_doc = await db.reply_votes.find_one({"reply_id": reply["_id"], "user_id": user_id})
        if vote_doc:
            user_vote = vote_doc["vote"]
    return ReplyOut(
        id=reply["_id"],
        discussion_id=reply["discussion_id"],
        user_id=reply["user_id"],
        user_name=user.get("name", "Anonymous") if user else "Anonymous",
        user_role=user.get("role", "student") if user else "student",
        content=reply["content"],
        parent_reply_id=reply.get("parent_reply_id"),
        vote_score=reply.get("vote_score", 0),
        user_vote=user_vote,
        is_instructor_answer=reply.get("is_instructor_answer", False),
        created_at=reply["created_at"],
        updated_at=reply["updated_at"],
    )


@router.get("/courses/{course_id}/lessons/{lesson_id}/discussions")
async def list_discussions(
    course_id: str,
    lesson_id: str,
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=50),
    sort: str = Query("newest", pattern="^(newest|oldest|most_votes|most_replies)$"),
    user: dict | None = Depends(get_optional_user),
):
    db = get_read_db()
    query = {"course_id": course_id, "lesson_id": lesson_id}
    sort_map = {
        "newest": [("created_at", -1)],
        "oldest": [("created_at", 1)],
        "most_votes": [("vote_score", -1), ("created_at", -1)],
        "most_replies": [("reply_count", -1), ("created_at", -1)],
    }
    cursor = db.discussions.find(query).sort(sort_map[sort]).skip((page - 1) * per_page).limit(per_page)
    discussions = []
    async for doc in cursor:
        discussions.append(await _enrich_discussion(db, doc, user["id"] if user else None))
    total = await db.discussions.count_documents(query)
    return api_response({
        "items": discussions,
        "page": page,
        "per_page": per_page,
        "total": total,
        "total_pages": (total + per_page - 1) // per_page,
    })


@router.post("/courses/{course_id}/lessons/{lesson_id}/discussions")
async def create_discussion(
    course_id: str,
    lesson_id: str,
    body: DiscussionIn,
    user: dict = Depends(get_current_user),
):
    db = get_db()
    course = await db.courses.find_one({"_id": course_id})
    if not course:
        raise NotFoundError("Course not found")
    lesson_exists = any(l["id"] == lesson_id for l in course.get("syllabus", []))
    if not lesson_exists:
        raise NotFoundError("Lesson not found")

    now = datetime.now(timezone.utc)
    discussion = {
        "_id": f"disc-{ObjectId()}",
        "course_id": course_id,
        "lesson_id": lesson_id,
        "user_id": user["id"],
        "title": body.title,
        "content": body.content,
        "reply_count": 0,
        "vote_score": 0,
        "is_pinned": False,
        "is_locked": False,
        "created_at": now,
        "updated_at": now,
    }
    await db.discussions.insert_one(discussion)
    enriched = await _enrich_discussion(db, discussion, user["id"])
    return api_response(enriched, status_code=201)


@router.get("/courses/{course_id}/lessons/{lesson_id}/discussions/{discussion_id}")
async def get_discussion(
    course_id: str,
    lesson_id: str,
    discussion_id: str,
    user: dict | None = Depends(get_optional_user),
):
    db = get_read_db()
    discussion = await db.discussions.find_one({"_id": discussion_id, "course_id": course_id, "lesson_id": lesson_id})
    if not discussion:
        raise NotFoundError("Discussion not found")
    enriched = await _enrich_discussion(db, discussion, user["id"] if user else None)
    return api_response(enriched)


@router.put("/courses/{course_id}/lessons/{lesson_id}/discussions/{discussion_id}")
async def update_discussion(
    course_id: str,
    lesson_id: str,
    discussion_id: str,
    body: DiscussionIn,
    user: dict = Depends(get_current_user),
):
    db = get_db()
    discussion = await db.discussions.find_one({"_id": discussion_id, "course_id": course_id, "lesson_id": lesson_id})
    if not discussion:
        raise NotFoundError("Discussion not found")
    if discussion["user_id"] != user["id"] and user.get("role") != "admin":
        raise ForbiddenError("Not authorized to edit this discussion")
    await db.discussions.update_one(
        {"_id": discussion_id},
        {"$set": {"title": body.title, "content": body.content, "updated_at": datetime.now(timezone.utc)}},
    )
    discussion["title"] = body.title
    discussion["content"] = body.content
    discussion["updated_at"] = datetime.now(timezone.utc)
    enriched = await _enrich_discussion(db, discussion, user["id"])
    return api_response(enriched)


@router.delete("/courses/{course_id}/lessons/{lesson_id}/discussions/{discussion_id}")
async def delete_discussion(
    course_id: str,
    lesson_id: str,
    discussion_id: str,
    user: dict = Depends(get_current_user),
):
    db = get_db()
    discussion = await db.discussions.find_one({"_id": discussion_id, "course_id": course_id, "lesson_id": lesson_id})
    if not discussion:
        raise NotFoundError("Discussion not found")
    if discussion["user_id"] != user["id"] and user.get("role") != "admin":
        raise ForbiddenError("Not authorized to delete this discussion")
    await db.discussions.delete_one({"_id": discussion_id})
    await db.replies.delete_many({"discussion_id": discussion_id})
    await db.discussion_votes.delete_many({"discussion_id": discussion_id})
    await db.reply_votes.delete_many({"discussion_id": discussion_id})
    return api_response({"ok": True})


@router.post("/courses/{course_id}/lessons/{lesson_id}/discussions/{discussion_id}/vote")
async def vote_discussion(
    course_id: str,
    lesson_id: str,
    discussion_id: str,
    body: VoteIn,
    user: dict = Depends(get_current_user),
):
    db = get_db()
    discussion = await db.discussions.find_one({"_id": discussion_id, "course_id": course_id, "lesson_id": lesson_id})
    if not discussion:
        raise NotFoundError("Discussion not found")

    vote_collection = db.discussion_votes
    existing = await vote_collection.find_one({"discussion_id": discussion_id, "user_id": user["id"]})

    if body.vote == 0:
        if existing:
            await vote_collection.delete_one({"_id": existing["_id"]})
            change = -existing["vote"]
        else:
            change = 0
    else:
        if existing:
            if existing["vote"] == body.vote:
                change = 0
            else:
                await vote_collection.update_one({"_id": existing["_id"]}, {"$set": {"vote": body.vote}})
                change = body.vote - existing["vote"]
        else:
            await vote_collection.insert_one({
                "_id": f"dv-{ObjectId()}",
                "discussion_id": discussion_id,
                "user_id": user["id"],
                "vote": body.vote,
                "created_at": datetime.now(timezone.utc),
            })
            change = body.vote

    if change != 0:
        await db.discussions.update_one({"_id": discussion_id}, {"$inc": {"vote_score": change}})

    updated = await db.discussions.find_one({"_id": discussion_id})
    enriched = await _enrich_discussion(db, updated, user["id"])
    return api_response(enriched)


@router.get("/courses/{course_id}/lessons/{lesson_id}/discussions/{discussion_id}/replies")
async def list_replies(
    course_id: str,
    lesson_id: str,
    discussion_id: str,
    page: int = Query(1, ge=1),
    per_page: int = Query(50, ge=1, le=100),
    user: dict | None = Depends(get_optional_user),
):
    db = get_read_db()
    discussion = await db.discussions.find_one({"_id": discussion_id, "course_id": course_id, "lesson_id": lesson_id})
    if not discussion:
        raise NotFoundError("Discussion not found")

    cursor = db.replies.find({"discussion_id": discussion_id, "parent_reply_id": None}).sort("created_at", 1).skip((page - 1) * per_page).limit(per_page)
    replies = []
    async for doc in cursor:
        replies.append(await _enrich_reply(db, doc, user["id"] if user else None))
    total = await db.replies.count_documents({"discussion_id": discussion_id, "parent_reply_id": None})
    return api_response({
        "items": replies,
        "page": page,
        "per_page": per_page,
        "total": total,
        "total_pages": (total + per_page - 1) // per_page,
    })


@router.post("/courses/{course_id}/lessons/{lesson_id}/discussions/{discussion_id}/replies")
async def create_reply(
    course_id: str,
    lesson_id: str,
    discussion_id: str,
    body: ReplyIn,
    user: dict = Depends(get_current_user),
):
    db = get_db()
    discussion = await db.discussions.find_one({"_id": discussion_id, "course_id": course_id, "lesson_id": lesson_id})
    if not discussion:
        raise NotFoundError("Discussion not found")
    if discussion.get("is_locked"):
        raise ForbiddenError("This discussion is locked")

    now = datetime.now(timezone.utc)
    reply = {
        "_id": f"rep-{ObjectId()}",
        "discussion_id": discussion_id,
        "user_id": user["id"],
        "content": body.content,
        "parent_reply_id": body.parent_reply_id,
        "vote_score": 0,
        "is_instructor_answer": user.get("role") == "instructor",
        "created_at": now,
        "updated_at": now,
    }
    await db.replies.insert_one(reply)
    await db.discussions.update_one({"_id": discussion_id}, {"$inc": {"reply_count": 1}})

    enriched = await _enrich_reply(db, reply, user["id"])
    return api_response(enriched, status_code=201)


@router.put("/courses/{course_id}/lessons/{lesson_id}/discussions/{discussion_id}/replies/{reply_id}")
async def update_reply(
    course_id: str,
    lesson_id: str,
    discussion_id: str,
    reply_id: str,
    body: ReplyIn,
    user: dict = Depends(get_current_user),
):
    db = get_db()
    reply = await db.replies.find_one({"_id": reply_id, "discussion_id": discussion_id})
    if not reply:
        raise NotFoundError("Reply not found")
    if reply["user_id"] != user["id"] and user.get("role") not in ("admin", "instructor"):
        raise ForbiddenError("Not authorized to edit this reply")
    await db.replies.update_one(
        {"_id": reply_id},
        {"$set": {"content": body.content, "updated_at": datetime.now(timezone.utc)}},
    )
    reply["content"] = body.content
    reply["updated_at"] = datetime.now(timezone.utc)
    enriched = await _enrich_reply(db, reply, user["id"])
    return api_response(enriched)


@router.delete("/courses/{course_id}/lessons/{lesson_id}/discussions/{discussion_id}/replies/{reply_id}")
async def delete_reply(
    course_id: str,
    lesson_id: str,
    discussion_id: str,
    reply_id: str,
    user: dict = Depends(get_current_user),
):
    db = get_db()
    reply = await db.replies.find_one({"_id": reply_id, "discussion_id": discussion_id})
    if not reply:
        raise NotFoundError("Reply not found")
    if reply["user_id"] != user["id"] and user.get("role") not in ("admin", "instructor"):
        raise ForbiddenError("Not authorized to delete this reply")
    await db.replies.delete_one({"_id": reply_id})
    await db.replies.delete_many({"parent_reply_id": reply_id})
    await db.discussions.update_one({"_id": discussion_id}, {"$inc": {"reply_count": -1}})
    return api_response({"ok": True})


@router.post("/courses/{course_id}/lessons/{lesson_id}/discussions/{discussion_id}/replies/{reply_id}/vote")
async def vote_reply(
    course_id: str,
    lesson_id: str,
    discussion_id: str,
    reply_id: str,
    body: VoteIn,
    user: dict = Depends(get_current_user),
):
    db = get_db()
    reply = await db.replies.find_one({"_id": reply_id, "discussion_id": discussion_id})
    if not reply:
        raise NotFoundError("Reply not found")

    vote_collection = db.reply_votes
    existing = await vote_collection.find_one({"reply_id": reply_id, "user_id": user["id"]})

    if body.vote == 0:
        if existing:
            await vote_collection.delete_one({"_id": existing["_id"]})
            change = -existing["vote"]
        else:
            change = 0
    else:
        if existing:
            if existing["vote"] == body.vote:
                change = 0
            else:
                await vote_collection.update_one({"_id": existing["_id"]}, {"$set": {"vote": body.vote}})
                change = body.vote - existing["vote"]
        else:
            await vote_collection.insert_one({
                "_id": f"rv-{ObjectId()}",
                "reply_id": reply_id,
                "user_id": user["id"],
                "vote": body.vote,
                "created_at": datetime.now(timezone.utc),
            })
            change = body.vote

    if change != 0:
        await db.replies.update_one({"_id": reply_id}, {"$inc": {"vote_score": change}})

    updated = await db.replies.find_one({"_id": reply_id})
    enriched = await _enrich_reply(db, updated, user["id"])
    return api_response(enriched)


@router.post("/courses/{course_id}/lessons/{lesson_id}/discussions/{discussion_id}/replies/{reply_id}/mark-answer")
async def mark_instructor_answer(
    course_id: str,
    lesson_id: str,
    discussion_id: str,
    reply_id: str,
    user: dict = Depends(get_current_user),
):
    db = get_db()
    if user.get("role") not in ("admin", "instructor"):
        raise ForbiddenError("Only instructors can mark answers")
    reply = await db.replies.find_one({"_id": reply_id, "discussion_id": discussion_id})
    if not reply:
        raise NotFoundError("Reply not found")
    await db.replies.update_many({"discussion_id": discussion_id}, {"$set": {"is_instructor_answer": False}})
    await db.replies.update_one({"_id": reply_id}, {"$set": {"is_instructor_answer": True}})
    return api_response({"ok": True})