import json
import logging
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from app.core.deps import get_current_user, require_admin
from app.core.response import api_response
from app.services.support_tickets import (
    VALID_STATUSES,
    add_message,
    create_ticket,
    escalate_to_human,
    get_ticket,
    get_ticket_messages,
    get_user_tickets,
    list_tickets,
    rate_ticket,
    update_ticket_status,
    assign_ticket as assign_ticket_svc,
    get_stats,
    send_ticket_notification,
)
from app.services.support_ai import chat as support_ai_chat, chat_stream as support_ai_chat_stream, create_ticket_from_conversation, get_chat_history as get_support_chat_history, clear_chat_history as clear_support_chat_history

logger = logging.getLogger(__name__)

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
    try:
        await send_ticket_notification(ticket["_id"], f"Your ticket has been created: {body.subject}")
    except Exception:
        pass
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


class ChatIn(BaseModel):
    message: str = Field(min_length=1, max_length=2000)


@router.post("/chat")
async def support_chat(body: ChatIn, user=Depends(get_current_user)):
    result = await support_ai_chat(user_id=user["id"], question=body.message)
    return api_response(result)


@router.post("/chat/stream")
async def support_chat_stream(body: ChatIn, user=Depends(get_current_user)):
    """Server-Sent Events stream: context → message chunks → actions → done."""
    async def _event_generator():
        try:
            async for event in support_ai_chat_stream(user_id=user["id"], question=body.message):
                payload = json.dumps(event["data"], ensure_ascii=False)
                yield f"event: {event['event']}\ndata: {payload}\n\n"
        except Exception as e:
            logger.exception("Chat stream failed")
            payload = json.dumps({"error": str(e)}, ensure_ascii=False)
            yield f"event: error\ndata: {payload}\n\n"

    return StreamingResponse(_event_generator(), media_type="text/event-stream")


class ConvertToTicketIn(BaseModel):
    question: str = Field(min_length=1, max_length=2000)
    answer: str = Field(default="", max_length=4000)


@router.post("/chat/convert-to-ticket")
async def convert_chat_to_ticket(body: ConvertToTicketIn, user=Depends(get_current_user)):
    """Create a support ticket from a chat exchange (user confirms in UI)."""
    ticket = await create_ticket_from_conversation(
        user_id=user["id"],
        question=body.question,
        answer=body.answer,
    )
    result = {k: v for k, v in ticket.items() if k != "_id"}
    result["id"] = ticket["_id"]
    return api_response(result)


class EscalateIn(BaseModel):
    reason: str = Field(default="Escalated to human support", max_length=1000)


@router.post("/tickets/{ticket_id}/escalate")
async def escalate_ticket(ticket_id: str, body: EscalateIn, user=Depends(get_current_user)):
    """Escalate the user's own ticket to a human support agent."""
    ticket = await get_ticket(ticket_id)
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    if ticket["user_id"] != user["id"]:
        raise HTTPException(status_code=403, detail="Not allowed")

    updated = await escalate_to_human(ticket_id, body.reason)
    result = {k: v for k, v in updated.items() if k != "_id"}
    result["id"] = updated["_id"]
    return api_response(result)


@router.get("/chat/history")
async def support_chat_history(user=Depends(get_current_user)):
    history = await get_support_chat_history(user["id"])
    return api_response(history)


@router.delete("/chat/history")
async def support_chat_clear(user=Depends(get_current_user)):
    ok = await clear_support_chat_history(user["id"])
    return api_response({"cleared": ok})


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
    try:
        await send_ticket_notification(ticket_id, f"Ticket status updated to: {body.status}")
    except Exception:
        pass
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
