# PROMPT GIAO VIỆC — AI-A (Backend) — PHASE 5: Adaptive Learning — Mastery Engine

> **Từ:** Supervisor
> **Cho:** AI-A — Chuyên viên Backend (FastAPI, MongoDB, Redis, arq)
> **Bối cảnh:** Phase 4 đã sign-off (173 pytest pass). Elo update, grade_quiz, weak/strong/mastery/prerequisites/ready/skip đã xong. Phase 5 = phần CÒN THIẾU của Mastery Engine. Chi tiết chung xem `AI_PROMPTS/phase5/WORK_DIVISION_PHASE5.md`.

---

## 1. Trạng thái ĐÃ CÓ (verified — không làm lại)

- `concept_mastery.py`: `_update_score_elo` (k-factor giảm theo attempts, time_factor, clamp 0–10), `update_mastery`, `get_course_mastery_map`, weak/strong (threshold 3.0/7.0), `get_ready_concepts`, `get_prerequisites`.
- `adaptive_quiz.py`: `generate_adaptive_quiz` (chỉ sort weak-first trong 1 lesson, difficulty = `difficulty_base` cố định, không question bank), `grade_quiz` (submit → update mastery từng concept + breakdown + ghi `quiz_attempts`).
- Endpoints đã có: `/adaptive/quiz/{course_id}/generate` (bắt buộc `lesson_id`), `/submit`, `/mastery`, `/weak`, `/strong`, `/prerequisites/{course_id}/{concept_id}`, `/remediation`, `/skip`, `/course/{course_id}/recommended-sequence` (logic **inline** trong endpoint L210–280).
- `remediation.py` đã có detect_gaps / get_prerequisite_gaps / get_remediation_suggestions / generate_remedial_content (có Redis cache).
- `services/cache.py` đã có `get_cache()`, `get_or_cache()`, `invalidate_pattern()` (fallback in-memory khi Redis down) — **chưa được adaptive dùng**.
- Worker metrics hooks + `/metrics` (worker/cron) đã xong P4.

## 2. Nhiệm vụ

### NV1 (BLOCKER — làm đầu tiên) — Fix bug `_now()` trong admin CRUD
`app/api/v1/admin_adaptive.py` dùng `_now()` ở L99 (POST /concepts), L125 (PUT /concepts/{id}), L165 (POST /concepts/bulk) nhưng **không được import/định nghĩa** → NameError. Sửa bằng helper datetime hiện có trong repo (tìm `_now`/`datetime.now(timezone.utc)` pattern ở file khác, không tự bịa). Thêm test cho create/update/bulk (ít nhất: create → GET trả về, update đổi tên → prereq tham chiếu được cập nhật, bulk idempotent).

### NV2 — Quiz engine thực thụ
Trong `app/services/adaptive_quiz.py` + `app/api/v1/adaptive.py`:
1. **Mode `mastery-check`**: `POST /adaptive/quiz/{course_id}/generate` thêm query/body param `mode` (`lesson` | `mastery-check`, default `lesson`). `mode=lesson` → giữ hành vi cũ (bắt buộc `lesson_id`). `mode=mastery-check` → không cần `lesson_id`, chọn concepts yếu nhất toàn khóa trước (mastery < 4 ưu tiên), xen kẽ lesson.
2. **Dynamic difficulty**: mỗi câu chọn `difficulty = clamp(round(mastery_user) ± 1..2, 1, 10)` thay vì dùng `difficulty_base` cố định. Với user chưa có mastery (cold start) → dùng `difficulty_base` (spec: default mastery 5.0, adaptive sau 2–3 câu đầu).
3. **Question bank**: tạo collection `quiz_questions` (+ index: `course_id+concept_id+difficulty`, `concept_id`) trong `db/indexes.py`. Flow generate: query bank → nếu đủ câu đúng concept+difficulty (tolerance ±1) → reuse; thiếu → gọi LLM `_generate_question_for_concept` rồi **lưu vào bank**; LLM off → fallback template (giữ). Không generate trùng câu liên tiếp.
4. **Interleaving**: xen kẽ concepts khác nhau trong danh sách câu (không 2 câu liên tiếp cùng concept nếu có thể).
5. **Ghi đầy đủ attempt**: lưu `user_answer`, `time_seconds` từng câu vào `quiz_attempts.questions` (hiện đang bỏ).

### NV3 — Mastery Engine service mới `app/services/mastery_engine.py`
1. `apply_decay(user_id, course_id)` — forgetting curve: mastery giảm nhẹ nếu `last_practiced_at` > N ngày (ví dụ: không thực hành 7 ngày → decay 5–8%; 14 ngày → thêm 5%), không xuống dưới ngưỡng sàn (ví dụ 1.0), cập nhật trend.
2. `recalculate_mastery(user_id, course_id, concept_id)` — recompute từ lịch sử `quiz_attempts` (trả về score mới + lưu).
3. Snapshot timeline: mỗi lần submit quiz đã có `concept_results` (mastery_before/after) — đủ để AI-C vẽ timeline từ `quiz_attempts`; KHÔNG cần collection mới, chỉ verify field đã lưu.
4. `get_recommended_sequence(user_id, course_id)` — **tách logic từ endpoint adaptive.py L210–280** sang service này; giữ NGUYÊN response shape (`{course_id, sequence: [{lesson_id, title, order, status: normal|remedial|ready-to-skip, is_synthetic, weak_concepts, strong_concepts}]}`); cải thiện: sort lessons theo dependency order, `ready-to-skip` khi mastery ≥ 7 cho mọi concept của lesson, chèn remedial synthetic trước lesson có prereq < 4.0.

### NV4 — Cron mastery decay
Thêm task `run_mastery_decay` vào `WorkerSettings.cron_jobs` (daily, giờ 04:00 — tránh trùng 3:00 proactive). Task quét users/courses có mastery và chưa practice lâu → `apply_decay` (giới hạn batch để không nghẽn, ví dụ top N user hoạt động gần nhất). Đăng ký đúng arq 0.27 syntax (timeout/max_tries/keep_result — pattern đã sửa ở P4).

### NV5 — Cache mastery map
Dùng `services/cache.py` (read-through `get_or_cache`, TTL 60–120s) cho `get_course_mastery_map`; **invalidate** key khi `update_mastery`/submit quiz chạy (`invalidate_pattern`). Đảm bảo fallback in-memory không phá test isolation.

### NV6 — Metrics (contract M1–M5 — tên metric CHỐT, không tự đổi)
Instrument trong telemetry/code:
- `adaptive_quiz_generated_total{mode, course_id}` (Counter)
- `adaptive_quiz_submitted_total{mode, passed}` (Counter)
- `adaptive_quiz_submit_duration_seconds{course_id}` (Histogram — đo thời gian `grade_quiz`)
- `adaptive_mastery_decay_runs_total{status}` (Counter — trong cron decay)
- `adaptive_remediation_generated_total{concept_id}` (Counter — trong generate_remedial_content)

### NV7 — Tests
Thêm vào `tests/test_adaptive_learning.py` (+ file mới nếu cần): dynamic difficulty targeting, question bank reuse (generate 2 lần → lần 2 dùng bank, không gọi LLM), interleaving, mode mastery-check không cần lesson_id, apply_decay (7/14 ngày, sàn), recalculate_mastery, cache invalidate sau submit, recommended_sequence service (status đúng), admin CRUD sau fix `_now`. **Target: ≥ 185 passed** (baseline 173).

## 3. Ranh giới
- Chỉ sửa `apps/api/**`. KHÔNG sửa `apps/web/**`, `.github/**`, `devops/**`, `docker-compose.yml`.
- Không đổi response envelope `{success, data, error, meta}`; không đổi shape endpoint đã nêu trong WORK_DIVISION §4 (chỉ THÊM field `mode`).
- Tên metric dùng đúng bảng M1–M5; nếu muốn đổi → báo Supervisor trước.
- Ruffle: giữ mức debt như hiện tại (không tăng đáng kể).

## 4. Định Nghĩa Hoàn Thành
- [ ] NV1 xong: admin create/update/bulk không còn NameError, có test.
- [ ] NV2 xong: mode `mastery-check`, difficulty động, `quiz_questions` + index, interleaving, attempt ghi đủ answers/time.
- [ ] NV3 xong: `mastery_engine.py` có apply_decay/recalculate_mastery/get_recommended_sequence; endpoint gọi service (bỏ logic inline), response shape giữ nguyên.
- [ ] NV4 xong: cron `run_mastery_decay` đăng ký + chạy được (test hàm trực tiếp).
- [ ] NV5 xong: mastery map cache + invalidate đúng.
- [ ] NV6 xong: 5 metric instrument (verify scrape test).
- [ ] NV7 xong: pytest **≥ 185 pass**.
- [ ] `python -m pytest tests/ -q` xanh, không có warning mới đáng kể.

## 5. MẪU BÁO CÁO
```
=== BÁO CÁO AI-A — PHASE 5 ===
1. Bug _now(): [đã sửa thế nào; test]
2. Quiz engine: [mode, difficulty động, question bank, interleaving, attempt fields]
3. mastery_engine.py: [apply_decay / recalculate_mastery / get_recommended_sequence — shape giữ nguyên?]
4. Cron decay: [lịch, batch, arq 0.27]
5. Cache: [pattern dùng, TTL, invalidate khi nào]
6. Metrics: [M1–M5 instrumented, verify scrape]
7. Tests: [số test trước/sau; kết quả]
8. File đã sửa/tạo: [...]
9. Rủi ro: [gì chưa làm / cần AI-B phối hợp]
10. Sẵn sàng Phase 6 (Remediation + AI Tutor integration): [CÓ/KHÔNG]
=== HẾT BÁO CÁO ===
```

*— Supervisor. Lưu ý: AI-B chờ bảng metric M1–M5 để dựng dashboard/alert; AI-C chờ `mode=mastery-check` để thêm nút "Mastery check". Chốt tên metric ngay từ đầu để không phải đổi lại.*
