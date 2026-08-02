import type { Metadata } from "next";
import { ProfileView } from "@/components/profile/profile-view";

interface PublicProfilePageProps {
  params: { userId: string };
}

export async function generateMetadata(props: PublicProfilePageProps): Promise<Metadata> {
  const { userId } = props.params;
  return {
    title: "Member Profile | Cloud Skills Hub",
    description: `Public competitive profile of member ${userId} — rank, reputation, featured challenges, and recent activity.`,
  };
}

export default function PublicProfilePage(props: PublicProfilePageProps) {
  const { userId } = props.params;
  return <ProfileView mode="public" userId={userId} />;
}