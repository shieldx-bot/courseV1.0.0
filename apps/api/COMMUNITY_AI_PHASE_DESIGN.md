# Phase: Community + AI Intelligence — Thiết kế & Triển khai

## 1. Phân tích giá trị sản phẩm

| Tính năng | Giá trị cốt lõi | "Tại sao người dùng quay lại?" |
|-----------|----------------|-------------------------------|
| **AI Question Generator** | Nội dung vô hạn theo yêu cầu, không giới hạn bởi kho đề | Người dùng tạo challenge đúng chủ đề mình cần học ngay lập tức |
| **AI Mentor** | Cá nhân hóa: phân tích sai → chỉ ra lỗ hổng → gợi ý bước tiếp theo | Mỗi lần sai là một lần được "chẩn đoán" và hướng dẫn, không bị bỏ lại |
| **Skill Graph** | Trực quan hóa năng lực: "Tôi đang ở đâu trên bản đồ kỹ năng?" | Thanh tiến trình kỹ năng thay đổi sau mỗi bài → cảm giác tiến bộ mỗi ngày |
| **Discussion System** | Kiến thức cộng đồng, nhiều cách giải, học từ peer | Challenge khó → vô trang thảo luận → học được cách giải hay hơn |
| **Creator System** | UGC: người dùng tự tạo challenge, xây danh tiếng, follower | Người giỏi được công nhận → quay lại đóng góp → xây dựng thương hiệu cá nhân |
| **Activity Feed** | Dòng hoạt động cộng đồng: FOMO, social proof | "Mọi người đang tiến bộ" → mình cũng phải làm hôm nay |

## 2. User Flow

```
┌─────────────────────────────────────────────────────────────┐
│  Loop chính: Học → Sai → AI Mentor → Skill Graph → Thử lại  │
└─────────────────────────────────────────────────────────────┘

1. User chọn topic/độ khó → AI tạo challenge (hoặc chọn từ kho)
2. User làm challenge trong trình duyệt / IDE
3. Submit → Chấm điểm → AI Mentor phân tích:
   - Sai ở đâu, vì sao sai
   - Thiếu kiến thức gì
   - Đề xuất 5 challenge phù hợp
4. Skill Graph cập nhật từng kỹ năng (Linux, Docker, K8s, AWS...)
5. Activity Feed cập nhật: "user vừa Đạt AWS Expert"
6. Người dùng quay lại trang chủ → thấy feed → làm challenge tiếp
```

## 3. Trải nghiệm người dùng (UX)

- **Challenge Hub** (`/challenges`): Trang chủ thử thách, lọc theo skill/difficulty, tạo nhanh bằng AI
- **Challenge Detail** (`/challenges/{id}`): Câu hỏi + trả lời + giải thích + thảo luận + các bài làm khác
- **AI Mentor Panel**: Hiển thị sau khi submit — phân tích lỗi, gap analysis, đề xuất
- **Skill Graph Dashboard** (`/skills`): Thanh tiến trình cho từng kỹ năng (như mô tả: ████████ 85%)
- **Activity Feed** (Trang chủ + `/activity`): Timeline sự kiện cộng đồng
- **Creator Studio** (`/creator`): Tạo challenge, xem stats, cấp độ creator

## 4. Modules cần xây dựng

### Backend (FastAPI)
| Module | File | Mô tả |
|--------|------|-------|
| AI Challenge Generator | `app/services/ai_challenge_generator.py` | Tạo challenge bởi AI + tự đánh giá chất lượng (self-critique) |
| Challenge Engine | `app/api/v1/challenges.py` | CRUD challenge, submit, grade, attempt history |
| AI Mentor | `app/services/ai_mentor.py` + `app/api/v1/mentor.py` | Phân tích sau làm bài, đề xuất bài tiếp theo |
| Skill Graph | `app/services/skill_graph.py` + `app/api/v1/skills.py` | Skill taxonomy, mastery score, auto-update |
| Discussion (mở rộng) | `app/api/v1/challenge_discussions.py` | Thảo luận per challenge, vote, mark best answer |
| Creator System | `app/services/creator.py` + `app/api/v1/creators.py` | Creator level, profile, stats |
| Activity Feed | `app/services/activity_feed.py` + `app/api/v1/activity.py` | Feed events, aggregation, push |

### Frontend (Next.js)
| Module | Route |
|--------|-------|
| Challenge Hub | `/challenges` |
| Challenge Detail + Attempt | `/challenges/[id]` |
| AI Generator Wizard | `/challenges/new` (modal hoặc page con) |
| Skill Dashboard | `/skills` |
| Activity Feed | `/` (section) + `/activity` |
| Creator Studio | `/creator` |

## 5. Database Entities (MongoDB collections)

### `challenges`
```json
{
  "_id": "ch-{slug}",
  "title": "...",
  "description": "...",
  "topic": "Kubernetes Networking",
  "domain": "cloud",
  "difficulty": "medium",            // easy|medium|hard|expert
  "difficulty_score": 5,             // 1-10
  "type": "theory|debug|coding|scenario|analysis",
  "content": {"question": "...", "options": [...], "correct": 2 | "scenario": "...", "expected_answer": "..."},
  "explanation": "...",
  "skills": ["kubernetes", "cni", "service-discovery"],   // skill ids
  "test_cases": [{"input": "...", "expected": "..."}],   // nếu coding
  "source": "ai" | "user" | "platform",
  "creator_id": "..." | null,
  "status": "draft|published|archived",
  "quality_score": 0.0,             // AI self-critique 0-1
  "stats": {"attempts": 0, "completion_rate": 0.0, "avg_rating": 0.0, "bookmarks": 0},
  "created_at": "...", "updated_at": "..."
}
```

### `challenge_attempts`
```json
{
  "_id": "att-{user}-{challenge}-{ts}",
  "user_id": "...", "challenge_id": "...",
  "answers": {...}, "score": 0, "score_pct": 0.0,
  "passed": true, "time_seconds": 120,
  "skills_tested": ["kubernetes"],
  "mentor_analysis": {"weak_concepts": [...], "recommendations": [...]},  // lưu kết quả AI mentor
  "created_at": "..."
}
```

### `skills`
```json
{
  "_id": "skill-kubernetes",
  "name": "Kubernetes", "slug": "kubernetes",
  "category": "Cloud",
  "description": "...",
  "prerequisites": ["docker-containers"],
  "parent_skill": null,
  "created_at": "..."
}
```

### `user_skills`
```json
{
  "_id": "usk-{user}-{skill}",
  "user_id": "...", "skill_id": "skill-kubernetes",
  "mastery_score": 40.0,           // 0-100
  "level": "beginner|intermediate|advanced|expert",
  "attempts": 12, "correct_count": 8,
  "avg_time_seconds": 95, "consistency_score": 0.7,
  "last_updated": "...", "history": [{"date": "...", "score": 40.0, "delta": 5}]
}
```

### `discussions` / `discussion_replies` (per challenge)
```json
// discussions
{"_id": "disc-{challenge}-{ts}", "challenge_id": "...", "user_id": "...",
 "title": "...", "content": "...", "votes": 0, "reply_count": 0,
 "is_answer": false, "best_answer_id": null, "created_at": "..."}
// discussion_replies
{"_id": "rep-{disc}-{ts}", "discussion_id": "...", "user_id": "...",
 "content": "...", "votes": 0, "is_best_answer": false, "created_at": "..."}
```

### `creator_profiles`
```json
{
  "_id": "cp-{user_id}", "user_id": "...",
  "level": "beginner|trusted|expert|legend",
  "level_score": 0.0,              // 0-100
  "total_challenges": 5,
  "published_challenges": 3,
  "total_attempts_received": 450,
  "avg_completion_rate": 0.68,
  "avg_rating": 4.5,
  "followers": [{"user_id": "...", "since": "..."}],
  "badges": ["first-creator"],
  "created_at": "...", "updated_at": "..."
}
```

### `activity_events`
```json
{
  "_id": "act-{type}-{user}-{ts}",
  "user_id": "...",
  "type": "challenge_completed|challenge_created|skill_milestone|badge_earned|creator_level_up|rating_change|top_rank",
  "payload": {"challenge_id": "...", "skill_id": "...", "level": "expert", ...},
  "visibility": "public|followers|private",
  "created_at": "..."
}
```

## 6. API cần có (nhóm mới)

### Challenges (`/api/v1/challenges`)
| Method | Path | Mô tả |
|--------|------|-------|
| POST | `/api/v1/challenges/generate` | AI tạo challenge (topic, domain, difficulty, type) |
| GET | `/api/v1/challenges` | List + filter (skill, difficulty, source, sort) |
| GET | `/api/v1/challenges/{id}` | Chi tiết challenge |
| GET | `/api/v1/challenges/{id}/attempts` | Lịch sử làm bài của user |
| POST | `/api/v1/challenges/{id}/submit` | Submit + chấm điểm + trigger AI mentor (nếu passed<60%) |
| POST | `/api/v1/challenges` | Tạo challenge thủ công (creator) |
| PUT | `/api/v1/challenges/{id}` | Update (creator) |
| POST | `/api/v1/challenges/{id}/publish` | Publish challenge |
| POST | `/api/v1/challenges/{id}/rate` | Đánh giá challenge (1-5) |
| GET | `/api/v1/challenges/recommended` | Đề xuất challenge cho user dựa trên skill graph |

### AI Mentor (`/api/v1/mentor`)
| Method | Path | Mô tả |
|--------|------|-------|
| GET | `/api/v1/mentor/analysis/{attempt_id}` | Lấy phân tích AI mentor cho 1 attempt |
| GET | `/api/v1/mentor/recommendations` | Gợi ý challenge tiếp theo |

### Skills (`/api/v1/skills`)
| Method | Path | Mô tả |
|--------|------|-------|
| GET | `/api/v1/skills` | Skill taxonomy |
| GET | `/api/v1/skills/my` | Skill graph của user |
| GET | `/api/v1/skills/{skill_id}/challenges` | Challenge cho 1 skill |

### Community Feed (`/api/v1/activity`)
| Method | Path | Mô tả |
|--------|------|-------|
| GET | `/api/v1/activity` | Activity feed (public + following) |
| GET | `/api/v1/activity/my` | Activity của user |
| POST | `/api/v1/activity` | (internal) Tạo event |

### Creator (`/api/v1/creators`)
| Method | Path | Mô tả |
|--------|------|-------|
| GET | `/api/v1/creators/me` | Creator profile của user |
| GET | `/api/v1/creators/{user_id}` | Creator profile công khai |
| POST | `/api/v1/creators/follow` | Follow creator |
| DELETE | `/api/v1/creators/follow/{creator_id}` | Unfollow |

### Challenge Discussions (`/api/v1/challenges/{id}/discussions`)
| Method | Path | Mô tả |
|--------|------|-------|
| GET | `/challenges/{id}/discussions` | List discussion |
| POST | `/challenges/{id}/discussions` | Tạo discussion |
| POST | `/challenges/{id}/discussions/{disc_id}/replies` | Reply |
| POST | `/challenges/{id}/discussions/{disc_id}/vote` | Vote |
| POST | `/challenges/{id}/discussions/{disc_id}/replies/{reply_id}/mark-answer` | Mark best answer |

## 7. Thứ tự triển khai (Implementation Order)

### Bước 1: Backend foundation (services + routes)
1. **Skill Graph module** — skill taxonomy seed + user_skills updates (nền tảng cho mọi thứ khác)
2. **AI Challenge Generator** — generate + AI self-critique quality score
3. **Challenge Engine** — CRUD + submit + grading + attempt tracking
4. **AI Mentor** — analysis + recommendations (dùng attempt data + skill graph)
5. **Discussion per challenge**
6. **Creator System** — profile + level + stats aggregation
7. **Activity Feed** — event creation + timeline aggregation

### Bước 2: Frontend
8. **API client + types**
9. **Challenge Hub** (`/challenges`)
10. **Challenge Detail + Attempt** (`/challenges/[id]`)
11. **AI Generator Wizard**
12. **Skill Dashboard** (`/skills`)
13. **Activity Feed** (homepage section)
14. **Creator Studio** (`/creator`)

### Bước 3: Tests + Polish
15. Backend tests (pytest)
16. Frontend type-safety check
17. Seed demo data

## 8. Nguyên tắc ưu tiên
- **UX > Tính năng**: Mỗi API trả dữ liệu đã tính sẵn (mastery score, recommendations) để frontend không cần tính toán
- **Scalability**: Activity feed dùng read-model aggregation, không realtime socket ở phase này
- **Không tính năng để "có"**: Bỏ realtime notification, bỏ vector search — dùng tag/skill match đơn giản