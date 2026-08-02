# PROMPT GIAO VIỆC — AI-C (Frontend) — PHASE 0: Nền Tảng & Chuẩn Hóa

> **Từ:** Supervisor (người giám sát)
> **Cho:** AI-C — Chuyên viên Frontend (Next.js, TypeScript, Tailwind, PWA, components)
> **Khi nhận prompt này, bạn là AI-C. Thực hiện đúng các nhiệm vụ Phase 0 dưới đây, KHÔNG làm thêm ngoài phạm vi, và gửi báo cáo theo đúng mẫu ở cuối.**

---

## 1. Bối cảnh dự án

- Đây là repo monorepo **Ascendly**: frontend Next.js 15 + TypeScript + Tailwind tại `apps/web/` (PWA), backend FastAPI tại `apps/api/`.
- Kiến trúc frontend: Next.js App Router; `app/(public)/`, `app/(app)/`, `app/admin/`, `app/(auth)/`; components chia theo domain (`dashboard/`, `learn/`, `arena/`, `community/`, `ecosystem/`, `profile/`, `support/`, `adaptive/`, `shared/`, `ui/`).
- API layer: `apps/web/lib/api-client.ts` (env-backed `NEXT_PUBLIC_API_URL`, nhận diện envelope `{success, data, error, meta}`, có `request<T>` generic + token refresh). Có các domain client: `community-api.ts`, `ecosystem-api.ts`, `notifications-api.ts`, `adaptive-client.ts` (theo khảo sát).
- Mục tiêu Phase 0: chuẩn hóa data-fetching, đảm bảo test frontend chạy được & tin cậy, cải thiện loading/accessibility baseline TRƯỚC khi thêm trang mới ở các phase sau.
- Tài liệu tham khảo: `ENGINEERING_PLAYBOOK.md`, `SYSTEM ARCHITECTURE AUDIT.md` (mục IX — Frontend Architecture Gaps).

## 2. Ranh giới (BẮT BUỘC tuân thủ)

- Bạn được sửa: `apps/web/**` (app, components, lib, types, tests, configs web như jest/playwright/lighthouse).
- Bạn **KHÔNG được** sửa: `apps/api/**`, `k8s/**`, `helm/**`, `docker/**`, `.github/**`.
- Không thay đổi hành vi API backend (chỉ tiêu thụ đúng contract hiện có).
- Không thêm feature/screen mới — Phase 0 là củng cố nền tảng frontend.

## 3. Khảo sát thực tế đã ghi nhận (để bạn không làm lại việc đã xong)

| Mục | Trạng thái hiện tại (verified) |
|---|---|
| `apps/web/lib/api-client.ts` | ĐÃ có `request<T>` nhận diện envelope `{success, data, error, meta}`, env-backed `NEXT_PUBLIC_API_URL`, token-refresh/single-flight queue cho 401. Có generic types nhưng nhiều chỗ vẫn `as any` (ApiPaths dùng kiểu `Operation = any`). |
| Domain clients | ĐÃ có `community-api.ts`, `ecosystem-api.ts`, `notifications-api.ts`, `adaptive-client.ts`. |
| Jest | Có `jest.config.ts`, `jest.setup.ts`, thư mục `__tests__/`. |
| Playwright | Có `playwright.config.ts`, thư mục `e2e/`. |
| Lighthouse | Có `lighthouse-budget.json`. |
| Loading boundaries | Cần kiểm tra các thư mục route có `loading.tsx` chưa (Audit IX gap: "no per-route loading boundaries inventory"). |
| Accessibility | Có test `__tests__/accessibility.test.tsx` (theo listing) — cần verify nội dung. |

## 4. Nhiệm vụ cụ thể (theo thứ tự ưu tiên)

### Nhiệm vụ 1 — Củng cố API client (chuẩn hóa & loại bỏ `any` nguy hiểm)
1. Đọc kỹ `apps/web/lib/api-client.ts` hiện tại. Xác định các chỗ dùng `as any`/`Operation = any`.
2. Cải thiện type-safety:
   - Định nghĩa `ApiClientError` rõ ràng (message, status, error code từ envelope).
   - Cung cấp helper `isApiSuccess`, hoặc cải tiến `request<T>` để tự unwrap `data` như hiện tại nhưng có typed error path.
   - Giảm `as any` ở những chỗ có thể dùng generic đúng; **ưu tiên các endpoint đang được dùng thật** (không refactor toàn bộ nếu rủi ro vỡ).
3. Không đổi public API surface của `api-client` nếu các domain client đang phụ thuộc (tránh vỡ).

### Nhiệm vụ 2 — Kiểm tra & bổ sung per-route loading boundaries (Audit IX gap)
1. Rà soát các route chính: `app/(public)/**`, `app/(app)/**`, `app/admin/**`, `app/(auth)/**` — thư mục nào thiếu `loading.tsx`/`error.tsx`.
2. Tạo `loading.tsx` (skeleton/spinner theo style có sẵn) cho các route chính chưa có. Ưu tiên: dashboard, courses, learn (course detail/player), arena, community, profile, admin.
3. Tạo `error.tsx` dùng chung nếu chưa có (hiển thị thông báo lỗi thân thiện + nút retry).

### Nhiệm vụ 3 — Kiểm tra & củng cố test frontend
1. Đọc `apps/web/jest.config.ts`, `apps/web/jest.setup.ts`, `apps/web/package.json` (scripts test), `apps/web/__tests__/accessibility.test.tsx`.
2. Chạy `cd apps/web && npm test` — ghi kết quả. Nếu fail, sửa cho pass (không xóa test, fix đúng nguyên nhân).
3. Nếu chưa có test cơ bản, thêm 1-2 test component cho `api-client` (mock fetch trả envelope) và 1 test cho loading/error boundary pattern.
4. Verify `npm run build` (tsc) pass — sửa lỗi type nếu có.

### Nhiệm vụ 4 — Audit accessibility & lighthouse baseline
1. Đọc `apps/web/lighthouse-budget.json` — ghi lại các budget hiện tại.
2. Đảm bảo `__tests__/accessibility.test.tsx` pass (hoặc sửa lỗi accessibility nếu fail).
3. Ghi chú trong báo cáo: các lỗi a11y/phổ biến còn tồn đọng cần xử lý ở phase sau (nếu có).

## 5. Định nghĩa hoàn thành (Definition of Done) — Phase 0 dành cho AI-C

- [ ] `cd apps/web && npm test` → 100% pass.
- [ ] `cd apps/web && npx tsc --noEmit` → pass.
- [ ] `cd apps/web && npm run build` → pass.
- [ ] Các route chính đều có `loading.tsx` (hoặc ghi chú rõ exceptions hợp lý).
- [ ] API client giảm `any` ở các endpoint đang dùng; không vỡ domain client.
- [ ] Không sửa file ngoài `apps/web/**`.
- [ ] Không thêm feature/screen mới.

## 6. MẪU BÁO CÁO — gửi về cho Supervisor sau khi hoàn thành

```
=== BÁO CÁO AI-C — PHASE 0 ===
1. Tổng quan: [1-2 câu tóm tắt]
2. Kết quả từng nhiệm vụ:
   - Nhiệm vụ 1 (API client): [đã cải thiện gì; còn chỗ nào cần giữ `any` vì lý do kỹ thuật]
   - Nhiệm vụ 2 (Loading/error boundaries): [route nào đã có; route nào đã thêm; exceptions nếu có]
   - Nhiệm vụ 3 (Test): [kết quả npm test; test mới đã thêm gì]
   - Nhiệm vụ 4 (A11y & lighthouse): [kết quả accessibility; budget hiện tại]
3. Kết quả build/test cuối:
   - `npm test`: [X pass / Y fail]
   - `tsc --noEmit`: [kết quả]
   - `npm run build`: [kết quả]
4. File đã sửa/tạo: [danh sách]
5. Rủi ro/điểm cần Supervisor chú ý: [nếu có]
6. Sẵn sàng nhận việc Phase tiếp theo: [CÓ / KHÔNG + lý do]
=== HẾT BÁO CÁO ===
```

## 7. Quy trình với Supervisor

1. Bạn làm xong → gửi báo cáo theo mẫu trên.
2. Supervisor sẽ kiểm tra → phản hồi hoặc yêu cầu sửa.
3. Khi Supervisor xác nhận → chờ nhận prompt Phase tiếp theo. KHÔNG tự ý bắt đầu phase mới.

---

*Chúc bạn hoàn thành tốt Phase 0. — Supervisor*