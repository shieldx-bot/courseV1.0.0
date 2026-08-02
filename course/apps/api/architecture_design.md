# Core Platform Architecture Design - Online Examination Platform

## 1. Overview
Thiết kế hệ thống thi trực tuyến MVP tập trung vào khả năng mở rộng, chấm điểm tự động và bảng xếp hạng thời gian thực, tuân thủ nguyên tắc Clean Architecture.

---

## 2. Entity Relationship Diagram (ERD)

### 2.1. Core Entities
- **User**: _id, email, password_hash, role (admin, creator, user), created_at
- **Profile**: user_id, avatar, bio, country, rank, xp, streak, total_solved, total_created
- **Category**: _id, title, slug, description
- **Exam**: _id, title, description, category_id, difficulty (easy, medium, hard), tags, estimated_time, author_id, status (draft, published), created_at, updated_at
- **Question**: _id, exam_id, type (multiple_choice, coding, etc.), title, content, explanation, points, order_index, metadata (JSON)
- **QuestionOption**: _id, question_id, content, is_correct, order_index
- **Submission**: _id, user_id, exam_id, status (started, submitted, graded), score, started_at, completed_at
- **SubmissionDetail**: _id, submission_id, question_id, user_answer, is_correct, points_earned, feedback
- **Leaderboard**: category_id (optional), type (global, weekly, monthly), user_id, score, rank, last_updated

### 2.2. Relationships
- **User (1) <-> (1) Profile**
- **User (1) <-> (N) Exam** (Creator/Author)
- **Category (1) <-> (N) Exam**
- **Exam (1) <-> (N) Question**
- **Question (1) <-> (N) QuestionOption**
- **User (1) <-> (N) Submission**
- **Exam (1) <-> (N) Submission**
- **Submission (1) <-> (N) SubmissionDetail**

---

## 3. API Design (V1)

### 3.1. Authentication
- `POST /auth/register`: Đăng ký tài khoản
- `POST /auth/login`: Đăng nhập
- `GET /auth/google`: OAuth Google
- `GET /auth/github`: OAuth GitHub

### 3.2. User Profile
- `GET /profile/me`: Lấy thông tin cá nhân
- `PATCH /profile/me`: Cập nhật avatar, bio, country
- `GET /profile/{username}`: Xem profile người khác

### 3.3. Exam (User Flow)
- `GET /exams`: Danh sách đề thi (Filter: category, difficulty, search)
- `GET /exams/{slug}`: Chi tiết đề thi
- `POST /exams/{slug}/start`: Bắt đầu thi (Tạo submission, start timer)
- `POST /exams/{slug}/submit`: Nộp bài thi
- `GET /submissions/{id}`: Xem kết quả và giải thích

### 3.4. Creator Dashboard
- `GET /creator/exams`: Quản lý danh sách đề đã tạo
- `POST /creator/exams`: Tạo đề mới (Draft)
- `PUT /creator/exams/{id}`: Sửa đề
- `POST /creator/exams/{id}/publish`: Xuất bản đề
- `GET /creator/analytics`: Thống kê lượt tham gia, điểm trung bình

### 3.5. Leaderboard
- `GET /leaderboard`: Top global
- `GET /leaderboard/{category_slug}`: Top theo category
- `GET /leaderboard/weekly`: Bảng xếp hạng tuần

### 3.6. Admin
- `GET /admin/users`: Quản lý người dùng
- `DELETE /admin/exams/{id}`: Xóa/Ẩn đề thi vi phạm
- `GET /admin/reports`: Xem báo cáo hệ thống

---

## 4. Folder Structure (Clean Architecture)

```text
apps/api/app/
├── api/v1/                 # Presentation Layer (Routes/Controllers)
│   ├── auth/
│   ├── exams/
│   ├── profile/
│   ├── creator/
│   └── admin/
├── core/                   # Shared (Config, Security, Deps)
├── domain/                 # Domain Layer (Business Entities & Logic)
│   ├── entities/           # Pure Business Models
│   ├── interfaces/         # Repository/Service Interfaces
│   └── services/           # Domain Services (Grading Logic, XP Calculation)
├── infrastructure/         # Infrastructure Layer (External Tools)
│   ├── repositories/       # Database Implementations (SQLAlchemy/MongoDB)
│   ├── external/           # OAuth, Mail, Storage
│   └── sandbox/            # Code/Lab Execution Engine
├── schemas/                # Application Layer (DTOs/Validation)
│   ├── auth.py
│   ├── exam.py
│   └── profile.py
└── main.py                 # Entry Point
```

---

## 5. Permission Matrix (RBAC)

| Feature | Guest | User | Creator | Admin |
| :--- | :---: | :---: | :---: | :---: |
| View Exams | ✓ | ✓ | ✓ | ✓ |
| Take Exam | ✗ | ✓ | ✓ | ✓ |
| Create Exam | ✗ | ✗ | ✓ | ✓ |
| Edit Own Exam | ✗ | ✗ | ✓ | ✓ |
| Delete Any Exam | ✗ | ✗ | ✗ | ✓ |
| Manage Users | ✗ | ✗ | ✗ | ✓ |
| View Analytics | ✗ | ✗ | ✓ | ✓ |

---

## 6. Technical Strategies

### 6.1. Auto-grading Strategy
Sử dụng **Strategy Pattern** để xử lý `GradingService`:
- `MultipleChoiceStrategy`: So khớp index đáp án.
- `FillBlankStrategy`: So khớp chuỗi (regex/case-insensitive).
- `CodingStrategy`: Chạy code trong Docker container với test cases.
- `LinuxLabStrategy`: Kiểm tra trạng thái hệ thống sau khi user thực hiện lệnh.

### 6.2. Gamification Logic
- **XP**: Tính dựa trên (Difficulty * Score * Time Bonus).
- **Streak**: Tăng khi user hoàn thành ít nhất 1 đề mỗi ngày.
- **Rank**: Phân cấp (Bronze, Silver, Gold, Platinum, Diamond, Master) dựa trên tổng XP.

### 6.3. Search & Pagination
- Sử dụng `limit` và `offset` cho pagination.
- Full-text search trên `title` và `description` của Exam.
