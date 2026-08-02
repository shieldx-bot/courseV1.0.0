"""Knowledge base service.

Handles CRUD for help articles and simple full-text search over
article title, summary, content, and tags.
"""

import logging
import re
from datetime import datetime, timezone
from typing import Any

from app.db.mongodb import get_db

logger = logging.getLogger(__name__)

VALID_CATEGORIES = {"billing", "technical", "content", "account", "general"}

# Category keywords used to boost search results when the query mentions a
# category (cheap "RAG reranker" without embeddings).
_CATEGORY_KEYWORDS: dict[str, list[str]] = {
    "billing": ["billing", "payment", "charge", "charged", "refund", "invoice", "subscription", "cancel", "renew", "price", "pay", "coupon", "trial", "money"],
    "technical": ["technical", "error", "bug", "broken", "video", "stream", "buffering", "watch", "playing", "crash", "not working", "fail", "fix"],
    "account": ["account", "profile", "email", "login", "sign in", "password", "verify", "phone", "2fa", "access"],
    "content": ["content", "course", "lesson", "curriculum", "quiz", "certificate", "learning"],
}


def _query_categories(query: str) -> set[str]:
    """Return the set of categories whose keywords appear in the query."""
    q = (query or "").lower()
    return {cat for cat, kws in _CATEGORY_KEYWORDS.items() if any(k in q for k in kws)}


def _slugify(title: str) -> str:
    slug = title.lower().strip()
    slug = re.sub(r"[^a-z0-9]+", "-", slug)
    return slug.strip("-")


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _normalize_category(category: str | None) -> str:
    if not category:
        return "general"
    c = category.lower()
    if c in VALID_CATEGORIES:
        return c
    return "general"


async def create_article(data: dict[str, Any]) -> dict[str, Any]:
    db = get_db()
    slug = data.get("slug") or _slugify(data["title"])
    now = _now()

    doc = {
        "_id": f"article-{slug}",
        "slug": slug,
        "title": data["title"],
        "category": _normalize_category(data.get("category")),
        "content": data.get("content", ""),
        "summary": data.get("summary", ""),
        "tags": data.get("tags", []),
        "is_published": data.get("is_published", True),
        "views": 0,
        "helpful_count": 0,
        "not_helpful_count": 0,
        "created_at": now,
        "updated_at": now,
    }
    await db.help_articles.insert_one(doc)
    return doc


async def update_article(article_id: str, data: dict[str, Any]) -> dict[str, Any] | None:
    db = get_db()
    existing = await db.help_articles.find_one({"_id": article_id})
    if not existing:
        return None

    updates: dict[str, Any] = {"updated_at": _now()}

    if "title" in data:
        updates["title"] = data["title"]
        updates["slug"] = data.get("slug") or _slugify(data["title"])
    if "category" in data:
        updates["category"] = _normalize_category(data["category"])
    if "content" in data:
        updates["content"] = data["content"]
    if "summary" in data:
        updates["summary"] = data["summary"]
    if "tags" in data:
        updates["tags"] = data["tags"]
    if "is_published" in data:
        updates["is_published"] = data["is_published"]

    await db.help_articles.update_one({"_id": article_id}, {"$set": updates})
    return await db.help_articles.find_one({"_id": article_id})


async def delete_article(article_id: str) -> bool:
    db = get_db()
    result = await db.help_articles.delete_one({"_id": article_id})
    return result.deleted_count > 0


async def get_article_by_slug(slug: str) -> dict[str, Any] | None:
    db = get_db()
    return await db.help_articles.find_one({"slug": slug})


async def get_article(article_id: str) -> dict[str, Any] | None:
    db = get_db()
    return await db.help_articles.find_one({"_id": article_id})


async def search_articles(query: str, category: str | None = None, limit: int = 20) -> list[dict[str, Any]]:
    db = get_db()
    mongo_query: dict[str, Any] = {"is_published": True}
    if category:
        mongo_query["category"] = category

    articles = await db.help_articles.find(mongo_query).to_list(500)

    if not query:
        return articles[:limit]

    q = query.lower()
    q_categories = _query_categories(query)
    scored = []
    for article in articles:
        score = 0
        text = f"{article.get('title', '')} {article.get('summary', '')} {article.get('content', '')} {' '.join(article.get('tags', []))}"
        text = text.lower()
        if article.get("title", "").lower().startswith(q):
            score += 10
        if q in article.get("title", "").lower():
            score += 5
        if q in article.get("summary", "").lower():
            score += 3
        if q in article.get("tags", []):
            score += 4
        if q in text:
            score += 1
        # Category affinity boost: query mentions a category the article belongs to.
        if q_categories and article.get("category") in q_categories:
            score += 4
        # Quality tiebreaker: frequently-helpful articles rank slightly higher.
        helpful = article.get("helpful_count", 0) or 0
        score += min(helpful, 8) * 0.25
        if score > 0:
            scored.append((score, article))

    scored.sort(key=lambda x: x[0], reverse=True)
    return [a for _, a in scored[:limit]]


async def list_articles(category: str | None = None, limit: int = 100) -> list[dict[str, Any]]:
    db = get_db()
    query: dict[str, Any] = {"is_published": True}
    if category:
        query["category"] = category
    return await db.help_articles.find(query).sort("created_at", -1).to_list(limit)


async def record_article_feedback(article_id: str, helpful: bool) -> dict[str, Any] | None:
    db = get_db()
    field = "helpful_count" if helpful else "not_helpful_count"
    await db.help_articles.update_one(
        {"_id": article_id},
        {"$inc": {field: 1}, "$set": {"updated_at": _now()}},
    )
    return await db.help_articles.find_one({"_id": article_id})


async def increment_article_views(article_id: str) -> None:
    db = get_db()
    await db.help_articles.update_one(
        {"_id": article_id},
        {"$inc": {"views": 1}},
    )
