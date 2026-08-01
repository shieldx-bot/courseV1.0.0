"""Lightweight in-process Domain Event Bus.

Design goals:
  - Simple, typed, observable, testable — no framework dependency.
  - Synchronous handlers today; the publish contract allows async fan-out later.
  - Failure isolation: one handler failing never blocks others.
  - Idempotency: duplicate publishes of the same event are skipped per-correlation.
  - Every event carries metadata: name, payload, producer, correlation_id,
    timestamp (ISO-8601 UTC), and a version for backward-compat strategy.
"""

import asyncio
import logging
import uuid
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, Awaitable, Callable

logger = logging.getLogger(__name__)

Handler = Callable[["Event"], Awaitable[None]]


@dataclass(frozen=True)
class Event:
    name: str
    payload: dict
    producer: str
    version: int = 1
    correlation_id: str = field(default_factory=lambda: uuid.uuid4().hex)
    timestamp: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

    def __str__(self) -> str:
        return f"Event[{self.name} v{self.version} {self.correlation_id[:8]}]"


class EventBus:
    def __init__(self) -> None:
        self._handlers: dict[str, list[Handler]] = {}
        self._processed: set[tuple[str, str, Any]] = set()
        # Observability counters
        self.stats: dict[str, dict[str, int]] = {}  # event_name -> {published, ok, failed}

    def subscribe(self, event_name: str, handler: Handler) -> None:
        self._handlers.setdefault(event_name, []).append(handler)

    def unsubscribe(self, event_name: str, handler: Handler) -> None:
        handlers = self._handlers.get(event_name, [])
        if handler in handlers:
            handlers.remove(handler)

    async def publish(self, event: Event) -> int:
        """Await all registered handlers.

        Returns number of handlers executed. A failed handler is logged and
        isolated; remaining handlers still run. Duplicate publishes (same
        event name + payload) are skipped to preserve idempotency.

        Safe to call from within a running event loop (FastAPI handlers).
        """
        dedup_key = (event.name, event.correlation_id, str(sorted(event.payload.items(), key=lambda x: str(x[0]))))
        if dedup_key in self._processed:
            logger.info("Event %s skipped (duplicate publish)", event)
            return 0
        self._processed.add(dedup_key)

        stat = self.stats.setdefault(event.name, {"published": 0, "ok": 0, "failed": 0})
        stat["published"] += 1

        executed = 0
        for handler in self._handlers.get(event.name, []):
            try:
                result = handler(event)
                if hasattr(result, "__await__"):
                    await result
                stat["ok"] += 1
                executed += 1
                logger.info("Event %s handled by %s", event, getattr(handler, "__name__", "handler"))
            except Exception as exc:
                stat["failed"] += 1
                logger.exception("Event %s handler failed: %s", event, exc)
        return executed

    def reset(self) -> None:
        """Clear handlers + processed-set + stats (for tests)."""
        self._handlers.clear()
        self._processed.clear()
        self.stats.clear()


# Global singleton
bus = EventBus()