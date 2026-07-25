from datetime import datetime, timezone
import logging
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from app.core.deps import get_current_user
from app.db.mongodb import get_db, get_read_db
from app.services.certificate import issue_certificate

logger = logging.getLogger(__name__)

router = APIRouter()


class ProgressUpdate(BaseModel):
    completed: bool = False
    last_position_seconds: int = 0
    note: str | None = None


@router.get("/progress")
async def list_progress(user: dict = Depends(get_current_user)):
    db = get_read_db()
    progress = await db.progress.find({"user_id": user["id"]}).to_list(1000)
    return [{"id": p["_id"], **{k: v for k, v in p.items() if k != "_id"}} for p in progress]


@router.get("/progress/{lesson_id}")
async def get_progress(lesson_id: str, user: dict = Depends(get_current_user)):
    db = get_read_db()
    record = await db.progress.find_one({"_id": f"prog-{user['id']}-{lesson_id}"})
    if not record:
        return None
    return {"id": record["_id"], **{k: v for k, v in record.items() if k != "_id"}}


@router.put("/progress/{lesson_id}")
async def update_progress(lesson_id: str, body: ProgressUpdate, user: dict = Depends(get_current_user)):
    db = get_db()
    # Find course for this lesson
    course = None
    async for c in db.courses.find():
        for lesson in c.get("syllabus", []):
            if lesson["id"] == lesson_id:
                course = c
                break
        if course:
            break

    if not course:
        raise HTTPException(status_code=404, detail="Lesson not found")

    progress_id = f"prog-{user['id']}-{lesson_id}"
    existing = await db.progress.find_one({"_id": progress_id}) or {}
    update_fields = {
        "user_id": user["id"],
        "course_id": course["_id"],
        "lesson_id": lesson_id,
        "completed": body.completed,
        "last_position_seconds": body.last_position_seconds,
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    if body.note is not None:
        update_fields["note"] = body.note
    elif "note" in existing:
        update_fields["note"] = existing["note"]

    await db.progress.update_one(
        {"_id": progress_id},
        {"$set": update_fields},
        upsert=True,
    )
    record = await db.progress.find_one({"_id": progress_id})

    if body.completed:
        lesson_ids = {l["id"] for l in course.get("syllabus", [])}
        completed_count = await db.progress.count_documents(
            {"user_id": user["id"], "lesson_id": {"$in": list(lesson_ids)}, "completed": True}
        )
        if completed_count >= len(lesson_ids):
            cert = await issue_certificate(user["id"], course["_id"])
            if cert:
                logger.info("Auto-issued certificate for user %s course %s", user["id"], course["_id"])

    return {"id": record["_id"], **{k: v for k, v in record.items() if k != "_id"}}


@router.get("/progress/summary")
async def get_progress_summary(user: dict = Depends(get_current_user)):
    db = get_read_db()
    progress_records = await db.progress.find({"user_id": user["id"]}).to_list(1000)
    courses = await db.courses.find().to_list(1000)

    summary = []
    for course in courses:
        lesson_ids = {l["id"] for l in course.get("syllabus", [])}
        completed = {p["lesson_id"] for p in progress_records if p["lesson_id"] in lesson_ids and p["completed"]}
        total = len(lesson_ids)
        summary.append({
            "course_id": course["_id"],
            "course_title": course["title"],
            "course_slug": course["slug"],
            "completed_lessons": len(completed),
            "total_lessons": total,
            "progress_pct": round(len(completed) / total * 100, 0) if total else 0,
        })
    return summary


@router.get("/progress/continue")
async def get_continue(user: dict = Depends(get_current_user)):
    db = get_read_db()
    # Most recently updated incomplete lesson
    progress_list = await db.progress.find({"user_id": user["id"], "completed": False}).to_list(1)
    if not progress_list:
        # Fallback to first course first lesson
        course = await db.courses.find_one()
        if not course:
            return None
        return {
            "course_id": course["_id"],
            "course_title": course["title"],
            "course_slug": course["slug"],
            "lesson_id": course["syllabus"][0]["id"],
            "lesson_title": course["syllabus"][0]["title"],
            "lesson_index": 0,
            "lesson_count": len(course["syllabus"]),
        }

    p = progress_list[0]
    course = await db.courses.find_one({"_id": p["course_id"]})
    lesson_index = next((i for i, l in enumerate(course["syllabus"]) if l["id"] == p["lesson_id"]), 0)
    return {
        "course_id": course["_id"],
        "course_title": course["title"],
        "course_slug": course["slug"],
        "lesson_id": p["lesson_id"],
        "lesson_title": course["syllabus"][lesson_index]["title"],
        "lesson_index": lesson_index,
        "lesson_count": len(course["syllabus"]),
        "last_position_seconds": p.get("last_position_seconds", 0),
    }
