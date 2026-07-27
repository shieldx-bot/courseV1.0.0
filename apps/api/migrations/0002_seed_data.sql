-- Categories seed data
INSERT OR IGNORE INTO categories (_id, name, slug, icon, description, created_at) VALUES
  ('cat-marketing', 'Marketing & Advertising', 'marketing', 'briefcase', 'Learn marketing strategies and advertising techniques', datetime('now')),
  ('cat-ai', 'AI & New Technology', 'ai', 'brain', 'Explore artificial intelligence and emerging technologies', datetime('now')),
  ('cat-programming', 'Programming & Software', 'programming', 'code', 'Master programming languages and software development', datetime('now')),
  ('cat-design', 'Design & Creative', 'design', 'palette', 'Develop design skills and creative thinking', datetime('now')),
  ('cat-data', 'Data & Analytics', 'data', 'database', 'Learn data analysis, visualization, and analytics', datetime('now')),
  ('cat-business', 'Business & Investment', 'business', 'bar-chart', 'Build business acumen and investment knowledge', datetime('now')),
  ('cat-career', 'Career & Professional Skills', 'career', 'users', 'Advance your career with professional development skills', datetime('now'));

-- Tiers seed data
INSERT OR IGNORE INTO tiers (_id, name, slug, price, interval, features, created_at) VALUES
  ('tier-1mo', 'Try it out', '1mo', 49, 'month', '["Access to all courses", "Certificate of completion", "Community access"]', datetime('now')),
  ('tier-3mo', 'For one focused skill', '3mo', 39, 'month', '["Access to all courses", "Certificate of completion", "Community access", "Priority support"]', datetime('now')),
  ('tier-6mo', 'For a career pivot', '6mo', 35, 'month', '["Access to all courses", "Certificate of completion", "Community access", "Priority support", "Career coaching"]', datetime('now')),
  ('tier-12mo', 'For serious learners', '12mo', 29, 'month', '["Access to all courses", "Certificate of completion", "Community access", "Priority support", "Career coaching", "1-on-1 mentoring"]', datetime('now')),
  ('tier-lifetime', 'Pay once, learn forever', 'lifetime', 999, 'month', '["Lifetime access to all courses", "Certificate of completion", "Community access", "Priority support", "Career coaching", "1-on-1 mentoring", "All future courses"]', datetime('now'));

-- Affiliate config
INSERT OR IGNORE INTO affiliate_config (id, enabled, commission_rate) VALUES (1, 0, 0.1);

-- Sample courses
INSERT OR IGNORE INTO courses (_id, title, description, slug, image_url, category_slug, price, duration_minutes, level, created_at) VALUES
  ('course-1', 'Complete Web Development Bootcamp', 'Learn HTML, CSS, JavaScript, React, Node.js and more', 'complete-web-development-bootcamp', '/images/course-1.jpg', 'programming', 0, 1200, 'beginner', datetime('now')),
  ('course-2', 'AI Fundamentals with Python', 'Introduction to AI and Machine Learning with Python', 'ai-fundamentals-python', '/images/course-2.jpg', 'ai', 0, 600, 'beginner', datetime('now')),
  ('course-3', 'Digital Marketing Mastery', 'Complete guide to digital marketing strategies', 'digital-marketing-mastery', '/images/course-3.jpg', 'marketing', 0, 480, 'beginner', datetime('now')),
  ('course-4', 'UI/UX Design Principles', 'Learn user interface and user experience design', 'ui-ux-design-principles', '/images/course-4.jpg', 'design', 0, 360, 'beginner', datetime('now')),
  ('course-5', 'Data Analysis with Python', 'Learn data analysis using pandas, numpy, and matplotlib', 'data-analysis-python', '/images/course-5.jpg', 'data', 0, 540, 'beginner', datetime('now'));

-- Sample lessons
INSERT OR IGNORE INTO lessons (_id, course_id, title, description, video_url, duration_minutes, order_index, created_at) VALUES
  ('lesson-1-1', 'course-1', 'Introduction to HTML', 'Learn the basics of HTML', 'https://example.com/video1.mp4', 30, 1, datetime('now')),
  ('lesson-1-2', 'course-1', 'CSS Fundamentals', 'Style your web pages with CSS', 'https://example.com/video2.mp4', 45, 2, datetime('now')),
  ('lesson-1-3', 'course-1', 'JavaScript Basics', 'Introduction to JavaScript programming', 'https://example.com/video3.mp4', 60, 3, datetime('now')),
  ('lesson-2-1', 'course-2', 'What is AI?', 'Understanding artificial intelligence', 'https://example.com/ai1.mp4', 30, 1, datetime('now')),
  ('lesson-2-2', 'course-2', 'Python for AI', 'Setting up Python for AI development', 'https://example.com/ai2.mp4', 45, 2, datetime('now'));

-- Sample reviews
INSERT OR IGNORE INTO reviews (_id, name, role, rating, outcome, quote, created_at) VALUES
  ('review-1', 'Sarah Johnson', 'Frontend Developer', 5, 'Got promoted', 'This course changed my career!', datetime('now')),
  ('review-2', 'Mike Chen', 'Data Scientist', 5, 'New job', 'Best investment I ever made', datetime('now')),
  ('review-3', 'Emily Davis', 'Marketing Manager', 4, 'Improved skills', 'Great content and practical exercises', datetime('now'));

-- Sample blog posts
INSERT OR IGNORE INTO blog (_id, title, slug, excerpt, content, image_url, published_at, created_at) VALUES
  ('blog-1', 'Getting Started with Web Development', 'getting-started-web-development', 'A beginner guide to web development', 'Full content here...', '/images/blog-1.jpg', datetime('now'), datetime('now')),
  ('blog-2', 'AI Trends in 2024', 'ai-trends-2024', 'Top AI trends to watch this year', 'Full content here...', '/images/blog-2.jpg', datetime('now'), datetime('now'));

-- Sample learning paths
INSERT OR IGNORE INTO learning_paths (_id, title, slug, description, goal, duration_weeks, created_at) VALUES
  ('lp-1', 'Full Stack Developer Path', 'full-stack-developer', 'Become a full stack developer', 'Get hired as a full stack developer', 24, datetime('now')),
  ('lp-2', 'Data Scientist Path', 'data-scientist', 'Become a data scientist', 'Get hired as a data scientist', 20, datetime('now'));