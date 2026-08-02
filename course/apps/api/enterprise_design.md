# Phase 4 — Competitive Platform & Enterprise Architecture

## 1. Live Contest System (Real-time Scale)

Hệ thống thi đấu trực tiếp yêu cầu khả năng xử lý hàng nghìn người dùng đồng thời nộp bài và cập nhật bảng xếp hạng tức thì.

### 1.1. Architecture for Concurrency
- **WebSocket Cluster**: Sử dụng Redis Pub/Sub để đồng bộ hóa trạng thái giữa các WebSocket nodes.
- **Fair-start Mechanism**: Đảm bảo tất cả thí sinh nhận được đề thi cùng một thời điểm (đồng bộ clock qua NTP).
- **Virtual Waiting Room**: Sử dụng hàng đợi (Queue) để kiểm soát lưu lượng truy cập khi bắt đầu Contest lớn.

### 1.2. Real-time Leaderboard
- **Data Structure**: Sử dụng Redis Sorted Sets (`ZSET`) để lưu trữ điểm số.
- **Score Calculation**: 
  - $Score = TotalPoints$
  - $Penalty = SubmissionTime + (IncorrectAttempts \times 10mins)$
  - Sắp xếp theo $Score$ giảm dần, sau đó $Penalty$ tăng dần.

---

## 2. Career System & Skill Graph

Biến nền tảng thành một Resume sống động cho lập trình viên.

### 2.1. Skill Graph (Knowledge Map)
- **Nodes**: Các kỹ năng (Python, Docker, SQL, Algorithm).
- **Edges**: Mối quan hệ tiên quyết (Prerequisites).
- **Dynamic Level**: Tính toán level dựa trên độ khó của các đề thi đã vượt qua trong Category đó.

### 2.2. Verified Portfolio & Certification
- **Proof of Work**: Mỗi giải pháp cho đề thi "Hard" được lưu trữ như một minh chứng năng lực.
- **Digital Certificates**: Cấp chứng chỉ định danh (có thể dùng Blockchain/NFT để chống làm giả) khi hoàn thành một Learning Path.
- **Company Challenges**: Các doanh nghiệp có thể tổ chức cuộc thi riêng để tuyển dụng (Headhunting).

---

## 3. Enterprise Infrastructure (High Availability & DR)

### 3.1. Scalability Strategies
- **Global Load Balancing (GSLB)**: Phân tán traffic theo vị trí địa lý.
- **Multi-Region Deployment**: Triển khai trên ít nhất 2 vùng (ví dụ: Singapore & US-East) để giảm độ trễ và tăng tính dự phòng.
- **Database Sharding/Partitioning**: Chia dữ liệu Submission theo `contest_id` hoặc `user_id` để tránh bottleneck.

### 3.2. Event Bus & Integration
- **Message Broker**: Sử dụng Apache Kafka hoặc RabbitMQ làm xương sống cho Event-Driven Architecture.
- **Events**: `USER_SIGNED_UP`, `CONTEST_FINISHED`, `BADGE_EARNED`.
- **Integrations**: Webhooks cho doanh nghiệp, Slack/Discord notifications.

### 3.3. Disaster Recovery (DR)
- **RPO (Recovery Point Objective)**: < 5 phút (Backup dữ liệu liên tục).
- **RTO (Recovery Time Objective)**: < 30 phút (Tự động chuyển đổi sang Region dự phòng).
- **Data Replication**: Master-Slave replication cho Database, S3 Cross-Region Replication cho tài liệu/hình ảnh.

---

## 4. Monitoring & Security (Security-First)

### 4.1. Observability
- **Metrics**: Prometheus + Grafana (Track TPS, Latency, Error Rate).
- **Logging**: ELK Stack (Elasticsearch, Logstash, Kibana) để điều tra sự cố.
- **Tracing**: Jaeger/OpenTelemetry để theo dõi request qua các microservices.

### 4.2. Security Enterprise
- **WAF (Web Application Firewall)**: Chống SQL Injection, XSS, DDoS.
- **IAM (Identity and Access Management)**: Phân quyền chi tiết (Least Privilege).
- **Sandbox Security**: Isolation tuyệt đối cho Coding/Linux Lab bằng gVisor hoặc Firecracker MicroVM.

---

## 5. Database Schema Expansion (Phase 4)

```sql
-- Live Contests
CREATE TABLE IF NOT EXISTS contests (
  _id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  start_time TEXT NOT NULL,
  end_time TEXT NOT NULL,
  type TEXT DEFAULT 'public', -- public, private, company
  rules_json TEXT,
  organizer_id TEXT NOT NULL,
  status TEXT DEFAULT 'upcoming', -- upcoming, active, finished
  created_at TEXT NOT NULL
);

-- Contest Participants
CREATE TABLE IF NOT EXISTS contest_participants (
  contest_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  registered_at TEXT NOT NULL,
  final_rank INTEGER,
  final_score REAL,
  PRIMARY KEY (contest_id, user_id)
);

-- Skill Graph / Knowledge Points
CREATE TABLE IF NOT EXISTS skill_graph (
  user_id TEXT NOT NULL,
  skill_name TEXT NOT NULL,
  level INTEGER DEFAULT 1,
  xp INTEGER DEFAULT 0,
  last_updated TEXT NOT NULL,
  PRIMARY KEY (user_id, skill_name)
);

-- Certifications
CREATE TABLE IF NOT EXISTS certifications (
  _id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  title TEXT NOT NULL,
  issue_date TEXT NOT NULL,
  expiry_date TEXT,
  credential_url TEXT UNIQUE,
  metadata TEXT -- JSON lưu Learning Path hoặc Contest ID liên quan
);

-- Company / Enterprise Accounts
CREATE TABLE IF NOT EXISTS enterprises (
  _id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  domain TEXT UNIQUE,
  logo_url TEXT,
  subscription_tier TEXT,
  created_at TEXT NOT NULL
);
```

---

## 6. Implementation Roadmap

1. **Sprint 1-2**: Xây dựng WebSocket Server và cơ chế tính điểm Real-time cho Contest.
2. **Sprint 3-4**: Phát triển Skill Graph và thuật toán phân tích điểm yếu/mạnh.
3. **Sprint 5-6**: Thiết lập hạ tầng Multi-region và kịch bản Disaster Recovery.
4. **Sprint 7-8**: Xây dựng Enterprise Dashboard cho các nhà tuyển dụng.
