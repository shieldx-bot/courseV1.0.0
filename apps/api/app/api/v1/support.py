from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field

from app.core.deps import get_current_user, get_optional_user, require_admin
from app.core.response import api_response
from app.db.mongodb import get_db
from app.services.support_tickets import (
    VALID_STATUSES,
    create_ticket,
    get_ticket,
    get_ticket_messages,
    get_user_tickets,
    list_tickets,
    rate_ticket,
    update_ticket_status,
    assign_ticket as assign_ticket_svc,
)
from app.services.knowledge_base import (
    get_article,
    search_articles,
    list_articles as list_articles_svc,
    record_article_feedback,
)

router = APIRouter()
admin_router = APIRouter()


# ── User ticket endpoints ────────────────────────────────────────────────────


class TicketIn(BaseModel):
    subject: str = Field(min_length=1, max_length=200)
    message: str = Field(min_length=1, max_length=5000)
    category: str | None = None


class MessageIn(BaseModel):
    content: str = Field(min_length=1, max_length=5000)


class SatisfactionIn(BaseModel):
    rating: int = Field(ge=1, le=5)


@router.get("/tickets")
async def list_my_tickets(user=Depends(get_current_user)):
    tickets = await get_user_tickets(user["id"])
    result = []
    for t in tickets:
        item = {k: v for k, v in t.items() if k != "_id"}
        item["id"] = t["_id"]
        result.append(item)
    return api_response(result)


@router.get("/tickets/{ticket_id}")
async def get_ticket_detail(ticket_id: str, user=Depends(get_current_user)):
    ticket = await get_ticket(ticket_id)
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    if ticket["user_id"] != user["id"]:
        raise HTTPException(status_code=403, detail="Not allowed")

    messages = await get_ticket_messages(ticket_id)
    msg_list = []
    for m in messages:
        item = {k: v for k, v in m.items() if k != "_id"}
        item["id"] = m["_id"]
        msg_list.append(item)

    result = {k: v for k, v in ticket.items() if k != "_id"}
    result["id"] = ticket["_id"]
    result["messages"] = msg_list
    return api_response(result)


@router.post("/tickets")
async def create_ticket_endpoint(body: TicketIn, user=Depends(get_current_user)):
    ticket = await create_ticket(
        user_id=user["id"],
        user_email=user["email"],
        user_name=user.get("name", ""),
        subject=body.subject,
        message=body.message,
        category=body.category,
    )
    result = {k: v for k, v in ticket.items() if k != "_id"}
    result["id"] = ticket["_id"]
    return api_response(result)


@router.post("/tickets/{ticket_id}/messages")
async def add_ticket_message(ticket_id: str, body: MessageIn, user=Depends(get_current_user)):
    ticket = await get_ticket(ticket_id)
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    if ticket["user_id"] != user["id"]:
        raise HTTPException(status_code=403, detail="Not allowed")

    if ticket["status"] in ("resolved", "closed"):
        raise HTTPException(status_code=400, detail="Ticket is closed")

    msg = await add_message(
        ticket_id=ticket_id,
        sender_type="user",
        sender_id=user["id"],
        sender_name=user.get("name", ""),
        content=body.content,
    )
    result = {k: v for k, v in msg.items() if k != "_id"}
    result["id"] = msg["_id"]
    return api_response(result)


@router.post("/tickets/{ticket_id}/satisfaction")
async def rate_ticket_endpoint(ticket_id: str, body: SatisfactionIn, user=Depends(get_current_user)):
    ticket = await get_ticket(ticket_id)
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    if ticket["user_id"] != user["id"]:
        raise HTTPException(status_code=403, detail="Not allowed")
    if ticket["status"] != "resolved":
        raise HTTPException(status_code=400, detail="Ticket must be resolved before rating")

    ticket = await rate_ticket(ticket_id, body.rating)
    result = {k: v for k, v in ticket.items() if k != "_id"}
    result["id"] = ticket["_id"]
    return api_response(result)


# ── Admin ticket endpoints ───────────────────────────────────────────────────


@admin_router.get("/tickets")
async def admin_list_tickets(
    status: str | None = Query(default=None),
    category: str | None = Query(default=None),
    search: str | None = Query(default=None),
    assigned_to: str | None = Query(default=None),
    _=Depends(require_admin),
):
    filters: dict[str, Any] = {}
    if status:
        filters["status"] = status
    if category:
        filters["category"] = category
    if assigned_to:
        filters["assigned_to"] = assigned_to
    if search:
        filters["search"] = search

    tickets = await list_tickets(filters if filters else None)
    result = []
    for t in tickets:
        item = {k: v for k, v in t.items() if k != "_id"}
        item["id"] = t["_id"]
        result.append(item)
    return api_response(result)


@admin_router.get("/tickets/{ticket_id}")
async def admin_get_ticket(ticket_id: str, _=Depends(require_admin)):
    ticket = await get_ticket(ticket_id)
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")

    messages = await get_ticket_messages(ticket_id)
    msg_list = []
    for m in messages:
        item = {k: v for k, v in m.items() if k != "_id"}
        item["id"] = m["_id"]
        msg_list.append(item)

    result = {k: v for k, v in ticket.items() if k != "_id"}
    result["id"] = ticket["_id"]
    result["messages"] = msg_list
    return api_response(result)


class AdminTicketStatusIn(BaseModel):
    status: str = Field(min_length=1)
    note: str | None = None


@admin_router.post("/tickets/{ticket_id}/status")
async def admin_update_status(ticket_id: str, body: AdminTicketStatusIn, _=Depends(require_admin)):
    ticket = await get_ticket(ticket_id)
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    if body.status not in VALID_STATUSES:
        raise HTTPException(status_code=400, detail=f"Invalid status: {body.status}")

    ticket = await update_ticket_status(ticket_id, body.status)
    if body.note:
        await add_message(
            ticket_id=ticket_id,
            sender_type="admin",
            sender_id=_user_id_from_dep(_),
            sender_name="Admin",
            content=body.note,
        )
    result = {k: v for k, v in ticket.items() if k != "_id"}
    result["id"] = ticket["_id"]
    return api_response(result)


class AdminAssignIn(BaseModel):
    admin_id: str


@admin_router.post("/tickets/{ticket_id}/assign")
async def admin_assign(ticket_id: str, body: AdminAssignIn, _=Depends(require_admin)):
    ticket = await get_ticket(ticket_id)
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    ticket = await assign_ticket_svc(ticket_id, body.admin_id)
    result = {k: v for k, v in ticket.items() if k != "_id"}
    result["id"] = ticket["_id"]
    return api_response(result)


@admin_router.get("/stats")
async def admin_stats(_=Depends(require_admin)):
    stats = await get_stats()
    return api_response(stats)


def _user_id_from_dep(user: dict) -> str:
    return user.get("id", "admin")
