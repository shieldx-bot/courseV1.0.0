"""Public knowledge base endpoints."""

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field

from app.core.response import api_response
from app.services.knowledge_base import (
    get_article,
    get_article_by_slug,
    increment_article_views,
    list_articles as list_articles_svc,
    record_article_feedback,
    search_articles as search_articles_svc,
)

router = APIRouter()


class FeedbackIn(BaseModel):
    helpful: bool


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
async def article_feedback(article_id: str, body: FeedbackIn):
    article = await get_article(article_id)
    if not article:
        raise HTTPException(status_code=404, detail="Article not found")

    article = await record_article_feedback(article_id, body.helpful)
    result = {k: v for k, v in article.items() if k != "_id"}
    result["id"] = article["_id"]
    return api_response(result)
