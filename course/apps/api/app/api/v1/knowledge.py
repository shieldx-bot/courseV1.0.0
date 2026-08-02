"""Public and admin knowledge base endpoints."""

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field

from app.core.deps import get_current_user, require_admin
from app.core.response import api_response
from app.services.knowledge_base import (
    create_article as create_article_svc,
    delete_article as delete_article_svc,
    get_article,
    get_article_by_slug,
    increment_article_views,
    list_articles as list_articles_svc,
    record_article_feedback,
    search_articles as search_articles_svc,
    update_article as update_article_svc,
)

router = APIRouter()
admin_router = APIRouter()


class FeedbackIn(BaseModel):
    helpful: bool


class ArticleIn(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    category: str | None = None
    content: str = Field(min_length=1)
    summary: str = Field(min_length=1, max_length=1000)
    tags: list[str] = Field(default_factory=list)
    slug: str | None = None
    is_published: bool = True


class ArticleUpdateIn(BaseModel):
    title: str | None = None
    category: str | None = None
    content: str | None = None
    summary: str | None = None
    tags: list[str] | None = None
    slug: str | None = None
    is_published: bool | None = None


@router.get("/articles")
async def list_articles(category: str | None = Query(default=None)):
    articles = await list_articles_svc(category=category)
    result = []
    for a in articles:
        item = {k: v for k, v in a.items() if k != "_id"}
        item["id"] = a["_id"]
        result.append(item)
    return api_response(result)


@router.get("/articles/search")
async def search_articles_endpoint(q: str = Query(default=""), category: str | None = Query(default=None)):
    articles = await search_articles_svc(query=q, category=category)
    result = []
    for a in articles:
        item = {k: v for k, v in a.items() if k != "_id"}
        item["id"] = a["_id"]
        result.append(item)
    return api_response(result)


@router.get("/articles/{slug}")
async def get_article_by_slug_endpoint(slug: str):
    article = await get_article_by_slug(slug)
    if not article:
        raise HTTPException(status_code=404, detail="Article not found")

    await increment_article_views(article["_id"])
    result = {k: v for k, v in article.items() if k != "_id"}
    result["id"] = article["_id"]
    return api_response(result)


@router.get("/articles/id/{article_id}")
async def get_article_by_id_endpoint(article_id: str):
    article = await get_article(article_id)
    if not article:
        raise HTTPException(status_code=404, detail="Article not found")

    await increment_article_views(article["_id"])
    result = {k: v for k, v in article.items() if k != "_id"}
    result["id"] = article["_id"]
    return api_response(result)


@router.post("/articles/{article_id}/feedback")
async def article_feedback(article_id: str, body: FeedbackIn, user=Depends(get_current_user)):
    article = await get_article(article_id)
    if not article:
        raise HTTPException(status_code=404, detail="Article not found")

    article = await record_article_feedback(article_id, body.helpful)
    result = {k: v for k, v in article.items() if k != "_id"}
    result["id"] = article["_id"]
    return api_response(result)


# ── Admin Knowledge Base ─────────────────────────────────────────────────────


@admin_router.get("/articles")
async def admin_list_articles(_=Depends(require_admin)):
    articles = await list_articles_svc()
    result = []
    for a in articles:
        item = {k: v for k, v in a.items() if k != "_id"}
        item["id"] = a["_id"]
        result.append(item)
    return api_response(result)


@admin_router.post("/articles")
async def admin_create_article(body: ArticleIn, _=Depends(require_admin)):
    article = await create_article_svc(body.model_dump(exclude_none=True))
    result = {k: v for k, v in article.items() if k != "_id"}
    result["id"] = article["_id"]
    return api_response(result)


@admin_router.put("/articles/{article_id}")
async def admin_update_article(article_id: str, body: ArticleUpdateIn, _=Depends(require_admin)):
    article = await update_article_svc(article_id, body.model_dump(exclude_none=True))
    if not article:
        raise HTTPException(status_code=404, detail="Article not found")
    result = {k: v for k, v in article.items() if k != "_id"}
    result["id"] = article["_id"]
    return api_response(result)


@admin_router.delete("/articles/{article_id}")
async def admin_delete_article(article_id: str, _=Depends(require_admin)):
    ok = await delete_article_svc(article_id)
    return api_response({"deleted": ok})
