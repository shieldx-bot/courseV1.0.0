import { render, screen } from "@testing-library/react";
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

describe("AdaptiveQuiz", () => {
  let fetchMock: jest.Mock;

  beforeEach(() => {
    fetchMock = jest.fn((url: string, init?: RequestInit) => {
      const method = init?.method || "GET";
      if (method === "POST" && url.includes("/submit")) return Promise.resolve(jsonResponse(quizResult));
      if (url.includes("/generate")) return Promise.resolve(jsonResponse({ quiz_id: "q1", questions }));
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

    const submitCall = fetchMock.mock.calls.find(([, init]) => init?.method === "POST");
    expect(submitCall).toBeDefined();
    const body = JSON.parse((submitCall as [string, RequestInit])[1].body as string);
    expect(body.quiz_id).toBe("q1");
    expect(body.answers).toEqual({ 0: 2, 1: 0 });
    expect(body.questions).toEqual(questions);
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
