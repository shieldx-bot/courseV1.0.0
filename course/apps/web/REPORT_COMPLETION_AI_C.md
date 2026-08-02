# BÁO CÁO HOÀN TẤT AI-C (Completion pass — kích hoạt AI Tutor hint + sẵn sàng E2E staging)

**Ngày:** 2026-08-02 — **Phạm vi:** `apps/web/**` (không đụng `.github/**`; đọc-only backend để xác nhận contract).

```
=== BÁO CÁO HOÀN TẤT AI-C ===
1. C1 focus hint: AI-A ĐÃ ship A3 — guard frontend hoạt động, KHÔNG sửa logic,
   thêm 4 test component pass.

2. C2:
   - E2E staging: PLAYWRIGHT_BASE_URL=https://<staging-url> npm run test:e2e
   - Lighthouse: local/preview: npm run test:lighthouse (= build && lhci autorun
     --config=lighthouse-budget.json — script đã fix thêm --config).
     Preview CI tự chạy treosh/lighthouse-ci-action (budgetPath ./apps/web/lighthouse-budget.json).
     Staging remote: lhci collect/assert theo URL staging (xem chi tiết).
   - Sẵn sàng: CÓ (chờ AI-B deploy + KUBECONFIG_STAGING).

3. Tests: 118 → 122 (thêm 4 test AiTutorTab focus hint).
4. Build: npm test 122 pass / tsc --noEmit pass / npm run build pass /
   lint sạch ở file mới.
5. File đã sửa/tạo:
   - Tạo: __tests__/components/learn/ai-tutor-tab.test.tsx
   - Sửa: package.json (test:lighthouse thêm --config=lighthouse-budget.json)
6. Rủi ro:
   - A3 backend vừa ship trong working tree (apps/api/app/services/ai_tutor.py
     modified, CHƯA commit) — cần AI-A commit + re-run suite backend.
   - Staging chưa deploy (chờ AI-B W2) → E2E/Lighthouse staging chưa chạy thật.
=== HẾT BÁO CÁO ===
```

---

## 1. C1 — Kích hoạt AI Tutor focus hint

**Trạng thái AI-A A3: ĐÃ SHIP** (xác nhận contract thật, không phải placeholder):

- `apps/api/app/services/ai_tutor.py`:
  - Thêm `_get_focus_concepts(...)` (lấy tên concept yếu của lesson).
  - Trả `"focus_concepts": focus_concepts` **additive** trong cả 2 nhánh response của `ask_ai_tutor` (thành công + exception), giữ đủ `answer/session_id/message_count`. Khi không có concept yếu → `focus_concepts: []`.
- Test backend A3 pass: `test_ai_tutor_endpoint_returns_focus_concepts_for_weak_user`, `test_ai_tutor_endpoint_empty_focus_concepts_for_mastered_user` — chạy local 2/2 ✓.

**Frontend (đây):**
- Guard sẵn `data?.data?.focus_concepts ?? data?.data?.weak_concepts` (AiTutorTab.tsx:101) khớp đúng shape backend → **giữ nguyên logic, không sửa gì**.
- Backend trả `focus_concepts: []` khi user giỏi → guard `Array.isArray(focus) && focus.length > 0` chặn hint rỗng ✓ (không bug).
- Thêm test component `__tests__/components/learn/ai-tutor-tab.test.tsx` (4 cases):

| Case | Mock response | Kết quả |
|---|---|---|
| render hint khi có `focus_concepts` | `["List Comprehensions"]` | hint `Focus: List Comprehensions` render |
| nhiều concept | `["List Comprehensions","Slicing"]` | `Focus: List Comprehensions, Slicing` |
| guard — không field | `{ answer }` | KHÔNG render hint |
| fallback `weak_concepts` | `["List Comprehensions"]` | hint render |

- 4/4 pass. Lưu ý kỹ thuật: mock `useAuth` phải trả `user` là tham chiếu stable (hằng `mockUser`), nếu trả object mới mỗi render → effect history `[courseId, lessonId, user]` chạy lại vô hạn → `setMessages([])` reset tin nhắn (test guard fail).

## 2. C2 — Sẵn sàng E2E / Lighthouse trên staging

**E2E (không cần code mới):**
- Command staging:
  ```
  PLAYWRIGHT_BASE_URL=https://<staging-url> npm run test:e2e
  ```
- `playwright.config.ts` đọc `PLAYWRIGHT_BASE_URL`; khi có base URL ngoài → **không** tự khởi động webServer (guard). Chạy đủ 6 project (chromium, mobile-chrome, mobile-safari, chromium-unauthenticated + setup/admin-setup).
- Đã verify local đúng code-path staging (baseURL ngoài `PLAYWRIGHT_BASE_URL=http://localhost:3000` chống standalone server + API seeded): **chromium 17/17 pass, ổn định 2 lần chạy liên tiếp** (Phase 8). Smart-skip: adaptive quiz/mastery preflight qua API → skip khi endpoint trả 4xx/không data (staging thiếu seed không fail cứng).
- Preview CI tự chạy: `.github/workflows/preview.yml:124` đã gán `PLAYWRIGHT_BASE_URL` từ preview_url.

**Lighthouse:**
- Local: `npm run test:lighthouse` = `npm run build && lhci autorun --config=lighthouse-budget.json` (đo `/`, `/courses`, `/pricing`; budget: perf ≥0.8, a11y ≥0.9, bp ≥0.9, seo ≥0.9, CLS ≤0.05). Đo thực pass local (perf 0.92–0.98, a11y 0.91–0.96, bp 0.96, seo 1.0, CLS ≤0.002).
- Preview CI tự động: `preview.yml:158–164` dùng `treosh/lighthouse-ci-action@v11` với `budgetPath: ./apps/web/lighthouse-budget.json` → cùng budget.
- Staging/preview URL remote (tùy chọn, nếu muốn đo chính xác trên môi trường thật):
  ```
  npx lhci collect --config=lighthouse-budget.json \
    --collect.url=https://<staging-url>/ \
    --collect.url=https://<staging-url>/courses \
    --collect.url=https://<staging-url>/pricing
  npx lhci assert --config=lighthouse-budget.json
  ```
  (lưu ý `--collect.startServerCommand=""` để không tự khởi server local; `npm run test:lighthouse` chỉ đo localhost.)

**Fix nhỏ cần thiết:** script `test:lighthouse` gốc là `lhci autorun` **thiếu `--config`** — lhci chỉ tự nhận `.lighthouserc.*`, không thấy `lighthouse-budget.json`, nên `npm run test:lighthouse` sẽ fail. Đã sửa `package.json` → `lhci autorun --config=lighthouse-budget.json`. (Trước đó Phase 8 chạy thủ công bằng lệnh có `--config`.)

**Sẵn sàng: CÓ** — chờ AI-B deploy staging (W2 / `KUBECONFIG_STAGING` + `SMOKE_BASE_URL_STAGING`).

## 3. Tests
Trước: **118 pass**. Sau: **122 pass** (thêm 4 test AiTutorTab). Không xóa/sửa test cũ.

## 4. Build
- `npm test` → 122 pass (21 suites).
- `npx tsc --noEmit` → pass.
- `npm run build` → pass (First Load JS shared 89 kB), exit 0.
- `npx next lint --file __tests__/components/learn/ai-tutor-tab.test.tsx` → không warning/error.

## 5. File đã sửa/tạo (apps/web/**)
| Loại | File | Nội dung |
|---|---|---|
| Tạo | `__tests__/components/learn/ai-tutor-tab.test.tsx` | 4 test focus hint (render / nhiều concept / guard / fallback weak_concepts) |
| Sửa | `package.json` | `test:lighthouse`: `lhci autorun` → `lhci autorun --config=lighthouse-budget.json` |

(Không đụng `AiTutorTab.tsx` — guard đã đúng, chỉ test.)

## 6. Rủi ro
- **AI-A A3 mới ship, chưa commit** (`apps/api/app/services/ai_tutor.py` đang modified trong working tree). Nếu không commit + restart API staging, hint vẫn không hiện trên môi trường thật. Frontend đã sẵn sàng cả 2 trường hợp (guard chịu được field thiếu — không crash).
- **Staging chưa deploy** — E2E/Lighthouse staging là việc sau cùng, phụ thuộc AI-B (mục B: `KUBECONFIG_STAGING`, `SMOKE_BASE_URL_STAGING`). Sau khi AI-B deploy, chạy lệnh ở mục 2.

*— AI-C (Frontend). Báo cáo theo mẫu Supervisor.*
```
=== HẾT BÁO CÁO ===
```