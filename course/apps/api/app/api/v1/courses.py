from datetime import datetime, timezone
from fastapi import APIRouter, Depends, Query, HTTPException
from app.db.mongodb import get_db, get_read_db
from app.core.response import api_response
from app.core.deps import get_optional_user
from app.services.search import search_courses, search_available
from app.services.recommendation import get_recommendations, get_similar_courses, get_popular_courses
from app.services.course_structure import ensure_chapters, sync_syllabus_from_chapters
from app.services.proactive_support import track_event

router = APIRouter()


def _compute_total_duration(syllabus: list) -> int:
    """Compute total duration in seconds from syllabus."""
    return sum(lesson.get("duration_seconds", 0) for lesson in syllabus)


def _public_syllabus(syllabus: list):
    return [{k: v for k, v in lesson.items() if k != "drive_file_id"} for lesson in syllabus]


def _enrich_course(course: dict) -> dict:
    """Add computed fields to course response.

    Exposes both the flat ``syllabus`` (legacy) and a chapter-based
    ``chapters`` structure: course -> chapters -> lessons/videos.
    """
    course = dict(course)
    chapters = ensure_chapters(course)
    course["chapters"] = chapters
    syllabus = sync_syllabus_from_chapters(course).get("syllabus", [])
    return {
        "id": course["_id"],
        **{k: v for k, v in course.items() if k != "_id"},
        "chapters": [
            {
                "id": ch.get("id"),
                "title": ch.get("title"),
                "order": ch.get("order"),
                "lessons": _public_syllabus(ch.get("lessons", [])),
            }
            for ch in chapters
        ],
        "syllabus": _public_syllabus(syllabus),
        "total_duration_seconds": _compute_total_duration(syllabus),
    }


@router.get("/categories")
async def list_categories():
    db = get_read_db()
    cats = await db.categories.find().to_list(100)
    return api_response([{"id": c["_id"], **{k: v for k, v in c.items() if k != "_id"}} for c in cats])


@router.get("/categories/{slug}")
async def get_category(slug: str):
    db = get_read_db()
    cat = await db.categories.find_one({"slug": slug})
    if not cat:
        raise HTTPException(status_code=404, detail="Category not found")
    return api_response({"id": cat["_id"], **{k: v for k, v in cat.items() if k != "_id"}})


async def _track_search_no_click(user: dict | None, q: str, total: int) -> None:
    """Record a search that returned zero results (no-click proxy)."""
    if not user or not q or total != 0:
        return
    try:
        await track_event(
            user["id"],
            "search_no_click",
            metadata={"query": q, "total": total},
        )
    except Exception:
        pass


@router.get("/courses")
async def list_courses(
    q: str = Query("", alias="search"),
    category: str = "",
    sort_by: str = "",
    page: int = Query(1, ge=1),
    per_page: int = Query(10, ge=1, le=100),
    max_lesson_duration: int = Query(0, ge=0, description="Filter courses with lessons under N seconds (e.g. 600 for 10 min)"),
    user: dict | None = Depends(get_optional_user),
):
    if q and search_available:
        result = await search_courses(q, category=category, sort_by=sort_by, page=page, per_page=per_page)
        if result is not None:
            courses = []
            for hit in result.get("hits", []):
                courses.append({
                    "id": hit["id"],
                    "category_id": hit.get("category_id", ""),
                    "category_slug": hit.get("category_slug", ""),
                    "category_name": hit.get("category_name", ""),
                    "title": hit["title"],
                    "slug": hit["slug"],
                    "description": hit.get("description", ""),
                    "image_url": hit.get("image_url", ""),
                    "lesson_count": hit.get("lesson_count", 0),
                    "instructor_name": hit.get("instructor_name", ""),
                })
            total = result.get("estimatedTotalHits", result.get("total", len(courses)))
            await _track_search_no_click(user, q, total)
            return api_response(courses, meta={
                "page": page,
                "per_page": per_page,
                "total": total,
                "total_pages": max(1, (total + per_page - 1) // per_page),
            })

    db = get_read_db()
    query = {}
    if category:
        query["category_slug"] = category
    if q:
        query["$or"] = [
            {"title": {"$regex": q, "$options": "i"}},
            {"description": {"$regex": q, "$options": "i"}},
        ]
    total = await db.courses.count_documents(query)
    await _track_search_no_click(user, q, total)
    skip = (page - 1) * per_page
    courses = await db.courses.find(query).sort("created_at", -1).skip(skip).limit(per_page).to_list(per_page)
    enriched = [_enrich_course(c) for c in courses]
    
    if max_lesson_duration > 0:
        enriched = [
            c for c in enriched
            if any(lesson.get("duration_seconds", 0) <= max_lesson_duration for lesson in c.get("syllabus", []))
        ]
    
    return api_response(enriched, meta={
        "page": page,
        "per_page": per_page,
        "total": total,
        "total_pages": max(1, (total + per_page - 1) // per_page),
    })


@router.get("/courses/{slug}")
async def get_course(slug: str):
    db = get_read_db()
    course = await db.courses.find_one({"slug": slug})
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")
    return api_response(_enrich_course(course))


from pydantic import BaseModel


class ReviewIn(BaseModel):
    name: str
    role: str
    rating: int
    outcome: str
    quote: str


@router.post("/reviews")
async def create_review(body: ReviewIn):
    db = get_db()
    review_id = f"rev-{datetime.now(timezone.utc).timestamp()}"
    review = {
        "_id": review_id,
        "name": body.name,
        "role": body.role,
        "rating": body.rating,
        "outcome": body.outcome,
        "quote": body.quote,
    }
    await db.reviews.insert_one(review)
    return api_response({"id": review_id, **review})


@router.get("/recommendations")
async def recommendations(limit: int = Query(10, ge=1, le=50), user: dict | None = Depends(get_optional_user)):
    if user:
        recs = await get_recommendations(user["id"], limit)
    else:
        recs = await get_popular_courses(limit)
    return api_response(recs)


@router.get("/courses/{course_id}/similar")
async def similar_courses(course_id: str, limit: int = Query(6, ge=1, le=20)):
    recs = await get_similar_courses(course_id, limit)
    return api_response(recs)


@router.get("/stats")
async def public_stats():
    db = get_read_db()
    courses = await db.courses.find().to_list(1000)
    users = await db.users.find().to_list(10000)
    reviews = await db.reviews.find().to_list(1000)

    total_courses = len(courses)
    total_members = len(users)
    total_hours = sum(
        sum(lesson.get("duration_seconds", 0) for lesson in course.get("syllabus", []))
        for course in courses
    ) / 3600
    avg_rating = (
        sum(r.get("rating", 0) for r in reviews) / len(reviews)
        if reviews else 0
    )

    return api_response({
        "total_courses": total_courses,
        "total_members": total_members,
        "total_hours": round(total_hours),
        "average_rating": round(avg_rating, 1),
    })