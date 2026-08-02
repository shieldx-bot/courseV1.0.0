import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import AdminAdaptivePage from "@/app/admin/adaptive/page";

function jsonResponse(data: unknown, ok = true, status = 200): Response {
  return {
    ok,
    status,
    json: () => Promise.resolve({ success: true, data }),
    text: () => Promise.resolve("error"),
  } as unknown as Response;
}

const courses = [
  {
    id: "course-1",
    title: "Intro to Python",
    syllabus: [
      { id: "lesson-1", title: "Variables" },
      { id: "lesson-2", title: "Control Flow" },
    ],
  },
  { id: "course-2", title: "Advanced Web Dev", syllabus: [] },
];

const concepts = [
  {
    id: "c1",
    course_id: "course-1",
    name: "Variables and Data Types",
    slug: "variables-data-types",
    description: "Basic variables",
    difficulty_base: 1,
    tags: ["basics"],
    lesson_ids: ["lesson-1"],
    prerequisite_concepts: [],
  },
  {
    id: "c2",
    course_id: "course-1",
    name: "Control Flow",
    slug: "control-flow",
    description: "Loops and conditionals",
    difficulty_base: 2,
    tags: ["basics", "python"],
    lesson_ids: ["lesson-2"],
    prerequisite_concepts: ["c1"],
  },
];

const stats = {
  course_id: "course-1",
  total_concepts: 3,
  avg_difficulty: 2,
  concepts: [
    { id: "c1", name: "Variables and Data Types", difficulty_base: 1, avg_mastery: 8.5, student_count: 120, tags: ["basics"] },
    { id: "c2", name: "Control Flow", difficulty_base: 2, avg_mastery: 7.2, student_count: 115, tags: ["basics"] },
    { id: "c3", name: "Functions", difficulty_base: 3, avg_mastery: 5.8, student_count: 98, tags: ["intermediate"] },
  ],
};

describe("AdminAdaptivePage", () => {
  let fetchMock: jest.Mock;

  beforeEach(() => {
    fetchMock = jest.fn((url: string, init?: RequestInit) => {
      const method = init?.method || "GET";
      if (url.includes("/admin/courses")) return Promise.resolve(jsonResponse(courses));
      if (url.includes("/admin/adaptive/stats")) return Promise.resolve(jsonResponse(stats));
      if (url.includes("/admin/adaptive/concepts") && method === "GET") return Promise.resolve(jsonResponse(concepts));
      if (url.includes("/admin/adaptive/concepts") && method === "POST") {
        return Promise.resolve(jsonResponse({ id: "conc-new", ...JSON.parse((init as RequestInit).body as string) }));
      }
      if (url.includes("/admin/adaptive/concepts") && method === "DELETE") return Promise.resolve(jsonResponse({ deleted: true }));
      return Promise.resolve(jsonResponse([]));
    });
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("lists concepts for the selected course with a header row and stats", async () => {
    render(<AdminAdaptivePage />);

    const table = await screen.findByRole("table", { name: "Course concepts" });
    expect(table.querySelector("thead")).not.toBeNull();
    expect(within(table).getByText("Variables and Data Types")).toBeInTheDocument();
    expect(within(table).getByText("Control Flow")).toBeInTheDocument();

    expect(await screen.findByText("Total concepts")).toBeInTheDocument();
    expect(screen.getByText("3", { selector: ".text-2xl" })).toBeInTheDocument();
    expect(screen.getByText("2.0")).toBeInTheDocument();
    expect(screen.getByText("7.17")).toBeInTheDocument();

    const courseSelect = screen.getByLabelText("Course");
    expect(within(courseSelect as HTMLSelectElement).getByText("Intro to Python")).toBeInTheDocument();
    expect(within(courseSelect as HTMLSelectElement).getByText("Advanced Web Dev")).toBeInTheDocument();
  });

  it("creates a concept via the form and POSTs to the admin endpoint", async () => {
    const user = userEvent.setup();
    render(<AdminAdaptivePage />);

    await screen.findByRole("table", { name: "Course concepts" });

    await user.type(screen.getByLabelText("Concept name"), "New Concept");
    await user.type(screen.getByLabelText("Description"), "A brand new concept");
    await user.type(screen.getByLabelText("Tags (comma-separated)"), "basics, python");
    await user.click(screen.getByRole("button", { name: "Create concept" }));

    await screen.findByText("Concept created");

    const postCall = fetchMock.mock.calls.find(([url, init]) => init?.method === "POST" && url.includes("/admin/adaptive/concepts"));
    expect(postCall).toBeDefined();
    const body = JSON.parse((postCall as [string, RequestInit])[1].body as string);
    expect(body).toMatchObject({
      course_id: "course-1",
      name: "New Concept",
      description: "A brand new concept",
      difficulty_base: 5,
      tags: ["basics", "python"],
    });
  });

  it("deletes a concept after confirmation", async () => {
    const confirmSpy = jest.spyOn(window, "confirm").mockReturnValue(true);
    const user = userEvent.setup();
    render(<AdminAdaptivePage />);

    await screen.findByRole("table", { name: "Course concepts" });
    await user.click(screen.getByRole("button", { name: "Delete Control Flow" }));

    await screen.findByText("Concept deleted");
    const deleteCall = fetchMock.mock.calls.find(([url, init]) => init?.method === "DELETE");
    expect(deleteCall).toBeDefined();
    expect((deleteCall as [string])[0]).toContain("/admin/adaptive/concepts/c2");
    confirmSpy.mockRestore();
  });

  it("shows an informative empty state when no concepts exist", async () => {
    fetchMock.mockImplementation((url: string, init?: RequestInit) => {
      const method = init?.method || "GET";
      if (url.includes("/admin/courses")) return Promise.resolve(jsonResponse(courses));
      if (url.includes("/admin/adaptive/stats")) return Promise.resolve(jsonResponse({ ...stats, total_concepts: 0 }));
      if (url.includes("/admin/adaptive/concepts")) return Promise.resolve(jsonResponse([]));
      return Promise.resolve(jsonResponse([]));
    });

    render(<AdminAdaptivePage />);

    // Wait for a stable intermediate state (the course selector only renders
    // after /admin/courses resolves) before waiting for the empty state. This
    // narrows the wait window so CPU starvation under the parallel suite cannot
    // blow a single long timeout on both fetches.
    await screen.findByLabelText("Course", {}, { timeout: 10000 });
    expect(await screen.findByText("No concepts yet")).toBeInTheDocument();
  });

  it("does not crash when the admin adaptive endpoints are unavailable", async () => {
    fetchMock.mockImplementation((url: string, init?: RequestInit) => {
      if (url.includes("/admin/courses")) return Promise.resolve(jsonResponse(courses));
      if (url.includes("/admin/adaptive")) {
        return Promise.resolve({ ok: false, status: 404, text: () => Promise.resolve("not found") } as unknown as Response);
      }
      return Promise.resolve(jsonResponse([]));
    });

    render(<AdminAdaptivePage />);

    expect(await screen.findByText(/Could not load concepts/)).toBeInTheDocument();
    expect(screen.getByText("Adaptive Learning")).toBeInTheDocument();
  });

  it("renders a mastery heatmap with color-coded cells, tooltips and a legend", async () => {
    const heatStats = {
      course_id: "course-1",
      total_concepts: 3,
      avg_difficulty: 2,
      concepts: [
        { id: "c1", name: "Variables", difficulty_base: 1, avg_mastery: 2.5, student_count: 40, tags: ["basics"] },
        { id: "c2", name: "Control Flow", difficulty_base: 2, avg_mastery: 4.5, student_count: 35, tags: ["basics"] },
        { id: "c3", name: "Functions", difficulty_base: 3, avg_mastery: 8.2, student_count: 30, tags: ["intermediate"] },
      ],
    };
    fetchMock.mockImplementation((url: string) => {
      if (url.includes("/admin/courses")) return Promise.resolve(jsonResponse(courses));
      if (url.includes("/admin/adaptive/stats")) return Promise.resolve(jsonResponse(heatStats));
      if (url.includes("/admin/adaptive/gaps")) return Promise.resolve(jsonResponse([]));
      if (url.includes("/admin/adaptive/concepts")) return Promise.resolve(jsonResponse(concepts));
      return Promise.resolve(jsonResponse([]));
    });

    render(<AdminAdaptivePage />);

    const heatTable = await screen.findByRole("table", { name: "Concept mastery heatmap" });
    expect(heatTable.querySelector("thead")).not.toBeNull();

    const redCell = await screen.findByTestId("heat-cell-c1");
    const amberCell = screen.getByTestId("heat-cell-c2");
    const greenCell = screen.getByTestId("heat-cell-c3");
    expect(redCell.className).toContain("bg-red-100");
    expect(amberCell.className).toContain("bg-amber-100");
    expect(greenCell.className).toContain("bg-emerald-100");
    expect(redCell.getAttribute("title")).toContain("40 students, avg 2.5");

    expect(screen.getByLabelText("Heatmap legend")).toBeInTheDocument();
  });

  it("renders prerequisite gaps with a Needs badge", async () => {
    fetchMock.mockImplementation((url: string) => {
      if (url.includes("/admin/courses")) return Promise.resolve(jsonResponse(courses));
      if (url.includes("/admin/adaptive/stats")) return Promise.resolve(jsonResponse(stats));
      if (url.includes("/admin/adaptive/gaps")) {
        return Promise.resolve(
          jsonResponse([
            {
              concept_id: "c3",
              concept_name: "Functions",
              weak_prerequisites: ["c1", "c2"],
              suggestion: "Review Variables first.",
            },
          ])
        );
      }
      if (url.includes("/admin/adaptive/concepts")) return Promise.resolve(jsonResponse(concepts));
      return Promise.resolve(jsonResponse([]));
    });

    render(<AdminAdaptivePage />);

    expect(await screen.findByText("Prerequisite gaps")).toBeInTheDocument();
    expect(screen.getByText("Needs: c1, c2")).toBeInTheDocument();
    expect(screen.getByText("Review Variables first.")).toBeInTheDocument();
  });
});
