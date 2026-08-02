# PROMPT GIAO VIỆC — AI-C (Frontend) — PHASE 2: Support Chat Widget — Streaming + Actions + History

> **Từ:** Supervisor
> **Cho:** AI-C — Chuyên viên Frontend
> **Bối cảnh:** Phase 0, 1 đã sign-off. AI-A sẽ thêm endpoint `/support/chat/stream` (SSE) + `/support/chat/convert-to-ticket`; AI-B chuẩn bị proxy SSE. Widget chat đã tồn tại cơ bản. Bạn nâng cấp widget để dùng streaming + actions + history hoàn chỉnh. KHÔNG làm lại — chỉ thêm/cải thiện.

---

## 1. Trạng thái ĐÃ CÓ (verified theo khảo sát)

| Thành phần | Hiện trạng |
|---|---|
| `components/support/SupportChatWidget.tsx` | ✅ Đã tồn tại (floating chat button + panel) — mô tả chi tiết cần bạn verify lại khi đọc code |
| API chat hiện tại | ✅ `POST /support/chat` trả **plain JSON envelope** `{answer, actions, conversation_id, error}` (non-streaming) |
| `lib/support-api.ts` + `types/support.ts` | ✅ Đã tách ở Phase 1 (bạn đã tạo) — có `sendChat` / types `ChatMessage` |
| Backend actions | ✅ Khi LLM trả `"[ACTION: create_ticket]"` → backend parse thành `actions: [{type: "create_ticket", label: "Create support ticket"}]` |

## 2. Gap cần làm (thứ tự ưu tiên)

### NV1 — Streaming UI cho chat (SSE)
1. AI-A sẽ cung cấp `POST /support/chat/stream` trả SSE events: `message` (chunk), `context`, `actions`, `done`, `error`. **Chờ + đọc contract do AI-A / Supervisor công bố** trước khi code.
2. Cập nhật `support-api.ts`: thêm hàm `sendChatStream(question)` dùng `fetch` + `ReadableStream` (hoặc `EventSource` nếu là GET — nhưng đây là POST nên dùng fetch stream). Trả về async iterator/onmessage callback.
3. Cập nhật `SupportChatWidget.tsx`:
   - Hiển thị chunk theo chunk (streaming), có **typing indicator** khi chờ chunk đầu.
   - Sau `done`: nếu có `actions` → hiển thị nút action (vd "Create support ticket").
   - **Fallback**: nếu stream lỗi hoặc không khả dụng → dùng `sendChat` JSON cũ (giữ ổn định).
4. Không dùng `EventSource` cho POST — dùng fetch stream đúng cách.

### NV2 — Nút "Create ticket" từ actions
1. Khi action `{type: "create_ticket"}` xuất hiện → hiện nút rõ ràng: "Create support ticket".
2. Click → gọi endpoint `POST /support/chat/convert-to-ticket` (AI-A thêm) với `{question, answer, conversation_id}` → nhận `ticket_id` → hiện thông báo "Ticket #... created" + link đến `/support/tickets/{id}`.
3. Trạng thái loading khi đang tạo ticket; xử lý lỗi (toast).

### NV3 — Quick replies & message history
1. **Quick replies** khi mở chat lần đầu (nếu chưa có): "I need help with billing", "Technical issue", "Something else" → click gửi thẳng.
2. **Message history**:
   - Lưu `localStorage` (key `ascendly-support-chat`) để restore phiên khi reload.
   - Đồng bộ backend: `GET /support/chat/history` → load khi mở; `DELETE /support/chat/history` → nút "Clear" nếu có.
   - Tránh xung đột: local là phiên nhanh, backend là nguồn chính khi có conversation_id.

### NV4 — Accessibility & UX polish
1. Widget: `aria-label` cho nút mở chat, `role="log"`/`aria-live="polite"` cho vùng messages (đã ghi chú tồn đọng a11y phase trước), focus management khi mở/đóng.
2. Typing indicator dễ nhìn; nút đóng chat phải focusable.
3. Responsive cho mobile (bàn phím, chiều cao panel).

### NV5 — Tests
1. Thêm/mở rộng test `SupportChatWidget` (Jest + mock fetch):
   - Gửi message → mock stream trả chunk → render text hội tụ đúng.
   - Actions create_ticket → click → gọi convert-to-ticket → hiện link.
   - Fallback JSON khi stream fail.
   - Quick replies gửi đúng câu.
   - a11y: nút mở/đóng có aria-label, vùng chat có role/aria-live.
2. Chạy: `npm test` (≥23 + mới), `tsc --noEmit`, `npm run build`.

## 3. Ranh giới
- Chỉ sửa `apps/web/**`. Không sửa `apps/api/**`, `.github/**`, `devops/**`.
- Không đổi hành vi API backend — chỉ consume contract do AI-A/Supervisor công bố.
- Giữ fallback non-stream khi stream chưa sẵn sàng.

## 4. Định Nghĩa Hoàn Thành
- [ ] `sendChatStream` trong `support-api.ts` đọc được SSE (fetch stream).
- [ ] Widget hiển thị streaming + typing indicator + actions (create ticket) + fallback JSON.
- [ ] Quick replies + history (localStorage + backend GET/DELETE).
- [ ] a11y cơ bản cho widget (aria-label/log/live, focus).
- [ ] `npm test` pass (≥23 + test mới), `tsc --noEmit` pass, `npm run build` pass.

## 5. MẪU BÁO CÁO
```
=== BÁO CÁO AI-C — PHASE 2 ===
1. Contract stream (từ AI-A): [đã dùng event gì]
2. Streaming UI: [mô tả; fallback thế nào]
3. Create ticket action: [endpoint dùng; UX]
4. Quick replies + history: [đã thêm gì]
5. A11y: [đã cải thiện gì]
6. Tests: [số test trước/sau; kết quả]
7. Build: [npm test / tsc / build]
8. File đã sửa/tạo: [...]
9. Rủi ro: [...]
10. Sẵn sàng Phase 3 (Proactive overlay + notifications): [CÓ/KHÔNG]
=== HẾT BÁO CÁO ===
```

*— Supervisor*