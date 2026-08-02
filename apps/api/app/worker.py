import asyncio
import functools
import logging
from typing import Any

from arq.connections import RedisSettings
from arq.worker import Worker, Retry
from arq.cron import cron

from app.core.config import settings
from app.core.tasks import (
    send_receipt_task,
    send_welcome_task,
    send_renewal_reminder_task,
    send_trial_started_task,
    send_password_reset_task,
    index_search_task,
    run_analytics_task,
    send_batch_renewal_reminders_task,
    run_email_campaigns_task,
    migrate_video_task,
    run_proactive_support_checks,
)
from app.core.telemetry import WORKER_JOBS_COMPLETED, start_metrics_server
from app.core.worker import MAX_RETRIES, KEEP_RESULT_SECONDS, POLL_DELAY

logging.basicConfig(
    level=settings.log_level,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("arq.worker")


# ── Job lifecycle hooks ─────────────────────────────────────────────────────
#
# arq 0.27 only wires ctx-only lifecycle hooks (`on_job_start` / `on_job_end`)
# and no longer exposes the per-job `on_job_complete` / `on_job_failed` hooks,
# so those two helpers are invoked from `_tracked` below — which has the
# function name and the job outcome — to increment
# `worker_jobs_completed_total{task, status}`.


async def on_job_complete(ctx: dict, job_name: str, result: Any = None) -> None:
    """Record a successful job: worker_jobs_completed_total{task, status=success}."""
    WORKER_JOBS_COMPLETED.labels(task=job_name, status="success").inc()


async def on_job_failed(ctx: dict, job_name: str, exc: BaseException | None = None) -> None:
    """Record a failed job: worker_jobs_completed_total{task, status=failed}."""
    WORKER_JOBS_COMPLETED.labels(task=job_name, status="failed").inc()


def _tracked(fn):
    """Wrap a worker function to emit worker_jobs_completed_total{task, status}.

    Retry is not terminal in arq (the job is re-queued), so it is re-raised
    without touching the counter.
    """

    @functools.wraps(fn)
    async def wrapper(ctx: dict, *args, **kwargs):
        try:
            result = await fn(ctx, *args, **kwargs)
        except Retry:
            raise
        except Exception as exc:
            await on_job_failed(ctx, fn.__name__, exc)
            raise
        else:
            await on_job_complete(ctx, fn.__name__, result)
            return result

    return wrapper


_BASE_FUNCTIONS = [
    send_receipt_task,
    send_welcome_task,
    send_renewal_reminder_task,
    send_trial_started_task,
    send_password_reset_task,
    index_search_task,
    run_analytics_task,
    send_batch_renewal_reminders_task,
    run_email_campaigns_task,
    migrate_video_task,
    run_proactive_support_checks,
]


class WorkerSettings:
    functions = [_tracked(f) for f in _BASE_FUNCTIONS]
    redis_settings = RedisSettings.from_dsn(settings.redis_url)
    max_retries = MAX_RETRIES
    keep_result_seconds = KEEP_RESULT_SECONDS
    keep_result_forever = False
    poll_delay = POLL_DELAY
    max_burst_jobs = 10
    # Referenced for compatibility/documentation; arq 0.27 calls the wrapper
    # above (functools.wraps preserves the original `__name__` for routing).
    on_job_complete = on_job_complete
    on_job_failed = on_job_failed
    cron_jobs = [
        cron(_tracked(run_email_campaigns_task), hour=None, minute=30, timeout=300),
        cron(_tracked(run_analytics_task), hour=2, minute=0, timeout=600),
        cron(_tracked(run_proactive_support_checks), hour=3, minute=0, timeout=600),
    ]


async def main():
    if settings.telemetry_enabled:
        start_metrics_server(settings.prometheus_port)
    worker = Worker(
        functions=WorkerSettings.functions,
        redis_settings=WorkerSettings.redis_settings,
        max_tries=WorkerSettings.max_retries,
        keep_result=WorkerSettings.keep_result_seconds,
        keep_result_forever=WorkerSettings.keep_result_forever,
        poll_delay=WorkerSettings.poll_delay,
        max_burst_jobs=WorkerSettings.max_burst_jobs,
        cron_jobs=WorkerSettings.cron_jobs,
    )
    logger.info("Starting arq worker — functions: %s", [f.__name__ for f in WorkerSettings.functions])
    try:
        await worker.run()
    except KeyboardInterrupt:
        logger.info("Worker shutting down gracefully")
    finally:
        await worker.close()


if __name__ == "__main__":
    asyncio.run(main())
