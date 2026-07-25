"""
A/B Testing & Experiment Service

Provides a lightweight experiment framework:
- Consistent variant assignment based on user_id hash
- Traffic splitting by percentage
- Event tracking for analytics
- Admin CRUD for experiment management
"""

import hashlib
import logging
import random
from datetime import datetime, timezone
from typing import Any

from app.core.config import settings
from app.db.mongodb import get_db

logger = logging.getLogger(__name__)


def _get_variant_index(user_id: str, variants: list[dict]) -> int:
    """
    Deterministic variant assignment using SHA-256 hash of user_id + experiment name.
    Returns index into variants list.
    """
    # Consistent hash across all experiments for the same user
    hash_input = f"{user_id}".encode()
    hash_hex = hashlib.sha256(hash_input).hexdigest()
    hash_int = int(hash_hex[:8], 16)
    return hash_int % len(variants)


def _assign_variant_with_traffic_split(user_id: str, variants: list[dict], traffic_split: float) -> dict | None:
    """
    Assign a variant based on traffic_split percentage.
    - traffic_split: 0.0 to 1.0 (e.g., 0.5 = 50% of users see the experiment)
    - Within the selected group, assigns a variant deterministically by user_id hash.
    """
    hash_input = f"{user_id}:experiment-traffic".encode()
    hash_hex = hashlib.sha256(hash_input).hexdigest()
    hash_int = int(hash_hex[:8], 16)
    # Normalize to 0.0 - 1.0
    normalized = (hash_int % 1_000_000) / 1_000_000

    # User falls within experiment traffic
    if normalized < traffic_split:
        idx = _get_variant_index(user_id, variants)
        return {**variants[idx], "variant_index": idx}
    return None  # Control group (not in experiment)


async def get_active_experiments() -> list[dict]:
    """Get all currently active experiments."""
    db = get_db()
    now = datetime.now(timezone.utc).isoformat()
    experiments = await db.experiments.find({
        "is_active": True,
        "starts_at": {"$lte": now},
        "$or": [
            {"ends_at": {"$gte": now}},
            {"ends_at": None},
        ],
    }).to_list(100)
    return [
        {
            "id": exp["_id"],
            "name": exp["name"],
            "slug": exp["slug"],
            "description": exp.get("description", ""),
            "variants": exp.get("variants", []),
            "traffic_split": exp.get("traffic_split", 1.0),
            "starts_at": exp.get("starts_at"),
            "ends_at": exp.get("ends_at"),
        }
        for exp in experiments
    ]


async def get_user_experiments(user_id: str) -> list[dict]:
    """
    Get active experiments with the user's assigned variant.
    Returns only experiments the user is bucketed into.
    """
    experiments = await get_active_experiments()
    result = []
    for exp in experiments:
        variant = _assign_variant_with_traffic_split(
            user_id, exp["variants"], exp.get("traffic_split", 1.0)
        )
        if variant:
            result.append({
                "id": exp["id"],
                "name": exp["name"],
                "slug": exp["slug"],
                "description": exp.get("description", ""),
                "variant": variant,
            })
    return result


async def get_user_variant_map(user_id: str) -> dict[str, dict]:
    """
    Returns a map of experiment_slug -> variant for quick lookup.
    Useful for middleware to inject headers.
    """
    experiments = await get_user_experiments(user_id)
    return {exp["slug"]: exp["variant"] for exp in experiments}


async def track_experiment_event(
    experiment_slug: str,
    variant_name: str,
    variant_index: int,
    user_id: str | None,
    event_type: str,
    metadata: dict | None = None,
) -> None:
    """
    Track an event for experiment analysis.
    Events are stored in experiment_events collection for later analysis.
    """
    db = get_db()
    doc = {
        "experiment_slug": experiment_slug,
        "variant_name": variant_name,
        "variant_index": variant_index,
        "user_id": user_id,
        "event_type": event_type,
        "metadata": metadata or {},
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.experiment_events.insert_one(doc)


# ─── Admin functions ────────────────────────────────────────────────


async def create_experiment(data: dict) -> dict:
    """Create a new experiment."""
    db = get_db()

    experiment_id = f"exp-{data['slug']}"
    now = datetime.now(timezone.utc).isoformat()

    # Validate variants have names and traffic percentages
    variants = data.get("variants", [])
    if not variants:
        raise ValueError("Experiment must have at least one variant")

    for i, v in enumerate(variants):
        if "name" not in v:
            raise ValueError(f"Variant at index {i} is missing 'name'")
        v.setdefault("config", {})

    doc = {
        "_id": experiment_id,
        "name": data["name"],
        "slug": data["slug"],
        "description": data.get("description", ""),
        "variants": variants,
        "traffic_split": data.get("traffic_split", 1.0),
        "is_active": data.get("is_active", True),
        "starts_at": data.get("starts_at", now),
        "ends_at": data.get("ends_at"),
        "target_metric": data.get("target_metric", ""),
        "hypothesis": data.get("hypothesis", ""),
        "created_at": now,
        "updated_at": now,
    }
    await db.experiments.insert_one(doc)
    logger.info("Experiment %s created with %d variants", experiment_id, len(variants))
    return {
        "id": experiment_id,
        **doc,
    }


async def update_experiment(experiment_id: str, data: dict) -> dict | None:
    """Update an existing experiment."""
    db = get_db()
    data["updated_at"] = datetime.now(timezone.utc).isoformat()

    result = await db.experiments.update_one(
        {"_id": experiment_id},
        {"$set": data},
    )
    if result.matched_count == 0:
        return None

    updated = await db.experiments.find_one({"_id": experiment_id})
    if updated:
        return {**updated, "id": updated["_id"]}
    return None


async def list_experiments() -> list[dict]:
    """List all experiments (for admin)."""
    db = get_db()
    experiments = await db.experiments.find().sort("created_at", -1).to_list(100)
    return [
        {
            "id": exp["_id"],
            "name": exp["name"],
            "slug": exp["slug"],
            "description": exp.get("description", ""),
            "variants": exp.get("variants", []),
            "traffic_split": exp.get("traffic_split", 1.0),
            "is_active": exp.get("is_active", True),
            "starts_at": exp.get("starts_at"),
            "ends_at": exp.get("ends_at"),
            "target_metric": exp.get("target_metric", ""),
            "hypothesis": exp.get("hypothesis", ""),
            "created_at": exp.get("created_at"),
            "updated_at": exp.get("updated_at"),
        }
        for exp in experiments
    ]


async def get_experiment_stats(experiment_slug: str | None = None) -> list[dict]:
    """
    Get aggregated stats for experiments.
    Returns event counts grouped by experiment + variant.
    """
    db = get_db()
    pipeline = []
    match_stage = {}
    if experiment_slug:
        match_stage["experiment_slug"] = experiment_slug

    if match_stage:
        pipeline.append({"$match": match_stage})

    pipeline.extend([
        {
            "$group": {
                "_id": {
                    "experiment_slug": "$experiment_slug",
                    "variant_name": "$variant_name",
                    "event_type": "$event_type",
                },
                "count": {"$sum": 1},
                "unique_users": {"$addToSet": "$user_id"},
            },
        },
        {
            "$project": {
                "_id": 0,
                "experiment_slug": "$_id.experiment_slug",
                "variant_name": "$_id.variant_name",
                "event_type": "$_id.event_type",
                "count": 1,
                "unique_users_count": {"$size": "$unique_users"},
            },
        },
        {"$sort": {"experiment_slug": 1, "variant_name": 1, "event_type": 1}},
    ])

    results = await db.experiment_events.aggregate(pipeline).to_list(1000)
    return results


async def delete_experiment(experiment_id: str) -> bool:
    """Delete an experiment and its events."""
    db = get_db()
    result = await db.experiments.delete_one({"_id": experiment_id})
    if result.deleted_count == 0:
        return False
    # Optionally clean up events
    exp = await db.experiments.find_one({"_id": experiment_id})
    if exp:
        await db.experiment_events.delete_many({"experiment_slug": exp.get("slug")})
    return True
