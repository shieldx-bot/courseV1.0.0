# PROMPT GIAO VIỆC — AI-A (Backend) — PHASE 2: AI Support — Chatbot RAG nâng cao + Streaming

> **Từ:** Supervisor
> **Cho:** AI-A — Chuyên viên Backend
> **Bối cảnh:** Phase 0, 1 đã sign-off. Khảo sát cho thấy AI Support đã có bản cơ bản. Bạn KHÔNG làm lại — nhiệm vụ là **nâng cấp lên RAG thật + streaming + tự động hóa ticket**.

---

## 1. Trạng thái ĐÃ CÓ (verified — không làm lại)

| Thành phần | Hiện trạng |
|---|---|
| `services/support_ai.py` | ✅ Có `chat(user_id, question)`, `get_or_create_conversation`, `get_chat_history`, `clear_chat_history`, `_build_context`, `_SYSTEM_PROMPT` |
| Cơ chế hiện tại | ✅ "Fake RAG": `search_articles(question, limit=3)` → nhét context vào system prompt → gọi `call_llm` (multi-provider: OpenRouter→Gemini→Groq→OpenAI) **non-streaming** → trả `{answer, actions, conversation_id, error}` |
| Marker create_ticket | ✅ LLM trả `"[ACTION: create_ticket]"` → backend **chỉ parse ra `actions`**, KHÔNG tự tạo ticket |
| LLM config | ✅ `core/config.py` đã có: `openai_api_key/base_url/model`, `openrouter_*`, `gemini_*`, `tavily_api_key` |
| API `/support/chat` | ✅ POST trả **plain JSON envelope** (không SSE) |

## 2. Gap cần làm (thứ tự ưu tiên)

### NV1 — Nâng cấp search KB chất lượng hơn (RAG cải tiến)
Hiện dùng text search đơn giản. Cải tiến (không bắt buộc vector nếu không có embedding sẵn — chọn phương án khả thi nhất):
1. Đọc `services/knowledge_base.py` `search_articles` — xác định quality hiện tại (match keyword? có sort theo relevant chưa?).
2. Nâng cấp scoring: kết hợp (a) keyword match title/summary/tags, (b) category ưu tiên nếu khớp fallback, (c) tăng điểm article có `helpful_count` cao.
3. **Không bắt buộc** thêm embeddings/vector trong phase này nếu chưa có module — ghi rõ vào báo cáo nếu chọn giữ text search; nếu muốn, dùng `sentence-transformers` hoặc OpenAI embeddings (config đã có key) lưu `embedding` vào `help_articles`.

### NV2 — Streaming SSE cho `/support/chat`
1. Thêm endpoint **`POST /support/chat/stream`** (hoặc đổi `/support/chat` sang SSE có flag) trả **SSE stream**:
   - Event `message` (chunk text), `context` (các article names đã dùng), `actions` (nếu có marker), `done`, `error`.
   - Dùng `StreamingResponse(media_type="text/event-stream")`.
   - Giữ endpoint cũ `/support/chat` JSON cho fallback/compat (đừng phá caller cũ).
2. Nếu `call_llm` trong `services/llm.py` chưa hỗ trợ streaming → thêm hàm `call_llm_stream` (hoặc tương đương) ở provider mức async-generator; nếu phức tạp, có thể trả từng chunk sau khi sinh xong (simulate) nhưng ưu tiên stream thật.
3. Timeout + rate-limit cho endpoint stream (chống treo) — phối hợp AI-B.

### NV3 — Backend tự tạo ticket từ chat (thay vì chỉ marker)
1. Tạo service `create_ticket_from_conversation(user_id, question, answer, ai_summary)` trong `support_ai.py`:
   - Gọi `create_ticket` của `support_tickets` (đã có) với `ai_summary` từ hội thoại.
   - Category auto = `other` hoặc trích nhanh keyword (billing/technical/account/content) — dùng đơn giản.
   - Trả `ticket_id`.
2. Khi LLM trả marker `[ACTION: create_ticket]`:
   - Giữ hành vi cũ: trả actions cho frontend, NHƯNG thêm endpoint `POST /support/chat/convert-to-ticket` (user xác nhận → gọi `create_ticket_from_conversation`).
   - Hoặc tự tạo luôn nếu marker xuất hiện kèm "high confidence" — chọn 1 trong 2, ghi rõ trong báo cáo.
3. `escalate_to_human(ticket_id, reason)` — hàm mới: đổi status ticket → `in_progress`, gắn `ai_summary`, thêm message "Escalated to human".

### NV4 — User context injection
1. Trong `chat()`: lấy user subscription/plan (search service subscriptions đã có) + tên/gói → đưa vào context để AI trả lời cá nhân hóa khi hỏi billing.
2. Không tiết lộ thông tin nhạy (không đưa payment details).

### NV5 — Tests
1. Tạo `tests/test_support_ai.py` (mock `call_llm`/`search_articles`):
   - RAG context xây đúng khi có articles.
   - Marker create_ticket → actions đúng.
   - `create_ticket_from_conversation` tạo ticket thật + summary.
   - `escalate_to_human` thay đổi status.
   - Streaming endpoint trả đúng event sequence (dùng TestClient stream).
2. Bổ sung test `/support/chat/stream` trong `test_support_system.py` nếu cần.
3. **KHÔNG gọi LLM thật trong test** — luôn mock.

## 3. Ranh giới
- Chỉ sửa `apps/api/**`. Không sửa `apps/web/**`, `.github/**`, `devops/**`.
- Giữ envelope cũ cho `/support/chat` JSON; endpoint stream là mới (additive).
- Không thay đổi hành vi ticket hiện tại (chỉ thêm luồng từ chat).

## 4. Định Nghĩa Hoàn Thành
- [ ] `/support/chat/stream` SSE hoạt động (message/context/actions/done) — mock LLM trong test.
- [ ] `create_ticket_from_conversation` + `escalate_to_human` có + test pass.
- [ ] User context (subscription/plan) được dùng trong chat.
- [ ] `pytest tests/ -q` full pass (≥ 133 + test mới).
- [ ] Không để lộ prompt/key/list nhạy cảm trong response.

## 5. MẪU BÁO CÁO
```
=== BÁO CÁO AI-A — PHASE 2 ===
1. RAG nâng cấp: [giữ text hay thêm vector; scoring mới]
2. Streaming: [endpoint; format SSE; call_llm_stream có/không]
3. Tạo ticket từ chat: [phương án chọn; endpoint/behavior]
4. User context: [lấy gì + đưa vào đâu]
5. Tests: [test_support_ai.py số test; pytest full]
6. File đã sửa/tạo: [...]
7. Rủi ro: [LLM cost/timeout/SSE proxy]
8. Sẵn sàng Phase 3 (Proactive + Admin chi tiết): [CÓ/KHÔNG]
=== HẾT BÁO CÁO ===
```

*— Supervisor*