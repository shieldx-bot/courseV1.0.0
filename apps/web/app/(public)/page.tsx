import { Suspense } from "react";
import { HeroSection } from "@/components/homepage/hero";
import { StatsBar } from "@/components/homepage/stats-bar";
import { SearchBar } from "@/components/homepage/search-bar";
import { LearningPathsSection } from "@/components/homepage/learning-paths";
import { CategoryGrid } from "@/components/homepage/category-grid";
import { BenefitsSection } from "@/components/homepage/benefits";
import { ComparisonSection } from "@/components/homepage/comparison";
import { PricingTable } from "@/components/homepage/pricing-table";
import { HowItWorksSection } from "@/components/homepage/how-it-works";
import { MicroCommitment } from "@/components/homepage/micro-commitment";
import { VideoIntro } from "@/components/homepage/video-intro";
import { TestimonialsSection } from "@/components/homepage/testimonials";
import { FAQSection } from "@/components/homepage/faq";
import { FinalCTA } from "@/components/homepage/final-cta";
import { TrustBadges } from "@/components/homepage/trust-badges";
import { PartnerLogos } from "@/components/homepage/partner-logos";
import { RepeatedCTA } from "@/components/homepage/repeated-cta";
import { StickyCtaBar } from "@/components/homepage/sticky-cta-bar";
import { Skeleton } from "@/components/ui/skeleton";
import { JsonLd } from "@/components/json-ld";
import { makeMetadata, SITE_URL } from "@/lib/metadata";
import { RecommendationsSection, RecommendationsSectionSkeleton } from "@/components/homepage/recommendations";

export const metadata = makeMetadata();

const websiteSchema = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: "Ascendly",
  url: SITE_URL,
  potentialAction: {
    "@type": "SearchAction",
    target: `${SITE_URL}/courses?search={search_term_string}`,
    "query-input": "required name=search_term_string",
  },
};

export default function HomePage() {
  return (
    <>
      <JsonLd data={websiteSchema} />
      <HeroSection />
      <Suspense fallback={<Skeleton className="h-24 w-full" />}>
        <StatsBar />
      </Suspense>
      <PartnerLogos />
      <SearchBar />
      <Suspense fallback={<Skeleton className="h-60 w-full" />}>
        <LearningPathsSection />
      </Suspense>
      <Suspense fallback={<Skeleton className="h-60 w-full" />}>
        <CategoryGrid />
      </Suspense>
      <BenefitsSection />
      <RepeatedCTA title="Start your free 3-day preview" buttonText="Get started" href="/verify-phone" variant="secondary" />
      <ComparisonSection />
      <Suspense fallback={<Skeleton className="h-80 w-full" />}>
        <PricingTable variant="full" />
      </Suspense>
      <HowItWorksSection />
      <MicroCommitment />
      <VideoIntro />
      <Suspense fallback={<Skeleton className="h-60 w-full" />}>
        <TestimonialsSection />
      </Suspense>
      <RepeatedCTA title="Ready to unlock every course?" buttonText="See pricing" href="/pricing" variant="secondary" />
      <FAQSection />
      <Suspense fallback={<Skeleton className="h-60 w-full" />}>
        <PricingTable variant="mini" />
      </Suspense>
      <Suspense fallback={<RecommendationsSectionSkeleton />}>
        <RecommendationsSection />
      </Suspense>
      <TrustBadges />
      <FinalCTA />
      <StickyCtaBar />
    </>
  );
}
