import { render, screen } from "@testing-library/react";
import CreatorStudio from "@/components/ecosystem/creator-studio";
import { ToastProvider } from "@/components/ui/toast";
import type { CreatorAnalytics } from "@/types/ecosystem";
import type { CreatorProfile } from "@/types/community";

jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: jest.fn() }),
}));

jest.mock("next/link", () => {
  return ({ children, href }: { children: React.ReactNode; href: string }) => <a href={href}>{children}</a>;
});

function jsonResponse(data: unknown): Response {
  return { ok: true, status: 200, json: () => Promise.resolve({ success: true, data }) } as unknown as Response;
}

const analytics: CreatorAnalytics = {
  days: 30,
  profile: {
    level: "trusted",
    level_score: 42,
    trust_score: 78,
    verification: "verified",
    followers: 120,
    badges: ["first_publish", "quality_10"],
    achievements: ["m_first_publication"],
  },
  totals: {
    published_challenges: 5,
    total_challenges: 8,
    total_attempts_received: 320,
    avg_completion_rate: 0.65,
    avg_rating: 4.2,
  },
  window: {
    attempts: 40,
    correct: 30,
    completion_rate: 0.75,
    new_followers: 6,
    ratings_received: 8,
    avg_rating_window: 4.5,
  },
  per_challenge: [
    {
      challenge_id: "ch1",
      title: "Docker Basics",
      difficulty: "easy",
      attempts: 120,
      completion_rate: 0.7,
      avg_rating: 4.3,
      bookmarks: 15,
      created_at: "2026-01-01T00:00:00Z",
    },
  ],
};

const creator: CreatorProfile = {
  user_id: "u1",
  user_name: "jennycodes",
  display_name: "Jenny Codes",
  level: "trusted",
  level_score: 42,
  total_challenges: 8,
  published_challenges: 5,
  total_attempts_received: 320,
  avg_completion_rate: 0.65,
  avg_rating: 4.2,
  followers_count: 120,
  badges: ["first_publish", "quality_10"],
};

const leaderboard = {
  creators: [
    {
      rank: 1,
      user_id: "u9",
      user_name: "sarahdev",
      avatar_url: null,
      level: "expert",
      level_score: 200,
      published_challenges: 12,
      total_attempts_received: 900,
      followers: 400,
      trust_score: 92,
      verified: true,
      badges: ["quality_10"],
    },
  ],
};

function renderStudio() {
  return render(
    <ToastProvider>
      <CreatorStudio />
    </ToastProvider>
  );
}

describe("CreatorStudio", () => {
  let fetchMock: jest.Mock;

  beforeEach(() => {
    fetchMock = jest.fn((url: string) => {
      const u = String(url);
      if (u.includes("/ecosystem/creators/me/analytics")) return Promise.resolve(jsonResponse(analytics));
      if (u.includes("/creators/me")) return Promise.resolve(jsonResponse(creator));
      if (u.includes("/ecosystem/creators/leaderboard")) return Promise.resolve(jsonResponse(leaderboard));
      return Promise.resolve({ ok: false, status: 404, text: () => Promise.resolve("not found") } as unknown as Response);
    });
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("renders creator analytics, badges, leaderboard, and challenge rows with mock data", async () => {
    renderStudio();

    expect(await screen.findByText("Creator Studio")).toBeInTheDocument();
    expect(screen.getByText("Jenny Codes")).toBeInTheDocument();
    expect(screen.getByText(/Trusted Creator/)).toBeInTheDocument();
    expect(screen.getByText("Verified Creator")).toBeInTheDocument();
    expect(screen.getByText("78/100")).toBeInTheDocument();
    expect(screen.getByText("4.2")).toBeInTheDocument();
    expect(screen.getByText("Docker Basics")).toBeInTheDocument();
    expect(screen.getByText("first publish")).toBeInTheDocument();
    expect(screen.getByText("sarahdev")).toBeInTheDocument();
    expect(screen.getByText(/200 pts · 12 ch · 400 followers/)).toBeInTheDocument();
  });

  it("surfaces an error toast and renders a safe shell when the APIs fail", async () => {
    fetchMock.mockRejectedValue(new Error("network down"));
    renderStudio();

    expect(await screen.findByText("network down")).toBeInTheDocument();
    expect(screen.getByText("Creator Studio")).toBeInTheDocument();
    expect(screen.getByText("Get verified")).toBeInTheDocument();
    expect(screen.getByText(/No published challenges yet/)).toBeInTheDocument();
  });
});
