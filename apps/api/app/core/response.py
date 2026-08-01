from typing import Any
from fastapi.responses import JSONResponse
from pydantic import BaseModel


class APIResponse(BaseModel):
    success: bool
    data: dict | list | None
    error: str | None
    meta: dict | None = None


def api_response(data: Any, meta: dict | None = None) -> dict:
    return {
        "success": True,
        "data": data,
        "error": None,
        "meta": meta,
    }


def error_response(message: str, status_code: int) -> JSONResponse:
    return JSONResponse(
        status_code=status_code,
        content={
            "success": False,
            "data": None,
            "error": message,
            "meta": None,
        },
    )


def service_response(result: dict):
    """Normalize a service-layer result into the correct HTTP envelope.

    Guardrail: service functions return ``{"error": True, "message": "..."}``
    for domain failures. This helper converts those into proper 4xx responses
    so routers never accidentally return HTTP 200 + success:true on failure.

    - message containing "not found" / "missing" / "does not exist" -> 404
    - validation / authorization / capacity errors                  -> 400
    - anything without ``error``                                      -> 200 api_response
    """
    if result.get("error"):
        msg = str(result.get("message", "Request failed"))
        lowered = msg.lower()
        if any(k in lowered for k in ("not found", "missing", "does not exist", "no such")):
            return error_response(msg, 404)
        return error_response(msg, 400)
    return api_response(result)
