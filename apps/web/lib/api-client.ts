import type {
  AuthIn, ChangePasswordIn, CheckoutIn, ForgotPasswordIn, GoogleAuthIn,
  OTPRequest as OTPRequestIn, OTPVerify as OTPVerifyIn, ProfileUpdate,
  ProgressUpdate, ResetPasswordIn, ReviewIn,
} from "@/types/api";
import type {
  Category, Certificate, CertificateVerification, CheckoutSessionResponse, ConceptDefinition,
  Coupon, Course, Discussion, LearningPath, PaginatedDiscussions, PaginatedReplies,
  Progress, Reply, Review, StreamToken, Subscription, SubscriptionTier, User,
  AdminAdaptiveStats, AdminConcept, AdminConceptCreate, AdminConceptUpdate, AdminPrerequisiteGap,
  AdaptiveQuiz, QuizResult, ConceptMastery, CourseMasteryEntry,
  PrerequisiteInfo, RemedialContent, RemediationSuggestion, RecommendedCourseSequence,
  RemedialExerciseResult, SkipLessonResult,
} from "@/types";

const API_ORIGIN = process.env.NEXT_PUBLIC_API_URL || "";
const API_PREFIX = "/api/v1";
export const API_BASE = API_ORIGIN || "";

// ── API envelope & typed errors ─────────────────────────────────────────

export interface ApiEnvelope<TData = unknown> {
  success: boolean;
  data?: TData;
  error?: { code?: string; message?: string } | string;
  meta?: Record<string, unknown>;
}

export class ApiClientError extends Error {
  readonly status: number;
  readonly code?: string;
  readonly meta?: Record<string, unknown>;
  constructor(message: string, status: number, code?: string, meta?: Record<string, unknown>) {
    super(message);
    this.name = "ApiClientError";
    this.status = status;
    this.code = code;
    this.meta = meta;
  }
}

export function isApiSuccess<T = unknown>(value: unknown): value is ApiEnvelope<T> {
  return typeof value === "object" && value !== null && "success" in value && (value as { success?: unknown }).success === true;
}

/** True when `value` looks like the backend envelope (`{ success, ... }`), success or not. */
function isEnvelope(value: unknown): value is ApiEnvelope {
  return typeof value === "object" && value !== null && "success" in (value as Record<string, unknown>);
}

/**
 * Trace correlation (Phase 7 hardening): when the backend middleware echoes an
 * `X-Request-ID` response header, surface it on errors as `meta.request_id` so
 * error pages can display it for tracing. Fully guarded — absent header → no
 * change to the error shape.
 */
function requestIdFromResponse(res: Response): string | undefined {
  const headers = res.headers;
  if (headers && typeof headers.get === "function") {
    const id = headers.get("X-Request-ID");
    if (typeof id === "string" && id.length > 0) return id;
  }
  return undefined;
}

// ── token refresh / single-flight queue ─────────────────────────────────

let _refreshing: Promise<boolean> | null = null;
let _pendingQueue: Array<{ resolve: (v: boolean) => void }> = [];

async function refreshTokens(): Promise<boolean> {
  if (_refreshing) return _refreshing;
  _refreshing = (async () => {
    try {
      const url = `${API_ORIGIN}${API_PREFIX}/auth/refresh`;
      const res = await fetch(url, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" } });
      const ok = res.ok;
      _pendingQueue.forEach((p) => p.resolve(ok));
      return ok;
    } catch {
      _pendingQueue.forEach((p) => p.resolve(false));
      return false;
    } finally {
      _refreshing = null;
      _pendingQueue = [];
    }
  })();
  return _refreshing;
}

function enqueueRefresh(): Promise<boolean> {
  return new Promise((resolve) => {
    if (_refreshing) _pendingQueue.push({ resolve });
    else resolve(refreshTokens());
  });
}

// ── response parsing (typed error path) ─────────────────────────────────

async function parseErrorResponse(res: Response): Promise<ApiClientError> {
  let message = res.statusText || `Request failed (${res.status})`;
  let code: string | undefined;
  let meta: Record<string, unknown> | undefined;
  const requestId = requestIdFromResponse(res);
  try {
    const json = (await res.json()) as unknown;
    if (isEnvelope(json)) {
      const env = json;
      if (typeof env.error === "string") message = env.error;
      else if (env.error && typeof env.error.message === "string") message = env.error.message;
      if (env.error && typeof env.error === "object" && typeof env.error.code === "string") code = env.error.code;
      meta = env.meta;
    }
  } catch {
    const text = await res.text().catch(() => "");
    if (text) message = text;
  }
  if (requestId) meta = { ...(meta ?? {}), request_id: requestId };
  return new ApiClientError(message, res.status, code, meta);
}

async function unwrapResponse<T>(res: Response): Promise<T> {
  const json = (await res.json()) as unknown;
  if (isEnvelope(json)) {
    const env = json as ApiEnvelope<T>;
    if (env.success === true) return env.data as T;
    const message =
      typeof env.error === "string" ? env.error
      : env.error && typeof env.error.message === "string" ? env.error.message
      : `Request failed (${res.status})`;
    const code =
      env.error && typeof env.error === "object" && typeof env.error.code === "string" ? env.error.code : undefined;
    const requestId = requestIdFromResponse(res);
    throw new ApiClientError(message, res.status, code, {
      ...(env.meta ?? {}),
      ...(requestId ? { request_id: requestId } : {}),
    });
  }
  return json as T;
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers);
  if (!headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  const url = `${API_ORIGIN}${API_PREFIX}${path}`;
  const doFetch = () => fetch(url, { ...options, headers, credentials: "include" });

  let res = await doFetch();

  if (res.status === 401 && !path.startsWith("/auth/refresh")) {
    const refreshed = await enqueueRefresh();
    if (refreshed) {
      res = await doFetch();
      if (!res.ok) throw await parseErrorResponse(res);
      if (res.status === 204) return undefined as T;
      return unwrapResponse<T>(res);
    }
    throw new ApiClientError("Session expired. Please log in again.", 401, "SESSION_EXPIRED");
  }

  if (!res.ok) throw await parseErrorResponse(res);
  if (res.status === 204) return undefined as T;
  return unwrapResponse<T>(res);
}

// ── typed request helper ────────────────────────────────────────────────

type HttpMethod = "get" | "post" | "put" | "delete" | "patch";

type TypedRequestOptions<B = unknown> = Omit<RequestInit, "body"> & {
  params?: Record<string, string | number>;
  query?: Record<string, string | number | boolean | null | undefined>;
  body?: B;
};

/**
 * Typed fetch wrapper. `T` is the expected response payload (the generated
 * OpenAPI export does not emit response schemas, so callers pass the shape).
 * `B` is the JSON request body type; it is decoupled from `T` so that the
 * response type is never inferred from the body.
 */
export async function typedRequest<
  M extends HttpMethod,
  P extends string = string,
  T = unknown,
  B = unknown
>(
  method: M,
  path: P,
  options: TypedRequestOptions<B> = {}
): Promise<T> {
  const { params, query, body, ...fetchInit } = options;
  const fetchOptions: RequestInit = { ...fetchInit };
  let finalPath = path as string;
  if (finalPath.includes(" ")) finalPath = finalPath.split(" ").slice(1).join(" ");

  if (params) {
    for (const [key, value] of Object.entries(params)) {
      finalPath = finalPath.replace(`{${key}}`, encodeURIComponent(String(value)));
    }
  }

  if (query) {
    const searchParams = new URLSearchParams();
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined && value !== null) searchParams.append(key, String(value));
    }
    const qs = searchParams.toString();
    if (qs) finalPath = `${finalPath}?${qs}`;
  }

  if (body !== undefined) fetchOptions.body = JSON.stringify(body);
  fetchOptions.method = method.toUpperCase();
  return request<T>(finalPath, fetchOptions);
}

export function apiPath(method: string, path: string): string {
  return `${method.toUpperCase()} ${API_PREFIX}${path}`;
}

// ── Domain client ───────────────────────────────────────────────────────

/** Shape returned by GET /experiments/variant-map (consumed by useExperiments). */
export interface ExperimentVariantMap {
  [slug: string]: { name?: string; variant_name?: string; variant_index?: number };
}

const apiClient = {
  auth: {
    me: () => typedRequest<"get", string, { user: User }>("get", "GET /auth/me"),
    login: (body: AuthIn) => typedRequest<"post", string, { user: User }>("post", "POST /auth/login", { body }),
    logout: () => typedRequest<"post", string, Record<string, unknown>>("post", "POST /auth/logout"),
    signup: (body: AuthIn) => typedRequest<"post", string, { user: User }>("post", "POST /auth/signup", { body }),
    updateProfile: (body: ProfileUpdate | Record<string, unknown>) =>
      typedRequest<"put", string, { user: User }>("put", "PUT /auth/me", { body }),
    changePassword: (body: ChangePasswordIn) => typedRequest<"put", string, Record<string, unknown>>("put", "PUT /auth/me/password", { body }),
    googleLogin: (body: GoogleAuthIn) => typedRequest<"post", string, { user: User }>("post", "POST /auth/google", { body }),
    otpRequest: (body: OTPRequestIn) => typedRequest<"post", string, Record<string, unknown>>("post", "POST /auth/otp/request", { body }),
    otpVerify: (body: OTPVerifyIn) => typedRequest<"post", string, { user: User }>("post", "POST /auth/otp/verify", { body }),
    forgotPassword: (body: ForgotPasswordIn) => typedRequest<"post", string, Record<string, unknown>>("post", "POST /auth/forgot-password", { body }),
    resetPassword: (body: ResetPasswordIn) => typedRequest<"post", string, Record<string, unknown>>("post", "POST /auth/reset-password", { body }),
  },
  courses: {
    list: () => typedRequest<"get", string, Course[]>("get", "GET /courses"),
    get: (slug: string) => typedRequest<"get", string, Course>("get", "GET /courses/{slug}", { params: { slug } }),
    getByCategory: (categorySlug: string) => typedRequest<"get", string, Course[]>("get", "GET /courses", { query: { category: categorySlug } }),
    recommendations: (limit?: number) => typedRequest<"get", string, Course[]>("get", "GET /recommendations", { query: { limit } }),
    similar: (courseId: string, limit?: number) =>
      typedRequest<"get", string, Course[]>("get", "GET /courses/{course_id}/similar", { params: { course_id: courseId }, query: { limit } }),
  },
  categories: { list: () => typedRequest<"get", string, Category[]>("get", "GET /categories") },
  subscriptions: {
    me: () => typedRequest<"get", string, Subscription | null>("get", "GET /subscriptions/me"),
    tiers: () => typedRequest<"get", string, SubscriptionTier[]>("get", "GET /subscriptions/tiers"),
    coupon: (code: string) => typedRequest<"get", string, Coupon>("get", "GET /subscriptions/coupons/{code}", { params: { code } }),
    cancel: () => typedRequest<"post", string, Record<string, unknown>>("post", "POST /subscriptions/cancel"),
  },
  progress: {
    list: () => typedRequest<"get", string, Progress[]>("get", "GET /progress"),
    get: (lessonId: string) => typedRequest<"get", string, Progress>("get", "GET /progress/{lesson_id}", { params: { lesson_id: lessonId } }),
    update: (lessonId: string, body: ProgressUpdate) =>
      typedRequest<"put", string, Progress>("put", "PUT /progress/{lesson_id}", { params: { lesson_id: lessonId }, body }),
  },
  lessons: {
    streamToken: (lessonId: string) =>
      typedRequest<"post", string, StreamToken>("post", "POST /lessons/{lesson_id}/stream-token", { params: { lesson_id: lessonId } }),
  },
  checkout: {
    createSession: (body: CheckoutIn) => typedRequest<"post", string, CheckoutSessionResponse>("post", "POST /checkout/session", { body }),
    paypalCapture: (orderId: string) =>
      typedRequest<"post", string, { success: boolean }>("post", "POST /checkout/paypal/capture", { query: { order_id: orderId } }),
  },
  reviews: {
    list: () => typedRequest<"get", string, Review[]>("get", "GET /reviews"),
    create: (body: ReviewIn) => typedRequest<"post", string, Review>("post", "POST /reviews", { body }),
  },
  certificates: {
    list: () => typedRequest<"get", string, Certificate[]>("get", "GET /certificates"),
    get: (certId: string) => typedRequest<"get", string, Certificate>("get", "GET /certificates/{cert_id}", { params: { cert_id: certId } }),
    downloadUrl: (certId: string) => `${API_BASE}/api/v1/certificates/${certId}/download`,
    verify: (code: string) => typedRequest<"get", string, CertificateVerification>("get", "GET /verify/{code}", { params: { code } }),
  },
  learningPaths: {
    list: (goal?: string) => typedRequest<"get", string, LearningPath[]>("get", "GET /learning-paths", { query: { goal } }),
    get: (slug: string) => typedRequest<"get", string, LearningPath>("get", "GET /learning-paths/{slug}", { params: { slug } }),
    my: () => typedRequest<"get", string, LearningPath[]>("get", "GET /learning-paths/my"),
    enroll: (pathId: string) => typedRequest<"post", string, { enrolled: boolean }>("post", "POST /learning-paths/enroll", { query: { path_id: pathId } }),
  },
  experiments: {
    active: () => typedRequest("get", "GET /experiments/active"),
    variantMap: () => typedRequest<"get", string, ExperimentVariantMap>("get", "GET /experiments/variant-map"),
    track: (
      experimentSlug: string,
      eventType: string,
      variantName: string,
      variantIndex: number,
      metadata?: Record<string, unknown>
    ) =>
      typedRequest<"post", string, { success: boolean }>("post", "POST /experiments/track", {
        query: { experiment_slug: experimentSlug, variant_name: variantName, variant_index: variantIndex, event_type: eventType },
        body: metadata,
      }),
    admin: {
      list: () => typedRequest("get", "GET /admin/experiments"),
      create: (data: Record<string, unknown>) => typedRequest("post", "POST /admin/experiments", { body: data }),
      update: (experimentId: string, data: Record<string, unknown>) =>
        typedRequest("put", "PUT /admin/experiments/{experiment_id}", { params: { experiment_id: experimentId }, body: data }),
      delete: (experimentId: string) =>
        typedRequest("delete", "DELETE /admin/experiments/{experiment_id}", { params: { experiment_id: experimentId } }),
      stats: (experimentSlug?: string) =>
        typedRequest("get", "GET /admin/experiments/stats", { query: { experiment_slug: experimentSlug } }),
    },
  },
  affiliate: {
    config: () => typedRequest("get", "GET /referral/config"),
    updateConfig: (data: Record<string, unknown>) => typedRequest("put", "PUT /referral/config", { body: data }),
    generateCode: () => typedRequest("post", "POST /referral/code"),
    getMyCode: () => typedRequest("get", "GET /referral/code"),
    apply: (code: string) => typedRequest("post", "POST /referral/apply", { query: { code } }),
    applyDiscount: () => typedRequest("post", "POST /referral/apply-discount"),
    stats: () => typedRequest("get", "GET /referral/stats"),
    affiliate: {
      apply: (data: Record<string, unknown>) => typedRequest("post", "POST /affiliate/apply", { body: data }),
      dashboard: () => typedRequest("get", "GET /affiliate/dashboard"),
      createLink: (data: Record<string, unknown>) => typedRequest("post", "POST /affiliate/links", { body: data }),
    },
    admin: { seed: () => typedRequest("post", "POST /admin/referral/seed") },
  },
  admin: {
    generateLessonCode: (courseId: string, lessonId: string, body: { title: string; description: string; language: string }) =>
      typedRequest<
        "post",
        string,
        { candidates?: Array<{ title: string; description: string }>; starter_code: string; solution_code: string; test_cases: string; language: string }
      >("post", "POST /admin/courses/{course_id}/lessons/{lesson_id}/generate-code", {
        params: { course_id: courseId, lesson_id: lessonId }, body,
      }),
    helpArticles: () => typedRequest("get", "GET /admin/help/articles"),
    createHelpArticle: (body: unknown) => typedRequest("post", "POST /admin/help/articles", { body }),
    updateHelpArticle: (articleId: string, body: unknown) =>
      typedRequest("put", "PUT /admin/help/articles/{article_id}", { params: { article_id: articleId }, body }),
    deleteHelpArticle: (articleId: string) =>
      typedRequest("delete", "DELETE /admin/help/articles/{article_id}", { params: { article_id: articleId } }),
    supportTickets: (filters?: { status?: string; category?: string; search?: string; assigned_to?: string }) =>
      typedRequest("get", "GET /admin/support/tickets", { query: filters }),
    supportTicket: (ticketId: string) =>
      typedRequest("get", "GET /admin/support/tickets/{ticket_id}", { params: { ticket_id: ticketId } }),
    supportTicketStatus: (ticketId: string, body: { status: string; note?: string }) =>
      typedRequest("post", "POST /admin/support/tickets/{id}/status", { params: { id: ticketId }, body }),
    supportTicketAssign: (ticketId: string, body: { admin_id: string }) =>
      typedRequest("post", "POST /admin/support/tickets/{id}/assign", { params: { id: ticketId }, body }),
    supportStats: () => typedRequest("get", "GET /admin/support/stats"),
    adaptive: {
      listConcepts: (courseId?: string) =>
        typedRequest<"get", string, AdminConcept[]>("get", "GET /admin/adaptive/concepts", {
          query: courseId ? { course_id: courseId } : undefined,
        }),
      createConcept: (body: AdminConceptCreate) =>
        typedRequest<"post", string, AdminConcept>("post", "POST /admin/adaptive/concepts", { body }),
      updateConcept: (conceptId: string, body: AdminConceptUpdate) =>
        typedRequest<"put", string, AdminConcept>("put", "PUT /admin/adaptive/concepts/{concept_id}", {
          params: { concept_id: conceptId },
          body,
        }),
      deleteConcept: (conceptId: string) =>
        typedRequest<"delete", string, { deleted: boolean }>("delete", "DELETE /admin/adaptive/concepts/{concept_id}", {
          params: { concept_id: conceptId },
        }),
      bulkCreateConcepts: (courseId: string, concepts: AdminConceptCreate[]) =>
        typedRequest<"post", string, { created: number }>("post", "POST /admin/adaptive/concepts/bulk", {
          body: { course_id: courseId, concepts },
        }),
      stats: (courseId: string) =>
        typedRequest<"get", string, AdminAdaptiveStats>("get", "GET /admin/adaptive/stats/{course_id}", {
          params: { course_id: courseId },
        }),
      gaps: (courseId: string) =>
        typedRequest<"get", string, AdminPrerequisiteGap[]>("get", "GET /admin/adaptive/gaps/{course_id}", {
          params: { course_id: courseId },
        }),
    },
  },
  adaptive: {
    listConcepts: (courseId: string) =>
      typedRequest<"get", string, { concepts?: ConceptDefinition[] }>("get", "GET /adaptive/concepts/{course_id}", {
        params: { course_id: courseId },
      }),
    weakConcepts: (courseId: string, threshold?: number) =>
      typedRequest<"get", string, ConceptMastery[]>("get", "GET /adaptive/weak/{course_id}", { params: { course_id: courseId }, query: threshold !== undefined ? { threshold } : undefined }),
    strongConcepts: (courseId: string, threshold?: number) =>
      typedRequest<"get", string, ConceptMastery[]>("get", "GET /adaptive/strong/{course_id}", { params: { course_id: courseId }, query: threshold !== undefined ? { threshold } : undefined }),
    remediation: (courseId: string) =>
      typedRequest<"get", string, RemediationSuggestion[]>("get", "GET /adaptive/remediation/{course_id}", { params: { course_id: courseId } }),
    prerequisites: (courseId: string, conceptId: string) =>
      typedRequest<"get", string, PrerequisiteInfo[]>("get", "GET /adaptive/prerequisites/{course_id}/{concept_id}", { params: { course_id: courseId, concept_id: conceptId } }),
    mastery: (courseId: string) =>
      typedRequest<"get", string, CourseMasteryEntry[]>("get", "GET /adaptive/mastery/{course_id}", { params: { course_id: courseId } }),
    generateQuiz: (courseId: string, lessonId?: string, numQuestions?: number) =>
      typedRequest<"post", string, AdaptiveQuiz>("post", "POST /adaptive/quiz/{course_id}/generate", { params: { course_id: courseId }, query: { lesson_id: lessonId, num_questions: numQuestions } }),
    submitQuiz: (courseId: string, body: { quiz_id: string; answers: Record<number, number>; questions: unknown[] }) =>
      typedRequest<"post", string, QuizResult>("post", "POST /adaptive/quiz/{course_id}/submit", { params: { course_id: courseId }, body }),
    recommendedSequence: (courseId: string) =>
      typedRequest<"get", string, RecommendedCourseSequence>("get", "GET /adaptive/course/{course_id}/recommended-sequence", { params: { course_id: courseId } }),
    skipLesson: (courseId: string, lessonId: string) =>
      typedRequest<"post", string, SkipLessonResult>("post", "POST /adaptive/skip/{course_id}/{lesson_id}", { params: { course_id: courseId, lesson_id: lessonId } }),
    remediationContent: (courseId: string, conceptId: string) =>
      typedRequest<"post", string, RemedialContent>("post", "POST /adaptive/remediation/{course_id}/content/{concept_id}", { params: { course_id: courseId, concept_id: conceptId } }),
    submitRemedialExercise: (courseId: string, conceptId: string, answers: Record<number, number>) =>
      typedRequest<"post", string, RemedialExerciseResult>("post", "POST /adaptive/remediation/{course_id}/exercise/{concept_id}/submit", {
        params: { course_id: courseId, concept_id: conceptId },
        body: { answers },
      }),
    sendRemedialFeedback: (courseId: string, conceptId: string, helpful: boolean) =>
      typedRequest<"post", string, { recorded: boolean }>("post", "POST /adaptive/remediation/{course_id}/feedback/{concept_id}", {
        params: { course_id: courseId, concept_id: conceptId },
        body: { helpful },
      }),
  },
  discussions: {
    list: (courseId: string, lessonId: string, params?: { page?: number; per_page?: number; sort?: string }) => {
      const search = new URLSearchParams();
      if (params?.page) search.set("page", String(params.page));
      if (params?.per_page) search.set("per_page", String(params.per_page));
      if (params?.sort) search.set("sort", params.sort);
      return typedRequest<"get", string, PaginatedDiscussions>("get", "GET /courses/{course_id}/lessons/{lesson_id}/discussions", {
        params: { course_id: courseId, lesson_id: lessonId }, query: Object.fromEntries(search.entries()),
      });
    },
    get: (courseId: string, lessonId: string, discussionId: string) =>
      typedRequest<"get", string, Discussion>("get", "GET /courses/{course_id}/lessons/{lesson_id}/discussions/{discussion_id}", {
        params: { course_id: courseId, lesson_id: lessonId, discussion_id: discussionId },
      }),
    create: (courseId: string, lessonId: string, body: unknown) =>
      typedRequest<"post", string, Discussion>("post", "POST /courses/{course_id}/lessons/{lesson_id}/discussions", {
        params: { course_id: courseId, lesson_id: lessonId }, body,
      }),
    update: (courseId: string, lessonId: string, discussionId: string, body: unknown) =>
      typedRequest<"put", string, Discussion>("put", "PUT /courses/{course_id}/lessons/{lesson_id}/discussions/{discussion_id}", {
        params: { course_id: courseId, lesson_id: lessonId, discussion_id: discussionId }, body,
      }),
    delete: (courseId: string, lessonId: string, discussionId: string) =>
      typedRequest<"delete", string, { success: boolean }>("delete", "DELETE /courses/{course_id}/lessons/{lesson_id}/discussions/{discussion_id}", {
        params: { course_id: courseId, lesson_id: lessonId, discussion_id: discussionId },
      }),
    vote: (courseId: string, lessonId: string, discussionId: string, vote: number) =>
      typedRequest<"post", string, Discussion>("post", "POST /courses/{course_id}/lessons/{lesson_id}/discussions/{discussion_id}/vote", {
        params: { course_id: courseId, lesson_id: lessonId, discussion_id: discussionId }, body: { vote },
      }),
    listReplies: (courseId: string, lessonId: string, discussionId: string, params?: { page?: number; per_page?: number }) => {
      const search = new URLSearchParams();
      if (params?.page) search.set("page", String(params.page));
      if (params?.per_page) search.set("per_page", String(params.per_page));
      return typedRequest<"get", string, PaginatedReplies>("get", "GET /courses/{course_id}/lessons/{lesson_id}/discussions/{discussion_id}/replies", {
        params: { course_id: courseId, lesson_id: lessonId, discussion_id: discussionId }, query: Object.fromEntries(search.entries()),
      });
    },
    createReply: (courseId: string, lessonId: string, discussionId: string, body: unknown) =>
      typedRequest<"post", string, Reply>("post", "POST /courses/{course_id}/lessons/{lesson_id}/discussions/{discussion_id}/replies", {
        params: { course_id: courseId, lesson_id: lessonId, discussion_id: discussionId }, body,
      }),
    updateReply: (courseId: string, lessonId: string, discussionId: string, replyId: string, body: unknown) =>
      typedRequest<"put", string, Reply>("put", "PUT /courses/{course_id}/lessons/{lesson_id}/discussions/{discussion_id}/replies/{reply_id}", {
        params: { course_id: courseId, lesson_id: lessonId, discussion_id: discussionId, reply_id: replyId }, body,
      }),
    deleteReply: (courseId: string, lessonId: string, discussionId: string, replyId: string) =>
      typedRequest<"delete", string, { success: boolean }>("delete", "DELETE /courses/{course_id}/lessons/{lesson_id}/discussions/{discussion_id}/replies/{reply_id}", {
        params: { course_id: courseId, lesson_id: lessonId, discussion_id: discussionId, reply_id: replyId },
      }),
    voteReply: (courseId: string, lessonId: string, discussionId: string, replyId: string, vote: number) =>
      typedRequest<"post", string, Reply>("post", "POST /courses/{course_id}/lessons/{lesson_id}/discussions/{discussion_id}/replies/{reply_id}/vote", {
        params: { course_id: courseId, lesson_id: lessonId, discussion_id: discussionId, reply_id: replyId }, body: { vote },
      }),
    markAnswer: (courseId: string, lessonId: string, discussionId: string, replyId: string) =>
      typedRequest<"post", string, Reply>("post", "POST /courses/{course_id}/lessons/{lesson_id}/discussions/{discussion_id}/replies/{reply_id}/mark-answer", {
        params: { course_id: courseId, lesson_id: lessonId, discussion_id: discussionId, reply_id: replyId },
      }),
  },
  codeAssistant: {
    generate: (body: { task: string; language: string; context?: string; starter_code?: string }) =>
      typedRequest<"post", string, { explanation?: string; code?: string }>("post", "POST /code-assistant/generate", { body }),
    explain: (body: { code: string; language: string; focus?: string }) =>
      typedRequest<"post", string, { explanation?: string }>("post", "POST /code-assistant/explain", { body }),
    review: (body: { code: string; language: string; task?: string }) =>
      typedRequest<"post", string, { review?: string }>("post", "POST /code-assistant/review", { body }),
    debug: (body: { code: string; language: string; error: string; task?: string }) =>
      typedRequest<"post", string, { debug_help?: string }>("post", "POST /code-assistant/debug", { body }),
  },
  support: {
    listTickets: () => typedRequest("get", "GET /support/tickets"),
    getTicket: (ticketId: string) => typedRequest("get", "GET /support/tickets/{ticket_id}", { params: { ticket_id: ticketId } }),
    createTicket: (body: unknown) => typedRequest("post", "POST /support/tickets", { body }),
    addMessage: (ticketId: string, body: unknown) =>
      typedRequest("post", "POST /support/tickets/{ticket_id}/messages", { params: { ticket_id: ticketId }, body }),
    rateTicket: (ticketId: string, body: { rating: number }) =>
      typedRequest("post", "POST /support/tickets/{ticket_id}/satisfaction", { params: { ticket_id: ticketId }, body }),
    chat: (body: { message: string }) => typedRequest("post", "POST /support/chat", { body }),
    chatHistory: () => typedRequest("get", "GET /support/chat/history"),
    clearChatHistory: () => typedRequest("delete", "DELETE /support/chat/history"),
  },
  help: {
    listArticles: (category?: string) => typedRequest("get", "GET /help/articles", { query: category ? { category } : undefined }),
    searchArticles: (query: string, category?: string) =>
      typedRequest("get", "GET /help/articles/search", { query: { q: query, ...(category ? { category } : {}) } }),
    getArticle: (slug: string) => typedRequest("get", "GET /help/articles/{slug}", { params: { slug } }),
    getArticleById: (articleId: string) => typedRequest("get", "GET /help/articles/id/{article_id}", { params: { article_id: articleId } }),
    submitFeedback: (articleId: string, helpful: boolean) =>
      typedRequest("post", "POST /help/articles/{id}/feedback", { params: { id: articleId }, body: { helpful } }),
  },
};

export { apiClient, request as apiFetch };