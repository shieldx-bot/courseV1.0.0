"use client";

import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { DashboardData } from "@/components/dashboard/dashboard-home";

export function DashboardWidgets({ data }: { data: DashboardData }) {
  return (
    <div className="space-y-5">
      {/* Live competitions */}
      <Card>
        <CardHeader>
          <CardTitle>🔥 Live competitions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {data.competitions.slice(0, 3).map((c) => (
            <Link key={c._id} href={`/challenges/${c._id}`} className="block rounded-xl border border-neutral-200 p-3 transition-all hover:border-primary-300 hover:shadow-sm">
              <p className="font-medium text-neutral-900">{c.title}</p>
              <div className="mt-2 flex flex-wrap gap-2 text-xs">
                <span className="rounded-full bg-rose-100 px-2 py-0.5 font-medium text-rose-700">{c.difficulty}</span>
                <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-neutral-600">
                  {new Intl.NumberFormat().format(c.stats.attempts)} attempts
                </span>
              </div>
              <p className="mt-2 text-xs font-medium text-primary-700">Join now →</p>
            </Link>
          ))}
          {!data.competitions.length && (
            <p className="text-sm text-neutral-500">No active competitions. Check the Arena.</p>
          )}
          <Link href="/arena" className="block pt-1 text-sm font-medium text-primary-700 hover:underline">
            Open full arena →
          </Link>
        </CardContent>
      </Card>

      {/* Recent activity */}
      <Card>
        <CardHeader>
          <CardTitle>Recent activity</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {data.activity.slice(0, 6).map((e) => (
            <div key={e.id} className="flex items-start gap-3 text-sm">
              <span className="mt-0.5 text-primary-700">▸</span>
              <div>
                <p className="text-neutral-800">{e.label}</p>
                <p className="text-xs text-neutral-500">
                  {new Date(e.created_at).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                </p>
              </div>
            </div>
          ))}
          {!data.activity.length && <p className="text-sm text-neutral-500">Your activity will appear here.</p>}
          <Link href="/activity" className="block pt-2 text-sm font-medium text-primary-700 hover:underline">
            View full activity →
          </Link>
        </CardContent>
      </Card>

      {/* Saved challenges */}
      <Card>
        <CardHeader>
          <CardTitle>🔖 Saved challenges</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {data.bookmarks.slice(0, 3).map((c) => (
            <Link key={c._id} href={`/challenges/${c._id}`} className="block rounded-xl border border-neutral-200 p-3 transition-all hover:border-primary-300 hover:shadow-sm">
              <p className="font-medium text-neutral-900">{c.title}</p>
              <p className="mt-0.5 text-xs text-neutral-500">{c.difficulty} · ⭐ {c.stats.avg_rating.toFixed(1)}</p>
            </Link>
          ))}
          {!data.bookmarks.length && (
            <p className="text-sm text-neutral-500">Bookmark challenges to revisit them here.</p>
          )}
        </CardContent>
      </Card>

      {/* Course progress */}
      <Card>
        <CardHeader>
          <CardTitle>📚 In progress</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {data.progress.slice(0, 4).map((p, i) => (
            <div key={i} className="rounded-xl border border-neutral-200 p-3">
              <p className="font-medium text-neutral-900">{p.course_title}</p>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-neutral-200">
                <div className="h-full rounded-full bg-emerald-500 transition-all duration-700" style={{ width: `${p.progress_pct}%` }} />
              </div>
              <p className="mt-1 text-xs text-neutral-500">{p.progress_pct}% complete</p>
            </div>
          ))}
          {!data.progress.length && (
            <p className="text-sm text-neutral-500">Start a course to track progress.</p>
          )}
          <Link href="/learn" className="block pt-1 text-sm font-medium text-primary-700 hover:underline">
            Browse all courses →
          </Link>
        </CardContent>
      </Card>

      {/* Quick actions */}
      <Card>
        <CardHeader>
          <CardTitle>⚡ Quick actions</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-2">
          {[
            { href: "/challenges", label: "Browse challenges" },
            { href: "/learning-paths", label: "Learning paths" },
            { href: "/arena", label: "Enter arena" },
            { href: "/skills", label: "Skills radar" },
            { href: "/activity", label: "Activity" },
            { href: "/my-learning-paths", label: "My paths" },
            { href: "/account", label: "Account" },
            { href: "/creator", label: "🎬 Create a challenge" },
          ].map((a) => (
            <Link key={a.href} href={a.href} className="rounded-xl border border-neutral-200 p-3 text-sm font-medium text-neutral-700 transition-all hover:border-primary-300 hover:bg-primary-50 hover:text-primary-800">
              {a.label}
            </Link>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}