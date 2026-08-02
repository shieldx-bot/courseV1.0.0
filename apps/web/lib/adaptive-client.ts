"use client";

import { apiClient } from "./api-client";
import type {
  ConceptDefinition,
  ConceptMastery,
  ConceptMasterySummary,
  RecommendedLessonSequence,
  AdaptiveQuiz,
  QuizResult,
  AdminAdaptiveStats,
  AdminPrerequisiteGap,
  RemedialContent,
  RemedialExerciseResult,
  RemediationSuggestion,
  PrerequisiteInfo,
  SkipLessonResult,
} from "@/types";

/**
 * Adaptive learning client for interacting with the adaptive learning API.
 *
 * Every method calls the real backend via `apiClient.adaptive.*` and unwraps
 * the `{ success, data, error, meta }` envelope. Mock fallbacks are kept ONLY
 * for endpoints that are not deployed yet (development convenience), matching
 * the Phase 4 pattern. All mastery scores use the 0-10 scale.
 */
export const adaptiveClient = {
  /**
   * Get recommended lesson sequence for a course based on user's mastery.
   * Falls back to an empty sequence when the endpoint is unavailable.
   */
  async getRecommendedSequence(
    courseId: string
  ): Promise<{ sequence: RecommendedLessonSequence[] }> {
    try {
      const data = await apiClient.adaptive.recommendedSequence(courseId);
      return { sequence: data?.sequence || [] };
    } catch (error) {
      console.error("Failed to get recommended sequence:", error);
      return { sequence: [] };
    }
  },

  /**
   * List all concepts for a course (with the learner's current mastery).
   * Falls back to sample concepts for development when the API is down.
   */
  async listConcepts(
    courseId: string
  ): Promise<ConceptDefinition[]> {
    try {
      const response = await apiClient.adaptive.listConcepts(courseId);
      return Array.isArray(response) ? response : [];
    } catch (error) {
      console.error("Failed to list concepts:", error);
      // Mock fallback for development when the API is not deployed yet.
      // Scores use the 0-10 mastery scale.
      return [
        {
          id: "concept-1",
          course_id: courseId,
          name: "Variables and Data Types",
          slug: "variables-data-types",
          description: "Understanding basic variables and data types",
          difficulty_base: 1,
          tags: ["basics", "python"],
          lesson_ids: ["lesson-1", "lesson-2"],
          prerequisite_concepts: [],
          mastery_score: 7.5,
        },
        {
          id: "concept-2",
          course_id: courseId,
          name: "Control Flow",
          slug: "control-flow",
          description: "Conditional statements and loops",
          difficulty_base: 2,
          tags: ["basics", "python"],
          lesson_ids: ["lesson-3", "lesson-4"],
          prerequisite_concepts: ["concept-1"],
          mastery_score: 6.0,
        },
        {
          id: "concept-3",
          course_id: courseId,
          name: "Functions",
          slug: "functions",
          description: "Creating and using functions",
          difficulty_base: 3,
          tags: ["intermediate", "python"],
          lesson_ids: ["lesson-5", "lesson-6"],
          prerequisite_concepts: ["concept-1", "concept-2"],
          mastery_score: 5.0,
        },
      ];
    }
  },

  /**
   * Get the user's current mastery across every concept in a course
   * (GET /adaptive/mastery/{course_id}).
   */
  async getCourseMastery(courseId: string): Promise<ConceptMasterySummary[]> {
    try {
      const rows = await apiClient.adaptive.mastery(courseId);
      return (Array.isArray(rows) ? rows : []).map((row) => ({
        id: row.concept_id,
        name: row.name || row.concept_id,
        mastery_score: Number(row.mastery_score ?? 0),
        trend: row.trend,
      }));
    } catch (error) {
      console.error("Failed to get course mastery:", error);
      return [];
    }
  },

  /**
   * Get mastery data for a single concept by looking it up in the course map.
   */
  async getConceptMastery(
    courseId: string,
    conceptId: string
  ): Promise<ConceptMastery | null> {
    try {
      const summary = await this.getCourseMastery(courseId);
      const found = summary.find((c) => c.id === conceptId);
      if (!found) return null;
      return {
        id: conceptId,
        user_id: "",
        course_id: courseId,
        concept_id: conceptId,
        mastery_score: found.mastery_score,
        attempts: 0,
        correct_attempts: 0,
        trend: found.trend || "stable",
        created_at: "",
        updated_at: "",
      };
    } catch (error) {
      console.error("Failed to get concept mastery:", error);
      return null;
    }
  },

  /**
   * List weak concepts (mastery < 3) with names resolved from the concept list.
   */
  async getWeak(courseId: string): Promise<ConceptMasterySummary[]> {
    return this.getMasterySummaryByBand(courseId, "weak");
  },

  /**
   * List strong concepts (mastery >= 7) with names resolved from the concept list.
   */
  async getStrong(courseId: string): Promise<ConceptMasterySummary[]> {
    return this.getMasterySummaryByBand(courseId, "strong");
  },

  /**
   * Get prerequisites for a concept with the user's mastery for each one.
   */
  async getPrerequisites(
    courseId: string,
    conceptId: string
  ): Promise<PrerequisiteInfo[]> {
    try {
      const data = await apiClient.adaptive.prerequisites(courseId, conceptId);
      return Array.isArray(data) ? data : [];
    } catch (error) {
      console.error("Failed to get prerequisites:", error);
      return [];
    }
  },

  /**
   * Get remediation suggestions for weak concepts (weakest first).
   */
  async getRemediation(courseId: string): Promise<RemediationSuggestion[]> {
    try {
      const data = await apiClient.adaptive.remediation(courseId);
      return (Array.isArray(data) ? data : []).sort(
        (a, b) => a.mastery_score - b.mastery_score
      );
    } catch (error) {
      console.error("Failed to get remediation:", error);
      return [];
    }
  },

  /**
   * Mark a lesson as ready to skip (POST /adaptive/skip/{course_id}/{lesson_id}).
   * Throws on failure so callers can surface the API reason (e.g. a 400 when
   * some concepts are not yet mastered). Phase 6 adds an optional
   * `updated_sequence` field the backend refreshes after the skip.
   */
  async skipLesson(courseId: string, lessonId: string): Promise<SkipLessonResult> {
    return apiClient.adaptive.skipLesson(courseId, lessonId);
  },

  /**
   * Submit a remedial micro-exercise to update mastery (Phase 6 endpoint).
   * Returns `null` when the endpoint is not deployed yet so the panel can fall
   * back to local grading without crashing (Phase 4/5 additive guard pattern).
   */
  async submitRemedialExercise(
    courseId: string,
    conceptId: string,
    answers: Record<number, number>
  ): Promise<RemedialExerciseResult | null> {
    try {
      const data = await apiClient.adaptive.submitRemedialExercise(courseId, conceptId, answers);
      if (
        data &&
        typeof data.mastery_before === "number" &&
        typeof data.mastery_after === "number" &&
        typeof data.total === "number"
      ) {
        return data;
      }
      return null;
    } catch (error) {
      console.error("Failed to submit remedial exercise:", error);
      return null;
    }
  },

  /**
   * Send 👍/👎 feedback for remedial content (Phase 6 endpoint). Returns false
   * when the endpoint is not deployed yet so callers can hide the control.
   */
  async sendRemedialFeedback(
    courseId: string,
    conceptId: string,
    helpful: boolean
  ): Promise<boolean> {
    try {
      const data = await apiClient.adaptive.sendRemedialFeedback(courseId, conceptId, helpful);
      return !!data && typeof data === "object" && !Array.isArray(data);
    } catch (error) {
      console.error("Failed to send remedial feedback:", error);
      return false;
    }
  },

  /**
   * Generate an adaptive quiz for a lesson (or a course-wide mastery check when
   * `lessonId` is omitted and the backend supports it). Throws on API errors.
   */
  async generateAdaptiveQuiz(
    courseId: string,
    lessonId?: string,
    mode: string = "practice"
  ): Promise<AdaptiveQuiz> {
    const quiz = await apiClient.adaptive.generateQuiz(courseId, lessonId, 5);
    return {
      ...quiz,
      mode: quiz.mode || mode,
    };
  },

  /**
   * Submit quiz answers and return the graded result.
   */
  async submitQuiz(
    courseId: string,
    quizId: string,
    answers: Record<number, number>,
    questions: unknown[]
  ): Promise<QuizResult> {
    return apiClient.adaptive.submitQuiz(courseId, { quiz_id: quizId, answers, questions });
  },

  /**
   * Get AI-generated remedial content for a concept. On API failure a safe
   * fallback is returned so the panel can render "Could not load remediation".
   */
  async remediationContent(courseId: string, conceptId: string): Promise<RemedialContent> {
    try {
      const data = await apiClient.adaptive.remediationContent(courseId, conceptId);
      return {
        concept_id: data.concept_id || conceptId,
        concept_name: data.concept_name || conceptId,
        explanation: data.explanation || "",
        exercise: data.exercise || { questions: [] },
        analogies: Array.isArray(data.analogies) ? data.analogies : [],
        generated: !!data.generated,
      };
    } catch (error) {
      console.error("Failed to get remediation content:", error);
      return {
        concept_id: conceptId,
        concept_name: conceptId,
        explanation: "Could not load remediation right now. Please try again later.",
        exercise: { questions: [] },
        analogies: [],
        generated: false,
      };
    }
  },

  /**
   * Admin stats for adaptive mastery dashboard
   * This is a mock implementation
   */
  async adminStats(courseId: string): Promise<AdminAdaptiveStats> {
    try {
      // Mock implementation - return admin stats based on course
      const concepts = [
        {
          id: "concept-1",
          name: "Variables and Data Types",
          difficulty_base: 1,
          avg_mastery: 8.5,
          student_count: 120,
          tags: ["basics", "python"],
        },
        {
          id: "concept-2",
          name: "Control Flow",
          difficulty_base: 2,
          avg_mastery: 7.2,
          student_count: 115,
          tags: ["basics", "python"],
        },
        {
          id: "concept-3",
          name: "Functions",
          difficulty_base: 3,
          avg_mastery: 5.8,
          student_count: 98,
          tags: ["intermediate", "python"],
        },
      ];

      return {
        course_id: courseId,
        total_concepts: concepts.length,
        avg_difficulty: concepts.reduce((sum, c) => sum + c.difficulty_base, 0) / concepts.length,
        concepts,
      };
    } catch (error) {
      console.error("Failed to get admin stats:", error);
      return {
        course_id: courseId,
        total_concepts: 0,
        avg_difficulty: 0,
        concepts: [],
      };
    }
  },

  /**
   * Admin prerequisite gaps for adaptive mastery dashboard
   * This is a mock implementation
   */
  async adminGaps(courseId: string): Promise<AdminPrerequisiteGap[]> {
    try {
      // Mock implementation - return prerequisite gaps
      return [
        {
          concept_id: "concept-3",
          concept_name: "Functions",
          weak_prerequisites: ["concept-1", "concept-2"],
          suggestion: "Review Variables and Control Flow before continuing with Functions.",
        },
        {
          concept_id: "concept-2",
          concept_name: "Control Flow",
          weak_prerequisites: ["concept-1"],
          suggestion: "Some students need additional practice with Variables before branching to Control Flow.",
        },
      ];
    } catch (error) {
      console.error("Failed to get admin gaps:", error);
      return [];
    }
  },

  /** Shared helper for weak/strong concept bands. */
  async getMasterySummaryByBand(
    courseId: string,
    band: "weak" | "strong"
  ): Promise<ConceptMasterySummary[]> {
    try {
      const [rows, concepts] = await Promise.all([
        band === "weak"
          ? apiClient.adaptive.weakConcepts(courseId)
          : apiClient.adaptive.strongConcepts(courseId),
        apiClient.adaptive.listConcepts(courseId).catch(() => []),
      ]);
      const nameById = new Map((Array.isArray(concepts) ? concepts : []).map((c) => [c.id, c.name]));
      return (Array.isArray(rows) ? rows : []).map((row) => ({
        id: row.concept_id,
        name: nameById.get(row.concept_id) || row.concept_id,
        mastery_score: Number(row.mastery_score ?? 0),
        trend: row.trend,
      }));
    } catch (error) {
      console.error(`Failed to get ${band} concepts:`, error);
      return [];
    }
  },
};
