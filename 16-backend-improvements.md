# Đề Xuất Cải Thiện Backend
*Bổ sung cho deliverable 07-technical-architecture.md và 08-project-structure.md*

---

## 1. Kiến trúc Video Pipeline — Vấn đề lớn nhất cần giải quyết

**Hiện tại:** Backend proxy qua Google Drive API, range-request streaming, không adaptive bitrate, phụ thuộc vào Drive API quotas.

**Vấn đề:**
- Mỗi luồng xem tốn backend egress — không scale ngang hiệu quả
- Drive API rate limits (~10K requests/project/day cho free tier, cao hơn nếu trả phí nhưng vẫn có ceiling)
- Không có adaptive bitrate → chất lượng kém cho người dùng đường truyền chậm
- Backend trở thành bottleneck cho mọi lượt xem

**Đề xuất thay thế (theo thứ tự ưu tiên):**

### Option A (Khuyến nghị): Dùng Cloudflare Stream hoặc Mux
- Upload video lên Cloudflare Stream / Mux — họ xử lý transcode + CDN + adaptive bitrate
- Backend chỉ cần tạo signed token (JWT ngắn hạn) — không phải proxy bytes
- Giảm tải backend gần như bằng 0 cho video playback
- Chi phí: ~$0.01/phút xem — chấp nhận được cho MVP
- Tích hợp: thay `drive_service.py` bằng `video_service.py` gọi Cloudflare Stream API

### Option B: Backend tự cache lên R2/S3 (fallback từ tài liệu 07)
- Giữ Drive làm source of truth, nhưng cache file phổ biến lên object storage (R2, S3, B2)
- Cache ở lớp CDN (CloudFront/Cloudflare) cho các chunk video phổ biến
- Giảm áp lực Drive API, nhưng vẫn không giải quyết được adaptive bitrate

### Option C (Tối giản): Giữ Drive + thêm Redis cache cho hot lessons
- Cache range-request response cho những bài học phổ biến
- Dùng Redis như một proxy cache (cân nhắc kích thước video — không lý tưởng cho file lớn)

---

## 2. Database: MongoDB thuần túy — Rủi ro cho transactional data

**Hiện tại:** MongoDB cho mọi thứ — users, subscriptions, orders, courses, lessons, progress, reviews.

**Vấn đề:**
- `subscriptions` và `orders` là transactional data — cần ACID mạnh. MongoDB multi-document transactions có performance overhead và không phải use case mạnh nhất của nó.
- Thanh toán (Stripe webhook cập nhật subscription + order) dễ gây inconsistent state nếu không có transaction
- Báo cáo tài chính (join users ↔ subscriptions ↔ orders) phức tạp hơn trên MongoDB so với SQL

**Đề xuất: Hybrid database**

```
PostgreSQL (transactional)              MongoDB (content)
├── users                               ├── categories
├── subscriptions                       ├── courses
├── orders                              ├── lessons
├── coupons                             ├── progress
├── reviews                             └── analytics_events
└── stripe_events (idempotency)
```

- PostgreSQL xử lý payment/subscription/auth — nơi cần ACID + join phức tạp
- MongoDB giữ content (courses, lessons) — nơi schema linh hoạt có giá trị
- Progress có thể ở MongoDB vì write-heavy và không yêu cầu transaction

**Nếu không muốn thêm database thứ hai:** ít nhất thêm Stripe idempotency key vào MongoDB collection riêng, và dùng change streams + background worker để đảm bảo consistency giữa orders ↔ subscriptions.

---

## 3. Background Tasks: Celery/arq chưa được quyết định

**Hiện tại:** Ghi `worker/` với Celery hoặc arq, chưa chọn.

**Đề xuất: Arq (Redis) thay vì Celery**

| Tiêu chí | Celery | Arq |
|---|---|---|
| Phụ thuộc | RabbitMQ/Redis + Celery | Chỉ Redis |
| Kích thước codebase | Lớn, nhiều tính năng | Nhỏ, tập trung |
| Async support | Cần kombu + eventlet/gevent | Native asyncio |
| Phù hợp với | Hệ thống job phức tạp, nhiều worker type | Dự án vừa và nhỏ, vài job đơn giản |

Arq đủ cho các job hiện tại:
- `renewal_reminders.py` — gửi email nhắc nhở
- `forecast_jobs.py` — chạy LSTM forecasting hàng ngày
- `analytics_aggregation.py` — tổng hợp dữ liệu phân tích
- `video_transcoding.py` — nếu chuyển sang Cloudflare Stream, job trigger transcoding

---

## 4. Observability: Hoàn toàn thiếu

**Hiện tại:** Không có logging, metrics, tracing, health check nào được định nghĩa.

**Đề xuất bổ sung:**

### 4.1 Structured logging
```python
# app/core/logging.py
import structlog
structlog.configure(
    processors=[
        structlog.stdlib.filter_by_level,
        structlog.stdlib.add_logger_name,
        structlog.stdlib.add_log_level,
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.processors.JSONRenderer(),
    ],
)
```

### 4.2 Health check endpoint
```python
# app/api/v1/health.py
@router.get("/health")
async def health():
    # Check MongoDB connection, Redis, Drive API connectivity
    return {"status": "ok", "services": {"mongodb": "ok", "redis": "ok", "drive": "ok"}}
```

Nên tách riêng:
- `/health` — simple, cho load balancer (không check dependencies)
- `/health/ready` — full check, cho Kubernetes liveness/readiness probes

### 4.3 Metrics + Tracing
- OpenTelemetry SDK (Python) export traces/metrics
- Sentry cho error tracking (phát hiện lỗi production)
- Middleware tự động ghi request duration, status code, endpoint

---

## 5. API Design: Thiếu consistency pattern

**Hiện tại:** REST endpoints nhưng thiếu quy chuẩn response format, error handling, pagination.

**Đề xuất:**

### 5.1 Standard response envelope
```python
# Success
{
  "data": { ... },
  "meta": { "page": 1, "per_page": 20, "total": 150 }
}

# Error
{
  "error": {
    "code": "COURSE_NOT_FOUND",
    "message": "Course with slug 'xyz' not found",
    "details": {}
  }
}
```

### 5.2 Exception handling
```python
# app/core/exceptions.py
class AppException(Exception):
    def __init__(self, code: str, message: str, status: int):
        self.code = code
        self.message = message
        self.status = status
```

FastAPI exception handler convert AppException → standard error response. Không catch exception lẻ tẻ trong từng route handler.

### 5.3 Pagination convention
- Tất cả list endpoints (`GET /courses`, `GET /admin/users`, v.v.) dùng chung query params: `?page=1&per_page=20`
- Response luôn có `meta` block với total/pages, không chỉ `has_more` boolean (không đủ cho admin UI cần phân trang số)

### 5.4 Rate limiting headers
Mọi response nên gửi:
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 87
X-RateLimit-Reset: 1623456789
```

---

## 6. Webhook Processing: Thiếu idempotency

**Hiện tại:** Stripe/PayPal webhooks có verify signature, nhưng không có idempotency layer.

**Vấn đề:** Stripe gửi webhook có thể retry (same event nhiều lần). Nếu không có idempotency, một subscription activation có thể được xử lý 2 lần.

**Đề xuất: Idempotency collection**
```python
@app.post("/api/v1/webhooks/stripe")
async def stripe_webhook(payload: dict, stripe_signature: str):
    event = stripe.Webhook.construct_event(payload, stripe_signature, WEBHOOK_SECRET)
    
    # Idempotency check
    if await db.events.find_one({"stripe_event_id": event.id}):
        return {"status": "already_processed"}  # 200, không phải lỗi
    
    # Process event
    ...
    
    # Store processed event
    await db.events.insert_one({"stripe_event_id": event.id, "processed_at": now})
```

---

## 7. Testing Strategy: Cần cụ thể hóa

**Hiện tại:** Chỉ có `tests/` với 4 file test, không có hướng dẫn.

**Đề xuất:**

### 7.1 Test pyramid
```
Unit tests (nhiều) — Pydantic models, service functions
    │
Integration tests (vừa) — API endpoints với test MongoDB
    │
E2E tests (ít) — Frontend + backend, chỉ critical flows
```

### 7.2 Async testing với pytest
```python
# tests/conftest.py
@pytest.fixture
async def db():
    client = AsyncIOMotorClient("mongodb://localhost:27017")
    yield client.test_database
    await client.drop_database("test_database")

@pytest.fixture
async def api_client(db):
    app.dependency_overrides[get_db] = lambda: db
    async with AsyncClient(app=app, base_url="http://test") as ac:
        yield ac
```

### 7.3 Test data factories (thay vì fixtures thủ công)
Dùng `factory_boy` hoặc function factory để tạo test data:
```python
# tests/factories.py
def make_course(overrides: dict = None) -> dict:
    defaults = {
        "title": "Test Course",
        "slug": "test-course",
        "category_id": ObjectId(),
        "lesson_count": 10,
    }
    return {**defaults, **(overrides or {})}
```

### 7.4 Critical paths cần test
1. Signup → OTP verify → trial → checkout → subscription active → watch lesson (happy path)
2. Stripe webhook: payment success → subscription activated → 200 returned (idempotent)
3. Stripe webhook: payment failed → subscription NOT activated → error logged
4. Video stream: expired subscription → 403 (not 500)
5. Video stream: no token → 401
6. Refresh token rotation: reuse of old token → both revoked

---

## 8. Dependency Injection: Dùng FastAPI Depends() triệt để

**Hiện tại:** Chưa rõ middleware pattern.

**Đề xuất: Reusable dependencies**
```python
# app/api/deps.py
async def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: Database = Depends(get_db),
) -> User:
    """Xác thực JWT token → trả về user object. Dùng cho mọi protected endpoint."""
    ...

async def require_active_subscription(
    user: User = Depends(get_current_user),
    db: Database = Depends(get_db),
) -> Subscription:
    """Check subscription active — gắn vào route nào cần subscription."""
    sub = await db.subscriptions.find_one({"user_id": user.id, "status": "active"})
    if not sub:
        raise HTTPException(403, "Active subscription required")
    return sub
```

```python
# Route usage
@router.get("/lessons/{id}/stream")
async def stream_lesson(
    id: str,
    user: User = Depends(get_current_user),
    sub: Subscription = Depends(require_active_subscription),
):
    ...
```

Pattern này:
- Tách biệt auth logic khỏi route handler
- Dễ test (override dependency trong test)
- Route handler chỉ làm đúng một việc

---

## 9. Config Management: env-driven settings

**Hiện tại:** `app/core/config.py` — env-driven settings.

**Đề xuất cụ thể: Dùng Pydantic Settings**
```python
# app/core/config.py
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    environment: str = "development"
    mongodb_uri: str
    redis_url: str
    jwt_secret: str
    jwt_access_expire_minutes: int = 15
    jwt_refresh_expire_days: int = 30
    stripe_secret_key: str
    stripe_webhook_secret: str
    google_service_account_json: str  # base64-encoded JSON
    drive_root_folder_id: str
    frontend_url: str
    cors_origins: list[str] = ["http://localhost:3000"]
    sentry_dsn: str | None = None

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}

settings = Settings()  # singleton
```

**Thêm validation:** kiểm tra biến môi trường quan trọng khi khởi động, fail fast nếu thiếu.

---

## 10. File Structure: Thiếu modules và separation

**Hiện tại:** `services/` có 5 file. Khi dự án lớn, đây sẽ là nơi dễ phình thành file "quái vật" (monster file).

**Đề xuất cấu trúc services chi tiết hơn:**

```
services/
├── video/
│   ├── __init__.py
│   ├── base.py               # AbstractVideoService protocol
│   ├── drive.py               # Google Drive implementation
│   ├── cloudflare_stream.py   # Future: Cloudflare Stream implementation
│   └── cache.py               # Caching layer cho video chunks
├── payment/
│   ├── __init__.py
│   ├── base.py                # Abstract payment service
│   ├── stripe_service.py      # Stripe implementation
│   ├── paypal_service.py      # PayPal implementation
│   └── models.py              # Shared payment data models
├── auth/
│   ├── __init__.py
│   ├── jwt.py                  # JWT issue/verify
│   ├── otp.py                  # OTP generation + verification
│   └── oauth.py                # Google OAuth
├── notification/
│   ├── __init__.py
│   ├── email.py                # Transactional email
│   └── sms.py                  # SMS provider
└── analytics/
    ├── __init__.py
    ├── aggregator.py            # Data aggregation
    ├── lstm_predictor.py        # LSTM model
    └── llm_insights.py          # LLM analysis
```

**Lợi ích:**
- Mỗi implementation trong file riêng → dễ swap provider
- Base class/protocol → dễ test với mock
- Tránh import circular khi services gọi nhau

---

## 11. CORS và Middleware Config

**Hiện tại:** Chưa có cors_origins trong config.

**Đề xuất:**
```python
# app/main.py
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,  # từ env, không hard-code
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

**Thêm middleware theo thứ tự:**
1. CORS (sớm nhất)
2. Trusted Host (chống Host header injection)
3. Rate Limiting
4. Request ID (X-Request-ID cho tracing)
5. Auth (kiểm tra JWT cho protected routes)
6. Logging (request duration, status)

---

## 12. Database Indexes: Cần xác định từ đầu

**Hiện tại:** Không có index strategy.

**Đề xuất index cho MongoDB:**

```python
# app/db/indexes.py
INDEXES = {
    "users": [
        ("email", unique=True),
        ("phone", sparse=True, unique=True),
    ],
    "subscriptions": [
        ("user_id", unique=True, partial_filter={"status": "active"}),
        ("stripe_subscription_id", unique=True, sparse=True),
        ("status",),
    ],
    "orders": [
        ("user_id",),
        ("stripe_payment_intent", unique=True, sparse=True),
        ("created_at", -1),
    ],
    "courses": [
        ("slug", unique=True),
        ("category_id",),
    ],
    "lessons": [
        ("course_id", "order"),
    ],
    "progress": [
        ("user_id", "course_id", unique=True),
        ("user_id", "updated_at", -1),
    ],
    "events": [  # Idempotency
        ("stripe_event_id", unique=True),
        ("created_at", -1, expireAfterSeconds=86400 * 30),  # TTL index
    ],
}
```

**TTL index** cho events collection quan trọng — tránh phình vô hạn.

---

## 13. Graceful Shutdown

**Hiện tại:** Không đề cập.

**Đề xuất:**
```python
@app.on_event("shutdown")
async def shutdown():
    # 1. Stop accepting new requests
    # 2. Close MongoDB connections
    # 3. Close Redis connections
    # 4. Cancel background tasks
    # 5. Flush pending logs
    pass
```

FastAPI với uvicorn hỗ trợ graceful shutdown, cần đóng connection pool để tránh "connection reset" errors khi deploy.

---

## 14. Tóm tắt ưu tiên triển khai

| Mức độ | Cải thiện | Lý do |
|---|---|---|
| **P0 — Critical** | Video pipeline (Option A: Cloudflare Stream) | Kiến trúc hiện tại không scale, tốn bandwidth, không adaptive bitrate |
| **P0 — Critical** | Idempotency cho webhooks | Sai sót ở đây gây duplicate subscription/payment — mất tiền thật |
| **P1 — High** | Add PostgreSQL cho transactional data | ACID cho payment/subscription — tránh inconsistent state |
| **P1 — High** | Structured logging + Sentry | Không thể debug production nếu thiếu |
| **P1 — High** | Standard error response pattern | Frontend cần handling lỗi nhất quán |
| **P2 — Medium** | Arq cho background jobs | Celery quá nặng cho use case này |
| **P2 — Medium** | Health check endpoints | Kubernetes cần probe để orchestration |
| **P2 — Medium** | Database indexes | Hiệu năng giảm dần khi data lớn nếu thiếu index |
| **P3 — Low** | Dependency injection pattern | Clean code, không critical cho MVP |
| **P3 — Low** | Test factories + integration tests | Cần làm trước khi thêm tính năng mới |
| **P3 — Low** | Graceful shutdown | Deploy an toàn hơn |
| **P3 — Low** | Rate limiting headers | Bảo vệ API khỏi abuse |

---

## Tổng kết

Backend architecture hiện tại (deliverable 07) có nền tảng tốt — FastAPI + MongoDB + Redis là stack hợp lý cho MVP. Các vấn đề chính cần giải quyết:

1. **Video pipeline là rủi ro lớn nhất** — Google Drive proxy không scale được. Chuyển sang Cloudflare Stream/Mux ngay từ đầu tiết kiệm thời gian hơn là migrate sau.
2. **Thiếu observability** — không thể vận hành production nếu không có logging + monitoring.
3. **Transactional data trên MongoDB** — rủi ro inconsistency cho payment. Hybrid với PostgreSQL là giải pháp dài hạn.
4. **Thiếu idempotency cho webhooks** — lỗi phổ biến ở SaaS payment integration, dễ gây mất tiền.
