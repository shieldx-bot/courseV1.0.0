"""Remediation Service.

Detects knowledge gaps (weak concepts) and provides remediation suggestions.
Phase 1: basic gap detection + lesson linking.
Phase 3+: AI-generated remedial content.
"""

import logging
from typing import Any

from app.services.concept_mastery import (
    get_concept_definition,
    get_weak_concepts,
    get_all_concepts_for_course,
    get_course_mastery_map,
    DEFAULT_MASTERY,
)

logger = logging.getLogger(__name__)


async def detect_gaps(user_id: str, course_id: str, threshold: float = 3.0) -> list[dict[str, Any]]:
    """Return concepts where user mastery is below threshold, sorted by severity."""
    weak = await get_weak_concepts(user_id, course_id, threshold=threshold)
    weak.sort(key=lambda c: c.get("mastery_score", DEFAULT_MASTERY))
    return weak


async def get_remediation_suggestions(user_id: str, course_id: str) -> list[dict[str, Any]]:
    """Get remediation suggestions for weak concepts.

    Phase 1: return weak concepts + their linked lessons.
    Phase 3: will include AI-generated explanations and micro-exercises.
    """
    gaps = await detect_gaps(user_id, course_id)
    if not gaps:
        return []

    all_concepts = {c["_id"]: c for c in await get_all_concepts_for_course(course_id)}

    suggestions = []
    for gap in gaps:
        concept_id = gap.get("concept_id", "")
        concept = all_concepts.get(concept_id, {})
        suggestions.append({
            "concept_id": concept_id,
            "concept_name": concept.get("name", concept_id),
            "mastery_score": gap.get("mastery_score", DEFAULT_MASTERY),
            "trend": gap.get("trend", "stable"),
            "lesson_ids": concept.get("lesson_ids", []),
            "prerequisite_concepts": concept.get("prerequisite_concepts", []),
            "suggestion": _build_suggestion(gap, concept),
        })

    return suggestions


async def get_prerequisite_gaps(user_id: str, course_id: str) -> list[dict[str, Any]]:
    """Return concepts whose prerequisites are not yet mastered."""
    mastery_map = await get_course_mastery_map(user_id, course_id)
    all_concepts = await get_all_concepts_for_course(course_id)

    gaps = []
    for c in all_concepts:
        prereqs = c.get("prerequisite_concepts", [])
        weak_prereqs = [p for p in prereqs if mastery_map.get(p, 0) < 4.0]
        if weak_prereqs:
            gaps.append({
                "concept_id": c["_id"],
                "concept_name": c.get("name", c["_id"]),
                "weak_prerequisites": weak_prereqs,
                "suggestion": f"Review prerequisites before studying {c.get('name', c['_id'])}",
            })

    return gaps


def _build_suggestion(gap: dict[str, Any], concept: dict[str, Any]) -> str:
    score = gap.get("mastery_score", DEFAULT_MASTERY)
    name = concept.get("name", gap.get("concept_id", "this concept"))
    lesson_ids = concept.get("lesson_ids", [])

    if score < 2.0:
        base = f"You're struggling with {name}. We recommend reviewing the related lessons first."
    elif score < 3.0:
        base = f"{name} needs more practice. Try the related exercises."
    else:
        base = f"{name} is still below target. A quick review will help."

    if lesson_ids:
        base += f" Related lessons: {', '.join(lesson_ids)}."

    return base
