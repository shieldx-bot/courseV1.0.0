# PROMPT GIAO VIỆC — AI-C (Frontend) — PHASE 4: Adaptive Learning — Types Chuẩn + Admin Page + Test UI

> **Từ:** Supervisor
> **Cho:** AI-C — Chuyên viên Frontend
> **Bối cảnh:** Phases 0–3 đã sign-off (41 web test pass). Khảo sát cho thấy Adaptive Learning frontend đã triển khai đáng kể. Bạn KHÔNG làm lại — nhiệm vụ là **gap-fill: types chuẩn + trang admin adaptive + test UI** để hoàn thiện Phase 4 Foundation.

---

## 1. Trạng thái ĐÃ CÓ (verified — không làm lại)

| Thành phần | Hiện trạng |
|---|---|
| `components/adaptive/` | ✅ Có 4 file: `AdaptiveQuiz.tsx`, `ConceptCard.tsx`, `MasteryRadar.tsx`, `RemedialPanel.tsx` |
| `app/(app)/learn/[course]/mastery/page.tsx` | ✅ Có |
| `app/(app)/learn/[course]/[lesson]/adaptive-quiz/page.tsx` | ✅ Có |
| `lib/adaptive-client.ts` | ✅ Có (API client adaptive) |
| `types/adaptive.ts` | ❌ **KHÔNG CÓ** — types adaptive hiện nằm trong `types/api.ts` (hoặc dùng inline) |
| `app/admin/adaptive/page.tsx` | ❌ **KHÔNG CÓ** |
| Test adaptive UI | ❌ Chưa thấy test riêng trong `apps/web/__tests__/` |

## 2. Nhiệm vụ

### NV1 — Tạo `types/adaptive.ts` chuẩn
1. Định nghĩa: `ConceptDefinition` (id, course_id, name, slug, description, difficulty_base, tags, lesson_ids, prerequisite_concepts), `ConceptMastery` (concept_id, mastery_score, attempts, correct_attempts, trend, last_practiced_at...), `QuizAttempt`, `AdaptiveQuizQuestion` (concept_id, difficulty, prompt, options...), `QuizResult` (score, concept_results breakdown: mastery_before/after), `RemediationSuggestion`.
2. Lấy đúng shape từ backend (`apps/api/app/api/v1/adaptive.py` + response) — không bịa.
3. Export từ `types/adaptive.ts`, update imports nơi đang inline (tối thiểu: các component adaptive).

### NV2 — Trang admin adaptive
1. Tạo **`app/admin/adaptive/page.tsx`** ("use client"):
   - **List concepts** theo course (dropdown chọn course → GET /admin/adaptive/concepts?course_id).
   - **Create concept** (form: name, slug auto, description, difficulty_base 1-10, tags, prerequisite_concepts multi-select, lesson_ids).
   - **Edit/Delete** concept.
   - **Bulk import** (nếu đơn giản: paste JSON hoặc nhập dạng dòng "name|difficulty|tags" → parse gọi POST /admin/adaptive/concepts/bulk).
   - **Stats card** (GET /admin/adaptive/stats/{course_id}: total_concepts, avg_difficulty, avg mastery...).
2. A11y: form có label, bảng có thead, nút có aria-label.
3. Thêm vào nav admin (nếu admin layout có menu — kiểm tra `app/admin/layout.tsx`).

### NV3 — Test UI adaptive
1. Thêm test Jest:
   - `MasteryRadar`: render đúng list concepts + màu theo score (đỏ <3, vàng 3-6, xanh >6) — mock.
   - `AdaptiveQuiz`: render câu hỏi, submit → gọi API, hiện result breakdown (mock).
   - Admin adaptive page: list + create form gọi POST (nếu testable — nếu phức tạp, tối thiểu render trang không crash + empty state).
   - `lib/adaptive-client.ts`: unwrap envelope đúng.
2. Chạy: `npm test` (≥41 + mới), `tsc --noEmit`, `npm run build`.

## 3. Ranh giới
- Chỉ sửa `apps/web/**`. Không sửa `apps/api/**`, `.github/**`, `devops/**`.
- Không đổi hành vi API — consume đúng contract.
- Nếu endpoint admin adaptive chưa match shape (AI-A có thể chỉnh), fallback hiển thị thông báo — không crash.

## 4. Định Nghĩa Hoàn Thành
- [ ] `types/adaptive.ts` tạo xong + các component dùng types chuẩn.
- [ ] `app/admin/adaptive/page.tsx` có: list theo course + create + edit/delete + bulk + stats.
- [ ] Test mới: MasteryRadar + AdaptiveQuiz (+ admin page nếu khả thi) pass.
- [ ] `npm test` ≥41 pass, `tsc --noEmit` pass, `npm run build` pass.

## 5. MẪU BÁO CÁO
```
=== BÁO CÁO AI-C — PHASE 4 ===
1. types/adaptive.ts: [các type đã định nghĩa; nguồn shape]
2. Admin adaptive page: [chức năng; cách chọn course; bulk ra sao]
3. Nav admin: [đã thêm chưa]
4. Tests: [số test trước/sau; kết quả]
5. Build: [npm test / tsc / build]
6. File đã sửa/tạo: [...]
7. Rủi ro: [endpoint shape khác; bulk import]
8. Sẵn sàng Phase 5 (Adaptive Quiz UI nâng cao — progress theo concept + skip): [CÓ/KHÔNG]
=== HẾT BÁO CÁO ===
```

*— Supervisor. Lưu ý: AI-A sẽ thêm seed concepts + route /mastery/{course_id} cùng phase — bạn có dữ liệu mẫu để test sau khi seed.*