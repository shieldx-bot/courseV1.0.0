from datetime import datetime, timezone, timedelta
from typing import List
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from pydantic import BaseModel, Field
from app.core.deps import require_admin
from app.core.config import settings
from app.core.worker import enqueue_task_with_retry
from app.core.telemetry import WORKER_JOBS_ENQUEUED
from app.db.mongodb import get_db
from app.services import ai
from app.services import payment as payment_service
from app.services import drive as drive_service
from app.services.r2_storage import r2_storage
from app.services.watermark import migrate_drive_to_r2
from app.services import search as search_service
from app.services import course_generator
from app.services.cache import invalidate_pattern
from app.services.course_structure import (
    ensure_chapters,
    sync_syllabus_from_chapters,
    update_lesson as update_lesson_in_course,
    remove_lesson as remove_lesson_from_course,
    group_videos_into_chapters,
)

router = APIRouter()


def _slugify(s: str) -> str:
    s = s.lower().strip()
    s = re.sub(r'[^a-z0-9]+', '-', s)
    return s.strip('-')


def _video_sort_key(v: dict) -> tuple:
    m = re.match(r'^(\d+)', v.get('name', ''))
    return (0, int(m.group(1))) if m else (1, v['name'])


class AttachmentIn(BaseModel):
    title: str
    url: str


class LessonIn(BaseModel):
    title: str
    order: int
    duration_seconds: int
    drive_file_id: str | None = None
    r2_key: str | None = None
    language: str | None = None
    starter_code: str | None = None
    solution_code: str | None = None
    test_cases: str | None = None
    attachments: List[AttachmentIn] = Field(default_factory=list)


class InstructorIn(BaseModel):
    name: str
    bio: str | None = None


class ChapterIn(BaseModel):
    id: str | None = None
    title: str
    order: int = 1
    lessons: List[LessonIn] = Field(default_factory=list)


class CourseIn(BaseModel):
    category_id: str
    title: str
    slug: str
    description: str
    image_url: str | None = None
    instructor: InstructorIn | None = None
    syllabus: List[LessonIn] = Field(default_factory=list)
    chapters: List[ChapterIn] | None = None
    outcome: List[str] = Field(default_factory=list)


class UserUpdateIn(BaseModel):
    name: str | None = None
    role: str | None = None


class SubscriptionOverrideIn(BaseModel):
    tier_id: str
    duration_months: int | None = None
    ends_at: str | None = None
    status: str = "active"


class CategoryIn(BaseModel):
    name: str
    slug: str
    icon: str | None = None
    description: str | None = None
    course_count: int = 0


class CategoryUpdateIn(BaseModel):
    name: str | None = None
    slug: str | None = None
    icon: str | None = None
    description: str | None = None
    course_count: int | None = None


class DriveMapIn(BaseModel):
    drive_file_id: str
    r2_key: str | None = None


class DriveScanIn(BaseModel):
    category_folder_id: str


class DriveImportIn(BaseModel):
    folder_id: str
    category_id: str
    title: str | None = None
    slug: str | None = None
    video_ids: List[str] | None = None  # from scan results, skip re-scan


class DriveImportAllItem(BaseModel):
    folder_id: str
    title: str | None = None
    slug: str | None = None
    video_ids: List[str] | None = None


class DriveImportAllIn(BaseModel):
    category_id: str
    courses: List[DriveImportAllItem]


@router.get("/dashboard", dependencies=[Depends(require_admin)])
async def dashboard_kpis():
    db = get_db()
    total_users = await db.users.count_documents({})
    active_subs = await db.subscriptions.count_documents({"status": "active"})
    total_courses = await db.courses.count_documents({})
    total_lessons = sum(len(c.get("syllabus", [])) for c in await db.courses.find().to_list(1000))
    orders = await db.orders.find().to_list(10000)
    total_revenue = sum(o.get("amount", 0) for o in orders)

    now = datetime.now(timezone.utc)
    thirty_days_ago = (now - timedelta(days=30)).isoformat()
    recent_orders = [o for o in orders if o.get("created_at", "") >= thirty_days_ago]
    recent_revenue = sum(o.get("amount", 0) for o in recent_orders)

    return {
        "total_members": total_users,
        "active_subscriptions": active_subs,
        "total_courses": total_courses,
        "total_lessons": total_lessons,
        "total_revenue": round(total_revenue, 2),
        "recent_revenue": round(recent_revenue, 2),
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


@router.get("/analytics/summary", dependencies=[Depends(require_admin)])
async def analytics_summary():
    db = get_db()
    users = await db.users.find().to_list(10000)
    progress = await db.progress.find().to_list(10000)
    subscriptions = await db.subscriptions.find().to_list(10000)
    courses = await db.courses.find().to_list(10000)
    orders = await db.orders.find().to_list(10000)

    metrics = ai.build_metrics(users, progress, subscriptions, courses, orders)
    llm = await ai.summarize_with_llm(metrics)

    job_id = await enqueue_task_with_retry("run_analytics_task", _max_retries=3, _job_timeout=600)
    WORKER_JOBS_ENQUEUED.labels(task="run_analytics_task").inc()
    return {
        "segment": metrics["segment"],
        "churn_risk_users": metrics["churn_risk_users"],
        "active_subscriptions": metrics["active_subscriptions"],
        "top_category": metrics["top_category"],
        "recent_30_day_revenue": metrics["recent_30_day_revenue"],
        "llm_summary": llm["summary"],
        "llm_source": llm["source"],
        "recommendation": "Offer a 3-day extension to users who completed 2+ lessons then paused.",
        "content_gap": f"Category with most courses: {metrics['top_category']} ({metrics['top_category_count']} courses).",
        "analytics_cache_job_id": job_id,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


@router.get("/analytics/forecast", dependencies=[Depends(require_admin)])
async def analytics_forecast():
    db = get_db()
    orders = await db.orders.find().to_list(10000)
    progress = await db.progress.find().to_list(10000)
    subscriptions = await db.subscriptions.find().to_list(10000)
    users = await db.users.find().to_list(10000)

    revenue = ai.forecast_revenue(orders, users, progress, subscriptions, 30)
    subs = ai.forecast_new_subscriptions(orders, 50.0, 30)
    churn = ai.forecast_churn(progress, subscriptions, users)

    return {
        "next_30_days": {
            "predicted_revenue": revenue["predicted_revenue"],
            "predicted_new_subscriptions": subs["predicted_new_subscriptions"],
            "predicted_churn_rate": churn["predicted_churn_rate"],
            "confidence": revenue["confidence"],
        },
        "churn_risk_users": churn["churn_risk_users"],
        "churn_model": churn.get("model", "rule-based"),
        "note": revenue["note"],
        "model": revenue.get("model", "fallback"),
    }


@router.get("/courses", dependencies=[Depends(require_admin)])
async def list_courses_admin():
    db = get_db()
    courses = await db.courses.find().to_list(1000)
    result = []
    for c in courses:
        item = {"id": c["_id"]}
        for k, v in c.items():
            if k != "_id":
                item[k] = v
        result.append(item)
    return result


@router.post("/courses", dependencies=[Depends(require_admin)])
async def create_course(body: CourseIn):
    db = get_db()
    cat = await db.categories.find_one({"_id": body.category_id})
    if not cat:
        raise HTTPException(status_code=400, detail="Category not found")

    course_id = f"course-{body.slug}"
    if await db.courses.find_one({"_id": course_id}):
        raise HTTPException(status_code=400, detail="Course slug already exists")

    syllabus = [{"id": f"{course_id}-lesson-{i+1}", **s.model_dump()} for i, s in enumerate(body.syllabus)]
    course = {
        "_id": course_id,
        "category_id": body.category_id,
        "category_slug": cat["slug"],
        "category_name": cat["name"],
        "title": body.title,
        "slug": body.slug,
        "description": body.description,
        "image_url": body.image_url or "",
        "instructor": body.instructor.model_dump() if body.instructor else None,
        "lesson_count": len(syllabus),
        "syllabus": syllabus,
        "chapters": ensure_chapters({"id": course_id, "syllabus": syllabus, "chapters": None})
        if not body.chapters
        else [
            {
                "id": ch.id or f"{course_id}-chapter-{ci}",
                "title": ch.title,
                "order": ch.order or ci,
                "lessons": [{"id": f"{course_id}-lesson-{ci}-{li+1}", **l.model_dump()} for li, l in enumerate(ch.lessons)],
            }
            for ci, ch in enumerate(body.chapters, start=1)
        ],
        "outcome": body.outcome,
    }
    await sync_syllabus_from_chapters(course)
    await db.courses.insert_one(course)
    await enqueue_task_with_retry("index_search_task", "index", course, _max_retries=5, _job_timeout=30)
    WORKER_JOBS_ENQUEUED.labels(task="index_search_task").inc()
    return {"id": course["_id"], **{k: v for k, v in course.items() if k != "_id"}}


@router.get("/courses/{course_id}", dependencies=[Depends(require_admin)])
async def get_course_admin(course_id: str):
    db = get_db()
    course = await db.courses.find_one({"_id": course_id})
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")
    return {"id": course["_id"], **{k: v for k, v in course.items() if k != "_id"}}


@router.put("/courses/{course_id}", dependencies=[Depends(require_admin)])
async def update_course(course_id: str, body: CourseIn):
    db = get_db()
    cat = await db.categories.find_one({"_id": body.category_id})
    if not cat:
        raise HTTPException(status_code=400, detail="Category not found")

    syllabus = [{"id": f"{course_id}-lesson-{i+1}", **s.model_dump()} for i, s in enumerate(body.syllabus)]
    chapters = (
        ensure_chapters({"id": course_id, "syllabus": syllabus, "chapters": None})
        if not body.chapters
        else [
            {
                "id": ch.id or f"{course_id}-chapter-{ci}",
                "title": ch.title,
                "order": ch.order or ci,
                "lessons": [{"id": f"{course_id}-lesson-{ci}-{li+1}", **l.model_dump()} for li, l in enumerate(ch.lessons)],
            }
            for ci, ch in enumerate(body.chapters, start=1)
        ]
    )
    update = {
        "category_id": body.category_id,
        "category_slug": cat["slug"],
        "category_name": cat["name"],
        "title": body.title,
        "slug": body.slug,
        "description": body.description,
        "image_url": body.image_url or "",
        "lesson_count": len(syllabus),
        "syllabus": syllabus,
        "chapters": chapters,
        "outcome": body.outcome,
    }
    if body.instructor:
        update["instructor"] = body.instructor.model_dump()
    await db.courses.update_one(
        {"_id": course_id},
        {"$set": update},
    )
    course = await db.courses.find_one({"_id": course_id})
    await sync_syllabus_from_chapters(course or {})
    if course:
        await db.courses.update_one(
            {"_id": course_id},
            {"$set": {"syllabus": course["syllabus"], "lesson_count": course["lesson_count"]}},
        )
    course = await db.courses.find_one({"_id": course_id})
    await enqueue_task_with_retry("index_search_task", "index", course, _max_retries=5, _job_timeout=30)
    WORKER_JOBS_ENQUEUED.labels(task="index_search_task").inc()
    return {"id": course["_id"], **{k: v for k, v in course.items() if k != "_id"}}


@router.delete("/courses/{course_id}", dependencies=[Depends(require_admin)])
async def delete_course(course_id: str):
    db = get_db()
    await db.courses.delete_many({"_id": course_id})
    await enqueue_task_with_retry("index_search_task", "delete", None, course_id, _max_retries=5, _job_timeout=30)
    WORKER_JOBS_ENQUEUED.labels(task="index_search_task").inc()
    return {"deleted": True}


@router.post("/courses/{course_id}/generate-content", dependencies=[Depends(require_admin)])
async def generate_course_ai_content(course_id: str):
    """Generate AI-powered short/long descriptions, learning outcomes,
    and thumbnail prompt for a course using Groq LLM."""
    db = get_db()
    course = await db.courses.find_one({"_id": course_id})
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")

    content = await course_generator.generate_course_content(course)

    if content.get("source") == "openai":
        await invalidate_pattern(f"course:{course_id}")

    return {
        "course_id": course_id,
        **content,
    }


class GenerateCodeRequest(BaseModel):
    lesson_title: str
    language: str = "python"
    lesson_context: str = ""
    difficulty: str = "beginner"  # beginner, intermediate, advanced


@router.post("/courses/{course_id}/lessons/{lesson_id}/generate-code", dependencies=[Depends(require_admin)])
async def generate_lesson_code(course_id: str, lesson_id: str, body: GenerateCodeRequest):
    """Generate starter code, solution code, and test cases for a coding lesson using Groq LLM."""
    from app.services.code_assistant import generate_code, review_code

    db = get_db()
    course = await db.courses.find_one({"_id": course_id})
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")

    lesson = None
    for l in course.get("syllabus", []):
        if l["id"] == lesson_id:
            lesson = l
            break

    if not lesson:
        raise HTTPException(status_code=404, detail="Lesson not found")

    # Generate starter code
    starter_result = await generate_code(
        task=f"Create starter code template for a coding exercise: {body.lesson_title}. "
             f"Difficulty: {body.difficulty}. Context: {body.lesson_context}. "
             f"Provide a clean template with function signatures, comments, and TODO markers for students to fill in.",
        language=body.language,
        context=f"Lesson: {body.lesson_title}. {body.lesson_context}",
    )

    # Generate solution code
    solution_result = await generate_code(
        task=f"Write a complete, correct reference solution for: {body.lesson_title}. "
             f"Difficulty: {body.difficulty}. Context: {body.lesson_context}. "
             f"Include proper error handling, documentation, and follow best practices.",
        language=body.language,
        context=f"Lesson: {body.lesson_title}. {body.lesson_context}",
    )

    # Generate test cases by asking the model to create tests
    test_prompt = f"""Create comprehensive test cases for the solution to: {body.lesson_title}.
Language: {body.language}
Difficulty: {body.difficulty}
Context: {body.lesson_context}

Write tests that verify correctness including edge cases. Use the standard testing framework for the language:
- Python: pytest
- JavaScript/TypeScript: Jest
- Java: JUnit
- Go: testing package
- Rust: built-in test module

Return ONLY the test code (no markdown)."""

    test_result = await generate_code(
        task=test_prompt,
        language=body.language,
        context=f"Lesson: {body.lesson_title}. Tests for the solution.",
    )

    return {
        "lesson_id": lesson_id,
        "starter_code": starter_result.get("code", ""),
        "solution_code": solution_result.get("code", ""),
        "test_cases": test_result.get("code", ""),
        "language": body.language,
        "generated_by": "groq",
    }


@router.put("/courses/{course_id}/lessons/{lesson_id}/drive", dependencies=[Depends(require_admin)])
async def map_lesson_drive_file(course_id: str, lesson_id: str, body: DriveMapIn):
    db = get_db()
    course = await db.courses.find_one({"_id": course_id})
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")

    updated = False
    syllabus = course.get("syllabus", [])
    for lesson in syllabus:
        if lesson["id"] == lesson_id:
            lesson["drive_file_id"] = body.drive_file_id
            if body.r2_key is not None:
                lesson["r2_key"] = body.r2_key
            updated = True
            break

    if not updated:
        raise HTTPException(status_code=404, detail="Lesson not found")

    await db.courses.update_one({"_id": course_id}, {"$set": {"syllabus": syllabus}})
    return {"lesson_id": lesson_id, "drive_file_id": body.drive_file_id}


@router.get("/drive/files", dependencies=[Depends(require_admin)])
async def list_drive_files():
    service = drive_service.get_drive_service()
    if not service:
        return {"configured": False, "files": []}

    folder_id = settings.drive_root_folder_id
    query = f"'{folder_id}' in parents and mimeType contains 'video/'" if folder_id else "mimeType contains 'video/'"
    results = service.files().list(q=query, pageSize=50, fields="files(id,name)").execute()
    files = results.get("files", [])
    return {"configured": True, "files": [{"id": f["id"], "name": f["name"]} for f in files]}


@router.post("/drive/scan", dependencies=[Depends(require_admin)])
async def scan_drive(body: DriveScanIn):
    service = drive_service.get_drive_service()
    if not service:
        return {"configured": False, "candidates": []}

    cat_folder_id = body.category_folder_id

    try:
        # Get category folder info
        cat_info = service.files().get(fileId=cat_folder_id, fields="id,name").execute()
        category_name = cat_info["name"]
    except Exception as e:
        error_msg = str(e)
        if "not found" in error_msg.lower() or "404" in error_msg:
            return {
                "configured": True,
                "error": f"Category folder not found: {cat_folder_id}. Make sure the service account has access to this folder.",
                "candidates": []
            }
        return {"configured": True, "error": f"Cannot access category folder: {error_msg}", "candidates": []}

    db = get_db()
    existing_courses = await db.courses.find().to_list(1000)

    existing_by_title = {}
    for c in existing_courses:
        existing_by_title[c["title"].lower().strip()] = c

    def _paginated_list(q, fields, max_pages=10):
        items = []
        page_token = None
        for _ in range(max_pages):
            kw = {'q': q, 'pageSize': 200, 'fields': f'nextPageToken,{fields}', 'pageToken': page_token}
            res = service.files().list(**kw).execute()
            items.extend(res.get('files', []))
            page_token = res.get('nextPageToken')
            if not page_token:
                break
        return items

    # Get level-2 folders (courses) under this category
    course_folders = {}
    for f in _paginated_list(
        f"'{cat_folder_id}' in parents and mimeType='application/vnd.google-apps.folder' and trashed = false",
        'files(id,name)'
    ):
        course_folders[f['id']] = {'name': f['name'], 'category_folder_id': cat_folder_id, 'category_folder_name': category_name}

    # Collect ALL folders under this category (bulk)
    all_folders = {}
    all_folders[cat_folder_id] = {'name': category_name, 'parent_ids': []}
    for fid, info in course_folders.items():
        all_folders[fid] = {'name': info['name'], 'parent_ids': [cat_folder_id]}
    for f in _paginated_list(
        "mimeType='application/vnd.google-apps.folder' and trashed = false",
        'files(id,name,parents)'
    ):
        if f['id'] not in all_folders:
            all_folders[f['id']] = {'name': f['name'], 'parent_ids': f.get('parents', [])}

    # Collect ALL videos (bulk)
    all_videos = _paginated_list(
        "mimeType contains 'video/' and trashed = false",
        'files(id,name,parents)'
    )

    # Map video -> course folder (level-2 ancestor)
    def find_course_folder(fid, depth=0, seen=None):
        if seen is None:
            seen = set()
        if depth > 10 or not fid or fid == cat_folder_id or fid in seen:
            return None
        seen.add(fid)
        if fid in course_folders:
            return fid
        info = all_folders.get(fid)
        if not info:
            return None
        for pid in info.get('parent_ids') or info.get('parent_id') or []:
            if isinstance(pid, str):
                result = find_course_folder(pid, depth + 1, seen)
                if result:
                    return result
        return None

    videos_by_course = {}
    for v in all_videos:
        pid = v.get('parents', [None])[0]
        if pid:
            cid = find_course_folder(pid)
            if cid:
                videos_by_course.setdefault(cid, []).append(v)

    # Build candidates
    existing_drive_ids_by_course = {}
    for c in existing_courses:
        ids = set()
        for lesson in c.get('syllabus', []):
            if lesson.get('drive_file_id'):
                ids.add(lesson['drive_file_id'])
        existing_drive_ids_by_course[c['_id']] = ids

    candidates = []
    for cid, info in course_folders.items():
        cname = info['name']
        matched_videos = videos_by_course.get(cid, [])

        existing_course = existing_by_title.get(cname.lower().strip())
        existing_ids = existing_drive_ids_by_course.get(existing_course['_id'], set()) if existing_course else set()

        candidates.append({
            "folder_id": cid,
            "folder_name": cname,
            "category_folder_name": info['category_folder_name'],
            "existing": existing_course is not None,
            "existing_course_id": existing_course['_id'] if existing_course else None,
            "videos": [
                {
                    "file_id": v['id'],
                    "name": v['name'],
                    "existing_in_course": v['id'] in existing_ids,
                }
                for v in matched_videos
            ],
        })

    return {"configured": True, "candidates": candidates}


@router.post("/drive/import", dependencies=[Depends(require_admin)])
async def import_drive_course(body: DriveImportIn):
    service = drive_service.get_drive_service()
    if not service:
        raise HTTPException(status_code=400, detail="Drive not configured")

    db = get_db()

    folder = service.files().get(fileId=body.folder_id, fields="id,name").execute()
    title = body.title or folder["name"]
    slug = body.slug or _slugify(title)

    course_id = f"course-{slug}"
    if await db.courses.find_one({"_id": course_id}):
        raise HTTPException(status_code=400, detail="Course slug already exists")

    cat = await db.categories.find_one({"_id": body.category_id})
    if not cat:
        raise HTTPException(status_code=400, detail="Category not found")

    videos = []
    if body.video_ids:
        # Fast path: use pre-scanned video IDs
        for vid in body.video_ids:
            try:
                info = service.files().get(fileId=vid, fields="id,name").execute()
                videos.append(info)
            except Exception:
                pass
        videos.sort(key=_video_sort_key)
    else:
        # Slow path: scan Drive for this folder
        folder_ids = [body.folder_id]
        queue = [body.folder_id]
        for _ in range(500):
            if not queue:
                break
            fid = queue.pop(0)
            res = service.files().list(
                q=f"'{fid}' in parents and mimeType='application/vnd.google-apps.folder' and trashed = false",
                pageSize=200, fields='files(id)').execute()
            for sub in res.get('files', []):
                if sub['id'] not in folder_ids:
                    folder_ids.append(sub['id'])
                    queue.append(sub['id'])

        all_videos = {}
        for i in range(0, len(folder_ids), 30):
            chunk = folder_ids[i:i+30]
            parents_or = ' or '.join([f"'{fid}' in parents" for fid in chunk])
            q = f"(mimeType contains 'video/' or mimeType = 'application/vnd.google-apps.video') and trashed = false and ({parents_or})"
            page_token = None
            while True:
                res = service.files().list(q=q, pageSize=200, fields='nextPageToken,files(id,name)',
                                           pageToken=page_token).execute()
                for v in res.get('files', []):
                    all_videos[v['id']] = v
                page_token = res.get('nextPageToken')
                if not page_token:
                    break

        videos = sorted(list(all_videos.values()), key=_video_sort_key)

    chapters, syllabus = group_videos_into_chapters(course_id, videos)

    course = {
        "_id": course_id,
        "category_id": body.category_id,
        "category_slug": cat["slug"],
        "category_name": cat["name"],
        "title": title,
        "slug": slug,
        "description": f"Course imported from Google Drive: {title}",
        "image_url": "",
        "instructor": None,
        "lesson_count": len(syllabus),
        "syllabus": syllabus,
        "chapters": chapters,
        "outcome": [],
        "drive_folder_id": body.folder_id,
    }

    await db.courses.insert_one(course)
    return {"id": course["_id"], "title": title, "lesson_count": len(syllabus), "chapter_count": len(chapters)}


@router.post("/drive/import-all", dependencies=[Depends(require_admin)])
async def import_drive_courses_all(body: DriveImportAllIn):
    service = drive_service.get_drive_service()
    if not service:
        raise HTTPException(status_code=400, detail="Drive not configured")

    db = get_db()
    cat = await db.categories.find_one({"_id": body.category_id})
    if not cat:
        raise HTTPException(status_code=400, detail="Category not found")

    results = []
    errors = []
    for item in body.courses:
        try:
            folder = service.files().get(fileId=item.folder_id, fields="id,name").execute()
            title = item.title or folder["name"]
            slug = item.slug or _slugify(title)
            course_id = f"course-{slug}"

            existing = await db.courses.find_one({"_id": course_id})
            if existing:
                await db.courses.delete_one({"_id": course_id})

            videos = []
            if item.video_ids:
                for vid in item.video_ids:
                    try:
                        info = service.files().get(fileId=vid, fields="id,name").execute()
                        videos.append(info)
                    except Exception:
                        pass
                videos.sort(key=_video_sort_key)
            else:
                folder_ids = [item.folder_id]
                queue = [item.folder_id]
                for _ in range(500):
                    if not queue:
                        break
                    fid = queue.pop(0)
                    res = service.files().list(
                        q=f"'{fid}' in parents and mimeType='application/vnd.google-apps.folder' and trashed = false",
                        pageSize=200, fields='files(id)').execute()
                    for sub in res.get('files', []):
                        if sub['id'] not in folder_ids:
                            folder_ids.append(sub['id'])
                            queue.append(sub['id'])

                all_videos = {}
                for i in range(0, len(folder_ids), 30):
                    chunk = folder_ids[i:i+30]
                    parents_or = ' or '.join([f"'{fid}' in parents" for fid in chunk])
                    q = f"(mimeType contains 'video/' or mimeType = 'application/vnd.google-apps.video') and trashed = false and ({parents_or})"
                    page_token = None
                    while True:
                        res = service.files().list(q=q, pageSize=200, fields='nextPageToken,files(id,name)',
                                                   pageToken=page_token).execute()
                        for v in res.get('files', []):
                            all_videos[v['id']] = v
                        page_token = res.get('nextPageToken')
                        if not page_token:
                            break

                videos = sorted(list(all_videos.values()), key=_video_sort_key)

            chapters, syllabus = group_videos_into_chapters(course_id, videos)

            course_doc = {
                "_id": course_id,
                "category_id": body.category_id,
                "category_slug": cat["slug"],
                "category_name": cat["name"],
                "title": title,
                "slug": slug,
                "description": f"Course imported from Google Drive: {title}",
                "image_url": "",
                "instructor": None,
                "lesson_count": len(syllabus),
                "syllabus": syllabus,
                "chapters": chapters,
                "outcome": [],
                "drive_folder_id": item.folder_id,
            }
            await db.courses.insert_one(course_doc)
            results.append({"id": course_id, "title": title, "lesson_count": len(syllabus), "chapter_count": len(chapters)})
        except Exception as e:
            errors.append({"folder_id": item.folder_id, "error": str(e)})

    return {"results": results, "errors": errors}


@router.post("/courses/{course_id}/lessons", dependencies=[Depends(require_admin)])
async def add_lesson(course_id: str, body: LessonIn):
    db = get_db()
    course = await db.courses.find_one({"_id": course_id})
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")

    lesson = {
        "id": f"{course_id}-lesson-{len(course.get('syllabus', [])) + 1}",
        **body.model_dump(),
    }
    course.setdefault("syllabus", []).append(lesson)
    course["chapters"] = ensure_chapters(course)
    course["lesson_count"] = len(course["syllabus"])
    await db.courses.update_one(
        {"_id": course_id},
        {"$set": {
            "syllabus": course["syllabus"],
            "chapters": course["chapters"],
            "lesson_count": course["lesson_count"],
        }},
    )
    return lesson


@router.delete("/courses/{course_id}/lessons/{lesson_id}", dependencies=[Depends(require_admin)])
async def delete_lesson(course_id: str, lesson_id: str):
    db = get_db()
    course = await db.courses.find_one({"_id": course_id})
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")

    remove_lesson_from_course(course, lesson_id)
    course["chapters"] = ensure_chapters(course)
    course["lesson_count"] = len(course.get("syllabus", []))
    await db.courses.update_one(
        {"_id": course_id},
        {"$set": {
            "syllabus": course.get("syllabus", []),
            "chapters": course["chapters"],
            "lesson_count": course["lesson_count"],
        }},
    )
    return {"deleted": True}


@router.get("/users", dependencies=[Depends(require_admin)])
async def list_users(search: str = "", role: str = ""):
    db = get_db()
    query = {}
    if role:
        query["role"] = role
    if search:
        query["$or"] = [
            {"email": {"$regex": search, "$options": "i"}},
            {"name": {"$regex": search, "$options": "i"}},
        ]
    users = await db.users.find(query).to_list(1000)
    return [{"id": u["_id"], "email": u["email"], "name": u.get("name", ""), "role": u["role"], "phone_verified": u.get("phone_verified", False)} for u in users]


@router.get("/users/{user_id}", dependencies=[Depends(require_admin)])
async def get_user(user_id: str):
    db = get_db()
    user = await db.users.find_one({"_id": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    sub = await db.subscriptions.find_one({"user_id": user_id, "status": "active"})
    return {
        "id": user["_id"],
        "email": user["email"],
        "name": user.get("name", ""),
        "role": user["role"],
        "phone_verified": user.get("phone_verified", False),
        "subscription": sub,
    }


@router.put("/users/{user_id}", dependencies=[Depends(require_admin)])
async def update_user(user_id: str, body: UserUpdateIn):
    db = get_db()
    user = await db.users.find_one({"_id": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    updates = {}
    if body.name is not None:
        updates["name"] = body.name
    if body.role is not None:
        updates["role"] = body.role
    if updates:
        await db.users.update_one({"_id": user_id}, {"$set": updates})
    updated = await db.users.find_one({"_id": user_id})
    return {"id": updated["_id"], "email": updated["email"], "name": updated.get("name", ""), "role": updated["role"]}


@router.post("/users/{user_id}/subscription", dependencies=[Depends(require_admin)])
async def override_subscription(user_id: str, body: SubscriptionOverrideIn):
    db = get_db()
    user = await db.users.find_one({"_id": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    tier = await db.tiers.find_one({"_id": body.tier_id}) or await db.tiers.find_one({"id": body.tier_id})
    if not tier:
        raise HTTPException(status_code=404, detail="Tier not found")

    # Cancel any active subscription
    await db.subscriptions.update_many({"user_id": user_id, "status": "active"}, {"$set": {"status": "canceled", "updated_at": datetime.now(timezone.utc).isoformat()}})

    now = datetime.now(timezone.utc)
    if body.ends_at:
        ends_at = body.ends_at
    elif body.duration_months is not None:
        ends_at = (now + timedelta(days=30 * body.duration_months)).isoformat()
    else:
        ends_at = (now + timedelta(days=30)).isoformat()

    sub_id = f"sub-{user_id}-{now.timestamp()}"
    await db.subscriptions.insert_one({
        "_id": sub_id,
        "user_id": user_id,
        "tier": tier["id"],
        "status": body.status,
        "starts_at": now.isoformat(),
        "ends_at": ends_at,
    })
    return {"subscription_id": sub_id, "status": body.status, "ends_at": ends_at}


@router.delete("/users/{user_id}/subscription", dependencies=[Depends(require_admin)])
async def cancel_user_subscription(user_id: str):
    db = get_db()
    result = await db.subscriptions.update_many(
        {"user_id": user_id, "status": "active"},
        {"$set": {"status": "canceled", "ends_at": datetime.now(timezone.utc).isoformat(), "updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    return {"canceled": result}


@router.get("/orders", dependencies=[Depends(require_admin)])
async def list_orders(search: str = "", status: str = "", provider: str = ""):
    db = get_db()
    query = {}
    if status:
        query["payment_status"] = status
    if provider:
        query["payment_provider"] = provider
    if search:
        query["$or"] = [
            {"user_id": {"$regex": search, "$options": "i"}},
            {"_id": {"$regex": search, "$options": "i"}},
        ]
    orders = await db.orders.find(query).to_list(1000)
    return [{"id": o["_id"], **{k: v for k, v in o.items() if k != "_id"}} for o in orders]


@router.post("/orders/{order_id}/refund", dependencies=[Depends(require_admin)])
async def refund_order(order_id: str):
    db = get_db()
    order = await db.orders.find_one({"_id": order_id})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    if order.get("payment_status") == "refunded":
        raise HTTPException(status_code=400, detail="Order already refunded")

    # Attempt provider refund
    provider = order.get("payment_provider")
    external_id = order.get("external_id")
    refund_error = None
    if provider == "stripe" and external_id and settings.stripe_secret_key:
        try:
            payment_service.refund_stripe(external_id)
        except Exception as e:
            refund_error = str(e)
    elif provider == "paypal" and external_id and settings.paypal_client_id:
        try:
            await payment_service.refund_paypal(external_id)
        except Exception as e:
            refund_error = str(e)

    now = datetime.now(timezone.utc).isoformat()
    await db.orders.update_one(
        {"_id": order_id},
        {"$set": {"payment_status": "refunded", "refunded_at": now, "refund_error": refund_error}}
    )

    if order.get("subscription_id"):
        await db.subscriptions.update_one(
            {"_id": order["subscription_id"]},
            {"$set": {"status": "canceled", "ends_at": now, "updated_at": now}}
        )

    return {"refunded": True, "order_id": order_id, "refund_error": refund_error}


@router.get("/coupons", dependencies=[Depends(require_admin)])
async def list_coupons():
    db = get_db()
    coupons = await db.coupons.find().to_list(1000)
    return [{"id": c["_id"], **{k: v for k, v in c.items() if k != "_id"}} for c in coupons]


class CouponIn(BaseModel):
    code: str
    discount_type: str = "percent"
    discount_value: float
    max_uses: int | None = None
    expires_at: str | None = None


@router.post("/coupons", dependencies=[Depends(require_admin)])
async def create_coupon(body: CouponIn):
    db = get_db()
    coupon_id = f"coupon-{body.code.upper()}"
    if await db.coupons.find_one({"_id": coupon_id}):
        raise HTTPException(status_code=400, detail="Coupon code already exists")
    coupon = {
        "_id": coupon_id,
        "code": body.code.upper(),
        "discount_type": body.discount_type,
        "discount_value": body.discount_value,
        "max_uses": body.max_uses,
        "used_count": 0,
        "expires_at": body.expires_at,
    }
    await db.coupons.insert_one(coupon)
    return {"id": coupon["_id"], **{k: v for k, v in coupon.items() if k != "_id"}}


@router.delete("/coupons/{coupon_id}", dependencies=[Depends(require_admin)])
async def delete_coupon(coupon_id: str):
    db = get_db()
    await db.coupons.delete_many({"_id": coupon_id})
    return {"deleted": True}


# ── R2 / CDN endpoints ──────────────────────────────────────────────────────


class R2MigrateLessonIn(BaseModel):
    drive_file_id: str
    watermark_text: str | None = None


@router.post("/lessons/{lesson_id}/migrate-to-r2", dependencies=[Depends(require_admin)])
async def migrate_lesson_to_r2(lesson_id: str, body: R2MigrateLessonIn):
    """Enqueue a lesson video migration from Google Drive to Cloudflare R2."""
    db = get_db()
    course = None
    for c in await db.courses.find().to_list(1000):
        for l in c.get("syllabus", []):
            if l["id"] == lesson_id:
                course = c
                break
        if course:
            break

    if not course:
        raise HTTPException(status_code=404, detail="Lesson not found in any course")

    job_id = await enqueue_task_with_retry("migrate_video_task", lesson_id, body.drive_file_id, body.watermark_text, _max_retries=3, _job_timeout=600)
    WORKER_JOBS_ENQUEUED.labels(task="migrate_video_task").inc()
    return {"lesson_id": lesson_id, "job_id": job_id, "status": "enqueued"}


@router.post("/courses/{course_id}/migrate-to-r2", dependencies=[Depends(require_admin)])
async def migrate_course_to_r2(course_id: str):
    """Enqueue migration of all lessons in a course from Drive to R2."""
    db = get_db()
    course = await db.courses.find_one({"_id": course_id})
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")

    syllabus = course.get("syllabus", [])
    job_ids = []
    for lesson in syllabus:
        drive_id = lesson.get("drive_file_id")
        if not drive_id or lesson.get("r2_key"):
            continue
        job_id = await enqueue_task_with_retry("migrate_video_task", lesson["id"], drive_id, _max_retries=3, _job_timeout=600)
        WORKER_JOBS_ENQUEUED.labels(task="migrate_video_task").inc()
        job_ids.append({"lesson_id": lesson["id"], "job_id": job_id, "status": "enqueued"})

    return {"course_id": course_id, "jobs": job_ids, "total_enqueued": len(job_ids)}


@router.post("/upload/{lesson_id}", dependencies=[Depends(require_admin)])
async def upload_video_to_r2(lesson_id: str, file: UploadFile = File(...)):
    """Directly upload a video file to R2 and link it to a lesson."""
    db = get_db()
    course = None
    for c in await db.courses.find().to_list(1000):
        for l in c.get("syllabus", []):
            if l["id"] == lesson_id:
                course = c
                break
        if course:
            break

    if not course:
        raise HTTPException(status_code=404, detail="Lesson not found")

    data = await file.read()
    key = await r2_storage.upload(lesson_id, data, content_type=file.content_type or "video/mp4")

    syllabus = course.get("syllabus", [])
    for l in syllabus:
        if l["id"] == lesson_id:
            l["r2_key"] = key
            break

    await db.courses.update_one({"_id": course["_id"]}, {"$set": {"syllabus": syllabus}})
    return {"lesson_id": lesson_id, "r2_key": key, "size_bytes": len(data)}


@router.get("/r2/status", dependencies=[Depends(require_admin)])
async def r2_storage_status():
    """Show R2 storage usage and lifecycle config."""
    await r2_storage.ensure_client()
    if not r2_storage.client:
        return {"configured": False}
    try:
        objects = await r2_storage.list_all()
        total_bytes = sum(o.get("Size", 0) for o in objects)
        return {
            "configured": True,
            "object_count": len(objects),
            "total_bytes": total_bytes,
            "bucket": settings.r2_bucket_name,
            "auto_delete_days": settings.r2_auto_delete_days,
        }
    except Exception as e:
        return {"configured": True, "error": str(e)}


@router.post("/r2/set-lifecycle", dependencies=[Depends(require_admin)])
async def set_r2_lifecycle():
    """Set 1-day auto-delete lifecycle policy on the R2 bucket."""
    await r2_storage.set_bucket_lifecycle()
    return {"status": "ok", "auto_delete_days": settings.r2_auto_delete_days}


class LessonR2UpdateIn(BaseModel):
    r2_key: str


@router.put("/courses/{course_id}/lessons/{lesson_id}/r2", dependencies=[Depends(require_admin)])
async def map_lesson_r2_key(course_id: str, lesson_id: str, body: LessonR2UpdateIn):
    """Manually set/update the R2 key for a lesson."""
    db = get_db()
    course = await db.courses.find_one({"_id": course_id})
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")

    updated = False
    syllabus = course.get("syllabus", [])
    for lesson in syllabus:
        if lesson["id"] == lesson_id:
            lesson["r2_key"] = body.r2_key
            updated = True
            break

    if not updated:
        raise HTTPException(status_code=404, detail="Lesson not found")

    await db.courses.update_one({"_id": course_id}, {"$set": {"syllabus": syllabus}})
    return {"lesson_id": lesson_id, "r2_key": body.r2_key}


@router.delete("/r2/lessons/{lesson_id}", dependencies=[Depends(require_admin)])
async def delete_r2_video(lesson_id: str):
    """Delete a video from R2 storage."""
    deleted = await r2_storage.delete(lesson_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Video not found in R2")
    return {"deleted": True, "lesson_id": lesson_id}


@router.post("/campaigns/run", dependencies=[Depends(require_admin)])
async def run_email_campaigns():
    """Trigger all email drip campaigns manually."""
    job_id = await enqueue_task_with_retry("run_email_campaigns_task")
    return {"enqueued": True, "job_id": job_id}


@router.get("/campaigns/stats", dependencies=[Depends(require_admin)])
async def campaign_stats():
    """Get email campaign statistics."""
    db = get_db()
    pipeline = [
        {"$group": {
            "_id": "$campaign_type",
            "total_sent": {"$sum": 1},
            "last_sent": {"$max": "$sent_at"},
        }},
        {"$sort": {"total_sent": -1}},
    ]
    stats = await db.email_campaigns.aggregate(pipeline).to_list(100)
    total = await db.email_campaigns.count_documents({})
    return {
        "total_campaign_emails_sent": total,
        "by_campaign": {
            s["_id"]: {"total_sent": s["total_sent"], "last_sent": s["last_sent"]}
            for s in stats
        },
    }


# ── Category Management ─────────────────────────────────────────────────────


@router.get("/categories", dependencies=[Depends(require_admin)])
async def list_categories():
    """List all categories."""
    db = get_db()
    categories = await db.categories.find().to_list(1000)
    return [{"id": c["_id"], **{k: v for k, v in c.items() if k != "_id"}} for c in categories]


@router.post("/categories", dependencies=[Depends(require_admin)])
async def create_category(body: CategoryIn):
    """Create a new category."""
    db = get_db()
    
    # Check if category with same slug or name already exists
    existing = await db.categories.find_one({"$or": [{"slug": body.slug}, {"name": body.name}]})
    if existing:
        raise HTTPException(status_code=400, detail="Category with this slug or name already exists")
    
    category = {
        "_id": f"cat-{body.slug}",
        "name": body.name,
        "slug": body.slug,
        "icon": body.icon or "book",
        "description": body.description or "",
        "course_count": body.course_count,
    }
    await db.categories.insert_one(category)
    return {"id": category["_id"], **{k: v for k, v in category.items() if k != "_id"}}


@router.get("/categories/{category_id}", dependencies=[Depends(require_admin)])
async def get_category(category_id: str):
    """Get a specific category."""
    db = get_db()
    category = await db.categories.find_one({"_id": category_id})
    if not category:
        raise HTTPException(status_code=404, detail="Category not found")
    return {"id": category["_id"], **{k: v for k, v in category.items() if k != "_id"}}


@router.put("/categories/{category_id}", dependencies=[Depends(require_admin)])
async def update_category(category_id: str, body: CategoryUpdateIn):
    """Update a category."""
    db = get_db()
    category = await db.categories.find_one({"_id": category_id})
    if not category:
        raise HTTPException(status_code=404, detail="Category not found")
    
    # Check for duplicate slug/name if being updated
    if body.slug or body.name:
        query = {"$or": []}
        if body.slug:
            query["$or"].append({"slug": body.slug})
        if body.name:
            query["$or"].append({"name": body.name})
        
        existing = await db.categories.find_one({**query, "_id": {"$ne": category_id}})
        if existing:
            raise HTTPException(status_code=400, detail="Category with this slug or name already exists")
    
    updates = {}
    if body.name is not None:
        updates["name"] = body.name
    if body.slug is not None:
        updates["slug"] = body.slug
        updates["_id"] = f"cat-{body.slug}"
    if body.icon is not None:
        updates["icon"] = body.icon
    if body.description is not None:
        updates["description"] = body.description
    if body.course_count is not None:
        updates["course_count"] = body.course_count
    
    if updates:
        await db.categories.update_one({"_id": category_id}, {"$set": updates})
    
    updated = await db.categories.find_one({"_id": category_id})
    return {"id": updated["_id"], **{k: v for k, v in updated.items() if k != "_id"}}


@router.delete("/categories/{category_id}", dependencies=[Depends(require_admin)])
async def delete_category(category_id: str):
    """Delete a category."""
    db = get_db()
    
    # Check if category exists
    category = await db.categories.find_one({"_id": category_id})
    if not category:
        raise HTTPException(status_code=404, detail="Category not found")
    
    # Check if any courses are using this category
    courses_count = await db.courses.count_documents({"category_id": category_id})
    if courses_count > 0:
        raise HTTPException(
            status_code=400, 
            detail=f"Cannot delete category. {courses_count} course(s) are using this category."
        )
    
    await db.categories.delete_one({"_id": category_id})
    return {"deleted": True, "category_id": category_id}


# ── Challenge Admin Management ────────────────────────────────────────────────


@router.get("/challenges", dependencies=[Depends(require_admin)])
async def admin_list_challenges(
    search: str = "",
    status: str = "",
    difficulty: str = "",
    source: str = "",
    sort: str = "newest",
    page: int = 1,
    per_page: int = 20,
):
    """Admin: list all challenges (including drafts)."""
    db = get_db()
    query: dict = {}
    if status:
        query["status"] = status
    if difficulty:
        query["difficulty"] = difficulty
    if source:
        query["source"] = source
    if search:
        import re as _re
        regex = _re.compile(re.escape(search), _re.IGNORECASE)
        query["$or"] = [{"title": regex}, {"topic": regex}, {"description": regex}]

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
    return {
        "challenges": challenges,
        "total": total,
        "page": page,
        "per_page": per_page,
    }


@router.get("/challenges/stats", dependencies=[Depends(require_admin)])
async def admin_challenge_stats():
    """Admin: challenge statistics for dashboard."""
    db = get_db()
    total = await db.challenges.count_documents({})
    published = await db.challenges.count_documents({"status": "published"})
    drafts = await db.challenges.count_documents({"status": "draft"})
    total_attempts = 0
    total_completions = 0
    challenge_docs = await db.challenges.find({}).to_list(length=10000)
    for c in challenge_docs:
        stats = c.get("stats", {})
        total_attempts += stats.get("attempts", 0)
        total_completions += stats.get("completion_rate", 0.0) * stats.get("attempts", 0)
    return {
        "total": total,
        "published": published,
        "drafts": drafts,
        "total_attempts": total_attempts,
        "completion_rate": round(total_completions / total_attempts, 3) if total_attempts else 0.0,
        "by_difficulty": {
            "easy": await db.challenges.count_documents({"difficulty": "easy"}),
            "medium": await db.challenges.count_documents({"difficulty": "medium"}),
            "hard": await db.challenges.count_documents({"difficulty": "hard"}),
            "expert": await db.challenges.count_documents({"difficulty": "expert"}),
        },
        "by_source": {
            "ai": await db.challenges.count_documents({"source": "ai"}),
            "user": await db.challenges.count_documents({"source": "user"}),
        },
    }


@router.get("/challenges/{challenge_id}", dependencies=[Depends(require_admin)])
async def admin_get_challenge(challenge_id: str):
    """Admin: get a single challenge (any status)."""
    db = get_db()
    challenge = await db.challenges.find_one({"_id": challenge_id})
    if not challenge:
        raise HTTPException(status_code=404, detail="Challenge not found")
    attempts = await db.challenge_attempts.find({"challenge_id": challenge_id}).sort("created_at", -1).to_list(length=100)
    return {"challenge": challenge, "attempts": attempts}


@router.put("/challenges/{challenge_id}", dependencies=[Depends(require_admin)])
async def admin_update_challenge(challenge_id: str, body: dict):
    """Admin: update any challenge — publish, edit content, change difficulty."""
    from app.services import community as com
    result = await com.update_challenge("", challenge_id, body, is_admin=True)
    if result.get("error"):
        raise HTTPException(status_code=404, detail=result["message"])
    return {"success": True, "challenge": result["challenge"]}


@router.post("/challenges/{challenge_id}/publish", dependencies=[Depends(require_admin)])
async def admin_publish_challenge(challenge_id: str):
    """Admin: publish a challenge."""
    db = get_db()
    challenge = await db.challenges.find_one({"_id": challenge_id})
    if not challenge:
        raise HTTPException(status_code=404, detail="Challenge not found")
    await db.challenges.update_one(
        {"_id": challenge_id},
        {"$set": {"status": "published", "updated_at": datetime.now(timezone.utc).isoformat()}},
    )
    return {"success": True, "status": "published"}


@router.post("/challenges/{challenge_id}/unpublish", dependencies=[Depends(require_admin)])
async def admin_unpublish_challenge(challenge_id: str):
    """Admin: unpublish a challenge (set back to draft)."""
    db = get_db()
    challenge = await db.challenges.find_one({"_id": challenge_id})
    if not challenge:
        raise HTTPException(status_code=404, detail="Challenge not found")
    await db.challenges.update_one(
        {"_id": challenge_id},
        {"$set": {"status": "draft", "updated_at": datetime.now(timezone.utc).isoformat()}},
    )
    return {"success": True, "status": "draft"}


@router.delete("/challenges/{challenge_id}", dependencies=[Depends(require_admin)])
async def admin_delete_challenge(challenge_id: str):
    """Admin: delete any challenge."""
    from app.services import community as com
    result = await com.delete_challenge("", challenge_id, is_admin=True)
    if result.get("error"):
        raise HTTPException(status_code=404, detail=result["message"])
    return {"success": True, "deleted": challenge_id}
