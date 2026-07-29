# Kế Hoạch Triển Khai: Adaptive Learning Engine

> **Mục tiêu:** Học viên học lập trình tốt hơn, nhanh hơn, và bỏ ít hơn thông qua học tập cá nhân hóa ở cấp độ concept.
>
> **Thời gian dự kiến:** 6-8 tuần (4 phases)
>
> **Phạm vi:** Bắt đầu từ 2-3 khóa học mẫu, có thể mở rộng sau.

---

## Tổng quan kiến trúc

```
Frontend (Next.js) ──► Backend (FastAPI) ──► MongoDB
                         │
                         └──► LLM (Groq/OpenRouter) ──► AI-generated remedial content
```

---

## Giới hạn rõ ràng

- **Chỉ tập trung vào Adaptive Learning Engine**, không mở rộng ra support system hay learning paths hiện có.
- **Leverage 100% infrastructure hiện có:** `call_llm`, progress tracking, knowledge base, caching.
- **Không phụ thuộc external services mới** trong Phase 1-3.
- **Minimum viable scope:** đủ để demo được adaptive quiz + mastery tracking + basic remediation.

---

## Giai đoạn 1: Foundation (Tuần 1-2)

### Mục tiêu
Có data model + backend CRUD + basic adaptive quiz API + seeded concepts. Không cần UI đẹp, chỉ cần API hoạt động.

### Files mới / thay đổi

| File | Hành động | Mô tả |
|---|---|---|
| `apps/api/app/services/concept_mastery.py` | **NEW** | Core mastery service: get/create/update mastery scores |
| `apps/api/app/services/adaptive_quiz.py` | **NEW** | Adaptive quiz generation + grading |
| `apps/api/app/services/remediation.py` | **NEW** | Basic remediation: detect weak concepts, generate suggestions |
| `apps/api/app/api/v1/adaptive.py` | **NEW** | User-facing API endpoints |
| `apps/api/app/api/v1/admin_adaptive.py` | **NEW** | Admin endpoints |
| `apps/api/app/db/seed_concepts.py` | **NEW** | Seed 2-3 khóa học mẫu với concepts |
| `apps/api/app/db/indexes.py` | **EDIT** | Add indexes cho 3 collections mới |
| `apps/api/app/main.py` | **EDIT** | Register 2 router mới |

### Models / Collections

#### `concept_definitions`
```javascript
{
  _id: "conc-py-001",           // format: conc-{course_slug}-{3digit_seq}
  course_id: "course-python-data",
  name: "List Comprehensions",
  slug: "list-comprehensions",
  description: "Creating lists using a single line expression",
  difficulty_base: 4,           // 1-10
  tags: ["python", "lists"],
  lesson_ids: ["pyd-2", "pyd-3"],
  prerequisite_concepts: [],
  is_active: true,
  created_at: "...",
  updated_at: "..."
}
```

#### `concept_mastery`
```javascript
{
  _id: "mast-user-xxx-conc-py-001",  // hoặc dùng natural key: {user_id, concept_id}
  user_id: "user-xxx",
  course_id: "course-python-data",
  concept_id: "conc-py-001",
  mastery_score: 5.0,           // 0.0 - 10.0, default 5.0
  attempts: 0,
  correct_attempts: 0,
  last_practiced_at: null,
  created_at: "...",
  updated_at: "..."
}
```

#### `quiz_attempts` (mở rộng schema hiện có hoặc tạo mới)
```javascript
{
  _id: "qa-xxx",
  user_id: "user-xxx",
  course_id: "course-python-data",
  lesson_id: "pyd-2",
  concept_ids: ["conc-py-001"],
  mode: "adaptive" | "standard",
  questions: [...],
  score: 7,
  total_questions: 10,
  mastery_before: 3.5,
  mastery_after: 4.5,
  created_at: "..."
}
```

### API Endpoints (Phase 1)

**`/api/v1/adaptive`** — User routes

| Method | Path | Description |
|---|---|---|
| `GET` | `/adaptive/concepts/{course_id}` | List all concepts + user mastery for course |
| `POST` | `/adaptive/quiz/{course_id}/generate` | Generate adaptive quiz (basic: 5 câu theo lesson concepts) |
| `POST` | `/adaptive/quiz/{course_id}/submit` | Submit quiz → update mastery |

**`/api/v1/admin/adaptive`** — Admin routes

| Method | Path | Description |
|---|---|---|
| `POST` | `/admin/adaptive/concepts` | Create concept definition |
| `POST` | `/admin/adaptive/concepts/bulk` | Bulk import concepts cho course |
| `GET` | `/admin/adaptive/concepts` | List all concepts |
| `PUT` | `/admin/adaptive/concepts/{id}` | Update concept |
| `DELETE` | `/admin/adaptive/concepts/{id}` | Delete concept |
| `GET` | `/admin/adaptive/stats/{course_id}` | Concept stats |

### Seed data

Seed concepts cho **3 khóa học mẫu** (~15-20 concepts total):

1. **`course-python-data`** — Python for Data Analytics
   - Variables & Data Types
   - Functions & Scope
   - List Comprehensions
   - Pandas DataFrames
   - Data Cleaning
   - Data Visualization

2. **`course-js`** — JavaScript Fundamentals
   - Variables & Types
   - Functions & Scope
   - Closures
   - Promises & Async/Await
   - DOM Manipulation
   - Error Handling

3. **`course-sql`** — SQL for Data Analysis
   - SELECT & FROM
   - WHERE & Filtering
   - JOINs
   - Aggregations
   - Subqueries

Mỗi concept có:
- `difficulty_base`: 1-10
- `lesson_ids`: liên kết đến lessons
- `tags`: để tìm liên quan
- `prerequisite_concepts`: rỗng ban đầu, có thể edit sau

**Không seed question bank trong Phase 1.** Quiz sẽ generate on-the-fly bằng LLM (tận dụng `call_llm` hiện có).

### Service details

#### `concept_mastery.py`

```python
async def get_or_create_mastery(user_id, course_id, concept_id) -> dict
async def get_course_mastery_map(user_id, course_id) -> dict[str, float]  # concept_id -> score
async def update_mastery(user_id, course_id, concept_id, correct, difficulty, time_seconds) -> dict
async def get_weak_concepts(user_id, course_id, threshold=3.0) -> list[dict]
async def get_strong_concepts(user_id, course_id, threshold=7.0) -> list[dict]
```

**Mastery update algorithm (Phase 1 — simple moving average):**
```python
def _update_score(current, attempts, correct, difficulty, time_seconds):
    # Phase 1: simple win-rate based, difficulty-weighted
    correct_weight = 1.0 + (difficulty / 10.0)  # harder question = more points
    if correct:
        delta = correct_weight * 0.5
    else:
        delta = -0.3
    new = current + delta / max(attempts, 1)
    return round(max(0.0, min(10.0, new)), 2)
```

#### `adaptive_quiz.py`

```python
async def generate_adaptive_quiz(user_id, course_id, lesson_id, num_questions=5) -> dict
async def grade_quiz(user_id, quiz_attempt_id, answers) -> dict
```

**`generate_adaptive_quiz` logic (Phase 1):**
1. Get concepts for lesson
2. Get mastery map
3. Select top `num_questions` concepts — prioritize weak concepts first
4. For each concept, call LLM to generate a question (reuse `code_assistant` pattern)
5. Return quiz with questions

**LLM prompt for question generation:**
```
Generate a {difficulty}/10 difficulty quiz question about "{concept_name}" for course "{course_title}".
Concept description: {concept_description}
Return JSON: {"question": "...", "options": ["A", "B", "C", "D"], "correct": 0, "explanation": "..."}
```

#### `remediation.py` (Phase 1 — basic)

```python
async def detect_gaps(user_id, course_id) -> list[dict]
async def get_remediation_suggestions(user_id, course_id) -> list[dict]
```

Phase 1: chỉ trả về weak concepts + link đến lessons liên quan. Không AI-generate content.

### Frontend (Phase 1 — minimal)

Không cần UI phức tạp. Đủ để test API:

1. **`app/(app)/learn/[course]/adaptive-test/page.tsx`**
   - Simple quiz page gọi `POST /adaptive/quiz/{course_id}/generate`
   - Hiển thị câu hỏi + options
   - Submit → gọi `POST /adaptive/quiz/{course_id}/submit`
   - Hiển thị score + mastery change

2. **`app/(app)/learn/[course]/mastery/page.tsx`** (optional)
   - Simple list: concept name + mastery score bar
   - "Weak concepts" section

3. **`lib/adaptive-client.ts`** — API client methods

4. **`types/index.ts`** — Add types: `ConceptDefinition`, `ConceptMastery`, `QuizAttempt`

---

## Giai đoạn 2: Mastery Engine (Tuần 3-4)

### Mục tiêu
Implement Elo-based mastery algorithm, prerequisite checking, gap detection hoạt động thực sự.

### Thay đổi chính

#### 1. Elo-based mastery update

**File:** `apps/api/app/services/concept_mastery.py` — nâng cấp `update_mastery`

```python
def _update_mastery_elo(current_score, attempts, correct, difficulty, time_seconds):
    """
    ELO-inspired mastery update.
    - expected = probability user answers correctly given difficulty vs current mastery
    - k-factor decreases as user practices more (stabilizes over time)
    - faster answers = slightly higher score reward
    """
    expected = 1.0 / (1.0 + 10 ** ((difficulty - current_score) / 400))
    k = 32.0 / (1.0 + max(attempts, 1) / 10.0)  # 32 -> ~10 as attempts grow

    # Time bonus: faster = more confident
    time_factor = 1.0
    if time_seconds and time_seconds < 5:
        time_factor = 1.2  # almost instant = high confidence
    elif time_seconds and time_seconds > 60:
        time_factor = 0.8  # very slow = less confident

    actual = 1.0 if correct else 0.0
    delta = k * time_factor * (actual - expected)

    new_score = current + delta
    return round(max(0.0, min(10.0, new_score)), 2)
```

#### 2. Prerequisite checking

**File:** `apps/api/app/services/concept_mastery.py` — thêm

```python
async def get_ready_concepts(user_id, course_id) -> list[str]:
    """Return concepts whose prerequisites are all mastered (>= 6.0)."""
    mastery_map = await get_course_mastery_map(user_id, course_id)
    all_concepts = await get_all_concepts_for_course(course_id)
    ready = []
    for c in all_concepts:
        prereqs = c.get("prerequisite_concepts", [])
        if all(mastery_map.get(p, 0) >= 6.0 for p in prereqs):
            ready.append(c["_id"])
    return ready
```

#### 3. API updates

- `GET /adaptive/weak/{course_id}` — concepts với mastery < 3.0
- `GET /adaptive/strong/{course_id}` — concepts với mastery >= 7.0
- `GET /adaptive/prerequisites/{course_id}/{concept_id}` — list prerequisites + mastery status
- `POST /adaptive/skip/{course_id}/{lesson_id}` — optional pre-test để skip lesson

#### 4. Frontend updates

- **Mastery Radar Chart** — `components/adaptive/MasteryRadar.tsx`
  - Dùng simple SVG/CSS radar chart (không cần thư viện nặng)
  - Màu: đỏ (mastery < 3), vàng (3-6), xanh (> 6)
  - Click concept → xem chi tiết + đề xuất bổ trợ

- **Adaptive Quiz improvements:**
  - Show mastery level per question
  - Show progress: "Question 2/5 — You're doing well on this topic"
  - Post-quiz breakdown: từng concept điểm bao nhiêu

---

## Giai đoạn 3: Remediation Engine (Tuần 5-6)

### Mục tiêu
Khi user yếu concept nào, hệ thống tự động gợi ý/ sinh nội dung bổ trợ.

### Thay đổi chính

#### 1. AI-generated remedial content

**File mới:** `apps/api/app/services/remediation.py`

```python
async def generate_remedial_content(user_id, course_id, concept_id) -> dict:
    """
    1. Lấy concept definition
    2. Lấy existing lesson segments liên quan
    3. Gọi LLM để generate:
       - remedial_explanation: giải thích lại bằng từ đơn giản hơn
       - micro_exercise: bài tập 2-3 câu nhỏ
       - analogies: liên hệ thực tế
    """
```

**LLM prompt:**
```
You are an expert tutor. A student is struggling with "{concept_name}" in the course "{course_title}".
Concept: {concept_description}
Previous lesson content: {lesson_excerpt}

Generate 3 things:
1. A 2-3 sentence simplified explanation of this concept
2. A micro-exercise with 2-3 multiple-choice questions testing this concept
3. 1-2 real-world analogies to help understanding

Return as JSON:
{
  "explanation": "...",
  "exercise": {"questions": [...]},
  "analogies": ["...", "..."]
}
```

Cache kết quả trong Redis (`remediation:{user_id}:{concept_id}`) với TTL 1 giờ để tránh gọi LLM lặp lại.

#### 2. Remedial Panel (frontend)

**File:** `components/adaptive/RemedialPanel.tsx`

- Trigger: sau khi user hoàn thành lesson/quiz và có concept yếu
- Hiển thị:
  - "You struggled with: {concept_name}"
  - 3 gợi ý: [Review this lesson] [Try micro-exercise] [Ask AI Tutor]
  - Nút "Skip for now"
- Auto-expand nếu mastery < 2.0 (very weak)

#### 3. Proactive intervention

Sử dụng `proactive_support.py` hiện có hoặc thêm vào adaptive:
- Nếu mastery < 2.0 sau 2 lần làm → trong HelpOverlay hiển thị tip
- Hoặc thêm `user_behavior_events` event_type: `concept_struggling`

#### 4. AI Tutor integration

Khi user mở AI Tutor trong lesson, inject weak concepts vào context:
```python
weak_concepts = await get_weak_concepts(user_id, course_id)
context = f"Student is struggling with: {', '.join(weak_concepts)}. Please explain related concepts with extra care."
```

---

## Giai đoạn 4: Dynamic Sequencing (Tuần 7-8)

### Mục tiêu
Cho phép skip lessons đã biết, động thay đổi thứ tự lessons, admin dashboard.

### Thay đổi chính

#### 1. Skipping mechanism

**Endpoint:** `POST /adaptive/skip/{course_id}/{lesson_id}`

Logic:
1. Kiểm tra user đã mastery cao (>= 7.0) ở tất cả concepts của lesson đó
2. Hoặc cho làm pre-test: nếu đúng >= 80% câu trong lesson concepts → skip
3. Đánh dấu `progress.skipped = true` hoặc `progress.mastery_skip = true`
4. Ẩn lesson đó khỏi user's lesson list trong course player

#### 2. Dynamic rerouting trong course

Khi user vào course, thay vì hiển thị syllabus cố định:
- Lấy mastery map
- Rerank lessons: ưu tiên lessons có weak concepts trước
- Insert "remedial lessons" vào đúng vị trí (giữa lesson A và B nếu B cần prerequisite từ A mà A chưa master)

**Logic `GET /adaptive/course/{course_id}/recommended-sequence`**:
```
1. Get all concepts, mastery map
2. Get syllabus order
3. For each lesson:
   a. Check prerequisites: nếu prerequisite concept mastery < 4.0 → insert remedial before
   b. If all concepts mastery >= 7.0 → mark as "ready to skip"
   c. Else keep in sequence
4. Return reordered lesson list with flags: "skip", "remedial", "normal"
```

#### 3. Admin dashboard

**File:** `apps/web/app/admin/adaptive-mastery/page.tsx`

#### 4. Analytics

- Course completion rate theo adaptive vs non-adaptive (A/B test)
- Mastery distribution theo concept
- Remediation effectiveness rate
- Time saved by skipping

---

## Checklist triển khai chi tiết

### Tuần 1

- [ ] Tạo `apps/api/app/services/concept_mastery.py` — CRUD mastery
- [ ] Tạo `apps/api/app/services/adaptive_quiz.py` — generate + grade quiz (basic)
- [ ] Tạo `apps/api/app/services/remediation.py` — detect_gaps (basic)
- [ ] Tạo `apps/api/app/api/v1/adaptive.py` — user endpoints
- [ ] Tạo `apps/api/app/api/v1/admin_adaptive.py` — admin endpoints
- [ ] Tạo `apps/api/app/db/seed_concepts.py` — seed 3 courses
- [ ] Add indexes vào `apps/api/app/db/indexes.py`
- [ ] Register routers trong `main.py`
- [ ] Verify: `POST /admin/adaptive/concepts/bulk` works
- [ ] Verify: `GET /adaptive/concepts/{course_id}` returns seeded concepts
- [ ] Verify: `POST /adaptive/quiz/{course_id}/generate` generates 5 questions

### Tuần 2

- [ ] Seed concepts cho 2-3 khóa học (chạy trong lifespan)
- [ ] Verify quiz generation quality (LLM prompts)
- [ ] Create `apps/web/lib/adaptive-client.ts`
- [ ] Create `app/(app)/learn/[course]/adaptive-test/page.tsx`
- [ ] Create `components/adaptive/AdaptiveQuiz.tsx`
- [ ] Basic mastery view: `app/(app)/learn/[course]/mastery/page.tsx`
- [ ] End-to-end test: user xem concepts → làm quiz → mastery update
- [ ] Write 20-30 seed questions để LLM không phải generate mọi lần (optional)

### Tuần 3

- [ ] Implement Elo-based mastery update algorithm
- [ ] Add prerequisite checking service
- [ ] Add `GET /adaptive/weak/{course_id}`
- [ ] Add `GET /adaptive/strong/{course_id}`
- [ ] Add `GET /adaptive/prerequisites/{course_id}/{concept_id}`
- [ ] Update `components/adaptive/MasteryRadar.tsx` — SVG radar chart
- [ ] Post-quiz mastery breakdown UI
- [ ] A/B test: split 10% users vào adaptive mode

### Tuần 4

- [ ] Add time_factor vào mastery algorithm
- [ ] Add trend tracking (improving/declining/stable)
- [ ] Improve adaptive quiz question selection (prioritize weak + respect prerequisites)
- [ ] Seed prerequisite_concepts cho tất cả concepts
- [ ] Add caching cho mastery queries (Redis)
- [ ] Add meta info vào `adaptive-client.ts` types
- [ ] Testing: 20 câu quiz → mastery updates đúng logic

### Tuần 5

- [ ] Implement `generate_remedial_content()` với LLM
- [ ] Add Redis caching cho remedial content (TTL 1h)
- [ ] Tạo `components/adaptive/RemedialPanel.tsx`
- [ ] Trigger remedial panel sau quiz có weak concepts
- [ ] Integrate với HelpOverlay: proactive tip khi concept yếu
- [ ] Integrate với AI Tutor: pass weak concepts context

### Tuần 6

- [ ] Refine LLM prompts cho remedial content quality
- [ ] Add "Remedial Lesson" type vào course content structure
- [ ] Add `GET /adaptive/remediation/{course_id}`
- [ ] Testing: generate + cache + display remedial content
- [ ] Measure: remediation effectiveness (% cải thiện mastery sau remedial)

### Tuần 7

- [ ] Implement `POST /adaptive/skip/{course_id}/{lesson_id}` + pre-test logic
- [ ] Implement `GET /adaptive/course/{course_id}/recommended-sequence`
- [ ] Update course player: ẩn lessons đã skip, hiển thị recommended sequence
- [ ] Insert remedial lessons vào sequence tự động

### Tuần 8

- [ ] Build admin dashboard: `apps/web/app/admin/adaptive-mastery/page.tsx`
  - Heatmap mastery theo course + concept
  - Concept difficulty calibration
  - Remediation queue
- [ ] Add analytics endpoints:
  - `GET /admin/adaptive/stats/{course_id}`
  - `GET /admin/adaptive/effectiveness`
- [ ] End-to-end integration testing
- [ ] Documentation
- [ ] Deploy to staging

---

## Dependencies & Conflicts

### Không có dependency xung đột

| Giai đoạn | Phụ thuộc | File overlap risk |
|---|---|---|
| Phase 1 | Không phụ thuộc giai đoạn nào trước | `services/concept_mastery.py`, `services/adaptive_quiz.py`, `services/remediation.py`, `api/v1/adaptive.py`, `api/v1/admin_adaptive.py` — **tất cả mới, không đụng file hiện có** |
| Phase 2 | Phase 1 (services/adaptive_quiz.py, services/remediation.py, api/v1/adaptive.py) | Chỉ modify `concept_mastery.py` và `api/v1/adaptive.py` — **cùng batch, không xung đột với phase khác** |
| Phase 3 | Phase 2 (remediation.py, adaptive.py) | Modify `remediation.py` và thêm `components/adaptive/RemedialPanel.tsx` — **không đụng** |
| Phase 4 | Phase 3 (adaptive.py, course player) | Modify `api/v1/adaptive.py` + course player pages — **có thể conflict nếu course player đang được edit** |

**Đề xuất:** Nếu có người khác đang edit course player, Phase 4 sẽ làm **branch riêng** hoặc đợi course player refactor xong.

### Dependencies nội bộ

```
Phase 1 ──────────────────────────────────────────────────────────┐
Phase 2 ──────────────────────────────────────────┐               │
Phase 3 ────────────────────────┐               │               │
Phase 4 ────────┐              │               │               │
              ▼              ▼               ▼               ▼
         concept_mastery  adaptive_quiz   remediation   adaptive.py (expand)
              │              │               │
              └──────────────┴──────────────┘
                         ▼
                   adaptive-client.ts
                         │
                   AdaptiveQuiz.tsx
                         │
                   MasteryRadar.tsx
                         │
                   RemedialPanel.tsx
```

---

## Rollout Strategy

### 1. Feature flag

Thêm setting trong `core/config.py`:
```python
adaptive_learning_enabled: bool = False  # default off
```

Khi `False`: tất cả requests đến `/api/v1/adaptive` trả về 404 hoặc pass-through.

### 2. Canary release

- **Tuần 1-4:** Chỉ active cho internal users (admin, test accounts)
- **Tuần 5:** Enable cho 10% users
- **Tuần 6:** Enable cho 50% users
- **Tuần 8:** 100% rollout

### 3. Backward compatibility

- Không thay đổi schema của `progress`, `courses`, `syllabus` hiện có
- Tất cả collections mới (`concept_definitions`, `concept_mastery`, `quiz_attempts` mở rộng)
- Course player cũ và mới chạy song song nếu cần

---

## Testing Strategy

### Backend tests

```bash
# Unit tests
pytest apps/api/tests/services/test_concept_mastery.py -v
pytest apps/api/tests/services/test_adaptive_quiz.py -v
pytest apps/api/tests/services/test_remediation.py -v

# API integration tests
pytest apps/api/tests/api/test_adaptive_endpoints.py -v
```

### Frontend tests

```bash
# Component tests
npm test -- --testPathPattern="components/adaptive|app/.*adaptive"

# Visual regression (optional)
npm run test:e2e -- --grep "adaptive"
```

### Manual QA flow

1. Admin: Tạo concepts cho course
2. User: Xem mastery map → tất cả concepts = 5.0 (default)
3. User: Làm adaptive quiz → mastery updates
4. User: Xem weak concepts → click "Try micro-exercise"
5. User: Skip lesson đã master
6. Admin: Xem mastery heatmap

---

## Metrics theo dõi

| Metric | Cách đo | Mục tiêu |
|---|---|---|
| **Course completion rate** | % user hoàn thành course (adaptive vs control) | +25% |
| **Quiz pass rate (1st try)** | % user passed quiz lần đầu | +20% |
| **Mastery Δ per session** | average mastery tăng sau 1 học session | +0.5 |
| **Remediation completion rate** | % user làm remedial khi được gợi ý | > 40% |
| **Skip rate** | % lessons được skip do mastery cao | 10-15% |
| **Time-to-complete** | avg thời gian hoàn thành course | -15% |

---

## Rủi ro & Giảm thiểu

| Rủi ro | Giải pháp |
|---|---|
| **LLM generate câu hỏi kém chất lượng** | Seed 20-30 câu hỏi mẫu; fallback về LLM chỉ khi thiếu |
| **Mastery score không chính xác** | Bắt đầu simple, refine dần; A/B test để validate |
| **User bối rối khi bị skip lesson** | Luôn có "Show all lessons" button; skip chỉ voluntary |
| **Performance: master query chậm** | Index `(user_id, course_id)`; cache mastery map trong Redis |
| **Cold start: user mới không có data** | Default mastery = 5.0; adaptive nhảy vào sau 2-3 câu đầu |

---

## Notes cho implementation

### Pattern tuân theo

- **Services:** `async def` functions, dùng `get_db()` / `get_read_db()`
- **Routes:** `router = APIRouter()`, `admin_router = APIRouter()` pattern
- **Models:** Pydantic BaseModel cho request/response
- **Response:** `api_response(data)` format
- **Frontend client:** `lib/api-client.ts` pattern `typedRequest("POST", "POST /path" as any, { body })`
- **Types:** `types/index.ts` — add interfaces tại đây

### LLM usage

Tận dụng `app.services.llm.call_llm` + `is_llm_available`:
- `adaptive_quiz.py`: generate quiz questions on-the-fly
- `remediation.py`: generate explanations + exercises
- **Không cần model/config mới**

### Caching

Redis usage pattern:
```python
from app.db.mongodb import get_redis
r = get_redis()
if r:
    cached = await r.get(f"adaptive:mastery:{user_id}:{course_id}")
    if cached:
        return json.loads(cached)
# ... compute
if r:
    await r.setex(f"adaptive:mastery:{user_id}:{course_id}", 300, json.dumps(result))
```

---

## File changes summary

### Phase 1
- **NEW:** `services/concept_mastery.py`
- **NEW:** `services/adaptive_quiz.py`
- **NEW:** `services/remediation.py`
- **NEW:** `api/v1/adaptive.py`
- **NEW:** `api/v1/admin_adaptive.py`
- **NEW:** `db/seed_concepts.py`
- **EDIT:** `db/indexes.py` (+ indexes)
- **EDIT:** `main.py` (+ routers)

### Phase 2
- **EDIT:** `services/concept_mastery.py` (Elo algorithm)
- **EDIT:** `services/adaptive_quiz.py` (improved selection)
- **EDIT:** `api/v1/adaptive.py` (+ endpoints)
- **NEW:** `web/components/adaptive/MasteryRadar.tsx`
- **NEW:** `web/components/adaptive/ConceptCard.tsx`
- **NEW:** `web/app/(app)/learn/[course]/mastery/page.tsx`

### Phase 3
- **EDIT:** `services/remediation.py` (+ AI generation)
- **NEW:** `web/components/adaptive/RemedialPanel.tsx`
- **EDIT:** `web/lib/adaptive-client.ts` (+ methods)
- **EDIT:** `web/types/index.ts` (+ types)

### Phase 4
- **EDIT:** `api/v1/adaptive.py` (+ skip + sequence endpoints)
- **NEW:** `web/app/admin/adaptive-mastery/page.tsx`
- **EDIT:** Course player pages (integrate adaptive sequence)
