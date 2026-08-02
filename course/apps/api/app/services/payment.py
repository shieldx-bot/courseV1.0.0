from app.core.config import settings


def _stripe_client():
    if not settings.stripe_secret_key:
        return None
    import stripe

    stripe.api_key = settings.stripe_secret_key
    return stripe


def create_stripe_checkout_session(user_id: str, tier: dict, coupon: dict | None, success_url: str, cancel_url: str) -> str:
    stripe = _stripe_client()
    if not stripe:
        raise RuntimeError("Stripe is not configured")

    amount_cents = _calculate_amount_cents(tier, coupon)
    line_items = [{
        "price_data": {
            "currency": "usd",
            "product_data": {"name": f"Ascendly {tier['label']}"},
            "unit_amount": amount_cents,
        },
        "quantity": 1,
    }]

    metadata = {
        "user_id": user_id,
        "tier_id": tier["id"],
        "tier_label": tier["label"],
        "duration_months": str(tier["duration_months"]),
    }
    if coupon:
        metadata["coupon_code"] = coupon["code"]

    session = stripe.checkout.Session.create(
        line_items=line_items,
        mode="payment",
        success_url=success_url,
        cancel_url=cancel_url,
        metadata=metadata,
    )
    return session.url


def verify_stripe_event(payload: bytes, sig_header: str | None) -> dict:
    stripe = _stripe_client()
    if not stripe:
        raise RuntimeError("Stripe is not configured")
    if not sig_header:
        raise ValueError("Missing Stripe signature header")
    return stripe.Webhook.construct_event(payload, sig_header, settings.stripe_webhook_secret)


def _calculate_amount_cents(tier: dict, coupon: dict | None) -> int:
    base = tier["price_per_month"] * tier["duration_months"]
    if tier["duration_months"] >= 999:
        base = 999
    if coupon and coupon["discount_type"] == "percent":
        base = int(base * (1 - coupon["discount_value"] / 100))
    return base * 100


async def create_paypal_order(user_id: str, tier: dict, coupon: dict | None) -> dict:
    if not settings.paypal_client_id or not settings.paypal_client_secret:
        raise RuntimeError("PayPal is not configured")

    import httpx

    access_token = await _paypal_access_token()
    amount_cents = _calculate_amount_cents(tier, coupon)
    amount_dollars = f"{amount_cents / 100:.2f}"

    payload = {
        "intent": "CAPTURE",
        "purchase_units": [{
            "amount": {"currency_code": "USD", "value": amount_dollars},
            "description": f"Ascendly {tier['label']}",
            "custom_id": f"{user_id}|{tier['id']}|{coupon['code'] if coupon else ''}",
        }],
        "application_context": {
            "return_url": f"{settings.frontend_url}/checkout?success=1&provider=paypal",
            "cancel_url": f"{settings.frontend_url}/checkout?canceled=1",
        },
    }

    async with httpx.AsyncClient() as client:
        res = await client.post(
            "https://api-m.sandbox.paypal.com/v2/checkout/orders",
            headers={
                "Authorization": f"Bearer {access_token}",
                "Content-Type": "application/json",
            },
            json=payload,
        )
        res.raise_for_status()
        data = res.json()

    approval = next((link["href"] for link in data.get("links", []) if link["rel"] == "approve"), None)
    return {"order_id": data["id"], "approval_url": approval}


async def capture_paypal_order(order_id: str) -> dict:
    if not settings.paypal_client_id or not settings.paypal_client_secret:
        raise RuntimeError("PayPal is not configured")

    import httpx

    access_token = await _paypal_access_token()
    async with httpx.AsyncClient() as client:
        res = await client.post(
            f"https://api-m.sandbox.paypal.com/v2/checkout/orders/{order_id}/capture",
            headers={"Authorization": f"Bearer {access_token}", "Content-Type": "application/json"},
        )
        res.raise_for_status()
        return res.json()


async def _paypal_access_token() -> str:
    import httpx
    import base64

    credentials = base64.b64encode(f"{settings.paypal_client_id}:{settings.paypal_client_secret}".encode()).decode()
    async with httpx.AsyncClient() as client:
        res = await client.post(
            "https://api-m.sandbox.paypal.com/v1/oauth2/token",
            headers={"Authorization": f"Basic {credentials}"},
            data={"grant_type": "client_credentials"},
        )
        res.raise_for_status()
        return res.json()["access_token"]


def refund_stripe(session_id: str):
    stripe = _stripe_client()
    if not stripe:
        raise RuntimeError("Stripe is not configured")
    session = stripe.checkout.Session.retrieve(session_id)
    payment_intent = session.get("payment_intent")
    if not payment_intent:
        raise RuntimeError("No payment_intent found for session")
    return stripe.Refund.create(payment_intent=payment_intent)


async def refund_paypal(capture_id: str):
    if not settings.paypal_client_id or not settings.paypal_client_secret:
        raise RuntimeError("PayPal is not configured")
    import httpx
    access_token = await _paypal_access_token()
    async with httpx.AsyncClient() as client:
        res = await client.post(
            f"https://api-m.sandbox.paypal.com/v2/payments/captures/{capture_id}/refund",
            headers={"Authorization": f"Bearer {access_token}", "Content-Type": "application/json"},
        )
        res.raise_for_status()
        return res.json()


async def verify_paypal_event(headers: dict, body: bytes) -> dict:
    # In production, PayPal webhook verification requires fetching the event by ID
    # using the API to confirm it exists and matches the payload.
    import httpx

    event = __import__("json").loads(body)
    event_id = event.get("id")
    if not event_id or not settings.paypal_client_id or not settings.paypal_client_secret:
        raise ValueError("PayPal webhook verification unavailable")

    access_token = await _paypal_access_token()
    async with httpx.AsyncClient() as client:
        res = await client.get(
            f"https://api-m.sandbox.paypal.com/v1/notifications/webhooks-events/{event_id}",
            headers={"Authorization": f"Bearer {access_token}", "Content-Type": "application/json"},
        )
        res.raise_for_status()
        remote = res.json()
    if remote.get("id") != event_id:
        raise ValueError("PayPal event ID mismatch")
    return remote
