"""Platform Intelligence — the platform observes itself.

Reuses existing collections (activity_events, challenge_attempts, notifications,
creator_profiles, discussions, arena_players) — no duplicated data, no new
infrastructure. Compatible with the in-memory test DB: no `aggregate()`, no
multi-stage pipelines. Computations run in Python over bounded result sets.

Outputs:
  - Platform health KPIs (DAU/WAU/MAU, retention, completion, success rate,
    creator growth, competition participation, notification CTR)
  - Challenge / Creator / Community intelligence signals
  - Self-improvement recommendations (severity + entity refs)
  - `overview()` is snapshot-backed: the admin endpoint reads the latest
    `intelligence_snapshots` document (built by a worker/cron) instead of
    scanning 100k-200k activity docs on every request. Falls back to live
    computation when no snapshot exists yet.
"""

import logging
from datetime import datetime, timedelta, timezone

from app.core.collections import Collections as C
from app.db.mongodb import get_db, get_read_db

logger = logging.getLogger(__name__)


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _days_ago_iso(days: int) -> str:
    return (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()


async def _count_users_active(db, since_iso: str) -> int:
    """Unique users with activity events since a timestamp."""
    try:
        events = await db[C.ACTIVITY_EVENTS].find({}).to_list(length=100000)
    except Exception:
        return 0
    users = {e.get("user_id") for e in events if e.get("created_at", "") >= since_iso and e.get("user_id")}
    return len(users)


async def _count(db, col_name: str, query: dict | None = None) -> int:
    try:
        return await db[col_name].count_documents(query or {})
    except Exception:
        return 0


async def platform_health(days: int = 30) -> dict:
    """Core health KPIs for the platform."""
    db = get_read_db()
    total_users = await _count(db, C.USERS)

    # Active users: DAU / WAU / MAU
    dau = await _count_users_active(db, _days_ago_iso(1))
    wau = await _count_users_active(db, _days_ago_iso(7))
    mau = await _count_users_active(db, _days_ago_iso(30))

    # Completion + challenge success
    attempts = await _safe_find(db, C.CHALLENGE_ATTEMPTS)
    total_attempts = len(attempts)
    correct_attempts = sum(1 for a in attempts if a.get("is_correct"))
    challenge_success_rate = round(correct_attempts / total_attempts, 3) if total_attempts else 0.0

    # Retention: users active today who were also active in prior 7 days
    retention = 0.0
    active_today = await _count_users_active(db, _days_ago_iso(1))
    active_prior = await _count_users_active(db, _days_ago_iso(8))
    if active_prior:
        retention = round(active_today / active_prior, 3)

    # Average session: mean spread of first→last activity per user on a worst-day
    avg_session_minutes = 0.0
    try:
        events = await db[C.ACTIVITY_EVENTS].find({}).to_list(length=200000)
        by_user: dict[str, list[str]] = {}
        for e in events:
            uid = e.get("user_id")
            ts = e.get("created_at", "")
            if uid and ts:
                by_user.setdefault(uid, []).append(ts)
        spans: list[float] = []
        for ts_list in by_user.values():
            if len(ts_list) >= 2:
                try:
                    first = min(ts_list)
                    last = max(ts_list)
                    span = (datetime.fromisoformat(last) - datetime.fromisoformat(first)).total_seconds() / 60.0
                    if span >= 0:
                        spans.append(span)
                except Exception:
                    continue
        avg_session_minutes = round(sum(spans) / len(spans), 1) if spans else 0.0
    except Exception:
        pass

    # Creator growth
    try:
        creator_profiles = await db[C.CREATOR_PROFILES].find({}).to_list(length=100000)
        total_creators = len(creator_profiles)
        new_creators = sum(1 for p in creator_profiles if p.get("created_at", "") >= _days_ago_iso(30))
    except Exception:
        total_creators = 0
        new_creators = 0

    # Competition participation (arena players with matches)
    try:
        arena_players = await db.arena_players.find({}).to_list(length=100000)
        competition_participants = sum(1 for p in arena_players if (p.get("matches", 0) or 0) > 0)
    except Exception:
        competition_participants = 0

    # Notification CTR: read / sent
    notification_ctr = 0.0
    try:
        sent = await db[C.NOTIFICATIONS].count_documents({})
        read = await db[C.NOTIFICATIONS].count_documents({"is_read": True})
        notification_ctr = round(read / sent, 3) if sent else 0.0
    except Exception:
        pass

    return {
        "users_total": total_users,
        "active_users": {"dau": dau, "wau": wau, "mau": mau},
        "retention": retention,
        "avg_session_minutes": avg_session_minutes,
        "challenge_attempts": total_attempts,
        "challenge_success_rate": challenge_success_rate,
        "creators": {"total": total_creators, "new_30d": new_creators},
        "competition_participants": competition_participants,
        "notification_ctr": notification_ctr,
        "generated_at": _now_iso(),
    }


async def _safe_find(db, col_name: str) -> list[dict]:
    try:
        return await db[col_name].find({}).to_list(length=200000)
    except Exception:
        return []


async def challenge_intelligence() -> list[dict]:
    """Signals about individual challenges."""
    db = get_read_db()
    challenges = await _safe_find(db, C.CHALLENGES)
    attempts = await _safe_find(db, C.CHALLENGE_ATTEMPTS)
    by_challenge: dict[str, list[dict]] = {}
    for a in attempts:
        by_challenge.setdefault(a.get("challenge_id"), []).append(a)

    out = []
    for ch in challenges:
        cid = ch.get("_id")
        ch_attempts = by_challenge.get(cid, [])
        n = len(ch_attempts)
        if n == 0:
            continue
        completions = sum(1 for a in ch_attempts if a.get("is_correct"))
        rate = completions / n
        avg_rating = ch.get("stats", {}).get("avg_rating", 0.0) or 0.0
        signals = []
        if n >= 5 and rate <= 0.2:
            signals.append("abandoned")
        if n >= 5 and rate <= 0.3:
            signals.append("hard")
        if n >= 5 and rate >= 0.9:
            signals.append("easy")
        if avg_rating and avg_rating < 2.5:
            signals.append("poor-quality")
        if n >= 20 and rate >= 0.6:
            signals.append("popular")
        out.append({
            "challenge_id": cid, "title": ch.get("title", ""),
            "attempts": n, "completion_rate": round(rate, 3),
            "avg_rating": avg_rating, "signals": signals,
        })
    out.sort(key=lambda x: x["attempts"], reverse=True)
    return out


async def creator_intelligence() -> list[dict]:
    """Creator signals: verification candidates, growth, inactivity, trust."""
    db = get_read_db()
    profiles = await _safe_find(db, C.CREATOR_PROFILES)
    out = []
    for p in profiles:
        followed_count = len(p.get("followers", []) or [])
        verification = (p.get("verification", {}) or {}).get("status", "unverified")
        trust = p.get("trust_score", 0.0) or 0.0
        signals = []
        if trust >= 50 and verification != "verified":
            signals.append("verify-candidate")
        if followed_count >= 5:
            signals.append("fast-growing")
        if (p.get("published_challenges", 0) or 0) == 0 and trust < 20:
            signals.append("inactive")
        if verification == "verified" and trust >= 70:
            signals.append("most-trusted")
        out.append({
            "user_id": p.get("user_id"), "level": p.get("level", "beginner"),
            "trust_score": trust, "followers": followed_count,
            "published_challenges": p.get("published_challenges", 0),
            "verification": verification, "signals": signals,
        })
    out.sort(key=lambda x: x["trust_score"], reverse=True)
    return out


async def self_recommendations() -> list[dict]:
    """Operational recommendations with severity + entity refs."""
    db = get_read_db()
    recs: list[dict] = []

    # Challenge quality
    for sig in await challenge_intelligence():
        if "abandoned" in sig["signals"]:
            recs.append({
                "severity": "critical", "kind": "challenge-abandoned",
                "entity_id": sig["challenge_id"],
                "message": f"This challenge has unusually high abandonment ({round(sig['completion_rate'] * 100)}% completion).",
            })
        if "poor-quality" in sig["signals"]:
            recs.append({
                "severity": "warning", "kind": "challenge-quality",
                "entity_id": sig["challenge_id"],
                "message": f"Challenge '{sig['title'][:40]}' is rated {sig['avg_rating']}/5 — review or improve.",
            })

    # Creator verification candidates
    for cr in await creator_intelligence():
        if "verify-candidate" in cr["signals"]:
            recs.append({
                "severity": "info", "kind": "creator-verify",
                "entity_id": cr["user_id"],
                "message": f"Creator {cr['user_id'][:12]} has trust {cr['trust_score']} but is unverified — deserves review.",
            })
        if "inactive" in cr["signals"]:
            recs.append({
                "severity": "warning", "kind": "creator-inactive",
                "entity_id": cr["user_id"],
                "message": f"Creator {cr['user_id'][:12]} is inactive with no published challenges.",
            })

    # Notification ignored
    try:
        sent = await db[C.NOTIFICATIONS].count_documents({})
        read = await db[C.NOTIFICATIONS].count_documents({"is_read": True})
        if sent > 20 and read / sent < 0.1:
            recs.append({
                "severity": "info", "kind": "notifications-ignored", "entity_id": None,
                "message": f"Notifications are read by only {round(read / sent * 100)}% of recipients.",
            })
    except Exception:
        pass

    # Moderation backlog
    try:
        pending = await db[C.MODERATION_REPORTS].count_documents({"status": "pending"})
        if pending >= 5:
            recs.append({
                "severity": "warning", "kind": "moderation-backlog", "entity_id": None,
                "message": f"{pending} reports are pending moderation review.",
            })
    except Exception:
        pass

    recs.sort(key=lambda r: {"critical": 0, "warning": 1, "info": 2}[r["severity"]])
    return recs


# ── Platform intelligence signals (moved from ecosystem) ─────────────────────

async def platform_intelligence() -> dict:
    """Automated signals: quality issues, trends, knowledge gaps, top creators."""
    db = get_read_db()
    now = _now_iso()
    week_ago = (datetime.now(timezone.utc) - timedelta(days=7)).isoformat()

    # 1. Low-quality challenges (published, low rating + low completion + high delete/removal)
    low_quality = await db[C.CHALLENGES].find({
        "status": "published",
        "$or": [
            {"quality_score": {"$lt": 0.4}},
            {"stats.avg_rating": {"$lt": 2.5}},
        ],
        "stats.attempts": {"$gte": 3},
    }).sort("quality_score", 1).to_list(length=10)
    low_quality = [{
        "challenge_id": c["_id"], "title": c.get("title", ""),
        "quality_score": c.get("quality_score", 0.0),
        "avg_rating": c.get("stats", {}).get("avg_rating", 0.0),
        "completion_rate": c.get("stats", {}).get("completion_rate", 0.0),
        "attempts": c.get("stats", {}).get("attempts", 0),
    } for c in low_quality]

    # 2. Outdated / stale content (published 90+ days, no updates, low recent activity)
    stale_since = (datetime.now(timezone.utc) - timedelta(days=90)).isoformat()
    stale = []
    stale_candidates = await db[C.CHALLENGES].find({"status": "published"}).sort("stats.attempts", -1).to_list(length=100)
    for c in stale_candidates:
        recent = await db[C.CHALLENGE_ATTEMPTS].count_documents({"challenge_id": c["_id"], "created_at": {"$gte": week_ago}})
        if recent == 0:
            stale.append({"challenge_id": c["_id"], "title": c.get("title", ""), "last_activity": "no_attempts_7d", "created_at": c.get("created_at", "")})
        if len(stale) >= 10:
            break

    # 3. Popular skills (most attempts in last 7 days)
    popular_attempts = await db[C.CHALLENGE_ATTEMPTS].find({}).to_list(length=5000)
    skill_counts: dict[str, int] = {}
    for att in popular_attempts:
        for sid in (att.get("skills_tested", []) or []):
            skill_counts[sid] = skill_counts.get(sid, 0) + 1
    popular = sorted(skill_counts.items(), key=lambda x: x[1], reverse=True)[:10]
    popular_skills = []
    for sid, count in popular:
        skill = await db[C.SKILLS].find_one({"_id": sid})
        popular_skills.append({
            "skill_id": sid,
            "name": skill.get("name", sid) if skill else sid,
            "category": skill.get("category", "") if skill else "",
            "attempts_7d": count,
        })

    # 4. Emerging technologies (skills with new challenges in last 14 days)
    emerging_since = (datetime.now(timezone.utc) - timedelta(days=14)).isoformat()
    emerging_skills = []
    skill_challenge_counts: dict[str, int] = {}
    new_challenges = await db[C.CHALLENGES].find({"status": "published"}).to_list(length=500)
    for ch in new_challenges:
        if ch.get("created_at", "") >= emerging_since:
            for sid in (ch.get("skills", []) or []):
                skill_challenge_counts[sid] = skill_challenge_counts.get(sid, 0) + 1
    for sid, count in sorted(skill_challenge_counts.items(), key=lambda x: x[1], reverse=True)[:10]:
        skill = await db[C.SKILLS].find_one({"_id": sid})
        emerging_skills.append({
            "skill_id": sid,
            "name": skill.get("name", sid) if skill else sid,
            "category": skill.get("category", "") if skill else "",
            "new_challenges_14d": count,
        })

    # 5. Knowledge gaps (skill with few challenges but high demand/attempts)
    gap_candidates = []
    for sid, count in popular[:20]:
        ch_count = await db[C.CHALLENGES].count_documents({"skills": sid, "status": "published"})
        if ch_count <= 3:
            skill = await db[C.SKILLS].find_one({"_id": sid})
            gap_candidates.append({
                "skill_id": sid,
                "name": skill.get("name", sid) if skill else sid,
                "category": skill.get("category", "") if skill else "",
                "attempts_7d": count,
                "challenges_available": ch_count,
            })
        if len(gap_candidates) >= 5:
            break

    # 6. Creator quality ranking
    top_creators = await db[C.CREATOR_PROFILES].find({}).sort([
        ("trust_score", -1), ("level_score", -1),
    ]).limit(5).to_list(length=5)
    creator_list = []
    for c in top_creators:
        u = await db[C.USERS].find_one({"_id": c.get("user_id")})
        creator_list.append({
            "user_id": c.get("user_id"), "user_name": u.get("name", "Anonymous") if u else "Anonymous",
            "trust_score": c.get("trust_score", 0.0), "level": c.get("level", "beginner"),
            "published_challenges": c.get("published_challenges", 0),
        })

    return {
        "generated_at": now,
        "low_quality": low_quality,
        "stale_content": stale,
        "popular_skills": popular_skills,
        "emerging_skills": emerging_skills,
        "knowledge_gaps": gap_candidates,
        "top_creators": creator_list,
        "summary": {
            "low_quality_count": len(low_quality),
            "stale_count": len(stale),
            "popular_skills_count": len(popular_skills),
            "emerging_skills_count": len(emerging_skills),
            "knowledge_gaps_count": len(gap_candidates),
        },
    }


# ── Snapshot-backed overview (NV5) ────────────────────────────────────────────

SNAPSHOT_TYPE_OVERVIEW = "overview"
SNAPSHOT_TTL_DAYS = 30


async def _compute_overview() -> dict:
    """Live aggregation: health + urgent problems + trends (bounded queries)."""
    health = await platform_health()
    recommendations = await self_recommendations()
    urgent = [r for r in recommendations if r["severity"] == "critical"]
    growth = [r for r in recommendations if r["severity"] == "info"]
    return {
        "health": health,
        "recommendations": recommendations,
        "urgent_problems": urgent,
        "growth_opportunities": growth,
        "generated_at": _now_iso(),
    }


async def build_intelligence_snapshot() -> dict:
    """Compute the overview once and persist it for cheap request-time reads.

    Writes ``{type: "overview", generated_at, expire_at, data}`` into
    ``intelligence_snapshots`` (TTL 30 days). Returns the persisted data so a
    cron/worker can confirm success. Safe to call repeatedly — each run
    appends a fresh snapshot (reads always pick the newest).
    """
    data = await _compute_overview()
    db = get_db()
    now = _now_iso()
    expire_at = datetime.now(timezone.utc) + timedelta(days=SNAPSHOT_TTL_DAYS)
    await db[C.INTELLIGENCE_SNAPSHOTS].insert_one({
        "_id": f"snap-overview-{int(datetime.now(timezone.utc).timestamp() * 1000)}",
        "type": SNAPSHOT_TYPE_OVERVIEW,
        "generated_at": now,
        "expire_at": expire_at,
        "data": data,
    })
    try:
        from app.core.telemetry import INTELLIGENCE_SNAPSHOT_RUNS
        INTELLIGENCE_SNAPSHOT_RUNS.labels(status="success").inc()
    except Exception:
        pass
    return data


async def get_latest_snapshot(snapshot_type: str = SNAPSHOT_TYPE_OVERVIEW) -> dict | None:
    """Return the newest snapshot doc for a type, or None (portable sort-free read)."""
    db = get_read_db()
    try:
        snaps = await db[C.INTELLIGENCE_SNAPSHOTS].find({"type": snapshot_type}).to_list(length=100)
    except Exception:
        return None
    if not snaps:
        return None
    return max(snaps, key=lambda s: s.get("generated_at", ""))


async def overview() -> dict:
    """Aggregated admin intelligence view, snapshot-backed with live fallback.

    Reads the newest ``overview`` snapshot (cheap, no 100k+ doc scans on the
    request path). When no snapshot exists yet (worker/cron hasn't run),
    falls back to live computation — preserving the previous behavior.
    """
    snap = await get_latest_snapshot(SNAPSHOT_TYPE_OVERVIEW)
    if snap and snap.get("data"):
        return {
            **snap["data"],
            "source": "snapshot",
            "snapshot_generated_at": snap.get("generated_at"),
        }
    try:
        from app.core.telemetry import INTELLIGENCE_SNAPSHOT_RUNS
        INTELLIGENCE_SNAPSHOT_RUNS.labels(status="live_fallback").inc()
    except Exception:
        pass
    return await _compute_overview()
