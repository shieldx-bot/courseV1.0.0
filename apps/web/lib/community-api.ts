import type {
  Skill, Challenge, ChallengeAttempt, MentorAnalysis, ActivityEvent, CreatorProfile,
} from "../types/community";

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

export const communityApi = {
  // Challenges
  listChallenges: (params?: { skill?: string; difficulty?: string; source?: string; sort?: string; page?: number; per_page?: number }) => {
    const q = new URLSearchParams();
    if (params?.skill) q.set("skill", params.skill);
    if (params?.difficulty) q.set("difficulty", params.difficulty);
    if (params?.source) q.set("source", params.source);
    if (params?.sort) q.set("sort", params.sort);
    if (params?.page) q.set("page", String(params.page));
    if (params?.per_page) q.set("per_page", String(params.per_page));
    return request<{ challenges: Challenge[]; total: number; page: number; per_page: number }>(`/challenges?${q}`);
  },

  getChallenge: (id: string) => request<{ challenge: Challenge }>(`/challenges/${id}`),

  getRecommended: (limit = 10) =>
    request<{ challenges: Challenge[] }>(`/challenges/recommended?limit=${limit}`),

  getMyChallenges: (limit = 50) =>
    request<{ challenges: Challenge[] }>(`/challenges/my?limit=${limit}`),

  getBookmarked: (limit = 50) =>
    request<{ challenges: Challenge[] }>(`/challenges/bookmarked?limit=${limit}`),

  bookmark: (id: string) =>
    request<{ success: boolean; bookmarked: boolean }>(`/challenges/${id}/bookmark`, { method: "POST" }),

  unbookmark: (id: string) =>
    request<{ success: boolean; bookmarked: boolean }>(`/challenges/${id}/bookmark`, { method: "DELETE" }),

  rate: (id: string, rating: number) =>
    request<{ success: boolean; avg_rating: number }>(`/challenges/${id}/rate`, {
      method: "POST",
      body: JSON.stringify({ rating }),
    }),

  updateChallenge: (id: string, body: Partial<Challenge>) =>
    request<{ success: boolean; challenge: Challenge }>(`/challenges/${id}`, {
      method: "PUT",
      body: JSON.stringify(body),
    }),

  deleteChallenge: (id: string) =>
    request<{ success: boolean }>(`/challenges/${id}`, { method: "DELETE" }),

  publishChallenge: (id: string) =>
    request<{ success: boolean; status: string }>(`/challenges/${id}/publish`, { method: "POST" }),

  getAttempts: (challengeId: string) =>
    request<{ attempts: ChallengeAttempt[] }>(`/challenges/${challengeId}/attempts`),

  generateChallenge: (body: { topic: string; domain?: string; difficulty?: string; type?: string; skills?: string[] }) =>
    request<{ challenge: Challenge; llm_available: boolean }>("/challenges/generate", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  createChallenge: (body: Partial<Challenge>) =>
    request<{ challenge_id: string }>("/challenges", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  submitChallenge: (id: string, answer: unknown, time_seconds?: number) =>
    request<any>(`/challenges/${id}/submit`, {
      method: "POST",
      body: JSON.stringify({ answer, time_seconds }),
    }),

  // Skills
  getSkills: () => request<{ skills: Skill[] }>("/skills"),

  getMySkills: () =>
    request<{ skills: Skill[]; weak_skills: Skill[]; strong_skills: Skill[] }>("/skills/my"),

  getSkillChallenges: (skillId: string, limit = 10) =>
    request<{ challenges: Challenge[] }>(`/skills/${skillId}/challenges?limit=${limit}`),

  // AI Mentor
  getMentorAnalysis: (attemptId: string) =>
    request<MentorAnalysis>(`/mentor/analysis/${attemptId}`),

  getMentorRecommendations: (limit = 5) =>
    request<{ recommendations: Challenge[] }>(`/mentor/recommendations?limit=${limit}`),

  // Activity
  getActivityFeed: (limit = 30) =>
    request<{ events: ActivityEvent[] }>(`/activity?limit=${limit}`),

  getMyActivity: (limit = 30) =>
    request<{ events: ActivityEvent[] }>(`/activity/my?limit=${limit}`),

  // Creators
  getMyCreatorProfile: () => request<CreatorProfile>("/creators/me"),

  getCreatorProfile: (userId: string) => request<CreatorProfile>(`/creators/${userId}`),

  followCreator: (creatorId: string) =>
    request<{ success: boolean }>("/creators/follow", {
      method: "POST",
      body: JSON.stringify({ creator_id: creatorId }),
    }),

  unfollowCreator: (creatorId: string) =>
    request<{ success: boolean }>(`/creators/follow/${creatorId}`, { method: "DELETE" }),

  // Admin challenge management
  adminListChallenges: (params?: { search?: string; status?: string; difficulty?: string; source?: string; sort?: string; page?: number; per_page?: number }) => {
    const q = new URLSearchParams();
    if (params?.search) q.set("search", params.search);
    if (params?.status) q.set("status", params.status);
    if (params?.difficulty) q.set("difficulty", params.difficulty);
    if (params?.source) q.set("source", params.source);
    if (params?.sort) q.set("sort", params.sort);
    if (params?.page) q.set("page", String(params.page));
    if (params?.per_page) q.set("per_page", String(params.per_page));
    return request<{ challenges: Challenge[]; total: number; page: number; per_page: number }>(`/admin/challenges?${q}`);
  },

  adminGetChallenge: (id: string) =>
    request<{ challenge: Challenge; attempts: ChallengeAttempt[] }>(`/admin/challenges/${id}`),

  adminUpdateChallenge: (id: string, body: Partial<Challenge>) =>
    request<{ success: boolean; challenge: Challenge }>(`/admin/challenges/${id}`, {
      method: "PUT",
      body: JSON.stringify(body),
    }),

  adminPublishChallenge: (id: string) =>
    request<{ success: boolean; status: string }>(`/admin/challenges/${id}/publish`, { method: "POST" }),

  adminUnpublishChallenge: (id: string) =>
    request<{ success: boolean; status: string }>(`/admin/challenges/${id}/unpublish`, { method: "POST" }),

  adminDeleteChallenge: (id: string) =>
    request<{ success: boolean; deleted: string }>(`/admin/challenges/${id}`, { method: "DELETE" }),

  adminChallengeStats: () =>
    request<{
      total: number;
      published: number;
      drafts: number;
      total_attempts: number;
      completion_rate: number;
      by_difficulty: Record<string, number>;
      by_source: Record<string, number>;
    }>("/admin/challenges/stats"),
};