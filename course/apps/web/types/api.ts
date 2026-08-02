// ⚠️ AUTO-GENERATED — do not edit manually
// Regenerate: python apps/api/scripts/generate_api_types.py

// ── Auto-generated from OpenAPI schema — do not edit manually ──
// Regenerate with: python apps/api/scripts/generate_api_types.py

export interface AttachmentIn {
  title: string;
  url: string;
}

export interface AuthIn {
  email: string;
  password: string;
  name?: string | unknown;
}

export interface ChangePasswordIn {
  old_password: string;
  new_password: string;
}

export interface CheckoutIn {
  tier_id: string;
  coupon_code?: string | unknown;
  payment_provider?: string;
}

export interface ContactIn {
  name: string;
  email: string;
  subject: string;
  message: string;
}

export interface CouponIn {
  code: string;
  discount_type?: string;
  discount_value: number;
  max_uses?: number | unknown;
  expires_at?: string | unknown;
}

export interface CourseIn {
  category_id: string;
  title: string;
  slug: string;
  description: string;
  image_url?: string | unknown;
  instructor?: InstructorIn | unknown;
  syllabus?: LessonIn[];
  outcome?: string[];
}

export interface DriveImportAllIn {
  category_id: string;
  courses: DriveImportAllItem[];
}

export interface DriveImportAllItem {
  folder_id: string;
  title?: string | unknown;
  slug?: string | unknown;
  video_ids?: string[] | unknown;
}

export interface DriveImportIn {
  folder_id: string;
  category_id: string;
  title?: string | unknown;
  slug?: string | unknown;
  video_ids?: string[] | unknown;
}

export interface DriveMapIn {
  drive_file_id: string;
  r2_key?: string | unknown;
}

export interface DriveScanIn {
  category_folder_id: string;
}

export interface ForgotPasswordIn {
  email: string;
}

export interface GoogleAuthIn {
  token: string;
}

export interface InstructorIn {
  name: string;
  bio?: string | unknown;
}

export interface LessonIn {
  title: string;
  order: number;
  duration_seconds: number;
  drive_file_id?: string | unknown;
  r2_key?: string | unknown;
  attachments?: AttachmentIn[];
}

export interface LessonR2UpdateIn {
  r2_key: string;
}

export interface OTPRequest {
  phone: string;
}

export interface OTPVerify {
  phone: string;
  code: string;
}

export interface ProfileUpdate {
  name?: string | unknown;
}

export interface ProgressUpdate {
  completed?: boolean;
  last_position_seconds?: number;
  note?: string | unknown;
}

export interface R2MigrateLessonIn {
  drive_file_id: string;
  watermark_text?: string | unknown;
}

export interface ResetPasswordIn {
  email: string;
  token: string;
  new_password: string;
}

export interface ReviewIn {
  name: string;
  role: string;
  rating: number;
  outcome: string;
  quote: string;
}

export interface SubscriptionOverrideIn {
  tier_id: string;
  duration_months?: number | unknown;
  ends_at?: string | unknown;
  status?: string;
}

export interface UserUpdateIn {
  name?: string | unknown;
  role?: string | unknown;
}

export interface ValidationError {
  loc: string | number[];
  msg: string;
  type: string;
}

export interface ApiPaths {
  /** admin: Analytics Forecast */
  "GET /api/v1/admin/analytics/forecast": {
  };

  /** admin: Analytics Summary */
  "GET /api/v1/admin/analytics/summary": {
  };

  /** admin: Run Email Campaigns */
  "POST /api/v1/admin/campaigns/run": {
  };

  /** admin: Campaign Stats */
  "GET /api/v1/admin/campaigns/stats": {
  };

  /** contact: List Contacts */
  "GET /api/v1/admin/contacts": {
  };

  /** admin: List Coupons */
  "GET /api/v1/admin/coupons": {
  };

  /** admin: Create Coupon */
  "POST /api/v1/admin/coupons": {
    requestBody: CouponIn;
  };

  /** admin: Delete Coupon */
  "DELETE /api/v1/admin/coupons/${coupon_id}": {
    parameters: {
      "coupon_id": string;
    };
  };

  /** admin: List Courses Admin */
  "GET /api/v1/admin/courses": {
  };

  /** admin: Create Course */
  "POST /api/v1/admin/courses": {
    requestBody: CourseIn;
  };

  /** admin: Get Course Admin */
  "GET /api/v1/admin/courses/${course_id}": {
    parameters: {
      "course_id": string;
    };
  };

  /** admin: Update Course */
  "PUT /api/v1/admin/courses/${course_id}": {
    parameters: {
      "course_id": string;
    };
    requestBody: CourseIn;
  };

  /** admin: Delete Course */
  "DELETE /api/v1/admin/courses/${course_id}": {
    parameters: {
      "course_id": string;
    };
  };

  /** admin: Generate Course Ai Content */
  "POST /api/v1/admin/courses/${course_id}/generate-content": {
    parameters: {
      "course_id": string;
    };
  };

  /** admin: Add Lesson */
  "POST /api/v1/admin/courses/${course_id}/lessons": {
    parameters: {
      "course_id": string;
    };
    requestBody: LessonIn;
  };

  /** admin: Delete Lesson */
  "DELETE /api/v1/admin/courses/${course_id}/lessons/${lesson_id}": {
    parameters: {
      "course_id": string;
      "lesson_id": string;
    };
  };

  /** admin: Map Lesson Drive File */
  "PUT /api/v1/admin/courses/${course_id}/lessons/${lesson_id}/drive": {
    parameters: {
      "course_id": string;
      "lesson_id": string;
    };
    requestBody: DriveMapIn;
  };

  /** admin: Map Lesson R2 Key */
  "PUT /api/v1/admin/courses/${course_id}/lessons/${lesson_id}/r2": {
    parameters: {
      "course_id": string;
      "lesson_id": string;
    };
    requestBody: LessonR2UpdateIn;
  };

  /** admin: Migrate Course To R2 */
  "POST /api/v1/admin/courses/${course_id}/migrate-to-r2": {
    parameters: {
      "course_id": string;
    };
  };

  /** admin: Dashboard Kpis */
  "GET /api/v1/admin/dashboard": {
  };

  /** admin: List Drive Files */
  "GET /api/v1/admin/drive/files": {
  };

  /** admin: Import Drive Course */
  "POST /api/v1/admin/drive/import": {
    requestBody: DriveImportIn;
  };

  /** admin: Import Drive Courses All */
  "POST /api/v1/admin/drive/import-all": {
    requestBody: DriveImportAllIn;
  };

  /** admin: Scan Drive */
  "POST /api/v1/admin/drive/scan": {
    requestBody: DriveScanIn;
  };

  /** admin: Migrate Lesson To R2 */
  "POST /api/v1/admin/lessons/${lesson_id}/migrate-to-r2": {
    parameters: {
      "lesson_id": string;
    };
    requestBody: R2MigrateLessonIn;
  };

  /** admin: List Orders */
  "GET /api/v1/admin/orders": {
    parameters: {
      "search"?: string;
      "status"?: string;
      "provider"?: string;
    };
  };

  /** admin: Refund Order */
  "POST /api/v1/admin/orders/${order_id}/refund": {
    parameters: {
      "order_id": string;
    };
  };

  /** admin: Delete R2 Video */
  "DELETE /api/v1/admin/r2/lessons/${lesson_id}": {
    parameters: {
      "lesson_id": string;
    };
  };

  /** admin: Set R2 Lifecycle */
  "POST /api/v1/admin/r2/set-lifecycle": {
  };

  /** admin: R2 Storage Status */
  "GET /api/v1/admin/r2/status": {
  };

  /** subscriptions: Send Renewal Reminders */
  "POST /api/v1/admin/renewal-reminders": {
    parameters: {
      "days"?: number;
    };
  };

  /** admin: Upload Video To R2 */
  "POST /api/v1/admin/upload/${lesson_id}": {
    parameters: {
      "lesson_id": string;
    };
  };

  /** admin: List Users */
  "GET /api/v1/admin/users": {
    parameters: {
      "search"?: string;
      "role"?: string;
    };
  };

  /** admin: Get User */
  "GET /api/v1/admin/users/${user_id}": {
    parameters: {
      "user_id": string;
    };
  };

  /** admin: Update User */
  "PUT /api/v1/admin/users/${user_id}": {
    parameters: {
      "user_id": string;
    };
    requestBody: UserUpdateIn;
  };

  /** admin: Override Subscription */
  "POST /api/v1/admin/users/${user_id}/subscription": {
    parameters: {
      "user_id": string;
    };
    requestBody: SubscriptionOverrideIn;
  };

  /** admin: Cancel User Subscription */
  "DELETE /api/v1/admin/users/${user_id}/subscription": {
    parameters: {
      "user_id": string;
    };
  };

  /** auth: Forgot Password */
  "POST /api/v1/auth/forgot-password": {
    requestBody: ForgotPasswordIn;
  };

  /** auth: Google Auth */
  "POST /api/v1/auth/google": {
    requestBody: GoogleAuthIn;
  };

  /** auth: Login */
  "POST /api/v1/auth/login": {
    requestBody: AuthIn;
  };

  /** auth: Logout */
  "POST /api/v1/auth/logout": {
  };

  /** auth: Get Me */
  "GET /api/v1/auth/me": {
  };

  /** auth: Update Me */
  "PUT /api/v1/auth/me": {
    requestBody: ProfileUpdate;
  };

  /** auth: Change Password */
  "PUT /api/v1/auth/me/password": {
    requestBody: ChangePasswordIn;
  };

  /** auth: Request Otp */
  "POST /api/v1/auth/otp/request": {
    requestBody: OTPRequest;
  };

  /** auth: Verify Otp */
  "POST /api/v1/auth/otp/verify": {
    requestBody: OTPVerify;
  };

  /** auth: Refresh Token */
  "POST /api/v1/auth/refresh": {
  };

  /** auth: Reset Password */
  "POST /api/v1/auth/reset-password": {
    requestBody: ResetPasswordIn;
  };

  /** auth: Signup */
  "POST /api/v1/auth/signup": {
    requestBody: AuthIn;
  };

  /** blog: List Posts */
  "GET /api/v1/blog": {
  };

  /** blog: Get Post */
  "GET /api/v1/blog/${slug}": {
    parameters: {
      "slug": string;
    };
  };

  /** courses: List Categories */
  "GET /api/v1/categories": {
  };

  /** courses: Get Category */
  "GET /api/v1/categories/${slug}": {
    parameters: {
      "slug": string;
    };
  };

  /** subscriptions: Capture Paypal */
  "POST /api/v1/checkout/paypal/capture": {
    parameters: {
      "order_id": string;
    };
  };

  /** subscriptions: Create Checkout */
  "POST /api/v1/checkout/session": {
    requestBody: CheckoutIn;
  };

  /** contact: Submit Contact */
  "POST /api/v1/contact": {
    requestBody: ContactIn;
  };

  /** courses: List Courses */
  "GET /api/v1/courses": {
    parameters: {
      "search"?: string;
      "category"?: string;
      "sort_by"?: string;
      "page"?: number;
      "per_page"?: number;
    };
  };

  /** courses: Similar Courses */
  "GET /api/v1/courses/${course_id}/similar": {
    parameters: {
      "course_id": string;
      "limit"?: number;
    };
  };

  /** courses: Get Course */
  "GET /api/v1/courses/${slug}": {
    parameters: {
      "slug": string;
    };
  };

  /** default: Health */
  "GET /api/v1/health": {
  };

  /** default: Health Ready */
  "GET /api/v1/health/ready": {
  };

  /** stream: Create Stream Token */
  "POST /api/v1/lessons/${lesson_id}/stream-token": {
    parameters: {
      "lesson_id": string;
    };
  };

  /** progress: List Progress */
  "GET /api/v1/progress": {
  };

  /** progress: Get Continue */
  "GET /api/v1/progress/continue": {
  };

  /** progress: Get Progress Summary */
  "GET /api/v1/progress/summary": {
  };

  /** progress: Get Progress */
  "GET /api/v1/progress/${lesson_id}": {
    parameters: {
      "lesson_id": string;
    };
  };

  /** progress: Update Progress */
  "PUT /api/v1/progress/${lesson_id}": {
    parameters: {
      "lesson_id": string;
    };
    requestBody: ProgressUpdate;
  };

  /** courses: Recommendations */
  "GET /api/v1/recommendations": {
    parameters: {
      "limit"?: number;
    };
  };

  /** reviews: List Reviews */
  "GET /api/v1/reviews": {
  };

  /** courses: Create Review */
  "POST /api/v1/reviews": {
    requestBody: ReviewIn;
  };

  /** courses: Public Stats */
  "GET /api/v1/stats": {
  };

  /** subscriptions: Cancel My Subscription */
  "POST /api/v1/subscriptions/cancel": {
  };

  /** subscriptions: Validate Coupon */
  "GET /api/v1/subscriptions/coupons/${code}": {
    parameters: {
      "code": string;
    };
  };

  /** subscriptions: Get My Subscription */
  "GET /api/v1/subscriptions/me": {
  };

  /** subscriptions: Get My Orders */
  "GET /api/v1/subscriptions/orders": {
  };

  /** subscriptions: List Tiers */
  "GET /api/v1/subscriptions/tiers": {
  };

  /** subscriptions: Paypal Webhook */
  "POST /api/v1/webhooks/paypal": {
  };

  /** subscriptions: Stripe Webhook */
  "POST /api/v1/webhooks/stripe": {
  };

  /** worker: Dlq List */
  "GET /api/v1/worker/dlq": {
    parameters: {
      "limit"?: number;
    };
  };

  /** worker: Dlq Clear */
  "POST /api/v1/worker/dlq/clear": {
  };

  /** worker: Dlq Requeue */
  "POST /api/v1/worker/dlq/requeue/${index}": {
    parameters: {
      "index": number;
    };
  };

  /** worker: Worker Health */
  "GET /api/v1/worker/health": {
  };

  /** worker: Worker Queue Depth */
  "GET /api/v1/worker/queue": {
  };

  /** default: Metrics */
  "GET /metrics": {
  };

}

export type paths = ApiPaths;
