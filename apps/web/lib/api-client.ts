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
      return retryRes.json();
    }
    throw new Error("Session expired. Please log in again.");
  }

  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `${res.status}`);
  }

  if (res.status === 204) return undefined as T;
  return res.json();
}

type HttpMethod = "get" | "post" | "put" | "delete" | "patch";

type PathItem = paths[keyof paths];
type Operation = PathItem[HttpMethod];

type ExtractRequestBody<T extends Operation> = T extends { requestBody: { content: { "application/json": infer B } } } ? B : never;
type ExtractResponseBody<T extends Operation> = T extends { responses: { 200: { content: { "application/json": infer R } } } } ? R : unknown;
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
  T extends paths[P][M]
>(
  method: M,
  path: P,
  options: TypedRequestOptions<T> = {}
): Promise<ExtractResponseBody<T>> {
  const { params, query, body, ...fetchOptions } = options;

  let finalPath = path as string;

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

  if (body) {
    fetchOptions.body = JSON.stringify(body);
  }

  fetchOptions.method = method.toUpperCase();

  return request<ExtractResponseBody<T>>(finalPath, fetchOptions);
}

export function apiPath(method: string, path: string): string {
  return `${method.toUpperCase()} ${API_PREFIX}${path}`;
}

const apiClient = {
  auth: {
    me: () => typedRequest("get", "/auth/me" as const),
    login: (body: paths["/api/v1/auth/login"]["post"]["requestBody"]["content"]["application/json"]) =>
      typedRequest("post", "/auth/login" as const, { body }),
    logout: () => typedRequest("post", "/auth/logout" as const),
    signup: (body: paths["/api/v1/auth/signup"]["post"]["requestBody"]["content"]["application/json"]) =>
      typedRequest("post", "/auth/signup" as const, { body }),
    updateProfile: (body: paths["/api/v1/auth/me"]["put"]["requestBody"]["content"]["application/json"]) =>
      typedRequest("put", "/auth/me" as const, { body }),
    changePassword: (body: paths["/api/v1/auth/me/password"]["put"]["requestBody"]["content"]["application/json"]) =>
      typedRequest("put", "/auth/me/password" as const, { body }),
    googleLogin: (body: paths["/api/v1/auth/google"]["post"]["requestBody"]["content"]["application/json"]) =>
      typedRequest("post", "/auth/google" as const, { body }),
    otpRequest: (body: paths["/api/v1/auth/otp/request"]["post"]["requestBody"]["content"]["application/json"]) =>
      typedRequest("post", "/auth/otp/request" as const, { body }),
    otpVerify: (body: paths["/api/v1/auth/otp/verify"]["post"]["requestBody"]["content"]["application/json"]) =>
      typedRequest("post", "/auth/otp/verify" as const, { body }),
    forgotPassword: (body: paths["/api/v1/auth/forgot-password"]["post"]["requestBody"]["content"]["application/json"]) =>
      typedRequest("post", "/auth/forgot-password" as const, { body }),
    resetPassword: (body: paths["/api/v1/auth/reset-password"]["post"]["requestBody"]["content"]["application/json"]) =>
      typedRequest("post", "/auth/reset-password" as const, { body }),
  },
  courses: {
    list: () => typedRequest("get", "/courses" as const),
    get: (slug: string) => typedRequest("get", `/courses/${slug}` as const),
    getByCategory: (categorySlug: string) =>
      typedRequest("get", "/courses" as const, { query: { category: categorySlug } }),
    recommendations: (limit?: number) =>
      typedRequest("get", "/courses/recommendations" as const, { query: { limit } }),
    similar: (courseId: string, limit?: number) =>
      typedRequest("get", `/courses/${courseId}/similar` as const, { query: { limit } }),
  },
  categories: {
    list: () => typedRequest("get", "/categories" as const),
  },
  subscriptions: {
    me: () => typedRequest("get", "/subscriptions/me" as const),
    tiers: () => typedRequest("get", "/subscriptions/tiers" as const),
    coupon: (code: string) => typedRequest("get", `/subscriptions/coupons/${code}` as const),
    cancel: () => typedRequest("post", "/subscriptions/cancel" as const),
  },
  progress: {
    list: () => typedRequest("get", "/progress" as const),
    get: (lessonId: string) => typedRequest("get", `/progress/${lessonId}` as const),
    update: (lessonId: string, body: paths["/api/v1/progress/{lesson_id}"]["put"]["requestBody"]["content"]["application/json"]) =>
      typedRequest("put", `/progress/${lessonId}` as const, { body }),
  },
  lessons: {
    streamToken: (lessonId: string) =>
      typedRequest("post", `/lessons/${lessonId}/stream-token` as const),
  },
  checkout: {
    createSession: (body: paths["/api/v1/checkout/session"]["post"]["requestBody"]["content"]["application/json"]) =>
      typedRequest("post", "/checkout/session" as const, { body }),
    paypalCapture: (orderId: string) =>
      typedRequest("post", "/checkout/paypal/capture" as const, { query: { order_id: orderId } }),
  },
  reviews: {
    list: () => typedRequest("get", "/reviews" as const),
    create: (body: paths["/api/v1/reviews"]["post"]["requestBody"]["content"]["application/json"]) =>
      typedRequest("post", "/reviews" as const, { body }),
  },
  certificates: {
    list: () => typedRequest("get", "/certificates" as const),
    get: (certId: string) => typedRequest("get", `/certificates/${certId}` as const),
    downloadUrl: (certId: string) => `${API_BASE}/api/v1/certificates/${certId}/download`,
    verify: (code: string) => typedRequest("get", `/certificates/verify/${code}` as const),
  },
  learningPaths: {
    list: (goal?: string) => typedRequest("get", "/learning-paths" as const, { query: { goal } }),
    get: (slug: string) => typedRequest("get", `/learning-paths/${slug}` as const),
    my: () => typedRequest("get", "/learning-paths/my" as const),
    enroll: (pathId: string) =>
      typedRequest("post", "/learning-paths/enroll" as const, { query: { path_id: pathId } }),
  },
  experiments: {
    active: () => typedRequest("get", "/experiments/active" as const),
    variantMap: () => typedRequest("get", "/experiments/variant-map" as const),
    track: (experimentSlug: string, eventType: string, metadata?: Record<string, unknown>) =>
      typedRequest("post", "/experiments/track" as const, {
        query: { experiment_slug: experimentSlug },
        body: { event_type: eventType, metadata },
      }),
    admin: {
      list: () => typedRequest("get", "/admin/experiments" as const),
      create: (data: Record<string, unknown>) =>
        typedRequest("post", "/admin/experiments" as const, { body: data }),
      update: (experimentId: string, data: Record<string, unknown>) =>
        typedRequest("put", `/admin/experiments/${experimentId}` as const, { body: data }),
      delete: (experimentId: string) => typedRequest("delete", `/admin/experiments/${experimentId}` as const),
      stats: (experimentSlug?: string) =>
        typedRequest("get", "/admin/experiments/stats" as const, { query: { experiment_slug: experimentSlug } }),
    },
  },
  affiliate: {
    config: () => typedRequest("get", "/referral/config" as const),
    updateConfig: (data: Record<string, unknown>) =>
      typedRequest("put", "/referral/config" as const, { body: data }),
    generateCode: () => typedRequest("post", "/referral/code" as const),
    getMyCode: () => typedRequest("get", "/referral/code" as const),
    apply: (code: string) => typedRequest("post", "/referral/apply" as const, { query: { code } }),
    applyDiscount: () => typedRequest("post", "/referral/apply-discount" as const),
    stats: () => typedRequest("get", "/referral/stats" as const),
    affiliate: {
      apply: (data: Record<string, unknown>) =>
        typedRequest("post", "/affiliate/apply" as const, { body: data }),
      dashboard: () => typedRequest("get", "/affiliate/dashboard" as const),
      createLink: (data: Record<string, unknown>) =>
        typedRequest("post", "/affiliate/links" as const, { body: data }),
    },
    admin: {
      seed: () => typedRequest("post", "/admin/referral/seed" as const),
    },
  },
  admin: {
    generateLessonCode: (lessonId: string, body: { title: string; description: string; language: string }) =>
      typedRequest("post", `/admin/lessons/${lessonId}/generate-code` as const, { body }),
  },
  discussions: {
    list: (courseId: string, lessonId: string, params?: { page?: number; per_page?: number; sort?: string }) => {
      const search = new URLSearchParams();
      if (params?.page) search.set("page", String(params.page));
      if (params?.per_page) search.set("per_page", String(params.per_page));
      if (params?.sort) search.set("sort", params.sort);
      return typedRequest("get", `/courses/${courseId}/lessons/${lessonId}/discussions` as const, {
        query: Object.fromEntries(search.entries()),
      });
    },
    get: (courseId: string, lessonId: string, discussionId: string) =>
      typedRequest("get", `/courses/${courseId}/lessons/${lessonId}/discussions/${discussionId}` as const),
    create: (courseId: string, lessonId: string, body: paths["/api/v1/courses/{course_id}/lessons/{lesson_id}/discussions"]["post"]["requestBody"]["content"]["application/json"]) =>
      typedRequest("post", `/courses/${courseId}/lessons/${lessonId}/discussions` as const, { body }),
    update: (courseId: string, lessonId: string, discussionId: string, body: paths["/api/v1/courses/{course_id}/lessons/{lesson_id}/discussions/{discussion_id}"]["put"]["requestBody"]["content"]["application/json"]) =>
      typedRequest("put", `/courses/${courseId}/lessons/${lessonId}/discussions/${discussionId}` as const, { body }),
    delete: (courseId: string, lessonId: string, discussionId: string) =>
      typedRequest("delete", `/courses/${courseId}/lessons/${lessonId}/discussions/${discussionId}` as const),
    vote: (courseId: string, lessonId: string, discussionId: string, vote: number) =>
      typedRequest("post", `/courses/${courseId}/lessons/${lessonId}/discussions/${discussionId}/vote` as const, {
        body: { vote } as any,
      }),
    listReplies: (courseId: string, lessonId: string, discussionId: string, params?: { page?: number; per_page?: number }) => {
      const search = new URLSearchParams();
      if (params?.page) search.set("page", String(params.page));
      if (params?.per_page) search.set("per_page", String(params.per_page));
      return typedRequest("get", `/courses/${courseId}/lessons/${lessonId}/discussions/${discussionId}/replies` as const, {
        query: Object.fromEntries(search.entries()),
      });
    },
    createReply: (courseId: string, lessonId: string, discussionId: string, body: paths["/api/v1/courses/{course_id}/lessons/{lesson_id}/discussions/{discussion_id}/replies"]["post"]["requestBody"]["content"]["application/json"]) =>
      typedRequest("post", `/courses/${courseId}/lessons/${lessonId}/discussions/${discussionId}/replies` as const, { body }),
    updateReply: (courseId: string, lessonId: string, discussionId: string, replyId: string, body: paths["/api/v1/courses/{course_id}/lessons/{lesson_id}/discussions/{discussion_id}/replies/{reply_id}"]["put"]["requestBody"]["content"]["application/json"]) =>
      typedRequest("put", `/courses/${courseId}/lessons/${lessonId}/discussions/${discussionId}/replies/${replyId}` as const, { body }),
    deleteReply: (courseId: string, lessonId: string, discussionId: string, replyId: string) =>
      typedRequest("delete", `/courses/${courseId}/lessons/${lessonId}/discussions/${discussionId}/replies/${replyId}` as const),
    voteReply: (courseId: string, lessonId: string, discussionId: string, replyId: string, vote: number) =>
      typedRequest("post", `/courses/${courseId}/lessons/${lessonId}/discussions/${discussionId}/replies/${replyId}/vote` as const, {
        body: { vote } as any,
      }),
    markAnswer: (courseId: string, lessonId: string, discussionId: string, replyId: string) =>
      typedRequest("post", `/courses/${courseId}/lessons/${lessonId}/discussions/${discussionId}/replies/${replyId}/mark-answer` as const),
  },
  codeAssistant: {
    generate: (body: { task: string; language: string; context?: string; starter_code?: string }) =>
      typedRequest("post", "/code-assistant/generate" as const, { body }),
    explain: (body: { code: string; language: string; focus?: string }) =>
      typedRequest("post", "/code-assistant/explain" as const, { body }),
    review: (body: { code: string; language: string; task?: string }) =>
      typedRequest("post", "/code-assistant/review" as const, { body }),
    debug: (body: { code: string; language: string; error: string; task?: string }) =>
      typedRequest("post", "/code-assistant/debug" as const, { body }),
  },
};

export { apiClient, request as apiFetch };