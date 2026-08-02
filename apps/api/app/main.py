import logging
from contextlib import asynccontextmanager
from datetime import datetime, timezone

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.api.v1 import (
    adaptive,
    admin,
    affiliate,
    ai_tutor,
    arena,
    auth,
    blog,
    certificates,
    code_assistant,
    community,
    community_hub,
    contact,
    courses,
    discussions,
    knowledge,
    learning_paths,
    proactive,
    progress,
    quiz,
    reviews,
    stream,
    subscriptions,
    support,
    tournaments,
    worker,
)
from app.api.v1 import challenges as challenges_module
from app.api.v1 import ecosystem as ecosystem_module
from app.api.v1 import error_log as error_log_module
from app.api.v1 import events_governance as events_governance_module
from app.api.v1 import intelligence as intelligence_module
from app.api.v1 import notifications as notifications_module
from app.api.v1 import platform_ops as platform_ops_module
from app.api.v1.enterprise import router as enterprise_router
from app.api.v1.exams import router as exam_router
from app.core.config import settings
from app.core.context import get_request_id
from app.core.error_logger import (
    CATEGORY_HTTP,
    CATEGORY_VALIDATION,
    LEVEL_ERROR,
    LEVEL_WARNING,
    SOURCE_BACKEND,
    get_error_logger,
)
from app.core.events import bus as event_bus
from app.core.middleware import RequestIDMiddleware
from app.core.ratelimit import limiter
from app.core.response import api_response, error_response
from app.core.telemetry import setup_telemetry
from app.core.worker import close_redis_pool, get_redis_pool
from app.db.indexes import create_indexes
from app.db.mongodb import get_db, seed_db
from app.services import search as search_service
from app.services.event_handlers import register_default_handlers
from app.services.learning_paths import seed_learning_paths
from app.services.r2_storage import r2_storage
from app.services.skill_graph import seed_skills as seed_skill_taxonomy

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
    try:
        await seed_skill_taxonomy()
    except Exception as exc:
        logger.warning("Skill taxonomy seeding skipped: %s", exc)
    register_default_handlers(event_bus)
    logger.info("Domain event handlers registered: %s events", len(event_bus.stats))
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
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.add_middleware(GracefulShutdownMiddleware)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
app.add_middleware(SlowAPIMiddleware)

# Request-ID must be the OUTERMOST middleware: added last (Starlette wraps
# middleware in reverse registration order) so the contextvar is set before
# any other middleware or handler runs and the response header is injected
# on the way out. Runs first, so X-Request-ID is available to everything else.
app.add_middleware(RequestIDMiddleware)


@app.exception_handler(StarletteHTTPException)
async def http_exception_handler(request: Request, exc: StarletteHTTPException):
    await get_error_logger().log(
        source=SOURCE_BACKEND,
        level=LEVEL_WARNING if exc.status_code < 500 else LEVEL_ERROR,
        category=CATEGORY_HTTP,
        error_type="HTTPException",
        message=str(exc.detail),
        url=request.url.path,
        method=request.method,
        status_code=exc.status_code,
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
        request_id=get_request_id(),
    )
    return error_response(str(exc.detail), exc.status_code)


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    await get_error_logger().log(
        source=SOURCE_BACKEND,
        level=LEVEL_WARNING,
        category=CATEGORY_VALIDATION,
        error_type="RequestValidationError",
        message=str(exc.errors()),
        url=request.url.path,
        method=request.method,
        status_code=422,
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
        request_id=get_request_id(),
        context={"errors": exc.errors()},
    )
    return error_response(str(exc.errors()), 422)


@app.exception_handler(Exception)
async def general_exception_handler(request: Request, exc: Exception):
    await get_error_logger().log_exception(
        exc,
        source=SOURCE_BACKEND,
        url=request.url.path,
        method=request.method,
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
        request_id=get_request_id(),
    )
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
app.include_router(community.router, prefix="/api/v1/community", tags=["community"])
app.include_router(tournaments.router, prefix="/api/v1/tournaments", tags=["tournaments"])
app.include_router(ai_tutor.router, prefix="/api/v1", tags=["ai-tutor"])
app.include_router(affiliate.router, prefix="/api/v1", tags=["affiliate"])
app.include_router(quiz.router, prefix="/api/v1", tags=["quiz"])
app.include_router(code_assistant.router, prefix="/api/v1", tags=["code-assistant"])
app.include_router(support.router, prefix="/api/v1/support", tags=["support"])
app.include_router(support.admin_router, prefix="/api/v1/admin/support", tags=["admin-support"])
app.include_router(knowledge.router, prefix="/api/v1/help", tags=["help"])
app.include_router(knowledge.admin_router, prefix="/api/v1/admin/help", tags=["admin-help"])
app.include_router(proactive.router, prefix="/api/v1/proactive", tags=["proactive"])
app.include_router(proactive.admin_router, prefix="/api/v1/admin/proactive", tags=["admin-proactive"])
app.include_router(adaptive.router, prefix="/api/v1/adaptive", tags=["adaptive"])
app.include_router(adaptive.admin_router, prefix="/api/v1/admin/adaptive", tags=["admin-adaptive"])
app.include_router(enterprise_router.router, prefix="/api/v1/enterprise", tags=["enterprise"])
app.include_router(exam_router.router, prefix="/api/v1/exams", tags=["exams"])
app.include_router(error_log_module.public_router, prefix="/api/v1")
app.include_router(error_log_module.admin_router, prefix="/api/v1/admin")
app.include_router(challenges_module.router, prefix="/api/v1", tags=["challenges"])
app.include_router(challenges_module.skills_router, prefix="/api/v1", tags=["skills"])
app.include_router(challenges_module.activity_router, prefix="/api/v1", tags=["activity"])
app.include_router(challenges_module.creators_router, prefix="/api/v1", tags=["creators"])
app.include_router(challenges_module.mentor_router, prefix="/api/v1", tags=["mentor"])
app.include_router(challenges_module.admin_router, prefix="/api/v1", tags=["admin-challenges"])
app.include_router(community_hub.router, prefix="/api/v1", tags=["community-hub"])
app.include_router(arena.router, prefix="/api/v1/arena", tags=["arena"])
app.include_router(ecosystem_module.router, prefix="/api/v1", tags=["ecosystem"])
app.include_router(ecosystem_module.admin_router, prefix="/api/v1", tags=["admin-ecosystem"])
app.include_router(notifications_module.router, prefix="/api/v1", tags=["notifications"])
app.include_router(events_governance_module.router, prefix="/api/v1", tags=["admin-events"])
app.include_router(intelligence_module.router, prefix="/api/v1", tags=["admin-intelligence"])
app.include_router(platform_ops_module.router, prefix="/api/v1", tags=["admin-ops"])


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