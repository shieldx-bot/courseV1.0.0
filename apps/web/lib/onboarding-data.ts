import type { OnboardingProfile, OnboardingStatus } from "@/types";
import type { Challenge } from "@/types/community";

export const ONBOARDING_STEPS = [
  "welcome",
  "interests",
  "level",
  "goal",
  "personalize",
  "dashboard",
  "first-challenge",
  "reward",
  "finish",
] as const;

export type OnboardingStep = (typeof ONBOARDING_STEPS)[number];

export const DEFAULT_ONBOARDING: OnboardingProfile = {
  status: "not_started",
  interests: [],
  level: "",
  goal: "",
  first_challenge_completed: false,
};

export const MAX_INTERESTS = 3;

export interface InterestOption {
  id: string;
  label: string;
  icon: string;
}

export const INTEREST_OPTIONS: InterestOption[] = [
  { id: "linux", label: "Linux", icon: "🐧" },
  { id: "aws", label: "AWS", icon: "☁️" },
  { id: "docker", label: "Docker", icon: "🐳" },
  { id: "kubernetes", label: "Kubernetes", icon: "⚓" },
  { id: "python", label: "Programming", icon: "💻" },
  { id: "networking", label: "Networking", icon: "🌐" },
  { id: "security", label: "Security", icon: "🔐" },
  { id: "cloud", label: "Cloud", icon: "☁️" },
  { id: "ai", label: "AI & ML", icon: "🤖" },
  { id: "devops", label: "DevOps", icon: "🛠️" },
];

export interface LevelOption {
  id: string;
  label: string;
  emoji: string;
  description: string;
}

export const LEVEL_OPTIONS: LevelOption[] = [
  { id: "beginner", label: "Beginner", emoji: "🌱", description: "New to this topic" },
  { id: "intermediate", label: "Intermediate", emoji: "🚀", description: "Know the basics, want depth" },
  { id: "advanced", label: "Advanced", emoji: "🔥", description: "Comfortable, want mastery" },
  { id: "professional", label: "Professional", emoji: "👑", description: "Work with this daily" },
];

export interface GoalOption {
  id: string;
  label: string;
  emoji: string;
  description: string;
}

export const GOAL_OPTIONS: GoalOption[] = [
  { id: "certified", label: "Get certified", emoji: "🎓", description: "AWS, LF, and vendor certs" },
  { id: "interviews", label: "Prepare for interviews", emoji: "🎯", description: "System design & technical rounds" },
  { id: "improve-linux", label: "Improve Linux", emoji: "🐧", description: "Shell mastery and administration" },
  { id: "coding", label: "Practice coding", emoji: "⌨️", description: "Daily problem-solving reps" },
  { id: "devops", label: "Learn DevOps", emoji: "🛠️", description: "CI/CD, IaC, monitoring" },
  { id: "security", label: "Become a Security Engineer", emoji: "🛡️", description: "Defensive & offensive skills" },
  { id: "portfolio", label: "Build portfolio", emoji: "📂", description: "Projects and proof of work" },
  { id: "job", label: "Find a better job", emoji: "💼", description: "Career change or promotion" },
];

export const GOAL_LABELS: Record<string, string> = Object.fromEntries(
  GOAL_OPTIONS.map((g) => [g.id, g.label])
);

export const LEVEL_LABELS: Record<string, string> = Object.fromEntries(
  LEVEL_OPTIONS.map((l) => [l.id, l.label])
);

const INTEREST_LABEL: Record<string, string> = Object.fromEntries(
  INTEREST_OPTIONS.map((i) => [i.id, i.label])
);

export function normalizeOnboarding(
  value: Partial<OnboardingProfile> | undefined | null
): OnboardingProfile {
  if (!value) return { ...DEFAULT_ONBOARDING };
  return {
    status: (value.status as OnboardingStatus) ?? DEFAULT_ONBOARDING.status,
    interests: Array.isArray(value.interests) ? value.interests : [],
    level: value.level ?? "",
    goal: value.goal ?? "",
    first_challenge_completed: value.first_challenge_completed ?? false,
  };
}

export function isOnboardingComplete(
  profile: OnboardingProfile | undefined | null
): boolean {
  return normalizeOnboarding(profile).status === "completed";
}

export function isOnboardingBlocked(
  profile: OnboardingProfile | undefined | null
): boolean {
  const p = normalizeOnboarding(profile);
  return p.status === "not_started" || p.status === "in_progress";
}

export function isOnboardingSkipped(
  profile: OnboardingProfile | undefined | null
): boolean {
  return normalizeOnboarding(profile).status === "skipped";
}

export function firstChallengeDifficulty(level: string): string {
  return level === "professional" ? "medium" : "easy";
}

export interface RecommendedChallenge {
  _id: string;
  title: string;
  description: string;
  difficulty: string;
  domain: string;
  topic: string;
  skills: string[];
  stats: {
    attempts: number;
    completion_rate: number;
    avg_rating: number;
    bookmarks: number;
  };
  url: string;
}

export const FALLBACK_FIRST_CHALLENGES: RecommendedChallenge[] = [
  {
    _id: "onboarding-first-linux",
    title: "Linux Basics: Files & Permissions",
    description: "Learn how Linux organizes files and controls access with permissions.",
    difficulty: "easy",
    domain: "linux",
    topic: "Linux",
    skills: ["linux", "bash"],
    stats: { attempts: 18420, completion_rate: 0.94, avg_rating: 4.8, bookmarks: 3102 },
    url: "/challenges",
  },
  {
    _id: "onboarding-first-docker",
    title: "Docker 101: Run Your First Container",
    description: "Pull an image, run a container, and understand container fundamentals.",
    difficulty: "easy",
    domain: "docker",
    topic: "Docker",
    skills: ["docker", "containers"],
    stats: { attempts: 15210, completion_rate: 0.92, avg_rating: 4.7, bookmarks: 2740 },
    url: "/challenges",
  },
  {
    _id: "onboarding-first-kubernetes",
    title: "Kubernetes: What is a Pod?",
    description: "Understand pods, the smallest deployable unit in Kubernetes.",
    difficulty: "easy",
    domain: "kubernetes",
    topic: "Kubernetes",
    skills: ["kubernetes", "containers"],
    stats: { attempts: 11840, completion_rate: 0.9, avg_rating: 4.6, bookmarks: 2190 },
    url: "/challenges",
  },
  {
    _id: "onboarding-first-aws",
    title: "AWS: IAM Roles & Policies",
    description: "Learn how IAM controls access to AWS resources with roles and policies.",
    difficulty: "easy",
    domain: "aws",
    topic: "AWS",
    skills: ["aws", "iam"],
    stats: { attempts: 16420, completion_rate: 0.91, avg_rating: 4.7, bookmarks: 2890 },
    url: "/challenges",
  },
  {
    _id: "onboarding-first-networking",
    title: "Networking: How DNS Works",
    description: "Understand how DNS translates domain names into IP addresses.",
    difficulty: "easy",
    domain: "networking",
    topic: "Networking",
    skills: ["networking", "dns"],
    stats: { attempts: 13210, completion_rate: 0.89, avg_rating: 4.5, bookmarks: 1980 },
    url: "/challenges",
  },
  {
    _id: "onboarding-first-programming",
    title: "Python: Your First Program",
    description: "Write and run your first Python program — variables, functions, and print.",
    difficulty: "easy",
    domain: "programming",
    topic: "Programming",
    skills: ["python", "programming"],
    stats: { attempts: 20140, completion_rate: 0.95, avg_rating: 4.9, bookmarks: 3210 },
    url: "/challenges",
  },
  {
    _id: "onboarding-first-security",
    title: "Security: Threat Modeling Basics",
    description: "Learn how security professionals think about threats and attack surfaces.",
    difficulty: "easy",
    domain: "security",
    topic: "Security",
    skills: ["security"],
    stats: { attempts: 9870, completion_rate: 0.88, avg_rating: 4.6, bookmarks: 1640 },
    url: "/challenges",
  },
  {
    _id: "onboarding-first-cloud",
    title: "Cloud: The Shared Responsibility Model",
    description: "Understand security responsibilities split between providers and users.",
    difficulty: "easy",
    domain: "cloud",
    topic: "Cloud",
    skills: ["cloud", "aws"],
    stats: { attempts: 10980, completion_rate: 0.9, avg_rating: 4.6, bookmarks: 1890 },
    url: "/challenges",
  },
  {
    _id: "onboarding-first-ai",
    title: "AI: How Large Language Models Work",
    description: "Understand the intuition behind LLMs and how they generate text.",
    difficulty: "easy",
    domain: "ai",
    topic: "AI",
    skills: ["ai", "ml"],
    stats: { attempts: 14320, completion_rate: 0.91, avg_rating: 4.7, bookmarks: 2540 },
    url: "/challenges",
  },
  {
    _id: "onboarding-first-devops",
    title: "DevOps: CI/CD Pipeline Fundamentals",
    description: "Learn the stages of a CI/CD pipeline from commit to deployment.",
    difficulty: "easy",
    domain: "devops",
    topic: "DevOps",
    skills: ["devops", "ci-cd"],
    stats: { attempts: 12140, completion_rate: 0.9, avg_rating: 4.6, bookmarks: 2110 },
    url: "/challenges",
  },
];

export function pickFirstChallenge(
  interests: string[],
  level: string,
  liveChallenges: Challenge[]
): RecommendedChallenge {
  const difficulty = firstChallengeDifficulty(level);
  const live = (liveChallenges || [])
    .filter(
      (c) =>
        c &&
        c.difficulty === difficulty &&
        c.status === "published" &&
        (!interests.length ||
          (c.skills_raw || []).some((s) =>
            interests.includes(s.toLowerCase())
          ))
    )
    .sort(
      (a, b) =>
        (b.stats?.completion_rate || 0) - (a.stats?.completion_rate || 0)
    );

  const best = live[0];
  if (best) {
    return {
      _id: best._id,
      title: best.title,
      description: best.description,
      difficulty: best.difficulty,
      domain: best.domain,
      topic: best.topic,
      skills: best.skills,
      stats: best.stats || {
        attempts: 0,
        completion_rate: 0,
        avg_rating: 0,
        bookmarks: 0,
      },
      url: `/challenges/${best._id}`,
    };
  }

  for (const interest of interests) {
    const match = FALLBACK_FIRST_CHALLENGES.find((c) =>
      c.skills.includes(interest)
    );
    if (match) return match;
  }
  return (
    FALLBACK_FIRST_CHALLENGES.find((c) => c.domain === "programming") ||
    FALLBACK_FIRST_CHALLENGES[0]
  );
}

export function recommendedPathSlug(interests: string[]): string {
  const map: Record<string, string> = {
    linux: "linux-engineer",
    aws: "cloud-engineer",
    docker: "devops-engineer",
    kubernetes: "devops-engineer",
    python: "backend-engineer",
    networking: "network-engineer",
    security: "security-engineer",
    cloud: "cloud-engineer",
    ai: "ai-engineer",
    devops: "devops-engineer",
  };
  for (const i of interests) if (map[i]) return map[i];
  return "devops-engineer";
}

export function recommendedPathLabel(interests: string[]): string {
  const labels = interests.map((i) => INTEREST_LABEL[i]).filter(Boolean);
  if (!labels.length) return "DevOps Engineer";
  return `${labels.slice(0, 2).join(" + ")}${
    labels.length > 2 ? ` +${labels.length - 2}` : ""
  }`;
}

export function weeklyXpEstimate(level: string): number {
  switch (level) {
    case "beginner":
      return 150;
    case "intermediate":
      return 250;
    case "advanced":
      return 400;
    case "professional":
      return 500;
    default:
      return 200;
  }
}

export function greetingName(name?: string): string {
  const first = (name || "").trim().split(/\s+/)[0];
  return first || "Challenger";
}

export function dailyObjectiveLabel(interests: string[]): string {
  const firstInterest = interests[0];
  const label = INTEREST_LABEL[firstInterest] || "DevOps";
  return `Complete 1 ${label} challenge`;
}

export function goalMotivation(goal: string): string {
  const map: Record<string, string> = {
    certified: "Every challenge below is one step closer to your certification.",
    interviews: "Sharpen the exact skills interviewers test.",
    "improve-linux": "Real Linux mastery comes from doing, not watching.",
    coding: "Consistency beats intensity — one challenge a day builds the habit.",
    devops: "Ship pipelines, containers, and infrastructure like a pro.",
    security: "Think like an attacker to defend like an engineer.",
    portfolio: "Each solved challenge becomes proof of your capability.",
    job: "Skills you can demonstrate get you hired faster.",
  };
  return map[goal] || "Every challenge below brings you closer to your goal.";
}