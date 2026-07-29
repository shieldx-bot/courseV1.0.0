"use client";

import type { ConceptMastery } from "@/types";

type ConceptCardProps = {
  concept: ConceptMastery;
  onRequestRemediation?: (concept: ConceptMastery) => void;
};

function masteryLabel(score: number) {
  if (score < 3) return "Weak";
  if (score < 6) return "Developing";
  if (score < 8) return "Proficient";
  return "Mastered";
}

export function ConceptCard({ concept, onRequestRemediation }: ConceptCardProps) {
  const score = concept.mastery_score ?? 0;
  const pct = Math.max(0, Math.min(100, (score / 10) * 100));

  return (
    <div className="space-y-2 rounded-lg border border-neutral-200 p-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium">{concept.name}</p>
          <p className="text-xs text-neutral-500">{masteryLabel(score)}</p>
        </div>
        <span className="text-sm font-semibold">{score.toFixed(1)}</span>
      </div>
      <div className="h-2 w-full rounded-full bg-neutral-100">
        <div
          className="h-2 rounded-full bg-accent-500"
          style={{ width: `${pct}%` }}
        />
      </div>
      {concept.trend && (
        <p className="text-xs text-neutral-500 capitalize">{concept.trend}</p>
      )}
      {score < 3 && onRequestRemediation && (
        <button
          type="button"
          onClick={() => onRequestRemediation(concept)}
          className="text-xs text-accent-600 underline"
        >
          Get remediation
        </button>
      )}
    </div>
  );
}
