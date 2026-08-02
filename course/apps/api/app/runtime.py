"""Multi-Process Runtime — one image, three startup modes.

PROCESS_MODE env selects the process:
  api    -> FastAPI HTTP server (reuses app.main via uvicorn programmatically)
  worker -> arq background worker (reuses app.worker:main exactly)
  cron   -> arq worker running ONLY the shared scheduled jobs
            (reuses WorkerSettings.cron_jobs — no business-logic copy)

No code is shared by copy: bootstrap is reused from app.main / app.worker.
"""

import asyncio
import logging
import os

from app.core.config import settings

logging.basicConfig(level=settings.log_level, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
logger = logging.getLogger("app.runtime")

PROCESS_MODES = {"api", "worker", "cron"}
DEFAULT_MODE = "api"  # backward compatible: no env == API server


def resolve_mode() -> str:
    mode = os.environ.get("PROCESS_MODE", DEFAULT_MODE).strip().lower()
    if mode not in PROCESS_MODES:
        raise ValueError(f"Invalid PROCESS_MODE '{mode}'. Valid: {sorted(PROCESS_MODES)}")
    return mode


async def run_api() -> None:
    """Start the existing FastAPI application via uvicorn (programmatic)."""
    import uvicorn

    host = os.environ.get("API_HOST", "0.0.0.0")
    port = int(os.environ.get("API_PORT", "8000"))
    config = uvicorn.Config("app.main:app", host=host, port=port, workers=1)
    server = uvicorn.Server(config)
    logger.info("Starting API server on %s:%s", host, port)
    await server.serve()  # installs signal handlers -> graceful shutdown


async def run_worker() -> None:
    """Reuse the existing arq worker bootstrap unchanged.

    The worker bootstrap (app.worker.main) starts the Prometheus /metrics
    server on PROMETHEUS_PORT when telemetry is enabled.
    """
    from app.worker import main as worker_main

    await worker_main()


async def run_cron() -> None:
    """Run ONLY the shared scheduled jobs (no queue draining).

    Reuses WorkerSettings (redis, retries, cron_jobs) from the existing
    worker bootstrap; functions=[] means no queue jobs are consumed.
    """
    from arq.worker import Worker
    from app.worker import WorkerSettings

    if settings.telemetry_enabled:
        from app.core.telemetry import start_metrics_server
        start_metrics_server(settings.prometheus_port)

    worker = Worker(
        functions=[],
        redis_settings=WorkerSettings.redis_settings,
        max_tries=WorkerSettings.max_retries,
        keep_result=WorkerSettings.keep_result_seconds,
        keep_result_forever=WorkerSettings.keep_result_forever,
        poll_delay=WorkerSettings.poll_delay,
        max_burst_jobs=WorkerSettings.max_burst_jobs,
        cron_jobs=WorkerSettings.cron_jobs,
    )
    logger.info("Starting cron scheduler — jobs: %s", [c.name for c in WorkerSettings.cron_jobs])
    try:
        await worker.run()
    except KeyboardInterrupt:
        logger.info("Cron shutting down gracefully")
    finally:
        await worker.close()


async def main() -> None:
    # 12-Factor: timezone is configurable; empty keeps host behavior.
    if settings.app_timezone:
        os.environ["TZ"] = settings.app_timezone
        try:
            import time
            time.tzset()
        except AttributeError:
            pass  # non-POSIX (e.g. Windows) — env only
    mode = resolve_mode()
    logger.info("Runtime mode: %s", mode)
    if mode == "api":
        await run_api()
    elif mode == "worker":
        await run_worker()
    else:
        await run_cron()


if __name__ == "__main__":
    asyncio.run(main())