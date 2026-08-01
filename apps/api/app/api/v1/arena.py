"""Arena — competitive rating engine, battles, leaderboards, match history.

Separates RATING (competitive skill) from XP (effort).
Real data only. Empty collections render honest empty states.

Collections:
  arena_players  { user_id, rating, rank, provisional, matches, wins, losses,
                   season_points, peak_rating, updated_at }
  arena_battles  { _id, mode, topic, status (lobby|live|completed),
                   challenge_id, participants[{user_id, user_name, rating_before,
                   rating_after, score, time_seconds, correct}],
                   winner_id, created_at, completed_at, summary }
"""

import logging
from datetime import datetime, timedelta, timezone
from typing import Any, Optional

from fastapi import APIRouter, Depends, Query

from app.core.deps import get_current_user, get_optional_user
from app.core.response import api_response
from app.db.mongodb import get_read_db

logger = logging.getLogger(__name__)
router = APIRouter()

# ── Rating ladder ──────────────────────────────────────────────
RANKS = [
    ("Bronze", 0), ("Silver", 900), ("Gold", 1100), ("Platinum", 1300),
    ("Diamond", 1500), ("Master", 1700), ("Grandmaster", 1900),
    ("Legend", 2100), ("Mythic", 2300), ("Immortal", 2600),
]

def rank_for(rating: int) -> str:
    name = "Bronze"
    for r, floor in RANKS:
        if rating >= floor:
            name = r
    return name

def _expected(rating: int, other: int) -> float:
    return 1.0 / (1.0 + 10 ** ((other - rating) / 400))

def _new_rating(rating: int, other: int, won: bool, provisional: bool) -> int:
    k = 64 if provisional else 32
    score = 1.0 if won else 0.0
    return round(rating + k * (score - _expected(rating, other)))

def _now():
    return datetime.now(timezone.utc)

def _iso(dt) -> Optional[str]:
    return dt.isoformat() if dt else None

def _since(period: str) -> Optional[datetime]:
    now = _now()
    if period == "week":
        return now - timedelta(days=7)
    if period == "month":
        return now - timedelta(days=30)
    return None

# ── Players ────────────────────────────────────────────────────
async def _get_player(db, user_id: str) -> dict:
    p = await db.arena_players.find_one({"user_id": user_id})
    if not p:
        p = {
            "user_id": user_id, "rating": 1000, "rank": "Bronze", "provisional": True,
            "matches": 0, "wins": 0, "losses": 0, "season_points": 0,
            "peak_rating": 1000, "updated_at": None,
        }
    return p

async def _save_player(db, p: dict) -> None:
    p["rank"] = rank_for(p["rating"])
    p["peak_rating"] = max(p["peak_rating"], p["rating"])
    await db.arena_players.update_one({"user_id": p["user_id"]}, {"$set": p}, upsert=True)

# ── Grading ────────────────────────────────────────────────────
async def _grade(db, challenge_id: str, answer: Any) -> Optional[dict]:
    ch = await db.challenges.find_one({"_id": challenge_id})
    if not ch:
        return None
    content = ch.get("content", {})
    if isinstance(content.get("correct"), int):
        ok = answer == content["correct"]
    elif content.get("expected_answer"):
        ok = str(answer).strip().lower() == str(content["expected_answer"]).strip().lower()
    else:
        ok = bool(answer)
    return {"correct": ok, "challenge_title": ch.get("title", "Challenge")}

# ── User identity helpers ──────────────────────────────────────
async def _user_meta(db, user_id: str) -> dict:
    u = await db.users.find_one({"_id": user_id}, {"name": 1, "country": 1, "company": 1, "university": 1})
    if not u:
        return {}
    return {
        "user_name": u.get("name", "Anonymous"),
        "country": u.get("country"),
        "company": u.get("company"),
        "university": u.get("university"),
    }

async def _enrich(db, players: list[dict]) -> list[dict]:
    out = []
    for p in players:
        meta = await _user_meta(db, p["user_id"])
        out.append({**p, **meta})
    return out

# ── Endpoints ──────────────────────────────────────────────────
@router.get("/me")
async def arena_me(user: dict = Depends(get_current_user)):
    db = get_read_db()
    me = await _get_player(db, user["id"])
    meta = await _user_meta(db, user["id"])
    return api_response({"me": {**me, **meta}})

@router.get("/leaderboard")
async def arena_leaderboard(
    scope: str = Query("global", pattern="^(global|country|company|university)$"),
    period: str = Query("all", pattern="^(week|month|all)$"),
    limit: int = Query(50, ge=1, le=200),
    user: Optional[dict] = Depends(get_optional_user),
):
    db = get_read_db()

    # Scope filter: only arena players belonging to the scope group
    match: dict[str, Any] = {}
    if scope != "global":
        field = {"country": "country", "company": "company", "university": "university"}[scope]
        users = await db.users.find(
            {field: {"$exists": True, "$nin": [None, ""]}}, {"_id": 1}
        ).to_list(10000)
        ids = [u["_id"] for u in users]
        if not ids:
            return api_response({"scope": scope, "period": period, "players": []})
        match["user_id"] = {"$in": ids}

    if period in ("week", "month"):
        since = _since(period)
        pipeline = [
            {"$match": {"status": "completed", "completed_at": {"$gte": since.isoformat()}}},
            {"$unwind": "$participants"},
            {"$group": {"_id": "$participants.user_id", "points": {"$sum": "$participants.season_points"}}},
            {"$sort": {"points": -1}},
            {"$limit": limit},
        ]
        try:
            rows = await db.arena_battles.aggregate(pipeline).to_list(limit)
        except Exception as exc:
            logger.warning("Arena leaderboard period failed: %s", exc)
            rows = []
        players = []
        for r in rows:
            p = await _get_player(db, r["_id"])
            players.append({**p, "season_points": r["points"]})
    else:
        try:
            docs = await db.arena_players.find(match).sort("rating", -1).limit(limit).to_list(limit)
        except Exception as exc:
            logger.warning("Arena leaderboard all failed: %s", exc)
            docs = []
        players = [{**d} for d in docs]

    players = await _enrich(db, players)
    my_id = user.get("id") if user else None
    my_rank = next((i + 1 for i, p in enumerate(players) if p["user_id"] == my_id), None)
    return api_response({
        "scope": scope, "period": period, "players": players, "my_rank": my_rank,
    })

@router.get("/live")
async def arena_live(limit: int = Query(10, ge=1, le=30)):
    db = get_read_db()
    try:
        docs = await db.arena_battles.find(
            {"status": {"$in": ["lobby", "live"]}}
        ).sort("created_at", -1).limit(limit).to_list(limit)
    except Exception as exc:
        logger.warning("Arena live failed: %s", exc)
        docs = []
    out = []
    for d in docs:
        out.append({
            "id": d["_id"], "mode": d.get("mode", "Arena Battle"), "topic": d.get("topic"), "status": d["status"],
            "participants": d.get("participants", []), "created_at": d.get("created_at"),
        })
    return api_response({"battles": out})

@router.post("/battles")
async def create_battle(
    body: dict,
    user: dict = Depends(get_current_user),
):
    """Create a battle. Body: {topic, challenge_id, mode?}"""
    db = get_read_db()
    topic = (body.get("topic") or "Arena Battle").strip()
    challenge_id = body.get("challenge_id")
    if not challenge_id:
        return api_response({"error": "challenge_id is required"}, status_code=400)
    me = await _get_player(db, user["id"])
    meta = await _user_meta(db, user["id"])
    battle = {
        "mode": body.get("mode", "Arena Battle"), "topic": topic,
        "status": "lobby", "challenge_id": challenge_id,
        "participants": [{
            "user_id": user["id"], "user_name": meta.get("user_name", "Anonymous"),
            "rating_before": me["rating"], "rating_after": None, "score": None,
            "time_seconds": None, "correct": None, "submitted": False,
        }],
        "winner_id": None, "created_at": _iso(_now()), "completed_at": None,
    }
    res = await db.arena_battles.insert_one(battle)
    return api_response({"battle_id": str(res.inserted_id), "status": "lobby"})

@router.post("/battles/{battle_id}/join")
async def join_battle(battle_id: str, user: dict = Depends(get_current_user)):
    db = get_read_db()
    battle = await db.arena_battles.find_one({"_id": battle_id})
    if not battle:
        return api_response({"error": "Battle not found"}, status_code=404)
    if battle["status"] != "lobby":
        return api_response({"error": "Battle already started"}, status_code=400)
    if len(battle["participants"]) >= 2:
        return api_response({"error": "Battle is full"}, status_code=400)
    if any(p["user_id"] == user["id"] for p in battle["participants"]):
        return api_response({"error": "Already joined"}, status_code=400)
    me = await _get_player(db, user["id"])
    meta = await _user_meta(db, user["id"])
    battle["participants"].append({
        "user_id": user["id"], "user_name": meta.get("user_name", "Anonymous"),
        "rating_before": me["rating"], "rating_after": None, "score": None,
        "time_seconds": None, "correct": None, "submitted": False,
    })
    battle["status"] = "live" if len(battle["participants"]) == 2 else "lobby"
    await db.arena_battles.update_one({"_id": battle_id}, {"$set": {
        "participants": battle["participants"], "status": battle["status"],
    }})
    return api_response({"battle_id": battle_id, "status": battle["status"], "participants": battle["participants"]})

@router.post("/battles/{battle_id}/submit")
async def submit_battle(
    battle_id: str,
    body: dict,
    user: dict = Depends(get_current_user),
):
    """Submit an answer. Body: {answer, time_seconds?}"""
    db = get_read_db()
    battle = await db.arena_battles.find_one({"_id": battle_id})
    if not battle:
        return api_response({"error": "Battle not found"}, status_code=404)
    part = next((p for p in battle["participants"] if p["user_id"] == user["id"]), None)
    if not part or part.get("submitted"):
        return api_response({"error": "Already submitted"}, status_code=400)

    grade = await _grade(db, battle["challenge_id"], body.get("answer"))
    if grade is None:
        return api_response({"error": "Challenge unavailable"}, status_code=404)

    part["score"] = 1 if grade["correct"] else 0
    part["correct"] = grade["correct"]
    part["time_seconds"] = body.get("time_seconds")
    part["submitted"] = True

    all_done = all(p.get("submitted") for p in battle["participants"])
    if all_done and len(battle["participants"]) == 2:
        a, b = battle["participants"]
        a_time = a.get("time_seconds") or 999999
        b_time = b.get("time_seconds") or 999999
        a_won = a["score"] > b["score"] or (a["score"] == b["score"] and a_time < b_time)
        pa = await _get_player(db, a["user_id"])
        pb = await _get_player(db, b["user_id"])
        a["rating_after"] = _new_rating(pa["rating"], pb["rating"], a_won, pa["provisional"])
        b["rating_after"] = _new_rating(pb["rating"], pa["rating"], not a_won, pb["provisional"])
        a["rating_delta"] = a["rating_after"] - pa["rating"]
        b["rating_delta"] = b["rating_after"] - pb["rating"]
        a["season_points"] = max(0, a["rating_delta"])
        b["season_points"] = max(0, b["rating_delta"])
        winner = a if a_won else b
        battle["winner_id"] = winner["user_id"]
        battle["status"] = "completed"
        battle["completed_at"] = _iso(_now())
        battle["summary"] = {
            "winner": winner["user_name"], "winner_score": winner["score"],
            "loser": (b if not a_won else a)["user_name"],
            "loser_score": (b if not a_won else a)["score"],
            "text": f"{winner['user_name']} won {winner['score']}-{(b if not a_won else a)['score']}",
        }
        for p, pdoc in ((pa, a), (pb, b)):
            pdoc["matches"] += 1
            pdoc["wins"] += 1 if (pdoc is pa) == a_won else 0
            pdoc["losses"] += 0 if (pdoc is pa) == a_won else 1
            earned = a["season_points"] if pdoc is pa else b["season_points"]
            pdoc["season_points"] = pdoc.get("season_points", 0) + earned
            pdoc["provisional"] = pdoc["provisional"] and pdoc["matches"] < 20
            await _save_player(db, pdoc)
        await db.arena_battles.update_one({"_id": battle_id}, {"$set": battle})
    else:
        await db.arena_battles.update_one({"_id": battle_id}, {"$set": {"participants": battle["participants"]}})

    return api_response({
        "battle_id": battle_id, "correct": grade["correct"],
        "status": battle["status"],
        "challenge_title": grade["challenge_title"],
        "rating_after": part.get("rating_after"),
        "rating_delta": part.get("rating_delta"),
    })

@router.get("/matches")
async def my_matches(
    limit: int = Query(50, ge=1, le=100),
    user: dict = Depends(get_current_user),
):
    db = get_read_db()
    try:
        docs = await db.arena_battles.find(
            {"participants.user_id": user["id"], "status": "completed"}
        ).sort("completed_at", -1).limit(limit).to_list(limit)
    except Exception as exc:
        logger.warning("Arena matches failed: %s", exc)
        docs = []
    out = []
    for d in docs:
        part = next((p for p in d.get("participants", []) if p["user_id"] == user["id"]), None)
        if not part:
            continue
        out.append({
            "id": d["_id"], "topic": d.get("topic"), "mode": d.get("mode"),
            "created_at": d.get("completed_at"),
            "won": d.get("winner_id") == user["id"],
            "rating_delta": part.get("rating_delta"),
            "rating_after": part.get("rating_after"),
            "score": part.get("score"),
            "time_seconds": part.get("time_seconds"),
            "summary": d.get("summary"),
            "opponent": next((p for p in d.get("participants", []) if p["user_id"] != user["id"]), {}),
        })
    return api_response({"matches": out})

@router.get("/matches/{match_id}")
async def match_detail(match_id: str, user: dict = Depends(get_current_user)):
    db = get_read_db()
    d = await db.arena_battles.find_one({"_id": match_id})
    if not d or d["status"] != "completed":
        return api_response({"error": "Match not found"}, status_code=404)
    return api_response({
        "id": d["_id"], "topic": d.get("topic"), "mode": d.get("mode"),
        "created_at": d.get("completed_at"), "winner_id": d.get("winner_id"),
        "summary": d.get("summary"), "participants": d.get("participants", []),
    })

@router.get("/hall-of-fame")
async def hall_of_fame(user: Optional[dict] = Depends(get_optional_user)):
    db = get_read_db()
    try:
        top = await db.arena_players.find({}).sort("rating", -1).limit(5).to_list(5)
        top = await _enrich(db, top)
    except Exception:
        top = []
    try:
        pipeline = [
            {"$match": {"status": "completed", "participants.time_seconds": {"$ne": None}}},
            {"$unwind": "$participants"},
            {"$match": {"participants.time_seconds": {"$ne": None}}},
            {"$sort": {"participants.time_seconds": 1}},
            {"$limit": 5},
        ]
        fast = await db.arena_battles.aggregate(pipeline).to_list(5)
        fast = [{"user_id": f["participants"]["user_id"], "user_name": f["participants"]["user_name"],
                 "time_seconds": f["participants"]["time_seconds"], "topic": f.get("topic")} for f in fast]
    except Exception as exc:
        logger.warning("Hall of fame fast failed: %s", exc)
        fast = []
    return api_response({"top_players": top, "fastest_solves": fast})

@router.get("/stats")
async def arena_stats():
    db = get_read_db()
    since = (_now() - timedelta(hours=24)).isoformat()
    async def count(col, match=None):
        try:
            return await db[col].count_documents(match or {})
        except Exception:
            return 0
    return api_response({
        "battles_today": await count("arena_battles", {"created_at": {"$gte": since}}),
        "players_total": await count("arena_players"),
        "matches_total": await count("arena_battles", {"status": "completed"}),
        "live_battles": await count("arena_battles", {"status": "live"}),
    })