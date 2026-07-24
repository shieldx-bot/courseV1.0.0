from datetime import datetime, timezone
from app.core.config import settings


def _configured() -> bool:
    return bool(settings.smtp_host and settings.smtp_user and settings.smtp_password)


def _send(to: str, subject: str, body: str):
    if not _configured():
        print(f"[DEV EMAIL] to={to} subject={subject}\n{body}\n---")
        return

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


def send_receipt(to: str, tier: str, amount: float, currency: str, order_id: str, provider: str):
    subject = f"Your Ascendly receipt — {order_id}"
    body = (
        f"Thanks for joining Ascendly.\n\n"
        f"Plan: {tier}\n"
        f"Amount: {amount} {currency}\n"
        f"Payment method: {provider}\n"
        f"Order ID: {order_id}\n\n"
        f"Start learning: {settings.frontend_url}/learn"
    )
    _send(to, subject, body)


def send_renewal_reminder(to: str, tier: str, renews_at: str, days_left: int):
    subject = f"Your Ascendly membership renews in {days_left} days"
    body = (
        f"Hi,\n\n"
        f"Your {tier} plan renews on {renews_at}. "
        f"You don't need to do anything — your access will continue without interruption.\n\n"
        f"Manage your account: {settings.frontend_url}/account"
    )
    _send(to, subject, body)


def send_welcome(to: str):
    _send(
        to,
        "Welcome to Ascendly",
        f"Your membership is active. Start your first lesson today: {settings.frontend_url}/learn",
    )


def send_trial_started(to: str, expires_at: str):
    subject = "Your 3-day Ascendly preview is active"
    body = (
        f"You now have 3 days to preview 10% of any course.\n\n"
        f"Preview expires: {expires_at}\n"
        f"Start learning: {settings.frontend_url}/learn"
    )
    _send(to, subject, body)


def send_password_reset(to: str, reset_url: str):
    subject = "Reset your Ascendly password"
    body = (
        f"You requested a password reset. Click the link below to set a new password:\n\n"
        f"{reset_url}\n\n"
        f"This link expires in 15 minutes. If you did not request this, you can ignore this email."
    )
    _send(to, subject, body)


async def find_renewals_due(db, days: int = 7):
    from datetime import timedelta

    now = datetime.now(timezone.utc)
    target = (now + timedelta(days=days)).isoformat()
    subs = await db.subscriptions.find({
        "status": "active",
        "ends_at": {"$gte": now.isoformat(), "$lte": target},
    }).to_list(1000)
    return subs
