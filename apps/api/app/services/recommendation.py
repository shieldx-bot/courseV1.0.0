from collections import Counter, defaultdict
from typing import Any
from app.db.mongodb import get_db
from app.services.cache import get_or_cache


async def get_recommendations(user_id: str, limit: int = 10) -> list[dict]:
    db = get_db()

    progress = await db.progress.find({"user_id": user_id}).to_list(1000)
    completed_lessons = {p["lesson_id"] for p in progress if p.get("completed")}

    if not completed_lessons:
        return await _cold_start_recommendations(limit)

    all_courses = await db.courses.find().to_list(1000)

    course_map = {c["_id"]: c for c in all_courses}
    lesson_to_course = {}
    for c in all_courses:
        for l in c.get("syllabus", []):
            lesson_to_course[l["id"]] = c["_id"]

    user_course_lessons: dict[str, set] = defaultdict(set)
    for l_id in completed_lessons:
        cid = lesson_to_course.get(l_id)
        if cid:
            user_course_lessons[cid].add(l_id)

    completed_course_ids = set()
    category_counter: Counter = Counter()
    for c in all_courses:
        cid = c["_id"]
        syllabus_ids = {l["id"] for l in c.get("syllabus", [])}
        if syllabus_ids and syllabus_ids.issubset(completed_lessons):
            completed_course_ids.add(cid)
        if cid in user_course_lessons:
            category_counter[c.get("category_slug", "")] += len(user_course_lessons[cid])

    preferred_cats = [cat for cat, _ in category_counter.most_common(3)]

    content_scores: dict[str, float] = {}
    for c in all_courses:
        cid = c["_id"]
        if cid in completed_course_ids:
            continue
        if c.get("category_slug") in preferred_cats:
            boost = preferred_cats.index(c["category_slug"])
            content_scores[cid] = max(0, 3 - boost) * 1.0

    collab_scores = await _collaborative_filtering(
        user_id, completed_course_ids, completed_lessons, lesson_to_course, course_map
    )

    seen = set(completed_course_ids)
    merged: dict[str, dict[str, Any]] = {}

    for cid, score in content_scores.items():
        if cid not in seen:
            merged[cid] = {"course": course_map[cid], "score": score * 0.4}
            seen.add(cid)

    for cid, score in collab_scores:
        if cid in merged:
            merged[cid]["score"] += score * 0.6
        elif cid not in completed_course_ids:
            merged[cid] = {"course": course_map[cid], "score": score * 0.6}

    ranked = sorted(merged.values(), key=lambda x: x["score"], reverse=True)
    diversified = _diversity_rerank([r["course"] for r in ranked], limit)

    return [_format_course(c) for c in diversified]


async def get_similar_courses(course_id: str, limit: int = 6) -> list[dict]:
    db = get_db()
    course = await db.courses.find_one({"_id": course_id})
    if not course:
        return []

    all_courses = await db.courses.find({"_id": {"$ne": course_id}}).to_list(1000)

    scored = []
    for c in all_courses:
        score = 0.0
        if c.get("category_slug") == course.get("category_slug"):
            score += 3.0
        if c.get("instructor", {}).get("name") == course.get("instructor", {}).get("name"):
            score += 2.0
        title_a = set(course.get("title", "").lower().split())
        title_b = set(c.get("title", "").lower().split())
        score += len(title_a & title_b) * 0.5
        outcomes_a = set(course.get("outcome", []))
        outcomes_b = set(c.get("outcome", []))
        score += len(outcomes_a & outcomes_b) * 0.3
        scored.append((c, score))

    scored.sort(key=lambda x: x[1], reverse=True)
    return [_format_course(c) for c, _ in scored[:limit]]


async def get_popular_courses(limit: int = 10) -> list[dict]:
    async def _fetch():
        db = get_db()
        courses = await db.courses.find().to_list(1000)
        courses.sort(key=lambda c: len(c.get("syllabus", [])), reverse=True)

        by_cat: dict[str, list] = defaultdict(list)
        for c in courses:
            by_cat[c.get("category_slug", "other")].append(c)

        result = []
        cats = list(by_cat.keys())
        idx = 0
        while len(result) < limit and any(by_cat.values()):
            cat = cats[idx % len(cats)]
            if by_cat[cat]:
                result.append(by_cat[cat].pop(0))
            idx += 1
        return [_format_course(c) for c in result[:limit]]

    return await get_or_cache("rec:popular", 300, _fetch)


async def _collaborative_filtering(
    user_id: str,
    completed_course_ids: set,
    completed_lessons: set,
    lesson_to_course: dict[str, str],
    course_map: dict[str, dict],
) -> list[tuple[str, float]]:
    db = get_db()
    similar_progress = await db.progress.find({
        "completed": True,
        "user_id": {"$ne": user_id},
    }).to_list(5000)

    user_courses: dict[str, set] = defaultdict(set)
    for p in similar_progress:
        cid = lesson_to_course.get(p["lesson_id"])
        if cid:
            user_courses[p["user_id"]].add(cid)

    course_scores: dict[str, float] = defaultdict(float)
    for uid, courses in user_courses.items():
        intersection = len(completed_course_ids & courses)
        union = len(completed_course_ids | courses)
        if union > 0:
            jaccard = intersection / union
            if jaccard > 0.1:
                for cid in courses:
                    if cid not in completed_course_ids:
                        course_scores[cid] += jaccard

    return sorted(course_scores.items(), key=lambda x: x[1], reverse=True)


async def _cold_start_recommendations(limit: int = 10) -> list[dict]:
    return await get_popular_courses(limit)


def _diversity_rerank(courses: list[dict], limit: int) -> list[dict]:
    if not courses:
        return []
    by_cat: dict[str, list] = defaultdict(list)
    for c in courses:
        by_cat[c.get("category_slug", "other")].append(c)
    result = []
    cats = list(by_cat.keys())
    idx = 0
    while len(result) < limit and any(by_cat.values()):
        cat = cats[idx % len(cats)]
        if by_cat[cat]:
            result.append(by_cat[cat].pop(0))
        idx += 1
    return result[:limit]


def _format_course(course: dict) -> dict:
    return {
        "id": course["_id"],
        "title": course.get("title", ""),
        "slug": course.get("slug", ""),
        "description": course.get("description", ""),
        "image_url": course.get("image_url", ""),
        "category_id": course.get("category_id", ""),
        "category_slug": course.get("category_slug", ""),
        "category_name": course.get("category_name", ""),
        "instructor_name": course.get("instructor", {}).get("name", ""),
        "lesson_count": course.get("lesson_count", 0),
        "outcome": course.get("outcome", []),
    }
