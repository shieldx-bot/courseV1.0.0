/* ── Ecosystem — Creator Economy, Marketplace, Events, Trust, Intelligence ── */

export interface CreatorVerification {
  status: "unverified" | "pending" | "verified" | "rejected";
  requested_at: string | null;
  reviewed_at: string | null;
  reviewer_id?: string;
  note?: string;
  full_name?: string;
  expertise_area?: string;
  evidence_urls?: string[];
}

export interface CreatorBadge {
  label: string;
  icon: string;
  description: string;
}

export interface CreatorAchievement {
  id: string;
  label: string;
  target: number;
  metric: string;
}

export interface CreatorProfileExtended {
  user_id: string;
  user_name: string;
  level: string;
  level_score: number;
  trust_score: number;
  verification: CreatorVerification;
  total_challenges: number;
  published_challenges: number;
  total_attempts_received: number;
  avg_completion_rate: number;
  avg_rating: number;
  followers: number;
  badges: string[];
  achievements: string[];
  collections: any[];
  series: any[];
  events_hosted: number;
  created_at: string;
}

export interface CreatorAnalytics {
  days: number;
  profile: {
    level: string;
    level_score: number;
    trust_score: number;
    verification: string;
    followers: number;
    badges: string[];
    achievements: string[];
  };
  totals: {
    published_challenges: number;
    total_challenges: number;
    total_attempts_received: number;
    avg_completion_rate: number;
    avg_rating: number;
  };
  window: {
    attempts: number;
    correct: number;
    completion_rate: number;
    new_followers: number;
    ratings_received: number;
    avg_rating_window: number;
  };
  per_challenge: Array<{
    challenge_id: string;
    title: string;
    difficulty: string;
    attempts: number;
    completion_rate: number;
    avg_rating: number;
    bookmarks: number;
    created_at: string;
  }>;
}

export interface CreatorLeaderboardEntry {
  rank: number;
  user_id: string;
  user_name: string;
  avatar_url: string | null;
  level: string;
  level_score: number;
  published_challenges: number;
  total_attempts_received: number;
  followers: number;
  trust_score: number;
  verified: boolean;
  badges: string[];
}

export interface MarketplaceCollection {
  id: string;
  name: string;
  description: string;
  kind: "collection" | "series" | "bundle" | "kit";
  creator_id: string;
  creator_name: string;
  challenge_count: number;
  challenge_preview: Array<{ challenge_id: string; title: string; difficulty: string }>;
  cover_emoji: string;
  is_premium: boolean;
  bookmark_count: number;
  created_at: string;
}

export interface ChallengeVersion {
  version_id: string;
  change_note: string;
  major_version: boolean;
  created_at: string;
  challenge_title: string;
}

export interface PlatformEvent {
  id: string;
  title: string;
  description: string;
  event_type: string;
  emoji: string;
  host_id: string;
  host_name: string;
  mode: string;
  location: string;
  start_time: string;
  end_time: string | null;
  recurring: boolean;
  interval_days: number;
  challenge_id: string | null;
  capacity: number | null;
  attendee_count: number;
  is_featured: boolean;
  status: string;
  created_at: string;
}

export interface ModerationReport {
  id: string;
  reporter_id: string;
  reporter_name: string;
  target_type: string;
  target: { id: string; title: string; creator_id?: string } | null;
  category: string;
  category_label: string;
  reason: string;
  status: string;
  created_at: string;
}

export interface ModerationStats {
  total: number;
  pending: number;
  resolved: number;
  dismissed: number;
  by_category: Record<string, number>;
}

export interface PlatformIntelligence {
  generated_at: string;
  low_quality: Array<{
    challenge_id: string;
    title: string;
    quality_score: number;
    avg_rating: number;
    completion_rate: number;
    attempts: number;
  }>;
  stale_content: Array<{
    challenge_id: string;
    title: string;
    last_activity: string;
    created_at: string;
  }>;
  popular_skills: Array<{
    skill_id: string;
    name: string;
    category: string;
    attempts_7d: number;
  }>;
  emerging_skills: Array<{
    skill_id: string;
    name: string;
    category: string;
    new_challenges_14d: number;
  }>;
  knowledge_gaps: Array<{
    skill_id: string;
    name: string;
    category: string;
    attempts_7d: number;
    challenges_available: number;
  }>;
  top_creators: Array<{
    user_id: string;
    user_name: string;
    trust_score: number;
    level: string;
    published_challenges: number;
  }>;
  summary: {
    low_quality_count: number;
    stale_count: number;
    popular_skills_count: number;
    emerging_skills_count: number;
    knowledge_gaps_count: number;
  };
}