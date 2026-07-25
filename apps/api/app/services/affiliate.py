"""
Affiliate & Referral Program Service

Supports:
- Referral: User refers friend -> both get discount on next month
- Affiliate: Creator/blogger signs up -> gets commission on subscriptions via tracking link
"""
import logging
import secrets
import string
from datetime import datetime, timezone, timedelta
from typing import Any

from app.core.config import settings
from app.db.mongodb import get_db

logger = logging.getLogger(__name__)


def _generate_code(length: int = 8) -> str:
    alphabet = string.ascii_uppercase + string.digits
    return "".join(secrets.choice(alphabet) for _ in range(length))


async def seed_referral_config():
    """Seed default referral configuration."""
    db = get_db()
    existing = await db.referral_config.find_one({})
    if not existing:
        await db.referral_config.insert_one({
            "referrer_discount_percent": 20,
            "referee_discount_percent": 20,
            "discount_duration_months": 1,
            "max_referrals_per_user": 10,
            "created_at": datetime.now(timezone.utc).isoformat(),
        })


async def get_referral_config() -> dict:
    """Get referral program configuration."""
    db = get_db()
    config = await db.referral_config.find_one({})
    if not config:
        await seed_referral_config()
        config = await db.referral_config.find_one({})
    return config or {
        "referrer_discount_percent": 20,
        "referee_discount_percent": 20,
        "discount_duration_months": 1,
        "max_referrals_per_user": 10,
    }


async def update_referral_config(data: dict) -> dict:
    """Update referral program configuration."""
    db = get_db()
    await db.referral_config.update_one({}, {"$set": data}, upsert=True)
    return await get_referral_config()


async def create_referral_code(user_id: str) -> dict:
    """Generate a unique referral code for a user."""
    db = get_db()
    
    # Check if user already has a code
    existing = await db.referral_codes.find_one({"user_id": user_id})
    if existing:
        return existing
    
    code = _generate_code()
    # Ensure uniqueness
    while await db.referral_codes.find_one({"code": code}):
        code = _generate_code()
    
    doc = {
        "_id": f"ref-{user_id}",
        "user_id": user_id,
        "code": code,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "uses_count": 0,
    }
    await db.referral_codes.insert_one(doc)
    return doc


async def get_referral_code(user_id: str) -> dict | None:
    """Get user's referral code."""
    db = get_db()
    return await db.referral_codes.find_one({"user_id": user_id})


async def get_referral_code_by_code(code: str) -> dict | None:
    """Get referral code document by code string."""
    db = get_db()
    return await db.referral_codes.find_one({"code": code.upper()})


async def process_referral(referral_code: str, referee_user_id: str) -> dict | None:
    """
    Process a referral when a new user signs up with a referral code.
    Applies discount to both referrer and referee on their next subscription.
    """
    db = get_db()
    code_upper = referral_code.upper()
    
    code_doc = await db.referral_codes.find_one({"code": code_upper})
    if not code_doc:
        return {"success": False, "error": "Invalid referral code"}
    
    referrer_id = code_doc["user_id"]
    if referrer_id == referee_user_id:
        return {"success": False, "error": "Cannot refer yourself"}
    
    # Check if referee already used a referral
    existing = await db.referrals.find_one({"referee_user_id": referee_user_id})
    if existing:
        return {"success": False, "error": "Referral already applied"}
    
    config = await get_referral_config()
    max_refs = config.get("max_referrals_per_user", 10)
    
    # Check if referrer has hit max
    referrer_count = await db.referrals.count_documents({"referrer_user_id": referrer_id})
    if referrer_count >= max_refs:
        return {"success": False, "error": "Referrer has reached maximum referrals"}
    
    now = datetime.now(timezone.utc)
    discount_expires = now + timedelta(days=30 * config.get("discount_duration_months", 1))
    
    referral_doc = {
        "_id": f"ref-{referrer_id}-{referee_user_id}",
        "referrer_user_id": referrer_id,
        "referee_user_id": referee_user_id,
        "code": code_upper,
        "referrer_discount_percent": config.get("referrer_discount_percent", 20),
        "referee_discount_percent": config.get("referee_discount_percent", 20),
        "status": "pending",
        "created_at": now.isoformat(),
        "discount_expires_at": discount_expires.isoformat(),
    }
    
    await db.referrals.insert_one(referral_doc)
    
    # Increment uses count
    await db.referral_codes.update_one(
        {"_id": code_doc["_id"]},
        {"$inc": {"uses_count": 1}}
    )
    
    logger.info("Referral created: %s referred %s", referrer_id, referee_user_id)
    return {"success": True, "referral": referral_doc}


async def apply_referral_discount(user_id: str) -> dict | None:
    """Apply pending referral discount to user's next subscription."""
    db = get_db()
    
    referral = await db.referrals.find_one({
        "referee_user_id": user_id,
        "status": "pending"
    })
    if not referral:
        return None
    
    # Check if discount is still valid
    expires = datetime.fromisoformat(referral["discount_expires_at"].replace("Z", "+00:00"))
    if datetime.now(timezone.utc) > expires:
        await db.referrals.update_one(
            {"_id": referral["_id"]},
            {"$set": {"status": "expired"}}
        )
        return None
    
    # Mark as applied
    await db.referrals.update_one(
        {"_id": referral["_id"]},
        {"$set": {"status": "applied", "applied_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    # Also give referrer their discount
    await db.referrals.update_one(
        {"referrer_user_id": referral["referrer_user_id"], "referee_user_id": referral["referee_user_id"]},
        {"$set": {"referrer_discount_applied": True, "referrer_applied_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    return {
        "discount_percent": referral["referee_discount_percent"],
        "expires_at": referral["discount_expires_at"],
    }


async def get_user_referrals(user_id: str) -> dict:
    """Get user's referral stats and list."""
    db = get_db()
    
    # Referrals made by this user (they referred others)
    referred = await db.referrals.find({"referrer_user_id": user_id}).to_list(100)
    
    # Referral used by this user (someone referred them)
    referred_by = await db.referrals.find_one({"referee_user_id": user_id})
    
    # Own referral code
    code_doc = await db.referral_codes.find_one({"user_id": user_id})
    
    return {
        "code": code_doc["code"] if code_doc else None,
        "uses_count": code_doc["uses_count"] if code_doc else 0,
        "referred_count": len(referred),
        "referred_users": referred,
        "referred_by": referred_by,
    }


async def get_affiliate_dashboard(affiliate_user_id: str) -> dict | None:
    """Get affiliate dashboard data."""
    db = get_db()
    affiliate = await db.affiliates.find_one({"user_id": affiliate_user_id})
    if not affiliate:
        return None
    
    # Get tracking links
    links = await db.affiliate_links.find({"affiliate_user_id": affiliate_user_id}).to_list(50)
    
    # Get conversions
    conversions = await db.affiliate_conversions.find({"affiliate_user_id": affiliate_user_id}).to_list(200)
    
    total_clicks = sum(l.get("clicks", 0) for l in links)
    total_conversions = len(conversions)
    total_earnings = sum(c.get("commission_amount", 0) for c in conversions)
    pending_earnings = sum(c.get("commission_amount", 0) for c in conversions if c.get("status") == "pending")
    paid_earnings = sum(c.get("commission_amount", 0) for c in conversions if c.get("status") == "paid")
    
    return {
        "affiliate": affiliate,
        "links": links,
        "conversions": conversions,
        "stats": {
            "total_clicks": total_clicks,
            "total_conversions": total_conversions,
            "conversion_rate": round(total_conversions / total_clicks * 100, 2) if total_clicks > 0 else 0,
            "total_earnings": total_earnings,
            "pending_earnings": pending_earnings,
            "paid_earnings": paid_earnings,
        },
    }


async def create_affiliate_application(user_id: str, data: dict) -> dict:
    """Submit affiliate application."""
    db = get_db()
    
    existing = await db.affiliates.find_one({"user_id": user_id})
    if existing:
        return {"success": False, "error": "Already an affiliate"}
    
    doc = {
        "_id": f"aff-{user_id}",
        "user_id": user_id,
        "status": "pending",
        "commission_rate": data.get("commission_rate", 20),  # default 20%
        "payout_method": data.get("payout_method", "bank_transfer"),
        "payout_details": data.get("payout_details", {}),
        "website_url": data.get("website_url", ""),
        "social_media": data.get("social_media", {}),
        "applied_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.affiliates.insert_one(doc)
    return {"success": True, "affiliate": doc}


async def create_affiliate_link(affiliate_user_id: str, data: dict) -> dict:
    """Create a new tracking link for affiliate."""
    db = get_db()
    affiliate = await db.affiliates.find_one({"user_id": affiliate_user_id})
    if not affiliate or affiliate["status"] != "approved":
        raise ValueError("Affiliate not approved")
    
    tracking_code = _generate_code(12)
    link_id = f"link-{affiliate_user_id}-{tracking_code}"
    
    doc = {
        "_id": link_id,
        "affiliate_user_id": affiliate_user_id,
        "tracking_code": tracking_code,
        "url": data.get("url", settings.frontend_url),
        "label": data.get("label", "Custom link"),
        "clicks": 0,
        "conversions": 0,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.affiliate_links.insert_one(doc)
    return doc


async def track_affiliate_click(tracking_code: str) -> dict | None:
    """Track a click on an affiliate link."""
    db = get_db()
    link = await db.affiliate_links.find_one({"tracking_code": tracking_code})
    if not link:
        return None
    
    await db.affiliate_links.update_one(
        {"_id": link["_id"]},
        {"$inc": {"clicks": 1}}
    )
    return link


async def track_affiliate_conversion(
    tracking_code: str,
    order_id: str,
    amount: float,
    commission_rate: float | None = None
) -> dict | None:
    """Track a conversion from affiliate link."""
    db = get_db()
    link = await db.affiliate_links.find_one({"tracking_code": tracking_code})
    if not link:
        return None
    
    rate = commission_rate if commission_rate is not None else link.get("commission_rate", 20)
    commission_amount = round(amount * rate / 100, 2)
    
    conversion_id = f"conv-{link['affiliate_user_id']}-{order_id}"
    existing = await db.affiliate_conversions.find_one({"_id": conversion_id})
    if existing:
        return existing
    
    doc = {
        "_id": conversion_id,
        "affiliate_user_id": link["affiliate_user_id"],
        "affiliate_link_id": link["_id"],
        "order_id": order_id,
        "amount": amount,
        "commission_rate": rate,
        "commission_amount": commission_amount,
        "status": "pending",
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.affiliate_conversions.insert_one(doc)
    
    await db.affiliate_links.update_one(
        {"_id": link["_id"]},
        {"$inc": {"conversions": 1}}
    )
    
    return doc