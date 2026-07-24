"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { apiFetch } from "@/lib/api-client";

interface DashboardData {
  total_members: number;
  active_subscriptions: number;
  total_courses: number;
  total_lessons: number;
  total_revenue: number;
  recent_revenue: number;
  timestamp: string;
}

function BarChart({ data, height = 160 }: { data: { label: string; value: number; color: string }[]; height?: number }) {
  const max = Math.max(...data.map((d) => d.value), 1);
  return (
    <div className="flex items-end justify-between gap-2" style={{ height }}>
      {data.map((d) => (
        <div key={d.label} className="flex flex-1 flex-col items-center gap-1">
          <span className="text-xs text-neutral-600">{d.value}</span>
          <div
            className="w-full rounded-t"
            style={{ height: `${(d.value / max) * 100}%`, backgroundColor: d.color, minHeight: 4 }}
          />
          <span className="text-[10px] text-neutral-500">{d.label}</span>
        </div>
      ))}
    </div>
  );
}

function DonutChart({ value, max, label, color }: { value: number; max: number; label: string; color: string }) {
  const pct = max > 0 ? (value / max) * 100 : 0;
  const circumference = 2 * Math.PI * 36;
  const offset = circumference - (pct / 100) * circumference;
  return (
    <div className="flex flex-col items-center">
      <svg width="90" height="90" viewBox="0 0 90 90" className="-rotate-90">
        <circle cx="45" cy="45" r="36" fill="none" stroke="#e5e7eb" strokeWidth="8" />
        <circle cx="45" cy="45" r="36" fill="none" stroke={color} strokeWidth="8" strokeDasharray={circumference} strokeDashoffset={offset} strokeLinecap="round" />
      </svg>
      <span className="mt-1 text-lg font-semibold text-neutral-900">{value}</span>
      <span className="text-xs text-neutral-500">{label}</span>
    </div>
  );
}

export default function AdminDashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch("/admin/dashboard")
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <section className="py-12">
        <div className="animate-pulse">
          <div className="h-8 w-64 rounded bg-neutral-200 dark:bg-neutral-700" />
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-24 rounded-lg bg-neutral-100 dark:bg-neutral-800" />
            ))}
          </div>
          <div className="mt-8 grid gap-6 lg:grid-cols-2">
            <div className="h-48 rounded-lg bg-neutral-100 dark:bg-neutral-800" />
            <div className="h-48 rounded-lg bg-neutral-100 dark:bg-neutral-800" />
          </div>
        </div>
      </section>
    );
  }

  const stats = data
    ? [
        { label: "Total members", value: data.total_members.toLocaleString() },
        { label: "Active subscriptions", value: data.active_subscriptions.toLocaleString() },
        { label: "Total revenue", value: `$${data.total_revenue.toLocaleString()}` },
        { label: "Courses", value: `${data.total_courses} (${data.total_lessons} lessons)` },
      ]
    : [];

  return (
    <section className="py-12">
      <div>
        <h1 className="text-3xl font-semibold text-primary-900">Admin dashboard</h1>

        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {stats.map((s) => (
            <Card key={s.label} className="p-5">
              <p className="text-sm text-neutral-600">{s.label}</p>
              <p className="mt-2 text-2xl font-semibold text-neutral-900">{s.value}</p>
            </Card>
          ))}
        </div>

        {data && (
          <div className="mt-8 grid gap-6 lg:grid-cols-2">
            <Card className="p-5">
              <h2 className="mb-4 font-semibold text-neutral-900">Revenue overview</h2>
              <BarChart
                data={[
                  { label: "Current", value: data.recent_revenue || data.total_revenue, color: "#22c55e" },
                  { label: "Total", value: data.total_revenue, color: "#3b82f6" },
                ]}
              />
            </Card>

            <Card className="p-5">
              <h2 className="mb-4 font-semibold text-neutral-900">Members breakdown</h2>
              <div className="flex justify-around">
                <DonutChart value={data.active_subscriptions} max={data.total_members || 1} label="Active subs" color="#22c55e" />
                <DonutChart value={data.total_members - data.active_subscriptions} max={data.total_members || 1} label="Inactive" color="#f59e0b" />
                <DonutChart value={data.total_courses} max={50} label="Courses" color="#3b82f6" />
              </div>
            </Card>
          </div>
        )}
      </div>
    </section>
  );
}
