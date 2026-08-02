"""AI Support service.

Platform-wide support chatbot with RAG from the knowledge base.
Unlike the lesson-specific AI Tutor, this answers billing, technical,
account, policy, and general questions by searching help articles.
"""

import logging
from datetime import datetime, timezone
from typing import Any

from app.db.mongodb import get_db
from app.services.knowledge_base import search_articles
from app.services.llm import call_llm, call_llm_stream, is_llm_available
from app.services.support_tickets import create_ticket

logger = logging.getLogger(__name__)

_ACTION_MARKER = "[ACTION: create_ticket]"

_SYSTEM_PROMPT = """You are a helpful support assistant for Ascendly, an online learning platform.

Your role:
1. Answer user questions using the provided knowledge base context.
2. If the context contains the answer, respond clearly and concisely.
3. If the context does NOT contain the answer, say you're not sure and offer to create a support ticket.
4. For billing/payment issues, refund questions, or account access problems, offer to create a ticket if you cannot fully resolve.
5. Be polite, professional, and helpful.
6. Respond in the SAME language as the user (Vietnamese or English).

Context from knowledge base:
{context}

---

If you cannot answer from the context, end your response with:
"[ACTION: create_ticket] - I'll create a ticket for you so our team can help." """

# Keywords used to auto-classify the category of a ticket created from chat.
_TICKET_CATEGORY_KEYWORDS: dict[str, list[str]] = {
    "billing": ["billing", "payment", "charge", "charged", "refund", "invoice", "subscription", "cancel", "renew", "price", "pay", "coupon", "trial", "money"],
    "technical": ["technical", "error", "bug", "broken", "video", "stream", "buffering", "watch", "playing", "crash", "not working", "fail", "fix"],
    "account": ["account", "profile", "email", "login", "sign in", "password", "verify", "phone", "2fa", "access"],
    "content": ["content", "course", "lesson", "curriculum", "quiz", "certificate"],
}


def _detect_category(text: str) -> str:
    t = (text or "").lower()
    for cat, kws in _TICKET_CATEGORY_KEYWORDS.items():
        if any(k in t for k in kws):
            return cat
    return "other"


def _make_subject(question: str) -> str:
    q = (question or "").strip()
    if not q:
        return "Support request"
    return q[:90] + "…" if len(q) > 90 else q


def _build_context(articles: list[dict[str, Any]], max_articles: int = 3) -> str:
    """Build text context from top matching knowledge base articles."""
    if not articles:
        return "No relevant articles found."
    ctx_parts = []
    for i, a in enumerate(articles[:max_articles], 1):
        ctx_parts.append(
            f"[Article {i}] {a.get('title', '')}\n{a.get('summary', '')}\n{a.get('content', '')}"
        )
    return "\n\n".join(ctx_parts)


async def _get_user_context(user_id: str) -> str:
    """Personalization context for the assistant.

    Only non-sensitive profile + subscription summary is included — never
    payment details, card info, or full billing addresses.
    """
    db = get_db()
    user = await db.users.find_one({"_id": user_id})
    if not user:
        return ""
    lines: list[str] = []
    name = user.get("name") or ""
    if name:
        lines.append(f"- Name: {name}")
    if user.get("role"):
        lines.append(f"- Role: {user['role']}")

    sub = await db.subscriptions.find_one({"user_id": user_id, "status": "active"})
    if sub:
        tier = sub.get("tier") or sub.get("plan") or "active"
        lines.append(f"- Subscription: active plan '{tier}'")
        ends_at = sub.get("ends_at")
        if ends_at:
            lines.append(f"- Subscription period ends: {str(ends_at)[:10]}")
    else:
        lines.append("- Subscription: none (free user)")
    return "\n".join(lines)


def _build_system_prompt(context: str, user_context: str = "") -> str:
    prompt = _SYSTEM_PROMPT.format(context=context)
    if user_context:
        prompt += (
            "\n\nUser context (personalize your answers, but NEVER reveal "
            f"private or payment details):\n{user_context}"
        )
    return prompt


def _detect_actions(answer: str, articles: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Parse the assistant answer for actionable markers + related articles."""
    actions: list[dict[str, Any]] = []
    if _ACTION_MARKER in answer:
        actions.append({"type": "create_ticket", "label": "Create support ticket", "high_confidence": True})
    if articles:
        actions.append({
            "type": "articles",
            "label": "View related articles",
            "articles": [
                {"id": a["_id"], "title": a.get("title", ""), "slug": a.get("slug", "")}
                for a in articles[:3]
            ],
        })
    return actions


async def _prepare_chat(
    user_id: str,
    question: str,
) -> tuple[list[dict[str, str]], dict[str, Any], list[dict[str, Any]], list[dict[str, Any]]]:
    """Search KB, build system prompt + message list with history & user context."""
    relevant_articles = await search_articles(question, limit=3)
    context = _build_context(relevant_articles)

    conv = await get_or_create_conversation(user_id)
    history = conv.get("messages", [])

    user_context = await _get_user_context(user_id)
    system_prompt = _build_system_prompt(context, user_context)

    chat_messages: list[dict[str, str]] = [{"role": "system", "content": system_prompt}]
    for msg in history[-6:]:
        chat_messages.append({"role": msg["role"], "content": msg["content"]})
    chat_messages.append({"role": "user", "content": question})

    return chat_messages, conv, history, relevant_articles


def _conversation_id(user_id: str) -> str:
    return f"support-chat-{user_id}"


async def get_or_create_conversation(user_id: str) -> dict[str, Any]:
    """Get existing support conversation or create a new one."""
    db = get_db()
    conv_id = _conversation_id(user_id)
    conv = await db.support_conversations.find_one({"_id": conv_id})
    if conv:
        return conv

    doc = {
        "_id": conv_id,
        "user_id": user_id,
        "messages": [],
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.support_conversations.insert_one(doc)
    return doc


async def get_chat_history(user_id: str) -> list[dict[str, Any]]:
    db = get_db()
    conv = await db.support_conversations.find_one({"_id": _conversation_id(user_id)})
    if not conv:
        return []
    return [
        {"role": m["role"], "content": m["content"], "timestamp": m.get("timestamp", "")}
        for m in conv.get("messages", [])
    ]


async def clear_chat_history(user_id: str) -> bool:
    db = get_db()
    result = await db.support_conversations.update_one(
        {"_id": _conversation_id(user_id)},
        {"$set": {"messages": [], "updated_at": datetime.now(timezone.utc).isoformat()}},
    )
    return result.modified_count > 0


async def chat(user_id: str, question: str) -> dict[str, Any]:
    """Send a message to the AI support chatbot.

    1. Search knowledge base for relevant articles
    2. Build prompt with context + user context + chat history
    3. Call LLM
    4. Detect if ticket creation is suggested
    5. Store message in conversation history
    6. Return response + suggested next actions
    """
    db = get_db()
    chat_messages, conv, history, relevant_articles = await _prepare_chat(user_id, question)

    # Call LLM
    answer = ""
    error = None
    if not is_llm_available():
        answer = "AI support is not available at the moment. Please try again later or create a ticket."
        error = "LLM not configured"
    else:
        try:
            answer = await call_llm(
                messages=chat_messages,
                max_tokens=800,
                temperature=0.4,
            )
        except Exception as e:
            logger.error("Support AI LLM call failed: %s", e)
            answer = "I'm having trouble right now. Would you like me to create a ticket so our team can help?"
            error = str(e)

    # Store in conversation
    await _persist_exchange(conv, history, question, answer)

    actions = _detect_actions(answer, relevant_articles)

    return {
        "answer": answer.replace(_ACTION_MARKER, "").strip(),
        "actions": actions,
        "conversation_id": conv["_id"],
        "error": error,
    }


async def _persist_exchange(
    conv: dict[str, Any],
    history: list[dict[str, Any]],
    question: str,
    answer: str,
) -> None:
    db = get_db()
    now = datetime.now(timezone.utc).isoformat()
    history.append({"role": "user", "content": question, "timestamp": now})
    history.append({"role": "assistant", "content": answer, "timestamp": now})
    await db.support_conversations.update_one(
        {"_id": conv["_id"]},
        {"$set": {"messages": history, "updated_at": now}},
    )


async def chat_stream(user_id: str, question: str) -> Any:
    """Stream a support chat reply.

    Async generator yielding event dicts::

        {"event": "context",  "data": [article meta, ...]}
        {"event": "message",  "data": "text chunk"}
        {"event": "actions",  "data": [suggested actions, ...]}
        {"event": "done",     "data": {"answer", "conversation_id", "error", "actions"}}
        {"event": "error",    "data": "error message"}   # only on failure

    The full exchange is persisted once, after the stream completes.
    """
    db = get_db()
    chat_messages, conv, history, relevant_articles = await _prepare_chat(user_id, question)

    yield {
        "event": "context",
        "data": [
            {"id": a["_id"], "title": a.get("title", ""), "slug": a.get("slug", "")}
            for a in relevant_articles
        ],
    }

    answer = ""
    error = None
    if not is_llm_available():
        answer = "AI support is not available at the moment. Please try again later or create a ticket."
        error = "LLM not configured"
        yield {"event": "error", "data": error}
    else:
        try:
            async for chunk in call_llm_stream(
                messages=chat_messages,
                max_tokens=800,
                temperature=0.4,
            ):
                answer += chunk
                yield {"event": "message", "data": chunk}
        except Exception as e:
            logger.error("Support AI stream failed: %s", e)
            answer = "I'm having trouble right now. Would you like me to create a ticket so our team can help?"
            error = str(e)
            yield {"event": "error", "data": error}

    await _persist_exchange(conv, history, question, answer)

    actions = _detect_actions(answer, relevant_articles)
    yield {"event": "actions", "data": actions}
    yield {
        "event": "done",
        "data": {
            "answer": answer.replace(_ACTION_MARKER, "").strip(),
            "conversation_id": conv["_id"],
            "error": error,
            "actions": actions,
        },
    }


async def create_ticket_from_conversation(
    user_id: str,
    question: str,
    answer: str = "",
    ai_summary: str | None = None,
) -> dict[str, Any]:
    """Create a support ticket from a chat conversation.

    Uses the existing ``support_tickets.create_ticket`` and attaches an
    ``ai_summary`` (the assistant's reply) so agents have context.
    """
    db = get_db()
    user = await db.users.find_one({"_id": user_id}) or {}
    ticket = await create_ticket(
        user_id=user_id,
        user_email=user.get("email", ""),
        user_name=user.get("name", ""),
        subject=_make_subject(question),
        message=question,
        category=_detect_category(f"{question} {answer}"),
        ai_summary=ai_summary if ai_summary is not None else (answer or ""),
    )
    return ticket
