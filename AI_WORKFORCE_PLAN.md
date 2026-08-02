# AI WORKFORCE PLAN — Phân Chia Công Việc Cho Đội AI (Ascendly Platform)

> **Người giám sát:** Bạn (Supervisor) — điều phối tổng thể, review, merge, quyết định ưu tiên.
> **AI-A:** Chuyên viên Backend (FastAPI, MongoDB, Redis, LLM, domain services).
> **AI-B:** Chuyên viên DevOps (Docker, K8s/Helm, CI/CD, Observability, Release).
> **AI-C:** Chuyên viên Frontend (Next.js, TypeScript, Tailwind, PWA, components).

---

## 1. Vai Trò & Ranh Giới

| Agent | Phạm vi phụ trách | KHÔNG đụng vào | Đầu ra chính |
|---|---|---|---|
| **AI-A (Backend)** | `apps/api/app/services/*`, `apps/api/app/api/v1/*`, `apps/api/app/core/*`, migrations, seed, tests API | File `apps/web/*`, `k8s/*`, `helm/*`, `docker/*` (trừ khi có task DevOps riêng) | API services, endpoints, tests, migration SQL |
| **AI-B (DevOps)** | `docker/*`, `docker-compose.yml`, `k8s/*`, `helm/*`, CI/CD (`.github/workflows` hoặc tương đương), `prometheus/*`, scripts build & deploy | Logic nghiệp vụ backend, UI logic frontend | Manifests, pipelines, runbook, monitoring, release |
| **AI-C (Frontend)** | `apps/web/app/*`, `apps/web/components/*`, `apps/web/lib/*`, `apps/web/types/*`, tests web (jest/playwright) | Backend logic, infra config | Pages, components, API client, types, UI tests |
| **Supervisor (Bạn)** | Toàn bộ repo | — | Kế hoạch phase, giao việc, review contract, merge, kiểm tra Definition of Done |

### Nguyên tắc bất biến (không được vi phạm)
1. **Contract API là giao diện 2 chiều**: AI-A định nghĩa response envelope `{success, data, error, meta}`; AI-C tiêu thụ đúng shape. Không thay đổi contract khi chưa qua Supervisor.
2. **Không AI nào tự ý thay đổi file của AI khác.** Mọi chỗ giao nhau → tạo PR riêng, thông báo Supervisor.
3. **Mỗi phase kết thúc = CI xanh + tests pass + Điểm tích hợp đã ký xác nhận (integration sign-off).**
4. **Mọi thay đổi DB:** AI-A viết migration; AI-B đảm bảo chạy được trong CI/dev/staging; AI-C không bao giờ viết migration.
5. **Definition of Done chung:** `py_compile` API pass, `tsc` frontend pass, test suite pass, không lỗi lint, doc cập nhật nếu đổi behavior.

---

## 2. Quy Trình Giám Sát (Supervisor Workflow)

```
Mỗi Phase
  1. Supervisor giao việc cho từng AI (theo bảng phase bên dưới)
  2. Các AI làm song song nếu không conflict; tuần tự nếu có dependency
  3. Supervisor review contract API trước khi AI-C bắt đầu gọi
  4. CI chạy: vừa làm vừa giữ xanh
  5. Cuối phase: Supervisor chạy full test + kiểm tra DoD → ký sign-off → sang phase sau
```

**Checklist giám sát mỗi phase:**
- [ ] Contract API đã đóng băng (AI-A publish OpenAPI snippet cho AI-C)
- [ ] Migration chạy sạch trên DB mới (AI-B verify)
- [ ] `pytest apps/api/tests` pass toàn bộ
- [ ] `npm run build` + `npm test` web pass
- [ ] `kubectl apply --dry-run=client` / `helm template` pass (nếu phase có thay đổi infra)
- [ ] Tài liệu phase cập nhật

---

## 3. BẢNG PHASE TỔNG THỂ

| Phase | Tên | Thời lượng dự kiến | Mục tiêu chính |
|---|---|---|---|
| **P0** | Nền tảng & Chuẩn hóa | 3–5 ngày | CI xanh, test isolation, chuẩn contract, local dev tooling |
| **P1** | Support System — Foundation | 1–2 tuần | Tickets, KB CRUD, trang /help cơ bản |
| **P2** | Support System — AI Support | 1–2 tuần | Chatbot RAG, chat widget streaming |
| **P3** | Support System — Proactive & Admin | 1–2 tuần | Proactive engine, admin dashboard, SLA |
| **P4** | Adaptive Learning — Foundation | 1 tuần | Concepts, mastery CRUD, adaptive quiz cơ bản |
| **P5** | Adaptive Learning — Mastery Engine | 1–2 tuần | Elo update, gap detect, quiz adaptive theo mastery |
| **P6** | Adaptive Learning — Remediation & Sequencing | 1–2 tuần | Remedial content AI, skip/reroute động |
| **P7** | Architecture Hardening (theo Audit) | 2–3 tuần | Fix debt C1/H1/H2, split ecosystem, publish events, scheduler intelligence |
| **P8** | Production Readiness & Release | 2 tuần | GitOps, HPA/alerts, secrets, promotion dev→staging→prod |

---

## 4. CHI TIẾT TỪNG PHASE

---

### PHASE 0 — Nền Tảng & Chuẩn Hóa (Foundation)

**Mục tiêu:** Nền tảng vững trước khi thêm tính năng. Giải quyết nợ kỹ thuật chặn mọi work (Audit: C1, H1, M1, M2, L1).

| Agent | Công việc cụ thể | File/Đối tượng |
|---|---|---|
| **AI-A** | 1. Fix test isolation: reset rate limiter per test/fixture (C1) — tránh 429 khi chạy gộp suite<br>2. Fix Python 3.12+ `get_event_loop()` → `asyncio.run` trong `test_community_ai` (M1)<br>3. Dọn Pydantic v2 `Config` class → `model_config` (M2)<br>4. Viết mutation helpers (create/update/push) + parity test cho in-memory DB `$push` (H1)<br>5. Xóa dead `_safe` + unused imports trong `intelligence.py` (L1) | `apps/api/tests/conftest.py`, `apps/api/tests/test_community_ai.py`, `apps/api/app/schemas/*`, `apps/api/app/db/helpers.py`, `apps/api/app/services/intelligence.py` |
| **AI-B** | 1. Dựng CI pipeline: pull request → `pytest` (API) + `tsc/build/test` (web) song song<br>2. Cache dependencies (pip/npm) để CI nhanh<br>3. Local dev tooling: Makefile/task runner `make setup`, `make test-api`, `make test-web`, `make lint`, `make compose-up`<br>4. Verify migrations runner tồn tại & chạy được (migrate/0_migrate/backfill pattern) | `.github/workflows/*` (hoặc CI tương đương), `Makefile`, `docker-compose.yml`, `apps/api/migrations/README.md` |
| **AI-C** | 1. Định chuẩn data-fetching: wrapper API client thống nhất (env-backed, error envelope, typed)<br>2. Thêm per-route loading boundaries & skeletons nếu thiếu (Audit IX gap)<br>3. Jest setup + accessibility baseline test<br>4. Audit lighthouse budget cơ bản | `apps/web/lib/api-client.ts`, `apps/web/app/**/loading.tsx`, `apps/web/jest.config.ts`, `apps/web/lighthouse-budget.json` |

**Điểm tích hợp:** CI pipeline (AI-B) phải include được full suite API của AI-A; AI-C đảm bảo build web không phụ thuộc API đang chạy (mock trong CI).

**Supervisor gate:** CI xanh cho cả 2 app trong ≤ 8 phút; chạy gộp API suite không còn 429.

---

### PHASE 1 — Support System: Foundation (Tickets + Knowledge Base CRUD)

**Nguồn:** File `15-de-xuat-cai-tien.md` — Phase 1 (Tuần 1–2).

| Agent | Công việc cụ thể | File/Đối tượng |
|---|---|---|
| **AI-A** | 1. Migration + collections: `support_tickets`, `ticket_messages`, `help_articles` + indexes<br>2. Service `support_tickets.py`: `create_ticket`, `add_message`, `update_status`, `assign`, `get_user_tickets`, `get_admin_tickets`<br>3. Service `knowledge_base.py`: CRUD article, `get_by_slug`, `record_feedback`, `search_articles` (full-text cơ bản)<br>4. API `api/v1/support.py`: `GET/POST /support/tickets`, `GET /support/tickets/{id}`, `POST .../messages`, `POST .../resolve`<br>5. API `api/v1/knowledge.py`: `GET/POST /knowledge/articles`, `GET /knowledge/articles/{slug}`, `POST .../feedback`<br>6. Admin endpoints: `GET /admin/support/tickets`, `POST .../assign`, `POST .../status`, `GET /admin/support/stats`<br>7. Seed FAQs hiện tại vào `help_articles`<br>8. Tests: `test_support_system.py` (ticket workflow, permission, status transitions) | `apps/api/app/services/support_tickets.py`, `apps/api/app/services/knowledge_base.py`, `apps/api/app/api/v1/support.py`, `apps/api/app/api/v1/knowledge.py`, `apps/api/app/db/*`, `apps/api/tests/test_support_system.py` |
| **AI-B** | 1. Đưa migration mới vào CI migration runner<br>2. Cấu hình indexes seeding khi start dev/staging (verify collection+index tồn tại)<br>3. Test data seed script cho môi trường dev (giả lập tickets/articles) | `apps/api/migrations/*`, docker-compose, scripts |
| **AI-C** | 1. Types: `support.ts` (Ticket, TicketMessage, Article, Feedback) + dựa trên OpenAPI AI-A<br>2. Lib: `lib/support-api.ts` (CRUD tickets, articles, feedback)<br>3. User view: `components/support/TicketDashboard.tsx` (list + detail + message thread + new ticket form)<br>4. Trang: `app/(app)/support/tickets/page.tsx`<br>5. Trang knowledge base: `app/(public)/help/page.tsx` (search + category filter + article card + "was this helpful")<br>6. UI tests cho 2 trang | `apps/web/types/support.ts`, `apps/web/lib/support-api.ts`, `apps/web/components/support/TicketDashboard.tsx`, `apps/web/app/(app)/support/tickets/page.tsx`, `apps/web/app/(public)/help/page.tsx` |

**Điểm tích hợp (contract):** AI-A publish response shape cho tickets/articles (envelope). AI-C bám đúng. Admin endpoints chưa cần UI ở phase này (AI-C làm ở P3).

**Supervisor gate:** User tự tạo ticket → admin assign → đổi status → user xem được; KB search trả kết quả; tests pass.

---

### PHASE 2 — Support System: AI Support (Chatbot RAG + Chat Widget)

**Nguồn:** File 15 — Phase 2 (Tuần 3–4).

| Agent | Công việc cụ thể | File/Đối tượng |
|---|---|---|
| **AI-A** | 1. Service `support_ai.py`: `search_knowledge_base(query, top_k=5)` (vector + keyword), `generate_support_response` (LLM + RAG context), `create_ticket_from_conversation`, `escalate_to_human`<br>2. Vector hóa `help_articles` (embeddings; lưu vector vào collection hoặc index riêng)<br>3. API `POST /support/chat` — nhận question + user context (subscription, plan), trả response stream (SSE nếu khả thi)<br>4. Prompt safety & guardrail (không tiết lộ system prompt, rate-limit chat)<br>5. Tests: `test_support_ai.py` (mock LLM, RAG ranking, context injection) | `apps/api/app/services/support_ai.py`, `apps/api/app/api/v1/support.py` (thêm chat endpoint), cấu hình LLM trong `core/config.py`, tests mới |
| **AI-B** | 1. Đảm bảo biến môi trường LLM (Groq/OpenAI, API key) có placeholder trong ConfigMap/Secret cho dev & CI mock<br>2. Cấu hình rate-limit & timeout cho endpoint chat (chống treo)<br>3. Streaming support qua reverse proxy/web server (nginx/ingress buffering off cho SSE nếu dùng) | `k8s/configmap.yaml`, `k8s/secret.yaml`, `docker-compose.yml`, ingress |
| **AI-C** | 1. Component `components/support/SupportChatWidget.tsx`: floating button, expandable panel, message history (localStorage + backend), typing indicator, streaming response, quick replies<br>2. Quick action: "Create ticket" khi AI không giải quyết được → gọi tạo ticket<br>3. Tích hợp widget vào `app/layout.tsx` (toàn platform)<br>4. Lib: thêm `support-api.ts` method `chat()` (streaming)<br>5. UI tests cho widget (mock SSE) | `apps/web/components/support/SupportChatWidget.tsx`, `apps/web/app/layout.tsx`, `apps/web/lib/support-api.ts` |

**Điểm tích hợp:** AI-A define SSE payload format rõ (chunk event + `[DONE]` + meta). AI-C consume đúng. AI-B đảm bảo local dev có thể gọi LLM hoặc mock.

**Supervisor gate:** Chat trên mọi trang; câu hỏi billing trả lời đúng dựa trên KB; tạo ticket từ chat hoạt động; không lộ prompt.

---

### PHASE 3 — Support System: Proactive Intervention + Admin & Analytics

**Nguồn:** File 15 — Phase 3 + 4 (Tuần 5–8).

| Agent | Công việc cụ thể | File/Đối tượng |
|---|---|---|
| **AI-A** | 1. Service `proactive_support.py`: `check_video_rewatch`, `check_checkout_drop`, `check_learning_stall`, `check_quiz_low_score`, `trigger_intervention`<br>2. Event tracking mới: `video_rewatch`, `checkout_drop`, `learning_stall`, `quiz_low_score`, `search_no_click`, `error_occurred` (mở rộng event schema)<br>3. Worker/cron job chạy mỗi 15 phút quét patterns (hook vào worker pool hiện có)<br>4. Auto-classify & auto-route ticket bằng AI (`auto_classify_and_route`), SLA tracking (P1:4h, P2:24h, P3:72h)<br>5. Notification integration: in-app + email khi intervention/ticket update<br>6. Admin stats: tickets by category, resolution time, satisfaction<br>7. Tests cho từng detection + SLA | `apps/api/app/services/proactive_support.py`, `apps/api/app/services/support_tickets.py` (mở rộng), `apps/api/app/worker.py`, `apps/api/app/core/tasks.py`, tests mới |
| **AI-B** | 1. Deploy cron/worker deployment cho proactive job (lịch 15 phút — không trùng lặp, `ttlSecondsAfterFinished` nếu CronJob)<br>2. Email service stub → tích hợp SMTP (dev: Mailhog/Mailpit; prod: provider)<br>3. Alert/monitor: nếu job fail hoặc tickets P1 quá hạn SLA → Prometheus alert<br>4. Kiểm tra network policy cho phép worker → email services | `k8s/cron-deployment.yaml`/`worker-deployment.yaml`, `docker-compose.yml` (mailhog), `prometheus/alerts.yml`, `k8s/networkpolicy.yaml` |
| **AI-C** | 1. Admin `components/admin/SupportDashboard.tsx`: ticket list + filters (category/status/priority/assigned), detail panel, quick reply, KB management<br>2. KPI cards: tickets by category, resolution time, satisfaction<br>3. Support stats API client + types<br>4. Trang admin: `app/admin/support/page.tsx` + nav cập nhật<br>5. UI cho intervention notification (toast/banner khi được trigger) | `apps/web/components/admin/SupportDashboard.tsx`, `apps/web/app/admin/support/page.tsx`, `apps/web/lib/support-api.ts`, `apps/web/types/support.ts`, `apps/web/components/shared/navbar.tsx` |

**Điểm tích hợp:** AI-A event schema cho behavior tracking; AI-C dùng để hiển thị notification. AI-B deploy email + cron trước khi AI-A gửi email thật.

**Supervisor gate:** Mô phỏng user rewatch 3 lần → hệ thống trigger intervention hiển thị; admin xử lý ticket + SLA đúng; stats chính xác.

---

### PHASE 4 — Adaptive Learning: Foundation (Concepts + Mastery CRUD)

**Nguồn:** File `16-de-xuat-cai-tien-adaptive-learning.md` — Phase 1 (Tuần 1–2).

| Agent | Công việc cụ thể | File/Đối tượng |
|---|---|---|
| **AI-A** | 1. Migration + collections: `concept_definitions`, `concept_mastery` (mở rộng `quiz_attempts` thêm `concept_ids`, `difficulty`, `mastery_before/after`)<br>2. Service `concept_mastery.py`: CRUD + `get_or_create_mastery`, `get_course_mastery_map`, `get_weak/strong_concepts`<br>3. Service `adaptive_quiz.py` (cơ bản): lấy câu hỏi theo lesson, seed 20–30 câu mẫu kèm `concept_id` + `difficulty`<br>4. API `api/v1/adaptive.py`: `GET /adaptive/mastery/{course_id}`, `GET /adaptive/concepts/{course_id}`, `POST /adaptive/quiz/{course_id}/generate` (chưa adaptive — lọc theo lesson)<br>5. Admin API: `admin_adaptive.py` CRUD concepts + bulk import<br>6. Tests: `test_adaptive_learning.py` | `apps/api/app/services/concept_mastery.py`, `apps/api/app/services/adaptive_quiz.py`, `apps/api/app/api/v1/adaptive.py`, `apps/api/app/api/v1/admin_adaptive.py`, `apps/api/app/db/seed_concepts.py`, tests |
| **AI-B** | 1. Migration + index cho concept collections trong dev/staging<br>2. Seed script chạy cùng migration runner (idempotent)<br>3. Đảm bảo DB parity test phủ `$set`/`$inc` cho mastery update | `apps/api/migrations/*`, scripts |
| **AI-C** | 1. Types: `adaptive.ts` (ConceptDefinition, ConceptMastery, QuizAttempt)<br>2. Lib: `lib/adaptive-client.ts` (mastery map, concepts, quiz generate/submit)<br>3. Component `components/adaptive/AdaptiveQuiz.tsx` (phiên bản cơ bản: hiển thị câu hỏi, submit, kết quả)<br>4. Component `components/adaptive/MasteryRadar.tsx` (radar chart màu: đỏ <3, vàng 3–6, xanh >6)<br>5. Trang: `app/(app)/learn/[course]/mastery/page.tsx` (radar + timeline)<br>6. Trang quiz: `app/(app)/learn/[course]/[lesson]/adaptive-quiz/page.tsx` | `apps/web/types/adaptive.ts`, `apps/web/lib/adaptive-client.ts`, `apps/web/components/adaptive/*`, `apps/web/app/(app)/learn/**/mastery/page.tsx`, `apps/web/app/(app)/learn/**/adaptive-quiz/page.tsx` |

**Điểm tích hợp:** AI-A định nghĩa node cho câu hỏi generate (question payload shape); AI-C render đúng. Mastery score format float 0–10.

**Supervisor gate:** Admin tạo concept; user xem mastery radar; quiz cơ bản submit được.

---

### PHASE 5 — Adaptive Learning: Mastery Engine (Elo + Adaptive Quiz)

**Nguồn:** File 16 — Phase 2 (Tuần 3–4).

| Agent | Công việc cụ thể | File/Đối tượng |
|---|---|---|
| **AI-A** | 1. Implement thuật toán cập nhật mastery (Elo-based công thức trong file 16, mục 6)<br>2. `detect_gaps()` + prerequisite checking (`get_prerequisites`)<br>3. Adaptive quiz selection: chọn câu hỏi theo `difficulty ≈ mastery`, câu yếu trước<br>4. `grade_quiz(attempt_id, answers)` → cập nhật mastery theo từng concept, trả breakdown<br>5. API: `POST /adaptive/quiz/{course_id}/submit`, `GET /adaptive/weak/{course_id}`, `GET /adaptive/prerequisites/{course_id}/{concept_id}`<br>6. Tests: thuật toán mastery (tăng/giảm/ngưỡng), adaptive selection, prerequisite sort | `apps/api/app/services/concept_mastery.py`, `apps/api/app/services/adaptive_quiz.py`, `apps/api/app/api/v1/adaptive.py`, tests |
| **AI-B** | 1. Cache layer: kết quả quiz/update mastery vào Redis để giảm đọc DB nóng<br>2. Theo dõi metric: số quiz/h, độ trễ submit quiz → dashboard | `apps/api/app/db/*` (redis helper), Prometheus metric |
| **AI-C** | 1. Nâng cấp `AdaptiveQuiz.tsx`: progress bar theo concept mastery, hiển thị độ khó câu hỏi, breakdown sau quiz + animation mastery update<br>2. Nút "Skip to harder content" nếu mastery cao<br>3. `ConceptCard.tsx` + `RemedialPanel.tsx` (mock data trước — real ở P6)<br>4. Mastery page hiển thị weak/strong concepts, gọi API mới | `apps/web/components/adaptive/*`, `apps/web/lib/adaptive-client.ts`, `apps/web/app/(app)/learn/**/mastery/page.tsx` |

**Điểm tích hợp:** AI-A công bố response breakdown quiz (per-concept mastery before/after). AI-C dùng cho animation + remedial trigger.

**Supervisor gate:** Làm quiz → mastery tăng/giảm đúng thuật toán; câu hỏi sau khó hơn nếu đúng; API trả breakdown.

---

### PHASE 6 — Adaptive Learning: Remediation + Dynamic Sequencing

**Nguồn:** File 16 — Phase 3 + 4 (Tuần 5–8).

| Agent | Công việc cụ thể | File/Đối tượng |
|---|---|---|
| **AI-A** | 1. Service `remediation.py`: `detect_gaps`, `generate_remedial_content` (LLM: giải thích lại, micro-exercise 2–3 câu, analogies), `get_recommended_remediation`<br>2. Cache remedial content (tránh gọi LLM lặp)<br>3. API: `GET /adaptive/remediation/{course_id}`, `POST /adaptive/skip/{course_id}/{lesson_id}` (pre-test pass → skip/reroute)<br>4. Dynamic sequencing: rerouting thứ tự lessons theo mastery; hook vào progress/learn flow<br>5. AI Tutor integration: truyền weak concepts vào context tutor<br>6. Tests: remediation generation mock LLM, skip logic, sequencing | `apps/api/app/services/remediation.py`, `apps/api/app/api/v1/adaptive.py`, `apps/api/app/api/v1/adaptive.py` (skip), tests |
| **AI-B** | 1. Cache template + LLM timeout/retry cho remediation generation<br>2. Metric: % user cải thiện mastery sau remediation (analytics pipeline)<br>3. Monitoring nếu LLM cost tăng đột biến → alert | Prometheus, alerts, Redis |
| **AI-C** | 1. `RemedialPanel.tsx` thật: hiển thị "You struggled with: X", nút Review video / Micro-exercise / Ask AI tutor, "I got it, skip anyway"<br>2. Trigger panel sau khi hoàn thành lesson có concept yếu<br>3. Skip UI: pre-test voluntary + option "Show all lessons"<br>4. Admin view: mastery heatmap theo course, concept difficulty (dùng admin adaptive stats API)<br>5. Trang admin adaptive: `app/admin/adaptive/page.tsx` | `apps/web/components/adaptive/RemedialPanel.tsx`, `apps/web/components/adaptive/AdaptiveQuiz.tsx`, `apps/web/lib/adaptive-client.ts`, `apps/web/app/admin/adaptive/page.tsx` |

**Điểm tích hợp:** AI-A API trả remedial suggestions (video segment refs, micro-exercises); AI-C render panel. Skip endpoint trả `updated_sequence`; AI-C cập nhật lộ trình UI.

**Supervisor gate:** User yếu concept → panel hiện; làm micro-exercise → mastery tăng; skip hoạt động; admin xem heatmap.

---

### PHASE 7 — Architecture Hardening (theo SYSTEM ARCHITECTURE AUDIT)

**Nguồn:** Audit Step 10–13; `SYSTEM ARCHITECTURE AUDIT.md` (C1/H1/H2, Split ecosystem, missing events, scheduler).

| Agent | Công việc cụ thể | File/Đối tượng |
|---|---|---|
| **AI-A** | 1. **Split god service `ecosystem.py`** (creator/marketplace/events/moderation) — giữ router shim cho backward compat; tách functions vào service mới: `creator.py`, `marketplace.py`, `events_service.py`, `moderation.py`<br>2. Publish 8–10 missing domain events: `ChallengePublished`, `CreatorFollowed`, `CreatorVerified`, `RatingChanged`, `CertificateIssued`, `ReportSubmitted`, `ModerationCompleted`, `SkillMastered`, `UserRegistered`, `EventJoined` → đăng ký handler + test idempotency<br>3. Schema contract cho intelligence: tạo read-only module/constants ánh xạ collection names (không hardcode chuỗi rải rác)<br>4. Dual-source counter contract: đồng bộ `stats.attempts/ratings` qua event thay vì cập nhật trực tiếp (nếu khả thi)<br>5. Chuyển logic grading khỏi `community.py` sang domain Challenges (`challenges_service`)<br>6. Regression tests toàn bộ sau refactor | `apps/api/app/services/ecosystem.py` (tách), `apps/api/app/services/*` mới, `apps/api/app/core/events.py`, `apps/api/app/services/event_handlers.py`, `apps/api/app/services/intelligence.py`, tests |
| **AI-B** | 1. **Background intelligence scheduler**: chuyển `intelligence.overview` từ request-time → worker job định kỳ ghi snapshot; `platform_ops.sync` thành scheduled listener<br>2. TTL/archive job cho `activity_events` + `notifications` (retention policy)<br>3. Request-ID trace correlation (middleware + header truyền log)<br>4. CI: tăng coverage gate, thêm job chạy migrate-on-empty + seed<br>5. Performance budgets cho endpoint nóng (p99) nếu dữ liệu sẵn | `apps/api/app/worker.py`, `apps/api/app/core/tasks.py`, `apps/api/app/services/intelligence.py` (chỉ gọi qua job), scripts, CI, Prometheus |
| **AI-C** | 1. Refactor components phụ thuộc các endpoint bị tách (kiểm tra contract không đổi — shim giữ ổn định)<br>2. Hiển thị KPI từ intelligence snapshot (nếu public hoặc admin) — nếu có<br>3. Không công việc lớn — chủ yếu regression test UI + fix nếu contract thay đổi | `apps/web/components/ecosystem/*`, `apps/web/lib/ecosystem-api.ts` (nếu cần) |

**Điểm tích hợp:** AI-B deploy scheduler trước khi AI-A chuyển intelligence sang job (fallback request-time giữ lại). AI-A đảm bảo shim giữ nguyên response → AI-C không phải đổi.

**Supervisor gate:** Refactor xong toàn bộ tests API pass; không thay đổi response nhìn từ ngoài; worker chạy intelligence định kỳ; collections có TTL.

---

### PHASE 8 — Production Readiness & Release

**Nguồn:** `CLOUD NATIVE.md`, `RELEASE_MODEL.md`, `ENVIRONMENT_MODEL.md`.

| Agent | Công việc cụ thể | File/Đối tượng |
|---|---|---|
| **AI-A** | 1. Hỗ trợ runtime: đảm bảo config theo env (dev/staging/prod) qua ConfigMap/Secret<br>2. Health/ready endpoints chuẩn cho K8s probes<br>3. Smoke test suite chạy sau deploy (post-deploy verification)<br>4. Hỗ trợ fix phát sinh trong quá trình release | `apps/api/app/core/config.py`, `apps/api/app/main.py` (probes/health), tests smoke |
| **AI-B** | 1. **GitOps**: ArgoCD hoặc Flux cho promotion dev→staging→prod (hoặc CI push image + kubectl/helm upgrade có gate)<br>2. **HPA** cho api/web dựa trên CPU/memory (Audit: no HPA yet)<br>3. **Secrets management**: SealedSecret hoặc SOPS thay placeholder hiện tại<br>4. **Observability**: Prometheus + Grafana dashboards, alerts (SLA ticket, error rate, p99 latency, LLM cost)<br>5. **Release pipeline**: build image immutable tag `ascendly-api:<ver>` / `ascendly-web:<ver>`, promote qua 3 env, rollback runbook<br>6. Performance/lighthouse budget gate trong CI | `helm/*`, `k8s/*`, `.github/workflows/release.yml`, `docker/*`, `prometheus/*`, `docker/grafana/*` |
| **AI-C** | 1. Performance: tối ưu bundle, lazy-load, image optimization<br>2. Lighthouse CI budget (performance ≥ 90, a11y ≥ 95)<br>3. E2E playground suite chạy trên staging (smoke critical paths: login, học, ticket, quiz)<br>4. UAT support (fix bug báo cáo từ staging) | `apps/web/package.json` (scripts), `apps/web/playwright.config.ts`, `apps/web/e2e/*`, `apps/web/lighthouse-budget.json` |

**Điểm tích hợp:** AI-B release pipeline chạy AI-A smoke tests + AI-C e2e trước promotion. AI-A/AI-C đóng góp test vào đúng stage.

**Supervisor gate:** Deployment lên staging thành công (helm template + rollout pass); smoke + e2e xanh; alerts kích hoạt đúng khi có sự cố.

---

## 5. MA TRẬN PHỤ THUỘC GIỮA CÁC AGENT

```
P0 ──► P1 ──► P2 ──► P3
                │
                └────► P4 ──► P5 ──► P6
                                      │
P7 (có thể chạy song song P4-P6, ưu tiên sau P0 nếu đội rảnh)
                                      │
                                      ▼
                                    P8
```

| Giai đoạn | AI-A phụ thuộc | AI-B phụ thuộc | AI-C phụ thuộc |
|---|---|---|---|
| P1, P4 (Foundation) | Migration (AI-B verify) | API contract chưa cần | OpenAPI contract từ AI-A |
| P2 (Chat AI) | LLM config (AI-B) | — | SSE payload từ AI-A |
| P3 (Proactive) | Email service (AI-B), cron deploy (AI-B) | Event schema (AI-A) | Notification API (AI-A) |
| P5, P6 (Adaptive) | Redis helper (AI-B) | Thuật toán như spec | Quiz/mastery response (AI-A) |
| P7 (Hardening) | Scheduler (AI-B) | Split service xong (AI-A) | Contract ổn định (AI-A shim) |
| P8 (Release) | Config env (AI-B) | Smoke tests (AI-A) + e2e (AI-C) | Pipelines (AI-B) |

---

## 6. ĐỊNH NGHĨA HOÀN THÀNH (Definition of Done) CHO MỖI PHASE

**DoD chung (hiệu lực mọi Phase):**
- [ ] CI xanh cho cả API và Web (không cảnh báo mới)
- [ ] 100% test mới cho feature đã viết (backend: pytest; frontend: jest/playwright)
- [ ] Migration chạy sạch trên DB mới + idempotent (AI-B verify)
- [ ] Contract API được đóng băng & công bố cho AI-C trước khi UI build
- [ ] Không phá vỡ response envelope `{success, data, error, meta}`
- [ ] Tài liệu phase cập nhật (file liên quan nếu behavior đổi)

**DoD riêng theo phase** (đã nêu trong từng bảng — Supervisor dùng làm checklist).

---

## 7. LƯU Ý VẬN HÀNH CHO SUPERVISOR

1. **Giao việc theo ticket/issue**: mỗi task trong bảng → 1 ticket rõ ràng, gắn phase + agent.
2. **Bắt đầu phase mới** chỉ khi phase trước có integration sign-off.
3. **Khi có conflict code**: ưu tiên AI-A sửa backend, AI-C sửa frontend, AI-B sửa infra; Supervisor phân xử.
4. **Rủi ro cần theo dõi chéo:**
   - LLM cost (P2, P6) → AI-B alert theo dõi.
   - Refactor ecosystem (P7) gây regression → AI-A phải có shim; AI-C regression test.
   - Streaming SSE qua proxy (P2) → AI-B cấu hình đúng buffering.
5. **Nhịp độ**: Recommend sprint 2 tuần; mỗi phase 1 sprint (P0, P7, P8 có thể 2 sprint).
6. **Dự phòng**: Nếu AI-A quá tải, chuyển bớt phần event-schema/Admin backend sang sprint sau; không nhồi nhiều phase song song không kiểm soát.

---

*Tài liệu được tạo dựa trên: `15-de-xuat-cai-tien.md`, `16-de-xuat-cai-tien-adaptive-learning.md`, `SYSTEM ARCHITECTURE AUDIT.md`, `CLOUD NATIVE.md`, `ENGINEERING_PLAYBOOK.md`, `RELEASE_MODEL.md`, `ENVIRONMENT_MODEL.md` và khảo sát cấu trúc code hiện tại.*