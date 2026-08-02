# PROMPT HOÀN TẤT — AI-A (Backend) — Đóng 3 việc còn thiếu từ 8 phases

> **Từ:** Supervisor
> **Cho:** AI-A — Chuyên viên Backend
> **Bối cảnh:** Phase 0–8 đã sign-off (242 pass + 4 skip). Rà soát toàn bộ báo cáo + verify, còn **3 việc code-level** AI-A có thể làm NGAY. Xem `AI_PROMPTS/completion/SUMMARY_REMAINING.md`.

---

## A1 — Endpoint analytics `GET /admin/adaptive/analytics/remediation-effectiveness` (kế thừa P6)

**Vấn đề:** Grafana panel "Remediation Effectiveness" vẫn placeholder từ P6 vì endpoint không tồn tại (đã grep xác nhận 0 kết quả trong `api/v1/` + `services/`).

**Làm:**
1. Service `app/services/analytics.py` (mới) hoặc thêm vào `remediation.py`: tính remediation effectiveness từ **`quiz_attempts.concept_results`** (mastery_before/after) + **exercise submits** (`remedial_content` + M7 data):
   - `total_users` (user đã làm ≥1 remediation/exercise trong window)
   - `improved_pct` (% user có mastery tăng sau remediation)
   - `avg_mastery_delta`, `avg_gap_resolution_days` (thời gian mastery vượt ngưỡng yếu 3.0)
   - `by_concept`: top concepts yếu + delta trung bình.
2. Endpoint admin: `GET /admin/adaptive/analytics/remediation-effectiveness?window_days=30&course_id=` (course_id optional) — envelope chuẩn, yêu cầu `require_admin`.
3. Tests: dữ liệu mẫu quiz_attempts → đúng improved_pct/avg_delta; window_days lọc đúng; không data → trả `{total_users: 0, ...}` không crash.

## A2 — Chính sách refresh `remedial_content` (kế thừa P6)

**Vấn đề:** `remedial_content` (doc `rc-{concept_id}-{hash[:12]}`) không có cơ chế flush — content LLM cũ dùng mãi để chấm exercise; khi admin sửa concept, content không được tái sinh.

**Làm (chọn 1, nêu lý do):**
- **Cách A (khuyến nghị)**: thêm `POST /admin/adaptive/remediation/flush/{concept_id}` — xóa `remedial_content` + cache Redis của concept đó (generate lại lần sau). Có test.
- **Cách B**: TTL cho `remedial_content` (VD `expire_at` 30 ngày — pattern như `intelligence_snapshots`) + khi hết hạn generate lại.
- Chỉ chọn 1 — không làm cả 2. Báo cáo quyết định.

## A3 — AI Tutor response thêm `focus_concepts` (additive — đóng vòng P6 NV4 của AI-C)

**Vấn đề:** AI-C đã viết guard trong `AiTutorTab.tsx` đọc `data?.data?.focus_concepts ?? data?.data?.weak_concepts` nhưng backend `ask_ai_tutor` **không trả field nào** → hint "Focus:" không bao giờ hiện.

**Làm:**
1. Trong `app/services/ai_tutor.py` (hoặc endpoint `ai_tutor.py`): nếu user có weak concepts thuộc lesson → thêm **`focus_concepts: [tên concept]`** vào response data (additive — giữ `answer/session_id/message_count`). Không có weak → field vắng hoặc `[]`.
2. KHÔNG thay đổi prompt/context hiện có (P6 NV1 giữ nguyên).
3. Test: user yếu → response có `focus_concepts`; mastery cao → không có.

## A4 — Chuẩn bị smoke cho staging (chờ credentials — chuẩn bị sẵn)
- Verify `make smoke` chạy với `SMOKE_BASE_URL` bất kỳ + `SMOKE_USER/SMOKE_PASSWORD` (đã làm local) — KHÔNG cần làm thêm, chỉ ghi rõ trong báo cáo lệnh chạy khi có staging.
- Hygiene: thêm `apps/api/logs/errors/*.jsonl` vào `.gitignore` (preventive — file này từng modified nhiều lần).

## DoD
- [ ] A1: endpoint + test (có analytics data từ quiz_attempts), dashboard AI-B có thể nối.
- [ ] A2: flush hoặc TTL chọn 1 + test.
- [ ] A3: `focus_concepts` additive + test.
- [ ] A4: `.gitignore` logs; command smoke staging ghi trong báo cáo.
- [ ] pytest **≥ 242 pass + 4 skip** (không giảm).

## MẪU BÁO CÁO
```
=== BÁO CÁO HOÀN TẤT AI-A ===
1. A1 analytics: [shape; nguồn data; test; window_days]
2. A2 refresh: [chọn A/B; lý do; test]
3. A3 focus_concepts: [field additive; test]
4. A4: [gitignore; lệnh smoke staging]
5. Tests: [số test trước/sau]
6. File đã sửa/tạo: [...]
7. Rủi ro: [dashboard chưa nối; analytics data rỗng trên dev]
=== HẾT BÁO CÁO ===
```

*— Supervisor. Lưu ý: A1 là điều kiện để AI-B B2 nối dashboard; A3 là điều kiện để AI-C C1 kích hoạt UI. Làm xong gửi báo cáo để tôi verify rồi cho AI-B/AI-C chạy bước của họ.*
