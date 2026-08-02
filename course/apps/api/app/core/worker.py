import logging
from typing import Any

from arq import create_pool
from arq.connections import RedisSettings
from arq.worker import Worker
from redis.asyncio import Redis as AsyncRedis

from app.core.config import settings

logger = logging.getLogger(__name__)

_pool: create_pool = None
_worker: Worker = None


MAX_RETRIES = 5
RETRY_BACKOFF = True
KEEP_RESULT_SECONDS = 3600
POLL_DELAY = 0.5


def redis_settings() -> RedisSettings:
    return RedisSettings.from_dsn(settings.redis_url)


async def get_redis_pool() -> create_pool:
    global _pool
    if _pool is None:
        _pool = await create_pool(redis_settings())
    return _pool


async def close_redis_pool() -> None:
    global _pool
    if _pool is not None:
        await _pool.close()
        _pool = None


def get_async_redis() -> AsyncRedis:
    from arq.connections import create_pool as _arq_create_pool
    import redis.asyncio as aioredis
    return aioredis.from_url(settings.redis_url)


async def enqueue_task(task_name: str, *args, **kwargs) -> str | None:
    pool = await get_redis_pool()
    job = await pool.enqueue_job(task_name, *args, **kwargs)
    if job:
        logger.debug("Enqueued %s job=%s", task_name, job.job_id)
        return job.job_id
    return None


async def enqueue_task_with_retry(
    task_name: str,
    *args,
    _max_retries: int = MAX_RETRIES,
    _job_timeout: int = 300,
    **kwargs,
) -> str | None:
    pool = await get_redis_pool()
    job = await pool.enqueue_job(
        task_name,
        *args,
        **kwargs,
        _max_retries=_max_retries,
        _job_timeout=_job_timeout,
    )
    if job:
        logger.debug("Enqueued %s job=%s (max_retries=%d)", task_name, job.job_id, _max_retries)
        return job.job_id
    return None


def exponential_backoff(retry_count: int) -> int:
    import random
    base = 2 ** retry_count
    jitter = random.uniform(0, 0.5 * base)
    return int(base + jitter)


async def get_queue_depth() -> int:
    try:
        redis = get_async_redis()
        info = await redis.info("clients")
        depth = 0
        import json as _json
        try:
            depth = await redis.llen("arq:queue")
        except Exception as exc:
            logger.warning("Failed to read queue depth: %s", exc)
            depth = 0
        await redis.close()
        return depth
    except Exception as exc:
        logger.warning("Failed to connect to Redis for queue depth: %s", exc)
        return -1