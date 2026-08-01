import type {
  Skill, Challenge, ChallengeAttempt, MentorAnalysis, ActivityEvent, CreatorProfile,
} from "../types/community";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "/api/v1";

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
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
    return request<{ challenges: Challenge[]; total: number }>(`/challenges?${q}`);
  },

  getChallenge: (id: string) => request<{ challenge: Challenge }>(`/challenges/${id}`),

  getRecommended: (limit = 10) =>
    request<{ challenges: Challenge[] }>(`/challenges/recommended?limit=${limit}`),

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
};