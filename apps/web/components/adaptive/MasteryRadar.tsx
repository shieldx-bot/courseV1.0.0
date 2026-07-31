"use client";

import { useMemo } from "react";
import { Badge } from "@/components/ui/badge";

export type ConceptMastery = {
  id: string;
  name: string;
  mastery_score: number;
  difficulty_base?: number;
  trend?: "improving" | "declining" | "stable";
};

type MasteryRadarProps = {
  concepts: ConceptMastery[];
  size?: number;
};

function masteryColor(score: number) {
  if (score < 3) return "var(--color-error, #E5484D)";
  if (score < 6) return "var(--color-warning, #F5A623)";
  return "var(--color-success, #30A46C)";
}

function trendLabel(trend?: string) {
  if (trend === "improving") return "Improving";
  if (trend === "declining") return "Declining";
  return "Stable";
}

export function MasteryRadar({ concepts, size = 280 }: MasteryRadarProps) {
  const items = useMemo(() => concepts.filter((c) => !!c.name), [concepts]);
  const n = items.length || 1;

  const cx = size / 2;
  const cy = size / 2;
  const rx = size * 0.42;
  const ry = size * 0.42;
  const maxR = Math.max(rx, ry);

  const points = items.map((concept, i) => {
    const angle = (Math.PI * 2 * i) / n - Math.PI / 2;
    const scoreRatio = Math.max(0, Math.min(1, concept.mastery_score / 10));
    const r = scoreRatio * maxR;
    const x = cx + Math.cos(angle) * rx;
    const y = cy + Math.sin(angle) * ry;
    const bx = cx + Math.cos(angle) * maxR;
    const by = cy + Math.sin(angle) * maxR;
    return {
      concept,
      x,
      y,
      bx,
      by,
      scoreRatio,
      angle,
    };
  });

  const polygonPoints = points.map((p) => `${p.x},${p.y}`).join(" ");
  const basePolygonPoints = points.map((p) => `${p.bx},${p.by}`).join(" ");

  return (
    <div className="space-y-4">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="mx-auto">
        <g fill="none" stroke="currentColor" className="text-neutral-200">
          {[0.25, 0.5, 0.75, 1].map((level) => (
            <polygon
              key={level}
              points={points
                .map((p) => {
                  const r = level * maxR;
                  const x = cx + ((p.x - cx) / maxR) * r;
                  const y = cy + ((p.y - cy) / maxR) * r;
                  return `${x},${y}`;
                })
                .join(" ")}
              strokeWidth="1"
            />
          ))}
          {points.map((p, i) => (
            <line
              key={i}
              x1={cx}
              y1={cy}
              x2={p.bx}
              y2={p.by}
              strokeWidth="1"
            />
          ))}
        </g>

        <polygon points={basePolygonPoints} className="fill-neutral-100 text-neutral-300" strokeWidth="0" />

        <polygon points={polygonPoints} className="fill-accent-500/20 text-accent-500" strokeWidth="2" />

        {points.map((p, i) => (
          <g key={i} transform={`translate(${p.x}, ${p.y})`}>
            <circle r="4" fill={masteryColor(p.concept.mastery_score)} />
            <title>{`${p.concept.name}: ${p.concept.mastery_score}`}</title>
          </g>
        ))}
      </svg>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {items.map((concept) => (
          <div
            key={concept.id}
            className="flex items-center justify-between rounded-md border border-neutral-200 px-3 py-2"
          >
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{concept.name}</p>
              <p className="text-xs text-neutral-500">{trendLabel(concept.trend)}</p>
            </div>
            <Badge
              variant={
                concept.mastery_score < 3
                  ? "danger"
                  : concept.mastery_score < 6
                    ? "warning"
                    : "success"
              }
            >
              {concept.mastery_score.toFixed(1)}
            </Badge>
          </div>
        ))}
      </div>
    </div>
  );
}
