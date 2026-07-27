-- Seed data for Cloudflare D1

-- Insert default categories
INSERT OR IGNORE INTO categories (_id, name, slug, icon, description, created_at) VALUES
  ('cat-1', 'Web Development', 'web-development', '💻', 'Learn modern web development technologies', '2024-01-01T00:00:00Z'),
  ('cat-2', 'Data Science', 'data-science', '📊', 'Master data analysis and machine learning', '2024-01-01T00:00:00Z'),
  ('cat-3', 'Mobile Development', 'mobile-development', '📱', 'Build iOS and Android applications', '2024-01-01T00:00:00Z'),
  ('cat-4', 'DevOps', 'devops', '🔧', 'Learn CI/CD, Docker, Kubernetes, and cloud platforms', '2024-01-01T00:00:00Z');

-- Insert sample courses
INSERT OR IGNORE INTO courses (_id, title, description, slug, image_url, category_slug, price, duration_minutes, level, created_at) VALUES
  ('course-1', 'Complete Web Development Bootcamp', 'Master HTML, CSS, JavaScript, React, and Node.js', 'complete-web-development-bootcamp', 'https://images.unsplash.com/photo-1498050108023-c5249f4df085?w=800', 'web-development', 99.99, 1200, 'beginner', '2024-01-01T00:00:00Z'),
  ('course-2', 'Advanced React Patterns', 'Learn advanced React patterns and best practices', 'advanced-react-patterns', 'https://images.unsplash.com/photo-1633356122544-f134324a6cee?w=800', 'web-development', 79.99, 800, 'advanced', '2024-01-02T00:00:00Z'),
  ('course-3', 'Python for Data Science', 'Master Python, Pandas, NumPy, and Matplotlib', 'python-for-data-science', 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=800', 'data-science', 89.99, 1000, 'beginner', '2024-01-03T00:00:00Z'),
  ('course-4', 'Machine Learning Fundamentals', 'Understand ML algorithms and implement them', 'machine-learning-fundamentals', 'https://images.unsplash.com/photo-1555949963-ff9fe0c870eb?w=800', 'data-science', 129.99, 1500, 'intermediate', '2024-01-04T00:00:00Z'),
  ('course-5', 'iOS Development with Swift', 'Build iOS apps from scratch', 'ios-development-swift', 'https://images.unsplash.com/photo-1512941937669-90a1b58e7e9c?w=800', 'mobile-development', 109.99, 1100, 'beginner', '2024-01-05T00:00:00Z');

-- Insert sample lessons
INSERT OR IGNORE INTO lessons (_id, course_id, title, description, video_url, duration_minutes, order_index, created_at) VALUES
  ('lesson-1', 'course-1', 'Introduction to HTML', 'Learn the basics of HTML structure', 'https://example.com/videos/html-intro.mp4', 30, 1, '2024-01-01T00:00:00Z'),
  ('lesson-2', 'course-1', 'CSS Fundamentals', 'Master CSS styling and layouts', 'https://example.com/videos/css-fundamentals.mp4', 45, 2, '2024-01-01T00:00:00Z'),
  ('lesson-3', 'course-1', 'JavaScript Basics', 'Learn JavaScript programming fundamentals', 'https://example.com/videos/js-basics.mp4', 60, 3, '2024-01-01T00:00:00Z'),
  ('lesson-4', 'course-2', 'Compound Components', 'Build flexible UI components', 'https://example.com/videos/compound-components.mp4', 40, 1, '2024-01-02T00:00:00Z'),
  ('lesson-5', 'course-3', 'Python Setup', 'Install and configure Python environment', 'https://example.com/videos/python-setup.mp4', 20, 1, '2024-01-03T00:00:00Z');

-- Insert sample reviews
INSERT OR IGNORE INTO reviews (_id, name, role, rating, outcome, quote, created_at) VALUES
  ('review-1', 'John Doe', 'Software Engineer', 5, 'Landed a job at Google', 'This course completely transformed my career. The instructors are world-class!', '2024-01-01T00:00:00Z'),
  ('review-2', 'Jane Smith', 'Data Scientist', 5, 'Promoted to Senior Data Scientist', 'The most comprehensive course I have ever taken. Worth every penny!', '2024-01-02T00:00:00Z'),
  ('review-3', 'Mike Johnson', 'Freelance Developer', 5, 'Increased income by 300%', 'I went from zero coding knowledge to building full-stack applications in 6 months.', '2024-01-03T00:00:00Z');

-- Insert subscription tiers
INSERT OR IGNORE INTO tiers (_id, name, slug, price, interval, features, created_at) VALUES
  ('tier-1', 'Basic', 'basic', 29.99, 'month', '["Access to 50+ courses", "Basic support", "Mobile access"]', '2024-01-01T00:00:00Z'),
  ('tier-2', 'Pro', 'pro', 79.99, 'month', '["Access to 200+ courses", "Priority support", "Mobile access", "Certificates", "Projects"]', '2024-01-01T00:00:00Z'),
  ('tier-3', 'Enterprise', 'enterprise', 199.99, 'month', '["Unlimited access", "24/7 support", "Mobile access", "Certificates", "Projects", "1-on-1 mentoring"]', '2024-01-01T00:00:00Z');

-- Insert sample blog posts
INSERT OR IGNORE INTO blog (_id, title, slug, excerpt, content, image_url, published_at, created_at) VALUES
  ('blog-1', 'Getting Started with Cloudflare Workers', 'getting-started-cloudflare-workers', 'Learn how to deploy serverless functions at the edge', 'Full content here...', 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=800', '2024-01-01T00:00:00Z', '2024-01-01T00:00:00Z'),
  ('blog-2', 'The Future of Web Development', 'future-of-web-development', 'Explore emerging trends in web development', 'Full content here...', 'https://images.unsplash.com/photo-1518770660439-4636190af475?w=800', '2024-01-05T00:00:00Z', '2024-01-05T00:00:00Z');

-- Insert sample learning paths
INSERT OR IGNORE INTO learning_paths (_id, title, slug, description, goal, duration_weeks, created_at) VALUES
  ('path-1', 'Become a Full-Stack Developer', 'become-fullstack-developer', 'Complete path from beginner to full-stack developer', 'Career change', 24, '2024-01-01T00:00:00Z'),
  ('path-2', 'Data Science Career Path', 'data-science-career-path', 'Master data science from basics to advanced', 'Career advancement', 20, '2024-01-02T00:00:00Z'),
  ('path-3', 'Mobile App Developer', 'mobile-app-developer', 'Build iOS and Android apps', 'New career', 18, '2024-01-03T00:00:00Z');

-- Insert sample experiments
INSERT OR IGNORE INTO experiments (_id, name, slug, description, variant, active, created_at) VALUES
  ('exp-1', 'Homepage Redesign', 'homepage-redesign', 'Test new homepage layout', 'variant-a', 1, '2024-01-01T00:00:00Z'),
  ('exp-2', 'Pricing Page Test', 'pricing-page-test', 'Test different pricing displays', 'control', 0, '2024-01-02T00:00:00Z');

-- Insert affiliate config
INSERT OR IGNORE INTO affiliate_config (id, enabled, commission_rate) VALUES
  (1, 1, 0.10);