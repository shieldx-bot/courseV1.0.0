# Phase 3 — AI & Community Architecture Design

## 1. Microservices Architecture

Hệ thống được chia thành các dịch vụ độc lập để tối ưu hóa khả năng mở rộng và bảo trì:

- **API Gateway**: Routing, Rate Limiting, Authentication.
- **Core Service**: Quản lý Exam, Submission, User Profile (Clean Architecture từ Phase 1).
- **Gamification Service**: Xử lý XP, Rank, Streak, Badges (Phase 2).
- **AI Service**: 
  - **Worker-based**: Xử lý Async các tác vụ LLM (Gen, Review).
  - **Real-time**: Anti-cheat analysis, AI Mentor (Chat).
- **Community Service**: Quản lý Follow, Like, Comment, Discussion, Feed.
- **Search Service**: Vector DB (Milvus/Pinecone) + Elasticsearch cho tìm kiếm theo ngữ nghĩa.
- **Notification Service**: Gửi thông báo qua Push, Email, In-app.

---

## 2. AI Workflows

### 2.1. AI Question Generator
1. **Input**: Creator nhập Topic hoặc tải lên tài liệu (PDF/Text).
2. **AI Analysis**: LLM phân tích kiến trúc kiến thức.
3. **Generation**: Tạo bộ câu hỏi (Multiple choice, Coding test cases, Linux Lab commands).
4. **Validation**: Một AI Agent khác kiểm tra tính đúng đắn và độ khó.

### 2.2. AI Anti-Cheat
- **Behavior Analysis**: Theo dõi tần suất chuyển Tab, tốc độ gõ phím bất thường (copy-paste).
- **Answer Pattern**: So sánh với các mẫu trả lời của AI để phát hiện việc sử dụng ChatGPT trong lúc thi.

### 2.3. AI Mentor & Explanation
- Cung cấp giải thích chi tiết cá nhân hóa dựa trên lỗi sai cụ thể của người dùng.
- Gợi ý lộ trình học tập tiếp theo.

---

## 3. Recommendation & Search Engine

### 3.1. Recommendation Engine
Sử dụng mô hình Hybrid:
- **Collaborative Filtering**: "Người dùng giống bạn cũng giải đề này".
- **Content-based**: Gợi ý các đề cùng tag/category mà người dùng thường làm tốt.
- **Hot/Trending**: Dựa trên vận tốc tăng trưởng lượt tham gia trong 24h.

### 3.2. Search Engine
- **Full-text**: Tìm kiếm chính xác tiêu đề, tag.
- **Semantic Search**: Tìm kiếm theo ý nghĩa (Ví dụ: Tìm "cách quản lý tiến trình Linux" sẽ ra các đề về `ps`, `top`, `kill`).

---

## 4. Community & Creator Economy

### 4.1. Creator Reputation
Điểm uy tín được tính bằng:
- Tổng số Follower.
- Điểm đánh giá trung bình của các đề thi (Star rating).
- Số lượng "Helpful" trên các câu trả lời trong Discussion.
- Tỷ lệ hoàn thành (Completion rate) của người tham gia đề thi đó.

### 4.2. Discussion System
- Cấu trúc cây (Nested comments).
- **Pinned Answer**: Tác giả hoặc Moderator có thể ghim câu trả lời đúng nhất.
- **Community Vote**: Like/Dislike để lọc nội dung rác.

---

## 5. Activity Feed & Notification

### 5.1. Activity Feed
Sử dụng kiến trúc **Fan-out on Write**:
- Khi người dùng `A` hoàn thành 1 Achievement, sự kiện được đẩy vào bảng tin của tất cả Follower của `A`.
- Trang chủ hiển thị: "Friend B vừa giải xong đề AWS Master".

### 5.2. Notification System
- **Urgent**: Kết quả Challenge 1vs1, Cảnh báo bảo mật.
- **Social**: Có người reply comment, Follower mới.
- **Retention**: Lắc nhắc Streak (Positive reinforcement).

---

## 6. Database Schema Expansion (Phase 3)

```sql
-- Community: Follows
CREATE TABLE IF NOT EXISTS follows (
  follower_id TEXT NOT NULL,
  following_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY (follower_id, following_id)
);

-- Community: Discussions
CREATE TABLE IF NOT EXISTS discussions (
  _id TEXT PRIMARY KEY,
  target_type TEXT NOT NULL, -- exam, question
  target_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  content TEXT NOT NULL,
  is_pinned INTEGER DEFAULT 0,
  likes_count INTEGER DEFAULT 0,
  created_at TEXT NOT NULL
);

-- Exam Quality & Feedback
CREATE TABLE IF NOT EXISTS exam_reviews (
  _id TEXT PRIMARY KEY,
  exam_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  rating INTEGER NOT NULL, -- 1-5 stars
  tags TEXT, -- "helpful", "too_easy", "wrong_answer"
  comment TEXT,
  created_at TEXT NOT NULL
);

-- Activity Feed
CREATE TABLE IF NOT EXISTS activity_feed (
  _id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL, -- Chủ thể hành động
  action_type TEXT NOT NULL, -- completed_exam, earned_badge, created_exam
  target_id TEXT,
  metadata TEXT, -- JSON data
  created_at TEXT NOT NULL
);

-- Creator Stats
CREATE TABLE IF NOT EXISTS creator_stats (
  user_id TEXT PRIMARY KEY,
  reputation_score INTEGER DEFAULT 0,
  total_followers INTEGER DEFAULT 0,
  total_exam_reviews INTEGER DEFAULT 0,
  avg_rating REAL DEFAULT 0.0
);
```
