export interface Skill {
  skill_id: string;
  name: string;
  slug: string;
  category: string;
  description: string;
  prerequisites: string[];
  parent_skill: string | null;
  mastery_score: number;
  level: string;
  attempts: number;
  correct_count: number;
  avg_time_seconds: number | null;
  consistency_score: number;
  last_updated?: string;
  recent_history?: any[];
}

export interface ChallengeContent {
  question: string;
  options?: string[];
  correct?: number;
  scenario?: string;
  expected_answer?: string;
}

export interface Challenge {
  _id: string;
  title: string;
  description: string;
  topic: string;
  domain: string;
  difficulty: string;
  difficulty_score: number;
  type: string;
  content: ChallengeContent;
  explanation: string;
  skills: string[];
  skills_raw: string[];
  source: string;
  creator_id: string | null;
  status: string;
  quality_score: number;
  stats: {
    attempts: number;
    completion_rate: number;
    avg_rating: number;
    bookmarks: number;
  };
  created_at: string;
  updated_at?: string;
}

export interface ChallengeStats {
  total: number;
  published: number;
  drafts: number;
  total_attempts: number;
  completion_rate: number;
  by_difficulty: Record<string, number>;
  by_source: Record<string, number>;
}

export interface MentorAnalysis {
  reason?: string;
  missing_knowledge: string[];
  study_tips: string[];
  recommended_topics: string[];
  weak_concepts: any[];
  recommendations: any[];
}

export interface ChallengeAttempt {
  _id: string;
  challenge_id: string;
  is_correct: boolean;
  score: number;
  time_seconds: number | null;
  mentor_analysis: MentorAnalysis | null;
  created_at: string;
}

export interface ActivityEvent {
  id: string;
  user_id: string;
  user_name: string;
  type: string;
  label: string;
  payload: any;
  created_at: string;
}

export interface CreatorProfile {
  user_id: string;
  user_name: string;
  level: string;
  level_score: number;
  total_challenges: number;
  published_challenges: number;
  total_attempts_received: number;
  avg_completion_rate: number;
  avg_rating: number;
  followers_count: number;
  following_count?: number;
  badges: string[];
  // Optional public identity fields (enriched when available)
  display_name?: string;
  avatar_url?: string;
  bio?: string;
  title?: string;
  location?: string;
  languages?: string[];
  website?: string;
  social?: { twitter?: string; github?: string; linkedin?: string; youtube?: string };
  verified?: boolean;
  is_verified?: boolean;
  rank?: string;
  rating?: number;
  competitive_rating?: number;
  total_xp?: number;
  xp?: number;
  current_streak?: number;
  longest_streak?: number;
  reputation?: number;
  contribution_score?: number;
  creator_score?: number;
  joined_at?: string;
  created_at?: string;
  stats?: Record<string, any>;
}

/* ── Community Hub ───────────────────────────────────────────── */

export interface CommunityHubStats {
  members: number;
  events_last_24h: number;
  challenges_solved_24h: number;
  discussions_total: number;
  challenges_published: number;
  active_members_24h: number;
}

export interface CommunityHubDiscussion {
  id: string;
  lesson_id: string;
  course_id: string;
  course_title: string | null;
  user_id: string;
  user_name: string;
  title: string;
  excerpt: string;
  reply_count: number;
  vote_score: number;
  user_vote: number;
  is_pinned: boolean;
  is_locked: boolean;
  created_at: string;
  updated_at: string;
}

export interface CommunityHubMember {
  user_id: string;
  user_name: string;
  role: string;
  level: string;
  level_score: number;
  published_challenges: number;
  followers: number;
  avg_rating: number;
  badges: string[];
}

export interface CommunityHubData {
  feed: ActivityEvent[];
  stats: CommunityHubStats;
  discussions: CommunityHubDiscussion[];
  members: CommunityHubMember[];
}

/* ── Arena ──────────────────────────────────────────────────── */

export interface ArenaPlayer {
  user_id: string;
  user_name?: string;
  country?: string;
  company?: string;
  university?: string;
  rating: number;
  rank: string;
  provisional: boolean;
  matches: number;
  wins: number;
  losses: number;
  season_points: number;
  peak_rating: number;
  updated_at: string | null;
}

export interface ArenaLeaderboardData {
  scope: string;
  period: string;
  players: ArenaPlayer[];
  my_rank: number | null;
}

export interface ArenaLiveBattle {
  id: string;
  mode: string;
  topic: string;
  status: "lobby" | "live";
  participants: { user_id: string; user_name: string; rating_before?: number }[];
  created_at: string;
}

export interface ArenaMatch {
  id: string;
  topic: string;
  mode: string;
  created_at: string;
  won: boolean;
  rating_delta: number | null;
  rating_after: number | null;
  score: number | null;
  time_seconds: number | null;
  summary: { winner: string; winner_score: number; loser: string; loser_score: number; text: string } | null;
  opponent: { user_id: string; user_name: string; rating_before?: number };
}
