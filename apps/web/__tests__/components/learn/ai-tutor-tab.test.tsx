import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AiTutorTab } from "@/components/learn/AiTutorTab";
import { ToastProvider } from "@/components/ui/toast";

// Stable reference (module-level) so the history-load effect deps
// `[courseId, lessonId, user]` don't change on every render — a fresh object
// per useAuth() call would re-trigger the effect and reset messages forever.
const mockUser = { id: "u1", email: "student@example.com", role: "user" };

jest.mock("@/lib/auth-context", () => ({
  useAuth: () => ({
    user: mockUser,
    loading: false,
    login: jest.fn(),
    logout: jest.fn(),
    updateUser: jest.fn(),
  }),
}));

function jsonResponse(data: unknown, ok = true, status = 200): Response {
  return {
    ok,
    status,
    json: () => Promise.resolve({ success: true, data }),
    text: () => Promise.resolve(ok ? "" : String(data)),
  } as unknown as Response;
}

function renderTab() {
  return render(
    <ToastProvider>
      <AiTutorTab courseId="course-1" lessonId="lesson-1" />
    </ToastProvider>
  );
}

async function askQuestion(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByRole("textbox"), "Explain list comprehensions");
  await user.click(screen.getByTitle("Send (Enter)"));
}

describe("AiTutorTab focus hint", () => {
  let fetchMock: jest.Mock;

  beforeEach(() => {
    fetchMock = jest.fn((url: string) => {
      if (url.includes("/ai-tutor/history")) return Promise.resolve(jsonResponse({ messages: [] }));
      return Promise.resolve(jsonResponse({ answer: "Done" }));
    });
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("renders the Focus hint when the tutor response carries focus_concepts", async () => {
    fetchMock.mockImplementation((url: string, init?: RequestInit) => {
      if (url.includes("/ai-tutor/history")) return Promise.resolve(jsonResponse({ messages: [] }));
      if ((init?.method || "GET") === "POST" && url.includes("/ai-tutor/ask")) {
        return Promise.resolve(jsonResponse({ answer: "Done", focus_concepts: ["List Comprehensions"] }));
      }
      return Promise.resolve(jsonResponse({ answer: "Done" }));
    });

    const user = userEvent.setup();
    renderTab();
    await askQuestion(user);

    const hint = await screen.findByTestId("tutor-focus-hint");
    expect(hint).toHaveTextContent("Focus:");
    expect(hint).toHaveTextContent("List Comprehensions");
  });

  it("renders multiple focus concepts joined by comma", async () => {
    fetchMock.mockImplementation((url: string, init?: RequestInit) => {
      if (url.includes("/ai-tutor/history")) return Promise.resolve(jsonResponse({ messages: [] }));
      if ((init?.method || "GET") === "POST" && url.includes("/ai-tutor/ask")) {
        return Promise.resolve(
          jsonResponse({ answer: "Done", focus_concepts: ["List Comprehensions", "Slicing"] })
        );
      }
      return Promise.resolve(jsonResponse({ answer: "Done" }));
    });

    const user = userEvent.setup();
    renderTab();
    await askQuestion(user);

    const hint = await screen.findByTestId("tutor-focus-hint");
    expect(hint).toHaveTextContent("List Comprehensions, Slicing");
  });

  it("does not render the Focus hint when the response has no focus field (guard)", async () => {
    fetchMock.mockImplementation((url: string, init?: RequestInit) => {
      if (url.includes("/ai-tutor/history")) return Promise.resolve(jsonResponse({ messages: [] }));
      if ((init?.method || "GET") === "POST" && url.includes("/ai-tutor/ask")) {
        return Promise.resolve(jsonResponse({ answer: "Done" }));
      }
      return Promise.resolve(jsonResponse({ answer: "Done" }));
    });

    const user = userEvent.setup();
    renderTab();
    await askQuestion(user);

    expect(await screen.findByText("Done")).toBeInTheDocument();
    expect(screen.queryByTestId("tutor-focus-hint")).not.toBeInTheDocument();
  });

  it("falls back to weak_concepts when focus_concepts is absent (Phase 6 guard)", async () => {
    fetchMock.mockImplementation((url: string, init?: RequestInit) => {
      if (url.includes("/ai-tutor/history")) return Promise.resolve(jsonResponse({ messages: [] }));
      if ((init?.method || "GET") === "POST" && url.includes("/ai-tutor/ask")) {
        return Promise.resolve(jsonResponse({ answer: "Done", weak_concepts: ["List Comprehensions"] }));
      }
      return Promise.resolve(jsonResponse({ answer: "Done" }));
    });

    const user = userEvent.setup();
    renderTab();
    await askQuestion(user);

    const hint = await screen.findByTestId("tutor-focus-hint");
    expect(hint).toHaveTextContent("Focus:");
    expect(hint).toHaveTextContent("List Comprehensions");
  });
});
