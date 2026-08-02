import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RemedialPanel } from "@/components/adaptive/RemedialPanel";

function jsonResponse(data: unknown, ok = true, status = 200): Response {
  return {
    ok,
    status,
    json: () => Promise.resolve({ success: true, data }),
    text: () => Promise.resolve("error"),
  } as unknown as Response;
}

const remedialContent = {
  concept_id: "c1",
  concept_name: "Variables",
  explanation: "Variables store values in memory using the = operator.",
  exercise: {
    questions: [
      {
        question: "Which snippet assigns 5 to a variable named count?",
        options: ["var count = 5", "count = 5"],
        correct: 1,
        explanation: "Python uses the = operator for assignment.",
      },
    ],
  },
  analogies: ["A variable is like a labeled box."],
  generated: true,
};

describe("RemedialPanel", () => {
  let fetchMock: jest.Mock;

  beforeEach(() => {
    fetchMock = jest.fn((url: string) => {
      if (String(url).includes("/content/c1")) return Promise.resolve(jsonResponse(remedialContent));
      return Promise.resolve(jsonResponse([]));
    });
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("renders the explanation, analogies and micro-exercise from the API", async () => {
    render(<RemedialPanel courseId="course-1" conceptId="c1" conceptName="Variables" />);

    expect(await screen.findByText(/Variables store values in memory/i)).toBeInTheDocument();
    expect(screen.getByText(/like a labeled box/)).toBeInTheDocument();
    expect(screen.getByText(/Which snippet assigns 5 to a variable named count/)).toBeInTheDocument();

    const fetchCall = fetchMock.mock.calls[0];
    expect(String(fetchCall[0])).toContain("/adaptive/remediation/course-1/content/c1");
  });

  it("submits the micro-exercise locally and shows the explanation", async () => {
    const user = userEvent.setup();
    render(<RemedialPanel courseId="course-1" conceptId="c1" conceptName="Variables" />);

    await screen.findByText(/Variables store values in memory/i);
    await user.click(screen.getByRole("button", { name: "count = 5" }));
    await user.click(screen.getByRole("button", { name: "Submit exercise" }));

    expect(screen.getByText(/Python uses the = operator for assignment/i)).toBeInTheDocument();
  });

  it("shows the skip-anyway button when onClose is provided and calls it", async () => {
    const onClose = jest.fn();
    const user = userEvent.setup();
    render(<RemedialPanel courseId="course-1" conceptId="c1" conceptName="Variables" onClose={onClose} />);

    await screen.findByText(/Variables store values in memory/i);
    await user.click(screen.getByRole("button", { name: "I got it, skip anyway" }));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("does not crash when the API fails and shows a safe fallback", async () => {
    fetchMock.mockImplementation(() =>
      Promise.resolve({ ok: false, status: 500, text: () => Promise.resolve("boom") } as unknown as Response)
    );

    render(<RemedialPanel courseId="course-1" conceptId="c1" conceptName="Variables" />);

    expect(await screen.findByText(/Could not load remediation/i)).toBeInTheDocument();
  });

  it("submits the micro-exercise to the Phase 6 endpoint and shows mastery before/after", async () => {
    fetchMock.mockImplementation((url: string, init?: RequestInit) => {
      if (String(url).includes("/content/c1")) return Promise.resolve(jsonResponse(remedialContent));
      if ((init?.method || "GET") === "POST" && String(url).includes("/exercise/c1/submit")) {
        return Promise.resolve(
          jsonResponse({ correct_count: 1, total: 1, mastery_before: 4.0, mastery_after: 5.2 })
        );
      }
      return Promise.resolve(jsonResponse([]));
    });
    const user = userEvent.setup();
    render(<RemedialPanel courseId="course-1" conceptId="c1" conceptName="Variables" />);

    await screen.findByText(/Variables store values in memory/i);
    await user.click(screen.getByRole("button", { name: "count = 5" }));
    await user.click(screen.getByRole("button", { name: "Submit exercise" }));

    expect(await screen.findByTestId("exercise-mastery-result")).toHaveTextContent("Mastery: 4.0 → 5.2");

    const submitCall = fetchMock.mock.calls.find(
      ([url, init]) =>
        (init?.method || "GET") === "POST" && String(url).includes("/exercise/c1/submit")
    );
    expect(submitCall).toBeDefined();
    const body = JSON.parse((submitCall as [string, RequestInit])[1].body as string);
    expect(body).toEqual({ answers: { 0: 1 } });
  });

  it("falls back to local grading when the exercise endpoint is not deployed", async () => {
    const user = userEvent.setup();
    render(<RemedialPanel courseId="course-1" conceptId="c1" conceptName="Variables" />);

    await screen.findByText(/Variables store values in memory/i);
    await user.click(screen.getByRole("button", { name: "count = 5" }));
    await user.click(screen.getByRole("button", { name: "Submit exercise" }));

    expect(await screen.findByText(/Exercise submitted/i)).toBeInTheDocument();
    expect(screen.queryByTestId("exercise-mastery-result")).not.toBeInTheDocument();
  });

  it("sends helpful feedback to the Phase 6 endpoint and thanks the user", async () => {
    fetchMock.mockImplementation((url: string, init?: RequestInit) => {
      if (String(url).includes("/content/c1")) return Promise.resolve(jsonResponse(remedialContent));
      if ((init?.method || "GET") === "POST" && String(url).includes("/feedback/c1")) {
        return Promise.resolve(jsonResponse({ recorded: true }));
      }
      return Promise.resolve(jsonResponse([]));
    });
    const user = userEvent.setup();
    render(<RemedialPanel courseId="course-1" conceptId="c1" conceptName="Variables" />);

    await screen.findByText(/Variables store values in memory/i);
    await user.click(screen.getByRole("button", { name: "Helpful" }));

    expect(await screen.findByTestId("feedback-thanks")).toHaveTextContent(/Thanks/i);

    const feedbackCall = fetchMock.mock.calls.find(
      ([url, init]) =>
        (init?.method || "GET") === "POST" && String(url).includes("/feedback/c1")
    );
    expect(feedbackCall).toBeDefined();
    const body = JSON.parse((feedbackCall as [string, RequestInit])[1].body as string);
    expect(body).toEqual({ helpful: true });
  });

  it("does not crash when the feedback endpoint is not deployed", async () => {
    const user = userEvent.setup();
    render(<RemedialPanel courseId="course-1" conceptId="c1" conceptName="Variables" />);

    await screen.findByText(/Variables store values in memory/i);
    await user.click(screen.getByRole("button", { name: "Not helpful" }));

    expect(await screen.findByText(/Could not record feedback/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Helpful" })).toBeInTheDocument();
  });
});
