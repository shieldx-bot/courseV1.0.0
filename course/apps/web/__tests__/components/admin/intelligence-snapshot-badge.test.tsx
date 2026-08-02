import { render, screen, waitFor } from "@testing-library/react";
import IntelligenceSnapshotBadge, { formatSnapshotTime } from "@/components/admin/intelligence-snapshot-badge";

function jsonResponse(data: unknown): Response {
  return { ok: true, status: 200, json: () => Promise.resolve({ success: true, data }) } as unknown as Response;
}

describe("IntelligenceSnapshotBadge", () => {
  let fetchMock: jest.Mock;

  beforeEach(() => {
    fetchMock = jest.fn();
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("renders the snapshot time when the overview response confirms a snapshot", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({
        source: "snapshot",
        snapshot_generated_at: "2026-08-02T01:30:00.000Z",
        health: {},
        generated_at: "2026-08-02T01:30:00.000Z",
      })
    );

    render(<IntelligenceSnapshotBadge />);

    expect(await screen.findByTestId("intelligence-snapshot-badge")).toBeInTheDocument();
    expect(screen.getByText(/Snapshot: /)).toBeInTheDocument();
  });

  it("renders nothing when the overview is still computed live (no snapshot source)", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ generated_at: "2026-08-02T01:30:00.000Z", health: {} })
    );

    const { container } = render(<IntelligenceSnapshotBadge />);
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());

    expect(screen.queryByTestId("intelligence-snapshot-badge")).not.toBeInTheDocument();
    expect(container.innerHTML).toBe("");
  });

  it("renders nothing when the intelligence API fails", async () => {
    fetchMock.mockRejectedValue(new Error("intelligence down"));

    const { container } = render(<IntelligenceSnapshotBadge />);
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());

    expect(screen.queryByTestId("intelligence-snapshot-badge")).not.toBeInTheDocument();
    expect(container.innerHTML).toBe("");
  });

  it("formats a valid ISO timestamp into a readable label", () => {
    const label = formatSnapshotTime("2026-08-02T01:30:00.000Z");
    expect(label).toMatch(/^[A-Z][a-z]{2} \d/);
    expect(label.length).toBeGreaterThan(0);
  });

  it("returns an empty string for an invalid timestamp", () => {
    expect(formatSnapshotTime("not-a-date")).toBe("");
  });
});
