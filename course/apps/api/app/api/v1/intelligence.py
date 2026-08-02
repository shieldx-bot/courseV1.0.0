"""Platform Intelligence API — operational admin overview.

Not analytics. Operational intelligence: health KPIs, urgent problems,
growth opportunities, and self-improvement recommendations — all computed
live from existing collections via app/services/intelligence.py.
"""

from fastapi import APIRouter, Depends

from app.core.deps import require_admin
from app.core.response import api_response
from app.services import intelligence as intel

router = APIRouter(prefix="/admin/intelligence", tags=["admin-intelligence"])
AdminDep = Depends(require_admin)


@router.get("/overview")
async def intelligence_overview(user: dict = AdminDep):
    """Health KPIs + urgent problems + growth opportunities + recommendations."""
    result = await intel.overview()
    return api_response(result)