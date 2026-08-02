# PHASE 5 — Adaptive Learning: Mastery Engine — PHÂN CHIA CÔNG VIỆC (Supervisor)

> **Từ:** Supervisor
> **Trạng thái:** Phase 4 đã nhận đủ 3 báo cáo (AI-A 173 pytest / AI-B manifests OK / AI-C 58 web test).
> **Phase 5:** Elo + gap detect + adaptive quiz selection + recommended sequence + skip + mastery decay + metrics.

---

## 1. Thực trạng sau Phase 4 (verified — không làm lại)

| Hạng mục | AI-A (Backend) | AI-B (DevOps) | AI-C (Frontend) |
|---|---|---|---|
| **ĐÃ XONG** | Elo `_update_score_elo` + time_factor; `grade_quiz` → per-concept breakdown; `/mastery`, `/weak`, `/strong`, `/prerequisites`, `/ready`, `/skip`; seed concepts kèm prereq chains; indexes; worker metrics hooks + `/metrics` | Scrape config api/worker/cron; K8s Service + NetworkPolicy cho worker/cron metrics; hook seed verified; manifest-check CI OK; alert metric `llm_cost_usd_total` | `types/adaptive.ts` (19 types); admin adaptive page + stats + bulk; AdaptiveQuiz (difficulty + breakdown draft); MasteryRadar; ConceptCard; RemedialPanel (MOCK); mastery page (radar); `apiClient.admin.adaptive.*`; nav admin |
| **GAP** | Quiz adaptive còn sơ khai (chỉ sort weak-first trong 1 lesson, difficulty = `difficulty_base` cố định, không question bank); `recommended_sequence` logic nằm inline trong endpoint; **BUG `_now()` NameError** ở admin CRUD; không decay/forgetting curve; không cache mastery map; không cron mastery | Chưa có metric/dashboard cho adaptive; alert thật chưa bật (chờ AI-A instrument); Redis chưa verify cho adaptive cache; cron decay chưa có | Quiz chưa có progress theo concept / animation / nút skip; RemedialPanel mock 100%; mastery page chưa có weak/strong + remedial queue + click detail; **BUG route quiz thiếu `[lesson]`**; adaptiveClient mock scale 0–1 lệch type 0–10 |

### Hai vấn đề chặn cần xử lý ĐẦU TIÊN (Wave 1)
1. **AI-A — BUG `_now()`**: `apps/api/app/api/v1/admin_adaptive.py` dùng `_now()` ở L99 (create), L125 (update), L165 (bulk) nhưng **không được import/định nghĩa** → admin CRUD concept bị NameError khi gọi thật. Phase 4 AI-C đã fallback nên không crash UI, nhưng end-to-end chưa chạy được.
2. **AI-C — route quiz sai**: trang thực tế là `app/(app)/learn/[course]/adaptive-quiz/page.tsx` (không có segment `[lesson]`) → `params.lesson = undefined`, quiz không biết lesson. Cần sửa route hoặc đọc `searchParams`.

---

## 2. Phạm vi Phase 5 (delta so với kế hoạch gốc AI_WORKFORCE_PLAN.md)

Kế hoạch gốc giao cho P5: Elo update, detect_gaps, adaptive selection, grade_quiz, submit/weak/prerequisites API. **Đã được AI-A kéo xong ở P4** → Phase 5 tập trung vào phần CÒN THIẾU:

1. **Quiz engine thực thụ**: dynamic difficulty (`difficulty ≈ mastery`), question bank reuse (DB), interleaving nhiều concept, mode `mastery-check` toàn khóa.
2. **Mastery Engine service** (`mastery_engine.py`): time-decay (forgetting curve) + cron, `recalculate_mastery`, timeline/history.
3. **Recommended sequence** chuyển thành service + cải thiện sorting.
4. **Cache** mastery map qua `services/cache.py` (đã có sẵn infra).
5. **Metrics + dashboard + alerts** adaptive (AI-A instrument / AI-B dựng).
6. **Frontend**: progress theo concept, animation mastery, skip thật, RemedialPanel real API, mastery page weak/strong + remedial queue, fix route quiz, dọn mock 0–1 → 0–10.
7. **Fix bug admin `_now`** (AI-A) + tests.

---

## 3. BẢNG PHÂN CHIA CÔNG VIỆC PHASE 5

### AI-A — Backend (`apps/api/**`)

| # | Nhiệm vụ | File/Đối tượng | Trạng thái |
|---|---|---|---|
| A1 | **Fix BUG `_now()`** + test admin CRUD (create/update/bulk) | `app/api/v1/admin_adaptive.py` | 🔴 Blocker — làm trước |
| A2 | Quiz engine: mode `mastery-check` (không cần lesson_id), dynamic difficulty = clamp(mastery ± 1–2), interleaving, **question bank** (`quiz_questions` + indexes, reuse trước, LLM generate sau, fallback template), lưu `answers/time_seconds` vào `quiz_attempts` | `app/services/adaptive_quiz.py`, `app/db/indexes.py`, `app/api/v1/adaptive.py` | 🟠 |
| A3 | Mastery Engine mới `app/services/mastery_engine.py`: `apply_decay` (forgetting curve), `recalculate_mastery` (recompute từ attempts), snapshot timeline/history | `app/services/mastery_engine.py`, `app/services/concept_mastery.py` | 🟠 |
| A4 | Cron task `run_mastery_decay` (daily) đăng ký vào `WorkerSettings.cron_jobs` | `app/worker.py` | 🟠 |
| A5 | Recommended sequence: tách logic inline (adaptive.py L210–280) → service `get_recommended_sequence()`, giữ nguyên response shape (AI-C đã type), cải thiện sort theo dependency | `app/services/mastery_engine.py` hoặc `concept_mastery.py`, `app/api/v1/adaptive.py` | 🟠 |
| A6 | Cache read-through mastery map (TTL ngắn, invalidate khi submit quiz) | `app/services/cache.py` + các nơi đọc mastery | 🟢 |
| A7 | Instrument metrics theo contract M1–M5 (bảng §4) | `app/core/telemetry.py`, `adaptive_quiz.py` | 🟠 |
| A8 | Tests: selection/difficulty/bank/interleaving, decay, cache invalidate, sequence service, admin CRUD sau fix. **Target: 173 → ≥ 185 pass** | `tests/test_adaptive_learning.py` + mới | 🟠 |

### AI-B — DevOps (`devops/**`, `.github/**`, docker, helm)

| # | Nhiệm vụ | File/Đối tượng | Trạng thái |
|---|---|---|---|
| B1 | **Contract metrics adaptive** (chốt tên với AI-A trước khi AI-A instrument — bảng §4) | `devops/prometheus/alerts.yml` | 🔴 chốt sớm |
| B2 | Grafana dashboard "Adaptive Learning": quiz throughput, submit latency p50/p95, mastery distribution, gap resolution, decay runs (dựng khung trước, fill metric sau khi AI-A xong) | `devops/docker/grafana/dashboards/adaptive-metrics.json` | 🟠 |
| B3 | Alerts: quiz error rate > 5%, submit latency p95 > 3s, `run_mastery_decay` fail, giữ `LLMCostSpike` từ P4 | `devops/prometheus/alerts.yml` (+ docker bản) | 🟠 |
| B4 | Redis verify cho adaptive cache: compose expose, TTL config, fallback in-memory đã có | `docker-compose.yml`, `.env.example` | 🟢 |
| B5 | Sau khi AI-A thêm cron `run_mastery_decay` → verify deployment worker/cron + lịch + không trùng lặp + alert fail | `devops/k8s/*`, helm | 🟠 (chờ A4) |
| B6 | CI: giữ xanh (`make test-api` ≥ 185, helm lint/template, kubeconform) | `.github/workflows/ci.yml` | 🟢 |

### AI-C — Frontend (`apps/web/**`)

| # | Nhiệm vụ | File/Đối tượng | Trạng thái |
|---|---|---|---|
| C1 | **Fix route quiz**: thêm segment `[lesson]` HOẶC đọc `lesson_id` từ `searchParams`; cập nhật link từ lesson page | `app/(app)/learn/[course]/adaptive-quiz/page.tsx` (+ layout/menu liên quan) | 🔴 Blocker — làm trước |
| C2 | AdaptiveQuiz: progress bar/chips theo concept mastery, animation count-up mastery sau quiz, nút "Skip to harder content" (POST `/adaptive/skip` thật — thay mock), nút "Mastery check" (mode toàn khóa nếu AI-A ship) | `components/adaptive/AdaptiveQuiz.tsx`, `lib/adaptive-client.ts` | 🟠 |
| C3 | RemedialPanel: bỏ mock → real `GET /adaptive/remediation/{course_id}` + `POST /adaptive/remediation/{course_id}/content/{concept_id}`; wire nút Skip (`onClose`) từ quiz | `components/adaptive/RemedialPanel.tsx`, `lib/adaptive-client.ts` | 🟠 |
| C4 | Mastery page: weak/strong breakdown (real `/weak`, `/strong`), remedial queue, click concept → detail panel (prereq + suggestions) | `app/(app)/learn/[course]/mastery/page.tsx`, `ConceptCard.tsx`, `MasteryRadar.tsx` | 🟠 |
| C5 | adaptiveClient: sửa mock scale 0–1 → 0–10 (khớp types), wrap các method thật còn thiếu (`getMastery`, `getWeak`, `getStrong`, `getPrerequisites`, `getRemediation`, `skipLesson`, `getRecommendedSequence`), thống nhất unwrap envelope | `lib/adaptive-client.ts`, `lib/api-client.ts` | 🟢 |
| C6 | Tests: AdaptiveQuiz mới (progress/skip/animation), RemedialPanel real data, mastery page breakdown, adaptive-client unwrap. **Target: 58 → ≥ 72 pass** + `tsc` + `npm run build` | `__tests__/**` | 🟠 |

---

## 4. CONTRACT FREEZE & TÊN METRIC THỐNG NHẤT (chốt trước khi làm)

### API (AI-A publish OpenAPI snippet cho AI-C; KHÔNG đổi shape đã type)
- `POST /adaptive/quiz/{course_id}/generate` — **thêm field `mode`** (`lesson` | `mastery-check`); `lesson_id` bắt buộc khi `mode=lesson`, optional khi `mode=mastery-check`. Questions: giữ `concept_id/concept_name/difficulty/question/options/correct/explanation`. `difficulty` giờ là **dynamic** (≈ mastery), không còn = `difficulty_base`.
- `POST /adaptive/quiz/{course_id}/submit` — **giữ nguyên shape** (AI-C đã type `QuizResult`: score/score_pct/passed/concept_results[mastery_before/after/delta]/weak_concepts).
- `GET /adaptive/course/{course_id}/recommended-sequence` — **giữ nguyên shape** (`RecommendedLessonSequence`: status `normal|remedial|ready-to-skip`, `is_synthetic`).
- `POST /adaptive/skip/{course_id}/{lesson_id}` — **giữ nguyên**.
- `GET /adaptive/remediation/{course_id}` + `POST /adaptive/remediation/{course_id}/content/{concept_id}` — **giữ nguyên** (AI-C đã type).
- `GET /admin/adaptive/concepts`, `PUT/DELETE`, `bulk`, `stats/{course_id}`, `gaps/{course_id}` — **giữ nguyên**, chỉ sửa bug `_now` (A1).

### Metrics (AI-A instrument code / AI-B dựng dashboard + alert)
| Mã | Metric | Loại | Labels | Ai-A thêm | Ai-B dùng |
|---|---|---|---|---|---|
| M1 | `adaptive_quiz_generated_total` | Counter | `mode`, `course_id` | ✔ | throughput panel |
| M2 | `adaptive_quiz_submitted_total` | Counter | `mode`, `passed` | ✔ | pass-rate panel |
| M3 | `adaptive_quiz_submit_duration_seconds` | Histogram | `course_id` | ✔ | latency p50/p95 + alert |
| M4 | `adaptive_mastery_decay_runs_total` | Counter | `status` | ✔ (trong cron) | decay health + alert |
| M5 | `adaptive_remediation_generated_total` | Counter | `concept_id` | ✔ | remediation usage |

> Quy tắc: **tên metric chốt trong bảng này, AI-A không tự đổi** (bài học từ `llm_cost_usd_total` ở P4). Nếu cần đổi → thông báo Supervisor.

---

## 5. TRÌNH TỰ & PHỤ THUỘC (Waves)

```
Wave 1 (song song, độc lập):
  AI-A: A1 (fix bug) → A2, A3, A5, A6, A8  (không đụng apps/web + devops)
  AI-B: B1 (chốt metric) → B2 (khung dashboard), B4, B6
  AI-C: C1 (fix route) → C2 (progress/animation), C3 (real API phần endpoint đã có), C5, C6
        (C2/C3 dùng endpoint ĐÃ tồn tại từ P4 — không chặn bởi AI-A)

Wave 2 (sau khi AI-A xong A2/A4/A7):
  AI-C: C2 nhận mode `mastery-check` từ API → nút "Mastery check"; skip thật đã có sẵn
  AI-B: B3 (bật alert thật khi AI-A instrument xong), B5 (deploy cron decay)

Cuối Phase: Supervisor verify end-to-end (quiz adaptive → submit → mastery đổi → skip → sequence đổi)
```

| Phụ thuộc | Chi tiết |
|---|---|
| AI-C phụ thuộc AI-A | Chỉ ở mode `mastery-check` (C2 phần 2) — phần còn lại dùng API P4 |
| AI-B phụ thuộc AI-A | Tên metric (chốt ở Wave 1 qua bảng §4) + code instrument (B3/B5) |
| AI-A phụ thuộc AI-B | Không — A7 chỉ cần bảng tên metric §4 |
| Conflict file | Không có: AI-A `apps/api/**`, AI-B `devops/**`+CI, AI-C `apps/web/**` |

---

## 6. ĐỊNH NGHĨA HOÀN THÀNH (DoD) PHASE 5

- [ ] **AI-A**: pytest ≥ **185 pass**; admin CRUD concept hoạt động (fix `_now`); quiz generate có `mode` + dynamic difficulty + question bank reuse; decay cron chạy; recommended sequence là service, shape giữ nguyên; mastery map được cache + invalidate.
- [ ] **AI-B**: `make test-api` ≥ 185 pass; helm lint/template + kubeconform pass; dashboard "Adaptive Learning" có panel M1–M5; alerts đúng tên metric, dry-run không lỗi.
- [ ] **AI-C**: `npm test` ≥ **72 pass**, `tsc --noEmit` pass, `npm run build` pass; route quiz không còn `lesson=undefined`; quiz có progress theo concept + animation + nút Skip gọi API thật; RemedialPanel dùng API thật; mastery page có weak/strong + remedial queue; mock scale nhất quán 0–10.
- [ ] Chung: không phá envelope `{success, data, error, meta}`; không đụng file ngoài phạm vi (`git diff --stat` kiểm tra); contract §4 giữ nguyên.
- [ ] **Integration sign-off**: làm quiz adaptive → mastery tăng/giảm đúng Elo → submit trả breakdown → skip thành công → recommended sequence phản ánh mastery.

---

## 7. TRACKING SHEET

| Phase | AI-A | AI-B | AI-C | Sign-off |
|---|---|---|---|---|
| P0–P3 | ✔ | ✔ | ✔ | ✔ |
| P4 | ✔ | ✔ | ✔ | ✔ |
| P5 | ✔ **SIGN-OFF** (190 pytest) | ✔ **SIGN-OFF** (dashboard/alerts OK) | ✔ **SIGN-OFF** (carry-over xong: time_seconds + flaky 4/4) | ✔ |
| P6 | ✔ **SIGN-OFF** (205 pytest) | ✔ **SIGN-OFF** (dashboard 11 panel) | ✔ **SIGN-OFF** (100 test, 4/4 xanh, tsc+build) | ✔ **INTEGRATION SIGN-OFF** |
| P7 | ⏳ Hardening: split ecosystem.py, events, scheduler (AI_WORKFORCE_PLAN §P7) | ⏳ Scheduler, TTL job, request-ID, CI coverage | ⏳ Regression + contract ổn định | ❌ |
| P6 | ⏸ | ⏸ | ⏸ | ❌ |

---

## 8. GHI CHÚ ĐIỀU CHỈNH CHO P6–P8 (ảnh hưởng từ Phase 4 pull-forward)

- **P6 (Remediation & Sequencing)** — phạm vi đã giảm nhiều: `remediation.py` đã có detect_gaps, generate_remedial_content (có cache + fallback), get_remediation_suggestions; skip endpoint đã có. P6 còn: AI Tutor integration (truyền weak concepts vào context), admin mastery heatmap, analytics remediation effectiveness (M5 metric), hoàn thiện micro-exercise lưu DB (không chỉ inline).
- **P7 (Hardening)** — không đổi.
- **P8 (Release)** — không đổi.
- Cân nhắc: nếu Phase 5 xong sớm, AI-A có thể kéo trước phần "AI Tutor integration" của P6; AI-C kéo trước "admin heatmap".

---

*Phân chia này dựa trên 3 báo cáo Phase 4 + khảo sát thực tế code (bug `_now`, route quiz, adaptive_client mock, recommended_sequence inline). Giao việc: dùng 3 file PROMPT_PHASE5_AI_*.md cùng thư mục này.*
