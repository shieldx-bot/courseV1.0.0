"""Event Governance API — self-documenting catalog, dependency graph, diagnostics.

Exposes bus.registrations-driven views so the event system is discoverable,
traceable, and governable. All data is DERIVED from runtime registrations —
never maintained manually.
"""

from fastapi import APIRouter, Depends

from app.core.deps import require_admin
from app.core.events import bus as event_bus
from app.core.response import api_response

router = APIRouter(prefix="/admin/events", tags=["admin-events"])
AdminDep = Depends(require_admin)


@router.get("/catalog")
async def event_catalog(user: dict = AdminDep):
    """Centralized Event Catalog (every documented event + consumers + stats)."""
    return api_response({"events": event_bus.catalog()})


@router.get("/dependencies")
async def event_dependencies(user: dict = AdminDep):
    """Dependency graph (event → consumers), generated from registrations."""
    return api_response({"edges": event_bus.dependencies()})


@router.get("/diagnostics")
async def event_diagnostics(user: dict = AdminDep):
    """Health: activity, slowest handlers, failures, unused events, orphans."""
    return api_response(event_bus.diagnostics())