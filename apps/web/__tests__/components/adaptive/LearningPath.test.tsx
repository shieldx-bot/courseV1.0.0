import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LearningPath } from "@/components/adaptive/LearningPath";

jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: jest.fn() }),
}));

function jsonResponse(data: unknown, ok = true, status = 200): Response {
  return {
    ok,
    status,
    json: () => Promise.resolve({ success: true, data }),
    text: () => Promise.resolve("error"),
  } as unknown as Response;
}

const sequence = [
  { lesson_id: "l1", title: "Intro", order: 1, status: "normal", weak_concepts: [], strong_concepts: [] },
  { lesson_id: "l2", title: "Loops", order: 2, status: "remedial", weak_concepts: ["Control Flow"], strong_concepts: [] },
  { lesson_id: "l3", title: "Recursion", order: 3, status: "ready-to-skip", weak_concepts: [], strong_concepts: ["Functions"] },
];

const course = {
  id: "course-1",
  title: "Python",
  syllabus: [
    { id: "l1", title: "Intro" },
    { id: "l2", title: "Loops" },
    { id: "l3", title: "Recursion" },
    { id: "l4", title: "OOP" },
  ],
};

describe("LearningPath", () => {
  let fetchMock: jest.Mock;
  let sequenceCount: number;

  beforeEach(() => {
    sequenceCount = 0;
    fetchMock = jest.fn((url: string, init?: RequestInit) => {
      if (String(url).includes("/recommended-sequence")) {
        sequenceCount += 1;
        return Promise.resolve(jsonResponse({ course_id: "course-1", sequence }));
      }
      if (String(url).includes("/courses/")) {
        return Promise.resolve(jsonResponse(course));
      }
      if ((init?.method || "GET") === "POST" && String(url).includes("/skip/")) {
        return Promise.resolve(jsonResponse({ skipped: true, lesson_id: "l3" }));
      }
      return Promise.resolve(jsonResponse([]));
    });
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("renders status badges for each sequence item", async () => {
    render(<LearningPath courseId="course-1" />);

    const items = await screen.findByTestId("learning-path-items");
    expect(within(items).getByText("Intro")).toBeInTheDocument();
    expect(within(items).getByText("Loops")).toBeInTheDocument();
    expect(within(items).getByText("Recursion")).toBeInTheDocument();
    expect(within(items).getByText("Up next")).toBeInTheDocument();
    expect(within(items).getByText("Practice first")).toBeInTheDocument();
    expect(within(items).getByText("Ready to skip")).toBeInTheDocument();
  });

  it("shows the 'Show all lessons' toggle only when a lesson is ready-to-skip and reveals the full syllabus", async () => {
    const user = userEvent.setup();
    render(<LearningPath courseId="course-1" />);

    const toggle = await screen.findByTestId("toggle-show-all");
    expect(toggle).toHaveTextContent("Show all lessons");

    // Default view follows the recommended sequence — lesson l4 (OOP) is not shown.
    expect(screen.queryByText("OOP")).not.toBeInTheDocument();

    await user.click(toggle);
    expect(toggle).toHaveTextContent("Show recommended");
    expect(screen.getByText("OOP")).toBeInTheDocument();
    expect(screen.getByText("Intro")).toBeInTheDocument();
  });

  it("refreshes the sequence after a successful skip when no updated_sequence is returned", async () => {
    const user = userEvent.setup();
    render(<LearningPath courseId="course-1" />);

    await screen.findByTestId("learning-path-items");
    expect(sequenceCount).toBe(1);

    await user.click(screen.getByTestId("skip-l3"));

    // Skip succeeded without updated_sequence → the component refetches.
    expect(await screen.findByTestId("learning-path-items")).toBeInTheDocument();
    expect(sequenceCount).toBe(2);
    const skipCall = fetchMock.mock.calls.find(
      ([url, init]) => (init?.method || "GET") === "POST" && String(url).includes("/skip/")
    );
    expect(skipCall).toBeDefined();
    expect(String((skipCall as [string])[0])).toContain("/adaptive/skip/course-1/l3");
  });

  it("uses the backend-provided updated_sequence after skip when present", async () => {
    fetchMock.mockImplementation((url: string, init?: RequestInit) => {
      if (String(url).includes("/recommended-sequence")) {
        return Promise.resolve(jsonResponse({ course_id: "course-1", sequence }));
      }
      if (String(url).includes("/courses/")) {
        return Promise.resolve(jsonResponse(course));
      }
      if ((init?.method || "GET") === "POST" && String(url).includes("/skip/")) {
        return Promise.resolve(
          jsonResponse({
            skipped: true,
            lesson_id: "l3",
            updated_sequence: [
              { lesson_id: "l3", title: "Recursion", order: 3, status: "normal", weak_concepts: [], strong_concepts: [] },
            ],
          })
        );
      }
      return Promise.resolve(jsonResponse([]));
    });
    const user = userEvent.setup();
    render(<LearningPath courseId="course-1" />);

    await screen.findByTestId("learning-path-items");
    const callsBefore = sequenceCount;

    await user.click(screen.getByTestId("skip-l3"));

    // Badge flips from "Ready to skip" to "Up next" using the server sequence.
    expect(await screen.findByText("Up next")).toBeInTheDocument();
    expect(screen.queryByText("Ready to skip")).not.toBeInTheDocument();
    expect(sequenceCount).toBe(callsBefore);
  });
});
