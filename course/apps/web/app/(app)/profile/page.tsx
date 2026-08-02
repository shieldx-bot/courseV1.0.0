import type { Metadata } from "next";
import { ProfileView } from "@/components/profile/profile-view";

export const metadata: Metadata = {
  title: "My Profile | Cloud Skills Hub",
  description: "Your competitive identity — rank, XP, reputation, skill graph, and challenge history.",
};

export default function MyProfilePage() {
  return <ProfileView mode="self" />;
}