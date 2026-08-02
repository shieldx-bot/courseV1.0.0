"""Learning Marketplace services — collections, series, bundles + challenge versioning.

Extracted from the former `ecosystem` monolith (Phase 7 hardening) without any
behavioral change. `app/services/ecosystem.py` remains a facade re-exporting
this public API, so call sites never change.
"""

import logging
import re
from datetime import datetime, timezone
from typing import Any, Optional

from app.core.collections import Collections as C
from app.db.mongodb import get_db, get_read_db
from app.services.community import create_activity
from app.services.creator import get_or_create_creator_profile, refresh_achievements

logger = logging.getLogger(__name__)


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _ts() -> int:
    return int(datetime.now(timezone.utc).timestamp() * 1000)


def _slug(text: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")[:60]


async def create_collection(user_id: str, body: dict) -> dict:
    db = get_db()
    cid = f"col-{_slug(body.get('name', ''))}-{_ts()}" if body.get("name") else f"col-{_ts()}"
    doc = {
        "_id": cid,
        "name": body.get("name", "Untitled Collection"),
        "description": body.get("description", ""),
        "kind": body.get("kind", "collection"),  # collection | series | bundle | kit
        "creator_id": user_id,
        "challenge_ids": body.get("challenge_ids", []),
        "skill_ids": body.get("skill_ids", []),
        "tags": body.get("tags", []),
        "is_public": body.get("is_public", True),
        "is_premium": body.get("is_premium", False),
        "price_points": body.get("price_points", 0),
        "cover_emoji": body.get("cover_emoji", "📦"),
        "metadata": body.get("metadata", {}),
        "bookmark_count": 0,
        "created_at": _now(),
        "updated_at": _now(),
    }
    await db[C.COLLECTIONS].insert_one(doc)
    # Track on creator profile (series increments series count)
    profile = await get_or_create_creator_profile(user_id)
    kind = doc["kind"]
    if kind in ("series", "bundle"):
        await db[C.CREATOR_PROFILES].update_one({"_id": profile["_id"]}, {"$push": {"series": {"collection_id": cid, "name": doc["name"], "kind": kind, "created_at": _now()}}})
    else:
        await db[C.CREATOR_PROFILES].update_one({"_id": profile["_id"]}, {"$push": {"collections": {"collection_id": cid, "name": doc["name"], "created_at": _now()}}})
    await refresh_achievements(user_id)
    await create_activity(user_id, "collection_created", {"collection_id": cid, "name": doc["name"], "kind": kind})
    return {"collection_id": cid, "collection": doc}


async def list_collections(kind: Optional[str] = None, user_id: Optional[str] = None, public_only: bool = True, limit: int = 50) -> list[dict]:
    db = get_read_db()
    query: dict[str, Any] = {}
    if public_only:
        query["is_public"] = True
    if kind:
        query["kind"] = kind
    if user_id:
        query["creator_id"] = user_id
    docs = await db[C.COLLECTIONS].find(query).sort("created_at", -1).to_list(length=limit)
    users = await _load_users_batch(db, [d.get("creator_id") for d in docs])
    all_challenge_ids = []
    for d in docs:
        all_challenge_ids.extend((d.get("challenge_ids", []) or [])[:5])
    challenges = await _load_challenges_batch(db, all_challenge_ids)
    out = []
    for d in docs:
        creator = users.get(d.get("creator_id"))
        # Resolve challenge titles
        titles = []
        for cid in (d.get("challenge_ids", []) or [])[:5]:
            ch = challenges.get(cid)
            if ch:
                titles.append({"challenge_id": cid, "title": ch.get("title", ""), "difficulty": ch.get("difficulty", "medium")})
        out.append({
            "id": d["_id"], "name": d.get("name", ""), "description": d.get("description", ""),
            "kind": d.get("kind", "collection"), "creator_id": d.get("creator_id"),
            "creator_name": creator.get("name", "Anonymous") if creator else "Anonymous",
            "challenge_count": len(d.get("challenge_ids", []) or []),
            "challenge_preview": titles,
            "cover_emoji": d.get("cover_emoji", "📦"),
            "is_premium": d.get("is_premium", False),
            "bookmark_count": d.get("bookmark_count", 0),
            "created_at": d.get("created_at", ""),
        })
    return out


async def bookmark_collection(user_id: str, collection_id: str) -> dict:
    db = get_db()
    col = await db[C.COLLECTIONS].find_one({"_id": collection_id})
    if not col:
        return {"error": True, "message": "Collection not found."}
    doc_id = f"colbm-{user_id}-{collection_id}"
    existing = await db[C.COLLECTION_BOOKMARKS].find_one({"_id": doc_id})
    if existing:
        return {"success": True, "bookmarked": True}
    await db[C.COLLECTION_BOOKMARKS].insert_one({"_id": doc_id, "user_id": user_id, "collection_id": collection_id, "created_at": _now()})
    await db[C.COLLECTIONS].update_one({"_id": collection_id}, {"$inc": {"bookmark_count": 1}})
    return {"success": True, "bookmarked": True}


# ── Challenge versioning ──────────────────────────────────────────────────────

async def create_challenge_version(user_id: str, challenge_id: str, body: dict) -> dict:
    """Snapshot current challenge content, then apply updates."""
    db = get_db()
    challenge = await db[C.CHALLENGES].find_one({"_id": challenge_id})
    if not challenge:
        return {"error": True, "message": "Challenge not found."}
    if challenge.get("creator_id") != user_id:
        return {"error": True, "message": "Not authorized."}

    version_id = f"ver-{challenge_id}-{_ts()}"
    version_doc = {
        "_id": version_id,
        "challenge_id": challenge_id,
        "author_id": user_id,
        "snapshot": {k: v for k, v in challenge.items() if k not in ("_id",)},
        "change_note": body.get("change_note", ""),
        "major_version": body.get("major_version", False),
        "created_at": _now(),
    }
    await db[C.CHALLENGE_VERSIONS].insert_one(version_doc)

    # Store version history on challenge
    await db[C.CHALLENGES].update_one({"_id": challenge_id}, {"$push": {"version_history": {
        "version_id": version_id, "version": len(challenge.get("version_history", []) or []) + 1,
        "change_note": body.get("change_note", ""), "created_at": _now(),
    }}})
    return {"success": True, "version_id": version_id, "version": len(challenge.get("version_history", []) or []) + 1}


async def get_challenge_versions(challenge_id: str, limit: int = 20) -> list[dict]:
    db = get_read_db()
    docs = await db[C.CHALLENGE_VERSIONS].find({"challenge_id": challenge_id}).sort("created_at", -1).to_list(length=limit)
    return [{
        "version_id": d["_id"],
        "change_note": d.get("change_note", ""),
        "major_version": d.get("major_version", False),
        "created_at": d.get("created_at", ""),
        "challenge_title": d.get("snapshot", {}).get("title", ""),
    } for d in docs]


# ── Private helpers (batch loaders shared with creator/moderation) ───────────

async def _load_users_batch(db, user_ids: list) -> dict:
    from app.services.creator import _load_users_batch as _impl
    return await _impl(db, user_ids)


async def _load_challenges_batch(db, challenge_ids: list) -> dict:
    from app.services.creator import _load_challenges_batch as _impl
    return await _impl(db, challenge_ids)
