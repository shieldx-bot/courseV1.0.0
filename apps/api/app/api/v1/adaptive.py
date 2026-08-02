"""Adaptive Learning — user-facing endpoints."""

import logging
from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field

from app.core.deps import get_current_user, get_optional_user
from app.core.response import api_response
from app.services.adaptive_quiz import generate_adaptive_quiz, grade_quiz
from app.services.concept_mastery import (
    get_concept_definition,
    get_course_mastery_details,
    get_course_mastery_map,
    get_strong_concepts,
    get_weak_concepts,
    get_all_concepts_for_course,
    get_ready_concepts,
    DEFAULT_MASTERY,
)
from app.services.remediation import get_remediation_suggestions

logger = logging.getLogger(__name__)

from app.api.v1.admin_adaptive import admin_router

router = APIRouter()


# ── Models ───────────────────────────────────────────────────────────────────


class QuizSubmitIn(BaseModel):
    quiz_id: str
    answers: dict[int, int] = Field(default_factory=dict)
    questions: list[dict[str, Any]] = Field(default_factory=list)


class ConceptCreateIn(BaseModel):
    course_id: str
    name: str
    description: str
    difficulty_base: int = Field(default=5, ge=1, le=10)
    tags: list[str] = Field(default_factory=list)
    lesson_ids: list[str] = Field(default_factory=list)
    prerequisite_concepts: list[str] = Field(default_factory=list)


class ConceptUpdateIn(BaseModel):
    name: str | None = None
    description: str | None = None
    difficulty_base: int | None = Field(default=None, ge=1, le=10)
    tags: list[str] | None = None
    lesson_ids: list[str] | None = None
    prerequisite_concepts: list[str] | None = None
    is_active: bool | None = None


# ── Concept endpoints ─────────────────────────────────────────────────────────


@router.get("/concepts/{course_id}")
async def list_course_concepts(course_id: str, user=Depends(get_current_user)):
    concepts = await get_all_concepts_for_course(course_id)
    mastery_map = await get_course_mastery_map(user["id"], course_id)

    result = []
    for c in concepts:
        item = {
            "id": c["_id"],
            "course_id": c.get("course_id", ""),
            "name": c.get("name", ""),
            "slug": c.get("slug", ""),
            "description": c.get("description", ""),
            "difficulty_base": c.get("difficulty_base", 5),
            "tags": c.get("tags", []),
            "lesson_ids": c.get("lesson_ids", []),
            "prerequisite_concepts": c.get("prerequisite_concepts", []),
            "mastery_score": mastery_map.get(c["_id"], DEFAULT_MASTERY),
        }
        result.append(item)

    result.sort(key=lambda x: x.get("mastery_score", DEFAULT_MASTERY))
    return api_response(result)


@router.get("/concepts/{course_id}/ready")
async def list_ready_concepts(course_id: str, user=Depends(get_current_user)):
    ready_ids = await get_ready_concepts(user["id"], course_id)
    return api_response({"ready_concept_ids": ready_ids})


@router.get("/weak/{course_id}")
async def list_weak_concepts(course_id: str, user=Depends(get_current_user), threshold: float = Query(default=3.0)):
    weak = await get_weak_concepts(user["id"], course_id, threshold=threshold)
    return api_response(weak)


@router.get("/strong/{course_id}")
async def list_strong_concepts(course_id: str, user=Depends(get_current_user), threshold: float = Query(default=7.0)):
    strong = await get_strong_concepts(user["id"], course_id, threshold=threshold)
    return api_response(strong)


@router.get("/remediation/{course_id}")
async def get_remediation(course_id: str, user=Depends(get_current_user)):
    suggestions = await get_remediation_suggestions(user["id"], course_id)
    return api_response(suggestions)


# ── Quiz endpoints ────────────────────────────────────────────────────────────


@router.post("/quiz/{course_id}/generate")
async def generate_quiz_endpoint(course_id: str, lesson_id: str, user=Depends(get_current_user), num_questions: int = Query(default=5, ge=1, le=10)):
    quiz = await generate_adaptive_quiz(
        user_id=user["id"],
        course_id=course_id,
        lesson_id=lesson_id,
        num_questions=num_questions,
    )
    return api_response(quiz)


@router.post("/quiz/{course_id}/submit")
async def submit_quiz(course_id: str, body: QuizSubmitIn, user=Depends(get_current_user)):
    if not body.questions:
        raise HTTPException(status_code=400, detail="questions are required for grading")

    result = await grade_quiz(
        user_id=user["id"],
        course_id=course_id,
        quiz_id=body.quiz_id,
        answers=body.answers,
        questions=body.questions,
    )
    return api_response(result)


@router.get("/prerequisites/{course_id}/{concept_id}")
async def get_concept_prerequisites(course_id: str, concept_id: str, user=Depends(get_current_user)):
    from app.services.concept_mastery import get_prerequisites, get_course_mastery_map

    prereqs = await get_prerequisites(course_id, concept_id)
    mastery_map = await get_course_mastery_map(user["id"], course_id)

    result = []
    for p in prereqs:
        result.append({
            "id": p["_id"],
            "name": p.get("name", ""),
            "description": p.get("description", ""),
            "mastery_score": mastery_map.get(p["_id"], DEFAULT_MASTERY),
            "mastered": mastery_map.get(p["_id"], 0) >= 6.0,
        })
    return api_response(result)


@router.get("/concepts/detail/{concept_id}")
async def get_concept_detail(concept_id: str, user=Depends(get_current_user)):
    concept = await get_concept_definition(concept_id)
    if not concept:
        raise HTTPException(status_code=404, detail="Concept not found")
    return api_response(concept)


@router.get("/course/{course_id}/recommended-sequence")
async def get_recommended_sequence(course_id: str, user=Depends(get_current_user)):
    from app.services.concept_mastery import (
        get_all_concepts_for_course,
        get_course_mastery_map,
        get_concepts_by_lesson,
        get_prerequisites,
        DEFAULT_MASTERY,
    )
    from app.db.mongodb import get_read_db

    mastery_map = await get_course_mastery_map(user["id"], course_id)
    all_concepts = await get_all_concepts_for_course(course_id)
    concept_by_id = {c["_id"]: c for c in all_concepts}

    course = await get_read_db().courses.find_one({"_id": course_id})
    syllabus = course.get("syllabus", []) if course else []

    seen_lessons: set[str] = set()
    sequence: list[dict[str, Any]] = []

    for lesson in syllabus:
        lesson_id = lesson.get("id", "")
        lesson_concepts = await get_concepts_by_lesson(course_id, lesson_id)
        weak = [c for c in lesson_concepts if mastery_map.get(c["_id"], DEFAULT_MASTERY) < 3.0]
        strong = [c for c in lesson_concepts if mastery_map.get(c["_id"], DEFAULT_MASTERY) >= 7.0]

        # Prerequisite-aware rerouting: if a concept in this lesson has unmastered prerequisites,
        # insert a synthetic remedial item immediately before this lesson.
        prerequisite_concept_ids: set[str] = set()
        for c in lesson_concepts:
            prereqs = await get_prerequisites(course_id, c["_id"])
            for p in prereqs:
                if mastery_map.get(p["_id"], DEFAULT_MASTERY) < 4.0:
                    prerequisite_concept_ids.add(p["_id"])

        if prerequisite_concept_ids and lesson_id not in seen_lessons:
            sequence.append({
                "lesson_id": f"remedial-{lesson_id}",
                "title": f"Prerequisite practice for {lesson.get('title', lesson_id)}",
                "order": lesson.get("order", 0),
                "status": "remedial",
                "is_synthetic": True,
                "target_lesson_id": lesson_id,
                "weak_concepts": [concept_by_id.get(cid, {}).get("name", cid) for cid in prerequisite_concept_ids],
                "strong_concepts": [],
            })

        if lesson_id not in seen_lessons:
            if weak:
                status = "remedial"
            elif strong and len(strong) == len(lesson_concepts):
                status = "ready-to-skip"
            else:
                status = "normal"

            sequence.append({
                "lesson_id": lesson_id,
                "title": lesson.get("title", ""),
                "order": lesson.get("order", 0),
                "status": status,
                "is_synthetic": False,
                "weak_concepts": [concept_by_id.get(c["_id"], {}).get("name", c["_id"]) for c in weak],
                "strong_concepts": [concept_by_id.get(c["_id"], {}).get("name", c["_id"]) for c in strong],
            })
            seen_lessons.add(lesson_id)

    return api_response({
        "course_id": course_id,
        "sequence": sequence,
    })


@router.post("/skip/{course_id}/{lesson_id}")
async def skip_lesson(course_id: str, lesson_id: str, user=Depends(get_current_user)):
    from app.services.concept_mastery import get_concepts_by_lesson, get_course_mastery_map, DEFAULT_MASTERY
    from app.db.mongodb import get_db

    lesson_concepts = await get_concepts_by_lesson(course_id, lesson_id)
    mastery_map = await get_course_mastery_map(user["id"], course_id)

    if not lesson_concepts:
        raise HTTPException(status_code=400, detail="No concepts mapped to this lesson")

    not_mastered = [c["_id"] for c in lesson_concepts if mastery_map.get(c["_id"], DEFAULT_MASTERY) < 7.0]
    if not_mastered:
        raise HTTPException(
            status_code=400,
            detail={
                "message": "Cannot skip: some concepts are not yet mastered",
                "concepts": not_mastered,
            },
        )

    db = get_db()
    progress_id = f"prog-{user['id']}-{lesson_id}"
    await db.progress.update_one(
        {"_id": progress_id},
        {"$set": {"skipped": True, "mastery_skip": True, "updated_at": datetime.now(timezone.utc).isoformat()}},
        upsert=True,
    )
    return api_response({"skipped": True, "lesson_id": lesson_id})


@router.post("/remediation/{course_id}/content/{concept_id}")
async def generate_remediation_content(course_id: str, concept_id: str, user=Depends(get_current_user)):
    from app.services.remediation import generate_remedial_content

    content = await generate_remedial_content(user["id"], course_id, concept_id)
    return api_response(content)
