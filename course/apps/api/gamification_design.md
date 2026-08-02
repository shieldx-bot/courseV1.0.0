# Phase 2 — Gamification & Psychology Architecture Design

## 1. XP & Ranking System

### 1.1. XP Formula
Công thức tính XP nhằm cân bằng giữa độ khó của đề thi và hiệu suất của người dùng:

$$XP_{earned} = (BaseXP \times DifficultyMultiplier \times ScorePercentage) + TimeBonus + StreakBonus$$

- **BaseXP**: 100 XP.
- **DifficultyMultiplier**: Easy (1x), Medium (1.5x), Hard (2x).
- **ScorePercentage**: Tỷ lệ câu trả lời đúng (0.0 - 1.0).
- **TimeBonus**: $Max(0, (EstimatedTime - ActualTime) \times 2)$ (Thưởng nếu hoàn thành nhanh).
- **StreakBonus**: $CurrentStreak \times 5$ (Tối đa +50 XP).

### 1.2. Ranks (Tiers)
Hệ thống Rank dựa trên tổng tích lũy XP của người dùng:
- **Bronze**: 0 - 1,000 XP
- **Silver**: 1,001 - 5,000 XP
- **Gold**: 5,001 - 15,000 XP
- **Diamond**: 15,001 - 50,000 XP
- **Master**: 50,001 - 150,000 XP
- **Legend**: > 150,000 XP (Top 1% Global)

---

## 2. Achievement & Badge Engine

### 2.1. Logic vận hành (Criteria-based)
Hệ thống sử dụng **Rule Engine** để kiểm tra điều kiện trao huy hiệu sau mỗi sự kiện:
- **Event**: `EXAM_COMPLETED`, `LOGIN_SUCCESS`, `STREAK_MILESTONE`.
- **Criteria**: Một biểu thức logic (JSON/DSL) ví dụ: `{"count": 100, "category": "Linux", "difficulty": "Hard"}`.

### 2.2. Ví dụ Huy hiệu (Badges)
- **Linux Hero**: Giải quyết 50 đề Linux Lab.
- **Night Owl**: Hoàn thành đề thi trong khoảng 00:00 - 04:00.
- **100 Days Coding**: Duy trì streak 100 ngày.
- **Bug Hunter**: Báo cáo 5 lỗi đề thi được Admin chấp nhận.

---

## 3. Streak Protection System

Cơ chế streak tích cực giúp giảm áp lực tâm lý:
- **Daily Check-in**: Hoàn thành ít nhất 1 câu hỏi hoặc 1 đề thi mỗi ngày.
- **Streak Freeze (Đóng băng)**: 
  - Người dùng có thể mua tối đa 2 lượt đóng băng bằng XP hoặc nhận được khi lên Rank.
  - Tự động kích hoạt khi người dùng bỏ lỡ 1 ngày.
- **Positive Reinforcement**: Thông báo chúc mừng khi đạt mốc streak (7, 30, 100, 365 ngày).

---

## 4. Season & Ranking Engine

### 4.1. Season Cycle (90 ngày)
- **Start**: Reset Rank về mức cơ sở (ví dụ Gold xuống Silver).
- **End**: Chốt danh sách Ranking.
- **Hall of Fame**: Lưu vĩnh viễn Top 10 của mỗi mùa giải.

### 4.2. Leaderboard Types
- **Global**: Toàn bộ người dùng.
- **Friends**: Dựa trên danh sách follow.
- **Entity-based**: Country, Company, University (Dựa trên thông tin Profile).

---

## 5. Reward System

Các phần thưởng không ảnh hưởng đến gameplay nhưng tăng tính cá nhân hóa:
- **Avatar Frames**: Khung ảnh đại diện theo Rank hoặc Achievement.
- **Titles**: Danh hiệu hiển thị dưới tên (e.g., "The Kernel Master").
- **Special Badges**: Huy hiệu động (Animated) cho các mốc cực khó.

---

## 6. Challenge & Social (Multiplayer)

### 6.1. 1vs1 Challenge
- Hai người cùng giải một bộ đề thi ngẫu nhiên.
- Ai hoàn thành nhanh hơn và đúng nhiều hơn sẽ thắng.
- Phần thưởng: Cược XP (tùy chọn) và vinh quang.

### 6.2. Team Battle
- Nhóm 3-5 người cùng giải quyết một Lab phức tạp.
- Tính điểm tổng hợp của Team.

---

## 7. Database Schema Expansion (Phase 2)

```sql
-- Achievements Definition
CREATE TABLE IF NOT EXISTS achievements (
  _id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  criteria_json TEXT NOT NULL, -- Logic điều kiện
  reward_type TEXT, -- badge, frame, title
  reward_id TEXT,
  created_at TEXT NOT NULL
);

-- User Achievements
CREATE TABLE IF NOT EXISTS user_achievements (
  user_id TEXT NOT NULL,
  achievement_id TEXT NOT NULL,
  earned_at TEXT NOT NULL,
  PRIMARY KEY (user_id, achievement_id)
);

-- Streaks
CREATE TABLE IF NOT EXISTS user_streaks (
  user_id TEXT PRIMARY KEY,
  current_streak INTEGER DEFAULT 0,
  max_streak INTEGER DEFAULT 0,
  freeze_count INTEGER DEFAULT 0,
  last_activity_date TEXT,
  FOREIGN KEY (user_id) REFERENCES users(_id)
);

-- Seasons
CREATE TABLE IF NOT EXISTS seasons (
  _id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  start_date TEXT NOT NULL,
  end_date TEXT NOT NULL,
  is_active INTEGER DEFAULT 0
);

-- Season Hall of Fame
CREATE TABLE IF NOT EXISTS season_winners (
  season_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  rank INTEGER NOT NULL,
  xp_earned INTEGER,
  PRIMARY KEY (season_id, user_id)
);

-- Challenges (1vs1, Team)
CREATE TABLE IF NOT EXISTS challenges (
  _id TEXT PRIMARY KEY,
  type TEXT NOT NULL, -- 1vs1, team
  status TEXT NOT NULL, -- pending, active, completed
  created_at TEXT NOT NULL,
  metadata TEXT -- JSON lưu thông tin người tham gia, kết quả
);
```
