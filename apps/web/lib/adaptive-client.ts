"use client";

import { apiClient } from "./api-client";
import type {
  ConceptDefinition,
  ConceptMastery,
  RecommendedLessonSequence,
  AdaptiveQuizQuestion,
  QuizResult,
  AdaptiveQuiz,
  AdminAdaptiveStats,
  AdminPrerequisiteGap,
  RemedialContent,
  RemedialQuestion,
} from "@/types";

/**
 * Adaptive learning client for interacting with the adaptive learning API
 */
export const adaptiveClient = {
  /**
   * Get recommended lesson sequence for a course based on user's mastery
   * This is a mock implementation since the API doesn't have this endpoint yet
   */
  async getRecommendedSequence(
    courseId: string
  ): Promise<{ sequence: RecommendedLessonSequence[] }> {
    try {
      // Mock implementation - in a real app, this would call the API
      // For now, we'll return an empty sequence
      return { sequence: [] };
    } catch (error) {
      console.error("Failed to get recommended sequence:", error);
      return { sequence: [] };
    }
  },

  /**
   * List all concepts for a course
   */
  async listConcepts(
    courseId: string
  ): Promise<ConceptDefinition[]> {
    try {
      const response = await apiClient.adaptive.listConcepts(courseId);
      return response.concepts || [];
    } catch (error) {
      console.error("Failed to list concepts:", error);
      // Return mock concepts for development
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
          mastery_score: 0.75,
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
          mastery_score: 0.6,
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
          mastery_score: 0.5,
        },
      ];
    }
  },

  /**
   * Get mastery data for a specific concept
   * This is a mock implementation
   */
  async getConceptMastery(
    courseId: string,
    conceptId: string
  ): Promise<ConceptMastery | null> {
    try {
      // Mock implementation
      return {
        id: conceptId,
        user_id: "mock-user",
        course_id: courseId,
        concept_id: conceptId,
        mastery_score: Math.random() * 0.5 + 0.5, // 0.5-1.0 range
        attempts: Math.floor(Math.random() * 10),
        correct_attempts: Math.floor(Math.random() * 8),
        last_practiced_at: new Date().toISOString(),
        trend: ["improving", "declining", "stable"][Math.floor(Math.random() * 3)] as "improving" | "declining" | "stable",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
    } catch (error) {
      console.error("Failed to get concept mastery:", error);
      return null;
    }
  },

  /**
   * Skip a lesson (mark as ready to skip based on mastery)
   * This is a mock implementation
   */
  async skipLesson(
    courseId: string,
    lessonId: string
  ): Promise<{ success: boolean }> {
    try {
      // Mock implementation - always succeed
      console.log(`Mock: Skipping lesson ${lessonId} in course ${courseId}`);
      return { success: true };
    } catch (error) {
      console.error("Failed to skip lesson:", error);
      return { success: false };
    }
  },

  /**
   * Generate an adaptive quiz for a lesson
   * This is a mock implementation
   */
  async generateAdaptiveQuiz(
    courseId: string,
    lessonId: string,
    mode: string = "practice"
  ): Promise<AdaptiveQuiz> {
    try {
      // Mock implementation
      return {
        quiz_id: `quiz-${Date.now()}`,
        course_id: courseId,
        lesson_id: lessonId,
        mode,
        questions: [
          {
            concept_id: "concept-1",
            concept_name: "Variables",
            difficulty: 1,
            question: "What is the correct way to declare a variable in Python?",
            options: [
              "var x = 5",
              "x = 5",
              "let x = 5",
              "variable x = 5"
            ],
            correct: 1,
            explanation: "Python uses simple assignment with = operator"
          },
          {
            concept_id: "concept-2",
            concept_name: "Control Flow",
            difficulty: 2,
            question: "Which keyword is used for conditional statements in Python?",
            options: [
              "if",
              "when",
              "switch",
              "case"
            ],
            correct: 0,
            explanation: "Python uses 'if' for conditional statements"
          }
        ],
        total_questions: 2,
        message: "Generated mock adaptive quiz",
      };
    } catch (error) {
      console.error("Failed to generate adaptive quiz:", error);
      return {
        quiz_id: null,
        course_id: courseId,
        lesson_id: lessonId,
        mode,
        questions: [],
        total_questions: 0,
        message: "Failed to generate quiz",
      };
    }
  },

  /**
   * Submit quiz answers and get results
   * This is a mock implementation
   */
  async submitQuizAnswers(
    quizId: string,
    answers: number[]
  ): Promise<QuizResult> {
    try {
      // Mock implementation - score randomly based on answers
      const correctAnswers = answers.map(answer => Math.random() > 0.5 ? 1 : 0);
      const score = correctAnswers.reduce((sum, val) => sum + val, 0 as number);

      return {
        quiz_id: quizId,
        score,
        total_questions: answers.length,
        score_pct: Math.round((score / answers.length) * 100),
        passed: score >= answers.length * 0.7, // 70% passing
        results: answers.map((answer, index) => ({
          question_index: index,
          concept_id: `concept-${index + 1}`,
          correct: Math.random() > 0.5,
          selected_answer: answer,
          correct_answer: Math.floor(Math.random() * 4),
          explanation: "This is a mock explanation for the answer",
          mastery_delta: Math.random() * 0.2 - 0.1,
        })),
        concept_results: [
          {
            concept_id: "concept-1",
            concept_name: "Variables",
            mastery_before: 0.6,
            mastery_after: 0.75,
            mastery_delta: 0.15,
            correct: true,
          },
          {
            concept_id: "concept-2",
            concept_name: "Control Flow",
            mastery_before: 0.5,
            mastery_after: 0.65,
            mastery_delta: 0.15,
            correct: false,
          }
        ],
        weak_concepts: [
          {
            concept_id: "concept-2",
            concept_name: "Control Flow",
            mastery_after: 0.65,
          }
        ],
      };
    } catch (error) {
      console.error("Failed to submit quiz answers:", error);
      return {
        quiz_id: quizId,
        score: 0,
        total_questions: answers.length,
        score_pct: 0,
        passed: false,
        results: [],
        concept_results: [],
        weak_concepts: [],
      };
    }
  },

  /**
   * Get quiz questions by quiz ID
   * This is a mock implementation
   */
  async getQuizQuestions(quizId: string): Promise<AdaptiveQuizQuestion[]> {
    try {
      // Mock implementation
      return [
        {
          concept_id: "concept-1",
          concept_name: "Variables",
          difficulty: 1,
          question: "What is the correct way to declare a variable in Python?",
          options: [
            "var x = 5",
            "x = 5",
            "let x = 5",
            "variable x = 5"
          ],
          correct: 1,
          explanation: "Python uses simple assignment with = operator"
        },
        {
          concept_id: "concept-2",
          concept_name: "Control Flow",
          difficulty: 2,
          question: "Which keyword is used for conditional statements in Python?",
          options: [
            "if",
            "when",
            "switch",
            "case"
          ],
          correct: 0,
          explanation: "Python uses 'if' for conditional statements"
        }
      ];
    } catch (error) {
      console.error("Failed to get quiz questions:", error);
      return [];
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
          avg_mastery: 0.85,
          student_count: 120,
          tags: ["basics", "python"],
        },
        {
          id: "concept-2",
          name: "Control Flow",
          difficulty_base: 2,
          avg_mastery: 0.72,
          student_count: 115,
          tags: ["basics", "python"],
        },
        {
          id: "concept-3",
          name: "Functions",
          difficulty_base: 3,
          avg_mastery: 0.58,
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

  async remediationContent(courseId: string, conceptId: string): Promise<RemedialContent> {
    try {
      const explanations: Record<string, string> = {
        "concept-1": "Variables are used to store information in memory. In Python, you create a variable by assigning a value with the = operator.",
        "concept-2": "Control flow lets you direct program execution using conditionals and loops. Mastering this unlocks any algorithmic workflow.",
        "concept-3": "Functions let you bundle reusable logic. Parameters, return values, and scope are the main building blocks you need.",
      };

      const analogies: Record<string, string[]> = {
        "concept-1": [
          "A variable is like a named box that can hold only one thing at a time, but you can swap what is inside.",
        ],
        "concept-2": [
          "A decision tree made of branches: each 'if/else' is a fork that sends the program down a new path.",
        ],
        "concept-3": [
          "A function is a recipe: it takes ingredients, follows steps, and returns a finished dish.",
        ],
      };

      const exercise: Record<string, { questions: RemedialQuestion[] }> = {
        "concept-1": {
          questions: [
            {
              question: "Which snippet correctly assigns the number 5 to a variable named count?",
              options: ["var count = 5", "count := 5", "count = 5", "int count = 5"],
              correct: 2,
              explanation: "Python uses the = operator to assign values directly.",
            },
          ],
        },
        "concept-2": {
          questions: [
            {
              question: "When should an 'else' block run?",
              options: [
                "Always",
                "Only if the preceding 'if' condition was false",
                "Never",
                "Only after a 'for' loop",
              ],
              correct: 1,
              explanation: "'else' runs when the previous 'if' evaluates to false.",
            },
          ],
        },
        "concept-3": {
          questions: [
            {
              question: "What does 'return' do inside a function?",
              options: [
                "Prints text to the console",
                "Ends the function and optionally gives back a value",
                "Repeats the function",
                "Declares a global variable",
              ],
              correct: 1,
              explanation: "'return' stops execution and passes a value back to the caller.",
            },
          ],
        },
      };

      return {
        concept_id: conceptId,
        concept_name:
          {
            "concept-1": "Variables and Data Types",
            "concept-2": "Control Flow",
            "concept-3": "Functions",
          }[conceptId] || conceptId,
        explanation: explanations[conceptId] || "Review this concept and try the practice exercise below.",
        exercise: exercise[conceptId] || { questions: [] },
        analogies: analogies[conceptId] || [],
        generated: true,
      };
    } catch (error) {
      console.error("Failed to get remediation content:", error);
      return {
        concept_id: conceptId,
        concept_name: conceptId,
        explanation: "",
        exercise: { questions: [] },
        analogies: [],
        generated: false,
      };
    }
  },
};
