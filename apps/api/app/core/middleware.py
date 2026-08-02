"""Request-ID / trace-correlation middleware.

Phase 7 (NV1): accept an incoming ``X-Request-ID`` header (when a client /
proxy / ingress provides one), otherwise generate a fresh UUID. The id is:
  - stored in a contextvar (``app.core.context``) so handlers, error logs and
    the HTTP access log can read it without threading a parameter through;
  - echoed back in the response ``X-Request-ID`` header so the caller can
    correlate a failure response with the server-side error record.

Pure ASGI (not ``BaseHTTPMiddleware``) so the contextvar is guaranteed to be
visible inside the route handler and so the response header can be injected
at ``http.response.start`` without buffering the body.
"""

from __future__ import annotations

from collections.abc import Awaitable, Callable
from typing import Any

from starlette.datastructures import Headers, MutableHeaders

from app.core.context import (
    generate_request_id,
    reset_request_id,
    set_request_id,
)

REQUEST_ID_HEADER = "x-request-id"


class RequestIDMiddleware:
    def __init__(self, app: Callable) -> None:
        self.app = app

    async def __call__(
        self,
        scope: dict[str, Any],
        receive: Callable[[], Awaitable[dict[str, Any]]],
        send: Callable[[dict[str, Any]], Awaitable[None]],
    ) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        headers = Headers(scope=scope)
        request_id = headers.get(REQUEST_ID_HEADER) or generate_request_id()
        token = set_request_id(request_id)

        async def send_wrapper(message: dict[str, Any]) -> None:
            if message["type"] == "http.response.start":
                response_headers = MutableHeaders(scope=message)
                response_headers[REQUEST_ID_HEADER] = request_id
            await send(message)

        try:
            await self.app(scope, receive, send_wrapper)
        finally:
            reset_request_id(token)
