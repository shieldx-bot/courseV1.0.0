import { render, screen } from "@testing-library/react";
import LeaderboardView from "@/components/arena/leaderboard-view";
import type { ArenaLeaderboardData, ArenaPlayer } from "@/types/community";

jest.mock("next/link", () => {
  return ({ children, href }: { children: React.ReactNode; href: string }) => <a href={href}>{children}</a>;
});

function jsonResponse(data: unknown): Response {
  return { ok: true, status: 200, json: () => Promise.resolve({ success: true, data }) } as unknown as Response;
}

const players: ArenaPlayer[] = [
  { user_id: "p1", user_name: "CloudMaster", country: "VN", rating: 2840, rank: "Diamond", provisional: false, matches: 120, wins: 85, losses: 35, season_points: 300, peak_rating: 2900, updated_at: null },
  { user_id: "p2", user_name: "KubeNinja", rating: 2710, rank: "Diamond", provisional: false, matches: 110, wins: 78, losses: 32, season_points: 280, peak_rating: 2750, updated_at: null },
  { user_id: "p3", user_name: "SecOpsGuru", rating: 2650, rank: "Platinum", provisional: true, matches: 15, wins: 11, losses: 4, season_points: 60, peak_rating: 2650, updated_at: null },
  { user_id: "p4", user_name: "LinuxWizard", rating: 2500, rank: "Gold", provisional: false, matches: 90, wins: 60, losses: 30, season_points: 200, peak_rating: 2600, updated_at: null },
];

const board: ArenaLeaderboardData = { scope: "global", period: "all", players, my_rank: 2 };

const live = {
  battles: [
    {
      id: "b1",
      mode: "1v1",
      topic: "Kubernetes troubleshooting",
      status: "live" as const,
      participants: [{ user_id: "p1", user_name: "CloudMaster" }],
      created_at: "2026-08-02T00:00:00Z",
    },
  ],
};

const stats = { battles_today: 42, players_total: 1200, matches_total: 8000, live_battles: 3 };

describe("LeaderboardView", () => {
  let fetchMock: jest.Mock;

  beforeEach(() => {
    fetchMock = jest.fn((url: string) => {
      const u = String(url);
      if (u.includes("/arena/leaderboard")) return Promise.resolve(jsonResponse(board));
      if (u.includes("/arena/live")) return Promise.resolve(jsonResponse(live));
      if (u.includes("/arena/stats")) return Promise.resolve(jsonResponse(stats));
      return Promise.resolve({ ok: false, status: 404, text: () => Promise.resolve("not found") } as unknown as Response);
    });
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("renders the leaderboard, podium, live battles, and arena stats with mock data", async () => {
    render(<LeaderboardView />);

    expect(await screen.findByText("Prove yourself. Climb the ladder.")).toBeInTheDocument();
    expect(await screen.findByText("42")).toBeInTheDocument();
    expect(screen.getByText("You're #2")).toBeInTheDocument();
    expect(screen.getAllByText("CloudMaster").length).toBeGreaterThan(0);
    expect(screen.getAllByText("SecOpsGuru").length).toBeGreaterThan(0);
    expect(screen.getByText("Kubernetes troubleshooting")).toBeInTheDocument();
    expect(screen.getAllByText(/KubeNinja/).length).toBeGreaterThan(0);
  });

  it("renders the empty state when the leaderboard has no players", async () => {
    fetchMock.mockImplementation((url: string) => {
      const u = String(url);
      if (u.includes("/arena/leaderboard")) return Promise.resolve(jsonResponse({ scope: "global", period: "all", players: [], my_rank: null }));
      if (u.includes("/arena/live")) return Promise.resolve(jsonResponse({ battles: [] }));
      if (u.includes("/arena/stats")) return Promise.resolve(jsonResponse({ battles_today: 0, players_total: 0, matches_total: 0, live_battles: 0 }));
      return Promise.resolve({ ok: false, status: 404, text: () => Promise.resolve("not found") } as unknown as Response);
    });
    render(<LeaderboardView />);

    expect(await screen.findByText("No competitive players yet.")).toBeInTheDocument();
    expect(screen.getByText(/Sign in to track your rank/)).toBeInTheDocument();
  });

  it("renders the error state with a retry action when the arena API fails", async () => {
    fetchMock.mockRejectedValue(new Error("arena down"));
    render(<LeaderboardView />);

    expect(await screen.findByText("arena down")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();
  });
});
