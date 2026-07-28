"use client";

import { useEffect, useState } from "react";
import { apiClient } from "@/lib/api-client";

interface ExperimentVariant {
  variant_name: string;
  variant_index: number;
}

export function useExperiments() {
  const [variants, setVariants] = useState<Record<string, ExperimentVariant>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    apiClient.experiments.variantMap()
      .then((data) => {
        if (mounted) {
          const mapped: Record<string, ExperimentVariant> = {};
          for (const [slug, variant] of Object.entries(data || {})) {
            const v = variant as Record<string, unknown>;
            mapped[slug] = {
              variant_name: typeof v.name === "string" ? v.name : typeof v.variant_name === "string" ? v.variant_name : "",
              variant_index: typeof v.variant_index === "number" ? v.variant_index : 0,
            };
          }
          setVariants(mapped);
        }
      })
      .catch(() => {})
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => { mounted = false; };
  }, []);

  const getVariant = (experimentSlug: string): string | null => {
    return variants[experimentSlug]?.variant_name || null;
  };

  const isInExperiment = (experimentSlug: string): boolean => {
    return !!variants[experimentSlug];
  };

  const track = async (experimentSlug: string, eventType: string, metadata?: Record<string, unknown>) => {
    try {
      const variant = variants[experimentSlug];
      await apiClient.experiments.track(
        experimentSlug,
        eventType,
        variant?.variant_name || "",
        variant?.variant_index || 0,
        metadata,
      );
    } catch {
      // Silently fail - tracking is not critical
    }
  };

  return { variants, loading, getVariant, isInExperiment, track };
}

export function useExperimentVariant(experimentSlug: string): string | null {
  const { variants, loading } = useExperiments();
  if (loading) return null;
  return variants[experimentSlug]?.variant_name || null;
}