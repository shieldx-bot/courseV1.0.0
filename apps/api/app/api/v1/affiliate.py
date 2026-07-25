from fastapi import APIRouter, Depends, HTTPException, Query, Request
from pydantic import BaseModel, Field
from typing import Optional

from app.core.deps import get_current_user, get_optional_user
from app.core.response import api_response
from app.services.affiliate import (
    get_referral_config,
    update_referral_config,
    create_referral_code,
    get_referral_code,
    get_referral_code_by_code,
    process_referral,
    apply_referral_discount,
    get_user_referrals,
    get_affiliate_dashboard,
    create_affiliate_application,
    create_affiliate_link,
    track_affiliate_click,
    track_affiliate_conversion,
    seed_referral_config,
)

router = APIRouter()


# ---- Referral Config ----

@router.get("/referral/config")
async def get_config(user: dict = Depends(get_current_user)):
    config = await get_referral_config()
    return api_response(config)


@router.put("/referral/config", dependencies=[Depends(get_current_user)])
async def put_config(data: dict, user: dict = Depends(get_current_user)):
    # TODO: Check admin role
    config = await update_referral_config(data)
    return api_response(config)


# ---- Referral Code ----

@router.post("/referral/code")
async def generate_code(user: dict = Depends(get_current_user)):
    code = await create_referral_code(user["id"])
    return api_response(code)


@router.get("/referral/code")
async def get_my_code(user: dict = Depends(get_current_user)):
    code = await get_referral_code(user["id"])
    if not code:
        return api_response({"code": None})
    return api_response(code)


# ---- Referral Flow ----

@router.post("/referral/apply")
async def apply_referral(
    code: str = Query(..., min_length=4, max_length=20),
    user: dict = Depends(get_current_user),
):
    result = await process_referral(code, user["id"])
    if not result.get("success"):
        raise HTTPException(status_code=400, detail=result.get("error"))
    return api_response(result)


@router.post("/referral/apply-discount")
async def apply_discount(user: dict = Depends(get_current_user)):
    result = await apply_referral_discount(user["id"])
    return api_response(result)


@router.get("/referral/stats")
async def get_referral_stats(user: dict = Depends(get_current_user)):
    stats = await get_user_referrals(user["id"])
    return api_response(stats)


# ---- Affiliate Program ----

class AffiliateApplicationIn(BaseModel):
    commission_rate: Optional[int] = Field(default=20, ge=5, le=50)
    payout_method: str = Field(default="bank_transfer")
    payout_details: dict = Field(default_factory=dict)
    website_url: Optional[str] = None
    social_media: dict = Field(default_factory=dict)


@router.post("/affiliate/apply")
async def apply_affiliate(data: AffiliateApplicationIn, user: dict = Depends(get_current_user)):
    result = await create_affiliate_application(user["id"], data.model_dump())
    if not result.get("success"):
        raise HTTPException(status_code=400, detail=result.get("error"))
    return api_response(result)


@router.get("/affiliate/dashboard")
async def get_dashboard(user: dict = Depends(get_current_user)):
    dashboard = await get_affiliate_dashboard(user["id"])
    if not dashboard:
        raise HTTPException(status_code=404, detail="Not an affiliate")
    return api_response(dashboard)


class AffiliateLinkIn(BaseModel):
    url: str
    label: Optional[str] = None


@router.post("/affiliate/links")
async def create_link(data: AffiliateLinkIn, user: dict = Depends(get_current_user)):
    link = await create_affiliate_link(user["id"], data.model_dump())
    return api_response(link)


# ---- Public Tracking (no auth) ----

@router.get("/r/{tracking_code}")
async def redirect_tracking(tracking_code: str, request: Request):
    """Track affiliate click and redirect to target URL."""
    link = await track_affiliate_click(tracking_code)
    if not link:
        raise HTTPException(status_code=404, detail="Invalid tracking code")
    
    from fastapi.responses import RedirectResponse
    return RedirectResponse(url=link["url"])


@router.post("/affiliate/conversion")
async def record_conversion(
    tracking_code: str = Query(...),
    order_id: str = Query(...),
    amount: float = Query(...),
    commission_rate: Optional[float] = Query(None, ge=0, le=100),
):
    """Record a conversion from affiliate tracking (called by checkout)."""
    result = await track_affiliate_conversion(tracking_code, order_id, amount, commission_rate)
    if not result:
        raise HTTPException(status_code=404, detail="Invalid tracking code")
    return api_response(result)


# ---- Admin ----

@router.post("/admin/referral/seed")
async def seed_config_admin():
    await seed_referral_config()
    return api_response({"seeded": True})