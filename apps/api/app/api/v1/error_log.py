"""Error log API endpoints.

Public:
    POST /api/v1/error-log          — receive errors from frontend/worker

Admin:
    GET    /api/v1/admin/error-log          — list errors
    GET    /api/v1/admin/error-log/stats    — summary stats
    GET    /api/v1/admin/error-log/:id      — single error detail
    PATCH  /api/v1/admin/error-log/:id      — update (resolve, tags, context)
    GET    /api/v1/admin/error-log/export   — export as JSON
"""

from __future__ import annotations

import csv
import io
import logging
from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from pydantic import BaseModel, Field

from app.core.config import settings
from app.core.deps import require_admin
from app.core.error_logger import (
    CATEGORY_HTTP,
    CATEGORY_SYSTEM,
    LEVEL_CRITICAL,
    LEVEL_ERROR,
    LEVEL_WARNING,
    SOURCE_BACKEND,
    SOURCE_FRONTEND,
    SOURCE_WORKER,
    VALID_CATEGORIES,
    VALID_LEVELS,
    ErrorLogger,
    get_error_logger,
    _utcnow_iso,
)
from app.db.mongodb import get_db

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------


class ErrorLogIngest(BaseModel):
    """Schema accepted from frontend / worker."""

    source: str = Field(..., description="frontend | worker | backend | cli")
    service: str = Field("web", description="api | web | worker")
    level: str = Field(LEVEL_ERROR)
    category: str = Field(CATEGORY_SYSTEM)
    error_type: str = Field("")
    message: str = Field("")
    url: str | None = None
    method: str | None = None
    status_code: int | None = None
    user_id: str | None = None
    ip_address: str | None = None
    user_agent: str | None = None
    request_body: Any = None
    query_params: Any = None
    context: dict[str, Any] | None = None
    tags: list[str] | None = None
    stack_trace: str | None = None
    environment: str | None = None


class ErrorLogResolve(BaseModel):
    resolved: bool = True
    tags: list[str] | None = None
    context: dict[str, Any] | None = None


# ---------------------------------------------------------------------------
# Public — no auth required (rate-limited externally)
# ---------------------------------------------------------------------------

public_router = APIRouter()


@public_router.post("/error-log")
async def ingest_error_log(request: Request, body: ErrorLogIngest):
    """Accept error reports from frontend and worker services."""
    client_host = request.client.host if request.client else None
    ip_address = body.ip_address or client_host

    # Normalize
    if body.source not in {SOURCE_BACKEND, SOURCE_FRONTEND, SOURCE_WORKER, "cli"}:
        body.source = SOURCE_BACKEND

    await get_error_logger().log(
        source=body.source,
        level=body.level,
        category=body.category,
        error_type=body.error_type,
        message=body.message,
        url=body.url,
        method=body.method,
        status_code=body.status_code,
        user_id=body.user_id,
        ip_address=ip_address,
        user_agent=body.user_agent,
        request_body=body.request_body,
        query_params=body.query_params,
        context=body.context,
        tags=body.tags,
        stack_trace=body.stack_trace,
        service=body.service,
        environment=body.environment,
    )
    return {"ok": True}


# ---------------------------------------------------------------------------
# Admin — auth required
# ---------------------------------------------------------------------------

admin_router = APIRouter()


def _build_query(
    source: str | None = None,
    level: str | None = None,
    category: str | None = None,
    service: str | None = None,
    resolved: bool | None = None,
    search: str | None = None,
    from_ts: str | None = None,
    to_ts: str | None = None,
) -> dict[str, Any]:
    query: dict[str, Any] = {}
    if source:
        query["source"] = source
    if level:
        query["level"] = level
    if category:
        query["category"] = category
    if service:
        query["service"] = service
    if resolved is not None:
        query["resolved"] = resolved
    if search:
        query["$or"] = [
            {"message": {"$regex": search, "$options": "i"}},
            {"error_type": {"$regex": search, "$options": "i"}},
            {"stack_trace": {"$regex": search, "$options": "i"}},
        ]
    if from_ts or to_ts:
        ts_query: dict[str, Any] = {}
        if from_ts:
            ts_query["$gte"] = from_ts
        if to_ts:
            ts_query["$lte"] = to_ts
        query["timestamp"] = ts_query
    return query


@admin_router.get("/error-log")
async def list_error_logs(
    _user: dict = Depends(require_admin),
    source: str | None = None,
    level: str | None = None,
    category: str | None = None,
    service: str | None = None,
    resolved: bool | None = None,
    search: str | None = None,
    from_ts: str | None = None,
    to_ts: str | None = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
):
    db = get_db()
    query = _build_query(source, level, category, service, resolved, search, from_ts, to_ts)

    total = await db.error_logs.count_documents(query)
    cursor = (
        db.error_logs.find(query)
        .sort("timestamp", -1)
        .skip((page - 1) * page_size)
        .limit(page_size)
    )
    items = []
    async for doc in cursor:
        doc.pop("_id", None)
        items.append(doc)

    return {
        "items": items,
        "total": total,
        "page": page,
        "page_size": page_size,
    }


@admin_router.get("/error-log/stats")
async def error_log_stats(
    _user: dict = Depends(require_admin),
    from_ts: str | None = None,
    to_ts: str | None = None,
):
    db = get_db()
    query = _build_query(from_ts=from_ts, to_ts=to_ts)

    pipeline = [
        {"$match": query},
        {
            "$group": {
                "_id": None,
                "total": {"$sum": 1},
                "by_level": {
                    "$push": "$level",
                },
                "by_category": {
                    "$push": "$category",
                },
                "by_source": {
                    "$push": "$source",
                },
                "unresolved": {
                    "$sum": {"$cond": [{"$eq": ["$resolved", False]}, 1, 0]},
                },
            }
        },
    ]

    results = await db.error_logs.aggregate(pipeline).to_list(1)
    if not results:
        return {
            "total": 0,
            "by_level": {},
            "by_category": {},
            "by_source": {},
            "unresolved": 0,
        }

    r = results[0]

    def _count(items: list[str]) -> dict[str, int]:
        out: dict[str, int] = {}
        for item in items:
            out[item] = out.get(item, 0) + 1
        return out

    return {
        "total": r.get("total", 0),
        "by_level": _count(r.get("by_level", [])),
        "by_category": _count(r.get("by_category", [])),
        "by_source": _count(r.get("by_source", [])),
        "unresolved": r.get("unresolved", 0),
    }


@admin_router.get("/error-log/{error_id}")
async def get_error_log_detail(error_id: str, _user: dict = Depends(require_admin)):
    db = get_db()
    doc = await db.error_logs.find_one({"id": error_id})
    if not doc:
        raise HTTPException(status_code=404, detail="Error log not found")
    doc.pop("_id", None)
    return doc


@admin_router.patch("/error-log/{error_id}")
async def update_error_log(
    error_id: str,
    body: ErrorLogResolve,
    _user: dict = Depends(require_admin),
    request: Request = None,  # type: ignore[assignment]
):
    db = get_db()
    existing = await db.error_logs.find_one({"id": error_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Error log not found")

    update: dict[str, Any] = {}
    if body.resolved is not None:
        update["resolved"] = body.resolved
        if body.resolved:
            update["resolved_at"] = _utcnow_iso()
            update["resolved_by"] = (
                _user.get("id") if isinstance(_user, dict) else None
            )
        else:
            update["resolved_at"] = None
            update["resolved_by"] = None
    if body.tags is not None:
        update["tags"] = body.tags
    if body.context is not None:
        update["context"] = body.context

    await db.error_logs.update_one({"id": error_id}, {"$set": update})
    updated = await db.error_logs.find_one({"id": error_id})
    updated.pop("_id", None)
    return updated


@admin_router.get("/error-log/export")
async def export_error_logs(
    _user: dict = Depends(require_admin),
    source: str | None = None,
    level: str | None = None,
    category: str | None = None,
    service: str | None = None,
    resolved: bool | None = None,
    search: str | None = None,
    from_ts: str | None = None,
    to_ts: str | None = None,
    format: str = Query("json", pattern="^(json|csv)$"),
):
    db = get_db()
    query = _build_query(source, level, category, service, resolved, search, from_ts, to_ts)

    cursor = db.error_logs.find(query).sort("timestamp", -1).limit(10_000)
    items = []
    async for doc in cursor:
        doc.pop("_id", None)
        items.append(doc)

    if format == "csv":
        if not items:
            return ""
        buf = io.StringIO()
        fieldnames = list(items[0].keys())
        writer = csv.DictWriter(buf, fieldnames=fieldnames)
        writer.writeheader()
        for row in items:
            # Flatten nested structures for CSV
            flat = {}
            for k, v in row.items():
                if isinstance(v, (dict, list)):
                    flat[k] = json.dumps(v, ensure_ascii=False, default=str)
                else:
                    flat[k] = v
            writer.writerow(flat)
        from fastapi.responses import Response

        return Response(content=buf.getvalue(), media_type="text/csv")

    return items
