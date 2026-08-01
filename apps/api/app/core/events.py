"""Lightweight in-process Domain Event Bus with Governance.

Design goals:
  - Simple, typed, observable, testable — no framework dependency.
  - In-process synchronous handlers; publish contract allows async fan-out later.
  - Failure isolation: one handler failing never blocks others.
  - Idempotency: duplicate publishes (same correlation + payload) are skipped.
  - Governance: every event has an immutable EventSpec; every handler is
    registered with a domain + name; catalog, dependency graph, and health
    diagnostics are DERIVED from registrations — never maintained manually.

Event rules:
  - Names use past tense, PascalCase (ChallengeCompleted, EventCreated).
  - Events are immutable; handlers never mutate payloads.
  - Handlers never publish recursive copies of the same event (loops guarded).
  - Breaking payload changes require bumping version (+1).
"""

import logging
import time
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


@dataclass(frozen=True)
class EventSpec:
    """Immutable contract (the Event Catalog entry)."""
    name: str
    description: str
    producer: str                       # e.g. "community.submit_challenge"
    payload_schema: dict                # field -> short type/description
    side_effects: tuple[str, ...]       # what listeners do
    idempotency: str                    # how duplicates are deduped
    example_payload: dict
    version: int = 1
    related_events: tuple[str, ...] = ()
    deprecated: bool = False


@dataclass
class HandlerSpec:
    handler: Handler
    event_name: str
    domain: str                         # e.g. "community", "creator", "notifications"
    name: str                           # handler name (diagnostics key)


class EventBus:
    def __init__(self) -> None:
        self._handlers: dict[str, list[HandlerSpec]] = {}
        self._specs: dict[str, EventSpec] = {}
        self._processed: set[tuple[str, str, str]] = set()
        # Observability
        self.stats: dict[str, dict[str, int]] = {}          # event -> {published, ok, failed}
        self.handler_stats: dict[str, dict[str, Any]] = {}  # handler -> {ok, failed, total_duration, count}

    # ── Registration ─────────────────────────────────────────────────────────
    def register(self, handler: Handler, *, domain: str, event_name: str, spec: EventSpec | None = None) -> None:
        hname = getattr(handler, "__name__", f"{domain}_{event_name}")
        self._handlers.setdefault(event_name, []).append(HandlerSpec(handler, event_name, domain, hname))
        self.handler_stats.setdefault(hname, {"ok": 0, "failed": 0, "total_duration": 0.0, "count": 0})
        if spec is not None:
            self._specs[event_name] = spec
        logger.info("Registered handler %s for %s (domain=%s)", hname, event_name, domain)

    def subscribe(self, event_name: str, handler: Handler) -> None:
        """Backward-compat alias (domain defaults to 'unknown')."""
        self.register(handler, domain="unknown", event_name=event_name)

    def unsubscribe(self, event_name: str, handler: Handler) -> None:
        self._handlers[event_name] = [h for h in self._handlers.get(event_name, []) if h.handler != handler]

    # ── Publish ──────────────────────────────────────────────────────────────
    async def publish(self, event: Event) -> int:
        dedup_key = (event.name, event.correlation_id, str(sorted(event.payload.items(), key=lambda x: str(x[0]))))
        if dedup_key in self._processed:
            logger.info("Event %s skipped (duplicate publish)", event)
            return 0
        self._processed.add(dedup_key)

        stat = self.stats.setdefault(event.name, {"published": 0, "ok": 0, "failed": 0})
        stat["published"] += 1

        executed = 0
        for hs in self._handlers.get(event.name, []):
            hstat = self.handler_stats.setdefault(hs.name, {"ok": 0, "failed": 0, "total_duration": 0.0, "count": 0})
            start = time.perf_counter()
            try:
                result = hs.handler(event)
                if hasattr(result, "__await__"):
                    await result
                stat["ok"] += 1
                executed += 1
                hstat["ok"] += 1
            except Exception as exc:
                stat["failed"] += 1
                hstat["failed"] += 1
                logger.exception("Event %s handler %s failed: %s", event, hs.name, exc)
            hstat["total_duration"] += time.perf_counter() - start
            hstat["count"] += 1
        return executed

    # ── Governance / Observability ───────────────────────────────────────────
    @property
    def specs(self) -> dict[str, EventSpec]:
        return dict(self._specs)

    def catalog(self) -> list[dict]:
        """Event Catalog — derived from registrations, never maintained manually."""
        out = []
        for name, spec in sorted(self._specs.items(), key=lambda x: x[0]):
            stat = self.stats.get(name, {"published": 0, "ok": 0, "failed": 0})
            out.append({
                "name": spec.name, "version": spec.version, "description": spec.description,
                "producer": spec.producer, "payload_schema": spec.payload_schema,
                "side_effects": list(spec.side_effects), "idempotency": spec.idempotency,
                "example_payload": spec.example_payload, "related_events": list(spec.related_events),
                "deprecated": spec.deprecated,
                "consumers": [{"domain": hs.domain, "handler": hs.name} for hs in self._handlers.get(name, [])],
                "published": stat["published"], "consumers_ok": stat["ok"], "consumers_failed": stat["failed"],
            })
        return out

    def dependencies(self) -> list[dict]:
        """Dependency graph edges (event name -> consumer domains)."""
        return [
            {"event": name, "consumers": [{"domain": hs.domain, "handler": hs.name} for hs in hs_list]}
            for name, hs_list in sorted(self._handlers.items())
            if name in self._specs and hs_list
        ]

    def diagnostics(self) -> dict:
        """Health: activity, slowest handlers, failures, unused events, orphans."""
        slowest = sorted(
            (
                {
                    "handler": n,
                    "avg_ms": round(s["total_duration"] / s["count"] * 1000, 2) if s["count"] else 0.0,
                    "total_ms": round(s["total_duration"] * 1000, 2),
                    "ok": s["ok"], "failed": s["failed"], "count": s["count"],
                }
                for n, s in self.handler_stats.items()
            ),
            key=lambda x: x["avg_ms"], reverse=True,
        )
        events = [
            {
                "event": name, "published": stat["published"],
                "consumers_ok": stat["ok"], "consumers_failed": stat["failed"],
                "consumers_count": len(self._handlers.get(name, [])),
            }
            for name, stat in self.stats.items()
        ]
        return {
            "total_events": len(self._specs),
            "total_published": sum(s["published"] for s in self.stats.values()),
            "events": sorted(events, key=lambda x: x["published"], reverse=True),
            "slowest_handlers": slowest[:10],
            "unused_events": [name for name in self._specs if name not in self.stats or self.stats[name]["published"] == 0],
            "orphan_listeners": [name for name, hs_list in self._handlers.items() if name not in self._specs and hs_list],
        }

    def reset(self) -> None:
        self._handlers.clear()
        self._specs.clear()
        self._processed.clear()
        self.stats.clear()
        self.handler_stats.clear()


# Global singleton
bus = EventBus()