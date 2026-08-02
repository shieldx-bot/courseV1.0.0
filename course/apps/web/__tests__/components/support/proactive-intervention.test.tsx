import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ProactiveIntervention } from "@/components/support/ProactiveIntervention";
import { PROACTIVE_DISMISS_KEY, PROACTIVE_DISMISS_TTL_MS } from "@/lib/support-api";

const pathnameMock = jest.fn(() => "/dashboard");

jest.mock("next/navigation", () => ({
  usePathname: () => pathnameMock(),
}));

jest.mock("next/link", () => {
  return ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  );
});

function jsonResponse(data: unknown): Response {
  return { ok: true, status: 200, json: () => Promise.resolve({ success: true, data }) } as unknown as Response;
}

describe("ProactiveIntervention", () => {
  let fetchMock: jest.Mock;

  beforeEach(() => {
    window.localStorage.clear();
    pathnameMock.mockReturnValue("/dashboard");
    fetchMock = jest.fn();
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("renders the correct message and CTA per intervention type", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse([
        { type: "learning_stall", message: "", created_at: new Date().toISOString() },
        { type: "quiz_low_score", message: "", created_at: new Date().toISOString() },
      ])
    );

    render(<ProactiveIntervention />);

    // learning_stall is relevant on /dashboard → shown.
    expect(await screen.findByText(/Your course is waiting/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Continue learning/ })).toHaveAttribute("href", "/dashboard");

    // quiz_low_score is only relevant on /learn → hidden on /dashboard.
    expect(screen.queryByText(/Review these lessons/)).not.toBeInTheDocument();
  });

  it("uses the backend message when provided", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse([{ type: "learning_stall", message: "Custom backend message", created_at: new Date().toISOString() }])
    );

    render(<ProactiveIntervention />);
    expect(await screen.findByText("Custom backend message")).toBeInTheDocument();
  });

  it("shows checkout_drop only on pricing/checkout pages", async () => {
    pathnameMock.mockReturnValue("/dashboard");
    fetchMock.mockResolvedValue(
      jsonResponse([{ type: "checkout_drop", message: "", created_at: new Date().toISOString() }])
    );

    const { unmount } = render(<ProactiveIntervention />);
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(screen.queryByText(/Having trouble with payment/)).not.toBeInTheDocument();
    unmount();

    pathnameMock.mockReturnValue("/pricing");
    fetchMock.mockResolvedValue(
      jsonResponse([{ type: "checkout_drop", message: "", created_at: new Date().toISOString() }])
    );
    render(<ProactiveIntervention />);
    expect(await screen.findByText(/Having trouble with payment/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Continue checkout/ })).toHaveAttribute("href", "/pricing");
  });

  it("dismisses an intervention and remembers it in localStorage", async () => {
    const user = userEvent.setup();
    fetchMock.mockResolvedValue(
      jsonResponse([{ type: "learning_stall", message: "", created_at: new Date().toISOString() }])
    );

    render(<ProactiveIntervention />);
    const dismiss = await screen.findByRole("button", { name: /Dismiss learning_stall/ });
    await user.click(dismiss);

    await waitFor(() => {
      expect(screen.queryByText(/Your course is waiting/)).not.toBeInTheDocument();
    });
    const stored = JSON.parse(window.localStorage.getItem(PROACTIVE_DISMISS_KEY) || "{}");
    expect(typeof stored.learning_stall).toBe("number");
    expect(Date.now() - stored.learning_stall).toBeLessThan(PROACTIVE_DISMISS_TTL_MS);
  });

  it("does not re-show a dismissed intervention on remount", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse([{ type: "learning_stall", message: "", created_at: new Date().toISOString() }])
    );

    const { unmount } = render(<ProactiveIntervention />);
    expect(await screen.findByText(/Your course is waiting/)).toBeInTheDocument();
    unmount();

    // Simulate dismissal persisted during the previous session.
    window.localStorage.setItem(PROACTIVE_DISMISS_KEY, JSON.stringify({ learning_stall: Date.now() }));

    render(<ProactiveIntervention />);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(screen.queryByText(/Your course is waiting/)).not.toBeInTheDocument();
  });

  it("renders nothing when the API returns an empty list", async () => {
    fetchMock.mockResolvedValue(jsonResponse([]));

    const { container } = render(<ProactiveIntervention />);
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(container.innerHTML).toBe("");
  });

  it("renders nothing when the API is unavailable", async () => {
    fetchMock.mockRejectedValue(new Error("network down"));

    const { container } = render(<ProactiveIntervention />);
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(container.innerHTML).toBe("");
  });
});
