import os
import random
from app.core.config import settings


def _generate_code() -> str:
    return str(random.randint(100000, 999999))


def generate_otp() -> str:
    return _generate_code()


def _sanitize_phone(phone: str) -> str:
    return "".join(c for c in phone if c.isdigit() or c == "+")


def _otp_log_message(phone: str, code: str) -> str:
    return f"[DEV OTP] phone={_sanitize_phone(phone)} code={code}"


async def send_otp(phone: str, code: str):
    """Send OTP via Twilio if configured, otherwise log to console for local dev."""
    if settings.sms_provider_api_key and settings.sms_provider_api_key.startswith("twilio:"):
        parts = settings.sms_provider_api_key.split(":")
        account_sid, auth_token, from_number = parts[1], parts[2], parts[3]
        try:
            from twilio.rest import Client

            client = Client(account_sid, auth_token)
            client.messages.create(body=f"Your Ascendly verification code is {code}", from_=from_number, to=_sanitize_phone(phone))
            return
        except Exception as exc:
            print(_otp_log_message(phone, code) + f" | twilio failed: {exc}")
            return
    print(_otp_log_message(phone, code))
