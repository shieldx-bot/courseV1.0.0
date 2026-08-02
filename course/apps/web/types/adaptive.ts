// ── Adaptive Learning domain types ──────────────────────────────────────────
// Shapes mirror the backend contracts:
//   - apps/api/app/api/v1/adaptive.py          (learner-facing endpoints)
//   - apps/api/app/api/v1/admin_adaptive.py    (admin CRUD / stats / bulk)
//   - apps/api/app/services/concept_mastery.py (concept + mastery records)
//   - apps/api/app/services/adaptive_quiz.py   (quiz generate / grade)
//   - apps/api/app/services/remediation.py     (suggestions + remedial content)

// ── Concepts ─────────────────────────────────────────────────────────────────

/** A concept definition. `mastery_score` is only attached by the learner-facing list endpoint. */
export interface ConceptDefinition {
  id: string;
  course_id: string;
  name: string;
  slug: string;
  description: string;
  difficulty_base: number;
  tags: string[];
  lesson_ids: string[];
  prerequisite_concepts: string[];
  is_active?: boolean;
  created_at?: string;
  updated_at?: string;
  mastery_score?: number;
}

/** Full concept mastery record returned by the backend (0-10 score scale). */
export interface ConceptMastery {
  id: string;
  user_id: string;
  course_id: string;
  concept_id: string;
  mastery_score: number;
  attempts: number;
  correct_attempts: number;
  last_practiced_at?: string | null;
  trend: "improving" | "declining" | "stable";
  created_at: string;
  updated_at: string;
}

/** Lightweight projection used by mastery widgets (radar / concept cards). */
export type ConceptMasterySummary = Pick<ConceptMastery, "id" | "mastery_score"> & {
  name: string;
  trend?: ConceptMastery["trend"];
};

/** Row returned by GET /adaptive/mastery/{course_id}. */
export interface CourseMasteryEntry {
  concept_id: string;
  name: string;
  mastery_score: number;
  trend?: ConceptMastery["trend"];
  attempts?: number;
}

/** Prerequisite projection returned by GET /adaptive/prerequisites/{course_id}/{concept_id}. */
export interface PrerequisiteInfo {
  id: string;
  name: string;
  description: string;
  mastery_score: number;
  mastered: boolean;
}

// ── Quiz ─────────────────────────────────────────────────────────────────────

/** A single multiple-choice question. Backend field is `question` (not `prompt`). */
export interface AdaptiveQuizQuestion {
  concept_id: string;
  concept_name: string;
  difficulty: number;
  question: string;
  options: string[];
  correct: number;
  explanation: string;
  /** Seconds the learner spent on this question. Added by the client on submit
   *  (backend Elo `time_factor` rewards <5s and penalizes >60s). Optional so an
   *  unmetered question never breaks the submit payload. */
  time_seconds?: number;
}

/** Envelope returned by POST /adaptive/quiz/{course_id}/generate. */
export interface AdaptiveQuiz {
  quiz_id: string | null;
  course_id: string;
  lesson_id: string;
  mode: string;
  questions: AdaptiveQuizQuestion[];
  total_questions: number;
  message?: string;
}

export interface QuizQuestionResult {
  question_index: number;
  concept_id: string;
  correct: boolean;
  selected_answer: number;
  correct_answer: number;
  explanation: string;
  mastery_delta?: number | null;
}

export interface ConceptQuizResult {
  concept_id: string;
  concept_name: string;
  mastery_before: number;
  mastery_after: number;
  mastery_delta: number;
  correct: boolean;
}

export interface WeakConcept {
  concept_id: string;
  concept_name: string;
  mastery_after: number;
}

/** Result returned by POST /adaptive/quiz/{course_id}/submit (and grade_quiz). */
export interface QuizResult {
  quiz_id: string;
  score: number;
  total_questions: number;
  score_pct: number;
  passed: boolean;
  results: QuizQuestionResult[];
  concept_results: ConceptQuizResult[];
  weak_concepts: WeakConcept[];
}

/** Stored quiz attempt document (backend persists under `_id`). */
export interface QuizAttempt {
  id: string;
  user_id: string;
  course_id: string;
  lesson_id?: string | null;
  mode: string;
  questions: Array<{ concept_id?: string; difficulty?: number; correct: boolean }>;
  score: number;
  total_questions: number;
  score_pct: number;
  passed: boolean;
  concept_results: ConceptQuizResult[];
  created_at: string;
}

// ── Remediation ──────────────────────────────────────────────────────────────

export interface RemediationSuggestion {
  concept_id: string;
  concept_name: string;
  mastery_score: number;
  trend: ConceptMastery["trend"];
  lesson_ids: string[];
  prerequisite_concepts: string[];
  suggestion: string;
  /** Additive field (Phase 6): prerequisite weak concepts first, then severity. */
  priority?: number;
}

export interface RemedialQuestion {
  question: string;
  options: string[];
  correct: number;
  explanation: string;
}

/** Content returned by POST /adaptive/remediation/{course_id}/content/{concept_id}. */
export interface RemedialContent {
  concept_id: string;
  concept_name: string;
  explanation: string;
  exercise: { questions: RemedialQuestion[] };
  analogies: string[];
  generated: boolean;
}

/** Result returned by POST /adaptive/remediation/{course_id}/exercise/{concept_id}/submit. */
export interface RemedialExerciseResult {
  correct_count: number;
  total: number;
  mastery_before: number;
  mastery_after: number;
}

// ── Recommended sequence ─────────────────────────────────────────────────────

export interface RecommendedLessonSequence {
  lesson_id: string;
  title: string;
  order: number;
  status: "normal" | "remedial" | "ready-to-skip";
  is_synthetic?: boolean;
  target_lesson_id?: string;
  weak_concepts: string[];
  strong_concepts: string[];
}

export interface RecommendedCourseSequence {
  course_id: string;
  sequence: RecommendedLessonSequence[];
}

/** Result returned by POST /adaptive/skip/{course_id}/{lesson_id}. */
export interface SkipLessonResult {
  skipped: boolean;
  lesson_id: string;
  /** Additive (Phase 6): sequence already refreshed by the backend after skip. */
  updated_sequence?: RecommendedLessonSequence[];
}

// ── Admin ────────────────────────────────────────────────────────────────────

/** Concept shape returned by the admin endpoints. */
export interface AdminConcept {
  id: string;
  course_id: string;
  name: string;
  slug: string;
  description: string;
  difficulty_base: number;
  tags: string[];
  lesson_ids: string[];
  prerequisite_concepts: string[];
  is_active?: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface AdminConceptCreate {
  course_id: string;
  name: string;
  description: string;
  difficulty_base: number;
  tags: string[];
  lesson_ids: string[];
  prerequisite_concepts: string[];
}

export interface AdminConceptUpdate {
  name?: string;
  description?: string;
  difficulty_base?: number;
  tags?: string[];
  lesson_ids?: string[];
  prerequisite_concepts?: string[];
  is_active?: boolean;
}

/** Stats returned by GET /admin/adaptive/stats/{course_id}. */
export interface AdminAdaptiveStats {
  course_id: string;
  total_concepts: number;
  avg_difficulty: number;
  concepts: Array<{
    id: string;
    name: string;
    difficulty_base: number;
    avg_mastery: number;
    student_count: number;
    tags: string[];
  }>;
}

export interface AdminPrerequisiteGap {
  concept_id: string;
  concept_name: string;
  weak_prerequisites: string[];
  suggestion: string;
}
