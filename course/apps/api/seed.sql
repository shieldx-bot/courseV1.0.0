-- Seed data for Ascendly

-- Admin user (password: password123)
INSERT INTO users (_id, email, name, password_hash, role, created_at) VALUES
  ('user-admin-1', 'admin@ascendly.io', 'Admin User', '2250a0e98a3bd5b55d4e3d1db45780268fdfce7941016104f4f896bb97949629', 'admin', '2026-01-01T00:00:00Z');

-- Categories
INSERT INTO categories (_id, name, slug, icon, description, created_at) VALUES
  ('cat-1', 'Business', 'business', '💼', 'Learn business fundamentals', '2026-01-01T00:00:00Z'),
  ('cat-2', 'Technology', 'technology', '💻', 'Master modern tech skills', '2026-01-01T00:00:00Z'),
  ('cat-3', 'Design', 'design', '🎨', 'Unlock your creative potential', '2026-01-01T00:00:00Z'),
  ('cat-4', 'Data Science', 'data-science', '📊', 'Analyze data like a pro', '2026-01-01T00:00:00Z');

-- Courses
INSERT INTO courses (_id, title, description, slug, image_url, category_slug, price, duration_minutes, level, created_at) VALUES
  ('course-1', 'Business Fundamentals', 'Learn core business concepts', 'business-fundamentals', 'https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?w=800', 'business', 49, 120, 'beginner', '2026-01-01T00:00:00Z'),
  ('course-2', 'Web Development Bootcamp', 'Full-stack web development', 'web-development-bootcamp', 'https://images.unsplash.com/photo-1498050108023-c5249f4df08a?w=800', 'technology', 79, 300, 'beginner', '2026-01-01T00:00:00Z'),
  ('course-3', 'UI/UX Design Mastery', 'Design beautiful interfaces', 'uiux-design-mastery', 'https://images.unsplash.com/photo-1561070791-2526d30994b5?w=800', 'design', 59, 180, 'intermediate', '2026-01-01T00:00:00Z'),
  ('course-4', 'Data Analysis with Python', 'Analyze data using Python', 'data-analysis-python', 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=800', 'data-science', 69, 240, 'intermediate', '2026-01-01T00:00:00Z');

-- Lessons
INSERT INTO lessons (_id, course_id, title, description, video_url, duration_minutes, order_index, created_at) VALUES
  ('lesson-1', 'course-1', 'Introduction to Business', 'Overview of business basics', 'https://example.com/video1.mp4', 15, 1, '2026-01-01T00:00:00Z'),
  ('lesson-2', 'course-1', 'Business Models', 'Understanding business models', 'https://example.com/video2.mp4', 20, 2, '2026-01-01T00:00:00Z'),
  ('lesson-3', 'course-2', 'HTML & CSS Basics', 'Learn HTML and CSS', 'https://example.com/video3.mp4', 30, 1, '2026-01-01T00:00:00Z'),
  ('lesson-4', 'course-2', 'JavaScript Fundamentals', 'Learn JavaScript', 'https://example.com/video4.mp4', 45, 2, '2026-01-01T00:00:00Z');

-- Reviews
INSERT INTO reviews (_id, name, role, rating, outcome, quote, created_at) VALUES
  ('review-1', 'Sarah Chen', 'Product Manager', 5, 'Promoted within 3 months', 'Ascendly transformed my career. The courses are world-class.', '2026-01-15T00:00:00Z'),
  ('review-2', 'Marcus Johnson', 'Software Engineer', 5, 'Landed a FAANG job', 'The structured learning paths made all the difference.', '2026-02-01T00:00:00Z'),
  ('review-3', 'Emily Rodriguez', 'Designer', 4, 'Started freelance business', 'Worth every penny. Best investment in myself.', '2026-02-15T00:00:00Z');

-- Blog posts
INSERT INTO blog (_id, title, slug, excerpt, content, image_url, published_at, created_at) VALUES
  ('blog-1', 'How to Learn Faster', 'how-to-learn-faster', 'Science-backed techniques to accelerate your learning.', 'Full content here...', 'https://images.unsplash.com/photo-1456513080510-7bf3a84b82f8?w=800', '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z'),
  ('blog-2', 'Top Skills for 2026', 'top-skills-for-2026', 'The most in-demand skills this year.', 'Full content here...', 'https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?w=800', '2026-01-15T00:00:00Z', '2026-01-15T00:00:00Z');

-- Subscription tiers
INSERT INTO tiers (_id, name, slug, price, interval, features, created_at) VALUES
  ('tier-1', 'Monthly', 'monthly', 29, 'month', '["Access to all courses", "Mobile access", "Certificate of completion"]', '2026-01-01T00:00:00Z'),
  ('tier-2', 'Yearly', 'yearly', 199, 'year', '["Access to all courses", "Mobile access", "Certificate of completion", "Priority support", "Offline downloads"]', '2026-01-01T00:00:00Z');

-- Coupons
INSERT INTO coupons (_id, code, discount_type, discount_value, max_uses, used_count, expires_at, created_at) VALUES
  ('coupon-1', 'WELCOME10', 'percent', 10, 100, 0, '2026-12-31T23:59:59Z', '2026-01-01T00:00:00Z');

-- Learning paths
INSERT INTO learning_paths (_id, title, slug, description, goal, duration_weeks, created_at) VALUES
  ('path-1', 'Become a Full-Stack Developer', 'full-stack-developer', 'Master frontend and backend development', 'Build production-ready web applications', 12, '2026-01-01T00:00:00Z'),
  ('path-2', 'Data Scientist Career Track', 'data-scientist', 'From basics to advanced data science', 'Become a professional data scientist', 16, '2026-01-01T00:00:00Z');

-- Experiments
INSERT INTO experiments (_id, name, slug, description, variant, active, created_at) VALUES
  ('exp-1', 'Homepage CTA Test', 'homepage-cta', 'Test different CTA copy', 'control', 1, '2026-01-01T00:00:00Z');
