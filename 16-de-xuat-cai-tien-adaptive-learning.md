# Đề Xuất Cải Tiến Mới: Hệ thống Học tập Thích ứng (Adaptive Learning Engine)

## 1. Tổng quan

Hệ thống học tập hiện tại của Ascendly mang lại nội dung **cố định và giống nhau cho mọi người học**. Tất cả user đi theo cùng một lộ trình khóa học, cùng bài kiểm tra, cùng độ khó — bất kể nền tảng kiến thức hay tiến độ thực tế của họ.

**Đề xuất này** xây dựng một **Adaptive Learning Engine** theo dõi mức độ thành thạo ở cấp độ **concept/knowledge item** (nhỏ hơn bài học), tự động điều chỉnh độ khó, điều phối bài bổ trợ khi phát hiện khoảng kiến thức, và cá nhân hóa lộ trình nội dung **trong** từng khóa học.

Mục tiêu: **Học viên học lập trình tốt hơn, nhanh hơn, và bỏ ít hơn.**

---

## 2. Vấn đề hiện tại

| Thành phần | Trạng thái hiện tại | Hạn chế |
|---|---|---|
| **Learning Paths** | Lộ trình cố định 6 khóa học theo thứ tự cố định | Không phù hợp với người học có nền tảng trước hoặc học chậm |
| **Quiz** | Bài kiểm tra cố định cho mỗi bài học | Không đo lường mức độ thành thạo concept; không điều chỉnh |
| **Video progress** | Theo dõi hoàn thành bài học | Không biết user hiểu được bao nhiêu, chỉ biết "xem chưa" |
| **Code Assistant** | Hỗ trợ chủ động khi gặp khó | Không có hệ thống theo dõi concept nào user đang yếu |
| **Progress** | 80% user dừng học giữa chừng | Không có cơ chế can thiệp cá nhân hóa khi user gặp khó một concept cụ thể |

**Hậu quả:**
- Người học có nền tảng phải học lại kiến thức đã biết → chán nản, bỏ học
- Người học yếu bị bỏ lại → mất tự tin, hủy gói
- Khóa học không thể tự điều chỉnh → giảng viên không biết ai cần hỗ trợ gì
- Tỷ lệ hoàn thành khóa học thấp (ước tính 15-20% hiện tại)

---

## 3. Giải pháp đề xuất

Xây dựng một **Adaptive Learning Engine** gồm 4 thành phần:

### 3.1 Concept Mastery Tracker (Trình theo dõi mức độ thành thạo kiến thức)

Thay vì chỉ đếm "bài học đã xem", hệ thống theo dõi **từng khái niệm/concept** trong khóa học.

**Ví dụ:** Khóa học "Python for Data Analysis" có các concepts:
- Variables & Data Types
- Functions & Scope
- List Comprehensions
- Pandas DataFrame
- Data Visualization

User uống học xong bài 3, làm quiz được 4/10. Adaptive Engine phân tích:
- Sai câu về "List Comprehensions" → mastery score giảm → đề xuất xem lại video segment + bài tập bổ trợ
- Đúng câu về "Pandas DataFrame" → mastery score cao → có thể bỏ qua phần ôn tập

### 3.2 Adaptive Quiz Engine (Motor kiểm tra thích ứng)

Quiz không còn là bộ câu hỏi cố định mà là **adaptive testing**:

1. User làm câu đầu → đúng
2. Câu sau harder (nội dung nâng cao)
3. Sai → câu tiếp theo giảm độ khó
4. Cuối quiz → AI tạo bản cáo cáo chi tiết theo từng concept

**Thuật toán đề xuất:** Elo-based difficulty hoặc IRT (Item Response Theory) đơn giản hóa:
- Mỗi câu có độ khó `difficulty` (1-10)
- Mỗi user có `mastery` (1-10) cho mỗi concept
- Câu sau được chọn dựa trên `difficulty ≈ mastery`

### 3.3 Remediation Engine (Motor bổ trợ)

Khi phát hiện mastery thấp (< 3/10) ở một concept:

1. **Tìm lại** trong chính khóa học các phần liên quan (video segment, transcript, examples)
2. **Tạo bài tập bổ trợ** nhỏ hơn, từng bước bằng AI (quiz 2-3 câu, ví dụ code đơn giản)
3. **Tạo article/tip riêng** giải thích lại concept đó theo cách khác (metadata tags)
4. **Đề xuất AI Tutor** chuyên sâu về concept đó

### 3.4 Dynamic Content Sequencer (Bộ sắp xếp nội dung động)

Trong một khóa học, nếu user đã thành thạo concept A nhưng yếu concept B, hệ thống có thể:
- **Bỏ qua** hoặc **rút gọn** nội dung đã biết (skip + pre-test)
- **Chèn** bài bổ trợ (remedial lesson) vào đúng vị trí trong syllabus
- **Thay đổi** thứ tự các bài học để ưu tiên kiến thức yếu trước
- **Gợi ý** chuyển sang khóa học tiếp theo sớm hơn nếu mastery cao

---

## 4. Kiến trúc hệ thống

```
┌─────────────────────────────────────────────────────────────────────┐
│                         FRONTEND                                    │
│  ┌──────────────────┐  ┌──────────────────┐  ┌─────────────────┐  │
│  │ Mastery Radar    │  │ Adaptive Quiz    │  │ Remedial Panel  │  │
│  │ Chart            │  │ (dynamic Qs)     │  │ (suggested      │  │
│  │                  │  │                  │  │  lessons)       │  │
│  └──────────────────┘  └──────────────────┘  └─────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│                     BACKEND (FastAPI)                               │
│                                                                     │
│  ┌──────────────────┐  ┌──────────────────┐  ┌─────────────────┐  │
│  │ Concept Mastery  │  │ Adaptive Quiz    │  │ Remediation     │  │
│  │ Service          │  │ Engine           │  │ Engine          │  │
│  │                  │  │                  │  │                 │  │
│  │ - concept list   │  │ - IRT selection  │  │ - gap detect    │  │
│  │ - mastery score  │  │ - dynamic diff   │  │ - remedial gen  │  │
│  │ - gap detect     │  │ - post-quiz map  │  │ - content fetch │  │
│  └──────────────────┘  └──────────────────┘  └─────────────────┘  │
│                                                                     │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │              Content Recommendation Service                   │  │
│  │         (existing — reused for adaptive sequencing)           │  │
│  └──────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│                        DATABASE                                     │
│  ┌──────────────┐  ┌──────────────┐  ┌─────────────────────────┐  │
│  │ concept_     │  │ concept_     │  │ quiz_                    │  │
│  │ mastery      │  │ definitions  │  │ attempts                 │  │
│  │              │  │              │  │                          │  │
│  │ - user_id    │  │ - concept_id │  │ - user_id                │  │
│  │ - course_id  │  │ - course_id  │  │ - concept_id             │  │
│  │ - concept_id │  │ - name       │  │ - difficulty             │  │
│  │ - score      │  │ - tags       │  │ - answers                │  │
│  │ - attempts   │  │ - lesson_map │  │ - mastery_after          │  │
│  │ - updated_at │  │ - created_at │  │ - created_at             │  │
│  └──────────────┘  └──────────────┘  └─────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 5. Collections mới

### `concept_definitions`

Quản lý taxonomy của kiến thức trong mỗi khóa học.

```javascript
{
  _id: "conc-py-001",
  course_id: "course-python-data",
  name: "List Comprehensions",
  slug: "list-comprehensions",
  description: "Creating lists using a single line expression",
  difficulty_base: 4,  // 1-10
  tags: ["python", "lists", "syntax"],
  lesson_ids: ["lesson-3-2", "lesson-3-3", "lesson-5-1"],
  example_code: "[x for x in range(10) if x % 2 == 0]",
  prerequisite_concepts: ["conc-py-002", "conc-py-003"],
  created_at: "..."
}
```

### `concept_mastery`

Trạng thái thành thạo của user với từng concept.

```javascript
{
  _id: "mast-user-xxx-conc-py-001",
  user_id: "user-xxx",
  course_id: "course-python-data",
  concept_id: "conc-py-001",
  mastery_score: 3.5,  // 0-10, cập nhật sau mỗi lần tương tác
  attempts: 8,
  correct_attempts: 5,
  last_practiced_at: "...",
  first_learned_at: "...",
  trend: "improving|declining|stable",
  created_at: "...",
  updated_at: "..."
}
```

### `quiz_attempts` (mở rộng hoặc thay thế quiz hiện tại)

Lưu lịch sử làm quiz với thông tin adaptive.

```javascript
{
  _id: "qa-xxx",
  user_id: "user-xxx",
  course_id: "course-python-data",
  lesson_id: "lesson-3",
  concept_ids: ["conc-py-001", "conc-py-002"],
  questions: [
    {
      concept_id: "conc-py-001",
      difficulty: 5,
      correct: true,
      user_answer: 2,
      time_seconds: 15
    }
  ],
  score: 7,
  max_score: 10,
  passed: true,
  mastery_before: 3.2,
  mastery_after: 4.5,
  created_at: "..."
}
```

---

## 6. Services mới / mở rộng

### `services/concept_mastery.py`

**Hàm chính:**
- `get_or_create_mastery(user_id, course_id, concept_id)` — Khởi tạo mastery nếu chưa có
- `update_mastery(user_id, course_id, concept_id, correct, difficulty, time_seconds)` — Cập nhật điểm mastery sau quiz/exercise
- `get_course_mastery_map(user_id, course_id)` — Lấy mastery map cho toàn bộ course
- `get_weak_concepts(user_id, course_id, threshold=3.0)` — Tìm concepts yếu
- `get_strong_concepts(user_id, course_id, threshold=7.0)` — Tìm concepts mạnh
- `get_prerequisites(user_id, course_id, concept_id)` — Lấy list concepts cần học trước
- `recalculate_mastery(user_id, course_id, concept_id)` — Recalculate streak-based mastery

**Thuật toán mastery update (đơn giản):**

```python
def update_mastery_score(
    current_score: float,
    attempts: int,
    correct: bool,
    difficulty: int,
    time_seconds: float,
) -> float:
    # ELO-like: user mastery vs question difficulty
    expected = 1 / (1 + 10 ** ((difficulty - current_score) / 400))
    k = 32 / (1 + attempts / 10)  # K-factor giảm dần theo số lần làm
    
    actual = 1.0 if correct else 0.0
    new_score = current_score + k * (actual - expected)
    return round(max(0.0, min(10.0, new_score)), 2)
```

### `services/adaptive_quiz.py`

**Hàm chính:**
- `generate_adaptive_quiz(user_id, course_id, lesson_id, num_questions=5)` — Tạo quiz thích ứng cho lesson
  1. Lấy danh sách concepts của lesson
  2. Lấy mastery map hiện tại
  3. Chọn concept yếu nhất trước (nếu mastery < 4)
  4. Chọn độ khó câu hỏi = mastery score (đảm bảo user thử thách phù hợp)
  5. Gọi LLM để generate câu hỏi nếu chưa có trong DB, hoặc lấy từ question bank
  6. Trả về ordered list câu hỏi theo độ khó tăng dần

- `grade_quiz(user_id, quiz_attempt_id, answers)` — Chấm điểm và update mastery
  1. So sánh user answers với correct answers
  2. Cập nhật concept_mastery cho từng concept trong quiz
  3. Trả về breakdown theo concept

### `services/remediation.py`

**Hàm chính:**
- `detect_gaps(user_id, course_id)` — Phát hiện khoảng kiến thức yếu
  1. Lấy mastery map
  2. Lọc concepts với mastery < 3.0
  3. Kiểm tra prerequisite: nếu concept A là prerequisite của B mà A yếu → ưu tiên A
  4. Trả về list cần bổ trợ, sắp xếp theo ưu tiên

- `generate_remedial_content(user_id, course_id, concept_id)` — Tạo nội dung bổ trợ bằng AI
  1. Lấy info của concept từ `concept_definitions`
  2. Lấy các lesson segments liên quan từ syllabus
  3. Gọi LLM để generate:
     - "Remedial explanation" — Giải thích lại bằng từ đơn giản hơn
     - "Micro-exercise" — Bài tập rút gọn 2-3 câu
     - "Analogies" — Liên hệ với thực tế
  4. Lưu vào cache để reuse

- `get_recommended_remediation(user_id, course_id)` — Gợi ý học viên nên bổ trợ gì tiếp theo

---

## 7. API Endpoints mới

### `api/v1/adaptive-learning.py` — User-facing

| Method | Endpoint | Mô tả |
|---|---|---|
| `GET` | `/adaptive/mastery/{course_id}` | Lấy mastery map cho toàn bộ course |
| `GET` | `/adaptive/concepts/{course_id}` | Lấy danh sách concepts + mastery của user |
| `GET` | `/adaptive/weak/{course_id}` | Lấy concepts yếu cần bổ trợ |
| `GET` | `/adaptive/prerequisites/{course_id}/{concept_id}` | Lấy prerequisite concepts |
| `POST` | `/adaptive/quiz/{course_id}/generate` | Tạo quiz thích ứng theo mastery |
| `POST` | `/adaptive/quiz/{course_id}/submit` | Nộp quiz → cập nhật mastery |
| `GET` | `/adaptive/remediation/{course_id}` | Lấy danh sách bài bổ trợ gợi ý |
| `POST` | `/adaptive/skip/{course_id}/{lesson_id}` | Skip bài học nếu đã thành thạo (pre-test pass) |

### `api/v1/admin/adaptive/` — Admin endpoints

| Method | Endpoint | Mô tả |
|---|---|---|
| `POST` | `/admin/adaptive/concepts` | Tạo concept definition |
| `PUT` | `/admin/adaptive/concepts/{id}` | Cập nhật concept |
| `POST` | `/admin/adaptive/concepts/bulk` | Bulk import concepts từ course outline |
| `GET` | `/admin/adaptive/stats/{course_id}` | Thống kê mastery phân bố, concept khó nhất |
| `POST` | `/admin/adaptive/quiz/generate-bank` | Tạo ngân hàng câu hỏi cho course |

---

## 8. Frontend Components mới

### `components/adaptive/MasteryRadar.tsx`
- Biểu đồ radar hiển thị mastery score cho từng concept
- Màu sắc: đỏ (< 3), vàng (3-6), xanh (> 6)
- Click vào concept → xem chi tiết + đề xuất bổ trợ

### `components/adaptive/AdaptiveQuiz.tsx`
- Quiz UI hiển thị progress bar theo concept mastery
- Hiển thị độ khó câu hỏi hiện tại
- Sau quiz: breakdown từng concept, mastery update animation
- Nút "Skip to harder content" nếu mastery cao

### `components/adaptive/RemedialPanel.tsx`
- Khi user hoàn thành một lesson, nếu có concept yếu → hiển thị panel
- "You struggled with: List Comprehensions"
- Gợi ý: "Review this 3-min video", "Try this micro-exercise", "Ask AI tutor"
- "I got it, skip anyway" button

### `app/(app)/learn/[course]/mastery/page.tsx`
- Trang mastery dashboard riêng cho course
- Mastery radar chart
- Timeline progress
- Remedial queue

### `app/(app)/learn/[course]/[lesson]/adaptive-quiz/page.tsx`
- Quiz trang riêng thay thế/đi kèm quiz cũ

---

## 9. Luồng tương tác (User Flow)

```
User đang học Lesson 3: "List Comprehensions"
       │
       ▼
Xem video → progress tracked
       │
       ▼
Làm quiz (adaptive):
  - Câu 1 (List Comprehensions, difficulty 3) → ĐÚNG → mastery: 3.0 → 4.0
  - Câu 2 (List Comprehensions, difficulty 5) → SAI → mastery: 4.0 → 3.5
  - Câu 3 (Scope, difficulty 4) → ĐÚNG → mastery: 2.5 → 3.0
       │
       ▼
Quiz xong → adaptive engine phân tích:
  - mastery(List Comprehensions) = 3.5 (cần cải thiện)
  - mastery(Scope) = 3.0 (yếu)
       │
       ▼
Hiển thị Remedial Panel:
  "Bạn cần làm thêm bài tập về List Comprehensions"
  [Review 2-min video clip] [Try micro-exercise] [Talk to AI Tutor]
       │
  ┌────┴────┐
  │         │
  ▼         ▼
Bổ trợ   Skip anyway
  │
  ▼
User làm micro-exercise → mastery tăng lên 5.0
       │
       ▼
Tiếp tục Lesson 4 (Filter đã đủ kiến thức nền)
```

---

## 10. Triển khai theo Phase

### Phase 1: Foundation (Tuần 1-2)
1. Tạo `concept_definitions` collection + admin CRUD
2. Seed concept definitions cho 2-3 khóa học mẫu
3. Tạo `concept_mastery` collection + base CRUD
4. Tạo Adaptive Quiz endpoint cơ bản (chưa adaptive, chỉ lọc theo lesson)
5. Seed 20-30 câu hỏi mẫu với `concept_id` + `difficulty`
6. Frontend: AdaptiveQuiz component đơn giản

### Phase 2: Mastery Engine (Tuần 3-4)
1. Implement mastery update algorithm (Elo-based)
2. Implement `detect_gaps()` — phát hiện concepts yếu
3. Implement prerequisite checking
4. Adaptive Quiz: chọn câu hỏi theo mastery level
5. Post-quiz mastery feedback UI
6. Integrate với existing quiz endpoints

### Phase 3: Remediation (Tuần 5-6)
1. Build `remediation.py` service
2. `generate_remedial_content()` — AI-generated explanations + micro-exercises
3. Remedial Panel component + triggers
4. Proactive intervention hook (nếu mastery < 3.0 → suggestion)
5. AI Tutor integration: pass weak concepts vào context

### Phase 4: Dynamic Sequencing (Tuần 7-8)
1. Skipping mechanism: pre-test để bỏ qua lesson đã biết
2. Dynamic rerouting trong course (đổi thứ tự lessons)
3. Admin dashboard: mastery heatmap theo course, concept difficulty
4. Analytics: completion rate improvement, time-to-learn metrics

---

## 11. Metrics phân đoạn

### Metrics nghiệp vụ (Business)
| Metric | Baseline (ước tính) | Mục tiêu |
|---|---|---|
| **Course completion rate** | ~15-20% | +25-35% |
| **Time-to-complete** | Theo planned duration | -15% (nếu pre-skip works) |
| **Quiz pass rate (first try)** | ~40-50% | +20-30% |
| **Churn trong học** | ~5-7%/tháng | -20-30% |
| **NPS / CSAT học tập** | Baseline | +15-20% |

### Metrics kỹ thuật (Learning Effectiveness)
| Metric | Mô tả |
|---|---|
| **Mastery Δ per session** | Trung bình mastery tăng sau 1 session học |
| **Remediation effectiveness** | % user cải thiện mastery sau khi làm remedial |
| **Gap resolution time** | Trung bình bao lâu để mastery vượt ngưỡng yếu |
| **Concept difficulty calibration** | Correlation giữa difficulty tag và thực tế % correct |

---

## 12. Tác động

| Mặt | Tác động |
|---|---|
| **Học viên có nền tảng** | Không phải học lại — skip phần đã biết, focus vào phần cần học |
| **Học viên yếu** | Bị bỏ lại ít hơn — ngay khi phát hiện yếu → có ngay hướng dẫn phù hợp |
| **Giảng viên** | Thấy dashboard mastery → biết ai cần hỗ trợ ở đâu, tránh giảng chung |
| **Nền tảng** | Hoàn thành cao hơn → renewal rate cao hơn → giảm churn |
| **Content team** | Biết concept nào thường yếu → cải thiện chất lượng lesson tương ứng |

---

## 13. File thay đổi (dự kiến)

### Backend
- `apps/api/app/models/concept_definition.py` — NEW (Pydantic)
- `apps/api/app/models/concept_mastery.py` — NEW (Pydantic)
- `apps/api/app/services/concept_mastery.py` — NEW
- `apps/api/app/services/adaptive_quiz.py` — NEW
- `apps/api/app/services/remediation.py` — NEW
- `apps/api/app/api/v1/adaptive_learning.py` — NEW
- `apps/api/app/api/v1/admin/adaptive.py` — NEW
- `apps/api/app/db/seed_concepts.py` — NEW (seed data)
- `apps/api/app/db/indexes.py` — ADD indexes

### Frontend
- `apps/web/components/adaptive/MasteryRadar.tsx` — NEW
- `apps/web/components/adaptive/ConceptCard.tsx` — NEW
- `apps/web/components/adaptive/AdaptiveQuiz.tsx` — NEW
- `apps/web/components/adaptive/RemedialPanel.tsx` — NEW
- `apps/web/app/(app)/learn/[course]/mastery/page.tsx` — NEW
- `apps/web/app/(app)/learn/[course]/[lesson]/adaptive-quiz/page.tsx` — NEW
- `apps/web/lib/adaptive-client.ts` — NEW

### Database
- `concept_definitions` (mới)
- `concept_mastery` (mới)
- `quiz_attempts` (mở rộng hoặc reuse, thêm `concept_ids`)

---

## 14. Tại sao đây là cải tiến LỚN

1. **Không phải biến đơn lẻ**: Thay đổi toàn bộ trải nghiệm học tập từ "one-size-fits-all" → "learning personalization"
2. **Tác dụng học thuật rõ ràng**: Research cho thấy adaptive learning cải thiện retention 20-30% (ĐH Harvard, MIT studies)
3. **Reuse existing infrastructure**: Tận dụng AI Tutor (LLM), quiz generator, knowledge base, progress tracking
4. **Competitive moat**: Rất nhiều platform online ở VN còn dùng curriculum cố định. Adaptive = khác biệt lớn.
5. **Scalable**: Logic hoàn toàn tự động; càng nhiều user càng data master tốt hơn
6. **Phù hợp mục tiêu "học lập trình tốt hơn"**: Học viên được học theo tốc độ phù hợp, không bị bỏ lại, không bị chán nản

---

## 15. So sánh với các cải tiến khác

| Cải tiến | Tác động | Công sức | Độ phức tạp | Độ mới |
|---|---|---|---|---|
| Adaptive Learning Engine | **Rất cao** | Trung bình | Medium-High | **Trên 90% mới** |
| Intelligent Support System (file 15 hiện có) | Rất cao | Cao | High | Đã triển khai 80% |
| PWA Offline | Trung bình | Thấp | Low | Low |
| Learning Paths (tùy chỉnh user) | Cao | Trung bình | Medium | Medium |
| B2B Team Plans | Rất cao | Rất cao | Very High | Medium |

**Adaptive Learning Engine là cải tiến lớn nhất trong phạm vi "nâng cao trải nghiệm học tập"** vì:
- Chưa có bất kỳ platform học online VN nào implement adaptive learning ở cấp concept
- Impact trực tiếp lên KPI business (completion rate, retention)
- Sử dụng AI hiện có mà không cần model mới
- Có thể demo được ngay từ Phase 1 (adaptive quiz với question bank)

---

## 16. Rủi ro & Giảm thiểu

| Rủi ro | Giải pháp |
|---|---|
| **Dữ liệu concept ban đầu thiếu** | Seed bằng AI từ course transcripts + outline; admin có thể edit thủ công |
| **Quiz bank chất lượng thấp** | Kết hợp AI generation + human review; fallback về generic nếu không đủ |
| **Thuật toán mastery phức tạp** | Bắt đầu simple (Win rate average), cải tiến dần |
| **User ngạc nhiên khi bị skip lesson** | Luôn có option "Show all lessons" + pre-test voluntary |
| **Cold start (user mới chưa có data)** | Default mastery = 5.0; adaptive nhảy vào sau 2-3 câu đầu |

---

Bạn muốn tôi bắt đầu triển khai từ **Phase nào** trước? Tôi đề xuất **Phase 1 (Foundation)** — xây concept_definitions, mastery CRUD và adaptive quiz cơ bản trước, để có demo sớm nhất.
