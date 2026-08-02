export type Env = {
  DB: D1Database;
  CACHE: KVNamespace;
  R2_BUCKET: R2Bucket;
  JWT_SECRET: string;
  BACKGROUND_QUEUE: Queue;
  RATE_LIMITER: DurableObjectNamespace;
  ENVIRONMENT: string;
  FRONTEND_URL: string;
  API_BASE_URL: string;
  JWT_ACCESS_EXPIRE_MINUTES: string;
  JWT_REFRESH_EXPIRE_DAYS: string;
  R2_BUCKET_NAME: string;
  R2_SIGNED_URL_EXPIRY_SECONDS: string;
  R2_AUTO_DELETE_DAYS: string;
  WORKER_MAX_RETRIES: string;
  WORKER_KEEP_RESULT_SECONDS: string;
  WORKER_POLL_DELAY: string;
  WORKER_MAX_BURST_JOBS: string;
};

export type Variables = {
  user: UserPayload;
};

export interface ApiResponse<T = any> {
  success: boolean;
  data: T;
  error: string | null;
  meta: any | null;
}

export interface UserPayload {
  sub: string;
  email: string;
  role: string;
  type: string;
}

export interface User {
  _id: string;
  email: string;
  name: string;
  role: string;
  password_hash?: string;
  phone?: string | null;
  phone_verified?: boolean;
  trial_active?: boolean;
  trial_expires?: string | null;
  created_at: string;
}

export interface Course {
  _id: string;
  category_id: string;
  category_slug: string;
  category_name: string;
  title: string;
  slug: string;
  description: string;
  image_url: string;
  instructor?: any;
  lesson_count: number;
  syllabus: Lesson[];
  outcome: string[];
  created_at?: string;
}

export interface Lesson {
  id: string;
  title: string;
  order: number;
  duration_seconds: number;
  drive_file_id?: string | null;
  r2_key?: string | null;
  language?: string | null;
  starter_code?: string | null;
  solution_code?: string | null;
  test_cases?: string | null;
  attachments?: any[];
}

export interface Category {
  _id: string;
  name: string;
  slug: string;
  icon: string;
  description: string;
  course_count: number;
}

export interface Subscription {
  _id: string;
  user_id: string;
  tier: string;
  status: string;
  starts_at: string;
  ends_at: string;
  updated_at?: string;
  cancelled_at?: string;
}

export interface Order {
  _id: string;
  user_id: string;
  subscription_id?: string;
  amount: number;
  currency: string;
  coupon_code?: string | null;
  payment_provider: string;
  payment_status: string;
  external_id?: string;
  created_at: string;
  refunded_at?: string;
  refund_error?: string | null;
}

export interface Tier {
  _id: string;
  id?: string;
  label: string;
  price_per_month: number;
  duration_months: number;
  features: string[];
}

export interface Coupon {
  _id: string;
  code: string;
  discount_type: string;
  discount_value: number;
  max_uses?: number | null;
  used_count: number;
  expires_at?: string | null;
}

export interface Discussion {
  _id: string;
  course_id: string;
  lesson_id: string;
  user_id: string;
  title: string;
  content: string;
  reply_count: number;
  vote_score: number;
  is_pinned: boolean;
  is_locked: boolean;
  created_at: string;
  updated_at: string;
}

export interface DiscussionReply {
  _id: string;
  discussion_id: string;
  user_id: string;
  content: string;
  parent_reply_id?: string | null;
  vote_score: number;
  is_instructor_answer: boolean;
  created_at: string;
  updated_at: string;
}

export interface DiscussionVote {
  _id: string;
  discussion_id: string;
  user_id: string;
  vote: number;
  created_at: string;
}

export interface ReplyVote {
  _id: string;
  reply_id: string;
  user_id: string;
  vote: number;
  created_at: string;
}

export interface Progress {
  _id: string;
  user_id: string;
  course_id?: string;
  lesson_id: string;
  completed: boolean;
  last_position_seconds: number;
  note?: string | null;
  created_at: string;
  updated_at: string;
}

export interface Certificate {
  _id: string;
  user_id: string;
  course_id: string;
  verification_code: string;
  issued_at: string;
}

export interface AITutorSession {
  _id: string;
  user_id: string;
  course_id: string;
  lesson_id: string;
  messages: string;
  created_at: string;
  updated_at: string;
}

export interface Experiment {
  _id: string;
  name: string;
  slug: string;
  description: string;
  active: boolean;
  variants: string[];
  traffic_split: number[];
  created_at: string;
}

export interface ExperimentEvent {
  _id: string;
  experiment_slug: string;
  event_type: string;
  user_id?: string;
  variant_name?: string;
  variant_index?: number;
  metadata: string;
  created_at: string;
}

export interface Referral {
  _id: string;
  user_id: string;
  code: string;
  created_at: string;
}

export interface ReferralApplication {
  _id: string;
  user_id: string;
  referral_code: string;
  applied_at: string;
}

export interface AffiliateApplication {
  _id: string;
  name: string;
  email: string;
  website?: string;
  reason?: string;
  status: string;
  created_at: string;
}

export interface AffiliateLink {
  _id: string;
  affiliate_id: string;
  url: string;
  title: string;
  clicks: number;
  created_at: string;
}

export interface AffiliateClick {
  _id: string;
  affiliate_id: string;
  link_id: string;
  clicked_at: string;
}

export interface Contact {
  _id: string;
  name: string;
  email: string;
  subject: string;
  message: string;
  status: string;
  created_at: string;
}

export interface BlogPost {
  _id: string;
  title: string;
  slug: string;
  content: string;
  published_at: string;
}

export interface Review {
  _id: string;
  name: string;
  role: string;
  rating: number;
  outcome: string;
  quote: string;
  created_at: string;
}

export interface LearningPath {
  _id: string;
  title: string;
  slug: string;
  description: string;
  goal: string;
  courses: string[];
  created_at: string;
}

export interface UserLearningPath {
  _id: string;
  user_id: string;
  path_id: string;
  enrolled_at: string;
  progress: number;
}

export interface CodeGeneration {
  _id: string;
  user_id: string;
  task: string;
  language: string;
  generated_code: string;
  created_at: string;
}

export interface EmailCampaign {
  _id: string;
  campaign_type: string;
  sent_at: string;
}
