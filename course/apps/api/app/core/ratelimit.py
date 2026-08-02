from fastapi import Request
from slowapi import Limiter


def _client_fingerprint(request: Request) -> str:
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        ip = forwarded.split(",")[0].strip()
    else:
        ip = request.client.host if request.client else "unknown"
    ua = request.headers.get("user-agent", "unknown")
    return f"{ip}:{ua}"


limiter = Limiter(key_func=_client_fingerprint, default_limits=["30/minute"])
