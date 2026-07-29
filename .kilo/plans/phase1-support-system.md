# Phase 1: Foundation — Support Ticket System + Knowledge Base

## Goal
Build the core infrastructure for the Intelligent User Support System:
- `support_tickets` + `ticket_messages` collections with full ticket lifecycle
- `help_articles` collection (searchable knowledge base)
- REST API for tickets, messages, and help articles
- User-facing pages: support tickets list/detail, help center
- Admin-facing support dashboard (reuse existing admin layout)
- Keep existing `/contact` endpoint intact for backward compatibility

## Scope

### Keep Unchanged
- `apps/api/app/api/v1/contact.py` — preserve for backward compat; admin list still works
- `apps/web/app/admin/layout.tsx` sidebar order stays same; new "Support" link appended

### New Files
```
apps/api/app/services/support_tickets.py
apps/api/app/services/knowledge_base.py
apps/api/app/api/v1/support.py
apps/api/app/api/v1/knowledge.py
apps/web/app/(app)/support/tickets/page.tsx
apps/web/app/(app)/support/tickets/[id]/page.tsx
apps/web/app/(public)/help/page.tsx
apps/web/app/admin/support/page.tsx
apps/web/components/support/TicketDashboard.tsx
apps/web/components/support/TicketDetail.tsx
apps/web/components/support/TicketList.tsx
apps/web/components/support/NewTicketForm.tsx
apps/web/components/support/HelpCenter.tsx
apps/web/components/support/HelpArticleCard.tsx
apps/web/components/admin/SupportAdminDashboard.tsx
```

### Modified Files
```
apps/api/app/db/indexes.py                  # add indexes for 3 new collections
apps/api/app/main.py                        # register new routers
apps/api/app/db/mongodb.py                  # seed help articles in seed_db()
apps/web/app/admin/layout.tsx               # append "Support" nav link
apps/web/lib/api-client.ts                  # add support API methods
apps/web/types/index.ts                     # add support types
```

## Data Models

```python
# support_tickets
{
  "_id": "tkt-<user_id>-<timestamp_ms>",
  "user_id": "user-xxx",          # linked to authenticated user
  "user_email": "user@example.com",
  "user_name": "Nguyen Van A",
  "category": "billing|technical|content|account|other",
  "priority": "P1|P2|P3",         # auto-assigned initially P3
  "subject": "Can't access my course",
  "status": "open|in_progress|waiting_user|resolved|closed",
  "ai_summary": "",               # optional AI-generated summary (Phase 2)
  "created_at": "2026-07-29T...",
  "updated_at": "2026-07-29T...",
  "resolved_at": None | "...",
  "assigned_to": None | "admin-xxx",
  "satisfaction_rating": None | 1-5,
}

# ticket_messages
{
  "_id": "tmsg-<ticket_id>-<timestamp_ms>",
  "ticket_id": "tkt-xxx",
  "sender_type": "user|admin|ai",
  "sender_id": "user-xxx" | "admin-xxx" | "system",
  "sender_name": "Nguyen Van A" | "Admin",
  "content": "I can't access...",
  "created_at": "2026-07-29T...",
}

# help_articles
{
  "_id": "article-<slug>",
  "slug": "how-to-cancel-subscription",
  "title": "How to Cancel Your Subscription",
  "category": "billing|technical|content|account|general",
  "content": "Full article content...",
  "summary": "Short summary for search results (50-150 words)",
  "tags": ["cancel", "subscription", "billing"],
  "is_published": True,
  "views": 1234,
  "helpful_count": 120,
  "not_helpful_count": 5,
  "created_at": "...",
  "updated_at": "...",
}
```

## Status Transitions

```
open → in_progress → waiting_user → resolved → closed
  ↓          ↓
waiting_user → resolved → closed
  ↓
closed  (any state can be closed)
```

## Priority Auto-Assignment (initial, simple heuristic)
- `P1`: payment_errors + critical keywords ("error 5xx", "crash", "lost access" + billing context)
- `P2`: typical issues
- `P3`: general questions, suggestions

In Phase 2, replace heuristic with LLM-based classification.

## API Endpoints

### User-facing (public auth)
```
GET   /api/v1/support/tickets              # list current user's tickets
GET   /api/v1/support/tickets/{ticket_id}  # detail + messages
POST  /api/v1/support/tickets              # create ticket
POST  /api/v1/support/tickets/{ticket_id}/messages   # add message
POST  /api/v1/support/tickets/{ticket_id}/satisfaction  # rate satisfaction

GET   /api/v1/help/articles                # list/search articles
GET   /api/v1/help/articles/{slug}         # single article
POST  /api/v1/help/articles/{id}/feedback  # helpful/not helpful
```

### Admin
```
GET   /api/v1/admin/support/tickets        # list all tickets with filters
GET   /api/v1/admin/support/tickets/{id}   # detail
POST  /api/v1/admin/support/tickets/{id}/assign  # assign to admin
POST  /api/v1/admin/support/tickets/{id}/status   # update status
GET   /api/v1/admin/support/stats          # stats by category, status, avg resolution
POST  /api/v1/admin/help/articles          # create article
PUT   /api/v1/admin/help/articles/{id}     # update article
DELETE /api/v1/admin/help/articles/{id}    # delete article
```

Note: Reuse existing `require_admin` from `core/deps.py` for admin endpoints.

## Frontend Pages

### `/support/tickets` (authenticated)
- List of user's tickets (status badges, priority indicator, subject, created_at)
- "Create New Ticket" button → modal or inline form
- Click ticket → navigate to `/support/tickets/{id}`

### `/support/tickets/{id}` (authenticated)
- Ticket detail: subject, category, status, priority, created_at
- Message thread (user/admin/ai distinction)
- Input to add new message
- Satisfaction rating (when resolved)

### `/help` (public)
- Search bar
- Category filters
- Article cards (title, summary, category, helpful count)
- "Was this helpful?" buttons → POST /api/v1/help/articles/{id}/feedback

### `/admin/support` (admin)
- Sidebar + SupportAdminDashboard
- Ticket list with filters: category, status, assigned_to, search
- Stats cards: total open, in_progress, avg resolution time, satisfaction score
- Click ticket → detail panel with message thread + status/piority/assign controls
- Knowledge base management tab (article CRUD)

## Database Indexes to Add

```python
"support_tickets": [
  IndexModel([("user_id", ASCENDING), ("created_at", DESCENDING)], name="user_id_1_created_at_-1"),
  IndexModel([("status", ASCENDING), ("priority", ASCENDING), ("created_at", DESCENDING)], name="status_priority_created_at_-1"),
  IndexModel([("assigned_to", ASCENDING)], name="assigned_to_1"),
  IndexModel([("category", ASCENDING)], name="category_1"),
],
"ticket_messages": [
  IndexModel([("ticket_id", ASCENDING), ("created_at", ASCENDING)], name="ticket_id_1_created_at_1"),
],
"help_articles": [
  IndexModel([("is_published", ASCENDING), ("category", ASCENDING)], name="is_published_1_category_1"),
  IndexModel([("slug", ASCENDING)], name="slug_1", unique=True),
  IndexModel([("tags", ASCENDING)], name="tags_1"),
],
```

## Initial Seed Data (help_articles)
Convert existing FAQ content into searchable articles. Also add basic billing and account articles.

## Implementation Order

1. `db/indexes.py` — add new indexes
2. `db/mongodb.py` — extend `seed_db()` with help articles
3. `services/support_tickets.py` — ticket CRUD and message CRUD
4. `services/knowledge_base.py` — article CRUD, search (full-text regex over title/summary/content)
5. `api/v1/support.py` — user ticket endpoints + admin endpoints (or split into admin.py extension)
   *NOTE*: We'll register these under existing `admin.router` in `main.py` rather than creating a new admin router to avoid conflicts. Or create a new `support_admin.py` that requires admin and prefix `/api/v1/admin/support`.
6. `api/v1/knowledge.py` — public help endpoints
7. `admin/support/page.tsx` + components
8. `support/tickets` pages + components
9. `help/page.tsx` + components
10. `types/index.ts` + `api-client.ts`

## Key Decisions

- **ID format**: `tkt-<user_id>-<ms>` for tickets, `tmsg-<ticket_id>-<ms>` for messages. This avoids needing to return and parse MongoDB `_id`.
- **No vector embeddings yet**: Use simple regex full-text search on `title`, `summary`, `content`, `tags`. Phase 2 adds embeddings.
- **Keep contact.py**: The old `/api/v1/contact` keeps its path. It doesn't create tickets automatically; future enhancement can migrate contacts into tickets.
- **No email notifications in Phase 1**: Email service exists but ticket notifications are deferred to Phase 4 to keep foundation stable.
- **Single responsibility**: `support.py` handles user-facing endpoints; `knowledge.py` handles public help endpoints. Admin endpoints live in `admin/support/page.tsx` calling separate admin routes under `/api/v1/admin/support`.
