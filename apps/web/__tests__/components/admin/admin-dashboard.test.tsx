import { render, screen } from "@testing-library/react";
import AdminDashboard from "@/app/admin/page";

function jsonResponse(data: unknown): Response {
  return { ok: true, status: 200, json: () => Promise.resolve({ success: true, data }) } as unknown as Response;
}

const dashboard = {
  total_members: 1200,
  active_subscriptions: 340,
  total_courses: 25,
  total_lessons: 210,
  total_revenue: 48000,
  recent_revenue: 3200,
  timestamp: "2026-08-02T00:00:00Z",
};

const snapshotOverview = {
  source: "snapshot",
  snapshot_generated_at: "2026-08-02T01:30:00.000Z",
  generated_at: "2026-08-02T01:30:00.000Z",
  health: {},
};

describe("AdminDashboard", () => {
  let fetchMock: jest.Mock;

  beforeEach(() => {
    fetchMock = jest.fn((url: string) => {
      if (String(url).includes("/admin/dashboard")) return Promise.resolve(jsonResponse(dashboard));
      if (String(url).includes("/admin/intelligence/overview")) return Promise.resolve(jsonResponse(snapshotOverview));
      return Promise.resolve({ ok: false, status: 404, text: () => Promise.resolve("not found") } as unknown as Response);
    });
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("renders KPI cards and the intelligence snapshot badge when a snapshot exists", async () => {
    render(<AdminDashboard />);

    expect(await screen.findByText("Admin dashboard")).toBeInTheDocument();
    expect(screen.getByText("Total members")).toBeInTheDocument();
    expect(screen.getByText("1,200")).toBeInTheDocument();
    expect(await screen.findByTestId("intelligence-snapshot-badge")).toBeInTheDocument();
    expect(screen.getByText(/Snapshot: /)).toBeInTheDocument();
  });

  it("still renders the dashboard when the intelligence snapshot endpoint is unavailable", async () => {
    fetchMock.mockImplementation((url: string) => {
      if (String(url).includes("/admin/dashboard")) return Promise.resolve(jsonResponse(dashboard));
      return Promise.resolve({ ok: false, status: 401, text: () => Promise.resolve("unauthorized") } as unknown as Response);
    });

    render(<AdminDashboard />);

    expect(await screen.findByText("Total members")).toBeInTheDocument();
    expect(screen.queryByTestId("intelligence-snapshot-badge")).not.toBeInTheDocument();
  });
});
