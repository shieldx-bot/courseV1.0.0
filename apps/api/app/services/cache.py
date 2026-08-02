import json
import time
from typing import Any, Callable
from app.core.config import settings


class _MemoryStore:
    def __init__(self):
        self._data: dict[str, tuple[Any, float]] = {}

    async def setex(self, key: str, seconds: int, value: Any):
        self._data[key] = (value, time.time() + seconds)

    async def get(self, key: str) -> Any | None:
        item = self._data.get(key)
        if not item:
            return None
        value, expires = item
        if expires < time.time():
            del self._data[key]
            return None
        return value

    async def delete(self, key: str):
        self._data.pop(key, None)

    async def keys(self, pattern: str) -> list[str]:
        import fnmatch
        return [k for k in self._data if fnmatch.fnmatch(k, pattern)]


_cache = None


async def get_cache():
    global _cache
    if _cache is None:
        # The in-memory test backend (MONGODB_URI=memory://...) runs each test
        # in its own event loop; a real Redis client created in one loop would
        # leak connections into later loops ("Event loop is closed" GC errors)
        # and break test isolation. Use the in-memory store there.
        if settings.mongodb_uri.startswith("memory:"):
            _cache = _MemoryStore()
            return _cache

        client = None
        try:
            import redis.asyncio as redis

            client = redis.from_url(settings.redis_url)
            await client.ping()
            _cache = client
        except Exception:
            # Never leave a half-initialized redis client behind: its connection
            # deallocator would later raise "Event loop is closed" when GC runs
            # outside the creating loop (breaks tests / worker shutdown).
            if client is not None:
                try:
                    await client.aclose()
                except Exception:
                    pass
            _cache = _MemoryStore()
    return _cache


def _build_cache_key(prefix: str, **params) -> str:
    parts = [prefix]
    for k, v in sorted(params.items()):
        if v:
            parts.append(f"{k}={v}")
    return ":".join(parts)


async def get_or_cache(prefix: str, ttl: int, fetch: Callable, **params) -> Any:
    cache = await get_cache()
    key = _build_cache_key(prefix, **params)
    cached = await cache.get(key)
    if cached is not None:
        if isinstance(cached, bytes):
            try:
                return json.loads(cached.decode("utf-8"))
            except (json.JSONDecodeError, UnicodeDecodeError):
                return cached
        if isinstance(cached, str):
            try:
                return json.loads(cached)
            except json.JSONDecodeError:
                return cached
        return cached
    value = await fetch()
    await cache.setex(key, ttl, json.dumps(value, default=str))
    return value


async def invalidate_pattern(pattern: str):
    cache = await get_cache()
    if hasattr(cache, "keys"):
        keys = await cache.keys(pattern)
        for k in keys:
            await cache.delete(k)
    else:
        import importlib
        cursor = 0
        while True:
            cursor, keys = await cache.scan(cursor=cursor, match=pattern, count=100)
            for k in keys:
                await cache.delete(k)
            if cursor == 0:
                break
