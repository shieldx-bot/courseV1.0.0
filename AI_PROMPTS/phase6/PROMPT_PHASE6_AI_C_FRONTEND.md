# PROMPT GIAO VIỆC — AI-C (Frontend) — PHASE 6: Remediation UI + Dynamic Path + Admin Heatmap

> **Từ:** Supervisor
> **Cho:** AI-C — Chuyên viên Frontend (Next.js 14, TypeScript, Tailwind, Jest)
> **Bối cảnh:** Phase 5 code đã chạy (83 test, tsc, build pass) nhưng **AI-A (190 pytest) và AI-B đã sign-off, AI-C còn 2 việc dang dở được dồn sang phase này**. Phase 6 = Remediation hoàn thiện + dynamic learning path + admin heatmap + AI Tutor UI. Chi tiết xem `AI_PROMPTS/phase5/WORK_DIVISION_PHASE5.md`.

---

## 0. CARRY-OVER từ Phase 5 (làm ĐẦU TIÊN — supervisor verify round 2)

> Chi tiết: `AI_PROMPTS/phase5/PROMPT_PHASE5_AI_C_FIX.md`.

### CO1 — Gửi `time_seconds` trong payload submit (contract AI-A)
Backend `grade_quiz` đọc `questions[].time_seconds` do client gửi (`adaptive_quiz.py:384`) → Elo `time_factor` (nhanh <5s / chậm >60s) chỉ chạy khi client gửi. Hiện `AdaptiveQuiz.tsx:116-121` truyền thẳng `quiz.questions` không có thời gian.
- Bấm giờ từng câu trong `AdaptiveQuiz.tsx` (`performance.now()` khi `activeIndex` đổi), khi submit build `questions` mới kèm `time_seconds: Math.round(delta/1000)`.
- Test: submit → `submitQuiz` nhận `questions[].time_seconds` là số ≥ 0.

### CO2 — Fix test flaky admin empty-state
`AdminAdaptivePage › shows an informative empty state when no concepts exist` fail 1/4 full-suite runs (chạy riêng 8/8 pass) — timeout 5000ms không đủ dưới tải song song.
- Chờ trạng thái trung gian ổn định trước: `await screen.findByLabelText("Course")` rồi mới chờ "No concepts yet" (thu hẹp cửa sổ chờ). Không đổi hành vi trang.
- Verify: full suite `npm test` **4/4 lần xanh**.

## 1. Trạng thái ĐÃ CÓ (verified — không làm lại)

- `AdaptiveQuiz.tsx`: progress chips theo concept + mastery, count-up animation, breakdown mastery_before→after, nút "Skip to harder content" (real `POST /skip`), nút "Mastery check" (guard `mode==="mastery-check"`), submit qua `adaptiveClient`.
- `RemedialPanel.tsx`: real API (`GET /remediation`, `POST /remediation/.../content/{concept_id}`), micro-exercise submit local, nút "I got it, skip anyway" khi `onClose` được truyền.
- `adaptiveClient`: đã wrap `getCourseMastery/getWeak/getStrong/getPrerequisites/getRemediation/skipLesson/getRecommendedSequence`, mock scale 0–10.
- Mastery page: 4 call song song, remedial queue, weak/strong sections, click concept → detail panel (prereq badges), timeline placeholder.
- `apiClient.adaptive` có sẵn các endpoint learner.

## 2. Nhiệm vụ

### NV1 — RemedialPanel hoàn thiện + trigger sau lesson
1. **Trigger tự động**: sau khi user hoàn thành lesson (hook vào `course-player-client.tsx` hoặc nơi progress được đánh dấu xong), nếu `getWeak(courseId)` có concept thuộc lesson vừa học → hiện RemedialPanel (có nút đóng).
2. **Micro-exercise submit thật**: nếu AI-A ship `POST /adaptive/remediation/{course_id}/exercise/{concept_id}/submit` → gửi `{answers}` lên, hiện `mastery_before → after` từ response; nếu chưa ship → giữ submit local + fallback (guard, không crash).
3. **Feedback**: nút "Was this helpful?" (👍/👎) → `POST /adaptive/remediation/{course_id}/feedback/{concept_id}` body `{helpful: bool}` (AI-A ship cùng phase; guard nếu chưa có). Hiện "Thanks!" rồi ẩn.

### NV2 — Dynamic learning path UI
1. Mastery page / lesson player: render `getRecommendedSequence(courseId)` (real — đã wrap P5) thành lộ trình có badge status: `ready-to-skip` (xanh, nút Skip), `remedial` (vàng, nhãn "Practice first" + nút mở RemedialPanel), `normal`. Click item → vào lesson.
2. **"Show all lessons" option**: khi sequence có lesson bị `ready-to-skip` → toggle hiện đủ syllabus (không ẩn), đúng đặc tả 16-de-xuat (user không bao giờ bị giấu bài).
3. Sau skip thành công (`skipLesson`) → **reload sequence** (AI-A sẽ trả `updated_sequence` ở P6 — nếu có field thì dùng, không thì gọi lại `getRecommendedSequence`).

### NV3 — Admin mastery heatmap
Trong `app/admin/adaptive/page.tsx` (đã có list/stats/bulk):
1. Heatmap theo course: dùng `apiClient.admin.adaptive.stats(courseId)` (đã có `concepts[].avg_mastery, student_count`) → grid màu theo avg mastery (đỏ <3, vàng 3–6, xanh >6) + difficulty_base, tooltip "x students, avg y".
2. Gaps: dùng `apiClient.admin.adaptive.gaps(courseId)` (đã có) → list prereq gap với badge "Needs: ...".
- A11y: bảng heatmap có thead/aria-label; legend giải thích màu.

### NV4 — AI Tutor UI (nhỏ)
Nếu AI-A trả context weak concepts trong tutor → hiển thị dòng nhắc "Focus: {weak concepts}" trong tutor panel (không bắt buộc, guard optional field). Nếu không đổi response → bỏ qua mục này.

### NV5 — Tests
- RemedialPanel: trigger render, exercise submit (mock API → mastery hiển thị), feedback gửi đúng body.
- Dynamic path: badge status render, "Show all lessons" toggle, reload sequence sau skip.
- Heatmap: render grid đúng màu theo score (mock).
- CO1/CO2 tests (mục 0).
- **Target: 83 → ≥ 95 pass** + `tsc --noEmit` + `npm run build`.

## 3. Ranh giới
- Chỉ sửa `apps/web/**`. KHÔNG sửa `apps/api/**`, `devops/**`, `docker-compose.yml`.
- Mọi endpoint P6 (exercise submit, feedback, `updated_sequence`) là **additive/guard**: nếu AI-A chưa ship → fallback, không crash (pattern P4/P5).
- Không đổi hành vi API.

## 4. Định Nghĩa Hoàn Thành
- [ ] CO1+CO2 xong (có test chứng minh; full suite 4/4 xanh).
- [ ] NV1: RemedialPanel trigger sau lesson + exercise submit thật (guard) + feedback.
- [ ] NV2: dynamic path có badge status + "Show all lessons" + reload sequence sau skip.
- [ ] NV3: heatmap + gaps trong admin adaptive page (a11y).
- [ ] NV4: AI Tutor focus hint (nếu response có) — optional.
- [ ] NV5: `npm test` ≥ 95 pass, `tsc` pass, `npm run build` pass.

## 5. MẪU BÁO CÁO
```
=== BÁO CÁO AI-C — PHASE 6 ===
0. Carry-over: [CO1 time_seconds — test chứng minh; CO2 flaky — số lần full suite xanh]
1. RemedialPanel: [trigger; exercise submit (guard?); feedback]
2. Dynamic path: [badge status; show all lessons; reload sau skip]
3. Heatmap: [grid màu; gaps; a11y]
4. AI Tutor UI: [có/không, guard]
5. Tests: [số test trước/sau]
6. Build: [npm test / tsc / build]
7. File đã sửa/tạo: [...]
8. Rủi ro: [endpoint P6 chưa ship; field additive mới từ AI-A]
9. Sẵn sàng Phase 7 (Hardening — ít việc frontend): [CÓ/KHÔNG]
=== HẾT BÁO CÁO ===
```

*— Supervisor. Nhớ: 2 carry-over (CO1/CO2) làm trước và báo kết quả verify round 2; nếu AI-A chưa ship exercise/feedback endpoint kịp → guard fallback và nêu rõ trong rủi ro.*
