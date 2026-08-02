# PROMPT HOÀN TẤT — AI-C (Frontend) — Kích hoạt AI Tutor hint + verify E2E sẵn sàng

> **Từ:** Supervisor
> **Cho:** AI-C — Chuyên viên Frontend
> **Bối cảnh:** Phase 0–8 đã sign-off (118 test, E2E local 17/17, Lighthouse budget pass). Rà soát còn **1 việc code-level** (kích hoạt AI Tutor hint — đang dormant từ P6) + chuẩn bị chạy E2E staging. Xem `AI_PROMPTS/completion/SUMMARY_REMAINING.md`.

---

## C1 — Kích hoạt AI Tutor focus hint (đóng vòng P6 NV4)

**Vấn đề:** `components/learn/AiTutorTab.tsx` (lines 99–103) đã có guard đọc `data?.data?.focus_concepts ?? data?.data?.weak_concepts` để hiện hint "Focus: …" — nhưng **backend chưa trả field** → hint không bao giờ hiện, chưa có test.

**Điều kiện:** AI-A phải xong A3 (`focus_concepts` additive trong response `ask_ai_tutor`).

**Làm:**
1. Verify AiTutorTab hiển thị "Focus:" đúng khi response có `focus_concepts` (đã guard — chỉ cần test thật, không sửa logic trừ khi test fail).
2. Thêm test component: mock response có `focus_concepts: ["List Comprehensions"]` → hint render; không có field → không render (guard).
3. Nếu AI-A chưa ship kịp → giữ guard, ghi rõ trong báo cáo (không crash).

## C2 — Chuẩn bị E2E/Lighthouse trên staging (chờ credentials)
- Verify `npm run test:e2e` với `PLAYWRIGHT_BASE_URL` hoạt động (đã làm local — ghi rõ lệnh chạy cho staging).
- Lighthouse: `npm run test:lighthouse` local pass (đã có) — ghi lệnh chạy trên preview/staging.
- KHÔNG cần code mới — chỉ xác nhận sẵn sàng + ghi lệnh.

## C3 — Regression & build
- `npm test` giữ **≥ 118 pass**, `tsc --noEmit`, `npm run build` pass, không warning mới ở file sửa.

## DoD
- [ ] C1: test focus hint (khi AI-A ship); guard giữ nguyên nếu chưa ship.
- [ ] C2: lệnh E2E/Lighthouse staging ghi rõ trong báo cáo.
- [ ] C3: 118 test + tsc + build xanh.

## MẪU BÁO CÁO
```
=== BÁO CÁO HOÀN TẤT AI-C ===
1. C1 focus hint: [AI-A ship chưa; test mới; guard]
2. C2: [lệnh E2E staging; lệnh lighthouse; sẵn sàng?]
3. Tests: [số test trước/sau]
4. Build: [npm test / tsc / build]
5. File đã sửa/tạo: [...]
6. Rủi ro: [AI-A chưa ship focus_concepts; staging chưa có]
=== HẾT BÁO CÁO ===
```

*— Supervisor. Lưu ý: C1 chờ AI-A A3 — nếu AI-A chưa xong, làm C2/C3 trước, báo trạng thái.*
