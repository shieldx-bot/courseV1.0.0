import asyncio
import logging

from arq.connections import RedisSettings
from arq.worker import Worker
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
from app.core.worker import MAX_RETRIES, KEEP_RESULT_SECONDS, POLL_DELAY

logging.basicConfig(
    level=settings.log_level,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("arq.worker")


class WorkerSettings:
    functions = [
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
    redis_settings = RedisSettings.from_dsn(settings.redis_url)
    max_retries = MAX_RETRIES
    keep_result_seconds = KEEP_RESULT_SECONDS
    keep_result_forever = False
    poll_delay = POLL_DELAY
    max_burst_jobs = 10
    on_job_complete = None
    on_job_failed = None
    cron_jobs = [
        cron(run_email_campaigns_task, hour=None, minute=30, _job_timeout=300),
        cron(run_analytics_task, hour=2, minute=0, _job_timeout=600),
        cron(run_proactive_support_checks, hour=3, minute=0, _job_timeout=600),
    ]


async def main():
    worker = Worker(
        functions=WorkerSettings.functions,
        redis_settings=WorkerSettings.redis_settings,
        max_retries=WorkerSettings.max_retries,
        keep_result_seconds=WorkerSettings.keep_result_seconds,
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