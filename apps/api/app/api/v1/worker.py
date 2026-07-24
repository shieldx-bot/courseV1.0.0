import logging
from datetime import datetime, timezone

from fastapi import APIRouter
from arq.connections import create_pool as arq_create_pool
from arq.connections import RedisSettings

from app.core.config import settings
from app.core.dlq import get_dlq_count, list_dlq_entries
from app.core.worker import get_redis_pool, get_queue_depth

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get("/worker/health")
async def worker_health():
    pool = None
    queue_depth = -1
    dlq_count = 0
    worker_info = {}

    try:
        pool = await get_redis_pool()
        queue_depth = await get_queue_depth()
        dlq_count = await get_dlq_count(pool)
    except Exception as exc:
        logger.warning("Worker health check failed to reach Redis: %s", exc)

    try:
        from app.worker import WorkerSettings
        worker_info = {
            "functions": [f.__name__ for f in WorkerSettings.functions],
            "max_retries": WorkerSettings.max_retries,
            "keep_result_seconds": WorkerSettings.keep_result_seconds,
            "poll_delay": WorkerSettings.poll_delay,
        }
    except Exception:
        worker_info = {"status": "unavailable"}

    return {
        "status": "ok" if pool is not None else "degraded",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "queue_depth": queue_depth,
        "dlq_count": dlq_count,
        "worker": worker_info,
        "redis_url": settings.redis_url.replace("redis://", "redis://[hidden]@") if "@" in settings.redis_url else "redis://localhost:6379",
    }


@router.get("/worker/queue")
async def worker_queue_depth():
    depth = await get_queue_depth()
    return {"queue_depth": depth, "timestamp": datetime.now(timezone.utc).isoformat()}


@router.get("/worker/dlq")
async def dlq_list(limit: int = 100):
    pool = await get_redis_pool()
    entries = await list_dlq_entries(pool, 0, limit)
    count = await get_dlq_count(pool)
    return {
        "count": count,
        "entries": entries,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


@router.post("/worker/dlq/requeue/{index}")
async def dlq_requeue(index: int):
    from app.core.dlq import requeue_dlq_entry
    pool = await get_redis_pool()
    entry = await requeue_dlq_entry(pool, index)
    if not entry:
        return {"requeued": False, "error": "Entry not found at index"}
    return {"requeued": True, "function": entry.get("function")}


@router.post("/worker/dlq/clear")
async def dlq_clear():
    from app.core.dlq import clear_dlq
    pool = await get_redis_pool()
    cleared = await clear_dlq(pool)
    return {"cleared": cleared, "timestamp": datetime.now(timezone.utc).isoformat()}