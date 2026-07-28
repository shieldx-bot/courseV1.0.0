"""Web search service for retrieving up-to-date information from the internet.

Providers (priority order):
1. Tavily - free tier available, optimized for AI/RAG
2. Google Custom Search - free tier, needs API key + CSE ID
3. SerpAPI - Google search via SerpAPI

Usage:
    from app.services.web_search import search_web, is_search_available

    results = await search_web("Python for Data Science best practices", max_results=5)
"""

import logging
from typing import Any

import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)


class SearchProvider:
    """Base class for search providers."""

    name: str = "base"

    async def search(self, query: str, max_results: int = 5) -> list[dict[str, Any]]:
        raise NotImplementedError

    def is_available(self) -> bool:
        return False


class TavilyProvider(SearchProvider):
    name = "tavily"

    def _get_api_key(self) -> str | None:
        return settings.tavily_api_key

    def is_available(self) -> bool:
        return bool(self._get_api_key())

    async def search(self, query: str, max_results: int = 5) -> list[dict[str, Any]]:
        api_key = self._get_api_key()
        if not api_key:
            raise ValueError("Tavily API key not configured")

        url = "https://api.tavily.com/search"
        headers = {"Content-Type": "application/json"}
        payload = {
            "api_key": api_key,
            "query": query,
            "max_results": max_results,
            "search_depth": "advanced",
            "include_answer": True,
            "include_raw_content": False,
        }

        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(url, json=payload, headers=headers)
            resp.raise_for_status()
            data = resp.json()

        results = []
        for item in data.get("results", []):
            results.append({
                "title": item.get("title", ""),
                "url": item.get("url", ""),
                "snippet": item.get("content", item.get("snippet", "")),
                "provider": "tavily",
            })

        if data.get("answer"):
            results.insert(0, {
                "title": "Tavily Answer",
                "url": "",
                "snippet": data["answer"],
                "provider": "tavily",
            })

        return results[:max_results]


class GoogleCustomSearchProvider(SearchProvider):
    name = "google_custom_search"

    def _get_api_key(self) -> str | None:
        return settings.google_search_api_key

    def _get_cse_id(self) -> str | None:
        return settings.google_search_cse_id

    def is_available(self) -> bool:
        return bool(self._get_api_key() and self._get_cse_id())

    async def search(self, query: str, max_results: int = 5) -> list[dict[str, Any]]:
        api_key = self._get_api_key()
        cse_id = self._get_cse_id()
        if not api_key or not cse_id:
            raise ValueError("Google Custom Search not configured")

        url = "https://www.googleapis.com/customsearch/v1"
        params = {
            "key": api_key,
            "cx": cse_id,
            "q": query,
            "num": min(max_results, 10),
        }

        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.get(url, params=params)
            resp.raise_for_status()
            data = resp.json()

        results = []
        for item in data.get("items", []):
            results.append({
                "title": item.get("title", ""),
                "url": item.get("link", ""),
                "snippet": item.get("snippet", ""),
                "provider": "google",
            })

        return results[:max_results]


class SerpAPIProvider(SearchProvider):
    name = "serpapi"

    def _get_api_key(self) -> str | None:
        return settings.serpapi_api_key

    def is_available(self) -> bool:
        return bool(self._get_api_key())

    async def search(self, query: str, max_results: int = 5) -> list[dict[str, Any]]:
        api_key = self._get_api_key()
        if not api_key:
            raise ValueError("SerpAPI key not configured")

        url = "https://serpapi.com/search"
        params = {
            "api_key": api_key,
            "engine": "google",
            "q": query,
            "num": max_results,
        }

        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.get(url, params=params)
            resp.raise_for_status()
            data = resp.json()

        results = []
        for item in data.get("organic_results", []):
            results.append({
                "title": item.get("title", ""),
                "url": item.get("link", ""),
                "snippet": item.get("snippet", ""),
                "provider": "serpapi",
            })

        return results[:max_results]


_PROVIDERS: list[SearchProvider] = [
    TavilyProvider(),
    GoogleCustomSearchProvider(),
    SerpAPIProvider(),
]


def _get_available_search_providers() -> list[SearchProvider]:
    return [p for p in _PROVIDERS if p.is_available()]


def is_search_available() -> bool:
    return bool(_get_available_search_providers())


def get_active_search_provider() -> SearchProvider | None:
    available = _get_available_search_providers()
    return available[0] if available else None


async def search_web(query: str, max_results: int = 5) -> list[dict[str, Any]]:
    """Search the web using the first available provider.

    Returns a list of results with keys:
      title, url, snippet, provider

    Falls back through providers if one fails.
    """
    providers = _get_available_search_providers()
    if not providers:
        logger.warning("No web search provider configured")
        return []

    errors: list[str] = []
    for provider in providers:
        try:
            logger.info("Searching web with provider: %s", provider.name)
            results = await provider.search(query, max_results=max_results)
            if results:
                return results
            continue
        except Exception as e:
            logger.warning("Web search provider %s failed: %s", provider.name, e)
            errors.append(f"{provider.name}: {e}")
            continue

    logger.warning("All web search providers failed: %s", "; ".join(errors))
    return []


def format_search_results_for_prompt(results: list[dict[str, Any]]) -> str:
    """Format search results into a compact context string for LLM prompts."""
    if not results:
        return "No search results available."

    parts = []
    for i, item in enumerate(results[:5], 1):
        title = item.get("title", "")
        snippet = item.get("snippet", "")
        url = item.get("url", "")
        parts.append(f"[{i}] {title}\n{snippet}\nSource: {url}")

    return "\n\n".join(parts)
