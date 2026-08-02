"use client";

import { useEffect, useState } from "react";
import { Clock } from "lucide-react";
import { apiFetch } from "@/lib/api-client";

interface IntelligenceOverview {
  source?: string;
  snapshot_generated_at?: string;
  [key: string]: unknown;
}

export function formatSnapshotTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

/**
 * NV2 — intelligence snapshot badge (Phase 7).
 *
 * `GET /admin/intelligence/overview` is snapshot-backed: when the worker has
 * produced a snapshot the response carries `source: "snapshot"` plus a
 * generation timestamp; otherwise it falls back to live computation. This
 * badge shows the snapshot generation time so admins don't mistake the data
 * for real-time. Fully guarded — nothing renders on failure, live fallback,
 * or when the timestamp field is absent.
 */
export default function IntelligenceSnapshotBadge() {
  const [snapshotAt, setSnapshotAt] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    apiFetch<IntelligenceOverview>("/admin/intelligence/overview")
      .then((data) => {
        if (cancelled) return;
        if (data && data.source === "snapshot" && typeof data.snapshot_generated_at === "string") {
          const label = formatSnapshotTime(data.snapshot_generated_at);
          if (label) setSnapshotAt(label);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  if (snapshotAt === null) return null;

  return (
    <span
      data-testid="intelligence-snapshot-badge"
      title="Intelligence data is generated from a periodic snapshot, not live"
      className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-800 ring-1 ring-amber-200"
    >
      <Clock className="h-3.5 w-3.5" aria-hidden="true" />
      Snapshot: {snapshotAt}
    </span>
  );
}
