# SUPERVISOR WORKFLOW — Quy Trình Giám Sát Đội AI (Vòng Lặp Giao Việc → Báo Cáo → Kiểm Tra)

> **Vai trò:** Bạn là Supervisor. 3 AI (A-Backend, B-DevOps, C-Frontend) làm việc độc lập, gửi báo cáo về cho bạn, bạn kiểm tra rồi giao việc tiếp theo.

---

## 1. Vòng Lặp Vận Hành (Operation Loop)

```
┌────────────────────────────────────────────────────────────────────┐
│                                                                      │
│  1. GIAO VIỆC       2. CÁC AI LÀM        3. BÁO CÁO VỀ SUPERVISOR   │
│  Supervisor gửi     AI-A, AI-B, AI-C      Mỗi AI gửi báo cáo        │
│  prompt Phase N      làm song song        theo MẪU có sẵn trong     │
│  cho từng AI        (không conflict)      prompt của mình           │
│                                                                      │
│  ▲                                       │                          │
│  │                                       ▼                          │
│  │                    4. SUPERVISOR KIỂM TRA                        │
│  │                    - Đọc báo cáo                                  │
│  │                    - Chạy lại test / build (verify)              │
│  │                    - Review file thay đổi                        │
│  │                    - Kiểm tra Definition of Done                 │
│  │                                                                  │
│  └── 5. GIAO VIỆC TIẾP THEO ◄─────────── Kết quả: ✔ Sign-off / ✘ Sửa │
│                                                                      │
└────────────────────────────────────────────────────────────────────┘
```

## 2. Cách Giao Việc

- Mỗi Phase → 1 prompt cho từng AI (file trong thư mục `AI_PROMPTS/`).
- **Giao đồng thời cả 3** nếu không conflict (ví dụ Phase 0: AI-A sửa `apps/api/`, AI-B sửa `.github/` + `Makefile`, AI-C sửa `apps/web/` — độc lập hoàn toàn).
- Mỗi prompt gồm: bối cảnh, ranh giới, nhiệm vụ cụ thể, Definition of Done, **mẫu báo cáo bắt buộc**.

## 3. Khi Nhận Báo Cáo Từ AI

### Bước 1 — Đọc báo cáo
- Đối chiếu với mẫu: tổng quan, kết quả từng nhiệm vụ, kết quả test, file đã sửa, rủi ro.
- Nếu AI báo "không cần xử lý" cho một nhiệm vụ → kiểm tra lý do có hợp lý không (so với trạng thái verified trong prompt).

### Bước 2 — Verify độc lập (không tin tuyệt đối báo cáo)
```bash
# Backend (AI-A)
cd apps/api && python -m pytest tests/ -q

# Frontend (AI-C)
cd apps/web && npm test
cd apps/web && npx tsc --noEmit
cd apps/web && npm run build

# Infra (AI-B)
kubectl apply --dry-run=client -f k8s/   # nếu có kubectl
helm template ./helm/ascendly-api
make test-api  # nếu Makefile đã tạo
```
- Xem git diff: `git diff --stat` → kiểm tra AI không đụng file ngoài phạm vi.

### Bước 3 — Đánh giá Definition of Done
- [ ] Kết quả test/buid xanh (verify thực tế).
- [ ] Không vi phạm ranh giới file.
- [ ] Không phá vỡ response envelope.
- [ ] Migration chạy sạch (nếu phase có DB thay đổi).
- [ ] Báo cáo đầy đủ theo mẫu.

### Bước 4 — Phản hồi
- **✔ Sign-off:** gửi prompt Phase tiếp theo cho AI đó.
- **✘ Yêu cầu sửa:** nêu cụ thể lỗi/thiếu gì, gửi lại cho cùng AI (không giao AI khác sửa hộ).

## 4. Lịch Trình & Đồng Bộ

| Thời điểm | Hành động |
|---|---|
| Đầu Phase | Gửi prompt cho cả 3 AI cùng lúc (nếu độc lập) |
| Giữa Phase | Theo dõi tiến độ; nếu 1 AI xong sớm → kiểm tra nhanh báo cáo, có thể giao sẵn phần thuộc phase sau mà không chặn |
| Cuối Phase | Chờ đủ 3 báo cáo → verify tổng thể → **integration sign-off** → bắt đầu phase mới |

> **Nguyên tắc:** Không bắt đầu phase mới khi chưa đủ sign-off phase trước (trừ phần rõ ràng độc lập).

## 5. Bảng Theo Dõi (Tracking Sheet mẫu)

| Phase | AI-A (Backend) | AI-B (DevOps) | AI-C (Frontend) | Sign-off |
|---|---|---|---|---|
| P0 | ⏳ Đang làm | ⏳ Đang làm | ⏳ Đang làm | ❌ |
| P1 | ⏸ Chờ | ⏸ Chờ | ⏸ Chờ | ❌ |
| P2 | ⏸ Chờ | ⏸ Chờ | ⏸ Chờ | ❌ |
| ... | ... | ... | ... | ... |

- ✅ Xong + verified · ⏳ Đang làm · ⏸ Chờ giao việc · ❌ Chưa sign-off · ✔ Đã sign-off

### Trạng thái hiện tại — Phase 0 (cập nhật lần cuối: sau khi nhận báo cáo AI-B + AI-C)

| Agent | Trạng thái | Ghi chú |
|---|---|---|
| AI-A (Backend) | ⏳ Đang làm (bổ sung) | ⚠️ CHƯA gửi báo cáo. Đã gửi prompt bổ sung `PROMPT_PHASE0_AI_A_BACKEND_SUPPLEMENT.md` để fix: 1 test fail (`test_community_ai::test_submit_skill_activity_mentor`), migration runner path (`cli.py` → `app/migrations` sai), migration 002 (`ensure_indexes` không tồn tại → `create_indexes`), Pydantic v2 còn sót (`exam.py:27`), xác nhận DB parity helpers. |
| AI-B (DevOps) | ✅ Đã báo cáo (chờ verify kỹ hơn / sign-off) | Verified: bugs migration AI-B nêu là THẬT. YAML 31/31 OK, Makefile chạy được (`test-web` 14 pass). Docker build/kubectl/helm chưa chạy được trên máy (permission/absent) — ghi nhận giới hạn. CI job `api` sẽ đỏ tới khi AI-A fix migration + test fail. |
| AI-C (Frontend) | ✅ Đã báo cáo (chờ verify độc lập / sign-off) | Báo cáo: `npm test` 14 pass, `tsc` pass, `build` pass; đã fix jest config, a11y, api-client type-safety, thêm 6 loading.tsx. Rủi ro ghi nhận: Next.js thực tế 14.2.35 (không phải 15), `request<T>` giữ default `any` cho endpoint chưa có schema. |
| Supervisor | — | Việc tiếp theo: (1) verify độc lập web (`npm test`/`tsc`/`build`) trước khi sign-off AI-C; (2) verify lại CI job sau khi AI-A fix; (3) sign-off Phase 0 khi cả 3 xong → giao Phase 1. |

## 6. Checklist Nhận Báo Cáo (dán nhanh)

```
AI [A/B/C] báo cáo Phase [N]:
- [ ] Báo cáo đúng mẫu chưa?
- [ ] Test thực tế mình chạy lại: pass?
- [ ] git diff --stat có file ngoài phạm vi?
- [ ] DoD phase đạt? (xem lại bảng DoD trong AI_WORKFORCE_PLAN.md)
- [ ] Có rủi ro nào cần quyết định?
→ Quyết định: ✔ Giao phase tiếp / ✘ Sửa + lý do cụ thể
```

---

*Dùng chung với `AI_WORKFORCE_PLAN.md` (kế hoạch phase tổng thể) và 3 prompt trong thư mục này.*