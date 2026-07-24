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