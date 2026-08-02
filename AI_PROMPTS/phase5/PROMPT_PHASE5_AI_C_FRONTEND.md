# PROMPT GIAO VIỆC — AI-C (Frontend) — PHASE 5: Adaptive Learning — Quiz Engine UI + Remedial Real + Mastery Dashboard

> **Từ:** Supervisor
> **Cho:** AI-C — Chuyên viên Frontend (Next.js 14, TypeScript, Tailwind, Jest)
> **Bối cảnh:** Phase 4 đã sign-off (58 web test pass, types/adaptive.ts 19 types, admin page, adaptive-client có mock). Phase 5 = UI hoàn thiện cho Mastery Engine. Chi tiết chung xem `AI_PROMPTS/phase5/WORK_DIVISION_PHASE5.md`.

---

## 1. Trạng thái ĐÃ CÓ (verified — không làm lại)

- `types/adaptive.ts`: 19 types — `AdaptiveQuiz`, `AdaptiveQuizQuestion`, `QuizResult`, `ConceptQuizResult`, `RemediationSuggestion`, `RemedialContent`, `RecommendedLessonSequence` (status `normal|remedial|ready-to-skip`, `is_synthetic`), `RecommendedCourseSequence`, `ConceptDefinition`, `ConceptMastery` (mastery_score 0–10).
- `components/adaptive/`: `AdaptiveQuiz.tsx` (difficulty hiển thị, breakdown draft, gọi fetch trực tiếp), `MasteryRadar.tsx` (SVG radar, màu <3 đỏ / 3–6 vàng / >6 xanh, tooltip), `ConceptCard.tsx` (badge + progress + trend, nút remediation chỉ khi có callback), `RemedialPanel.tsx` (**MOCK 100%**).
- `lib/adaptive-client.ts`: có mock fallback (scale 0–1, lệch type 0–10); `lib/api-client.ts` có `apiClient.adaptive.*` thật (listConcepts/weakConcepts/strongConcepts/remediation/prerequisites/generateQuiz/submitQuiz) + `apiClient.admin.adaptive.*` đầy đủ.
- Trang: `app/(app)/learn/[course]/mastery/page.tsx` (radar + ConceptCard list), `app/(app)/learn/[course]/adaptive-quiz/page.tsx` (**route THIẾU `[lesson]` → params.lesson undefined — BUG**).

## 2. Nhiệm vụ

### NV1 (BLOCKER — làm đầu tiên) — Fix route quiz
Trang thực tế là `app/(app)/learn/[course]/adaptive-quiz/page.tsx` nhưng nhận `params.lesson` (undefined) và truyền xuống `AdaptiveQuiz`. Chọn 1 cách:
- **Cách A (khuyến nghị)**: đổi route thành `app/(app)/learn/[course]/[lesson]/adaptive-quiz/page.tsx` + redirect 301 từ đường cũ; cập nhật link từ lesson page.
- **Cách B**: giữ route, đọc `lesson_id` từ `searchParams` (`/adaptive-quiz?lesson=xxx`).
Chọn A hoặc B, cập nhật tất cả link trỏ tới. Kiểm tra trang không còn "Lesson: undefined".

### NV2 — AdaptiveQuiz nâng cấp (Mastery Engine UI)
1. **Progress theo concept**: trong lúc quiz, hiển thị chips/badges từng concept trong quiz kèm mastery hiện tại (lấy từ `AdaptiveQuiz.questions[].concept_id` → map mastery qua `getCourseMastery` nếu có); highlight concept của câu đang trả lời.
2. **Breakdown + animation**: sau submit, giữ bảng `concept_results` (mastery_before → after + delta), thêm animation count-up điểm mastery; đánh dấu weak concepts (<3) nổi bật.
3. **Nút "Skip to harder content"**: hiện khi quiz `passed` VÀ không có weak concepts → gọi **real** `POST /adaptive/skip/{course_id}/{lesson_id}` (thay mock); sau skip hiển thị thông báo + link tiếp tục. Nếu bị 400 (concept chưa đủ mastery) → hiện lý do từ API.
4. **Nút "Mastery check"**: nếu `AdaptiveQuiz` nhận được `mode="mastery-check"` (AI-A thêm query param `mode`) → render nút khởi động quiz toàn khóa (không cần lesson). Nếu API chưa ship field này → ẩn nút, không crash (guard bằng type/optional).
5. **Thống nhất data fetching**: chuyển từ fetch trực tiếp sang `adaptiveClient` (wrap `apiClient.adaptive.generateQuiz/submitQuiz`, unwrap envelope `{success,data,error,meta}`), giữ behavior hiện tại.

### NV3 — RemedialPanel real API (bỏ mock)
`lib/adaptive-client.ts` hiện trả dict hardcode cho `concept-1/2/3` → thay bằng:
- `getRemediation(courseId)` → `GET /adaptive/remediation/{course_id}` (list `RemediationSuggestion`).
- `remediationContent(courseId, conceptId)` → `POST /adaptive/remediation/{course_id}/content/{concept_id}` (trả `RemedialContent`).
- Giữ fallback text an toàn khi API lỗi (không crash, hiện "Could not load remediation").
- Panel: hiển thị explanation + analogies + micro-exercise (submit local như hiện tại — giữ), thêm nút **"I got it, skip anyway"** khi prop `onClose` được truyền; `AdaptiveQuiz` phải truyền `onClose` (hiện đang quên → nút không bao giờ hiện).

### NV4 — Mastery page hoàn thiện
`app/(app)/learn/[course]/mastery/page.tsx`:
1. **Weak/Strong breakdown**: gọi real `getWeak(courseId)` + `getStrong(courseId)` → 2 section riêng (yếu trước, mạnh sau), dùng `ConceptCard`.
2. **Remedial queue**: gọi real `getRemediation(courseId)` → danh sách suggestion trên đầu (concept yếu nhất trước).
3. **Click concept → chi tiết**: `ConceptCard`/`MasteryRadar` nhận `onSelect` → mở panel detail: prereq (qua `getPrerequisites(courseId, conceptId)`, đánh dấu mastered/unmastered) + nút "Get remediation" (mở RemedialPanel với concept đó).
4. Timeline: nếu dữ liệu `quiz_attempts` history chưa có endpoint riêng → **không block**, chỉ thêm placeholder "Practice history coming soon" (không bịa API).

### NV5 — adaptiveClient dọn mock
- Sửa mock scale **0–1 → 0–10** (khớp types) hoặc tốt hơn: bỏ mock cho các method có API thật.
- Wrap các method còn thiếu từ `apiClient.adaptive`: `getMastery` (`GET /mastery/{course_id}`), `getWeak`, `getStrong`, `getPrerequisites`, `getRemediation`, `skipLesson` (real, không còn `{success:true}` cứng), `getRecommendedSequence` (`GET /course/{course_id}/recommended-sequence` — hiện đang mock `{sequence: []}`).
- Giữ mock fallback CHỈ cho trường hợp API chưa deploy (đúng pattern Phase 4), kèm comment.

### NV6 — Tests
- `AdaptiveQuiz`: progress chips render, skip button chỉ khi passed & không weak, click skip → gọi POST skip (mock), breakdown animation render.
- `RemedialPanel`: render real data shape, nút skip khi có onClose.
- `MasteryRadar`/`ConceptCard`: onSelect click → callback.
- `adaptive-client`: unwrap envelope đúng cho method mới.
- **Target: ≥ 72 pass** (baseline 58) + `tsc --noEmit` + `npm run build`.

## 3. Ranh giới
- Chỉ sửa `apps/web/**`. KHÔNG sửa `apps/api/**`, `.github/**`, `devops/**`.
- Không đổi hành vi API — consume đúng contract (mọi shape đã type sẵn trong `types/adaptive.ts`).
- Nếu AI-A chưa ship `mode=mastery-check` kịp → guard bằng optional field, ẩn nút, không crash (pattern Phase 4).

## 4. Định Nghĩa Hoàn Thành
- [ ] NV1: route quiz fix, không còn `Lesson: undefined`, link đúng.
- [ ] NV2: progress theo concept + animation + nút Skip gọi real API + nút Mastery check (guard).
- [ ] NV3: RemedialPanel dùng real API, có nút skip, không crash khi API lỗi.
- [ ] NV4: mastery page có weak/strong + remedial queue + click detail (prereq).
- [ ] NV5: adaptiveClient scale 0–10 nhất quán, wrap đủ method thật, mock fallback chỉ khi cần.
- [ ] NV6: `npm test` ≥ 72 pass, `tsc --noEmit` pass, `npm run build` pass, không warning mới.

## 5. MẪU BÁO CÁO
```
=== BÁO CÁO AI-C — PHASE 5 ===
1. Route quiz: [cách A/B; link cập nhật; kết quả]
2. AdaptiveQuiz: [progress, animation, skip real, mastery-check guard]
3. RemedialPanel: [real API; skip wire; fallback]
4. Mastery page: [weak/strong, remedial queue, click detail, timeline placeholder]
5. adaptiveClient: [scale 0–10; method mới wrap; mock còn ở đâu]
6. Tests: [số test trước/sau; kết quả]
7. Build: [npm test / tsc / build]
8. File đã sửa/tạo: [...]
9. Rủi ro: [endpoint mode=mastery-check chưa ship; skip 400; mock scale]
10. Sẵn sàng Phase 6 (Remedial Panel hoàn thiện + admin heatmap): [CÓ/KHÔNG]
=== HẾT BÁO CÁO ===
```

*— Supervisor. Lưu ý: phần lớn UI làm được với endpoint ĐÃ có từ P4 (skip, remediation, weak/strong) — không cần chờ AI-A. Chỉ nút "Mastery check" chờ `mode=mastery-check`; nhớ guard.*
