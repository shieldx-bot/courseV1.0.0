# PROMPT GIAO VIỆC — AI-A (Backend) — PHASE 3: Proactive Support — Engine + Behavior Tracking + Admin Stats

> **Từ:** Supervisor
> **Cho:** AI-A — Chuyên viên Backend
> **Bối cảnh:** Phases 0–2 đã sign-off (145 pytest pass). Khảo sát cho thấy Proactive Support đã có nền cơ bản nhưng **chưa hoàn chỉnh**. Bạn mở rộng để đạt chuẩn file 15 (Proactive Intervention Engine). KHÔNG làm lại phần đã có.

---

## 1. Trạng thái ĐÃ CÓ (verified — không làm lại)

| Thành phần | Hiện trạng |
|---|---|
| `services/proactive_support.py` | ✅ Có: `track_event`, `detect_video_rewatch`, `detect_checkout_drop`, `detect_learning_stall`, `detect_quiz_low_score`, `get_active_interventions` |
| Worker/cron | ✅ `run_proactive_support_checks` (arq cron) tồn tại nhưng **CHỈ gọi `detect_learning_stall`** — 3 detect kia không được gọi |
| `services/email.py` | ✅ Có SMTP thật + `[DEV EMAIL]` fallback (send_receipt, send_welcome…) — nhưng **chưa có email intervention** |
| Notifications | ✅ `services/notifications.py` có `create_notification` (in-app) |
| Support tickets | ✅ Có SLA (`check_sla_breaches`), stats (`get_stats`), auto-priority |
| API hỗ trợ | ✅ `/support/*`, `/admin/support/tickets*` còn thiếu một số (xem NV2) |

## 2. Nhiệm vụ

### NV1 — Đầy đủ 4 detection trong job proactive (quan trọng nhất)
1. Mở `run_proactive_support_checks` (tìm trong `apps/api/app/core/tasks.py` hoặc nơi gọi) — hiện chỉ gọi `detect_learning_stall`.
2. Mở rộng để quét lần lượt (theo thứ tự không quá tốn kém):
   - `detect_learning_stall(user_id)` — đã gọi
   - `detect_video_rewatch` — cần xác định cách batch: job chạy theo `user_id` hay toàn collection? Nếu detect hàm cần `lesson_id`, hãy thêm wrapper batch (lấy users có progress gần đây và lặp). **Đề xuất**: thêm `run_proactive_support_checks` quét `user_behavior_events` theo nhóm (limit 200 users/lần) để tránh quét toàn bộ DB (học từ báo cáo intelligence request-time).
   - `detect_checkout_drop`
   - `detect_quiz_low_score`
3. Khi detect trả signal → `trigger_intervention(user_id, type, context)`:
   - Lưu intervention (collection mới `interventions` hoặc field trong events — chọn 1, ghi rõ)
   - Gọi `create_notification` (in-app) theo type.
   - Gửi email nếu type = learning_stall (dùng `email.py` — thêm `send_proactive_help` nếu chưa có).
   - **Chống spam**: mỗi intervention type chỉ trigger 1 lần / 7 ngày / user (dedupe) — tránh quấy rầy.

### NV2 — Behavior tracking + API expose
1. Xác nhận collection lưu behavior event (tìm trong `track_event` — khả năng `user_behavior_events`). Thêm index `{user_id, event_type, created_at}` nếu chưa có.
2. Endpoints/điểm gọi `track_event`:
   - **Video rewatch**: nơi lesson progress được cập nhật (progress service/API) → nếu `rewatch_count >= 3` trong phiên → `track_event("video_rewatch", ...)`.
   - **Checkout drop**: nơi checkout hủy/abandon (payment/checkout API) → `track_event("checkout_drop", ...)`.
   - **Quiz low score**: nơi quiz submit (adaptive/quiz service) → nếu score < 50% → `track_event("quiz_low_score", ...)`.
   - **Search no click**: nơi search catalog (search API) → nếu query không click kết quả → `track_event("search_no_click", ...)` (nếu khả thi; không bắt buộc).
3. API cho frontend: `GET /support/interventions/active` → trả `get_active_interventions(user_id)` (đã có service). Đảm bảo route + auth user.
4. Admin: endpoints tổng hợp intervention đang active theo type + đã xử lý (nếu khả thi).

### NV3 — Admin stats & SLA endpoints hoàn chỉnh
1. Xác nhận admin_router trong `api/v1/support.py` có:
   - `GET /admin/support/stats` — tickets by category/status, resolution time, satisfaction (dùng `get_stats`).
   - `GET /admin/support/sla-breaches` — dùng `check_sla_breaches`.
   - Nếu thiếu → thêm (đã có service, chỉ cần endpoint).
2. Đảm bảo `Depends(require_admin)` cho mọi admin route.

### NV4 — Expose metric LLM (từ rủi ro Phase 2)
1. Trong `services/llm.py` hoặc `core/telemetry.py`: expose Prometheus counters:
   - `llm_requests_total{provider, status}`
   - `llm_tokens_total{provider}`
   - `llm_cost_total_usd{provider}`
2. Tăng counter khi `call_llm`/`call_llm_stream` success/fail. (AI-B Phase 2 đã tạo alerts chờ metric này — cần thiết để alert hoạt động.)

### NV5 — Tests
1. `tests/test_proactive_support.py` (mới):
   - `track_event` ghi đúng collection + dedupe 7 ngày hoạt động.
   - Mỗi detect trả signal đúng khi dữ liệu mô phỏng thỏa điều kiện.
   - `run_proactive_support_checks` gọi được cả 4 detect (mock từng detect) — không crash.
   - Trigger tạo intervention + notification (không email nếu không config SMTP).
   - `GET /support/interventions/active` trả danh sách.
   - Admin stats + SLA endpoints trả đúng shape.
2. Full suite: `pytest tests/ -q` → **≥145 pass**.

## 3. Ranh giới
- Chỉ sửa `apps/api/**` (+ migrations nếu cần collection mới — nhớ update indexes).
- Không sửa frontend, `.github`, `devops`, `docker-compose` (AI-B lo email infra).
- Giữ envelope `{success, data, error, meta}`.

## 4. Định Nghĩa Hoàn Thành
- [ ] Job proactive chạy đủ 4 detect + trigger intervention + dedupe 7 ngày.
- [ ] `track_event` được gọi từ video/checkout/quiz (+ search nếu khả thi).
- [ ] `GET /support/interventions/active` hoạt động.
- [ ] Admin stats + sla-breaches endpoints có + auth admin.
- [ ] Metric `llm_*` exported từ backend.
- [ ] `pytest tests/ -q` full pass ≥145.

## 5. MẪU BÁO CÁO
```
=== BÁO CÁO AI-A — PHASE 3 ===
1. Proactive job: [đã gọi đủ 4 detect thế nào; batch wrapper; schedule]
2. Behavior tracking: [endpoint gọi track_event nào; collection + index]
3. Intervention trigger: [cách lưu; notification/email; dedupe]
4. Admin stats/SLA: [endpoints đã thêm/xác nhận]
5. Metric llm_*: [tên counters + nơi export]
6. Tests: [test_proactive_support.py số test; pytest full]
7. File đã sửa/tạo: [...]
8. Rủi ro: [email spam, job cost, batch size]
9. Sẵn sàng Phase 4 (Adaptive Learning — concepts): [CÓ/KHÔNG]
=== HẾT BÁO CÁO ===
```

*— Supervisor. Lưu ý: AI-B sẽ thêm Mailpit cho email dev — bạn dùng email.py hiện có (fallback DEV nếu chưa config).*