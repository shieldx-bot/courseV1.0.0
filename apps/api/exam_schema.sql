-- Online Examination Platform Tables

-- Exam Categories
CREATE TABLE IF NOT EXISTS exam_categories (
  _id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  description TEXT,
  created_at TEXT NOT NULL
);

-- Exams
CREATE TABLE IF NOT EXISTS exams (
  _id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  category_id TEXT NOT NULL,
  difficulty TEXT DEFAULT 'medium', -- easy, medium, hard
  tags TEXT, -- comma separated tags
  estimated_time INTEGER DEFAULT 30, -- minutes
  author_id TEXT NOT NULL,
  status TEXT DEFAULT 'draft', -- draft, published
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (category_id) REFERENCES exam_categories(_id)
);

-- Questions
CREATE TABLE IF NOT EXISTS exam_questions (
  _id TEXT PRIMARY KEY,
  exam_id TEXT NOT NULL,
  type TEXT NOT NULL, -- multiple_choice, coding, linux_lab, etc.
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  explanation TEXT,
  points INTEGER DEFAULT 10,
  order_index INTEGER DEFAULT 0,
  metadata TEXT, -- JSON string for coding testcases, lab config, correct answer
  FOREIGN KEY (exam_id) REFERENCES exams(_id)
);

-- Question Options (for choice types)
CREATE TABLE IF NOT EXISTS exam_question_options (
  _id TEXT PRIMARY KEY,
  question_id TEXT NOT NULL,
  content TEXT NOT NULL,
  is_correct INTEGER DEFAULT 0,
  order_index INTEGER DEFAULT 0,
  FOREIGN KEY (question_id) REFERENCES exam_questions(_id)
);

-- User Profiles (Gamification)
CREATE TABLE IF NOT EXISTS user_exam_profiles (
  user_id TEXT PRIMARY KEY,
  avatar TEXT,
  bio TEXT,
  country TEXT,
  rank TEXT DEFAULT 'Bronze',
  xp INTEGER DEFAULT 0,
  streak INTEGER DEFAULT 0,
  total_solved INTEGER DEFAULT 0,
  total_created INTEGER DEFAULT 0,
  last_activity TEXT,
  FOREIGN KEY (user_id) REFERENCES users(_id)
);

-- Submissions
CREATE TABLE IF NOT EXISTS exam_submissions (
  _id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  exam_id TEXT NOT NULL,
  status TEXT DEFAULT 'started', -- started, submitted, graded
  score INTEGER DEFAULT 0,
  started_at TEXT NOT NULL,
  completed_at TEXT,
  FOREIGN KEY (user_id) REFERENCES users(_id),
  FOREIGN KEY (exam_id) REFERENCES exams(_id)
);

-- Submission Details
CREATE TABLE IF NOT EXISTS exam_submission_details (
  _id TEXT PRIMARY KEY,
  submission_id TEXT NOT NULL,
  question_id TEXT NOT NULL,
  user_answer TEXT,
  is_correct INTEGER DEFAULT 0,
  points_earned INTEGER DEFAULT 0,
  feedback TEXT,
  FOREIGN KEY (submission_id) REFERENCES exam_submissions(_id),
  FOREIGN KEY (question_id) REFERENCES exam_questions(_id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_exams_category ON exams(category_id);
CREATE INDEX IF NOT EXISTS idx_questions_exam ON exam_questions(exam_id);
CREATE INDEX IF NOT EXISTS idx_submissions_user ON exam_submissions(user_id);
CREATE INDEX IF NOT EXISTS idx_submissions_exam ON exam_submissions(exam_id);

-- PHASE 4: ENTERPRISE & COMPETITIVE
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
  metadata TEXT
);

-- Enterprise Accounts
CREATE TABLE IF NOT EXISTS enterprises (
  _id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  domain TEXT UNIQUE,
  logo_url TEXT,
  subscription_tier TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_contests_status ON contests(status);
CREATE INDEX IF NOT EXISTS idx_skill_user ON skill_graph(user_id);
