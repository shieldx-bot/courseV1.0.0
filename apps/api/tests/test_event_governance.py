"""Tests for Event Governance — catalog, dependency graph, diagnostics, self-documentation."""
import os

os.environ["MONGODB_URI"] = "memory://test"

import asyncio

from app.core.events import Event, EventBus, EventSpec


def _await(coro):
    return asyncio.run(coro)


def test_bus_register_documents_spec():
    """Handlers registered with EventSpec appear in the catalog."""
    bus = EventBus()

    async def h(event: Event):
        pass

    spec = EventSpec(
        name="TestHappened", version=1, description="A test event.",
        producer="tests", payload_schema={"id": "str"}, side_effects=("none",),
        idempotency="id unique", example_payload={"id": "x"},
    )
    bus.register(h, domain="testdomain", event_name="TestHappened", spec=spec)

    catalog = bus.catalog()
    assert len(catalog) == 1
    entry = catalog[0]
    assert entry["name"] == "TestHappened"
    assert entry["description"] == "A test event."
    assert entry["producer"] == "tests"
    assert entry["side_effects"] == ["none"]
    assert entry["consumers"] == [{"domain": "testdomain", "handler": "h"}]


def test_catalog_requires_spec_no_orphans():
    """Every registered event must have documentation (a spec)."""
    bus = EventBus()

    async def documented(event: Event):
        pass

    async def undocumented(event: Event):
        pass

    bus.register(documented, domain="a", event_name="Documented", spec=EventSpec(
        name="Documented", version=1, description="doc", producer="p", payload_schema={},
        side_effects=(), idempotency="x", example_payload={},
    ))
    # Registering without a spec should mark the event as orphaned
    bus.register(undocumented, domain="b", event_name="Undocumented")

    diagnostics = bus.diagnostics()
    assert "Undocumented" in diagnostics["orphan_listeners"]
    assert len(diagnostics["unused_events"]) == 1  # no events published yet


def test_diagnostics_tracks_publish_and_handler_stats():
    """Publishing updates metrics: events active, handler timings tracked."""
    bus = EventBus()

    async def h(event: Event):
        pass

    bus.register(h, domain="d", event_name="Active", spec=EventSpec(
        name="Active", version=1, description="d", producer="p", payload_schema={},
        side_effects=(), idempotency="x", example_payload={},
    ))
    _await(bus.publish(Event(name="Active", payload={}, producer="test")))
    _await(bus.publish(Event(name="Active", payload={"n": 2}, producer="test")))

    diag = bus.diagnostics()
    assert diag["total_events"] == 1
    assert diag["total_published"] == 2
    assert diag["events"][0]["event"] == "Active"
    assert diag["events"][0]["published"] == 2
    assert len(diag["slowest_handlers"]) == 1
    assert diag["slowest_handlers"][0]["handler"] == "h"
    assert diag["slowest_handlers"][0]["count"] == 2


def test_dependencies_graph_derived():
    """Dependency edges list event → consumer domains."""
    bus = EventBus()

    async def a(event: Event):
        pass

    async def b(event: Event):
        pass

    bus.register(a, domain="community", event_name="Graph", spec=EventSpec(
        name="Graph", version=1, description="d", producer="p", payload_schema={},
        side_effects=(), idempotency="x", example_payload={},
    ))
    bus.register(b, domain="notifications", event_name="Graph", spec=None)

    edges = bus.dependencies()
    assert len(edges) == 1
    assert {c["domain"] for c in edges[0]["consumers"]} == {"community", "notifications"}


def test_admin_governance_endpoints():
    """Admin endpoints expose catalog, dependencies, diagnostics with real handlers."""
    from fastapi.testclient import TestClient
    from app.main import app
    from app.services.event_handlers import register_default_handlers
    from app.core.events import bus as global_bus

    global_bus.reset()
    register_default_handlers(global_bus)

    with TestClient(app) as client:
        res = client.post("/api/v1/auth/login", json={"email": "admin@ascendly.io", "password": "password"})
        assert res.status_code == 200, res.text
        token = res.json()["data"]["access_token"]
        headers = {"Authorization": f"Bearer {token}"}

        # Catalog contains both events with full spec documentation
        res = client.get("/api/v1/admin/events/catalog", headers=headers)
        assert res.status_code == 200, res.text
        events = res.json()["data"]["events"]
        names = {e["name"] for e in events}
        assert {"ChallengeCompleted", "EventCreated"}.issubset(names)
        for e in events:
            assert e["description"]                     # documented
            assert e["payload_schema"]                 # payload schema
            assert e["idempotency"]                    # idempotency strategy
            assert e["consumers"]                      # consumers listed

        # Dependency graph derived from registrations
        res = client.get("/api/v1/admin/events/dependencies", headers=headers)
        assert res.status_code == 200, res.text
        edges = res.json()["data"]["edges"]
        domains = {d for e in edges for d in (c["domain"] for c in e["consumers"])}
        assert "community" in domains
        assert "creator" in domains
        assert "notifications" in domains

        # Diagnostics
        res = client.get("/api/v1/admin/events/diagnostics", headers=headers)
        assert res.status_code == 200, res.text
        diag = res.json()["data"]
        assert diag["total_events"] == 12  # ChallengeCompleted, EventCreated + 10 Phase 7 events
        assert "slowest_handlers" in diag
        assert diag["orphan_listeners"] == []  # every listener documented