import logging
from datetime import datetime, timedelta, timezone
from typing import Any

from app.core.config import settings
from app.core.dlq import push_to_dlq
from app.core.telemetry import ADAPTIVE_MASTERY_DECAY_RUNS
from app.core.worker import MAX_RETRIES, exponential_backoff
from app.services.proactive_support import (
    BATCH_LIMIT,
    detect_checkout_drop_batch,
    detect_learning_stall_batch,
    detect_quiz_low_score_batch,
    detect_video_rewatch_batch,
    trigger_intervention,
)

logger = logging.getLogger(__name__)


async def send_email_task(ctx: dict, to: str, subject: str, body: str) -> dict:
    retry_count = ctx.get("job_try", 0)
    try:
        if not settings.smtp_host or not settings.smtp_user or not settings.smtp_password:
            logger.info("[DEV EMAIL] to=%s subject=%s", to, subject)
            return {"sent": True, "via": "dev"}

        import smtplib
        from email.mime.text import MIMEText
        from email.mime.multipart import MIMEMultipart

        msg = MIMEMultipart()
        msg["From"] = settings.from_email
        msg["To"] = to
        msg["Subject"] = subject
        msg.attach(MIMEText(body, "plain"))

        with smtplib.SMTP(settings.smtp_host, settings.smtp_port) as server:
            server.starttls()
            server.login(settings.smtp_user, settings.smtp_password)
            server.send_message(msg)

        logger.info("Email sent to=%s subject=%s", to, subject)
        return {"sent": True, "to": to, "subject": subject}
    except Exception as exc:
        if retry_count < MAX_RETRIES:
            delay = exponential_backoff(retry_count)
            logger.warning("Email send failed (try %d), retrying in %ds: %s", retry_count + 1, delay, exc)
        else:
            logger.error("Email send exhausted retries to=%s: %s", to, exc)
            redis = ctx.get("redis")
            if redis:
                await push_to_dlq(redis, "send_email_task", (to, subject, body), {}, str(exc), retry_count)
        raise


async def send_receipt_task(ctx: dict, to: str, tier: str, amount: float, currency: str, order_id: str, provider: str) -> dict:
    subject = f"Your Ascendly receipt — {order_id}"
    body = (
        f"Thanks for joining Ascendly.\n\n"
        f"Plan: {tier}\n"
        f"Amount: {amount} {currency}\n"
        f"Payment method: {provider}\n"
        f"Order ID: {order_id}\n\n"
        f"Start learning: {settings.frontend_url}/learn"
    )
    return await send_email_task(ctx, to, subject, body)


async def send_welcome_task(ctx: dict, to: str) -> dict:
    subject = "Welcome to Ascendly"
    body = f"Your membership is active. Start your first lesson today: {settings.frontend_url}/learn"
    return await send_email_task(ctx, to, subject, body)


async def send_renewal_reminder_task(ctx: dict, to: str, tier: str, renews_at: str, days_left: int) -> dict:
    subject = f"Your Ascendly membership renews in {days_left} days"
    body = (
        f"Hi,\n\n"
        f"Your {tier} plan renews on {renews_at}. "
        f"You don't need to do anything — your access will continue without interruption.\n\n"
        f"Manage your account: {settings.frontend_url}/account"
    )
    return await send_email_task(ctx, to, subject, body)


async def send_trial_started_task(ctx: dict, to: str, expires_at: str) -> dict:
    subject = "Your 3-day Ascendly preview is active"
    body = (
        f"You now have 3 days to preview 10% of any course.\n\n"
        f"Preview expires: {expires_at}\n"
        f"Start learning: {settings.frontend_url}/learn"
    )
    return await send_email_task(ctx, to, subject, body)


async def send_password_reset_task(ctx: dict, to: str, reset_url: str) -> dict:
    subject = "Reset your Ascendly password"
    body = (
        f"You requested a password reset. Click the link below to set a new password:\n\n"
        f"{reset_url}\n\n"
        f"This link expires in 15 minutes. If you did not request this, you can ignore this email."
    )
    return await send_email_task(ctx, to, subject, body)


async def index_search_task(ctx: dict, action: str, document: dict | None = None, document_id: str | None = None) -> dict:
    retry_count = ctx.get("job_try", 0)
    try:
        from app.services import search as search_service
        if action == "index" and document:
            search_service.index_course(document)
        elif action == "delete" and document_id:
            search_service.delete_course(document_id)
        else:
            raise ValueError(f"Unknown search action: {action}")
        return {"action": action, "document_id": document_id or (document.get("_id") if document else None)}
    except Exception as exc:
        if retry_count < MAX_RETRIES:
            delay = exponential_backoff(retry_count)
            logger.warning("Search index failed (try %d), retrying in %ds: %s", retry_count + 1, delay, exc)
        else:
            logger.error("Search index exhausted retries action=%s: %s", action, exc)
            redis = ctx.get("redis")
            if redis:
                await push_to_dlq(redis, "index_search_task", (action, document, document_id), {}, str(exc), retry_count)
        raise


async def run_analytics_task(ctx: dict) -> dict:
    retry_count = ctx.get("job_try", 0)
    try:
        from app.db.mongodb import get_db
        from app.services import ai
        db = get_db()
        users = await db.users.find().to_list(10000)
        progress = await db.progress.find().to_list(10000)
        subscriptions = await db.subscriptions.find().to_list(10000)
        courses = await db.courses.find().to_list(10000)
        orders = await db.orders.find().to_list(10000)

        metrics = ai.build_metrics(users, progress, subscriptions, courses, orders)
        llm = await ai.summarize_with_llm(metrics)

        doc = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "segment": metrics["segment"],
            "churn_risk_users": metrics["churn_risk_users"],
            "active_subscriptions": metrics["active_subscriptions"],
            "top_category": metrics["top_category"],
            "recent_30_day_revenue": metrics["recent_30_day_revenue"],
            "llm_summary": llm["summary"],
            "llm_source": llm["source"],
        }

        await db.analytics_cache.replace_one(
            {"_id": "latest"}, {"$set": doc}, upsert=True
        )
        return doc
    except Exception as exc:
        if retry_count < MAX_RETRIES:
            delay = exponential_backoff(retry_count)
            logger.warning("Analytics failed (try %d), retrying in %ds: %s", retry_count + 1, delay, exc)
        else:
            logger.error("Analytics exhausted retries: %s", exc)
            redis = ctx.get("redis")
            if redis:
                await push_to_dlq(redis, "run_analytics_task", (), {}, str(exc), retry_count)
        raise


async def send_batch_renewal_reminders_task(ctx: dict, days: int = 7) -> dict:
    retry_count = ctx.get("job_try", 0)
    try:
        from app.db.mongodb import get_db
        db = get_db()
        now = datetime.now(timezone.utc)
        from datetime import timedelta
        target = (now + timedelta(days=days)).isoformat()
        subs = await db.subscriptions.find({
            "status": "active",
            "ends_at": {"$gte": now.isoformat(), "$lte": target},
        }).to_list(1000)
        sent = 0
        for sub in subs:
            user = await db.users.find_one({"_id": sub["user_id"]})
            if user:
                await send_renewal_reminder_task(
                    ctx,
                    user["email"],
                    sub.get("tier", "membership"),
                    sub["ends_at"],
                    days,
                )
                sent += 1
        return {"sent": sent, "days": days}
    except Exception as exc:
        if retry_count < MAX_RETRIES:
            delay = exponential_backoff(retry_count)
            logger.warning("Batch renewal reminders failed (try %d), retrying in %ds: %s", retry_count + 1, delay, exc)
        else:
            logger.error("Batch renewal reminders exhausted retries: %s", exc)
            redis = ctx.get("redis")
            if redis:
                await push_to_dlq(redis, "send_batch_renewal_reminders_task", (days,), {}, str(exc), retry_count)
        raise


async def run_email_campaigns_task(ctx: dict) -> dict:
    retry_count = ctx.get("job_try", 0)
    try:
        from app.services.email_campaigns import run_all_campaigns
        result = await run_all_campaigns(ctx)
        logger.info("Email campaigns completed: %d sent", result["total_sent"])
        return result
    except Exception as exc:
        if retry_count < MAX_RETRIES:
            delay = exponential_backoff(retry_count)
            logger.warning("Email campaigns failed (try %d), retrying in %ds: %s", retry_count + 1, delay, exc)
        else:
            logger.error("Email campaigns exhausted retries: %s", exc)
            redis = ctx.get("redis")
            if redis:
                await push_to_dlq(redis, "run_email_campaigns_task", (), {}, str(exc), retry_count)
        raise


async def migrate_video_task(ctx: dict, lesson_id: str, drive_file_id: str, watermark_text: str | None = None) -> dict:
    retry_count = ctx.get("job_try", 0)
    try:
        from app.services.watermark import migrate_drive_to_r2
        r2_key = await migrate_drive_to_r2(lesson_id, drive_file_id, watermark_text)
        return {"lesson_id": lesson_id, "r2_key": r2_key}
    except Exception as exc:
        if retry_count < MAX_RETRIES:
            delay = exponential_backoff(retry_count)
            logger.warning("Video migration failed (try %d), retrying in %ds: %s", retry_count + 1, delay, exc)
        else:
            logger.error("Video migration exhausted retries lesson=%s: %s", lesson_id, exc)
            redis = ctx.get("redis")
            if redis:
                await push_to_dlq(redis, "migrate_video_task", (lesson_id, drive_file_id, watermark_text), {}, str(exc), retry_count)
        raise


async def run_mastery_decay(ctx: dict, batch_size: int = 50) -> dict:
    """Apply forgetting-curve decay for a bounded cohort of learners.

    Runs daily at 04:00 (avoids the 03:00 proactive-support window). Scans the
    most recently active users first (bounded batch) and decays any concept
    they haven't practiced in 7+ days via ``mastery_engine.apply_decay``.
    """
    retry_count = ctx.get("job_try", 0)
    try:
        from app.db.mongodb import get_db
        from app.services.mastery_engine import apply_decay

        db = get_db()

        recent_cutoff = (datetime.now(timezone.utc) - timedelta(days=7)).isoformat()
        recent_users = await db.users.find(
            {"last_active_at": {"$gte": recent_cutoff}}
        ).sort("last_active_at", -1).limit(batch_size).to_list(batch_size)
        user_ids = [u["_id"] for u in recent_users]

        if not user_ids:
            distinct = await db.concept_mastery.distinct("user_id")
            user_ids = distinct[:batch_size]

        courses_processed = 0
        concepts_decayed = 0
        decayed_by_user: dict[str, int] = {}
        for uid in user_ids:
            user_decayed = 0
            try:
                course_ids = await db.concept_mastery.distinct(
                    "course_id", {"user_id": uid}
                )
                for cid in course_ids:
                    result = await apply_decay(uid, cid)
                    courses_processed += 1
                    user_decayed += result.get("concepts_decayed", 0)
                concepts_decayed += user_decayed
                decayed_by_user[uid] = user_decayed
            except Exception as exc:  # one user must not fail the whole batch
                logger.warning("Mastery decay failed for user %s: %s", uid, exc)

        ADAPTIVE_MASTERY_DECAY_RUNS.labels(status="success").inc()
        logger.info(
            "Mastery decay: users=%d courses=%d concepts_decayed=%d",
            len(user_ids), courses_processed, concepts_decayed,
        )
        return {
            "users": len(user_ids),
            "courses_processed": courses_processed,
            "concepts_decayed": concepts_decayed,
            "by_user": decayed_by_user,
        }
    except Exception as exc:
        ADAPTIVE_MASTERY_DECAY_RUNS.labels(status="failed").inc()
        if retry_count < MAX_RETRIES:
            delay = exponential_backoff(retry_count)
            logger.warning("Mastery decay failed (try %d), retrying in %ds: %s", retry_count + 1, delay, exc)
        else:
            logger.error("Mastery decay exhausted retries: %s", exc)
            redis = ctx.get("redis")
            if redis:
                await push_to_dlq(redis, "run_mastery_decay", (), {}, str(exc), retry_count)
        raise


async def run_proactive_support_checks(ctx: dict) -> dict:
    """Run all four proactive detections over a bounded user cohort.

    Batch strategy (learned from the intelligence request-time report): scan
    ``user_behavior_events`` / users in small bounded groups (default 200
    users per run) instead of sweeping the whole database. Every detected
    signal goes through ``trigger_intervention``, which deduplicates per
    user+type within a 7-day window, so the cron can safely re-run.
    """
    retry_count = ctx.get("job_try", 0)
    try:
        from app.db.mongodb import get_db
        db = get_db()

        # Cohort: recently-active users first (bounded, sorted by recency).
        recent_cutoff = (datetime.now(timezone.utc) - timedelta(days=7)).isoformat()
        recent_users = await db.users.find(
            {"last_active_at": {"$gte": recent_cutoff}}
        ).sort("last_active_at", -1).limit(BATCH_LIMIT).to_list(BATCH_LIMIT)
        user_ids = [u["_id"] for u in recent_users]

        # Fallback: derive the cohort from recent behavior events.
        if not user_ids:
            events = await db.user_behavior_events.find().sort("created_at", -1).to_list(BATCH_LIMIT)
            user_ids = list(dict.fromkeys(e.get("user_id") for e in events if e.get("user_id")))[:BATCH_LIMIT]

        # Run all four detections (order: cheapest aggregations first).
        signals: list[dict[str, Any]] = []
        signals += await detect_learning_stall_batch(db, user_ids)
        signals += await detect_video_rewatch_batch(db, user_ids)
        signals += await detect_checkout_drop_batch(db, user_ids)
        signals += await detect_quiz_low_score_batch(db, user_ids)

        triggered = []
        for signal in signals:
            uid = signal.get("user_id")
            itype = signal.get("intervention_type")
            if not uid or not itype:
                continue
            context = {
                k: v for k, v in signal.items()
                if k not in ("user_id", "intervention_type", "message")
            }
            result = await trigger_intervention(
                uid,
                itype,
                context=context,
                message=signal.get("message"),
            )
            if result:
                triggered.append({"user_id": uid, "intervention_type": itype})

        by_type: dict[str, int] = {}
        for t in triggered:
            by_type[t["intervention_type"]] = by_type.get(t["intervention_type"], 0) + 1

        logger.info(
            "Proactive checks: checked=%d signals=%d triggered=%d by_type=%s",
            len(user_ids), len(signals), len(triggered), by_type,
        )
        return {
            "checked": len(user_ids),
            "signals": len(signals),
            "triggered": len(triggered),
            "by_type": by_type,
        }
    except Exception as exc:
        if retry_count < MAX_RETRIES:
            delay = exponential_backoff(retry_count)
            logger.warning("Proactive support checks failed (try %d), retrying in %ds: %s", retry_count + 1, delay, exc)
        else:
            logger.error("Proactive support checks exhausted retries: %s", exc)
            redis = ctx.get("redis")
            if redis:
                await push_to_dlq(redis, "run_proactive_support_checks", (), {}, str(exc), retry_count)
        raise
