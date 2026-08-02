import { render, screen } from "@testing-library/react";
import EventsPage from "@/components/ecosystem/events-view";
import { ToastProvider } from "@/components/ui/toast";

jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: jest.fn() }),
}));

jest.mock("next/link", () => {
  return ({ children, href }: { children: React.ReactNode; href: string }) => <a href={href}>{children}</a>;
});

function jsonResponse(data: unknown): Response {
  return { ok: true, status: 200, json: () => Promise.resolve({ success: true, data }) } as unknown as Response;
}

const events = [
  {
    id: "e1",
    title: "Weekly Cloud Challenge",
    description: "Hands-on Kubernetes practice",
    event_type: "weekly_challenge",
    emoji: "⚡",
    host_id: "h1",
    host_name: "sarahdev",
    mode: "online",
    location: "",
    start_time: "2026-08-10T09:00:00Z",
    end_time: null,
    recurring: true,
    interval_days: 7,
    challenge_id: null,
    capacity: 100,
    attendee_count: 23,
    is_featured: true,
    status: "published",
    created_at: "2026-08-01T00:00:00Z",
  },
];

function renderPage() {
  return render(
    <ToastProvider>
      <EventsPage />
    </ToastProvider>
  );
}

describe("EventsPage", () => {
  let fetchMock: jest.Mock;

  beforeEach(() => {
    fetchMock = jest.fn((url: string) => {
      if (String(url).includes("/ecosystem/events")) return Promise.resolve(jsonResponse({ events }));
      return Promise.resolve({ ok: false, status: 404, text: () => Promise.resolve("not found") } as unknown as Response);
    });
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("renders the event list from the ecosystem contract without crashing", async () => {
    renderPage();

    expect(await screen.findByText("Events, live & together.")).toBeInTheDocument();
    expect(await screen.findByText(/Weekly Cloud Challenge/)).toBeInTheDocument();
    expect(screen.getAllByText(/Weekly Challenge/).length).toBeGreaterThan(0);
    expect(screen.getByText("Hosted by sarahdev")).toBeInTheDocument();
    expect(screen.getByText("23 attending / 100")).toBeInTheDocument();
    expect(screen.getByText(/every 7d/)).toBeInTheDocument();
  });

  it("renders the empty state when there are no events", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ events: [] }));
    renderPage();

    expect(await screen.findByText("No upcoming events")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Host the first event" })).toBeInTheDocument();
  });

  it("shows an error toast and the safe empty fallback when the events API fails", async () => {
    fetchMock.mockRejectedValue(new Error("events down"));
    renderPage();

    expect(await screen.findByText("events down")).toBeInTheDocument();
    expect(screen.getByText("No upcoming events")).toBeInTheDocument();
  });
});
