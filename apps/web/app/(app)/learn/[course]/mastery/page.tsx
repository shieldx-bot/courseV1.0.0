"use client";

import { useEffect, useState } from "react";
import { adaptiveClient } from "@/lib/adaptive-client";
import { MasteryRadar } from "@/components/adaptive/MasteryRadar";
import { ConceptCard } from "@/components/adaptive/ConceptCard";
import type { ConceptMasterySummary } from "@/types/adaptive";

export default function MasteryDashboard({ params }: { params: { course: string } }) {
  const [concepts, setConcepts] = useState<ConceptMasterySummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    adaptiveClient
      .listConcepts(params.course)
      .then((data) => {
        if (!cancelled) {
          const sorted = (data || [])
            .map((c) => ({
              id: c.id,
              name: c.name,
              mastery_score: c.mastery_score ?? 0,
            }))
            .sort((a, b) => a.mastery_score - b.mastery_score);
          setConcepts(sorted);
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
        Course: {params.course} • {concepts.length} concepts
      </p>

      <div className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-2">
        <div className="space-y-4">
          <h2 className="text-lg font-medium">Mastery Radar</h2>
          <div className="rounded-lg border border-neutral-200 p-4">
            <MasteryRadar
              concepts={concepts.map((c) => ({
                id: c.id,
                name: c.name,
                mastery_score: c.mastery_score ?? 0,
                trend: c.trend,
              }))}
              size={320}
            />
          </div>
        </div>

        <div className="space-y-4">
          <h2 className="text-lg font-medium">Concepts</h2>
          <div className="space-y-3">
            {concepts.length === 0 && (
              <p className="text-sm text-neutral-600">No concepts yet.</p>
            )}
            {concepts.map((concept) => (
              <ConceptCard
                key={concept.id}
                concept={{
                  id: concept.id,
                  name: concept.name,
                  mastery_score: concept.mastery_score,
                  trend: concept.trend,
                }}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
