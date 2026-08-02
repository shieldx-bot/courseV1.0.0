"use client";

import { useCallback, useEffect, useState } from "react";
import { adaptiveClient } from "@/lib/adaptive-client";
import { MasteryRadar } from "@/components/adaptive/MasteryRadar";
import { ConceptCard } from "@/components/adaptive/ConceptCard";
import { RemedialPanel } from "@/components/adaptive/RemedialPanel";
import { LearningPath } from "@/components/adaptive/LearningPath";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type {
  ConceptMasterySummary,
  PrerequisiteInfo,
  RemediationSuggestion,
} from "@/types/adaptive";

export default function MasteryDashboard({ params }: { params: { course: string } }) {
  const [concepts, setConcepts] = useState<ConceptMasterySummary[]>([]);
  const [weak, setWeak] = useState<ConceptMasterySummary[]>([]);
  const [strong, setStrong] = useState<ConceptMasterySummary[]>([]);
  const [remedial, setRemedial] = useState<RemediationSuggestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedConcept, setSelectedConcept] = useState<ConceptMasterySummary | null>(null);
  const [prereqs, setPrereqs] = useState<PrerequisiteInfo[]>([]);
  const [prereqsLoading, setPrereqsLoading] = useState(false);
  const [remedialTarget, setRemedialTarget] = useState<{ conceptId: string; conceptName: string } | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    Promise.all([
      adaptiveClient.listConcepts(params.course),
      adaptiveClient.getWeak(params.course),
      adaptiveClient.getStrong(params.course),
      adaptiveClient.getRemediation(params.course),
    ])
      .then(([conceptsData, weakData, strongData, remedialData]) => {
        if (cancelled) return;
        setConcepts(
          (conceptsData || []).map((c) => ({
            id: c.id,
            name: c.name,
            mastery_score: c.mastery_score ?? 0,
          }))
        );
        setWeak(weakData);
        setStrong(strongData);
        setRemedial(remedialData);
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load mastery");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [params.course]);

  const selectConcept = useCallback(
    async (concept: ConceptMasterySummary) => {
      setSelectedConcept(concept);
      setPrereqs([]);
      setPrereqsLoading(true);
      try {
        const data = await adaptiveClient.getPrerequisites(params.course, concept.id);
        setPrereqs(data);
      } catch {
        setPrereqs([]);
      } finally {
        setPrereqsLoading(false);
      }
    },
    [params.course]
  );

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

      <div className="mt-8">
        <LearningPath courseId={params.course} />
      </div>

      {remedial.length > 0 && (
        <section className="mt-8">
          <h2 className="text-lg font-medium">Remedial queue</h2>
          <p className="text-sm text-neutral-600">
            Concepts to strengthen before moving on (weakest first).
          </p>
          <div className="mt-3 space-y-3">
            {remedial.map((s) => (
              <div
                key={s.concept_id}
                className="flex items-center justify-between rounded-lg border border-amber-200 bg-amber-50 p-4"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-medium">{s.concept_name}</p>
                    <Badge variant={s.mastery_score < 3 ? "danger" : "warning"}>
                      {s.mastery_score.toFixed(1)}
                    </Badge>
                  </div>
                  <p className="mt-1 text-xs text-neutral-600">{s.suggestion}</p>
                </div>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => setRemedialTarget({ conceptId: s.concept_id, conceptName: s.concept_name })}
                >
                  Practice
                </Button>
              </div>
            ))}
          </div>
        </section>
      )}

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
              onSelect={selectConcept}
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
              <ConceptCard key={concept.id} concept={concept} onSelect={selectConcept} />
            ))}
          </div>
        </div>
      </div>

      <div className="mt-10 grid grid-cols-1 gap-8 lg:grid-cols-2">
        <section>
          <h2 className="text-lg font-medium">Weak concepts</h2>
          <p className="text-sm text-neutral-600">Mastery below 3 — prioritize these.</p>
          <div className="mt-3 space-y-3">
            {weak.length === 0 && (
              <p className="text-sm text-neutral-600">No weak concepts. Nice work!</p>
            )}
            {weak.map((concept) => (
              <ConceptCard key={concept.id} concept={concept} onSelect={selectConcept} />
            ))}
          </div>
        </section>

        <section>
          <h2 className="text-lg font-medium">Strong concepts</h2>
          <p className="text-sm text-neutral-600">Mastery of 7 or above.</p>
          <div className="mt-3 space-y-3">
            {strong.length === 0 && (
              <p className="text-sm text-neutral-600">No strong concepts yet.</p>
            )}
            {strong.map((concept) => (
              <ConceptCard key={concept.id} concept={concept} onSelect={selectConcept} />
            ))}
          </div>
        </section>
      </div>

      <section className="mt-10">
        <h2 className="text-lg font-medium">Practice history</h2>
        <p className="mt-1 text-sm text-neutral-600">
          Practice history coming soon.
        </p>
      </section>

      {selectedConcept && (
        <section className="mt-10 rounded-lg border border-neutral-200 p-5">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold">{selectedConcept.name}</h2>
              <p className="text-sm text-neutral-600">
                Mastery: {selectedConcept.mastery_score.toFixed(1)} / 10
              </p>
            </div>
            <Button variant="ghost" size="sm" onClick={() => setSelectedConcept(null)}>
              Close
            </Button>
          </div>

          <div className="mt-4">
            <h3 className="text-sm font-medium">Prerequisites</h3>
            {prereqsLoading ? (
              <p className="mt-1 text-sm text-neutral-500">Loading prerequisites...</p>
            ) : prereqs.length === 0 ? (
              <p className="mt-1 text-sm text-neutral-500">No prerequisites.</p>
            ) : (
              <ul className="mt-2 space-y-2">
                {prereqs.map((p) => (
                  <li
                    key={p.id}
                    className="flex items-center justify-between rounded-md border border-neutral-200 px-3 py-2"
                  >
                    <div>
                      <p className="text-sm font-medium">{p.name}</p>
                      <p className="text-xs text-neutral-500">{p.mastery_score.toFixed(1)} / 10</p>
                    </div>
                    <Badge variant={p.mastered ? "success" : "warning"}>
                      {p.mastered ? "Mastered" : "Not mastered"}
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="mt-4 flex gap-2">
            <Button
              size="sm"
              onClick={() =>
                setRemedialTarget({ conceptId: selectedConcept.id, conceptName: selectedConcept.name })
              }
            >
              Get remediation
            </Button>
            <Button size="sm" variant="secondary" onClick={() => setSelectedConcept(null)}>
              Close
            </Button>
          </div>
        </section>
      )}

      {remedialTarget && (
        <div className="mt-6">
          <RemedialPanel
            courseId={params.course}
            conceptId={remedialTarget.conceptId}
            conceptName={remedialTarget.conceptName}
            onClose={() => setRemedialTarget(null)}
          />
        </div>
      )}
    </div>
  );
}
