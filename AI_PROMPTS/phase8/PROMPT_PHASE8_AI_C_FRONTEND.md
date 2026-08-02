# PROMPT GIAO VIỆC — AI-C (Frontend) — PHASE 8: Performance + Lighthouse + E2E trên Staging

> **Từ:** Supervisor
> **Cho:** AI-C — Chuyên viên Frontend (Next.js 14, TypeScript, Playwright, Lighthouse)
> **Bối cảnh:** Phase 7 đã sign-off (118 test, tsc, build). Phase 8 = Production Readiness: performance budget, Lighthouse CI, **E2E mở rộng chạy trên staging** (W2 — phụ thuộc AI-B deploy staging). Không thay đổi contract — API đóng băng.

---

## 1. Trạng thái ĐÃ CÓ (verified — không làm lại)

- Playwright **đã có** (`playwright.config.ts`, 5 projects, `e2e/`: auth.setup, global-setup, critical-flows.spec, homepage.spec) + scripts `test:e2e` / `test:e2e:ui`.
- `lighthouse-budget.json` **đã có** (perf ≥0.8, a11y ≥0.9, best-practices ≥0.8, SEO ≥0.8, CLS ≤0.1) — Lighthouse hiện chạy qua action `treosh/lighthouse-ci-action` trong preview.yml:157 (budgetPath). **KHÔNG có npm script `lighthouse`** riêng.
- `next.config.mjs`: `images: { unoptimized: true, remotePatterns }`, output standalone, security headers, proxy `/api/v1`.
- E2E hiện có: critical-flows (login/smoke flows) + homepage. **Chưa phủ adaptive (quiz/mastery/remediation), ticket.**
- API đóng băng từ P7 — không có endpoint mới ở P8.

## 2. Nhiệm vụ

### NV1 — Performance optimization
1. **Bundle analysis**: thêm `@next/bundle-analyzer` (hoặc `next build` output) → xác định chunk lớn nhất. Tối ưu tối thiểu: lazy-load/dynamic import các component nặng ngoài viewport (adaptive quiz, admin dashboard, charts), `next/dynamic` cho MasteryRadar/AdaptiveQuiz nếu hợp lý. KHÔNG phá SSR/SEO trang public.
2. **Image optimization**: `images.unoptimized: true` đang tắt optimization — **quyết định có đổi hay giữ** (nêu lý do: nếu platform chủ yếu video/ảnh lớn có thể giữ; nếu ảnh content → bật optimizer + cấu hình `sharp`). Chọn 1, ghi rõ.
3. Đo bundle trước/sau (ghi số kB trong báo cáo).

### NV2 — Lighthouse CI budget
1. Thêm npm script `test:lighthouse` (chạy lhci trên dev server) để chạy local.
2. **Giữ budget ngưỡng hiện tại (0.8/0.9) hoặc siết lên** theo kết quả đo thực trên staging/preview: nếu đang cao hơn budget rõ ràng → siết (vd perf ≥0.9, a11y ≥0.95); nếu sát ngưỡng → giữ + ghi con số đo thực. KHÔNG bịa budget không đo được.
3. Đảm bảo job lighthouse CI (preview.yml) dùng đúng budgetPath đã cập nhật.

### NV3 — E2E mở rộng (chạy trên staging — W2)
1. **Chạy trên staging**: `playwright.config.ts` — baseURL đọc từ env `PLAYWRIGHT_BASE_URL` (mặc định localhost dev); webServer chỉ khởi động khi không có base URL bên ngoài (guard). AI-B deploy staging xong → bạn chạy `npm run test:e2e` với `PLAYWRIGHT_BASE_URL=https://staging...`.
2. **Mở rộng critical-flows** phủ business paths:
   - Học: vào lesson → xem nội dung → hoàn thành.
   - Adaptive: vào adaptive-quiz (lesson mode) → trả lời → submit → thấy breakdown + remediation.
   - Mastery: `/learn/{course}/mastery` render radar + weak/strong.
   - Ticket: tạo support ticket → xác nhận list hiển thị.
   - Login flow giữ nguyên (auth.setup có sẵn).
3. **Đánh dấu/skip thông minh**: nếu endpoint adaptive chưa có data trên staging → test bỏ qua hợp lý (không fail cứng), ghi rõ.
4. UAT support: fix bug báo cáo từ staging trong phạm vi `apps/web/**`.

### NV4 — Tests & build
- `npm test` giữ **≥ 118 pass**, `tsc --noEmit`, `npm run build` pass, không warning mới ở file sửa.

## 3. Ranh giới
- Chỉ sửa `apps/web/**`. KHÔNG sửa `apps/api/**`, `devops/**`, `.github/**` (trừ báo cáo nếu cần AI-B phối hợp — ví dụ cần staging URL).
- Không đổi hành vi API; không đổi route public (SEO).
- E2E trên staging chỉ chạy khi AI-B đã deploy (báo cáo nêu rõ trạng thái staging).

## 4. Định Nghĩa Hoàn Thành
- [ ] NV1: bundle phân tích + tối ưu (dynamic import nặng), quyết định image optimization, số kB trước/sau.
- [ ] NV2: npm script lighthouse + budget theo đo thực + CI dùng đúng budget.
- [ ] NV3: E2E phủ học/adaptive/mastery/ticket; chạy được trên staging qua `PLAYWRIGHT_BASE_URL`; UAT fixes.
- [ ] NV4: `npm test` ≥ 118, tsc, build pass.

## 5. MẪU BÁO CÁO
```
=== BÁO CÁO AI-C — PHASE 8 ===
1. Performance: [bundle trước/sau (kB); dynamic import gì; quyết định image optimization + lý do]
2. Lighthouse: [script; budget mới; số đo thực trên preview/staging]
3. E2E: [flows mới; chạy trên staging chưa (PLAYWRIGHT_BASE_URL); kết quả; skip nào]
4. UAT: [bug staging đã fix]
5. Tests: [số test trước/sau]
6. Build: [npm test / tsc / build]
7. File đã sửa/tạo: [...]
8. Rủi ro: [staging chưa deploy; adaptive chưa data; image optimization phá layout]
9. Sẵn sàng cho Release gate (smoke + e2e xanh): [CÓ/KHÔNG]
=== HẾT BÁO CÁO ===
```

*— Supervisor. Lưu ý: W2 — E2E của bạn là GATE cho promote prod (release.yml chờ e2e xanh). Nếu staging chưa ready → chạy xong W1 (performance/lighthouse) trước, báo trạng thái.*
