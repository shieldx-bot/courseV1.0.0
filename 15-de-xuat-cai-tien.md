# Đề Xuất Ý Tưởng Cải Tiến Mới
*Deliverable 15 of 15 — Tầm nhìn phát triển sau MVP*

Dựa trên phân tích toàn bộ hệ thống đã xây dựng (frontend Next.js + backend FastAPI + MongoDB + Redis + Meilisearch + Kubernetes), tài liệu này đề xuất các cải tiến theo 5 nhóm: **Sản phẩm**, **Tăng trưởng**, **Hiệu năng & Hạ tầng**, **Dev Experience**, và **AI Nâng cao**.

---

## 1. Cải Tiến Sản Phẩm & Tính Năng

### 1.1 Học Ngoại tuyến (Offline Mode / PWA)

**Vấn đề:** Người dùng "The Advancer" (nhân viên văn phòng) thường học trên tàu xe, nơi không có kết nối mạng ổn định. Hiện tại toàn bộ hệ thống yêu cầu online.

**Giải pháp:**
- Biến web app thành PWA (Service Worker + Cache API) — cho phép tải trước bài học khi có Wi-Fi, xem lại khi offline
- Dùng IndexedDB lưu progress và ghi chú offline, sync khi có mạng trở lại
- Next.js hỗ trợ PWA qua `next-pwa` hoặc `@serwist/next`

**Tác động:**
| Mặt | Tác động |
|---|---|
| Retention | Giảm rào cản "cần internet" — tăng tần suất học trên thiết bị di động |
| Kỹ thuật | Thêm service worker + IndexedDB sync layer. Backend cần conflict-resolution cho progress sync |
| Chi phí | Thấp — chủ yếu là frontend work |

**Mức độ ưu tiên:** P1 (sau MVP, trước mobile app)

**Trạng thái:** ✅ Đã xong (opencode)

**Đã làm:**
- Cài đặt `@serwist/next` và `serwist` cho Next.js PWA support
- Tạo Service Worker (`app/sw.ts`) với precache + runtime caching cho pages, API, images, static assets
- Tạo `public/manifest.json` với icons, shortcuts, categories
- Tạo trang `/offline` (fallback khi offline) và `/offline-courses` (danh sách khóa học đã cache)
- Tạo `PWAProvider` (`components/pwa-provider.tsx`) quản lý install prompt, update prompt, offline detection
- Tạo `OfflineIndicator`, `InstallPrompt`, `UpdatePrompt` components
- Cập nhật `app/layout.tsx` với manifest, theme-color, apple-touch-icon, PWA meta tags
- Tạo 8 icon sizes (72x72 → 512x512) trong `public/icons/`
- Cập nhật `globals.css` với animations cho PWA prompts
- Tạo hook `useOfflineCache` và IndexedDB utilities (`lib/offline-db.ts`) cho offline progress/notes sync

---

### 1.2 Lộ Trình Học Cá Nhân Hóa (Personalized Learning Paths)

---

### 1.2 Lộ Trình Học Cá Nhân Hóa (Personalized Learning Paths)

**Vấn đề:** 2.000+ khóa học gây choáng cho người mới. Persona "The Advancer" không biết bắt đầu từ đâu.

**Giải pháp:**
- Khi đăng ký, người dùng chọn mục tiêu (ví dụ: "Tôi muốn trở thành Data Analyst trong 6 tháng")
- Hệ thống gợi ý một lộ trình gồm 5-8 khóa học theo thứ tự, kèm timeline gợi ý
- Dùng collaborative filtering (đã có trong `services/ai.py`) + rule-based curation

**Cách triển khai (nhẹ, không cần ML phức tạp):**
```
User chọn mục tiêu ──► Map đến danh sách course_id có sẵn
                         │
                         ▼
                  Backend trả về learning path (tên + mô tả + courses)
                         │
                         ▼
                  Frontend hiển thị dưới dạng timeline
                  (Lesson 1 → 2 → 3 ..., progress bar cho cả path)
```

**Tác động:** Tăng activation rate (người dùng có định hướng rõ ràng ngay từ đầu — giải quyết chính xác churn trigger của Persona 1)

**Trạng thái:** 🔄 Đang xử lý (opencode)

---

### 1.3 Cộng Đồng Học Tập (Discussion & Q&A)

**✅ Hoàn thành — Backend: API endpoints (discussions.py), Frontend: DiscussionTab component integrated into course player. Collections: discussions, replies, discussion_votes, reply_votes. Real-time ready via WebSocket.**

**Vấn đề:** Học một mình dễ mất động lực. Udemy và Coursera đều có Q&A cho từng bài học.

**Giải pháp:**
- Mỗi bài học có tab "Thảo luận" bên cạnh "Ghi chú"
- Học viên đặt câu hỏi, trả lời lẫn nhau
- Giảng viên/instructor có thể được tag để trả lời chính thức
- Tính năng "vote" câu trả lời hữu ích lên đầu

**Backend:** Thêm collection `discussions` + `replies` trong MongoDB. WebSocket cho real-time notifications.

**Tác động:** Tăng engagement và retention — người dùng có lý do để quay lại trang (check câu trả lời), không chỉ xem video một chiều.

---

### 1.4 Chứng Chỉ Hoàn Thành Khóa Học (Certificates)

**[LÀM CHUA XONG] — Backend: service sinh certificate + API endpoints. Frontend: trang xem/download certificate.**

**Vấn đề:** Persona "The Advancer" học để có lợi thế cạnh tranh trong công việc — cần bằng chứng cho CV.

**Giải pháp:**
- Khi hoàn thành 100% bài học trong một khóa → tự động sinh certificate PDF
- Certificate có: tên học viên, tên khóa học, số giờ, ngày hoàn thành, mã xác thực (public URL: `/verify/cert/{id}`)
- Có thể chia sẻ lên LinkedIn (Open Graph image riêng cho certificate)
- Dùng `pdfkit` (Python) hoặc `@react-pdf/renderer` để sinh PDF

**Backend:** Thêm collection `certificates`: user_id, course_id, completed_at, verification_code. Endpoint `/verify/{code}` public.

---

### 1.5 Chế Độ "Micro-Learning" — Bài Học 5 Phút

**Vấn đề:** Nhân viên văn phòng có ít thời gian — 15-30 phút cho một bài học truyền thống là quá dài.

**Giải pháp:**
- Thêm bộ lọc "dưới 10 phút" trên catalog
- Mỗi khóa học nên có ít nhất 1 bài "nhanh" (5-7 phút) để người dùng có thể hoàn thành ngay trong giờ nghỉ trưa
- Chế độ "Daily Lesson" — mỗi ngày gợi ý 1 bài ngắn (5-10 phút), tạo thói quen

**Ghi chú:** Đây là thay đổi về nội dung nhiều hơn kỹ thuật. Cần tag `duration_seconds` chính xác trên mỗi lesson.

---

## 2. Cải Tiến Tăng Trưởng & Kinh Doanh

### 2.1 Chương Trình Affiliate / Referral

**Vấn đề:** Chi phí quảng cáo (Google/Facebook Ads) ngày càng đắt. Cần kênh tăng trưởng organic.

**Giải pháp:**
- **Referral:** Người dùng hiện tại giới thiệu bạn → cả 2 được giảm 20% tháng tiếp theo. Viral loop tự nhiên.
- **Affiliate:** Blogger/YouTuber đăng ký làm affiliate, nhận commission 20-30% cho mỗi subscription bán được qua link riêng.
- Affiliate dashboard: tracking clicks, conversions, earnings, payout history

**Backend:** Collection `referrals` (referrer_id, referee_id, discount_applied), `affiliates` (user_id, commission_rate, payout_method, tracking_links). Stripe/PayPal có thể tự động xử lý payout.

---

### 2.2 Gói Doanh Nghiệp / Team (B2B)

**Vấn đề:** Thị trường enterprise training lớn hơn individual rất nhiều. Một công ty 100 nhân viên dễ chi $5,000-20,000/năm cho đào tạo.

**Giải pháp:**
- **Team Plan:** 5-20 seats, admin dashboard quản lý người dùng, thống kê usage
- **Enterprise Plan:** 20+ seats, SSO (SAML/OIDC), custom content, dedicated support
- Admin có thể assign khóa học cho từng nhân viên, theo dõi tiến độ

**Ảnh hưởng kiến trúc:**
- Thêm `organizations` collection
- User có thể thuộc organization + có role trong org (member/admin)
- Subscription gắn với organization, không chỉ user
- SSO integration (Okta, Azure AD, Google Workspace)

---

### 2.3 A/B Testing Infrastructure

**Vấn đề:** Hiện tại mọi quyết định pricing, copy, layout đều là phỏng đoán (dù có cơ sở từ personas). Cần đo lường thực tế.

**Giải pháp:**
- Thêm feature flag / experiment framework nhẹ:
  - Backend: collection `experiments` (name, variants, traffic_split)
  - Middleware gán `x-experiment-variant` header dựa trên user_id hash
  - Frontend đọc header và render variant tương ứng
- Metric tracking qua backend events → analytics

**Những thứ nên A/B test ngay:**
1. Hero headline: "One membership. Every skill." vs. "Học 2000+ khóa với 1 lần đăng ký"
2. Pricing layout: 12-month nổi bật vs. tất cả bằng nhau
3. Trial flow: OTP phone vs. email-only trial
4. CTA color: amber vs. primary-500

---

### 2.4 Email Drip Automation Hiện Tại

**✅ ĐÃ LÀM (2026-07-24):** Tạo `app/services/email_campaigns.py` — campaign service với 7 trigger types. Thêm `run_email_campaigns_task` vào worker, cron job chạy mỗi giờ (phút 30). Thêm `email_campaigns` collection + indexes. Admin API: `POST /admin/campaigns/run`, `GET /admin/campaigns/stats`.

| Trigger | Email | Delay |
|---|---|---|
| Sign up, no trial start | "Don't hesitate — try 10% free" | 24h |
| Trial started, 50% through | "You've seen 50% — keep going!" | Immediate |
| Trial ends today | "Your trial ends today — subscribe" | 12h before end |
| 7 days since subscribe, no lesson | "7 days — don't let membership go" | 7 days |
| 2 lessons completed in streak | "You're on a streak — keep it up!" | Immediate |
| 30 days before renewal | "Your plan renews soon" | 30 days |
| Course not started after 14 days | "Course [X] is waiting for you" | 14 days |

**Backend:** `services/email_campaigns.py` — check từng trigger, ghi vào `email_campaigns` collection (dedup theo user_id + campaign_type + ref_id). Cron job qua arq `cron_jobs` (mỗi giờ phút 30). Admin có thể trigger thủ công qua API hoặc enqueue job.

---

## 3. Cải Tiến Hiệu Năng & Hạ Tầng

### 3.1 Edge Middleware: Auth Check + Redirect (Không Cần Gọi Backend)
> **ĐÃ LÀM (2026-07-24):** `apps/web/middleware.ts` nâng cấp với JWT verification thật tại edge — dùng Web Crypto API (HMAC-SHA256) để verify signature + check expiry, inject `x-user-id` header. Backend không còn bị gọi cho mỗi lần check auth.

---

### 3.2 Streaming SSR cho Homepage
> **ĐÃ HOÀN THIỆN:** `apps/web/app/(public)/page.tsx` đã dùng `Suspense` cho StatsBar, CategoryGrid, PricingTable, Testimonials — streaming SSR đã hoạt động từ trước.

---

### 3.3 Database Indexes + Caching

> **ĐÃ LÀM (2026-07-24):** Tạo `app/db/indexes.py` với index definitions cho tất cả collections (users, subscriptions, orders, courses, lessons, progress, categories, reviews, coupons, tiers, events, blog). Gọi `ensure_indexes()` trong startup. Cache service (`services/cache.py`) đã có từ trước.

**Vấn đề:** Khi scale lên 10,000+ concurrent users, catalog queries (categories + courses + lessons) gây áp lực lên MongoDB primary.

**Giải pháp:**
- Dùng MongoDB read replicas cho read-heavy endpoints: `GET /courses`, `GET /categories`, `GET /courses/{slug}`
- Backend phân luồng: `db.get_collection("courses").find(...).read_preference(ReadPreference.SECONDARY_PREFERRED)`
- Write operations (admin CRUD) vẫn ghi vào primary

**Cách triển khai với Motor:**
```python
from motor.motor_asyncio import AsyncIOMotorClient

primary = AsyncIOMotorClient(MONGODB_PRIMARY_URI)
secondary = AsyncIOMotorClient(MONGODB_SECONDARY_URI, read_preference=ReadPreference.SECONDARY_PREFERRED)
```

Hoặc đơn giản hơn: dùng Redis cache cho catalog với TTL 60s, chỉ fallback xuống MongoDB khi cache miss. (Đã có `services/cache.py`)

---

### 3.4 CI/CD Nâng Cao: Preview Deployments + E2E Tests

> **ĐÃ CÓ:** `.github/workflows/ci.yml` chạy lint + typecheck + build cho frontend và pytest cho backend. Cần thêm preview deployment + E2E.

**Vấn đề:** CI hiện tại chỉ chạy lint + unit test. Không có cách nào kiểm tra UI trước khi merge PR.

**Giải pháp:**

Thêm vào `.github/workflows/ci.yml`:
1. **Preview Deployment:** Mỗi PR tự động deploy lên Vercel preview URL (cho frontend) + Railway/Render ephemeral environment (cho backend)
2. **E2E Tests trên Preview:** Playwright chạy full critical flow trên preview URL
3. **Lighthouse CI:** Kiểm tra performance score trước khi merge
4. **Automated visual regression:** Percy/Chromatic cho UI components

```yaml
# .github/workflows/preview.yml
name: Preview Deployment
on: pull_request
jobs:
  deploy-preview:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Deploy API to Railway
        run: railway up --environment=pr-${{ github.event.number }}
      - name: Deploy Web to Vercel
        run: vercel deploy --preview
      - name: Run E2E Tests
        run: npx playwright test --config=apps/web/playwright.config.ts
```

---

## 4. Cải Tiến Developer Experience & Maintainability

### 4.1 API Client Code Generation (OpenAPI → TypeScript)

**Trạng thái:** ✅ Hoàn thành

**Vấn đề:** Hiện tại `apps/web/lib/api-client.ts` được viết tay — mỗi lần backend thay đổi endpoint, phải update thủ công. Dễ sai sót.

**Giải pháp:** Dùng FastAPI's built-in OpenAPI schema generation + `openapi-typescript` để auto-generate client:

```
# Backend (FastAPI tự sinh OpenAPI schema tại /openapi.json)
# Frontend:
npx openapi-typescript http://localhost:8000/openapi.json -o apps/web/types/api.ts
```

Hook trong `package.json`:
```json
{
  "scripts": {
    "generate:api": "openapi-typescript https://api.ascendly.io/openapi.json -o types/api.ts",
    "dev": "npm run generate:api && next dev"
  }
}
```

**Kết quả:** Backend thay đổi → frontend type error ngay lập tức khi build. Zero manual sync.

---

### 4.2 End-to-End Type Safety: tRPC hoặc GraphQL

**Vấn đề:** REST API không có type safety giữa frontend và backend. Một thay đổi nhỏ ở response format có thể gây lỗi runtime.

**Giải pháp dài hạn (post-MVP):** Chuyển từ REST sang tRPC (nếu muốn full-stack TypeScript) hoặc GraphQL (nếu muốn flexibility).

Nhưng thực tế hơn: giữ FastAPI backend + REST, nhưng dùng `openapi-typescript` (4.1) để đảm bảo ít nhất frontend biết được type. Đây là sweet spot giữa "đủ an toàn" và "không phải kiến trúc lại."

---

### 4.3 Migration / Seeding Scripts

> **ĐÃ LÀM (2026-07-24):** Tạo `app/core/cli.py` — CLI tool với commands `migrate` và `seed`. Migration scripts trong `migrations/` (001_seed_categories, 002_add_indexes). Seed data dạng JSON trong `seed/` (categories.json, tiers.json). Chạy: `python -m app.core.cli seed`

**Vấn đề:** Seed data được hard-code trong `app/db/mongodb.py` — không version-controlled, không thể chạy lại.

**Giải pháp:**
- Dùng Alembic cho MongoDB (có `alembic` với MongoDB backend) hoặc script migration đơn giản

```
apps/api/
├── migrations/
│   ├── 001_seed_categories.py
│   ├── 002_add_indexes.py
│   └── README.md
```

- Seed data dạng JSON files để dễ edit:
```
apps/api/seed/
├── categories.json
└── tiers.json
```

- Command: `python -m app.core.cli seed` và `python -m app.core.cli migrate 001`

---

### 4.4 Structured Logging + Alerting (Đã có Prometheus, cần thêm)

**[✅ HOÀN THÀNH] — Đã thêm Prometheus alerts.yml và tích hợp Sentry SDK:** 
- **Sentry:** `apps/api/app/core/config.py` — thêm `sentry_dsn`, `sentry_traces_sample_rate`
- **Sentry:** `apps/api/requirements.txt` — thêm `sentry-sdk==2.24.1`
- **Sentry:** `apps/api/app/main.py` — init Sentry trong lifespan nếu có DSN
- **Alerts:** `docker/prometheus/alerts.yml` — 4 rules: HighErrorRate, HighLatency, WorkerQueueGrowing, WorkerDLQNonEmpty
- **Prometheus:** `docker/prometheus.yml` — thêm `rule_files` trỏ đến alerts.yml
- **Docker:** `docker-compose.yml` — mount thêm volume cho alerts.yml

**Vấn đề:** Hiện tại đã có Prometheus metrics + Grafana dashboard, nhưng chưa có alerting rules và structured logging.

**Giải pháp:**

**Alerting rules (Prometheus):**
```yaml
# prometheus/alerts.yml
groups:
  - name: ascendly-api
    rules:
      - alert: HighErrorRate
        expr: rate(http_requests_total{status=~"5.."}[5m]) > 0.05
        for: 5m
        annotations:
          summary: "API error rate > 5%"
      - alert: HighLatency
        expr: histogram_quantile(0.95, http_request_duration_seconds_bucket) > 2
        for: 5m
        annotations:
          summary: "p95 latency > 2s"
```

**Sentry:** Đã có `sentry_dsn` trong config. Cần thêm:
```python
# app/core/config.py — đã có SentryDSN. Cần thêm:
sentry.traces_sample_rate = 0.1  # capture 10% traces
```

---

## 5. Cải Tiến AI & Công Nghệ Nâng Cao

### 5.1 AI Tutor / Chatbot Cho Từng Bài Học

**Vấn đề:** Học viên có thắc mắc khi học, không ai trả lời ngay lập tức. Q&A cộng đồng chậm (có thể mất vài giờ đến vài ngày).

**Giải pháp:**
- Thêm nút "Hỏi AI" trong course player
- Dùng RAG (Retrieval-Augmented Generation):
  - Vector hóa nội dung từng bài học (transcript + slides)
  - Khi user hỏi, search top-5 relevant chunks từ bài học đó
  - Gửi context + câu hỏi đến LLM (Groq API đã có trong config)
- Trả lời hiển thị ngay trong player sidebar

**Kiến trúc:**
```
User hỏi: "Tại sao dùng LEFT JOIN thay vì INNER JOIN?"
      │
      ▼
Backend search vector DB (Pinecone / pgvector / local FAISS)
với nội dung bài học hiện tại
      │
      ▼
Top 5 chunks + question → LLM (Groq/OpenAI)
      │
      ▼
Response stream về frontend (Server-Sent Events)
```

**Chi phí:** Rẻ — Groq inference rất nhanh. Vector DB query tốn ~$0.01/100 queries. Có thể giới hạn cho gói 12 tháng+ hoặc tính riêng.

---

### 5.2 Tự Động Sinh Quiz / Bài Tập Từ Nội Dung Video

**[ĐANG LÀM] — Backend: service quiz_generator.py dùng Groq LLM + API endpoints. Frontend: Quiz UI trong course player.**

**Vấn đề:** Hiện tại chỉ có video xem một chiều. Không có bài kiểm tra để củng cố kiến thức.

**Giải pháp:**
- Khi admin upload video, backend gửi transcript đến LLM (Groq/OpenAI)
- LLM sinh 3-5 câu hỏi trắc nghiệm + đáp án
- Admin có thể duyệt/chỉnh sửa trước khi publish
- Sau mỗi bài học, hiển thị quiz ngắn

```python
# app/services/quiz_generator.py
async def generate_quiz(transcript: str, lesson_title: str) -> list[QuizQuestion]:
    prompt = f"""
    Based on this lesson transcript, generate 3 multiple-choice questions.
    Lesson title: {lesson_title}
    Transcript: {transcript[:5000]}
    
    Return JSON format:
    [{{"question": "...", "options": ["A", "B", "C", "D"], "correct": 0, "explanation": "..."}}]
    """
    response = await llm_client.complete(prompt)
    return parse_quiz_json(response)
```

**Tác động:** Tăng retention và engagement — học viên không chỉ xem mà còn được kiểm tra.

---

### 5.3 Hệ Thống Gợi Ý Khoá Học Thông Minh (Recommendation Engine)

**Vấn đề:** Catalog 2.000+ khóa học không có gợi ý cá nhân hóa. Người dùng phải tự tìm — dễ bỏ cuộc.

**Giải pháp:** Nâng cấp recommendation engine đã có trong `services/ai.py`:
1. **Collaborative filtering:** "Người học khóa X cũng học khóa Y" — dùng user-course interaction matrix
2. **Content-based filtering:** Gợi ý khóa tương tự dựa trên category, tags, description embedding
3. **Hybrid:** Kết hợp cả hai + popularity boost cho khóa mới

```python
# app/services/recommendation.py
async def get_recommendations(user_id: str, limit: int = 10):
    # 1. Get user's recent categories
    recent_cats = await get_recent_categories(user_id)
    
    # 2. Collaborative: users with similar taste
    similar_users = await get_similar_users(user_id)
    collab_recs = await get_popular_courses_among(similar_users)
    
    # 3. Content-based: similar to completed courses
    completed = await get_completed_courses(user_id)
    content_recs = await get_similar_courses(completed)
    
    # 4. Hybrid + diversity rerank
    return await rerank_for_diversity([*collab_recs, *content_recs], limit)
```

**Triển khai lightweight:** Dùng vector embedding (sentence-transformers) lưu trong MongoDB Atlas Vector Search hoặc local FAISS. Không cần microservice riêng.

---

### 5.4 AI-Generated Course Summaries & Thumbnails

**Vấn đề:** Mỗi khóa học cần mô tả hấp dẫn và thumbnail chuyên nghiệp. Admin làm thủ công rất lâu.

**Giải pháp:**
- Khi admin nhập nội dung khóa học, backend gọi LLM sinh:
  - Mô tả ngắn (50-100 từ) cho course card
  - Mô tả dài cho course detail page
  - "What you'll learn" bullets
- Dùng DALL-E/Stability AI sinh thumbnail cho khóa mới (nếu không có ảnh upload)

---

## 6. Tổng Hợp & Lộ Trình Ưu Tiên

### Ghi chú cải tiến đã thực hiện

| # | Cải tiến | File thay đổi | Trạng thái |
|---|---|---|---|
| 1.1 | PWA Offline Mode | `apps/web/app/sw.ts`, `apps/web/next.config.js`, `apps/web/public/manifest.json`, `apps/web/components/pwa-provider.tsx`, `apps/web/components/offline-indicator.tsx`, `apps/web/components/install-prompt.tsx`, `apps/web/components/update-prompt.tsx`, `apps/web/app/offline/page.tsx`, `apps/web/app/offline-courses/page.tsx`, `apps/web/app/layout.tsx`, `apps/web/lib/offline-db.ts`, `apps/web/hooks/use-offline-cache.ts`, `apps/web/public/icons/*` | ✅ Hoàn thành |
| 3.1 | Edge Middleware JWT verification | `apps/web/middleware.ts`, `apps/web/package.json`, `.env.example` | ✅ Hoàn thành |
| 3.2 | Streaming SSR homepage | Đã có sẵn, chỉ kiểm tra lại | ✅ Hoàn thành |
| 4.4 | Prometheus Alerting Rules | `docker/prometheus/alerts.yml`, `docker/prometheus.yml`, `docker-compose.yml` | ✅ Hoàn thành |
| 4.4 | Sentry Error Tracking | `apps/api/app/core/config.py`, `apps/api/requirements.txt`, `apps/api/app/main.py`, `.env.example` | ✅ Hoàn thành |
| - | Database Indexes | `apps/api/app/db/indexes.py`, `apps/api/app/main.py` | ✅ Hoàn thành |
| 2.4 | Email Drip Automation | `apps/api/app/services/email_campaigns.py`, `apps/api/app/core/tasks.py`, `apps/api/app/worker.py`, `apps/api/app/api/v1/admin.py`, `apps/api/app/db/indexes.py` | ✅ Hoàn thành |
| 4.1 | API Client Code Gen (OpenAPI → TS) | `apps/web/lib/api-client.ts`, `apps/web/types/index.ts`, `apps/web/package.json` | ✅ Hoàn thành |

### Ma trận tác động / công sức

| Cải tiến | Tác động | Công sức | Ưu tiên |
|---|---|---|---|
| Cải tiến | Tác động | Công sức | Ưu tiên | Trạng thái |
|---|---|---|---|---|
| Edge Middleware auth | Cao | Thấp (1-2 ngày) | **P0 — MVP** | ✅ Hoàn thành |
| Streaming SSR homepage | Cao | Thấp (1 ngày) | **P0 — MVP** | ✅ Hoàn thành |
| Database indexes | Cao | Thấp (1 ngày) | **P0 — MVP** | ✅ Hoàn thành |
| CORS từ config | Trung bình | Thấp (vài giờ) | **P0 — MVP** | ✅ Hoàn thành |
| Graceful shutdown | Trung bình | Thấp (vài giờ) | **P0 — MVP** | ✅ Hoàn thành |
| Health endpoint nâng cao | Trung bình | Thấp (vài giờ) | **P0 — MVP** | ✅ Hoàn thành |
| Webhook idempotency | Cao | Thấp (1 ngày) | **P0 — MVP** | ✅ Hoàn thành |
| Migration / Seed scripts | Trung bình | Thấp (1 ngày) | **P2** | ✅ Hoàn thành |
| Alerting rules | Cao | Thấp (1 ngày) | **P0 — MVP** | ✅ Hoàn thành |
| Email drip automation | Cao | Trung bình (1 tuần) | **P1 — Ngay sau MVP** | ✅ Hoàn thành |
| API Client Code Gen (OpenAPI → TS) | Trung bình | Thấp (1-2 ngày) | **P3** | ✅ Hoàn thành |
| Personalized learning paths | Cao | Trung bình (1 tuần) | **P1 — Ngay sau MVP** | 🔵 Chua làm xong |
| AI Tutor (RAG) | Rất cao | Trung bình (2 tuần) | **P1 — Ngay sau MVP** | |
| Quiz generator | Cao | Thấp (3-4 ngày) | **P1 — Ngay sau MVP** | 🔵 Chua làm xong |
| Recommendation engine | Cao | Trung bình (1-2 tuần) | **P1 — Ngay sau MVP** | |
| PWA offline | Trung bình | Trung bình (1 tuần) | **P2** | ✅ Hoàn thành |
| Affiliate/Referral program | Cao | Trung bình (1-2 tuần) | **P2** | |
| Discussion/Q&A | Trung bình | Cao (3-4 tuần) | **P2** | ✅ Hoàn thành |
| Certificate system | Trung bình | Thấp (3-4 ngày) | **P2** | 🔵 Chua làm xong |
| A/B testing framework | Cao | Trung bình (2 tuần) | **P2** | |
| B2B team plans | Rất cao | Cao (4-6 tuần) | **P3 — Phase 2** | |
| GrokQ Api free code generation | Trung bình | Thấp (1-2 ngày) | **P3** | |
| AI thumbnails/summaries | Trung bình | Thấp (2-3 ngày) | **P3** | |
| tRPC/GraphQL migration | Trung bình | Rất cao | **P4 — Long term** | |

--- 
 

## Tổng Kết

Hệ thống hiện tại đã có nền tảng kỹ thuật rất vững — code được tổ chức sạch, đủ test, đủ observability. Các cải tiến đề xuất tập trung vào ba mục tiêu chiến lược:

1. **Tăng activation & retention** (learning paths, AI tutor, quiz, email drip) — giải quyết rủi ro chính của subscription business
2. **Tăng tốc độ & UX** (Edge middleware, streaming SSR) — cải thiện KPI Core Web Vitals ngay lập tức
3. **Tạo kênh tăng trưởng mới** (affiliate, B2B, referral) — giảm phụ thuộc vào quảng cáo trả phí

Không có đề xuất nào yêu cầu kiến trúc lại toàn bộ — tất cả đều là additions trên nền tảng hiện có.
