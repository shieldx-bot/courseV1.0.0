"""AI Support service.

Platform-wide support chatbot with RAG from the knowledge base.
Unlike the lesson-specific AI Tutor, this answers billing, technical,
account, policy, and general questions by searching help articles.
"""

import logging
from datetime import datetime, timezone
from typing import Any

from app.core.config import settings
from app.db.mongodb import get_db
from app.services.knowledge_base import search_articles
from app.services.llm import call_llm, is_llm_available

logger = logging.getLogger(__name__)

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
    2. Build prompt with context + chat history
    3. Call LLM
    4. Detect if ticket creation is suggested
    5. Store message in conversation history
    6. Return response + suggested next actions
    """
    db = get_db()

    # Search knowledge base
    relevant_articles = await search_articles(question, limit=3)
    context = _build_context(relevant_articles)

    # Get conversation history
    conv = await get_or_create_conversation(user_id)
    history = conv.get("messages", [])

    # Build prompt
    system_prompt = _SYSTEM_PROMPT.format(context=context)
    chat_messages: list[dict[str, str]] = [{"role": "system", "content": system_prompt}]

    # Add recent history (last 6 messages)
    for msg in history[-6:]:
        chat_messages.append({"role": msg["role"], "content": msg["content"]})

    chat_messages.append({"role": "user", "content": question})

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
    history.append({"role": "user", "content": question, "timestamp": datetime.now(timezone.utc).isoformat()})
    history.append({"role": "assistant", "content": answer, "timestamp": datetime.now(timezone.utc).isoformat()})

    await db.support_conversations.update_one(
        {"_id": conv["_id"]},
        {"$set": {"messages": history, "updated_at": datetime.now(timezone.utc).isoformat()}},
    )

    # Detect suggested actions
    actions: list[dict[str, Any]] = []
    if "[ACTION: create_ticket]" in answer:
        actions.append({"type": "create_ticket", "label": "Create support ticket"})

    if relevant_articles:
        actions.append({
            "type": "articles",
            "label": "View related articles",
            "articles": [
                {"id": a["_id"], "title": a.get("title", ""), "slug": a.get("slug", "")}
                for a in relevant_articles[:3]
            ],
        })

    return {
        "answer": answer.replace("[ACTION: create_ticket]", "").strip(),
        "actions": actions,
        "conversation_id": conv["_id"],
        "error": error,
    }
