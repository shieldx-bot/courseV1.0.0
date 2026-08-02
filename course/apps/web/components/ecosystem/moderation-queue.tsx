"use client";

import { useEffect, useState, useCallback } from "react";
import { ShieldAlert, Flag, XCircle, AlertTriangle, Ban, Trash2 } from "lucide-react";
import { ecosystemApi } from "@/lib/ecosystem-api";
import type { ModerationReport, ModerationStats } from "@/types/ecosystem";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/toast";

const ACTION_META: Record<string, { label: string; icon: React.ReactNode; className: string }> = {
  warn: { label: "Warn", icon: <AlertTriangle className="h-3.5 w-3.5" />, className: "bg-amber-100 text-amber-700 hover:bg-amber-200" },
  remove: { label: "Remove", icon: <Trash2 className="h-3.5 w-3.5" />, className: "bg-rose-100 text-rose-700 hover:bg-rose-200" },
  ban: { label: "Ban", icon: <Ban className="h-3.5 w-3.5" />, className: "bg-neutral-900 text-white hover:bg-neutral-800" },
  dismiss: { label: "Dismiss", icon: <XCircle className="h-3.5 w-3.5" />, className: "bg-neutral-100 text-neutral-600 hover:bg-neutral-200" },
};

function timeAgo(iso: string): string {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

export default function ModerationQueue() {
  const { toast } = useToast();
  const notify = (message: string, type: "info" | "success" | "error" | "warning" = "info") =>
    toast(message, { type });

  const [reports, setReports] = useState<ModerationReport[] | null>(null);
  const [stats, setStats] = useState<ModerationStats | null>(null);
  const [status, setStatus] = useState("pending");
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [r, s] = await Promise.all([
        ecosystemApi.adminListReports(status, 50),
        ecosystemApi.adminGetModerationStats(),
      ]);
      setReports(r.reports);
      setStats(s);
    } catch (e: any) {
      notify(e?.message || "Failed to load moderation queue", "error");
    } finally {
      setLoading(false);
    }
  }, [status, toast]);

  useEffect(() => { load(); }, [load]);

  const resolve = async (reportId: string, action: string) => {
    setActing(reportId);
    try {
      const result = await ecosystemApi.adminResolveReport(reportId, { action });
      notify(`Report ${result.status}.`, "success");
      await load();
    } catch (e: any) {
      notify(e?.message || "Action failed", "error");
    } finally {
      setActing(null);
    }
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="rounded-3xl bg-gradient-to-br from-neutral-900 via-neutral-800 to-slate-900 p-8 text-white shadow-lg sm:p-10">
        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-white/60">
          <ShieldAlert className="h-4 w-4 text-rose-400" /> Trust & Safety
        </div>
        <h1 className="mt-2 text-3xl font-bold sm:text-4xl">Moderation Queue</h1>
        <p className="mt-2 max-w-2xl text-sm text-white/75">
          Review community reports. Every action keeps the ecosystem safe, fair, and trustworthy.
        </p>

        {/* Stats */}
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <ModStat label="Total reports" value={stats?.total ?? 0} color="text-white" />
          <ModStat label="Pending" value={stats?.pending ?? 0} color="text-amber-400" />
          <ModStat label="Resolved" value={stats?.resolved ?? 0} color="text-emerald-400" />
          <ModStat label="Dismissed" value={stats?.dismissed ?? 0} color="text-neutral-400" />
        </div>

        {/* Category breakdown */}
        {stats && Object.keys(stats.by_category).length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2">
            {Object.entries(stats.by_category).map(([cat, count]) => (
              <span key={cat} className="inline-flex items-center gap-1 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold ring-1 ring-white/20">
                <Flag className="h-3 w-3 text-rose-300" /> {cat} · {count}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Status tabs */}
      <div className="mt-6 flex flex-wrap gap-2">
        {["pending", "resolved", "dismissed"].map(s => (
          <button
            key={s}
            onClick={() => setStatus(s)}
            className={`rounded-full px-4 py-1.5 text-sm font-semibold transition-colors ${
              status === s
                ? "bg-neutral-900 text-white"
                : "bg-white text-neutral-600 ring-1 ring-neutral-200 hover:ring-primary-300"
            }`}
          >
            {s.charAt(0).toUpperCase() + s.slice(1)}
            {s === "pending" && (stats?.pending ?? 0) > 0 && (
              <span className={`ml-1.5 rounded-full px-1.5 py-0.5 text-xs font-bold ${status === s ? "bg-rose-500 text-white" : "bg-rose-100 text-rose-600"}`}>
                {stats?.pending}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Reports list */}
      <div className="mt-6 space-y-4">
        {loading ? (
          [0, 1, 2, 3].map(i => <Skeleton key={i} className="h-28 w-full rounded-2xl" />)
        ) : (reports ?? []).length === 0 ? (
          <div className="rounded-2xl bg-white p-12 text-center shadow-sm ring-1 ring-neutral-200/60">
            <ShieldAlert className="mx-auto h-10 w-10 text-neutral-300" />
            <h3 className="mt-3 text-lg font-bold text-neutral-800">
              {status === "pending" ? "All clear!" : "No reports here"}
            </h3>
            <p className="mt-1 text-sm text-neutral-500">
              {status === "pending"
                ? "No pending reports. The community is behaving well."
                : `No ${status} reports.`}
            </p>
          </div>
        ) : (
          (reports ?? []).map(report => (
            <div key={report.id} className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-neutral-200/60">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2.5 py-1 text-xs font-bold text-rose-600 ring-1 ring-rose-200">
                      <Flag className="h-3 w-3" /> {report.category_label}
                    </span>
                    <span className="rounded-full bg-neutral-100 px-2.5 py-1 text-xs font-semibold text-neutral-500">
                      {report.target_type}
                    </span>
                    <span className="text-xs text-neutral-400">{timeAgo(report.created_at)}</span>
                  </div>
                  <p className="mt-2 text-sm font-semibold text-neutral-800">
                    Target: {report.target?.title || report.target?.id || "Unknown"}
                  </p>
                  <p className="mt-1 text-sm text-neutral-600">
                    {report.reason || "No reason provided."}
                  </p>
                  <p className="mt-1 text-xs text-neutral-400">Reported by {report.reporter_name}</p>
                </div>
              </div>

              {status === "pending" && (
                <div className="mt-4 flex flex-wrap items-center justify-end gap-2 border-t border-neutral-100 pt-4">
                  {["warn", "remove", "ban", "dismiss"].map(action => {
                    const meta = ACTION_META[action];
                    return (
                      <Button
                        key={action}
                        size="sm"
                        loading={acting === report.id}
                        onClick={() => resolve(report.id, action)}
                        className={meta.className}
                      >
                        {meta.icon} {meta.label}
                      </Button>
                    );
                  })}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function ModStat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="rounded-2xl bg-white/10 p-4 ring-1 ring-white/15">
      <p className={`text-2xl font-bold ${color}`}>{value}</p>
      <p className="text-xs font-semibold text-white/50">{label}</p>
    </div>
  );
}