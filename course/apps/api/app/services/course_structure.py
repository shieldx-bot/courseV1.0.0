"""Course structure helpers: keep chapters + syllabus in sync."""

import re


def _slugify(s: str) -> str:
    s = s.lower().strip()
    return re.sub(r"[^a-z0-9]+", "-", s).strip("-")


def _chapter_from_title(course_id: str, title: str, order: int, lessons: list) -> dict:
    return {
        "id": f"{course_id}-chapter-{order}",
        "title": title,
        "order": order,
        "lessons": lessons,
    }


def _parse_chapter_number(name: str):
    m = re.match(
        r"^\s*(?:chương|chuong|chapter|lesson|bài|bai|buổi|buoi|phần|phan|part|sec|section)?\s*(\d{1,3})[\s.:\-)]+(.*)$",
        name.strip(),
        re.IGNORECASE,
    )
    if m:
        return int(m.group(1)), m.group(2).strip()
    return None, name.strip()


def group_videos_into_chapters(course_id: str, videos: list):
    """Group Drive videos into chapters (Chương N / Chapter N) and a flat syllabus."""
    chapters = []
    chapter_map = {}
    syllabus = []
    fallback_title = "Bài học"

    for i, v in enumerate(videos, start=1):
        name = v.get("name", "")
        num, rest = _parse_chapter_number(name)
        lesson = {
            "id": f"{course_id}-lesson-{i}",
            "title": rest or name,
            "order": i,
            "duration_seconds": 0,
            "drive_file_id": v.get("id"),
            "attachments": [],
        }
        syllabus.append(lesson)

        key = num if num is not None else fallback_title
        if key not in chapter_map:
            chapter_title = "Chương " + str(num) if num is not None else fallback_title
            chapter_map[key] = _chapter_from_title(course_id, chapter_title, len(chapters) + 1, [])
            chapters.append(chapter_map[key])
        chapter_map[key]["lessons"].append(lesson)

    sync_syllabus_from_chapters({"id": course_id, "chapters": chapters})
    return chapters, syllabus


def ensure_chapters(course: dict) -> list:
    chapters = course.get("chapters")
    if chapters:
        return chapters
    syllabus = course.get("syllabus", [])
    if not syllabus:
        return []
    course_id = course.get("id", course.get("_id", "course"))
    return [_chapter_from_title(course_id, "Chương 1", 1, list(syllabus))]


def flatten_lessons(course: dict) -> list:
    """Return flat lesson list from a course (chapters-first, syllabus fallback)."""
    chapters = course.get("chapters")
    if chapters:
        flat = []
        for ch in chapters:
            flat.extend(ch.get("lessons", []))
        return flat
    return course.get("syllabus", [])


def sync_syllabus_from_chapters(course: dict) -> dict:
    """Rebuild flat ``syllabus`` from ``chapters`` in-place; returns the course."""
    chapters = course.get("chapters")
    if not chapters:
        return course
    flat = []
    for ch in chapters:
        for l in ch.get("lessons", []):
            lesson = dict(l)
            lesson["order"] = len(flat) + 1
            flat.append(lesson)
    course["syllabus"] = flat
    if course.get("lesson_count") is not None:
        course["lesson_count"] = len(flat)
    return course


def update_lesson(course: dict, lesson_id: str, **updates) -> bool:
    """Apply updates to a lesson across chapters and syllabus."""
    updated = False
    if course.get("chapters"):
        for ch in course["chapters"]:
            for li, l in enumerate(ch.get("lessons", [])):
                if l["id"] == lesson_id:
                    ch["lessons"][li].update(updates)
                    updated = True
    for l in course.get("syllabus", []):
        if l["id"] == lesson_id:
            l.update(updates)
            updated = True
    if updated:
        sync_syllabus_from_chapters(course)
    return updated


def remove_lesson(course: dict, lesson_id: str) -> bool:
    removed = False
    chapters = course.get("chapters", [])
    for ch in chapters:
        before = len(ch.get("lessons", []))
        ch["lessons"] = [l for l in ch.get("lessons", []) if l["id"] != lesson_id]
        if len(ch["lessons"]) != before:
            removed = True
    course["chapters"] = [ch for ch in chapters if ch.get("lessons")]
    if removed:
        sync_syllabus_from_chapters(course)
    return removed
