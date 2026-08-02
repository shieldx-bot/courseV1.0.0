# PROMPT GIAO VIỆC — AI-C (Frontend) — PHASE 3: Proactive Support — UI Intervention + Admin Dashboard Hoàn Chỉnh

> **Từ:** Supervisor
> **Cho:** AI-C — Chuyên viên Frontend
> **Bối cảnh:** Phases 0–2 đã sign-off (29 web test pass). AI-A sẽ thêm `GET /support/interventions/active` + backend trigger intervention (notification in-app + email). Bạn làm UI hiển thị proactive intervention cho user + hoàn thiện admin dashboard support. KHÔNG làm lại phần đã có.

---

## 1. Trạng thái ĐÃ CÓ (verified theo khảo sát)

| Thành phần | Hiện trạng |
|---|---|
| `app/admin/support/page.tsx` | ✅ Đã có — **3 tab: Tickets, Knowledge Base, Proactive** (theo khảo sát) — cần bạn verify lại hiện trạng thực tế khi mở code |
| `components/admin/SupportDashboard.tsx` | ⚠️ Cần xác nhận: Phase 1 dự kiến tách — nếu chưa có → tách ngay trong phase này; nếu đã có → dùng luôn |
| Notification UI | ✅ Đã có `components/ecosystem/notification-bell.tsx` + `notifications-view.tsx` (in-app) |
| Behaviors | AI-A sẽ export `GET /support/interventions/active` trả list intervention đang active cho user |
| A11y tồn đọng | ⚠️ Ghi chú từ Phase 0: toast/scroll-area chưa có `aria-live` chuẩn |

## 2. Nhiệm vụ

### NV1 — UI hiển thị proactive intervention (cho user)
1. Khi `GET /support/interventions/active` trả list (vd `{type: "learning_stall"}`, `{type: "quiz_low_score"}`, `{type: "video_rewatch"}`, `{type: "checkout_drop"}`) → hiển thị thông báo phù hợp:
   - **Banner/toast proactive** (component mới `components/support/ProactiveIntervention.tsx` hoặc tương tự): message theo type ("Your course is waiting. Need a hand?", "Struggling with this lesson? Try AI tutor"...), nút CTA (Ask AI tutor / Review lessons / Continue).
   - Hiển thị ở đúng ngữ cảnh: quiz_low_score → trong trang quiz/learn; checkout_drop → trong checkout; learning_stall → khi mở app; video_rewatch → trong lesson player (nếu khả thi).
   - **Nhẹ nhàng, không chặn**: banner đóng được, không hiện lại nhiều lần trong phiên (dismiss trong localStorage).
2. Gọi API đúng lúc: fetch khi layout `(app)` mount hoặc theo trang — tránh fetch thừa (chỉ khi đã đăng nhập).
3. Fallback: nếu API chưa có (AI-A chưa merge) → không vỡ UI (im lặng).

### NV2 — Hoàn thiện admin dashboard support
1. Verify `app/admin/support/page.tsx` hiện tại — nếu chưa tách `SupportDashboard.tsx` từ Phase 1 → tách ngay (đúng yêu cầu Phase 1 còn nợ).
2. **Tab Tickets**: đảm bảo có stats cards (total, avg resolution, satisfaction, SLA breaches — dùng `GET /admin/support/stats`), filter (status/category/priority), update status, assign, xem messages. Nếu thiếu → bổ sung.
3. **Tab Proactive**: hiển thị list interventions đang active/đã trigger (nếu AI-A có admin endpoint; chưa có thì để placeholder đọc từ `/admin/support/*` hoặc ghi chú trong code).
4. **Tab Knowledge Base**: CRUD articles (đã có — verify hoạt động: create/update/delete + search).
5. A11y cho admin: bảng có thead/aria-label, nút action có aria-label.

### NV3 — Notification integration
1. Khi `create_notification` backend tạo intervention notification → `notification-bell` đã hiển thị (đã có). Chỉ kiểm tra type/icon mới hiển thị đúng (nếu notification types có thêm `proactive_*`).
2. Nếu cần thêm filter/category cho proactive trong notifications-view → thêm nhẹ.

### NV4 — Tests
1. Thêm test cho `ProactiveIntervention` (Jest + mock):
   - Render đúng message theo type.
   - Nút CTA gọi đúng hành động (AI tutor / review).
   - Dismiss → localStorage set + không hiện lại.
   - API active trả rỗng → không render.
2. Thêm/sửa test admin support nếu tách component (render tabs, filter).
3. Chạy: `npm test` (≥29 + mới), `tsc --noEmit`, `npm run build`.

## 3. Ranh giới
- Chỉ sửa `apps/web/**`. Không sửa `apps/api/**`, `.github/**`, `devops/**`.
- Không đổi hành vi API — consume `GET /support/interventions/active` do AI-A cung cấp.
- UI proactive phải dismiss-able, không chặn trải nghiệm học.

## 4. Định Nghĩa Hoàn Thành
- [ ] `ProactiveIntervention` component (hoặc tương đương) render theo type + CTA + dismiss + localStorage.
- [ ] Fetch `interventions/active` ở layout (app) không vỡ khi API chưa có.
- [ ] Admin dashboard tách/hoàn thiện 3 tab (Tickets stats + Proactive + KB) — xác nhận hiện trạng.
- [ ] A11y cơ bản (aria-live cho banner, thead/aria-label cho bảng).
- [ ] `npm test` pass (≥29 + mới), `tsc` pass, `npm run build` pass.

## 5. MẪU BÁO CÁO
```
=== BÁO CÁO AI-C — PHASE 3 ===
1. ProactiveIntervention UI: [component; cách render theo type; CTA; dismiss]
2. API active: [endpoint dùng; fallback khi chưa có]
3. Admin dashboard: [đã tách chưa; 3 tab hiện trạng; bổ sung gì]
4. Notification integration: [type proactive hiển thị chưa]
5. Tests: [số test trước/sau; kết quả]
6. Build: [npm test / tsc / build]
7. File đã sửa/tạo: [...]
8. Rủi ro: [...]
9. Sẵn sàng Phase 4 (Adaptive Learning UI — mastery radar/quiz): [CÓ/KHÔNG]
=== HẾT BÁO CÁO ===
```

*— Supervisor. Lưu ý: AI-A đang thêm `GET /support/interventions/active`; nếu chưa merge, dùng mock/fallback tạm.*