export interface Category {
  id: string;
  name: string;
  slug: string;
  icon: string;
  course_count: number;
}

export interface Attachment {
  title: string;
  url: string;
}

export interface Lesson {
  id: string;
  title: string;
  order: number;
  duration_seconds: number;
  attachments?: Attachment[];
  language?: string;
  transcript?: string;
  description?: string;
  starter_code?: string;
}

export interface Instructor {
  name: string;
  avatar_url?: string;
  bio?: string;
}

export interface Course {
  id: string;
  category_id: string;
  category_slug: string;
  category_name: string;
  title: string;
  slug: string;
  description: string;
  image_url?: string;
  instructor?: Instructor;
  lesson_count: number;
  syllabus: Lesson[];
  outcome: string[];
  total_duration_seconds?: number;
}

export interface User {
  id: string;
  email: string;
  name?: string;
  role: "user" | "admin";
  phone?: string | null;
  phone_verified?: boolean;
  trial_active?: boolean;
  trial_expires?: string | null;
  subscription_status?: string;
}

export interface SubscriptionTier {
  id: string;
  label: string;
  price_per_month: number;
  duration_months: number;
  badge?: string;
  recommended?: boolean;
}

export interface Subscription {
  id: string;
  tier: string;
  status: string;
  starts_at: string;
  ends_at: string;
}

export interface Review {
  id: string;
  name: string;
  role: string;
  quote: string;
  outcome: string;
  rating?: number;
}

export interface Progress {
  id: string;
  user_id: string;
  course_id: string;
  lesson_id: string;
  completed: boolean;
  last_position_seconds: number;
  note?: string;
  updated_at: string;
}

export interface Certificate {
  id: string;
  user_id: string;
  course_id: string;
  course_title: string;
  user_name: string;
  completed_at: string;
  verification_code: string;
  hours: number;
}

export interface CertificateVerification {
  valid: boolean;
  verification_code: string;
  id?: string;
  user_name?: string;
  course_title?: string;
  completed_at?: string;
  hours?: number;
}

export interface Discussion {
  id: string;
  lesson_id: string;
  course_id: string;
  user_id: string;
  user_name: string;
  user_role: string;
  title: string;
  content: string;
  reply_count: number;
  vote_score: number;
  user_vote: number;
  is_pinned: boolean;
  is_locked: boolean;
  created_at: string;
  updated_at: string;
}

export interface Reply {
  id: string;
  discussion_id: string;
  user_id: string;
  user_name: string;
  user_role: string;
  content: string;
  parent_reply_id?: string;
  vote_score: number;
  user_vote: number;
  is_instructor_answer: boolean;
  created_at: string;
  updated_at: string;
}

export interface PaginatedDiscussions {
  items: Discussion[];
  page: number;
  per_page: number;
  total: number;
  total_pages: number;
}

export interface PaginatedReplies {
  items: Reply[];
  page: number;
  per_page: number;
  total: number;
  total_pages: number;
}

export interface Coupon {
  discount_value: number;
}

export interface CheckoutSessionResponse {
  provider: "stripe" | "paypal";
  order?: {
    order_id: string;
    approval_url?: string;
  };
  session_url?: string;
}

export interface StreamToken {
  stream_url: string;
  expires_in: number;
}

export interface LearningPathCourse {
  id: string;
  title: string;
  slug: string;
  description: string;
  image_url?: string;
  category_slug: string;
  lesson_count: number;
  instructor_name: string;
  order: number;
}

export interface LearningPath {
  id: string;
  title: string;
  slug: string;
  short_description: string;
  description: string;
  goal: string;
  duration_months: number;
  skill_level: string;
  icon: string;
  course_count: number;
  outcome: string[];
  related_careers: string[];
  courses?: LearningPathCourse[];
  total_lessons?: number;
  progress?: {
    completed_courses: number;
    total_courses: number;
    percent: number;
    status: string;
    enrolled_at: string;
  };
}

// Auto-generated types from OpenAPI schema (via openapi-typescript)
export type { paths } from "./api";
