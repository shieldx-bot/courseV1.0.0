"use client";

import { useExperimentVariant } from "@/hooks/use-experiments";
import { Button } from "@/components/ui/button";

export function ExperimentCTA({ 
  experimentSlug = "hero-cta-color",
  children 
}: { 
  experimentSlug?: string;
  children: React.ReactNode;
}) {
  const variant = useExperimentVariant(experimentSlug);
  const isAmber = variant === "amber";
  
  return (
    <Button 
      className="w-full" 
      size="lg"
      variant={isAmber ? "secondary" : "primary"}
    >
      {children}
    </Button>
  );
}

export function ExperimentHeroHeadline({ 
  experimentSlug = "hero-headline",
  children 
}: { 
  experimentSlug?: string;
  children: React.ReactNode;
}) {
  const variant = useExperimentVariant(experimentSlug);
  const isVietnamese = variant === "vietnamese";
  
  return (
    <h1 className="text-4xl font-bold text-primary-900">
      {isVietnamese ? "Học 2000+ khóa với 1 lần đăng ký" : "One membership. Every skill."}
    </h1>
  );
}

export function ExperimentPricingLayout({ 
  experimentSlug = "pricing-layout",
  children 
}: { 
  experimentSlug?: string;
  children: React.ReactNode;
}) {
  const variant = useExperimentVariant(experimentSlug);
  const highlightAnnual = variant === "highlight-annual";
  
  return (
    <div className={highlightAnnual ? "highlight-annual" : ""}>
      {children}
    </div>
  );
}

export function ExperimentTrialFlow({ 
  experimentSlug = "trial-flow",
  children 
}: { 
  experimentSlug?: string;
  children: React.ReactNode;
}) {
  const variant = useExperimentVariant(experimentSlug);
  const isOTP = variant === "otp";
  
  return (
    <div data-experiment-variant={variant || "control"}>
      {children}
    </div>
  );
}