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
    global.fetch = jest.fn().mockResolvedValue(envelopeResponse({ concepts: [concept] }));

    const result = await adaptiveClient.listConcepts("course-1");
    expect(result).toEqual([concept]);
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it("listConcepts falls back to mock data when the API request fails", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 404,
      text: () => Promise.resolve("not found"),
    } as unknown as Response);

    const result = await adaptiveClient.listConcepts("course-1");
    expect(result.length).toBeGreaterThan(0);
    expect(result[0]).toMatchObject({ course_id: "course-1", name: "Variables and Data Types" });
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

  it("remediationContent returns a RemedialContent shape", async () => {
    const content = await adaptiveClient.remediationContent("course-1", "concept-1");
    expect(content).toMatchObject({
      concept_id: "concept-1",
      concept_name: expect.any(String),
      generated: true,
    });
    expect(Array.isArray(content.analogies)).toBe(true);
    expect(Array.isArray(content.exercise.questions)).toBe(true);
  });
});
