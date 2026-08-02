import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SupportDashboard } from "@/components/admin/SupportDashboard";

function jsonResponse(data: unknown, ok = true, status = 200): Response {
  return {
    ok,
    status,
    json: () => Promise.resolve({ success: true, data }),
    text: () => Promise.resolve("error"),
  } as unknown as Response;
}

const ticket = {
  id: "t1",
  subject: "Cannot log in",
  user_email: "a@b.com",
  user_name: "Alice",
  status: "open",
  category: "technical",
  priority: "P1",
  created_at: "2026-08-01T10:00:00Z",
};

const stats = {
  total: 12,
  avg_resolution_hours: 5.5,
  avg_satisfaction_rating: 4.2,
};

const article = { id: "a1", title: "How to reset password", summary: "Reset steps", category: "account", views: 3, helpful_count: 2, tags: [] };

describe("SupportDashboard", () => {
  let fetchMock: jest.Mock;

  beforeEach(() => {
    fetchMock = jest.fn();
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("renders the three tabs and ticket stats", async () => {
    fetchMock.mockImplementation((url: string) => {
      if (url.includes("/admin/support/stats")) return Promise.resolve(jsonResponse(stats));
      if (url.includes("/admin/support/tickets")) return Promise.resolve(jsonResponse([ticket]));
      return Promise.resolve(jsonResponse([]));
    });

    render(<SupportDashboard />);

    expect(screen.getByRole("tab", { name: "Tickets" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Knowledge Base" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Proactive" })).toBeInTheDocument();

    expect(await screen.findByText("Cannot log in")).toBeInTheDocument();
    expect(await screen.findByText("12")).toBeInTheDocument();
  });

  it("renders tickets in a table with a header row", async () => {
    fetchMock.mockImplementation((url: string) => {
      if (url.includes("/admin/support/stats")) return Promise.resolve(jsonResponse(stats));
      if (url.includes("/admin/support/tickets")) return Promise.resolve(jsonResponse([ticket]));
      return Promise.resolve(jsonResponse([]));
    });

    render(<SupportDashboard />);

    const table = await screen.findByRole("table", { name: "Support tickets" });
    expect(table.querySelector("thead")).not.toBeNull();
    expect(screen.getByRole("columnheader", { name: "Subject" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Status" })).toBeInTheDocument();
  });

  it("loads and filters knowledge base articles", async () => {
    const user = userEvent.setup();
    fetchMock.mockImplementation((url: string) => {
      if (url.includes("/admin/help/articles")) return Promise.resolve(jsonResponse([article]));
      return Promise.resolve(jsonResponse([]));
    });

    render(<SupportDashboard />);
    await user.click(screen.getByRole("tab", { name: "Knowledge Base" }));

    expect(await screen.findByText("How to reset password")).toBeInTheDocument();

    await user.type(screen.getByRole("textbox", { name: "Search articles" }), "billing");
    await waitFor(() => {
      expect(screen.getByText(/No articles match your search/)).toBeInTheDocument();
    });

    await user.clear(screen.getByRole("textbox", { name: "Search articles" }));
    await user.type(screen.getByRole("textbox", { name: "Search articles" }), "reset");
    expect(screen.getByText("How to reset password")).toBeInTheDocument();
  });

  it("shows an informative empty state on the Proactive tab when the API is missing", async () => {
    const user = userEvent.setup();
    fetchMock.mockImplementation((url: string) => {
      if (url.includes("/admin/proactive/interventions/all")) {
        return Promise.resolve({ ok: false, status: 404, text: () => Promise.resolve("not found") } as unknown as Response);
      }
      return Promise.resolve(jsonResponse([]));
    });

    render(<SupportDashboard />);
    await user.click(screen.getByRole("tab", { name: "Proactive" }));

    expect(await screen.findByText(/No interventions recorded yet/)).toBeInTheDocument();
  });

  it("lists interventions with a type badge on the Proactive tab", async () => {
    const user = userEvent.setup();
    fetchMock.mockImplementation((url: string) => {
      if (url.includes("/admin/proactive/interventions/all")) {
        return Promise.resolve(
          jsonResponse([{ id: "i1", type: "learning_stall", message: "Stalled", user_id: "u1", created_at: "2026-08-01T10:00:00Z" }])
        );
      }
      return Promise.resolve(jsonResponse([]));
    });

    render(<SupportDashboard />);
    await user.click(screen.getByRole("tab", { name: "Proactive" }));

    expect(await screen.findByText("learning_stall")).toBeInTheDocument();
    expect(screen.getByText("Stalled")).toBeInTheDocument();
  });
});
