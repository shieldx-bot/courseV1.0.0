# PROMPT SỬA — AI-C (Frontend) — PHASE 5: Fix 2 lỗi sau verify Supervisor

> **Từ:** Supervisor
> **Cho:** AI-C — Chuyên viên Frontend
> **Trạng thái:** AI-A (190 pytest) và AI-B (dashboard/alerts OK) đã sign-off. AI-C: 83/83 test, tsc, build đều pass nhưng **2 lỗi bị supervisor bắt khi verify** — sửa rồi báo lại.

---

## Lỗi 1 — Thiếu `time_seconds` trong payload submit (contract AI-A §9)

**Bối cảnh:** AI-A đã hoàn tất ghi `user_answer` + `time_seconds` từng câu vào `quiz_attempts` (`apps/api/app/services/adaptive_quiz.py:384` đọc `q.get("time_seconds")` từ mảng `questions` do **client gửi**). Elo `time_factor` (thưởng trả lời nhanh <5s / phạt chậm >60s) chỉ chạy khi client gửi `time_seconds`.

**Hiện trạng:** `components/adaptive/AdaptiveQuiz.tsx:116-121` truyền thẳng `quiz.questions` (từ response generate) vào `adaptiveClient.submitQuiz` — không có `time_seconds` → backend lưu `None`, time_factor không bao giờ kích hoạt.

**Sửa:**
1. Trong `AdaptiveQuiz.tsx`, bắt đầu bấm giờ khi mỗi câu trở thành active (`performance.now()` khi chuyển `activeIndex`, hoặc lưu `startTime` per index).
2. Khi submit, build mảng `questions` mới: `quiz.questions.map((q, i) => ({ ...q, time_seconds: Math.round((now - startTimes[i]) / 1000) }))`.
3. Chuyển mảng đã bổ sung này vào `submitQuiz` (không đổi các field cũ — backend chỉ đọc thêm `time_seconds`).
4. Giữ `time_seconds` optional (nếu lỡ không đo được → để `undefined`, không crash).

**Test:** thêm 1 test `AdaptiveQuiz`: submit → `adaptiveClient.submitQuiz` nhận `questions[].time_seconds` là số ≥ 0 (mock, không cần fake timer — dùng giá trị nhỏ).

## Lỗi 2 — Test flaky `AdminAdaptivePage › shows an informative empty state when no concepts exist`

**Bối cảnh:** test vẫn fail 1/4 lần khi chạy full suite (chạy riêng file 8/8 pass) dù đã tăng `timeout: 5000`. Nguyên nhân: 14 suite chạy song song → `findByText` 5s có lúc bị đói CPU. Tăng timeout tiếp không phải giải pháp bền.

**Sửa (chọn 1, ưu tiên cách 1):**
1. **Cách bền nhất**: trong test empty-state, chờ trạng thái trung gian ổn định trước rồi mới chờ "No concepts yet": `await screen.findByLabelText("Course")` (chỉ render sau khi courses load) → sau đó `await screen.findByText("No concepts yet")`. Thu hẹp cửa sổ chờ.
2. Hoặc: `jest.setTimeout(15000)` ở đầu `describe` + `findByText` dùng `{ timeout: 10000 }`.
3. Không đổi hành vi trang, không bỏ test.

**Verify:** chạy full suite `npm test` ít nhất 4 lần liên tiếp — không lần nào fail (yêu cầu: 4/4 xanh).

## Ranh giới
- Chỉ sửa `apps/web/**`. Không sửa backend (backend đã đọc `time_seconds` sẵn — chỉ thiếu client gửi).
- Không đổi shape khác của `POST /submit`.

## Definition of Done
- [ ] `time_seconds` gửi kèm mỗi câu trong submit (có test chứng minh).
- [ ] Test flaky empty-state sửa xong: `npm test` full suite 4/4 lần xanh.
- [ ] `npm test` (≥ 83 pass), `tsc --noEmit` pass, `npm run build` pass.

## MẪU BÁO CÁO
```
=== BÁO CÁO SỬA AI-C — PHASE 5 (verify round 2) ===
1. time_seconds: [cách bấm giờ; payload mới; test chứng minh]
2. Flaky test: [cách nào; số lần full suite xanh]
3. Tests: [số test trước/sau]
4. Build: [npm test / tsc / build]
5. File đã sửa: [...]
=== HẾT BÁO CÁO ===
```
