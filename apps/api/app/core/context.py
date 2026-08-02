"""Request-scoped contextvars for trace correlation.

The request-ID middleware (``app.core.middleware.RequestIDMiddleware``) sets
``request_id_var`` for the lifetime of an HTTP request. Anything running inside
the request (handlers, error loggers, background tasks spawned from it) can
read ``get_request_id()`` to correlate logs / error records with a single
client request.
"""

from __future__ import annotations

import uuid
from contextvars import ContextVar, Token

_request_id_var: ContextVar[str | None] = ContextVar("request_id", default=None)


def generate_request_id() -> str:
    """Generate a fresh UUID4 request id (string)."""
    return str(uuid.uuid4())


def set_request_id(request_id: str | None) -> Token:
    """Set the request id for the current async context.

    Returns the contextvar token so the middleware can restore the previous
    value when the request completes.
    """
    return _request_id_var.set(request_id)


def reset_request_id(token: Token) -> None:
    """Restore the previous request id value (end of request)."""
    _request_id_var.reset(token)


def get_request_id() -> str | None:
    """Return the request id bound to the current async context (if any)."""
    return _request_id_var.get()


def get_or_create_request_id() -> str:
    """Return the bound request id, generating one if none is set."""
    current = get_request_id()
    if current:
        return current
    generated = generate_request_id()
    set_request_id(generated)
    return generated
