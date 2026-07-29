Dựa trên phân tích toàn bộ hệ thống Ascendly hiện tại, tôi đề xuất một cải tiến **lớn và có tác động chiến lược** cho tính năng hỗ trợ người dùng:

---

# Đề Xuất: Hệ thống Trợ lý Hỗ trợ Người dùng Tích hợp AI với Can thiệp Chủ động (Intelligent User Support System)

## 1. Vấn đề hiện tại

Hệ thống hỗ trợ người dùng hiện tại còn **rất thủ công và thụ động**:

| Thành phần | Trạng thái hiện tại | Hạn chế |
|---|---|---|
| **FAQ** | Trang tĩnh hardcoded 4 câu hỏi | Không searchable, không cập nhật động, không cá nhân hóa |
| **Contact form** | Form đơn giản lưu vào MongoDB | Không có ticket tracking, không có phân loại, không có SLA, không có trạng thái |
| **AI Tutor** | Chỉ hoạt động trong ngữ cảnh bài học | Không trả lời được câu hỏi về billing, kỹ thuật, tài khoản, chính sách |
| **Discussion** | Q&A cộng đồng chậm | Không phải hỗ trợ thực thụ, thiếu instructor involvement |

**Hậu quả:** Người dùng gặp vấn đề → không tìm thấy câu trả lời → bỏ cuộc (churn) hoặc phải chờ đợi email (trải nghiệm tệ). Đây là một trong những **churn trigger chính** của subscription business.

---

## 2. Giải pháp đề xuất

Xây dựng một **Hệ thống Trợ lý Hỗ trợ Tích hợp AI** gồm 5 thành phần chính:

### 2.1 AI Support Chatbot (Platform-wide)

Một chatbot AI **RAG-based** hoạt động trên toàn bộ platform, không chỉ trong bài học. Khác với AI Tutor (chỉ trả lời về nội dung bài học), Support AI có thể trả lời:

- Câu hỏi về **billing/payment**: "How do I cancel?", "Can I get a refund?"
- Câu hỏi **kỹ thuật**: "Video not playing", "Can't access course"
- Câu hỏi về **tài khoản**: "How to change email?", "Password reset"
- Câu hỏi về **chính sách**: "What is the refund policy?", "How does membership work?"

**Kiến trúc:**
```
User hỏi: "How do I cancel my subscription?"
       │
       ▼
Backend search Knowledge Base (RAG) + User Context (subscription status, current plan)
       │
       ▼
Top 5 relevant chunks + user context → LLM (Groq)
       │
       ▼
Response stream về frontend + suggest related actions (e.g., "I can help you cancel, click here")
```

**Knowledge Base** sẽ là một collection `help_articles` với nội dung được vector hóa (dùng sentence-transformers hoặc OpenAI embeddings), bao gồm:
- FAQs (từ trang FAQ hiện tại)
- Hướng dẫn sử dụng
- Chính sách (refund, cancellation, terms)
- Troubleshooting guides
- Course-specific help content

### 2.2 Proactive Intervention Engine

Hệ thống **tự động phát hiện** khi người dùng gặp khó khăn và **chủ động** offer help:

| Tín hiệu | Hành động chủ động |
|---|---|
| User xem lại cùng 1 section của video 3+ lần | Hiển thị tooltip: "Need help? Ask AI about this section" |
| User bỏ giữa checkout (cart abandonment) | Popup: "Having trouble with payment? We can help" |
| User dừng học 3+ ngày | Email + in-app notification: "Your course is waiting. Need a hand?" |
| User làm quiz và điểm < 50% | Suggest: "Review these lessons" + offer AI tutor |
| User gặp lỗi video (error event) | Auto-detect + show: "Video issue detected. Try these steps" |
| User search trong catalog nhưng không click khóa học nào | Offer: "Not finding what you need? Ask our AI" |

### 2.3 Smart Ticket Management System

Khi AI không thể giải quyết vấn đề:

1. **Auto-create ticket** với thông tin đầy đủ: user context, issue category, priority
2. **Auto-categorize** ticket bằng AI (billing, technical, content, account, other)
3. **Auto-route** đến team phù hợp hoặc admin
4. **SLA tracking**: P1 (4h), P2 (24h), P3 (72h)
5. **Ticket status**: open → in_progress → waiting_user → resolved → closed
6. **Email notifications** cho user khi ticket có cập nhật
7. **Admin dashboard** để manage tickets, assign, resolve

### 2.4 Contextual Help Overlay

Hệ thống tooltip/guide **ngữ cảnh** xuất hiện dựa trên trang và hành động của user:

- **First-time user onboarding**: Interactive tour qua các tính năng chính (course player, notes, AI tutor, discussions)
- **Contextual tips**: Khi user ở trang billing → show "Need help with payment? Chat with us"
- **Feature discovery**: "Did you know you can download lessons for offline? Click here"
- **Error-state help**: Khi có lỗi API → show relevant troubleshooting steps

### 2.5 Searchable Knowledge Base

Trang `/help` với:
- **Full-text search** (Meilisearch) qua tất cả articles
- **Categories**: Getting Started, Billing, Technical, Courses, Account
- **Article views tracking** để cải thiện content
- **"Was this helpful?"** feedback trên mỗi article

---

## 3. Kiến trúc tổng thể

```
┌─────────────────────────────────────────────────────────────────┐
│                        FRONTEND                                  │
│  ┌──────────────┐  ┌──────────────┐  ┌─────────────────────┐  │
│  │ Chat Widget  │  │ Help Overlay │  │ Ticket Dashboard    │  │
│  │ (Floating)   │  │ (Tooltips)   │  │ (User + Admin)      │  │
│  └──────┬───────┘  └──────┬───────┘  └─────────────────────┘  │
│         │                 │                                    │
│  ┌──────▼─────────────────▼──────────────────────────────────┐ │
│  │              Knowledge Base Page (/help)                    │ │
│  │          (Searchable articles + categories)                 │ │
│  └────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                     BACKEND (FastAPI)                           │
│                                                                 │
│  ┌──────────────┐  ┌──────────────┐  ┌─────────────────────┐  │
│  │ AI Support   │  │ Proactive    │  │ Ticket Management   │  │
│  │ Service      │  │ Engine       │  │ Service             │  │
│  │ (RAG + LLM)  │  │ (Behavioral) │  │ (CRUD + Routing)    │  │
│  └──────┬───────┘  └──────┬───────┘  └──────────┬──────────┘  │
│         │                 │                      │              │
│  ┌──────▼─────────────────▼──────────────────────▼──────────┐  │
│  │              Behavior Tracking Service                     │  │
│  │    (Tracks: video rewatches, checkout drops, quiz scores)  │  │
│  └────────────────────────────────────────────────────────────┘  │
│                                                                 │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │              Knowledge Base Service                        │ │
│  │    (Article CRUD, search, vector indexing, feedback)       │ │
│  └────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                        DATABASE                                 │
│  ┌──────────────┐  ┌──────────────┐  ┌─────────────────────┐  │
│  │ support_     │  │ help_articles│  │ user_behavior_      │  │
│  │ tickets      │  │              │  │ events              │  │
│  └──────────────┘  └──────────────┘  └─────────────────────┘  │
│  ┌──────────────┐  ┌──────────────┐                           │
│  │ ticket_      │  │ kb_feedback  │                           │
│  │ messages     │  │              │                           │
│  └──────────────┘  └──────────────┘                           │
└─────────────────────────────────────────────────────────────────┘
```

---

## 4. Các thành phần chính chi tiết

### 4.1 Collections mới

**`support_tickets`**
```javascript
{
  _id: "ticket-xxx",
  user_id: "user-xxx",
  category: "billing|technical|content|account|other",  // auto-classified
  priority: "P1|P2|P3",  // auto-assigned
  subject: "Can't access my course",
  status: "open|in_progress|waiting_user|resolved|closed",
  ai_summary: "User cannot access course after payment...",
  created_at: "...",
  updated_at: "...",
  resolved_at: "...",
  assigned_to: "admin-xxx" | null,
  satisfaction_rating: 1-5 | null
}
```

**`ticket_messages`**
```javascript
{
  _id: "msg-xxx",
  ticket_id: "ticket-xxx",
  sender_type: "user|admin|ai",
  sender_id: "user-xxx" | "admin-xxx" | "system",
  content: "I can't access my course...",
  created_at: "..."
}
```

**`help_articles`**
```javascript
{
  _id: "article-xxx",
  slug: "how-to-cancel-subscription",
  title: "How to Cancel Your Subscription",
  category: "billing",
  content: "Full article content...",
  summary: "Short summary for RAG...",  // 50-100 words
  embedding: [0.1, 0.2, ...],  // vector embedding for RAG
  tags: ["cancel", "subscription", "billing"],
  is_published: true,
  views: 1234,
  helpful_count: 120,
  not_helpful_count: 5,
  created_at: "...",
  updated_at: "..."
}
```

**`user_behavior_events`** (mở rộng collection `events` hiện có)
```javascript
{
  event_type: "video_rewatch|checkout_drop|quiz_low_score|search_no_click|error_occurred|feature_used",
  user_id: "user-xxx",
  metadata: {
    video_id: "...",  // for rewatch
    lesson_id: "...",
    rewatch_count: 3,
    section_seconds: 120  // which section
  },
  page: "/learn/course/lesson-1",
  created_at: "..."
}
```

### 4.2 Backend Services mới

**`services/support_ai.py`** — AI Support Service
- `search_knowledge_base(query, top_k=5)` — RAG search trong help_articles
- `generate_support_response(user_id, question, context)` — Generate response từ LLM
- `create_ticket_from_conversation(user_id, category, priority, ai_summary)` — Tạo ticket từ chat
- `escalate_to_human(ticket_id, reason)` — Chuyển cho human support

**`services/proactive_support.py`** — Proactive Intervention Engine
- `check_video_rewatch(user_id, lesson_id)` — Detect rewatch pattern
- `check_checkout_drop(user_id)` — Detect checkout abandonment
- `check_learning_stall(user_id)` — Detect 3+ days no activity
- `check_quiz_low_score(user_id, quiz_id)` — Detect low score
- `trigger_intervention(user_id, intervention_type, context)` — Trigger help offer

**`services/support_tickets.py`** — Ticket Management
- `create_ticket(user_id, subject, category, priority, ai_summary)`
- `add_message(ticket_id, sender_type, sender_id, content)`
- `update_ticket_status(ticket_id, status)`
- `assign_ticket(ticket_id, admin_id)`
- `get_user_tickets(user_id)` — List tickets của user
- `get_admin_tickets(filters)` — Admin list với filters
- `auto_classify_and_route(ticket_id)` — AI classify + assign priority

**`services/knowledge_base.py`** — Knowledge Base
- `create_article(data)` / `update_article(id, data)` / `delete_article(id)`
- `search_articles(query, top_k, category)` — Full-text + vector search
- `get_article_by_slug(slug)`
- `record_feedback(article_id, helpful)` — Track helpful/not helpful

### 4.3 API Endpoints mới

**`api/v1/support.py`** — Support Chat & Tickets
- `POST /support/chat` — Send message to AI support
- `GET /support/tickets` — List user's tickets
- `GET /support/tickets/{id}` — Get ticket detail + messages
- `POST /support/tickets` — Create ticket manually
- `POST /support/tickets/{id}/messages` — Add message to ticket
- `POST /support/tickets/{id}/resolve` — Resolve ticket (admin)

**`api/v1/knowledge.py`** — Knowledge Base
- `GET /knowledge/articles` — List/search articles
- `GET /knowledge/articles/{slug}` — Get single article
- `POST /knowledge/articles/{id}/feedback` — Submit helpful/not helpful

**`api/v1/proactive.py`** — Proactive Interventions (internal/worker)
- `POST /proactive/check-rewatch` — Check video rewatch pattern
- `POST /proactive/check-stall` — Check learning stall
- `POST /proactive/trigger` — Trigger intervention for user

**Admin endpoints:**
- `GET /admin/support/tickets` — List all tickets với filters
- `POST /admin/support/tickets/{id}/assign` — Assign ticket
- `POST /admin/support/tickets/{id}/status` — Update status
- `GET /admin/support/stats` — Support metrics (tickets by category, resolution time, satisfaction)
- `POST /admin/knowledge/articles` — Create article
- `PUT /admin/knowledge/articles/{id}` — Update article
- `DELETE /admin/knowledge/articles/{id}` — Delete article

### 4.4 Frontend Components mới

**`components/support/SupportChatWidget.tsx`**
- Floating chat button ở góc màn hình
- Expandable chat panel
- Message history (persisted in localStorage + backend)
- Typing indicator, streaming response
- "Create ticket" button khi AI không giải quyết được
- Quick replies: "I need help with billing", "Technical issue", "Something else"

**`components/support/HelpOverlay.tsx`**
- Contextual tooltip system
- Onboarding tour (first-time user)
- Feature discovery tips
- Integration với behavior events

**`components/support/TicketDashboard.tsx`** (User view)
- List tickets với status badges
- Ticket detail với message thread
- "New ticket" form
- Satisfaction rating after resolution

**`components/admin/SupportDashboard.tsx`** (Admin view)
- Ticket list với filters (category, status, priority, assigned_to)
- Ticket detail panel
- Quick reply form
- Stats: tickets by category, avg resolution time, satisfaction score
- Knowledge base management

**`app/(public)/help/page.tsx`** — Knowledge Base
- Search bar (full-text)
- Category filters
- Article cards với helpful/not helpful feedback
- Related articles

---

## 5. Cách triển khai

### Phase 1: Foundation (Tuần 1-2)
1. Tạo collections: `support_tickets`, `ticket_messages`, `help_articles`
2. Tạo `services/support_tickets.py` — CRUD cơ bản
3. Tạo `api/v1/support.py` — Endpoints tickets
4. Tạo frontend: TicketDashboard, basic chat UI
5. Seed knowledge base với FAQs hiện tại

### Phase 2: AI Support (Tuần 3-4)
1. Tạo `services/support_ai.py` — RAG search + LLM integration
2. Vector hóa help_articles (dùng OpenAI embeddings hoặc sentence-transformers)
3. Tạo `api/v1/support.py` — Chat endpoint với streaming
4. Tạo `SupportChatWidget` component
5. Tích hợp chat widget vào layout

### Phase 3: Proactive Support (Tuần 5-6)
1. Tạo `services/proactive_support.py` — Behavior detection
2. Thêm event tracking: `video_rewatch`, `checkout_drop`, `learning_stall`, `quiz_low_score`
3. Tạo worker job chạy mỗi 15 phút để check patterns
4. Tạo `HelpOverlay` component
5. Implement notifications (in-app + email)

### Phase 4: Admin & Analytics (Tuần 7-8)
1. Tạo Admin Support Dashboard
2. Implement auto-classification + routing
3. Tạo Knowledge Base management UI
4. Add analytics: tickets by category, resolution time, satisfaction
5. SLA tracking + email notifications

---

## 6. Tác động

| Mặt | Tác động |
|---|---|
| **Churn reduction** | Giảm 15-25% churn do hỗ trợ kém — user được giải quyết vấn đề ngay lập tức |
| **Support cost** | Giảm 40-60% chi phí support — AI xử lý 70-80% câu hỏi thường gặp |
| **User satisfaction** | CSAT tăng 20-30% — help available 24/7, không cần chờ email |
| **Product improvement** | Phát hiện pain points qua ticket categories → cải thiện UX |
| **Retention** | Proactive help giữ user tiếp tục học khi gặp khó khăn |

---

## 7. File thay đổi (dự kiến)

### Backend
- `apps/api/app/services/support_ai.py` — NEW
- `apps/api/app/services/support_tickets.py` — NEW
- `apps/api/app/services/proactive_support.py` — NEW
- `apps/api/app/services/knowledge_base.py` — NEW
- `apps/api/app/api/v1/support.py` — NEW
- `apps/api/app/api/v1/knowledge.py` — NEW
- `apps/api/app/api/v1/proactive.py` — NEW
- `apps/api/app/api/v1/admin.py` — ADD support admin endpoints
- `apps/api/app/core/tasks.py` — ADD proactive support cron job
- `apps/api/app/db/indexes.py` — ADD indexes for new collections

### Frontend
- `apps/web/components/support/SupportChatWidget.tsx` — NEW
- `apps/web/components/support/HelpOverlay.tsx` — NEW
- `apps/web/components/support/TicketDashboard.tsx` — NEW
- `apps/web/components/admin/SupportDashboard.tsx` — NEW
- `apps/web/app/(public)/help/page.tsx` — NEW
- `apps/web/app/(app)/support/tickets/page.tsx` — NEW
- `apps/web/app/layout.tsx` — ADD chat widget
- `apps/web/lib/api-client.ts` — ADD support API methods
- `apps/web/types/index.ts` — ADD support types

### Database
- Collections: `support_tickets`, `ticket_messages`, `help_articles` (mới)

---

## 8. Tại sao đây là cải tiến LỚN

1. **Không phải biến đơn lẻ**: Thay đổi toàn bộ trải nghiệm hỗ trợ từ thụ động → chủ động, từ thủ công → tự động hóa
2. **Tác động cross-functional**: Liên quan đến backend, frontend, database, AI/ML, email, notifications
3. **ROI rõ ràng**: Giảm churn + giảm support cost + tăng satisfaction
4. **Không phải MVP feature**: Đây là feature nâng cao sau khi nền tảng đã ổn
5. **Không cần kiến trúc lại**: Tất cả additions trên nền tảng hiện có (FastAPI + MongoDB + Redis + LLM)

---

## 9. So sánh với các cải tiến khác

| Cải tiến | Tác động | Công sức | Độ phức tạp |
|---|---|---|---|
| PWA Offline | Trung bình | Trung bình | Medium |
| Learning Paths | Cao | Trung bình | Medium |
| AI Tutor (per lesson) | Cao | Trung bình | Medium |
| **Intelligent Support System** | **Rất cao** | **Cao (6-8 tuần)** | **High** |
| B2B Team Plans | Rất cao | Rất cao | Very High |

Hệ thống hỗ trợ thông minh này là **cải tiến lớn nhất có thể làm trong phạm vi tính năng hỗ trợ người dùng** vì nó:
- Thay thế hoàn toàn hệ thống hỗ trợ thủ công hiện tại
- Tích hợp AI vào toàn bộ luồng hỗ trợ
- Thêm proactive intervention mà chưa có platform nào trong ngành học online Việt Nam có
- Có thể scale với user growth mà không cần tăng nhân sự support

---

Bạn muốn tôi bắt đầu triển khai từ **Phase nào** trước? Tôi đề xuất bắt đầu từ **Phase 1 (Foundation)** — tạo collections, ticket CRUD, và knowledge base cơ bản trước, sau đó mới thêm AI và proactive features.