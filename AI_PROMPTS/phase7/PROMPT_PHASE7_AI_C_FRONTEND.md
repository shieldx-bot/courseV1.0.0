# PROMPT GIAO VIỆC — AI-C (Frontend) — PHASE 7: Regression + KPI Snapshot UI

> **Từ:** Supervisor
> **Cho:** AI-C — Chuyên viên Frontend (Next.js 14, TypeScript, Tailwind, Jest)
> **Bối cảnh:** Phase 6 đã sign-off (100 test, tsc, build). Phase 7 = Architecture Hardening. **Nguyên tắc: AI-A refactor backend qua shim — ZERO contract change → AI-C chủ yếu regression, ít việc mới.** Chi tiết xem prompt AI-A/B Phase 7.

---

## 1. Trạng thái ĐÃ CÓ (verified — không làm lại)

- Toàn bộ UI adaptive (quiz, mastery, remediation, learning path, admin heatmap) + ecosystem/admin pages đang hoạt động với contract hiện tại.
- `apiClient` có đầy đủ endpoint learner + admin; `adaptiveClient` wrap đủ.
- AI-A Phase 7 sẽ: split `ecosystem.py`/`community.py` (facade shim), publish domain events, snapshot intelligence (`GET /admin/intelligence/overview` sẽ đọc snapshot), thêm TTL index. **Không đổi response shape nào.**

## 2. Nhiệm vụ

### NV1 — Regression toàn bộ (việc chính)
1. Chạy full suite: `npm test` (≥ 100 pass), `tsc --noEmit`, `npm run build`.
2. Rà soát các trang phụ thuộc ecosystem/challenges (arena, challenges, admin/community, creator pages...) — contract shim giữ nguyên nên **không được có file nào phải sửa vì refactor**. Nếu phát hiện AI-A vô tình đổi shape → báo Supervisor ngay (không tự sửa backend).
3. Thêm 2–3 test regression cho ecosystem UI (nếu thiếu): render trang creator/arena không crash với mock data (guard pattern như adaptive).

### NV2 — KPI từ intelligence snapshot (optional, guard)
Nếu sau khi AI-A ship snapshot, `GET /admin/intelligence/overview` trả thêm field thời điểm generate (`generated_at`) + data → admin dashboard hiển thị badge "Snapshot: {time}" (thay vì hiểu nhầm là real-time). Guard: field optional, không có thì không render. Nếu response shape không đổi → bỏ qua mục này (nêu rõ trong báo cáo).

### NV3 — Request-ID hiển thị (nhỏ)
Nếu AI-B ship middleware `X-Request-ID`: trong trang lỗi/admin (nếu có hiển thị error code), hiển thị request-id để hỗ trợ trace. Guard optional. Không bắt buộc.

### NV4 — Tests & build
- Regression đủ: ít nhất các suite adaptive + ecosystem pass; **target ≥ 105 pass**.
- `tsc --noEmit` pass, `npm run build` pass, không warning mới ở file sửa.

## 3. Ranh giới
- Chỉ sửa `apps/web/**`. KHÔNG sửa `apps/api/**`, `devops/**`, `.github/**`.
- Không đổi hành vi API; không thêm UI phụ thuộc endpoint chưa có (guard mọi thứ additive).
- Nếu AI-A refactor làm hỏng contract (dù là lỗi hiếm) → **chỉ báo cáo**, không tự sửa backend.

## 4. Định Nghĩa Hoàn Thành
- [ ] NV1: full regression pass; 2–3 test ecosystem mới.
- [ ] NV2: snapshot badge (nếu response có field) — guard.
- [ ] NV3: request-id hiển thị (nếu middleware có) — optional.
- [ ] NV4: `npm test` ≥ 105 pass, `tsc` pass, `npm run build` pass.

## 5. MẪU BÁO CÁO
```
=== BÁO CÁO AI-C — PHASE 7 ===
1. Regression: [full suite; có file nào phải sửa vì refactor backend không?]
2. KPI snapshot: [có/không — field generated_at?]
3. Request-ID: [có/không hiển thị]
4. Tests: [số test trước/sau]
5. Build: [npm test / tsc / build]
6. File đã sửa/tạo: [...]
7. Rủi ro: [AI-A đổi shape vô tình — báo cáo ngay; endpoint snapshot chưa ship]
8. Sẵn sàng Phase 8 (Production Readiness + E2E): [CÓ/KHÔNG]
=== HẾT BÁO CÁO ===
```

*— Supervisor. Lưu ý: Phase 7 với AI-C là "ít mà chắc" — regression là chính; nếu backend refactor không đổi contract thì file của bạn gần như không phải đụng.*
