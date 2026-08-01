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
  badges: string[];
}