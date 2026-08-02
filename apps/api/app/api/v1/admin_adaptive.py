"""Adaptive Learning — admin endpoints."""

import logging
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field

from app.core.deps import require_admin
from app.core.response import api_response
from app.db.mongodb import get_db
from app.services.concept_mastery import (
    DEFAULT_MASTERY,
    _format_concept,
    _now,
    _slugify,
    get_all_concepts_for_course,
    get_all_course_mastery,
)
from app.services.remediation import get_prerequisite_gaps

logger = logging.getLogger(__name__)

admin_router = APIRouter()


# ── Models ───────────────────────────────────────────────────────────────────


class ConceptBulkIn(BaseModel):
    course_id: str
    concepts: list[dict[str, Any]]


class ConceptCreateIn(BaseModel):
    course_id: str
    name: str = Field(min_length=1, max_length=200)
    description: str = Field(min_length=1)
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


class ConceptStatsOut(BaseModel):
    course_id: str
    total_concepts: int
    avg_difficulty: float
    concepts: list[dict[str, Any]]


# ── Admin Concept CRUD ────────────────────────────────────────────────────────


@admin_router.get("/concepts")
async def admin_list_concepts(course_id: str | None = Query(default=None)):
    if course_id:
        concepts = await get_all_concepts_for_course(course_id)
    else:
        db = get_db()
        concepts = await db.concept_definitions.find({"is_active": True}).to_list(1000)
    result = []
    for c in concepts:
        result.append({
            "id": c["_id"],
            "course_id": c.get("course_id", ""),
            "name": c.get("name", ""),
            "slug": c.get("slug", ""),
            "difficulty_base": c.get("difficulty_base", 5),
            "tags": c.get("tags", []),
            "lesson_ids": c.get("lesson_ids", []),
            "prerequisite_concepts": c.get("prerequisite_concepts", []),
            "is_active": c.get("is_active", True),
            "created_at": c.get("created_at", ""),
            "updated_at": c.get("updated_at", ""),
        })
    return api_response(result)


@admin_router.post("/concepts")
async def admin_create_concept(body: ConceptCreateIn, _=Depends(require_admin)):
    db = get_db()
    slug = _slugify(body.name)
    concept_id = f"conc-{body.course_id}-{slug}"

    existing = await db.concept_definitions.find_one({"_id": concept_id})
    if existing:
        raise HTTPException(status_code=400, detail="Concept already exists")

    now = _now()
    doc = {
        "_id": concept_id,
        "course_id": body.course_id,
        "name": body.name,
        "slug": slug,
        "description": body.description,
        "difficulty_base": max(1, min(10, body.difficulty_base)),
        "tags": body.tags,
        "lesson_ids": body.lesson_ids,
        "prerequisite_concepts": body.prerequisite_concepts,
        "is_active": True,
        "created_at": now,
        "updated_at": now,
    }
    await db.concept_definitions.insert_one(doc)
    return api_response(_format_concept(doc))


@admin_router.put("/concepts/{concept_id}")
async def admin_update_concept(concept_id: str, body: ConceptUpdateIn, _=Depends(require_admin)):
    db = get_db()
    existing = await db.concept_definitions.find_one({"_id": concept_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Concept not found")

    updates: dict[str, Any] = {"updated_at": _now()}
    if body.name is not None:
        updates["name"] = body.name
        updates["slug"] = _slugify(body.name)
        updates["_id"] = f"conc-{existing.get('course_id', '')}-{_slugify(body.name)}"
    if body.description is not None:
        updates["description"] = body.description
    if body.difficulty_base is not None:
        updates["difficulty_base"] = max(1, min(10, body.difficulty_base))
    if body.tags is not None:
        updates["tags"] = body.tags
    if body.lesson_ids is not None:
        updates["lesson_ids"] = body.lesson_ids
    if body.prerequisite_concepts is not None:
        updates["prerequisite_concepts"] = body.prerequisite_concepts
    if body.is_active is not None:
        updates["is_active"] = body.is_active

    new_id = updates.get("_id", concept_id)
    await db.concept_definitions.update_one({"_id": concept_id}, {"$set": updates})
    if new_id != concept_id:
        # Rewrite prerequisite references in other concepts (done in Python so
        # the in-memory test backend and real MongoDB behave identically).
        references = await db.concept_definitions.find(
            {"prerequisite_concepts": concept_id}
        ).to_list(1000)
        for ref in references:
            ref_prereqs = [
                new_id if p == concept_id else p
                for p in ref.get("prerequisite_concepts", [])
            ]
            await db.concept_definitions.update_one(
                {"_id": ref["_id"]},
                {"$set": {"prerequisite_concepts": ref_prereqs}},
            )
    doc = await db.concept_definitions.find_one({"_id": new_id})
    return api_response(_format_concept(doc))


@admin_router.delete("/concepts/{concept_id}")
async def admin_delete_concept(concept_id: str, _=Depends(require_admin)):
    db = get_db()
    result = await db.concept_definitions.delete_one({"_id": concept_id})
    return api_response({"deleted": result.deleted_count > 0})


@admin_router.post("/concepts/bulk")
async def admin_bulk_create_concepts(body: ConceptBulkIn, _=Depends(require_admin)):
    db = get_db()
    now = _now()
    docs = []
    for seq, c in enumerate(body.concepts, 1):
        course_id = body.course_id
        name = c.get("name", f"Concept {seq}")
        slug = _slugify(name)
        concept_id = c.get("id") or f"conc-{course_id}-{slug}"
        docs.append({
            "_id": concept_id,
            "course_id": course_id,
            "name": name,
            "slug": slug,
            "description": c.get("description", ""),
            "difficulty_base": max(1, min(10, c.get("difficulty_base", 5))),
            "tags": c.get("tags", []),
            "lesson_ids": c.get("lesson_ids", []),
            "prerequisite_concepts": c.get("prerequisite_concepts", []),
            "is_active": c.get("is_active", True),
            "created_at": now,
            "updated_at": now,
        })
    if docs:
        existing_ids = {
            e["_id"]
            for e in await db.concept_definitions.find(
                {"_id": {"$in": [d["_id"] for d in docs]}}
            ).to_list(1000)
        }
        new_docs = [d for d in docs if d["_id"] not in existing_ids]
        if new_docs:
            await db.concept_definitions.insert_many(new_docs, ordered=False)
    else:
        new_docs = []
    return api_response({
        "created": len(new_docs),
        "skipped": len(docs) - len(new_docs),
    })


# ── Admin Stats ───────────────────────────────────────────────────────────────


@admin_router.get("/stats/{course_id}")
async def admin_course_stats(course_id: str, _=Depends(require_admin)):
    concepts = await get_all_concepts_for_course(course_id)
    mastery_rows = await get_all_course_mastery(course_id)

    mastery_map: dict[str, list[float]] = {}
    for r in mastery_rows:
        cid = r.get("concept_id", "")
        if cid not in mastery_map:
            mastery_map[cid] = []
        mastery_map[cid].append(r.get("mastery_score", DEFAULT_MASTERY))

    concept_stats = []
    for c in concepts:
        cid = c["_id"]
        scores = mastery_map.get(cid, [])
        avg = sum(scores) / len(scores) if scores else DEFAULT_MASTERY
        concept_stats.append({
            "id": cid,
            "name": c.get("name", ""),
            "difficulty_base": c.get("difficulty_base", 5),
            "avg_mastery": round(avg, 2),
            "student_count": len(scores),
            "tags": c.get("tags", []),
        })

    avg_difficulty = (
        sum(cs["difficulty_base"] for cs in concept_stats) / len(concept_stats)
        if concept_stats else 0
    )

    return api_response({
        "course_id": course_id,
        "total_concepts": len(concepts),
        "avg_difficulty": round(avg_difficulty, 1),
        "concepts": concept_stats,
    })


@admin_router.get("/gaps/{course_id}")
async def admin_prerequisite_gaps(course_id: str, _=Depends(require_admin)):
    gaps = await get_prerequisite_gaps("", course_id)
    return api_response(gaps)


# ── Helpers ───────────────────────────────────────────────────────────────────


def _format_concept(doc: dict[str, Any]) -> dict[str, Any]:
    if not doc:
        return {}
    return {
        "id": doc["_id"],
        "course_id": doc.get("course_id", ""),
        "name": doc.get("name", ""),
        "slug": doc.get("slug", ""),
        "description": doc.get("description", ""),
        "difficulty_base": doc.get("difficulty_base", 5),
        "tags": doc.get("tags", []),
        "lesson_ids": doc.get("lesson_ids", []),
        "prerequisite_concepts": doc.get("prerequisite_concepts", []),
        "is_active": doc.get("is_active", True),
        "created_at": doc.get("created_at", ""),
        "updated_at": doc.get("updated_at", ""),
    }
