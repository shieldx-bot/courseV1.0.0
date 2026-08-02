"use client";

import { Card } from "@/components/ui/card";
import type { DashboardData } from "@/components/dashboard/dashboard-home";

export function DashboardStats({ data }: { data: DashboardData }) {
  const totalLessons =
    data.progress.reduce((s, p) => s + p.progress_pct, 0) /
    Math.max(data.progress.length, 1);

  return (
    <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <Card className="p-5">
        <p className="text-sm text-neutral-500">Weekly XP</p>
        <p className="mt-1 font-mono text-3xl font-bold text-primary-700">320</p>
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-neutral-200">
          <div className="h-full w-1/3 rounded-full bg-gradient-to-r from-primary-600 to-indigo-500 transition-all duration-700" />
        </div>
        <p className="mt-2 text-xs text-neutral-500">1/3 of weekly target</p>
      </Card>
      <Card className="p-5">
        <p className="text-sm text-neutral-500">Current streak</p>
        <p className="mt-1 font-mono text-3xl font-bold">🔥 3 days</p>
        <p className="mt-2 text-xs text-neutral-500">Solve 1 challenge today to keep it</p>
      </Card>
      <Card className="p-5">
        <p className="text-sm text-neutral-500">Skill mastery</p>
        <p className="mt-1 font-mono text-3xl font-bold">{data.skills.length || 0} skills</p>
        <p className="mt-2 text-xs text-neutral-500">{data.weak.length} need attention</p>
      </Card>
      <Card className="p-5">
        <p className="text-sm text-neutral-500">Course progress</p>
        <p className="mt-1 font-mono text-3xl font-bold">{Math.round(totalLessons)}%</p>
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-neutral-200">
          <div className="h-full rounded-full bg-emerald-500 transition-all duration-700" style={{ width: `${totalLessons}%` }} />
        </div>
        <p className="mt-2 text-xs text-neutral-500">{data.progress.length} courses in progress</p>
      </Card>
    </div>
  );
}