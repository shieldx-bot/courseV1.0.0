import type { ApiPaths as paths } from "@/types/api";

const API_ORIGIN = process.env.NEXT_PUBLIC_API_URL || "";
const API_PREFIX = "/api/v1";

export const API_BASE = API_ORIGIN || "";

let _refreshing: Promise<boolean> | null = null;
let _pendingQueue: Array<{ resolve: (v: boolean) => void }> = [];

async function refreshTokens(): Promise<boolean> {
  if (_refreshing) return _refreshing;
  _refreshing = (async () => {
    try {
      const url = `${API_ORIGIN}${API_PREFIX}/auth/refresh`;
      const res = await fetch(url, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
      });
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
    if (_refreshing) {
      _pendingQueue.push({ resolve });
    } else {
      resolve(refreshTokens());
    }
  });
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers);
  if (!headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const url = `${API_ORIGIN}${API_PREFIX}${path}`;
  const res = await fetch(url, { ...options, headers, credentials: "include" });

  if (res.status === 401 && !path.startsWith("/auth/refresh")) {
    const refreshed = await enqueueRefresh();
    if (refreshed) {
      const retryRes = await fetch(url, { ...options, headers, credentials: "include" });
      if (!retryRes.ok) {
        const text = await retryRes.text();
        throw new Error(text || `${retryRes.status}`);
      }
      if (retryRes.status === 204) return undefined as T;
      const retryJson = await retryRes.json();
      if (retryJson && typeof retryJson === "object" && "success" in retryJson) return retryJson.data;
      return retryJson;
    }
    throw new Error("Session expired. Please log in again.");
  }

  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `${res.status}`);
  }

  if (res.status === 204) return undefined as T;
  const json = await res.json();
  if (json && typeof json === "object" && "success" in json) return json.data;
  return json;
}

type HttpMethod = "get" | "post" | "put" | "delete" | "patch";

type Operation = any;

type ExtractRequestBody<T extends Operation> = T extends { requestBody: { content: { "application/json": infer B } } } ? B : never;
type ExtractResponseBody<T extends Operation> = T extends { responses: { 200: { content: { "application/json": infer R } } } } ? R : any;
type ExtractPathParams<T extends Operation> = T extends { parameters: { path?: infer P } } ? P : never;
type ExtractQueryParams<T extends Operation> = T extends { parameters: { query?: infer Q } } ? Q : never;

type TypedRequestOptions<T extends Operation> = RequestInit & {
  params?: ExtractPathParams<T>;
  query?: ExtractQueryParams<T>;
  body?: ExtractRequestBody<T>;
};

export async function typedRequest<
  M extends HttpMethod,
  P extends keyof paths,
  T = any
>(
  method: M,
  path: P,
  options: TypedRequestOptions<T> = {}
): Promise<ExtractResponseBody<T>> {
  const { params, query, ...fetchOptions } = options;

  let finalPath = path as string;
  
  // Extract actual path if it includes method prefix (e.g., "GET /auth/me")
  if (finalPath.includes(' ')) {
    finalPath = finalPath.split(' ')[1];
  }

  if (params) {
    for (const [key, value] of Object.entries(params)) {
      finalPath = finalPath.replace(`{${key}}`, encodeURIComponent(String(value)));
    }
  }

  if (query) {
    const searchParams = new URLSearchParams();
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined && value !== null) {
        searchParams.append(key, String(value));
      }
    }
    const qs = searchParams.toString();
    if (qs) finalPath = `${finalPath}?${qs}`;
  }

  if (options.body) {
    (fetchOptions as any).body = JSON.stringify(options.body);
  }

  fetchOptions.method = method.toUpperCase();

  return request<ExtractResponseBody<T>>(finalPath, fetchOptions);
}

export function apiPath(method: string, path: string): string {
  return `${method.toUpperCase()} ${API_PREFIX}${path}`;
}

const apiClient = {
  auth: {
    me: () => typedRequest("get", "GET /auth/me" as any),
    login: (body: any) =>
      typedRequest("post", "POST /auth/login" as any, { body }),
    logout: () => typedRequest("post", "POST /auth/logout" as any),
    signup: (body: any) =>
      typedRequest("post", "POST /auth/signup" as any, { body }),
    updateProfile: (body: any) =>
      typedRequest("put", "PUT /auth/me" as any, { body }),
    changePassword: (body: any) =>
      typedRequest("put", "PUT /auth/me/password" as any, { body }),
    googleLogin: (body: any) =>
      typedRequest("post", "POST /auth/google" as any, { body }),
    otpRequest: (body: any) =>
      typedRequest("post", "POST /auth/otp/request" as any, { body }),
    otpVerify: (body: any) =>
      typedRequest("post", "POST /auth/otp/verify" as any, { body }),
    forgotPassword: (body: any) =>
      typedRequest("post", "POST /auth/forgot-password" as any, { body }),
    resetPassword: (body: any) =>
      typedRequest("post", "POST /auth/reset-password" as any, { body }),
  },
  courses: {
    list: () => typedRequest("get", "GET /courses" as any),
    get: (slug: string) => typedRequest("get", "GET /courses/{slug}" as any, { params: { slug } }),
    getByCategory: (categorySlug: string) =>
      typedRequest("get", "GET /courses" as any, { query: { category: categorySlug } }),
    recommendations: (limit?: number) =>
      typedRequest("get", "GET /recommendations" as any, { query: { limit } }),
    similar: (courseId: string, limit?: number) =>
      typedRequest("get", "GET /courses/{course_id}/similar" as any, { params: { course_id: courseId }, query: { limit } }),
  },
  categories: {
    list: () => typedRequest("get", "GET /categories" as any),
  },
  subscriptions: {
    me: () => typedRequest("get", "GET /subscriptions/me" as any),
    tiers: () => typedRequest("get", "GET /subscriptions/tiers" as any),
    coupon: (code: string) => typedRequest("get", "GET /subscriptions/coupons/{code}" as any, { params: { code } }),
    cancel: () => typedRequest("post", "POST /subscriptions/cancel" as any),
  },
  progress: {
    list: () => typedRequest("get", "GET /progress" as any),
    get: (lessonId: string) => typedRequest("get", "GET /progress/{lesson_id}" as any, { params: { lesson_id: lessonId } }),
    update: (lessonId: string, body: any) =>
      typedRequest("put", "PUT /progress/{lesson_id}" as any, { params: { lesson_id: lessonId }, body }),
  },
  lessons: {
      streamToken: (lessonId: string) =>
        typedRequest("post", "POST /lessons/{lesson_id}/stream-token" as any, { params: { lesson_id: lessonId } }),
  },
  checkout: {
    createSession: (body: any) =>
      typedRequest("post", "POST /checkout/session" as any, { body }),
    paypalCapture: (orderId: string) =>
      typedRequest("post", "POST /checkout/paypal/capture" as any, { query: { order_id: orderId } }),
  },
  reviews: {
    list: () => typedRequest("get", "GET /reviews" as any),
    create: (body: any) =>
      typedRequest("post", "POST /reviews" as any, { body }),
  },
  certificates: {
    list: () => typedRequest("get", "GET /certificates" as any),
    get: (certId: string) => typedRequest("get", "GET /certificates/{cert_id}" as any, { params: { cert_id: certId } }),
    downloadUrl: (certId: string) => `${API_BASE}/api/v1/certificates/${certId}/download`,
    verify: (code: string) => typedRequest("get", "GET /verify/{code}" as any, { params: { code } }),
  },
  learningPaths: {
    list: (goal?: string) => typedRequest("get", "GET /learning-paths" as any, { query: { goal } }),
    get: (slug: string) => typedRequest("get", "GET /learning-paths/{slug}" as any, { params: { slug } }),
    my: () => typedRequest("get", "GET /learning-paths/my" as any),
    enroll: (pathId: string) =>
      typedRequest("post", "POST /learning-paths/enroll" as any, { query: { path_id: pathId } }),
  },
  experiments: {
    active: () => typedRequest("get", "GET /experiments/active" as any),
    variantMap: () => typedRequest("get", "GET /experiments/variant-map" as any),
    track: (experimentSlug: string, eventType: string, variantName: string, variantIndex: number, metadata?: Record<string, unknown>) =>
      typedRequest("post", "POST /experiments/track" as any, {
        query: { experiment_slug: experimentSlug, variant_name: variantName, variant_index: variantIndex, event_type: eventType },
      }),
    admin: {
      list: () => typedRequest("get", "GET /admin/experiments" as any),
      create: (data: Record<string, unknown>) =>
        typedRequest("post", "POST /admin/experiments" as any, { body: data as any }),
      update: (experimentId: string, data: Record<string, unknown>) =>
        typedRequest("put", "PUT /admin/experiments/{experiment_id}" as any, { params: { experiment_id: experimentId }, body: data as any }),
      delete: (experimentId: string) => typedRequest("delete", "DELETE /admin/experiments/{experiment_id}" as any, { params: { experiment_id: experimentId } }),
      stats: (experimentSlug?: string) =>
        typedRequest("get", "GET /admin/experiments/stats" as any, { query: { experiment_slug: experimentSlug } }),
    },
  },
  affiliate: {
    config: () => typedRequest("get", "GET /referral/config" as any),
    updateConfig: (data: Record<string, unknown>) =>
      typedRequest("put", "PUT /referral/config" as any, { body: data as any }),
    generateCode: () => typedRequest("post", "POST /referral/code" as any),
    getMyCode: () => typedRequest("get", "GET /referral/code" as any),
    apply: (code: string) => typedRequest("post", "POST /referral/apply" as any, { query: { code } }),
    applyDiscount: () => typedRequest("post", "POST /referral/apply-discount" as any),
    stats: () => typedRequest("get", "GET /referral/stats" as any),
    affiliate: {
      apply: (data: Record<string, unknown>) =>
        typedRequest("post", "POST /affiliate/apply" as any, { body: data as any }),
      dashboard: () => typedRequest("get", "GET /affiliate/dashboard" as any),
      createLink: (data: Record<string, unknown>) =>
        typedRequest("post", "POST /affiliate/links" as any, { body: data as any }),
    },
    admin: {
      seed: () => typedRequest("post", "POST /admin/referral/seed" as any),
    },
  },
  admin: {
    generateLessonCode: (courseId: string, lessonId: string, body: { title: string; description: string; language: string }) =>
      typedRequest("post", "POST /admin/courses/{course_id}/lessons/{lesson_id}/generate-code" as any, {
        params: { course_id: courseId, lesson_id: lessonId },
        body: body as any,
      }),
    supportTickets: (filters?: { status?: string; category?: string; search?: string; assigned_to?: string }) =>
      typedRequest("get", "GET /admin/support/tickets" as any, { query: filters }),
    supportTicket: (ticketId: string) =>
      typedRequest("get", "GET /admin/support/tickets/{ticket_id}" as any, { params: { ticket_id: ticketId } }),
    supportTicketStatus: (ticketId: string, body: { status: string; note?: string }) =>
      typedRequest("post", "POST /admin/support/tickets/{id}/status" as any, { params: { id: ticketId }, body: body as any }),
    supportTicketAssign: (ticketId: string, body: { admin_id: string }) =>
      typedRequest("post", "POST /admin/support/tickets/{id}/assign" as any, { params: { id: ticketId }, body: body as any }),
    supportStats: () =>
      typedRequest("get", "GET /admin/support/stats" as any),
  },
  discussions: {
    list: (courseId: string, lessonId: string, params?: { page?: number; per_page?: number; sort?: string }) => {
      const search = new URLSearchParams();
      if (params?.page) search.set("page", String(params.page));
      if (params?.per_page) search.set("per_page", String(params.per_page));
      if (params?.sort) search.set("sort", params.sort);
      return typedRequest("get", "GET /courses/{course_id}/lessons/{lesson_id}/discussions" as any, {
        params: { course_id: courseId, lesson_id: lessonId },
        query: Object.fromEntries(search.entries()),
      });
    },
    get: (courseId: string, lessonId: string, discussionId: string) =>
      typedRequest("get", "GET /courses/{course_id}/lessons/{lesson_id}/discussions/{discussion_id}" as any, { params: { course_id: courseId, lesson_id: lessonId, discussion_id: discussionId } }),
    create: (courseId: string, lessonId: string, body: any) =>
      typedRequest("post", "POST /courses/{course_id}/lessons/{lesson_id}/discussions" as any, { params: { course_id: courseId, lesson_id: lessonId }, body }),
    update: (courseId: string, lessonId: string, discussionId: string, body: any) =>
      typedRequest("put", "PUT /courses/{course_id}/lessons/{lesson_id}/discussions/{discussion_id}" as any, { params: { course_id: courseId, lesson_id: lessonId, discussion_id: discussionId }, body }),
    delete: (courseId: string, lessonId: string, discussionId: string) =>
      typedRequest("delete", "DELETE /courses/{course_id}/lessons/{lesson_id}/discussions/{discussion_id}" as any, { params: { course_id: courseId, lesson_id: lessonId, discussion_id: discussionId } }),
    vote: (courseId: string, lessonId: string, discussionId: string, vote: number) =>
      typedRequest("post", "POST /courses/{course_id}/lessons/{lesson_id}/discussions/{discussion_id}/vote" as any, {
        params: { course_id: courseId, lesson_id: lessonId, discussion_id: discussionId },
        body: { vote } as any,
      }),
    listReplies: (courseId: string, lessonId: string, discussionId: string, params?: { page?: number; per_page?: number }) => {
      const search = new URLSearchParams();
      if (params?.page) search.set("page", String(params.page));
      if (params?.per_page) search.set("per_page", String(params.per_page));
      return typedRequest("get", "GET /courses/{course_id}/lessons/{lesson_id}/discussions/{discussion_id}/replies" as any, {
        params: { course_id: courseId, lesson_id: lessonId, discussion_id: discussionId },
        query: Object.fromEntries(search.entries()),
      });
    },
    createReply: (courseId: string, lessonId: string, discussionId: string, body: any) =>
      typedRequest("post", "POST /courses/{course_id}/lessons/{lesson_id}/discussions/{discussion_id}/replies" as any, { params: { course_id: courseId, lesson_id: lessonId, discussion_id: discussionId }, body }),
    updateReply: (courseId: string, lessonId: string, discussionId: string, replyId: string, body: any) =>
      typedRequest("put", "PUT /courses/{course_id}/lessons/{lesson_id}/discussions/{discussion_id}/replies/{reply_id}" as any, { params: { course_id: courseId, lesson_id: lessonId, discussion_id: discussionId, reply_id: replyId }, body }),
    deleteReply: (courseId: string, lessonId: string, discussionId: string, replyId: string) =>
      typedRequest("delete", "DELETE /courses/{course_id}/lessons/{lesson_id}/discussions/{discussion_id}/replies/{reply_id}" as any, { params: { course_id: courseId, lesson_id: lessonId, discussion_id: discussionId, reply_id: replyId } }),
    voteReply: (courseId: string, lessonId: string, discussionId: string, replyId: string, vote: number) =>
      typedRequest("post", "POST /courses/{course_id}/lessons/{lesson_id}/discussions/{discussion_id}/replies/{reply_id}/vote" as any, {
        params: { course_id: courseId, lesson_id: lessonId, discussion_id: discussionId, reply_id: replyId },
        body: { vote } as any,
      }),
    markAnswer: (courseId: string, lessonId: string, discussionId: string, replyId: string) =>
      typedRequest("post", "POST /courses/{course_id}/lessons/{lesson_id}/discussions/{discussion_id}/replies/{reply_id}/mark-answer" as any, { params: { course_id: courseId, lesson_id: lessonId, discussion_id: discussionId, reply_id: replyId } }),
  },
  codeAssistant: {
    generate: (body: { task: string; language: string; context?: string; starter_code?: string }) =>
      typedRequest("post", "POST /code-assistant/generate" as any, { body: body as any }),
    explain: (body: { code: string; language: string; focus?: string }) =>
      typedRequest("post", "POST /code-assistant/explain" as any, { body: body as any }),
    review: (body: { code: string; language: string; task?: string }) =>
      typedRequest("post", "POST /code-assistant/review" as any, { body: body as any }),
    debug: (body: { code: string; language: string; error: string; task?: string }) =>
      typedRequest("post", "POST /code-assistant/debug" as any, { body: body as any }),
  },
  support: {
    listTickets: () =>
      typedRequest("get", "GET /support/tickets" as any),
    getTicket: (ticketId: string) =>
      typedRequest("get", "GET /support/tickets/{ticket_id}" as any, { params: { ticket_id: ticketId } }),
    createTicket: (body: any) =>
      typedRequest("post", "POST /support/tickets" as any, { body: body as any }),
    addMessage: (ticketId: string, body: any) =>
      typedRequest("post", "POST /support/tickets/{ticket_id}/messages" as any, { params: { ticket_id: ticketId }, body: body as any }),
    rateTicket: (ticketId: string, body: { rating: number }) =>
      typedRequest("post", "POST /support/tickets/{ticket_id}/satisfaction" as any, { params: { ticket_id: ticketId }, body: body as any }),
    chat: (body: { message: string }) =>
      typedRequest("post", "POST /support/chat" as any, { body: body as any }),
    chatHistory: () =>
      typedRequest("get", "GET /support/chat/history" as any),
    clearChatHistory: () =>
      typedRequest("delete", "DELETE /support/chat/history" as any),
  },
  help: {
    listArticles: (category?: string) =>
      typedRequest("get", "GET /help/articles" as any, { query: category ? { category } : undefined }),
    searchArticles: (query: string, category?: string) =>
      typedRequest("get", "GET /help/articles/search" as any, { query: { q: query, ...(category ? { category } : {}) } }),
    getArticle: (slug: string) =>
      typedRequest("get", "GET /help/articles/{slug}" as any, { params: { slug } }),
    getArticleById: (articleId: string) =>
      typedRequest("get", "GET /help/articles/id/{article_id}" as any, { params: { article_id: articleId } }),
    submitFeedback: (articleId: string, helpful: boolean) =>
      typedRequest("post", "POST /help/articles/{id}/feedback" as any, {
        params: { id: articleId },
        body: { helpful: helpful } as any,
      }),
  },
};

export { apiClient, request as apiFetch };