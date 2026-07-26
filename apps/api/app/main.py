import logging
from datetime import datetime, timezone
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware
from starlette.exceptions import HTTPException as StarletteHTTPException
from app.core.config import settings
from app.core.ratelimit import limiter
from app.core.response import api_response, error_response
from app.db.mongodb import seed_db, get_db
from app.db.indexes import create_indexes
from app.api.v1 import courses, auth, subscriptions, reviews, admin, stream, progress, contact, blog, worker, learning_paths, certificates, discussions, ai_tutor, affiliate, quiz, code_assistant, code_assistant
from app.services.learning_paths import seed_learning_paths
from app.services.r2_storage import r2_storage
from app.services import search as search_service
from app.core.telemetry import setup_telemetry
from app.core.worker import get_redis_pool, close_redis_pool

logger = logging.getLogger(__name__)


class GracefulShutdownMiddleware:
    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return
        try:
            await self.app(scope, receive, send)
        except RuntimeError as exc:
            if "No response" in str(exc):
                return
            raise


@asynccontextmanager
async def lifespan(app: FastAPI):
    await seed_db()

    try:
        db = get_db()
        await create_indexes(db)
    except Exception as exc:
        logger.warning("Index creation skipped: %s", exc)

    try:
        pool = await get_redis_pool()
        logger.info("Worker Redis pool initialized")
    except Exception as exc:
        logger.warning("Worker Redis pool initialization failed: %s", exc)

    if settings.r2_endpoint_url:
        try:
            await r2_storage.set_bucket_lifecycle()
            logger.info("R2 lifecycle policy configured (auto-delete %s days)", settings.r2_auto_delete_days)
        except Exception as exc:
            logger.warning("R2 lifecycle setup skipped: %s", exc)
    await search_service.init_search()
    await search_service.sync_all_courses()
    await seed_learning_paths()
    yield
    await close_redis_pool()
    logger.info("Shutdown complete — connections closed")


app = FastAPI(title="Ascendly API", version="0.1.0", lifespan=lifespan)

if settings.sentry_dsn:
    import sentry_sdk
    sentry_sdk.init(
        dsn=settings.sentry_dsn,
        environment=settings.environment,
        traces_sample_rate=settings.sentry_traces_sample_rate,
    )
    logger.info("Sentry initialized (rate=%s)", settings.sentry_traces_sample_rate)

if settings.telemetry_enabled:
    setup_telemetry(app, environment=settings.telemetry_environment)
    logger.info("Telemetry initialized (env=%s)", settings.telemetry_environment)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.add_middleware(GracefulShutdownMiddleware)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
app.add_middleware(SlowAPIMiddleware)


@app.exception_handler(StarletteHTTPException)
async def http_exception_handler(request: Request, exc: StarletteHTTPException):
    return error_response(str(exc.detail), exc.status_code)


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    return error_response(str(exc.errors()), 422)


@app.exception_handler(Exception)
async def general_exception_handler(request: Request, exc: Exception):
    logger.exception("Unhandled exception")
    return error_response("Internal server error", 500)


app.include_router(auth.router, prefix="/api/v1/auth", tags=["auth"])
app.include_router(courses.router, prefix="/api/v1", tags=["courses"])
app.include_router(subscriptions.router, prefix="/api/v1", tags=["subscriptions"])
app.include_router(reviews.router, prefix="/api/v1", tags=["reviews"])
app.include_router(admin.router, prefix="/api/v1/admin", tags=["admin"])
app.include_router(stream.router, prefix="/api/v1", tags=["stream"])
app.include_router(progress.router, prefix="/api/v1", tags=["progress"])
app.include_router(contact.router, prefix="/api/v1", tags=["contact"])
app.include_router(blog.router, prefix="/api/v1", tags=["blog"])
app.include_router(worker.router, prefix="/api/v1", tags=["worker"])
app.include_router(learning_paths.router, prefix="/api/v1", tags=["learning-paths"])
app.include_router(certificates.router, prefix="/api/v1", tags=["certificates"])
app.include_router(discussions.router, prefix="/api/v1", tags=["discussions"])
app.include_router(ai_tutor.router, prefix="/api/v1", tags=["ai-tutor"])
app.include_router(affiliate.router, prefix="/api/v1", tags=["affiliate"])
app.include_router(quiz.router, prefix="/api/v1", tags=["quiz"])
app.include_router(code_assistant.router, prefix="/api/v1", tags=["code-assistant"])


@app.get("/api/v1/health")
async def health():
    return api_response({
        "status": "ok",
        "version": "0.1.0",
        "timestamp": datetime.now(timezone.utc).isoformat(),
    })


@app.get("/api/v1/health/ready")
async def health_ready():
    checks = {}
    ok = True

    try:
        db = get_db()
        await db.command("ping")
        checks["mongodb"] = "ok"
    except Exception as exc:
        checks["mongodb"] = str(exc)
        ok = False

    try:
        import redis
        r = redis.from_url(settings.redis_url)
        r.ping()
        checks["redis"] = "ok"
    except Exception as exc:
        checks["redis"] = str(exc)
        ok = False

    status = "ok" if ok else "degraded"
    return JSONResponse(
        status_code=200 if ok else 503,
        content={
            "success": status == "ok",
            "data": {"status": status, "checks": checks},
            "error": None,
            "meta": None,
        },
    )