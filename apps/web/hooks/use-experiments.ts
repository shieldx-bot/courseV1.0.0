"use client";

import { useEffect, useState } from "react";
import { apiClient } from "@/lib/api-client";

interface ExperimentVariant {
  experiment_id: string;
  experiment_slug: string;
  variant: string;
  variant_name: string;
}

export function useExperiments() {
  const [variants, setVariants] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    apiClient.experiments.variantMap()
      .then((data) => {
        if (mounted) setVariants(data || {});
      })
      .catch(() => {})
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => { mounted = false; };
  }, []);

  const getVariant = (experimentSlug: string): string | null => {
    return variants[experimentSlug] || null;
  };

  const isInExperiment = (experimentSlug: string): boolean => {
    return !!variants[experimentSlug];
  };

  const track = async (experimentSlug: string, eventType: string, metadata?: Record<string, unknown>) => {
    try {
      await apiClient.experiments.track(experimentSlug, eventType, metadata);
    } catch {
      // Silently fail - tracking is not critical
    }
  };

  return { variants, loading, getVariant, isInExperiment, track };
}

export function useExperimentVariant(experimentSlug: string): string | null {
  const { variants, loading } = useExperiments();
  if (loading) return null;
  return variants[experimentSlug] || null;
}