import type {
  CreatorAchievement,
  CreatorAnalytics,
  CreatorLeaderboardEntry,
  MarketplaceCollection,
  ChallengeVersion,
  PlatformEvent,
  ModerationReport,
  ModerationStats,
  PlatformIntelligence,
} from "../types/ecosystem";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "/api/v1";

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });
  const json = await res.json();
  if (!json.success) {
    throw new Error(json.error || "Request failed");
  }
  return json.data as T;
}

export const ecosystemApi = {
  // ── Creator Economy ─────────────────────────────────────────
  requestCreatorVerification: (body: { full_name?: string; expertise_area?: string; evidence_urls?: string[]; note?: string }) =>
    request<{ success: boolean; status: string }>("/ecosystem/creators/verify/request", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  getCreatorAnalytics: (days = 30) =>
    request<CreatorAnalytics>(`/ecosystem/creators/me/analytics?days=${days}`),

  refreshCreatorAchievements: () =>
    request<{ new_achievements: CreatorAchievement[]; new_badges: string[]; achievements: string[]; badges: string[]; level: string; level_score: number }>(
      "/ecosystem/creators/me/refresh",
      { method: "POST" }
    ),

  getCreatorLeaderboard: (limit = 20) =>
    request<{ creators: CreatorLeaderboardEntry[] }>(`/ecosystem/creators/leaderboard?limit=${limit}`),

  getCreatorTrust: (userId: string) =>
    request<{ trust_score: number; level: string }>(`/ecosystem/creators/${userId}/trust`),

  // ── Learning Marketplace ────────────────────────────────────
  createCollection: (body: Partial<MarketplaceCollection> & { name: string; challenge_ids?: string[]; skills?: string[] }) =>
    request<{ collection_id: string }>("/ecosystem/collections", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  listCollections: (params?: { kind?: string; limit?: number }) => {
    const q = new URLSearchParams();
    if (params?.kind) q.set("kind", params.kind);
    if (params?.limit) q.set("limit", String(params.limit));
    const qs = q.toString();
    return request<{ collections: MarketplaceCollection[] }>(`/ecosystem/collections${qs ? `?${qs}` : ""}`);
  },

  getMyCollections: (limit = 50) =>
    request<{ collections: MarketplaceCollection[] }>(`/ecosystem/collections/mine?limit=${limit}`),

  bookmarkCollection: (id: string) =>
    request<{ success: boolean; bookmarked: boolean }>(`/ecosystem/collections/${id}/bookmark`, { method: "POST" }),

  // ── Challenge Versioning ────────────────────────────────────
  createChallengeVersion: (challengeId: string, body: { change_note?: string; major_version?: boolean }) =>
    request<{ success: boolean; version_id: string; version: number }>(`/ecosystem/challenges/${challengeId}/versions`, {
      method: "POST",
      body: JSON.stringify(body),
    }),

  getChallengeVersions: (challengeId: string, limit = 20) =>
    request<{ versions: ChallengeVersion[] }>(`/ecosystem/challenges/${challengeId}/versions?limit=${limit}`),

  // ── Event Platform ──────────────────────────────────────────
  createEvent: (body: Partial<PlatformEvent> & { title: string; event_type?: string }) =>
    request<{ event_id: string }>("/ecosystem/events", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  listEvents: (params?: { status?: string; event_type?: string; limit?: number }) => {
    const q = new URLSearchParams();
    if (params?.status) q.set("status", params.status);
    if (params?.event_type) q.set("event_type", params.event_type);
    if (params?.limit) q.set("limit", String(params.limit));
    const qs = q.toString();
    return request<{ events: PlatformEvent[] }>(`/ecosystem/events${qs ? `?${qs}` : ""}`);
  },

  joinEvent: (eventId: string) =>
    request<{ success: boolean; joined: boolean }>(`/ecosystem/events/${eventId}/join`, { method: "POST" }),

  leaveEvent: (eventId: string) =>
    request<{ success: boolean; joined: boolean }>(`/ecosystem/events/${eventId}/leave`, { method: "POST" }),

  // ── Trust & Moderation ──────────────────────────────────────
  submitReport: (body: { target_type: string; target_id: string; category?: string; reason?: string }) =>
    request<{ success: boolean; report_id: string }>("/ecosystem/reports", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  // ── Platform Intelligence ───────────────────────────────────
  getPlatformIntelligence: () =>
    request<PlatformIntelligence>("/ecosystem/intelligence"),

  // ── Admin ───────────────────────────────────────────────────
  adminListReports: (status = "pending", limit = 50) =>
    request<{ reports: ModerationReport[] }>(`/admin/ecosystem/moderation?status=${status}&limit=${limit}`),

  adminResolveReport: (reportId: string, body: { action: string; note?: string }) =>
    request<{ success: boolean; status: string }>(`/admin/ecosystem/moderation/${reportId}/resolve`, {
      method: "POST",
      body: JSON.stringify(body),
    }),

  adminGetModerationStats: () =>
    request<ModerationStats>("/admin/ecosystem/moderation/stats"),

  adminReviewVerification: (creatorId: string, body: { approve: boolean; note?: string }) =>
    request<{ success: boolean; status: string }>(`/admin/ecosystem/creators/${creatorId}/verify`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
};