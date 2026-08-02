import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AdaptiveQuiz } from "@/components/adaptive/AdaptiveQuiz";

function jsonResponse(data: unknown, ok = true, status = 200): Response {
  return {
    ok,
    status,
    json: () => Promise.resolve({ success: true, data }),
    text: () => Promise.resolve("error"),
  } as unknown as Response;
}

const questions = [
  {
    concept_id: "c1",
    concept_name: "Variables",
    difficulty: 1,
    question: "What is 2 + 2?",
    options: ["1", "2", "4", "8"],
    correct: 2,
    explanation: "Basic arithmetic.",
  },
  {
    concept_id: "c2",
    concept_name: "Control Flow",
    difficulty: 2,
    question: "Which keyword starts a conditional block?",
    options: ["if", "when", "for", "switch"],
    correct: 0,
    explanation: "Python uses 'if'.",
  },
];

const quizResult = {
  quiz_id: "q1",
  score: 1,
  total_questions: 2,
  score_pct: 50,
  passed: false,
  results: [
    {
      question_index: 0,
      concept_id: "c1",
      correct: true,
      selected_answer: 2,
      correct_answer: 2,
      explanation: "Basic arithmetic.",
      mastery_delta: 1,
    },
    {
      question_index: 1,
      concept_id: "c2",
      correct: false,
      selected_answer: 0,
      correct_answer: 1,
      explanation: "Python uses 'if'.",
      mastery_delta: -0.5,
    },
  ],
  concept_results: [
    { concept_id: "c1", concept_name: "Variables", mastery_before: 5, mastery_after: 6, mastery_delta: 1, correct: true },
    { concept_id: "c2", concept_name: "Control Flow", mastery_before: 4, mastery_after: 3.5, mastery_delta: -0.5, correct: false },
  ],
  weak_concepts: [{ concept_id: "c2", concept_name: "Control Flow", mastery_after: 3.5 }],
};

const passedResult: typeof quizResult = {
  ...quizResult,
  score: 2,
  total_questions: 2,
  score_pct: 100,
  passed: true,
  weak_concepts: [],
  concept_results: [
    { concept_id: "c1", concept_name: "Variables", mastery_before: 5, mastery_after: 7, mastery_delta: 2, correct: true },
    { concept_id: "c2", concept_name: "Control Flow", mastery_before: 4, mastery_after: 8, mastery_delta: 4, correct: true },
  ],
};

describe("AdaptiveQuiz", () => {
  let fetchMock: jest.Mock;

  beforeEach(() => {
    fetchMock = jest.fn((url: string, init?: RequestInit) => {
      const method = init?.method || "GET";
      if (method === "POST" && url.includes("/submit")) return Promise.resolve(jsonResponse(quizResult));
      if (url.includes("/generate")) return Promise.resolve(jsonResponse({ quiz_id: "q1", questions }));
      if (url.includes("/mastery/")) return Promise.resolve(jsonResponse([]));
      return Promise.resolve({ ok: false, status: 404, text: () => Promise.resolve("not found") } as unknown as Response);
    });
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("loads the quiz on demand and renders the questions", async () => {
    const user = userEvent.setup();
    render(<AdaptiveQuiz courseId="course-1" lessonId="lesson-1" userId="user-1" />);

    await user.click(screen.getByRole("button", { name: "Start adaptive quiz" }));

    expect(await screen.findByText("What is 2 + 2?")).toBeInTheDocument();
    expect(screen.getByText("Which keyword starts a conditional block?")).toBeInTheDocument();
    expect(screen.getByText(/Question 1 \/ 2/)).toBeInTheDocument();
  });

  it("renders concept progress chips and highlights the active concept", async () => {
    fetchMock.mockImplementation((url: string, init?: RequestInit) => {
      const method = init?.method || "GET";
      if (method === "POST" && url.includes("/submit")) return Promise.resolve(jsonResponse(quizResult));
      if (url.includes("/generate")) return Promise.resolve(jsonResponse({ quiz_id: "q1", questions }));
      if (url.includes("/mastery/")) {
        return Promise.resolve(
          jsonResponse([
            { concept_id: "c1", name: "Variables", mastery_score: 6.5, trend: "improving" },
            { concept_id: "c2", name: "Control Flow", mastery_score: 4, trend: "declining" },
          ])
        );
      }
      return Promise.resolve({ ok: false, status: 404, text: () => Promise.resolve("not found") } as unknown as Response);
    });
    const user = userEvent.setup();
    render(<AdaptiveQuiz courseId="course-1" lessonId="lesson-1" userId="user-1" />);

    await user.click(screen.getByRole("button", { name: "Start adaptive quiz" }));
    await screen.findByText("What is 2 + 2?");

    const chips = await screen.findByTestId("concept-progress");
    expect(within(chips).getByText("Variables")).toBeInTheDocument();
    expect(within(chips).getByText("Control Flow")).toBeInTheDocument();
    expect(within(chips).getByText("6.5")).toBeInTheDocument();
    expect(within(chips).getByText("4.0")).toBeInTheDocument();

    const variablesChip = within(chips).getByText("Variables").closest("button") as HTMLElement;
    expect(variablesChip.className).toContain("border-accent-500");

    await user.click(within(chips).getByText("Control Flow"));
    const controlFlowChip = within(chips).getByText("Control Flow").closest("button") as HTMLElement;
    expect(controlFlowChip.className).toContain("border-accent-500");
    expect(variablesChip.className).not.toContain("border-accent-500");
  });

  it("submits the selected answers and shows the result breakdown", async () => {
    const user = userEvent.setup();
    render(<AdaptiveQuiz courseId="course-1" lessonId="lesson-1" userId="user-1" />);

    await user.click(screen.getByRole("button", { name: "Start adaptive quiz" }));
    await screen.findByText("What is 2 + 2?");

    await user.click(screen.getByRole("button", { name: "4" }));
    await user.click(screen.getByRole("button", { name: "if" }));
    await user.click(screen.getByRole("button", { name: "Submit answers" }));

    expect(await screen.findByText("Quiz Complete")).toBeInTheDocument();
    expect(screen.getByText("Score: 1 / 2 (50%)")).toBeInTheDocument();
    expect(screen.getByText("Not passed yet")).toBeInTheDocument();
    expect(screen.getByText("Variables")).toBeInTheDocument();
    expect(screen.getByText("Control Flow")).toBeInTheDocument();
    expect(screen.getByText("Correct")).toBeInTheDocument();
    expect(screen.getByText("Incorrect")).toBeInTheDocument();
    expect(screen.getByText("Mastery: 4.0 → 3.5 (-0.50)")).toBeInTheDocument();

    const submitCall = fetchMock.mock.calls.find(
      ([url, init]) => (init?.method || "GET") === "POST" && String(url).includes("/submit")
    );
    expect(submitCall).toBeDefined();
    const body = JSON.parse((submitCall as [string, RequestInit])[1].body as string);
    expect(body.quiz_id).toBe("q1");
    expect(body.answers).toEqual({ 0: 2, 1: 0 });
    // Every question sent back keeps its original fields AND carries a measured
    // time_seconds so the backend Elo time_factor can run (Phase 6 CO1).
    expect(body.questions).toHaveLength(questions.length);
    body.questions.forEach((q: Record<string, unknown>, i: number) => {
      expect(q.concept_id).toBe(questions[i].concept_id);
      expect(q.question).toBe(questions[i].question);
      expect(q.options).toEqual(questions[i].options);
      expect(typeof q.time_seconds).toBe("number");
      expect((q.time_seconds as number)).toBeGreaterThanOrEqual(0);
    });
  });

  it("animates the mastery score count-up in the breakdown", async () => {
    const rafSpy = jest
      .spyOn(window, "requestAnimationFrame")
      .mockImplementation((cb: FrameRequestCallback) => {
        cb(performance.now() + 10000);
        return 1;
      });
    const cafSpy = jest.spyOn(window, "cancelAnimationFrame").mockImplementation(() => {});
    const user = userEvent.setup();
    render(<AdaptiveQuiz courseId="course-1" lessonId="lesson-1" userId="user-1" />);

    await user.click(screen.getByRole("button", { name: "Start adaptive quiz" }));
    await screen.findByText("What is 2 + 2?");
    await user.click(screen.getByRole("button", { name: "4" }));
    await user.click(screen.getByRole("button", { name: "if" }));
    await user.click(screen.getByRole("button", { name: "Submit answers" }));

    expect(await screen.findByTestId("mastery-count-c2")).toHaveTextContent("3.5");
    expect(screen.getByTestId("mastery-count-c1")).toHaveTextContent("6.0");

    rafSpy.mockRestore();
    cafSpy.mockRestore();
  });

  it("shows skip to harder content when passed with no weak concepts and calls the real skip endpoint", async () => {
    fetchMock.mockImplementation((url: string, init?: RequestInit) => {
      const method = init?.method || "GET";
      if (method === "POST" && url.includes("/submit")) return Promise.resolve(jsonResponse(passedResult));
      if (method === "POST" && url.includes("/skip/")) {
        return Promise.resolve(jsonResponse({ skipped: true, lesson_id: "lesson-1" }));
      }
      if (url.includes("/generate")) return Promise.resolve(jsonResponse({ quiz_id: "q1", questions }));
      if (url.includes("/mastery/")) return Promise.resolve(jsonResponse([]));
      return Promise.resolve({ ok: false, status: 404, text: () => Promise.resolve("not found") } as unknown as Response);
    });
    const user = userEvent.setup();
    render(<AdaptiveQuiz courseId="course-1" lessonId="lesson-1" userId="user-1" />);

    await user.click(screen.getByRole("button", { name: "Start adaptive quiz" }));
    await screen.findByText("What is 2 + 2?");
    await user.click(screen.getByRole("button", { name: "4" }));
    await user.click(screen.getByRole("button", { name: "if" }));
    await user.click(screen.getByRole("button", { name: "Submit answers" }));

    const skipButton = await screen.findByRole("button", { name: "Skip to harder content" });
    await user.click(skipButton);

    expect(await screen.findByText(/marked as ready to skip/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Continue to mastery dashboard" })).toBeInTheDocument();

    const skipCall = fetchMock.mock.calls.find(
      ([url, init]) => (init?.method || "GET") === "POST" && String(url).includes("/skip/")
    );
    expect(skipCall).toBeDefined();
    expect(String((skipCall as [string])[0])).toContain("/adaptive/skip/course-1/lesson-1");
  });

  it("hides the skip button when weak concepts remain even if passed", async () => {
    const user = userEvent.setup();
    render(<AdaptiveQuiz courseId="course-1" lessonId="lesson-1" userId="user-1" />);

    await user.click(screen.getByRole("button", { name: "Start adaptive quiz" }));
    await screen.findByText("What is 2 + 2?");
    await user.click(screen.getByRole("button", { name: "4" }));
    await user.click(screen.getByRole("button", { name: "if" }));
    await user.click(screen.getByRole("button", { name: "Submit answers" }));

    await screen.findByText("Quiz Complete");
    expect(screen.queryByRole("button", { name: "Skip to harder content" })).not.toBeInTheDocument();
  });

  it("renders the remedial panel after submit when weak concepts remain", async () => {
    const user = userEvent.setup();
    render(<AdaptiveQuiz courseId="course-1" lessonId="lesson-1" userId="user-1" />);

    await user.click(screen.getByRole("button", { name: "Start adaptive quiz" }));
    await screen.findByText("What is 2 + 2?");
    await user.click(screen.getByRole("button", { name: "4" }));
    await user.click(screen.getByRole("button", { name: "if" }));
    await user.click(screen.getByRole("button", { name: "Submit answers" }));

    await screen.findByText("Quiz Complete");
    // Remedial panel is rendered for the weakest concept (c2) — the fetch mock
    // does not serve remediation content, so it shows the safe fallback text.
    expect(await screen.findByText(/Could not load remediation/i)).toBeInTheDocument();
  });

  it("renders a mastery check start button in mastery-check mode and fails gracefully when the course quiz is unsupported", async () => {
    fetchMock.mockImplementation((url: string) => {
      if (String(url).includes("/mastery/")) return Promise.resolve(jsonResponse([]));
      return Promise.resolve({ ok: false, status: 422, text: () => Promise.resolve("lesson_id required") } as unknown as Response);
    });
    const user = userEvent.setup();
    render(<AdaptiveQuiz courseId="course-1" mode="mastery-check" />);

    expect(screen.getByRole("button", { name: "Start mastery check" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Start mastery check" }));

    expect(
      await screen.findByText("Mastery check is not available yet. Try the lesson quiz instead.")
    ).toBeInTheDocument();
    expect(screen.queryByText(/failed to load/i)).not.toBeInTheDocument();
  });

  it("surfaces the API error when the quiz cannot be generated", async () => {
    fetchMock.mockImplementation((url: string, init?: RequestInit) => {
      if ((init?.method || "GET") === "POST" && url.includes("/submit")) return Promise.resolve(jsonResponse(quizResult));
      return Promise.resolve({ ok: false, status: 500, text: () => Promise.resolve("boom") } as unknown as Response);
    });
    const user = userEvent.setup();
    render(<AdaptiveQuiz courseId="course-1" lessonId="lesson-1" userId="user-1" />);

    await user.click(screen.getByRole("button", { name: "Start adaptive quiz" }));

    expect(await screen.findByText("boom")).toBeInTheDocument();
  });
});
