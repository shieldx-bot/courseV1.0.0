import json
import logging
from datetime import datetime, timezone
from typing import Any

logger = logging.getLogger(__name__)

DLQ_KEY = "arq:dlq"
DLQ_COUNTER_KEY = "arq:dlq:count"
DLQ_METADATA_KEY = "arq:dlq:meta"


async def push_to_dlq(
    redis,
    function_name: str,
    args: tuple,
    kwargs: dict,
    error: str,
    retry_count: int,
) -> None:
    entry = {
        "function": function_name,
        "args": [str(a) for a in args],
        "kwargs": {k: str(v) for k, v in kwargs.items()},
        "error": str(error),
        "retry_count": retry_count,
        "failed_at": datetime.now(timezone.utc).isoformat(),
    }
    await redis.lpush(DLQ_KEY, json.dumps(entry))
    await redis.incr(DLQ_COUNTER_KEY)
    logger.warning(
        "DLQ: %s failed after %d retries — %s",
        function_name,
        retry_count,
        error,
    )


async def get_dlq_count(redis) -> int:
    val = await redis.get(DLQ_COUNTER_KEY)
    return int(val) if val else 0


async def list_dlq_entries(redis, start: int = 0, limit: int = 100) -> list[dict[str, Any]]:
    raw = await redis.lrange(DLQ_KEY, start, start + limit - 1)
    entries = []
    for item in raw:
        try:
            entries.append(json.loads(item))
        except (json.JSONDecodeError, TypeError):
            entries.append({"raw": str(item)})
    return entries


async def requeue_dlq_entry(redis, index: int) -> bool:
    raw = await redis.lindex(DLQ_KEY, index)
    if not raw:
        return False
    try:
        entry = json.loads(raw)
    except (json.JSONDecodeError, TypeError):
        return False
    await redis.lrem(DLQ_KEY, 1, raw)
    await redis.decr(DLQ_COUNTER_KEY)
    return entry


async def clear_dlq(redis) -> int:
    count = await get_dlq_count(redis)
    await redis.delete(DLQ_KEY)
    await redis.delete(DLQ_COUNTER_KEY)
    return count