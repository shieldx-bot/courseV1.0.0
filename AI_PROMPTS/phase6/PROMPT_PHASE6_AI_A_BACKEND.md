# PROMPT GIAO VIỆC — AI-A (Backend) — PHASE 6: Remediation + AI Tutor + Dynamic Sequencing

> **Từ:** Supervisor
> **Cho:** AI-A — Chuyên viên Backend (FastAPI, MongoDB, Redis, arq, LLM)
> **Bối cảnh:** Phase 5 đã sign-off (190 pytest). Elo, quiz adaptive, question bank, mastery_engine (decay/recalculate/sequence), skip, metrics M1–M5 đã xong. Phase 6 = Remediation hoàn thiện + AI Tutor integration + dynamic sequencing. Chi tiết xem `AI_PROMPTS/phase5/WORK_DIVISION_PHASE5.md` + các prompt Phase 5.

---

## 1. Trạng thái ĐÃ CÓ (verified — không làm lại)

- `remediation.py`: `detect_gaps`, `get_prerequisite_gaps`, `get_remediation_suggestions`, `generate_remedial_content` (LLM: explanation + micro-exercise 2–3 MCQ + analogies; **chỉ Redis cache** TTL 1h; fallback text khi LLM off), `get_or_create_remedial_content`.
- **`get_recommended_remediation` KHÔNG CÓ** (chưa implement — hàm này được 16-de-xuat §6 yêu cầu).
- `ai_tutor.py` (service + API): `ask_ai_tutor(course, lesson, question)` — RAG trên lesson context qua `_build_lesson_context(course, lesson)` + history 4 lượt. **Chưa biết gì về mastery/weak concepts.**
- Endpoint: `POST /adaptive/remediation/{course_id}/content/{concept_id}` (generate), `GET /adaptive/remediation/{course_id}` (suggestions), `POST /adaptive/skip/{course_id}/{lesson_id}` (skip khi mọi concept ≥7, upsert progress), `GET /adaptive/course/{course_id}/recommended-sequence` (service `get_recommended_sequence` trong mastery_engine.py — topo-sort + status + synthetic remedial).
- Metrics M1–M5 instrumented (`adaptive_remediation_generated_total{concept_id}` = M5).
- Quiz submit `grade_quiz` ghi `quiz_attempts` với `concept_results` (mastery_before/after/delta) — nguồn dữ liệu cho analytics remediation effectiveness.

## 2. Nhiệm vụ

### NV1 — AI Tutor integration (điểm tích hợp lớn nhất phase)
`app/services/ai_tutor.py`:
1. Trong `ask_ai_tutor` (hoặc `_build_lesson_context`), truy vấn mastery của user cho các concept thuộc lesson (`get_concepts_by_lesson` + `get_course_mastery_map`).
2. Nếu có concept yếu (< 3.0) liên quan lesson → chèn đoạn context phụ: "Student is weak at {concept}: {suggestion từ remediation}". Không làm hỏng prompt gốc (giữ hệ thống prompt + RAG lesson context).
3. Nếu không có dữ liệu mastery (cold start) → hành vi hiện tại, không đổi.
4. **Contract:** KHÔNG đổi response shape `ask_ai_tutor` (frontend không cần sửa). Chỉ đổi nội dung context.
5. Test: mock mastery yếu → prompt chứa weak concept; mastery cao → không chèn; không phá test hiện có.

### NV2 — Remediation hoàn thiện
1. **`get_recommended_remediation(user_id, course_id)`** — implement (đúng spec 16-de-xuat): kết hợp `detect_gaps` + `get_prerequisite_gaps`, sắp xếp ưu tiên (prereq yếu trước, severity giảm dần), trả queue có `concept_id/name/mastery_score/priority/lesson_ids`. API: `GET /adaptive/remediation/{course_id}` giữ shape hiện tại (AI-C đã type) HOẶC mở rộng trường `priority` — nếu thêm field, publish cho AI-C (additive, không đổi field cũ).
2. **Persist remedial content**: thêm collection `remedial_content` (`concept_id` + course_id + hash nội dung) để **reuse giữa các user** (giờ mỗi user mới đều gọi LLM lại). Flow: cache Redis (nhanh) → collection (reuse cross-user) → LLM generate + lưu. Index: `concept_id` + `content_hash` (unique, tránh duplicate).
3. **Micro-exercise submit → cập nhật mastery**: endpoint mới `POST /adaptive/remediation/{course_id}/exercise/{concept_id}/submit` — body `{answers: {idx: option}}`, chấm bằng `correct` từ remedial content đã lưu, gọi `update_mastery` (Elo) cho concept đó, trả `{correct_count, total, mastery_before, mastery_after}`. (Đây là nguồn dữ liệu để đo "remediation effectiveness".)
4. **Feedback**: endpoint `POST /adaptive/remediation/{course_id}/feedback/{concept_id}` body `{helpful: bool}` → chỉ increment metric M6 + lưu event (không cần collection mới, có thể dùng `activity_events`).

### NV3 — Dynamic sequencing / rerouting
1. `POST /adaptive/skip/{course_id}/{lesson_id}`: response thêm field `updated_sequence` (gọi lại `get_recommended_sequence` sau khi skip) — **additive**, giữ field cũ (AI-C đã type, check lại nếu cần).
2. `GET /adaptive/course/{course_id}/recommended-sequence`: giữ nguyên (service đã OK). Đảm bảo sau khi skip/remediate, sequence phản ánh đúng (đã dựa trên mastery nên tự đúng).

### NV4 — Metrics mở rộng (thêm vào contract, báo AI-B)
- **M6** `adaptive_remediation_feedback_total{helpful}` (Counter) — trong feedback endpoint.
- **M7** `adaptive_remediation_exercise_submitted_total{concept_id, passed}` (Counter) — trong exercise submit.
- Giữ M1–M5 không đổi tên.

### NV5 — Tests
Thêm: `get_recommended_remediation` (ordering prereq trước, severity), remedial content reuse (2 user → LLM gọi 1 lần), exercise submit → mastery đổi + M7 inc, feedback → M6 inc, skip trả `updated_sequence`, AI Tutor context injection. **Target: 190 → ≥ 200 passed.**

## 3. Ranh giới
- Chỉ sửa `apps/api/**`. Không sửa `apps/web/**`, `devops/**`, `docker-compose.yml`.
- Không đổi response shape có sẵn (chỉ additive field như `priority`, `updated_sequence` — công bố cho AI-C trong báo cáo).
- Tên metric M6/M7 theo contract; M1–M5 không đổi.
- Migration mới nếu thêm collection `remedial_content` → index qua `db/indexes.py` (như pattern P4/P5).

## 4. Định Nghĩa Hoàn Thành
- [ ] NV1: AI Tutor nhận weak concepts context, response shape giữ nguyên, test.
- [ ] NV2: `get_recommended_remediation` + `remedial_content` collection (reuse cross-user) + exercise submit cập nhật mastery + feedback.
- [ ] NV3: skip trả `updated_sequence` (additive), sequence chính xác sau skip.
- [ ] NV4: M6/M7 instrumented.
- [ ] NV5: pytest ≥ 200 pass.
- [ ] `python -m pytest tests/ -q` xanh.

## 5. MẪU BÁO CÁO
```
=== BÁO CÁO AI-A — PHASE 6 ===
1. AI Tutor: [cách chèn weak concept; response giữ nguyên?]
2. Remediation: [get_recommended_remediation; collection mới; exercise submit; feedback]
3. Sequencing: [skip trả updated_sequence; shape additive nào]
4. Metrics: [M6/M7; M1-M5 không đổi]
5. Tests: [số test trước/sau]
6. File đã sửa/tạo: [...]
7. Rủi ro: [field additive cần AI-C cập nhật type; LLM cost remediation]
8. Sẵn sàng Phase 7 (Architecture Hardening): [CÓ/KHÔNG]
=== HẾT BÁO CÁO ===
```

*— Supervisor. Lưu ý: mọi field additive (`priority`, `updated_sequence`) phải nêu rõ trong báo cáo để AI-C sync type. AI-B chờ M6/M7 để cập nhật dashboard.*
