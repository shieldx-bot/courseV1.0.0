/**
 * @jest-environment node
 */

import { adaptiveClient } from "@/lib/adaptive-client";

function envelopeResponse(data: unknown, ok = true, status = 200): Response {
  return {
    ok,
    status,
    json: () => Promise.resolve({ success: true, data }),
    text: () => Promise.resolve("error"),
  } as unknown as Response;
}

function errorResponse(status = 500, message = "boom"): Response {
  return {
    ok: false,
    status,
    json: () => Promise.resolve({ success: false, data: null, error: message, meta: null }),
    text: () => Promise.resolve(message),
  } as unknown as Response;
}

describe("adaptiveClient", () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  it("listConcepts unwraps the success envelope and returns concepts", async () => {
    const concept = {
      id: "c1",
      course_id: "course-1",
      name: "Variables",
      slug: "variables",
      description: "x",
      difficulty_base: 1,
      tags: ["basics"],
      lesson_ids: ["lesson-1"],
      prerequisite_concepts: [],
      mastery_score: 6.5,
    };
    global.fetch = jest.fn().mockResolvedValue(envelopeResponse([concept]));

    const result = await adaptiveClient.listConcepts("course-1");
    expect(result).toEqual([concept]);
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it("listConcepts falls back to mock data (0-10 scale) when the API request fails", async () => {
    global.fetch = jest.fn().mockResolvedValue(errorResponse(404));

    const result = await adaptiveClient.listConcepts("course-1");
    expect(result.length).toBeGreaterThan(0);
    expect(result[0]).toMatchObject({ course_id: "course-1", name: "Variables and Data Types" });
    expect(result[0].mastery_score).toBe(7.5);
  });

  it("getCourseMastery unwraps the mastery envelope into summaries", async () => {
    global.fetch = jest.fn().mockResolvedValue(
      envelopeResponse([
        { concept_id: "c1", name: "Variables", mastery_score: 6.5, trend: "improving", attempts: 4 },
        { concept_id: "c2", name: "Control Flow", mastery_score: 2, trend: "declining", attempts: 1 },
      ])
    );

    const result = await adaptiveClient.getCourseMastery("course-1");
    expect(result).toEqual([
      { id: "c1", name: "Variables", mastery_score: 6.5, trend: "improving" },
      { id: "c2", name: "Control Flow", mastery_score: 2, trend: "declining" },
    ]);
  });

  it("getWeak resolves concept names from the concept list", async () => {
    global.fetch = jest.fn((url: RequestInfo | URL) => {
      if (String(url).includes("/weak/")) {
        return Promise.resolve(envelopeResponse([{ concept_id: "c1", mastery_score: 2, trend: "declining" }]));
      }
      if (String(url).includes("/concepts/")) {
        return Promise.resolve(envelopeResponse([{ id: "c1", name: "Variables" }]));
      }
      return Promise.resolve(envelopeResponse([]));
    });

    const result = await adaptiveClient.getWeak("course-1");
    expect(result).toEqual([{ id: "c1", name: "Variables", mastery_score: 2, trend: "declining" }]);
  });

  it("getStrong resolves concept names from the concept list", async () => {
    global.fetch = jest.fn((url: RequestInfo | URL) => {
      if (String(url).includes("/strong/")) {
        return Promise.resolve(envelopeResponse([{ concept_id: "c2", mastery_score: 8, trend: "improving" }]));
      }
      if (String(url).includes("/concepts/")) {
        return Promise.resolve(envelopeResponse([{ id: "c2", name: "Functions" }]));
      }
      return Promise.resolve(envelopeResponse([]));
    });

    const result = await adaptiveClient.getStrong("course-1");
    expect(result).toEqual([{ id: "c2", name: "Functions", mastery_score: 8, trend: "improving" }]);
  });

  it("getRemediation returns suggestions sorted weakest first", async () => {
    global.fetch = jest.fn().mockResolvedValue(
      envelopeResponse([
        { concept_id: "c2", concept_name: "Loops", mastery_score: 5, trend: "stable", lesson_ids: [], prerequisite_concepts: [], suggestion: "s2" },
        { concept_id: "c1", concept_name: "Variables", mastery_score: 1.5, trend: "declining", lesson_ids: [], prerequisite_concepts: [], suggestion: "s1" },
      ])
    );

    const result = await adaptiveClient.getRemediation("course-1");
    expect(result.map((r) => r.concept_id)).toEqual(["c1", "c2"]);
  });

  it("getRemediation returns an empty list when the API fails", async () => {
    global.fetch = jest.fn().mockResolvedValue(errorResponse(500));
    await expect(adaptiveClient.getRemediation("course-1")).resolves.toEqual([]);
  });

  it("getRecommendedSequence unwraps the recommended-sequence envelope", async () => {
    const sequence = [
      { lesson_id: "lesson-1", title: "Intro", order: 1, status: "normal", weak_concepts: [], strong_concepts: [] },
    ];
    global.fetch = jest.fn().mockResolvedValue(envelopeResponse({ course_id: "course-1", sequence }));

    const result = await adaptiveClient.getRecommendedSequence("course-1");
    expect(result).toEqual({ sequence });
  });

  it("getRecommendedSequence falls back to an empty sequence on failure", async () => {
    global.fetch = jest.fn().mockResolvedValue(errorResponse(500));
    await expect(adaptiveClient.getRecommendedSequence("course-1")).resolves.toEqual({ sequence: [] });
  });

  it("skipLesson posts to the skip endpoint and returns the payload", async () => {
    const fetchMock = jest.fn().mockResolvedValue(envelopeResponse({ skipped: true, lesson_id: "lesson-1" }));
    global.fetch = fetchMock as unknown as typeof fetch;

    const result = await adaptiveClient.skipLesson("course-1", "lesson-1");
    expect(result).toEqual({ skipped: true, lesson_id: "lesson-1" });
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toContain("/adaptive/skip/course-1/lesson-1");
    expect(init?.method).toBe("POST");
  });

  it("skipLesson rejects when the API responds with an error", async () => {
    global.fetch = jest.fn().mockResolvedValue(errorResponse(400, "Cannot skip: some concepts are not yet mastered"));
    await expect(adaptiveClient.skipLesson("course-1", "lesson-1")).rejects.toThrow("Cannot skip: some concepts are not yet mastered");
  });

  it("skipLesson surfaces the backend updated_sequence when present", async () => {
    const fetchMock = jest.fn().mockResolvedValue(
      envelopeResponse({
        skipped: true,
        lesson_id: "lesson-1",
        updated_sequence: [
          { lesson_id: "lesson-1", title: "Intro", order: 1, status: "normal", weak_concepts: [], strong_concepts: [] },
        ],
      })
    );
    global.fetch = fetchMock as unknown as typeof fetch;

    const result = await adaptiveClient.skipLesson("course-1", "lesson-1");
    expect(result.skipped).toBe(true);
    expect(result.updated_sequence).toHaveLength(1);
    expect(result.updated_sequence![0].lesson_id).toBe("lesson-1");
  });

  it("submitQuiz posts answers and unwraps the quiz result", async () => {
    const result = {
      quiz_id: "q1",
      score: 2,
      total_questions: 2,
      score_pct: 100,
      passed: true,
      results: [],
      concept_results: [],
      weak_concepts: [],
    };
    const fetchMock = jest.fn().mockResolvedValue(envelopeResponse(result));
    global.fetch = fetchMock as unknown as typeof fetch;

    const output = await adaptiveClient.submitQuiz("course-1", "q1", { 0: 2 }, []);
    expect(output).toEqual(result);
    const [, init] = fetchMock.mock.calls[0];
    const body = JSON.parse((init as RequestInit).body as string);
    expect(body).toEqual({ quiz_id: "q1", answers: { 0: 2 }, questions: [] });
  });

  it("remediationContent unwraps the envelope into a RemedialContent shape", async () => {
    global.fetch = jest.fn().mockResolvedValue(
      envelopeResponse({
        concept_id: "concept-1",
        concept_name: "Variables and Data Types",
        explanation: "Variables store values in memory.",
        exercise: {
          questions: [{ question: "Q?", options: ["a", "b"], correct: 0, explanation: "e" }],
        },
        analogies: ["A variable is like a labeled box."],
        generated: true,
      })
    );

    const content = await adaptiveClient.remediationContent("course-1", "concept-1");
    expect(content).toMatchObject({
      concept_id: "concept-1",
      concept_name: "Variables and Data Types",
      generated: true,
    });
    expect(Array.isArray(content.analogies)).toBe(true);
    expect(Array.isArray(content.exercise.questions)).toBe(true);
  });

  it("remediationContent falls back safely when the API fails", async () => {
    global.fetch = jest.fn().mockResolvedValue(errorResponse(500));

    const content = await adaptiveClient.remediationContent("course-1", "concept-1");
    expect(content).toMatchObject({
      concept_id: "concept-1",
      generated: false,
    });
    expect(content.explanation).toContain("Could not load remediation");
    expect(content.exercise.questions).toEqual([]);
  });

  it("submitRemedialExercise posts answers and unwraps the mastery result", async () => {
    const result = { correct_count: 1, total: 2, mastery_before: 3.0, mastery_after: 4.2 };
    const fetchMock = jest.fn().mockResolvedValue(envelopeResponse(result));
    global.fetch = fetchMock as unknown as typeof fetch;

    const output = await adaptiveClient.submitRemedialExercise("course-1", "c1", { 0: 1 });
    expect(output).toEqual(result);
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toContain("/adaptive/remediation/course-1/exercise/c1/submit");
    expect(init?.method).toBe("POST");
    const body = JSON.parse((init as RequestInit).body as string);
    expect(body).toEqual({ answers: { 0: 1 } });
  });

  it("submitRemedialExercise returns null when the endpoint is not deployed", async () => {
    global.fetch = jest.fn().mockResolvedValue(errorResponse(404));
    await expect(adaptiveClient.submitRemedialExercise("course-1", "c1", { 0: 1 })).resolves.toBeNull();
  });

  it("submitRemedialExercise returns null for an unexpected response shape", async () => {
    global.fetch = jest.fn().mockResolvedValue(envelopeResponse({ ok: true }));
    await expect(adaptiveClient.submitRemedialExercise("course-1", "c1", { 0: 1 })).resolves.toBeNull();
  });

  it("sendRemedialFeedback posts helpful and returns true", async () => {
    const fetchMock = jest.fn().mockResolvedValue(envelopeResponse({ recorded: true }));
    global.fetch = fetchMock as unknown as typeof fetch;

    await expect(adaptiveClient.sendRemedialFeedback("course-1", "c1", true)).resolves.toBe(true);
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toContain("/adaptive/remediation/course-1/feedback/c1");
    expect(init?.method).toBe("POST");
    const body = JSON.parse((init as RequestInit).body as string);
    expect(body).toEqual({ helpful: true });
  });

  it("sendRemedialFeedback returns false when the endpoint is not deployed", async () => {
    global.fetch = jest.fn().mockResolvedValue(errorResponse(404));
    await expect(adaptiveClient.sendRemedialFeedback("course-1", "c1", false)).resolves.toBe(false);
  });

  it("getPrerequisites returns an empty list when the API fails", async () => {
    global.fetch = jest.fn().mockResolvedValue(errorResponse(404));
    await expect(adaptiveClient.getPrerequisites("course-1", "c1")).resolves.toEqual([]);
  });

  it("adminStats returns the expected stats shape", async () => {
    const stats = await adaptiveClient.adminStats("course-1");
    expect(stats).toMatchObject({
      course_id: "course-1",
      total_concepts: 3,
    });
    expect(typeof stats.avg_difficulty).toBe("number");
    expect(stats.concepts).toHaveLength(3);
  });
});
