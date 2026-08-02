# COMPLETION — Tổng hợp việc CÒN THIẾU sau 8 phases (Supervisor)

> **Trạng thái:** Phase 0–8 code đã sign-off (backend 242 pass + 4 skip, web 118 + E2E local 17/17).
> **Mục tiêu:** Đóng tất cả việc còn dang dở mà các AI có thể làm NGAY (không chờ credentials), + liệt kê rõ phần chờ Supervisor.

---

## A. Việc AI làm được NGAY (nội dung prompt 3 file cùng thư mục)

### AI-A (Backend)
| # | Việc | Nguồn gốc | Trạng thái hiện tại |
|---|---|---|---|
| A1 | **Analytics endpoint `GET /admin/adaptive/analytics/remediation-effectiveness`** | P6 AI-B report (dashboard placeholder "cần API analytics qua quiz_attempts") | ❌ KHÔNG tồn tại (grep 0 kết quả) — Grafana panel vẫn placeholder |
| A2 | **Chính sách refresh `remedial_content`** (content LLM cũ dùng mãi để chấm exercise) | P6 AI-A report §7 | ⚠️ hash-based idempotent nhưng không flush/TTL/version |
| A3 | **AI Tutor response thêm `focus_concepts`** (additive) — đóng vòng AI Tutor UI của AI-C (đang dormant) | P6 AI-C report NV4 | ⚠️ AI-C có guard `focus_concepts` nhưng backend không trả field |
| A4 | **Smoke chạy trên staging thật** | P8 | 🔴 chờ credentials (mục B) — chuẩn bị script, verify local |

### AI-B (DevOps)
| # | Việc | Nguồn gốc | Trạng thái hiện tại |
|---|---|---|---|
| B1 | **Release gate fail-closed cho PRODUCTION** — hiện skip smoke khi thiếu `SMOKE_BASE_URL` (release.yml:172/237) → prod promote không có gate thật | P8 AI-B report §7(b) "gate promotion chưa chặn" | ❌ fail-open — nguy hiểm nhất |
| B2 | **Nối dashboard "Remediation Effectiveness"** với endpoint A1 (thay placeholder targets=[]) | P6 AI-B report | ❌ placeholder |
| B3 | **Re-baseline lint-regression cuối** (ruff/mypy) sau khi AI-A xong hết | P7 AI-B report §8 | ⏳ chờ A1–A3 xong rồi re-đo |
| B4 | **Deploy staging thật + chạy smoke/E2E trên staging** | P8 W2 | 🔴 chờ credentials (mục B) |

### AI-C (Frontend)
| # | Việc | Nguồn gốc | Trạng thái hiện tại |
|---|---|---|---|
| C1 | **Kích hoạt AI Tutor focus hint** khi AI-A ship `focus_concepts` (A3) — verify + test | P6 AI-C NV4 | ⚠️ guard sẵn, cần test thật |
| C2 | **E2E + Lighthouse trên staging thật** | P8 | 🔴 chờ credentials (mục B) |

## B. Việc CHỜ SUPERVISOR (không AI nào làm thay — chỉ Supervisor cấp)
- [ ] `KUBECONFIG_STAGING` (GitHub secret) → AI-B deploy staging thật.
- [ ] `SMOKE_BASE_URL_STAGING` + `SMOKE_USER`/`SMOKE_PASSWORD` → AI-A smoke gate staging.
- [ ] `AGE_SECRET_KEY` (SOPS private key — backup `age.key` local).
- Sau khi cấp: AI-B deploy staging → AI-A smoke → AI-C E2E → **release gate xanh → promote prod**.

## C. Đã quyết KHÔNG làm (đóng vĩnh viễn, không phải việc còn thiếu)
- **P7 NV6 dual-source counter** (stats.attempts/ratings qua event) — rủi ro contract cao, không bắt buộc (AI-A đã nêu).
- **Image optimization bật** — giữ `unoptimized: true` (lý do AI-C: video chiếm băng thông, thumbnail không phải LCP); bật sau khi có content image thật.
- **Alert mới cho remediation error rate** — chưa có series thật để tune ngưỡng.

---

*Baseline khi nhận việc: backend 242 pass + 4 skip; web 118 test + tsc + build; E2E chromium 17/17 local. Không được làm giảm.*
