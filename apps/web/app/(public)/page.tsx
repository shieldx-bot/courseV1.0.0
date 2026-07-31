import { HeroCompetitive } from "@/components/homepage/hero-competitive";
import { CompetitiveStats } from "@/components/homepage/competitive-stats";
import { SkillAreas } from "@/components/homepage/skill-areas";
import { HowItWorksCompetitive } from "@/components/homepage/how-it-works-competitive";
import { FeatureShowcase } from "@/components/homepage/feature-showcase";
import { LeaderboardPreview } from "@/components/homepage/leaderboard-preview";
import { AchievementsShowcase } from "@/components/homepage/achievements-showcase";
import { CommunityActivity } from "@/components/homepage/community-activity";
import { CompetitiveCTA } from "@/components/homepage/competitive-cta";
import { JsonLd } from "@/components/json-ld";
import { makeMetadata, SITE_URL } from "@/lib/metadata";

export const metadata = makeMetadata({
  title: "Learn. Compete. Become Legendary | Ascendly",
  description: "Join 50,000+ developers competing in real-time coding challenges. Climb the leaderboards, earn achievements, and build your reputation as a tech expert.",
});

const websiteSchema = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: "Ascendly",
  url: SITE_URL,
  potentialAction: {
    "@type": "SearchAction",
    target: `${SITE_URL}/arena?search={search_term_string}`,
    "query-input": "required name=search_term_string",
  },
};

export default function HomePage() {
  return (
    <>
      <JsonLd data={websiteSchema} />
      <HeroCompetitive />
      <CompetitiveStats />
      <SkillAreas />
      <HowItWorksCompetitive />
      <FeatureShowcase />
      <LeaderboardPreview />
      <AchievementsShowcase />
      <CommunityActivity />
      <CompetitiveCTA />
    </>
  );
}
