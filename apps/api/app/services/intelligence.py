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
"""

import logging
from datetime import datetime, timedelta, timezone
from typing import Any

from app.db.mongodb import get_read_db

logger = logging.getLogger(__name__)


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _days_ago_iso(days: int) -> str:
    return (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()


def _safe(col, attr: str, default):
    """Call a collection method, defaulting gracefully on in-memory gaps."""
    try:
        return getattr(col, attr)(*default) if not isinstance(default, tuple) else getattr(col, attr)(*default[1:])
    except Exception:
        return default[0] if isinstance(default, tuple) else default


async def _count_users_active(db, since_iso: str) -> int:
    """Unique users with activity events since a timestamp."""
    try:
        events = await db.activity_events.find({}).to_list(length=100000)
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
    total_users = await _count(db, "users")

    # Active users: DAU / WAU / MAU
    dau = await _count_users_active(db, _days_ago_iso(1))
    wau = await _count_users_active(db, _days_ago_iso(7))
    mau = await _count_users_active(db, _days_ago_iso(30))

    # Completion + challenge success
    attempts = await _safe_find(db, "challenge_attempts")
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
        events = await db.activity_events.find({}).to_list(length=200000)
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
        creator_profiles = await db.creator_profiles.find({}).to_list(length=100000)
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
        sent = await db.notifications.count_documents({})
        read = await db.notifications.count_documents({"is_read": True})
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
    challenges = await _safe_find(db, "challenges")
    attempts = await _safe_find(db, "challenge_attempts")
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
    profiles = await _safe_find(db, "creator_profiles")
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
        sent = await db.notifications.count_documents({})
        read = await db.notifications.count_documents({"is_read": True})
        if sent > 20 and read / sent < 0.1:
            recs.append({
                "severity": "info", "kind": "notifications-ignored", "entity_id": None,
                "message": f"Notifications are read by only {round(read / sent * 100)}% of recipients.",
            })
    except Exception:
        pass

    # Moderation backlog
    try:
        pending = await db.moderation_reports.count_documents({"status": "pending"})
        if pending >= 5:
            recs.append({
                "severity": "warning", "kind": "moderation-backlog", "entity_id": None,
                "message": f"{pending} reports are pending moderation review.",
            })
    except Exception:
        pass

    recs.sort(key=lambda r: {"critical": 0, "warning": 1, "info": 2}[r["severity"]])
    return recs


async def overview() -> dict:
    """Aggregated admin intelligence view: health + urgent problems + trends."""
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