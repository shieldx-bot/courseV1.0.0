import time
import logging
import json
from fastapi import FastAPI, Response
from prometheus_client import Counter, Histogram, Gauge, generate_latest, CONTENT_TYPE_LATEST
from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.requests import Request
from starlette.responses import Response as StarletteResponse

REQUEST_COUNT = Counter(
    "http_requests_total",
    "Total HTTP requests by method, path, and status",
    ["method", "path", "status"],
)

REQUEST_DURATION = Histogram(
    "http_request_duration_seconds",
    "HTTP request duration in seconds",
    ["method", "path"],
    buckets=[0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1.0, 2.5, 5.0, 10.0],
)

WORKER_QUEUE_DEPTH = Gauge("worker_queue_depth", "Current number of jobs in the queue")
WORKER_DLQ_COUNT = Gauge("worker_dlq_count", "Current number of jobs in the dead-letter queue")
WORKER_JOBS_ENQUEUED = Counter("worker_jobs_enqueued_total", "Total jobs enqueued", ["task"])
WORKER_JOBS_COMPLETED = Counter("worker_jobs_completed_total", "Total jobs completed", ["task", "status"])


class TelemetryMiddleware(BaseHTTPMiddleware):
    async def dispatch(
        self, request: Request, call_next: RequestResponseEndpoint
    ) -> StarletteResponse:
        start = time.monotonic()
        response = await call_next(request)
        duration = time.monotonic() - start

        method = request.method
        path = request.url.path
        status = response.status_code

        REQUEST_COUNT.labels(method=method, path=path, status=status).inc()
        REQUEST_DURATION.labels(method=method, path=path).observe(duration)

        logger = logging.getLogger("access")
        logger.info(
            "%s %s %d %.2fms",
            method,
            path,
            status,
            duration * 1000,
            extra={
                "method": method,
                "path": path,
                "status": status,
                "duration_ms": round(duration * 1000, 2),
                "client_ip": request.client.host if request.client else None,
                "user_agent": request.headers.get("user-agent"),
            },
        )

        return response


def configure_logging(environment: str = "development") -> None:
    access_logger = logging.getLogger("access")

    if access_logger.handlers:
        return

    handler = logging.StreamHandler()
    handler.setLevel(logging.INFO)

    if environment == "production":
        class JSONFormatter(logging.Formatter):
            def format(self, record: logging.LogRecord) -> str:
                obj = {
                    "timestamp": self.formatTime(record),
                    "level": record.levelname,
                    "logger": record.name,
                    "message": record.getMessage(),
                    "module": record.module,
                    "function": record.funcName,
                    "line": record.lineno,
                }
                if hasattr(record, "extra") and record.extra:
                    obj.update(record.extra)
                return json.dumps(obj)

        formatter = JSONFormatter()
    else:
        formatter = logging.Formatter(
            "%(asctime)s [%(levelname)s] %(message)s"
        )

    handler.setFormatter(formatter)
    access_logger.addHandler(handler)
    access_logger.setLevel(logging.INFO)

    root = logging.getLogger()
    if not root.handlers:
        root.addHandler(handler)
        root.setLevel(logging.INFO)


def setup_telemetry(app: FastAPI, environment: str = "development") -> None:
    configure_logging(environment)

    @app.get("/metrics")
    async def metrics():
        return Response(content=generate_latest(), media_type=CONTENT_TYPE_LATEST)

    app.add_middleware(TelemetryMiddleware)