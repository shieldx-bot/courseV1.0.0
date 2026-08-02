import type { Metadata } from "next";
import LeaderboardView from "@/components/arena/leaderboard-view";

export const metadata: Metadata = {
  title: "Competitive Arena & Leaderboard | Cloud Skills Hub",
  description: "Real competitive ratings, seasonal leaderboards, live battles, and match history. Prove your skill — climb from Bronze to Immortal.",
};

export default function LeaderboardPage() {
  return <LeaderboardView />;
}