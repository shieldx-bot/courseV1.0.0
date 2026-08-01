import type { Metadata } from "next";
import CommunityHubView from "@/components/community/hub-view";

export const metadata: Metadata = {
  title: "Community | Cloud Skills Hub",
  description: "Live activity, trending discussions, and top members — the competitive learning arena in real time.",
};

export default function CommunityPage() {
  return <CommunityHubView />;
}