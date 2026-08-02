# PROMPT GIAO VIỆC — AI-C (Frontend) — PHASE 1: Support System — Gap-fill & Tách Module

> **Từ:** Supervisor
> **Cho:** AI-C — Chuyên viên Frontend
> **Bối cảnh:** Phase 0 **đã sign-off** (npm test 14 pass, tsc pass). Khảo sát cho thấy phần lớn Support UI đã triển khai sẵn. Bạn KHÔNG làm lại. Nhiệm vụ là **tách module cho dễ maintain + bổ sung test** — không thêm tính năng mới lớn.

---

## 1. Trạng thái ĐÃ CÓ (verified — không làm lại)

| Thành phần | Trạng thái |
|---|---|
| `app/(public)/help/page.tsx` | ✅ Trang Help Center: search bar + category filter + article cards (title, summary, badge, views, helpful_count). Có `[slug]/page.tsx` chi tiết. |
| `app/(app)/support/tickets/page.tsx` | ✅ Có + `[id]/page.tsx` chi tiết ticket |
| `components/support/SupportChatWidget.tsx` | ✅ Có (floating chat — đã tồn tại) |
| `components/support/TicketDashboard.tsx` | ✅ Có |
| `app/admin/support/page.tsx` | ✅ Có — là trang admin support **file đơn** với 3 tab: Tickets (stats + filter + status + messages), Knowledge Base (CRUD articles), Proactive |
| `components/admin/` | ❌ Rỗng — chưa có `SupportDashboard.tsx` tách riêng |
| `lib/support-api.ts` + `types/support.ts` | ❌ KHÔNG tồn tại — support client gộp trong `lib/api-client.ts` (namespace `support` + `admin.support`), types trong `types/api.ts` |

## 2. Nhiệm vụ — Gap-fill & Tách Module

### NV1 — Tách module support API client + types
1. Tạo **`apps/web/types/support.ts`**: định nghĩa các interface — `Ticket`, `TicketMessage`, `HelpArticle`, `TicketStats`, `SLAInfo`, `ChatMessage` + các enum Category/Priority/Status. Lấy đúng shape từ `types/api.ts` đang có (đừng bịa shape khác).
2. Tạo **`apps/web/lib/support-api.ts`**: wrapper typed mỏng quanh `api-client` cho các thao tác support:
   - User: `listMyTickets()`, `getTicket(id)`, `createTicket(...)`, `addMessage(...)`, `rateTicketing(...)`, `getChatHistory()`, `sendChat(...)`
   - Admin: `adminListTickets(filters)`, `adminGetTicket(id)`, `adminUpdateStatus(...)`, `adminAssign(...)`, `adminStats()` (nếu có endpoint), `knowledge CRUD` (nếu admin endpoints có)
   - Tái sử dụng `request<T>`/envelope của `api-client` — không phá vỡ.
3. Cập nhật các component/trang đang dùng trực tiếp `api-client.support.*` để chuyển sang import từ `support-api.ts` (nếu rủi ro thấp); nếu rủi ro cao, tối thiểu tạo wrapper + export song song cho tương thích.

### NV2 — Tách admin support trang thành component
1. Tạo **`apps/web/components/admin/SupportDashboard.tsx`**: chuyển logic 3 tab (Tickets / Knowledge Base / Proactive) từ `app/admin/support/page.tsx` sang component (props: role/user nếu cần).
2. `app/admin/support/page.tsx` chỉ còn là container render component.
3. Giữ nguyên hành vi UI hiện tại — đây là refactor, không đổi UX.

### NV3 — Kiểm tra & bổ sung UX/UI hỗ trợ còn thiếu
1. Help articles: xác nhận trang chi tiết `[slug]` có nút **"Was this helpful?"** (gọi feedback API). Nếu thiếu → thêm.
2. Ticket dashboard: nút "Create ticket" hoạt động; trạng thái status badges render đúng (open/in_progress/...).
3. Loading/error boundaries cho `app/(app)/support/**` và `app/admin/support/**` nếu thiếu (Phase 0 chỉ thêm cho route chính).

### NV4 — UI tests cho Support
1. Thêm test component/Jest:
   - `TicketDashboard` render list + mở detail (mock api).
   - Help page: search + filter category (mock).
   - Feedback button gọi đúng API.
2. Chạy: `cd apps/web && npm test` → **≥14 pass**; `npx tsc --noEmit`; `npm run build`.

## 3. Ranh giới
- Chỉ sửa `apps/web/**`. Không sửa `apps/api/**`, `.github/**`, `devops/**`.
- KHÔNG thêm tính năng chat widget mới/cải tiến (Phase 2 cho AI chat streaming). Không đổi hành vi API.
- File mới chỉ nằm trong: `apps/web/lib/`, `apps/web/types/`, `apps/web/components/support/`, `apps/web/components/admin/`.

## 4. Định Nghĩa Hoàn Thành
- [ ] `types/support.ts` + `lib/support-api.ts` tạo xong; các component đang dùng schema cũ vẫn chạy (compat).
- [ ] `components/admin/SupportDashboard.tsx` tách từ page; page chỉ render component.
- [ ] Feedback "Was this helpful" có trên trang chi tiết article (nếu thiếu).
- [ ] Loading/error cho route support nếu thiếu.
- [ ] `npm test` pass (≥14 + test mới), `tsc --noEmit` pass, `npm run build` pass.

## 5. MẪU BÁO CÁO
```
=== BÁO CÁO AI-C — PHASE 1 ===
1. support-api.ts + types/support.ts: [mô tả API surface; có breaking thay đổi gì cho caller cũ không]
2. AdminDashboard tách component: [kết quả; page còn bao nhiêu dòng]
3. Feedback/UX bổ sung: [đã thêm gì]
4. Tests: [số test trước/sau; kết quả]
5. Build: [npm test / tsc / build]
6. File đã sửa/tạo: [...]
7. Rủi ro: [...]
8. Sẵn sàng Phase 2 (chat widget streaming): [CÓ/KHÔNG]
=== HẾT BÁO CÁO ===
```

*— Supervisor*