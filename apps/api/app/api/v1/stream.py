import math
import time
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException
from app.core.config import settings
from app.core.deps import get_current_user
from app.db.mongodb import get_db
from app.services.r2_storage import r2_storage

router = APIRouter()

# Per-user token rate limiting
_user_token_count: dict[str, list[float]] = {}
MAX_TOKENS_PER_HOUR = 10

DEMO_VIDEO_URL = "https://www.w3schools.com/html/mov_bbb.mp4"

logger = __import__("logging").getLogger(__name__)

def _cleanup_user_tokens(user_id: str):
    now = time.time()
    tokens = _user_token_count.get(user_id, [])
    tokens = [t for t in tokens if t > now - 3600]
    _user_token_count[user_id] = tokens
    return tokens


def _trial_unlocked_count(course: dict) -> int:
    return max(1, math.ceil(len(course.get("syllabus", [])) * 0.1))


def _trial_active(user: dict) -> bool:
    if not user.get("trial_active"):
        return False
    expires = user.get("trial_expires")
    if not expires:
        return False
    try:
        expires_dt = datetime.fromisoformat(expires)
        if expires_dt.tzinfo is None:
            expires_dt = expires_dt.replace(tzinfo=timezone.utc)
        return datetime.now(timezone.utc) < expires_dt
    except Exception:
        return False


async def _has_access(user: dict, course: dict, lesson_index: int, db) -> bool:
    if user.get("role") == "admin":
        return True
    if settings.bypass_subscription_check:
        return True
    if _trial_active(user) and lesson_index < _trial_unlocked_count(course):
        return True
    now_iso = datetime.now(timezone.utc).isoformat()
    sub = await db.subscriptions.find_one({
        "user_id": user["id"],
        "status": "active",
        "ends_at": {"$gt": now_iso},
    })
    if not sub:
        logger.info(
            "Stream access denied: user=%s reason=no_active_subscription lesson_index=%s course=%s",
            user.get("id"),
            lesson_index,
            course.get("_id"),
        )
        return False
    return True


@router.post("/lessons/{lesson_id}/stream-token")
async def create_stream_token(lesson_id: str, user: dict = Depends(get_current_user)):
    db = get_db()
    course = None
    lesson = None
    lesson_index = -1
    async for c in db.courses.find():
        for idx, l in enumerate(c.get("syllabus", [])):
            if l["id"] == lesson_id:
                course = c
                lesson = l
                lesson_index = idx
                break
        if course:
            break

    if not course or not lesson:
        raise HTTPException(status_code=404, detail="Lesson not found")

    if not await _has_access(user, course, lesson_index, db):
        raise HTTPException(status_code=403, detail="Subscription or trial required")

    user_tokens = _cleanup_user_tokens(user["id"])
    if len(user_tokens) >= MAX_TOKENS_PER_HOUR:
        raise HTTPException(
            status_code=429,
            detail=f"Rate limit exceeded. Max {MAX_TOKENS_PER_HOUR} tokens per hour.",
        )

    r2_key = lesson.get("r2_key")
    if not r2_key:
        drive_file_id = lesson.get("drive_file_id")
        if drive_file_id:
            # Legacy lesson with only Drive ID — trigger on-the-fly migration
            from app.services.watermark import migrate_drive_to_r2
            try:
                r2_key = await migrate_drive_to_r2(lesson_id, drive_file_id)
                syllabus = course.get("syllabus", [])
                for l in syllabus:
                    if l["id"] == lesson_id:
                        l["r2_key"] = r2_key
                        break
                await db.courses.update_one({"_id": course["_id"]}, {"$set": {"syllabus": syllabus}})
            except Exception:
                raise HTTPException(status_code=502, detail="Video migration from Drive failed")
        else:
            _user_token_count.setdefault(user["id"], []).append(time.time())
            return {
                "stream_url": DEMO_VIDEO_URL,
                "expires_in": 86400,
            }

    signed_url = await r2_storage.generate_signed_url(
        lesson_id, expires_in=settings.r2_signed_url_expiry_seconds
    )
    if not signed_url:
        raise HTTPException(status_code=502, detail="Failed to generate playback URL")

    _user_token_count.setdefault(user["id"], []).append(time.time())

    return {
        "stream_url": signed_url,
        "expires_in": settings.r2_signed_url_expiry_seconds,
    }
