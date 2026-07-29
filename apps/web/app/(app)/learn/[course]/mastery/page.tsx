"use client";

import { useEffect, useState } from "react";
import { MasteryRadar, type ConceptMastery } from "@/components/adaptive/MasteryRadar";
import { ConceptCard } from "@/components/adaptive/ConceptCard";
import { adaptiveClient } from "@/lib/adaptive-client";
import { Button } from "@/components/ui/button";

type ConceptWithMastery = ConceptMastery & {
  description?: string;
  lesson_ids?: string[];
  prerequisite_concepts?: string[];
};

export default function MasteryDashboard({ params }: { params: { course: string } }) {
  const [concepts, setConcepts] = useState<ConceptWithMastery[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [remediationConcepts, setRemediationConcepts] = useState<ConceptMastery[]>([]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    adaptiveClient
      .listConcepts(params.course)
      .then((data) => {
        if (!cancelled) {
          const sorted = (data || []).sort((a, b) => (a.mastery_score ?? 0) - (b.mastery_score ?? 0));
          setConcepts(sorted);
          setRemediationConcepts(sorted.filter((c) => (c.mastery_score ?? 0) < 3));
        }
      })
      .catch((e) => {
        if (!cancelled) setError(e.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [params.course]);

  if (loading) {
    return <p className="mt-10 text-center text-sm text-neutral-600">Loading mastery...</p>;
  }

  if (error) {
    return <p className="mt-10 text-center text-sm text-red-600">{error}</p>;
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <h1 className="text-2xl font-semibold">Concept Mastery</h1>
      <p className="mt-1 text-sm text-neutral-600">
        Course: {params.course} • {concepts.length} concepts tracked
      </p>

      <div className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-2">
        <div className="space-y-4">
          <h2 className="text-lg font-medium">Mastery Radar</h2>
          <div className="rounded-lg border border-neutral-200 p-4">
            <MasteryRadar
              concepts={concepts.map((c) => ({
                id: c.id,
                name: c.name,
                mastery_score: c.mastery_score,
                trend: c.trend,
              }))}
              size={320}
            />
          </div>
        </div>

        <div className="space-y-4">
          <h2 className="text-lg font-medium">Weak Concepts</h2>
          <div className="space-y-3">
            {remediationConcepts.length === 0 && (
              <p className="text-sm text-neutral-600">No weak concepts — keep it up!</p>
            )}
            {remediationConcepts.map((concept) => (
              <ConceptCard key={concept.id} concept={concept} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
