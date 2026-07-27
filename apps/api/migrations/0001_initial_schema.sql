-- Users table
CREATE TABLE IF NOT EXISTS users (
  _id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL DEFAULT '',
  password_hash TEXT NOT NULL,
  phone TEXT,
  phone_verified INTEGER DEFAULT 0,
  trial_active INTEGER DEFAULT 0,
  trial_expires TEXT,
  role TEXT DEFAULT 'user',
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- Courses table
CREATE TABLE IF NOT EXISTS courses (
  _id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  slug TEXT UNIQUE NOT NULL,
  image_url TEXT,
  category_slug TEXT,
  price REAL DEFAULT 0,
  duration_minutes INTEGER DEFAULT 0,
  level TEXT DEFAULT 'beginner',
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_courses_slug ON courses(slug);
CREATE INDEX IF NOT EXISTS idx_courses_category ON courses(category_slug);

-- Lessons table
CREATE TABLE IF NOT EXISTS lessons (
  _id TEXT PRIMARY KEY,
  course_id TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  video_url TEXT,
  duration_minutes INTEGER DEFAULT 0,
  order_index INTEGER DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_lessons_course ON lessons(course_id);

-- Categories table
CREATE TABLE IF NOT EXISTS categories (
  _id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  icon TEXT,
  description TEXT,
  created_at TEXT NOT NULL
);

-- Reviews table
CREATE TABLE IF NOT EXISTS reviews (
  _id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  role TEXT NOT NULL,
  rating INTEGER NOT NULL,
  outcome TEXT NOT NULL,
  quote TEXT NOT NULL,
  created_at TEXT NOT NULL
);

-- Blog table
CREATE TABLE IF NOT EXISTS blog (
  _id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  excerpt TEXT,
  content TEXT,
  image_url TEXT,
  published_at TEXT,
  created_at TEXT NOT NULL
);

-- Tiers table
CREATE TABLE IF NOT EXISTS tiers (
  _id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  price REAL NOT NULL,
  interval TEXT DEFAULT 'month',
  features TEXT,
  created_at TEXT NOT NULL
);

-- Learning paths table
CREATE TABLE IF NOT EXISTS learning_paths (
  _id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  description TEXT,
  goal TEXT,
  duration_weeks INTEGER DEFAULT 4,
  created_at TEXT NOT NULL
);

-- User learning paths
CREATE TABLE IF NOT EXISTS user_learning_paths (
  _id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  path_id TEXT NOT NULL,
  enrolled_at TEXT NOT NULL,
  progress INTEGER DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_user_paths_user ON user_learning_paths(user_id);

-- Progress table
CREATE TABLE IF NOT EXISTS progress (
  _id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  lesson_id TEXT NOT NULL,
  status TEXT DEFAULT 'in_progress',
  completed INTEGER DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_progress_user ON progress(user_id);
CREATE INDEX IF NOT EXISTS idx_progress_lesson ON progress(lesson_id);

-- Certificates table
CREATE TABLE IF NOT EXISTS certificates (
  _id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  course_id TEXT NOT NULL,
  course_name TEXT NOT NULL,
  user_name TEXT NOT NULL,
  verification_code TEXT UNIQUE NOT NULL,
  issued_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_certificates_code ON certificates(verification_code);

-- Contacts table
CREATE TABLE IF NOT EXISTS contacts (
  _id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  subject TEXT NOT NULL,
  message TEXT NOT NULL,
  created_at TEXT NOT NULL
);

-- Orders table
CREATE TABLE IF NOT EXISTS orders (
  _id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  amount REAL NOT NULL,
  status TEXT DEFAULT 'pending',
  created_at TEXT NOT NULL
);

-- Subscriptions table
CREATE TABLE IF NOT EXISTS subscriptions (
  _id TEXT PRIMARY KEY,
  user_id TEXT UNIQUE NOT NULL,
  tier_id TEXT NOT NULL,
  status TEXT DEFAULT 'active',
  cancelled_at TEXT,
  created_at TEXT NOT NULL
);

-- Coupons table
CREATE TABLE IF NOT EXISTS coupons (
  _id TEXT PRIMARY KEY,
  code TEXT UNIQUE NOT NULL,
  discount_type TEXT NOT NULL,
  discount_value REAL NOT NULL,
  max_uses INTEGER DEFAULT 100,
  used_count INTEGER DEFAULT 0,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL
);

-- Experiments table
CREATE TABLE IF NOT EXISTS experiments (
  _id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  description TEXT,
  variant TEXT DEFAULT 'control',
  active INTEGER DEFAULT 0,
  created_at TEXT NOT NULL
);

-- Experiment events table
CREATE TABLE IF NOT EXISTS experiment_events (
  _id TEXT PRIMARY KEY,
  experiment_slug TEXT NOT NULL,
  event_type TEXT NOT NULL,
  metadata TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_exp_events_slug ON experiment_events(experiment_slug);

-- Referrals table
CREATE TABLE IF NOT EXISTS referrals (
  _id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  code TEXT UNIQUE NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_referrals_code ON referrals(code);

-- Referral applications table
CREATE TABLE IF NOT EXISTS referral_applications (
  _id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  referral_code TEXT NOT NULL,
  applied_at TEXT NOT NULL
);

-- Affiliate applications table
CREATE TABLE IF NOT EXISTS affiliate_applications (
  _id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  website TEXT,
  reason TEXT,
  status TEXT DEFAULT 'pending',
  created_at TEXT NOT NULL
);

-- Affiliate links table
CREATE TABLE IF NOT EXISTS affiliate_links (
  _id TEXT PRIMARY KEY,
  affiliate_id TEXT NOT NULL,
  url TEXT NOT NULL,
  title TEXT NOT NULL,
  clicks INTEGER DEFAULT 0,
  created_at TEXT NOT NULL
);

-- Affiliate clicks table
CREATE TABLE IF NOT EXISTS affiliate_clicks (
  _id TEXT PRIMARY KEY,
  affiliate_id TEXT NOT NULL,
  user_id TEXT,
  clicked_at TEXT NOT NULL
);

-- Affiliate config table
CREATE TABLE IF NOT EXISTS affiliate_config (
  id INTEGER PRIMARY KEY DEFAULT 1,
  enabled INTEGER DEFAULT 0,
  commission_rate REAL DEFAULT 0.1
);

-- Discussions table
CREATE TABLE IF NOT EXISTS discussions (
  _id TEXT PRIMARY KEY,
  course_id TEXT,
  lesson_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  content TEXT NOT NULL,
  votes INTEGER DEFAULT 0,
  is_answer INTEGER DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_discussions_lesson ON discussions(lesson_id);

-- Discussion replies table
CREATE TABLE IF NOT EXISTS discussion_replies (
  _id TEXT PRIMARY KEY,
  discussion_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  content TEXT NOT NULL,
  votes INTEGER DEFAULT 0,
  is_answer INTEGER DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_replies_discussion ON discussion_replies(discussion_id);

-- AI tutor sessions table
CREATE TABLE IF NOT EXISTS ai_tutor_sessions (
  _id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  course_id TEXT,
  lesson_id TEXT,
  messages TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_ai_sessions_user ON ai_tutor_sessions(user_id);

-- Code generations table
CREATE TABLE IF NOT EXISTS code_generations (
  _id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  task TEXT NOT NULL,
  language TEXT NOT NULL,
  generated_code TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_code_gen_language ON code_generations(language);