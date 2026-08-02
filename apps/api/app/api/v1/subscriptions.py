import json
import logging
from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from app.core.deps import get_current_user, require_admin
from app.core.config import settings
from app.core.response import api_response
from app.db.mongodb import get_db
from app.services import payment as payment_service
from app.services import email as email_service
from app.core.worker import enqueue_task_with_retry
from app.core.telemetry import WORKER_JOBS_ENQUEUED
from app.core.idempotency import deduplicate
from app.services.proactive_support import track_event

logger = logging.getLogger(__name__)

router = APIRouter()


async def _track_checkout_completed(user_id: str, order_id: str, provider: str) -> None:
    """Record a completed checkout for proactive drop detection."""
    try:
        await track_event(
            user_id,
            "checkout_completed",
            metadata={"order_id": order_id, "provider": provider},
        )
    except Exception as exc:
        logger.warning("Failed to track checkout_completed for %s: %s", user_id, exc)


def _end_date(months: int):
    if months >= 999:
        return datetime.max.replace(tzinfo=timezone.utc)
    return datetime.now(timezone.utc) + timedelta(days=30 * months)


@router.get("/subscriptions/tiers")
async def list_tiers():
    db = get_db()
    tiers = await db.tiers.find().sort("duration_months").to_list(20)
    return api_response([{"id": t["_id"], **{k: v for k, v in t.items() if k != "_id"}} for t in tiers])


@router.get("/subscriptions/coupons/{code}")
async def validate_coupon(code: str):
    db = get_db()
    coupon = await db.coupons.find_one({"code": code.upper()})
    if not coupon:
        raise HTTPException(status_code=404, detail="Invalid coupon")
    if coupon.get("expires_at") and coupon["expires_at"] < datetime.now(timezone.utc).isoformat():
        raise HTTPException(status_code=404, detail="Coupon expired")
    if coupon.get("max_uses") and coupon.get("used_count", 0) >= coupon["max_uses"]:
        raise HTTPException(status_code=404, detail="Coupon usage limit reached")
    return api_response({"code": coupon["code"], "discount_type": coupon["discount_type"], "discount_value": coupon["discount_value"]})


@router.get("/subscriptions/me")
async def get_my_subscription(user: dict = Depends(get_current_user)):
    db = get_db()
    sub = await db.subscriptions.find_one({"user_id": user["id"], "status": "active"})
    if not sub:
        return api_response(None)
    return api_response({
        "id": sub["_id"],
        "tier": sub["tier"],
        "status": sub["status"],
        "starts_at": sub["starts_at"],
        "ends_at": sub["ends_at"],
    })


@router.get("/subscriptions/orders")
async def get_my_orders(user: dict = Depends(get_current_user)):
    db = get_db()
    orders = await db.orders.find({"user_id": user["id"]}).to_list(100)
    return api_response([{"id": o["_id"], **{k: v for k, v in o.items() if k != "_id"}} for o in orders])


class CheckoutIn(BaseModel):
    tier_id: str
    coupon_code: str | None = None
    payment_provider: str = "stripe"


async def _get_tier(tier_id: str):
    db = get_db()
    tier = await db.tiers.find_one({"_id": tier_id}) or await db.tiers.find_one({"id": tier_id})
    if not tier:
        raise HTTPException(status_code=404, detail="Tier not found")
    return tier


async def _apply_coupon(code: str | None):
    if not code:
        return None
    db = get_db()
    coupon = await db.coupons.find_one({"code": code.upper()})
    if not coupon:
        raise HTTPException(status_code=400, detail="Invalid coupon")
    return coupon


def _calculate_amount(tier: dict, coupon: dict | None) -> int:
    base = tier["price_per_month"] * tier["duration_months"]
    if tier["duration_months"] >= 999:
        base = 999
    if coupon and coupon["discount_type"] == "percent":
        base = int(base * (1 - coupon["discount_value"] / 100))
    return base


async def _create_subscription_and_order(user_id: str, tier: dict, coupon: dict | None, provider: str, amount: float, external_id: str = ""):
    db = get_db()
    sub_id = f"sub-{user_id}-{datetime.now(timezone.utc).timestamp()}"
    order_id = f"ord-{sub_id}"
    now = datetime.now(timezone.utc)
    months = tier["duration_months"]

    await db.subscriptions.insert_one({
        "_id": sub_id,
        "user_id": user_id,
        "tier": tier["id"],
        "status": "active",
        "starts_at": now.isoformat(),
        "ends_at": _end_date(months).isoformat(),
    })

    await db.orders.insert_one({
        "_id": order_id,
        "user_id": user_id,
        "subscription_id": sub_id,
        "amount": amount,
        "currency": "USD",
        "coupon_code": coupon["code"] if coupon else None,
        "payment_provider": provider,
        "payment_status": "paid",
        "external_id": external_id,
        "created_at": now.isoformat(),
    })

    if coupon and coupon.get("used_count") is not None and coupon.get("max_uses"):
        await db.coupons.update_one({"_id": coupon["_id"]}, {"$set": {"used_count": coupon["used_count"] + 1}})

    user = await db.users.find_one({"_id": user_id})
    if user:
        await enqueue_task_with_retry("send_receipt_task", user["email"], tier["label"], amount, "USD", order_id, provider, _max_retries=5, _job_timeout=60)
        WORKER_JOBS_ENQUEUED.labels(task="send_receipt_task").inc()
        await enqueue_task_with_retry("send_welcome_task", user["email"], _max_retries=5, _job_timeout=60)
        WORKER_JOBS_ENQUEUED.labels(task="send_welcome_task").inc()

    return sub_id, order_id


@router.post("/checkout/session")
async def create_checkout(body: CheckoutIn, user: dict = Depends(get_current_user)):
    tier = await _get_tier(body.tier_id)
    coupon = await _apply_coupon(body.coupon_code) if body.coupon_code else None
    amount = _calculate_amount(tier, coupon)

    # Track checkout start for proactive checkout-drop detection.
    try:
        await track_event(
            user["id"],
            "checkout_started",
            metadata={"tier_id": body.tier_id, "provider": body.payment_provider, "amount": amount},
        )
    except Exception as exc:
        logger.warning("Failed to track checkout_started for %s: %s", user["id"], exc)

    success_url = f"{settings.frontend_url}/checkout?success=1&provider={body.payment_provider}"
    cancel_url = f"{settings.frontend_url}/checkout?canceled=1"

    if body.payment_provider == "stripe" and settings.stripe_secret_key:
        try:
            session_url = payment_service.create_stripe_checkout_session(
                user["id"], tier, coupon, success_url, cancel_url
            )
            return api_response({"session_url": session_url, "provider": "stripe", "amount": amount})
        except Exception as exc:
            raise HTTPException(status_code=502, detail=f"Stripe error: {exc}")

    if body.payment_provider == "paypal" and settings.paypal_client_id and settings.paypal_client_secret:
        try:
            order = await payment_service.create_paypal_order(user["id"], tier, coupon)
            return api_response({"order": order, "provider": "paypal", "amount": amount})
        except Exception as exc:
            raise HTTPException(status_code=502, detail=f"PayPal error: {exc}")

    # Dev/test fallback: immediately create subscription
    sub_id, order_id = await _create_subscription_and_order(user["id"], tier, coupon, "test", amount)
    await _track_checkout_completed(user["id"], order_id, "test")
    return api_response({
        "session_url": "/learn",
        "provider": "test",
        "subscription_id": sub_id,
        "order_id": order_id,
        "amount": amount,
    })


@router.post("/checkout/paypal/capture")
async def capture_paypal(order_id: str, user: dict = Depends(get_current_user)):
    try:
        result = await payment_service.capture_paypal_order(order_id)
        custom_id = result.get("purchase_units", [{}])[0].get("payments", {}).get("captures", [{}])[0].get("custom_id", "")
        parts = custom_id.split("|")
        if len(parts) >= 2 and parts[0] == user["id"]:
            tier = await _get_tier(parts[1])
            coupon = await _apply_coupon(parts[2]) if len(parts) > 2 and parts[2] else None
            amount = _calculate_amount(tier, coupon)
            _, internal_order_id = await _create_subscription_and_order(user["id"], tier, coupon, "paypal", amount, order_id)
            await _track_checkout_completed(user["id"], internal_order_id, "paypal")
        return api_response({"captured": True})
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"PayPal capture error: {exc}")


@router.post("/webhooks/stripe")
async def stripe_webhook(request: Request):
    payload = await request.body()
    sig_header = request.headers.get("stripe-signature")
    try:
        event = payment_service.verify_stripe_event(payload, sig_header)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Webhook verification failed: {exc}")

    event_id = event.get("id", "")
    if event_id:
        if not await deduplicate(event_id):
            return api_response({"received": True, "note": "Already processed"})

    if event.get("type") == "checkout.session.completed":
        session = event["data"]["object"]
        metadata = session.get("metadata", {})
        user_id = metadata.get("user_id")
        tier_id = metadata.get("tier_id")
        coupon_code = metadata.get("coupon_code")
        if not user_id or not tier_id:
            return api_response({"received": True, "note": "Missing metadata"})

        db = get_db()
        user = await db.users.find_one({"_id": user_id})
        if not user:
            return api_response({"received": True, "note": "User not found"})

        tier = await _get_tier(tier_id)
        coupon = await _apply_coupon(coupon_code) if coupon_code else None
        amount = session.get("amount_total", _calculate_amount(tier, coupon) * 100) / 100
        _, internal_order_id = await _create_subscription_and_order(user_id, tier, coupon, "stripe", amount, session.get("id"))
        await _track_checkout_completed(user_id, internal_order_id, "stripe")

    return api_response({"received": True})


@router.post("/webhooks/paypal")
async def paypal_webhook(request: Request):
    body = await request.body()
    try:
        event = await payment_service.verify_paypal_event(dict(request.headers), body)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"PayPal webhook verification failed: {exc}")

    event_id = event.get("id", "")
    if event_id:
        if not await deduplicate(event_id):
            return api_response({"received": True, "note": "Already processed"})

    event_type = event.get("event_type")
    if event_type == "PAYMENT.CAPTURE.COMPLETED":
        resource = event.get("resource", {})
        custom_id = resource.get("custom_id", "")
        parts = custom_id.split("|")
        if len(parts) >= 2:
            user_id, tier_id, coupon_code = parts[0], parts[1], parts[2] if len(parts) > 2 else None
            db = get_db()
            user = await db.users.find_one({"_id": user_id})
            if user:
                tier = await _get_tier(tier_id)
                coupon = await _apply_coupon(coupon_code) if coupon_code else None
                amount = float(resource.get("amount", {}).get("value", _calculate_amount(tier, coupon)))
                _, internal_order_id = await _create_subscription_and_order(user_id, tier, coupon, "paypal", amount, resource.get("id"))
                await _track_checkout_completed(user_id, internal_order_id, "paypal")

    return {"received": True}


@router.post("/subscriptions/cancel")
async def cancel_my_subscription(user: dict = Depends(get_current_user)):
    db = get_db()
    sub = await db.subscriptions.find_one({"user_id": user["id"], "status": "active"})
    if not sub:
        raise HTTPException(status_code=404, detail="No active subscription found")
    now = datetime.now(timezone.utc)
    await db.subscriptions.update_one(
        {"_id": sub["_id"]},
        {"$set": {"status": "canceled", "ends_at": now.isoformat(), "updated_at": now.isoformat()}}
    )
    return {"canceled": True, "ends_at": now.isoformat()}


@router.post("/admin/renewal-reminders", dependencies=[Depends(require_admin)])
async def send_renewal_reminders(days: int = 7):
    job_id = await enqueue_task_with_retry("send_batch_renewal_reminders_task", days, _max_retries=3, _job_timeout=600)
    WORKER_JOBS_ENQUEUED.labels(task="send_batch_renewal_reminders_task").inc()
    return {"enqueued": True, "job_id": job_id, "days": days}
