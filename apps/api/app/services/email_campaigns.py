import logging
from datetime import datetime, timezone, timedelta
from app.core.config import settings
from app.core.tasks import send_email_task

logger = logging.getLogger(__name__)

CAMPAIGN_TYPES = {
    "signup_no_trial": "signup_no_trial",
    "trial_50pct": "trial_50pct",
    "trial_ending": "trial_ending",
    "inactive_7d": "inactive_7d",
    "streak_2": "streak_2",
    "renewal_30d": "renewal_30d",
    "course_not_started_14d": "course_not_started_14d",
}


async def _already_sent(db, user_id: str, campaign_type: str, ref_id: str | None = None) -> bool:
    query = {"user_id": user_id, "campaign_type": campaign_type}
    if ref_id:
        query["ref_id"] = ref_id
    existing = await db.email_campaigns.find_one(query)
    return existing is not None


async def _mark_sent(db, user_id: str, campaign_type: str, ref_id: str | None = None, metadata: dict | None = None):
    doc = {
        "user_id": user_id,
        "campaign_type": campaign_type,
        "sent_at": datetime.now(timezone.utc).isoformat(),
        "ref_id": ref_id or "",
        "metadata": metadata or {},
    }
    await db.email_campaigns.insert_one(doc)


async def check_signup_no_trial(ctx: dict, db) -> int:
    sent = 0
    now = datetime.now(timezone.utc)
    cutoff = (now - timedelta(hours=24)).isoformat()
    users = await db.users.find({
        "created_at": {"$lte": now.isoformat(), "$gte": cutoff},
        "trial_started_at": None,
    }).to_list(500)
    for user in users:
        uid = user["_id"]
        if await _already_sent(db, uid, "signup_no_trial"):
            continue
        email = user.get("email")
        if not email:
            continue
        subject = "Don't hesitate — try 10% of any course free"
        body = (
            f"Hi {user.get('display_name', 'there')},\n\n"
            f"You signed up for Ascendly but haven't started a trial yet. "
            f"You can preview 10% of any course for free — no commitment.\n\n"
            f"Start here: {settings.frontend_url}/courses\n\n"
            f"The Ascendly Team"
        )
        await send_email_task(ctx, email, subject, body)
        await _mark_sent(db, uid, "signup_no_trial")
        sent += 1
    return sent


async def check_trial_50pct(ctx: dict, db) -> int:
    sent = 0
    now = datetime.now(timezone.utc)
    all_trials = await db.subscriptions.find({
        "status": "trial",
        "trial_started_at": {"$exists": True},
    }).to_list(500)
    for sub in all_trials:
        uid = sub.get("user_id")
        if await _already_sent(db, uid, "trial_50pct"):
            continue
        trial_start = sub.get("trial_started_at")
        trial_end = sub.get("trial_ends_at")
        if not trial_start or not trial_end:
            continue
        try:
            start_dt = datetime.fromisoformat(trial_start)
            end_dt = datetime.fromisoformat(trial_end)
        except Exception:
            continue
        total = (end_dt - start_dt).total_seconds()
        elapsed = (now - start_dt).total_seconds()
        if total <= 0:
            continue
        pct = elapsed / total
        if 0.45 <= pct <= 0.55:
            user = await db.users.find_one({"_id": uid})
            if not user or not user.get("email"):
                continue
            subject = "You've seen 50% — keep going!"
            body = (
                f"Hi {user.get('display_name', 'there')},\n\n"
                f"You're halfway through your trial and you've seen what Ascendly offers. "
                f"Subscribe now to keep your progress and unlock the full course.\n\n"
                f"{settings.frontend_url}/pricing\n\n"
                f"The Ascendly Team"
            )
            await send_email_task(ctx, user["email"], subject, body)
            await _mark_sent(db, uid, "trial_50pct")
            sent += 1
    return sent


async def check_trial_ending(ctx: dict, db) -> int:
    sent = 0
    now = datetime.now(timezone.utc)
    upcoming_end = (now + timedelta(hours=12)).isoformat()
    ending_trials = await db.subscriptions.find({
        "status": "trial",
        "trial_ends_at": {"$lte": upcoming_end, "$gte": now.isoformat()},
    }).to_list(500)
    for sub in ending_trials:
        uid = sub.get("user_id")
        if await _already_sent(db, uid, "trial_ending"):
            continue
        user = await db.users.find_one({"_id": uid})
        if not user or not user.get("email"):
            continue
        subject = "Your trial ends today — subscribe to keep your progress"
        body = (
            f"Hi {user.get('display_name', 'there')},\n\n"
            f"Your Ascendly trial ends in less than 12 hours. "
            f"Subscribe now to keep your progress and access all 2000+ courses.\n\n"
            f"{settings.frontend_url}/pricing\n\n"
            f"The Ascendly Team"
        )
        await send_email_task(ctx, user["email"], subject, body)
        await _mark_sent(db, uid, "trial_ending")
        sent += 1
    return sent


async def check_inactive_7d(ctx: dict, db) -> int:
    sent = 0
    now = datetime.now(timezone.utc)
    seven_days_ago = (now - timedelta(days=7)).isoformat()
    active_subs = await db.subscriptions.find({
        "status": "active",
    }).to_list(2000)
    for sub in active_subs:
        uid = sub.get("user_id")
        if await _already_sent(db, uid, "inactive_7d"):
            continue
        last_progress = await db.progress.find_one(
            {"user_id": uid},
            sort=[("updated_at", -1)],
        )
        if last_progress and (last_progress.get("updated_at") or "") >= seven_days_ago:
            continue
        user = await db.users.find_one({"_id": uid})
        if not user or not user.get("email"):
            continue
        subject = "7 days — don't let your membership go to waste"
        body = (
            f"Hi {user.get('display_name', 'there')},\n\n"
            f"It's been 7 days since you last studied. "
            f"Your membership is active — jump back in where you left off.\n\n"
            f"{settings.frontend_url}/learn\n\n"
            f"The Ascendly Team"
        )
        await send_email_task(ctx, user["email"], subject, body)
        await _mark_sent(db, uid, "inactive_7d")
        sent += 1
    return sent


async def check_streak_2(ctx: dict, db) -> int:
    sent = 0
    now = datetime.now(timezone.utc)
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0).isoformat()
    recent_learners = await db.progress.find({
        "completed": True,
        "updated_at": {"$gte": today_start},
    }).to_list(2000)
    user_days: dict[str, set] = {}
    all_progress = await db.progress.find({}).to_list(10000)
    for p in all_progress:
        uid = p.get("user_id")
        if not uid or not p.get("completed"):
            continue
        updated = p.get("updated_at", "")
        if updated:
            day = updated[:10]
            if uid not in user_days:
                user_days[uid] = set()
            user_days[uid].add(day)
    for p in recent_learners:
        uid = p.get("user_id")
        if not uid:
            continue
        if await _already_sent(db, uid, "streak_2"):
            continue
        days = user_days.get(uid, set())
        if len(days) >= 2:
            user = await db.users.find_one({"_id": uid})
            if not user or not user.get("email"):
                continue
            subject = "You're on a streak — keep it up!"
            body = (
                f"Hi {user.get('display_name', 'there')},\n\n"
                f"You've completed lessons on multiple days — that's real progress. "
                f"Keep the momentum going with your next lesson.\n\n"
                f"{settings.frontend_url}/learn\n\n"
                f"The Ascendly Team"
            )
            await send_email_task(ctx, user["email"], subject, body)
            await _mark_sent(db, uid, "streak_2")
            sent += 1
    return sent


async def check_renewal_30d(ctx: dict, db) -> int:
    sent = 0
    now = datetime.now(timezone.utc)
    target = (now + timedelta(days=30)).isoformat()
    renewing_subs = await db.subscriptions.find({
        "status": "active",
        "ends_at": {"$gte": now.isoformat(), "$lte": target},
    }).to_list(1000)
    for sub in renewing_subs:
        uid = sub.get("user_id")
        sub_id = sub.get("_id", "")
        if await _already_sent(db, uid, "renewal_30d", ref_id=sub_id):
            continue
        user = await db.users.find_one({"_id": uid})
        if not user or not user.get("email"):
            continue
        tier = sub.get("tier", "membership")
        subject = f"Your Ascendly {tier} plan renews soon"
        body = (
            f"Hi {user.get('display_name', 'there')},\n\n"
            f"Your {tier} plan will renew in about 30 days. "
            f"You don't need to do anything — your access will continue uninterrupted.\n\n"
            f"Manage your account: {settings.frontend_url}/account\n\n"
            f"The Ascendly Team"
        )
        await send_email_task(ctx, user["email"], subject, body)
        await _mark_sent(db, uid, "renewal_30d", ref_id=sub_id)
        sent += 1
    return sent


async def check_course_not_started_14d(ctx: dict, db) -> int:
    sent = 0
    now = datetime.now(timezone.utc)
    fourteen_days_ago = (now - timedelta(days=14)).isoformat()
    active_subs = await db.subscriptions.find({
        "status": "active",
        "starts_at": {"$lte": fourteen_days_ago},
    }).to_list(2000)
    for sub in active_subs:
        uid = sub.get("user_id")
        started_courses = await db.progress.distinct("course_id", {"user_id": uid})
        courses = await db.courses.find({
            "category_id": {"$exists": True},
        }).to_list(2000)
        for course in courses:
            cid = course["_id"]
            if cid in started_courses:
                continue
            if await _already_sent(db, uid, "course_not_started_14d", ref_id=cid):
                continue
            user = await db.users.find_one({"_id": uid})
            if not user or not user.get("email"):
                continue
            subject = f"Course '{course['title']}' is waiting for you"
            body = (
                f"Hi {user.get('display_name', 'there')},\n\n"
                f"'{course['title']}' is still waiting in your catalog. "
                f"Jump in — the first lesson takes just a few minutes.\n\n"
                f"{settings.frontend_url}/courses/{course['slug']}\n\n"
                f"The Ascendly Team"
            )
            await send_email_task(ctx, user["email"], subject, body)
            await _mark_sent(db, uid, "course_not_started_14d", ref_id=cid)
            sent += 1
    return sent


async def run_all_campaigns(ctx: dict) -> dict:
    from app.db.mongodb import get_db
    db = get_db()
    results = {}
    results["signup_no_trial"] = await check_signup_no_trial(ctx, db)
    results["trial_50pct"] = await check_trial_50pct(ctx, db)
    results["trial_ending"] = await check_trial_ending(ctx, db)
    results["inactive_7d"] = await check_inactive_7d(ctx, db)
    results["streak_2"] = await check_streak_2(ctx, db)
    results["renewal_30d"] = await check_renewal_30d(ctx, db)
    results["course_not_started_14d"] = await check_course_not_started_14d(ctx, db)
    total = sum(results.values())
    logger.info("Email campaigns run — total sent: %d (%s)", total, results)
    return {"total_sent": total, "breakdown": results}
