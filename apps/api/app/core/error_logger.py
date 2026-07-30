"""Centralized error logging system.

Persists error events from backend, frontend, and worker into:
- JSONL files under ERROR_LOG_DIR (append-only, one object per line)
- MongoDB collection ``error_logs`` (optional, for distributed/search)

Usage:
    from app.core.error_logger import ErrorLogger, get_error_logger

    await get_error_logger().log(
        source="backend",
        level="error",
        category="database",
        error_type="ConnectionError",
        message="MongoDB connection timeout",
        url="/api/v1/courses",
        method="GET",
        status_code=500,
        user_id="user_123",
        ip_address="10.0.0.1",
        user_agent="python-httpx/0.27.0",
        context={"db_host": "mongo:27017", "timeout": 30},
        tags=["database", "mongo"],
        stack_trace="Traceback (most recent call last): ...",
    )
"""

from __future__ import annotations

import hashlib
import json
import logging
import os
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from app.core.config import settings

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Schema / defaults
# ---------------------------------------------------------------------------

SOURCE_BACKEND = "backend"
SOURCE_FRONTEND = "frontend"
SOURCE_WORKER = "worker"
SOURCE_CLI = "cli"

LEVEL_ERROR = "error"
LEVEL_WARNING = "warning"
LEVEL_CRITICAL = "critical"

CATEGORY_HTTP = "http"
CATEGORY_VALIDATION = "validation"
CATEGORY_DATABASE = "database"
CATEGORY_AUTH = "auth"
CATEGORY_BUSINESS = "business"
CATEGORY_SYSTEM = "system"
CATEGORY_FRONTEND = "frontend"
CATEGORY_NETWORK = "network"

VALID_LEVELS = {LEVEL_ERROR, LEVEL_WARNING, LEVEL_CRITICAL}
VALID_CATEGORIES = {
    CATEGORY_HTTP,
    CATEGORY_VALIDATION,
    CATEGORY_DATABASE,
    CATEGORY_AUTH,
    CATEGORY_BUSINESS,
    CATEGORY_SYSTEM,
    CATEGORY_FRONTEND,
    CATEGORY_NETWORK,
}


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _utcnow_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _generate_fingerprint(error_type: str, message: str, category: str) -> str:
    """Deterministic fingerprint for grouping duplicate errors."""
    raw = "|".join([error_type or "", message or "", category or ""])
    return hashlib.sha256(raw.encode()).hexdigest()


def _sanitize_for_json(value: Any) -> Any:
    """Best-effort conversion to JSON-serializable types."""
    if value is None or isinstance(value, (bool, int, float, str)):
        return value
    if isinstance(value, dict):
        return {str(k): _sanitize_for_json(v) for k, v in value.items()}
    if isinstance(value, (list, tuple)):
        return [_sanitize_for_json(v) for v in value]
    return str(value)


# ---------------------------------------------------------------------------
# JSONL file writer
# ---------------------------------------------------------------------------


class JsonlWriter:
    """Append-only JSONL file writer with size-based rotation."""

    def __init__(
        self,
        directory: str,
        max_file_size_mb: int = 100,
        retention_days: int = 30,
    ) -> None:
        self._dir = Path(directory)
        self._max_bytes = max_file_size_mb * 1024 * 1024
        self._retention_days = retention_days
        self._current_path: Path | None = None
        self._current_size: int = 0

        self._dir.mkdir(parents=True, exist_ok=True)

    def _get_today_filename(self) -> str:
        return f"errors-{datetime.now(timezone.utc).strftime('%Y-%m-%d')}.jsonl"

    def _ensure_current_file(self) -> Path:
        if self._current_path is None or self._current_size >= self._max_bytes:
            filename = self._get_today_filename()
            self._current_path = self._dir / filename
            if self._current_path.exists():
                self._current_size = self._current_path.stat().st_size
            else:
                self._current_size = 0
        return self._current_path

    def append(self, record: dict[str, Any]) -> None:
        path = self._ensure_current_file()
        line = json.dumps(record, ensure_ascii=False, default=str)
        try:
            with path.open("a", encoding="utf-8") as fh:
                fh.write(line + "\n")
            self._current_size += len(line.encode("utf-8")) + 1
        except OSError as exc:
            logger.warning("Failed to write error log to %s: %s", path, exc)

    def cleanup_old_files(self) -> None:
        """Remove files older than ``retention_days``."""
        cutoff = time.time() - (self._retention_days * 86400)
        try:
            for fp in self._dir.glob("errors-*.jsonl"):
                try:
                    if fp.stat().st_mtime < cutoff:
                        fp.unlink()
                        logger.debug("Deleted old error log file: %s", fp.name)
                except OSError:
                    pass
        except OSError:
            pass


# ---------------------------------------------------------------------------
# Core logger
# ---------------------------------------------------------------------------


class ErrorLogger:
    """Centralized error logger.

    Writes to JSONL files and optionally to MongoDB ``error_logs`` collection.
    """

    def __init__(self) -> None:
        self._writer: JsonlWriter | None = None
        self._enabled = bool(settings.error_log_dir)

    def _get_writer(self) -> JsonlWriter | None:
        if self._writer is None and self._enabled:
            try:
                self._writer = JsonlWriter(
                    directory=settings.error_log_dir,
                    max_file_size_mb=settings.error_log_max_file_size_mb,
                    retention_days=settings.error_log_retention_days,
                )
            except Exception as exc:
                logger.warning("Error log writer init failed: %s", exc)
                self._enabled = False
        return self._writer

    async def log(  # noqa: C901 — keep readable
        self,
        *,
        source: str,
        level: str = LEVEL_ERROR,
        category: str = CATEGORY_SYSTEM,
        error_type: str = "",
        message: str = "",
        url: str | None = None,
        method: str | None = None,
        status_code: int | None = None,
        user_id: str | None = None,
        ip_address: str | None = None,
        user_agent: str | None = None,
        request_body: Any = None,
        query_params: Any = None,
        context: dict[str, Any] | None = None,
        tags: list[str] | None = None,
        stack_trace: str | None = None,
        service: str = "api",
        environment: str | None = None,
        resolved: bool = False,
        resolved_at: str | None = None,
        resolved_by: str | None = None,
    ) -> dict[str, Any] | None:
        """Record a single error event.

        Returns the stored document dict on success, ``None`` on failure.
        """
        if level not in VALID_LEVELS:
            level = LEVEL_ERROR
        if category not in VALID_CATEGORIES:
            category = CATEGORY_SYSTEM

        now = _utcnow_iso()
        env = environment or settings.environment
        fingerprint = _generate_fingerprint(error_type, message, category)

        record: dict[str, Any] = {
            "id": hashlib.sha256(
                f"{now}|{source}|{fingerprint}|{message}".encode()
            ).hexdigest()[:32],
            "timestamp": now,
            "source": source,
            "service": service,
            "environment": env,
            "level": level,
            "category": category,
            "error_type": error_type or "Unknown",
            "message": message or "An error occurred",
            "stack_trace": stack_trace,
            "url": url,
            "method": method,
            "status_code": status_code,
            "user_id": user_id,
            "ip_address": ip_address,
            "user_agent": user_agent,
            "request_body": _sanitize_for_json(request_body),
            "query_params": _sanitize_for_json(query_params),
            "context": _sanitize_for_json(context) or {},
            "fingerprint": fingerprint,
            "resolved": resolved,
            "resolved_at": resolved_at,
            "resolved_by": resolved_by,
            "tags": tags or [],
        }

        # --- JSONL ---
        writer = self._get_writer()
        if writer is not None:
            writer.append(record)
            # Periodically cleanup (cheap: runs per write, but filesystem stat is fast)
            if hash(record["id"]) % 50 == 0:
                writer.cleanup_old_files()

        # --- MongoDB ---
        if settings.error_log_to_mongodb:
            try:
                from app.db.mongodb import get_db  # local import to avoid cycles

                db = get_db()
                # InMemoryDB doesn't support create_index; skip gracefully
                try:
                    await db.error_logs.insert_one(record)
                except Exception:
                    # If collection/index missing on InMemoryDB, ignore silently
                    pass
            except Exception as exc:
                logger.debug("MongoDB error log write skipped: %s", exc)

        return record

    async def log_exception(
        self,
        exc: BaseException,
        *,
        source: str = SOURCE_BACKEND,
        category: str = CATEGORY_SYSTEM,
        url: str | None = None,
        method: str | None = None,
        status_code: int | None = None,
        user_id: str | None = None,
        ip_address: str | None = None,
        user_agent: str | None = None,
        request_body: Any = None,
        query_params: Any = None,
        context: dict[str, Any] | None = None,
        tags: list[str] | None = None,
        service: str = "api",
        environment: str | None = None,
    ) -> dict[str, Any] | None:
        """Convenience wrapper that extracts error details from an exception."""
        error_type = type(exc).__name__
        message = str(exc)
        stack_trace = "".join(
            __import__("traceback").format_exception(type(exc), exc, exc.__traceback__)
        )
        return await self.log(
            source=source,
            level=LEVEL_ERROR,
            category=category,
            error_type=error_type,
            message=message,
            url=url,
            method=method,
            status_code=status_code,
            user_id=user_id,
            ip_address=ip_address,
            user_agent=user_agent,
            request_body=request_body,
            query_params=query_params,
            context=context,
            tags=tags,
            stack_trace=stack_trace,
            service=service,
            environment=environment,
        )


# ---------------------------------------------------------------------------
# Singleton accessor
# ---------------------------------------------------------------------------


def get_error_logger() -> ErrorLogger:
    """Return the module-level ``ErrorLogger`` singleton."""
    if not hasattr(get_error_logger, "_instance"):
        get_error_logger._instance = ErrorLogger()  # type: ignore[attr-defined]
    return get_error_logger._instance  # type: ignore[attr-defined]
