"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import {
  ShieldCheck, Award, TrendingUp, Users, BarChart3, Star, Flame,
  BookOpen, CheckCircle2, Sparkles, Zap, Trophy, Crown,
} from "lucide-react";
import { ecosystemApi } from "@/lib/ecosystem-api";
import { communityApi } from "@/lib/community-api";
import type { CreatorAnalytics, CreatorLeaderboardEntry } from "@/types/ecosystem";
import type { CreatorProfile } from "@/types/community";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/toast";

const LEVEL_META: Record<string, { label: string; color: string; icon: string }> = {
  beginner: { label: "Beginner Creator", color: "bg-neutral-100 text-neutral-700", icon: "🌱" },
  trusted: { label: "Trusted Creator", color: "bg-sky-100 text-sky-700", icon: "🤝" },
  expert: { label: "Expert Creator", color: "bg-amber-100 text-amber-700", icon: "🏅" },
  legend: { label: "Legend Creator", color: "bg-purple-100 text-purple-700", icon: "👑" },
};

const BADGE_ICONS: Record<string, string> = {
  first_publish: "🚀", quality_10: "⭐", popular_100: "🔥", mentor_5: "🎓",
  verified: "✅", veteran_10: "🏆", series_1: "📚", event_host: "🎪", collab_1: "🤝",
};

function fmt(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return `${n}`;
}

export default function CreatorStudio() {
  const { toast } = useToast();
  const notify = (message: string, type: "info" | "success" | "error" | "warning" = "info") =>
    toast(message, { type });
  const [analytics, setAnalytics] = useState<CreatorAnalytics | null>(null);
  const [creator, setCreator] = useState<CreatorProfile | null>(null);
  const [leaderboard, setLeaderboard] = useState<CreatorLeaderboardEntry[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(30);
  const [refreshing, setRefreshing] = useState(false);
  const [verifyOpen, setVerifyOpen] = useState(false);
  const [verifyForm, setVerifyForm] = useState({ full_name: "", expertise_area: "", note: "" });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [a, c, lb] = await Promise.all([
        ecosystemApi.getCreatorAnalytics(days),
        communityApi.getMyCreatorProfile(),
        ecosystemApi.getCreatorLeaderboard(10),
      ]);
      setAnalytics(a);
      setCreator(c);
      setLeaderboard(lb.creators);
    } catch (e: any) {
      notify(e?.message || "Failed to load creator studio", "error");
    } finally {
      setLoading(false);
    }
  }, [days, toast]);

  useEffect(() => { load(); }, [load]);

  const refresh = async () => {
    setRefreshing(true);
    try {
      const result = await ecosystemApi.refreshCreatorAchievements();
      if (result.new_badges.length > 0) {
        notify(`New badges earned: ${result.new_badges.map(b => BADGE_ICONS[b] || "🏅").join(" ")}`, "success");
      } else if (result.new_achievements.length > 0) {
        notify("Milestone reached! Check your achievements.", "success");
      } else {
        notify("Achievements up to date.", "success");
      }
      await load();
    } catch (e: any) {
      notify(e?.message || "Refresh failed", "error");
    } finally {
      setRefreshing(false);
    }
  };

  const requestVerification = async () => {
    try {
      await ecosystemApi.requestCreatorVerification(verifyForm);
      notify("Verification request submitted. Our team will review it.", "success");
      setVerifyOpen(false);
      setVerifyForm({ full_name: "", expertise_area: "", note: "" });
      await load();
    } catch (e: any) {
      notify(e?.message || "Request failed", "error");
    }
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-8">
        <Skeleton className="h-40 w-full rounded-3xl" />
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[0, 1, 2, 3].map(i => <Skeleton key={i} className="h-28 w-full rounded-2xl" />)}
        </div>
        <Skeleton className="mt-6 h-72 w-full rounded-3xl" />
      </div>
    );
  }

  const profile = analytics?.profile;
  const totals = analytics?.totals;
  const windowStats = analytics?.window;
  const verification = profile?.verification || "unverified";

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Hero */}
      <div className="rounded-3xl bg-gradient-to-br from-neutral-900 via-neutral-800 to-primary-900 p-8 text-white shadow-xl sm:p-10">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-white/60">
              <Crown className="h-4 w-4 text-amber-400" /> Creator Studio
            </div>
            <h1 className="mt-2 text-3xl font-bold sm:text-4xl">
              {creator?.display_name || creator?.user_name || "Creator"}
            </h1>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {(profile?.level && LEVEL_META[profile.level]) ? (
                <span className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-bold ${LEVEL_META[profile.level].color}`}>
                  {LEVEL_META[profile.level].icon} {LEVEL_META[profile.level].label}
                </span>
              ) : null}
              {verification === "verified" ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/20 px-3 py-1 text-xs font-bold text-emerald-300 ring-1 ring-emerald-400/30">
                  <ShieldCheck className="h-3.5 w-3.5" /> Verified Creator
                </span>
              ) : verification === "pending" ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/20 px-3 py-1 text-xs font-bold text-amber-300 ring-1 ring-amber-400/30">
                  <ShieldCheck className="h-3.5 w-3.5" /> Verification pending
                </span>
              ) : (
                <button
                  onClick={() => setVerifyOpen(v => !v)}
                  className="inline-flex items-center gap-1 rounded-full bg-white/10 px-3 py-1 text-xs font-bold text-white ring-1 ring-white/20 hover:bg-white/20"
                >
                  <ShieldCheck className="h-3.5 w-3.5" /> Get verified
                </button>
              )}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <select
              value={days}
              onChange={e => setDays(Number(e.target.value))}
              className="rounded-xl border border-neutral-200 bg-white/10 px-3 py-2 text-sm font-semibold text-white outline-none backdrop-blur-sm"
            >
              <option value={7} className="text-neutral-800">Last 7 days</option>
              <option value={30} className="text-neutral-800">Last 30 days</option>
              <option value={90} className="text-neutral-800">Last 90 days</option>
            </select>
            <Button variant="secondary" onClick={refresh} loading={refreshing} className="bg-white/15 text-white hover:bg-white/25 ring-1 ring-white/20">
              <Sparkles className="h-4 w-4" /> Refresh achievements
            </Button>
          </div>
        </div>

        {/* Trust score bar */}
        <div className="mt-6">
          <div className="flex items-center justify-between text-sm">
            <span className="font-semibold text-white/75">Trust Score</span>
            <span className="font-bold text-amber-300">{Math.round(profile?.trust_score ?? 0)}/100</span>
          </div>
          <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full bg-gradient-to-r from-amber-400 to-amber-300 transition-all duration-1000"
              style={{ width: `${profile?.trust_score ?? 0}%` }}
            />
          </div>
        </div>

        {verifyOpen && verification !== "verified" && (
          <div className="mt-6 rounded-2xl bg-white/10 p-5 ring-1 ring-white/20 backdrop-blur-sm">
            <h3 className="flex items-center gap-2 font-bold text-white">
              <ShieldCheck className="h-5 w-5 text-emerald-300" /> Request Creator Verification
            </h3>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <input
                value={verifyForm.full_name}
                onChange={e => setVerifyForm(f => ({ ...f, full_name: e.target.value }))}
                placeholder="Full legal name"
                className="rounded-xl border border-white/20 bg-white/10 px-4 py-2.5 text-sm text-white placeholder-white/40 outline-none"
              />
              <input
                value={verifyForm.expertise_area}
                onChange={e => setVerifyForm(f => ({ ...f, expertise_area: e.target.value }))}
                placeholder="Area of expertise (e.g. React, Data Science)"
                className="rounded-xl border border-white/20 bg-white/10 px-4 py-2.5 text-sm text-white placeholder-white/40 outline-none"
              />
            </div>
            <textarea
              value={verifyForm.note}
              onChange={e => setVerifyForm(f => ({ ...f, note: e.target.value }))}
              placeholder="Links to evidence (GitHub, LinkedIn, blog)..."
              rows={3}
              className="mt-3 w-full rounded-xl border border-white/20 bg-white/10 px-4 py-2.5 text-sm text-white placeholder-white/40 outline-none"
            />
            <div className="mt-3 flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setVerifyOpen(false)} className="text-white hover:bg-white/10">Cancel</Button>
              <Button onClick={requestVerification} disabled={!verifyForm.full_name || !verifyForm.expertise_area}>
                <ShieldCheck className="h-4 w-4" /> Submit request
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Stat cards */}
      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-4">
        <StatCard icon={<BarChart3 className="h-5 w-5" />} label="Published" value={fmt(totals?.published_challenges ?? 0)} sub="challenges" />
        <StatCard icon={<Users className="h-5 w-5" />} label="Followers" value={fmt(profile?.followers ?? 0)} sub="creator fans" />
        <StatCard icon={<Zap className="h-5 w-5" />} label="Attempts (30d)" value={fmt(windowStats?.attempts ?? 0)} sub={`${Math.round((windowStats?.completion_rate ?? 0) * 100)}% completion`} />
        <StatCard icon={<Star className="h-5 w-5" />} label="Avg rating" value={(totals?.avg_rating ?? 0).toFixed(1)} sub={`${windowStats?.new_followers ?? 0} new followers`} />
      </div>

      {/* Main grid */}
      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        {/* Left: analytics detail */}
        <div className="space-y-6 lg:col-span-2">
          {/* Performance breakdown */}
          <section className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-neutral-200/60">
            <h2 className="flex items-center gap-2 text-lg font-bold text-neutral-900">
              <TrendingUp className="h-5 w-5 text-primary-600" /> Challenge Performance
            </h2>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-neutral-100 text-xs font-bold uppercase tracking-wide text-neutral-400">
                    <th className="pb-3">Challenge</th>
                    <th className="pb-3 text-right">Attempts</th>
                    <th className="pb-3 text-right">Completion</th>
                    <th className="pb-3 text-right">Rating</th>
                    <th className="pb-3 text-right">Bookmarks</th>
                  </tr>
                </thead>
                <tbody>
                  {(analytics?.per_challenge ?? []).map(c => (
                    <tr key={c.challenge_id} className="border-b border-neutral-50 hover:bg-neutral-50/60">
                      <td className="py-3">
                        <Link href={`/challenges/${c.challenge_id}`} className="font-semibold text-neutral-800 hover:text-primary-600">
                          {c.title || c.challenge_id}
                        </Link>
                        <span className="ml-2 rounded-full bg-neutral-100 px-2 py-0.5 text-xs font-medium text-neutral-500">{c.difficulty}</span>
                      </td>
                      <td className="py-3 text-right font-semibold">{fmt(c.attempts)}</td>
                      <td className="py-3 text-right text-neutral-600">{Math.round(c.completion_rate * 100)}%</td>
                      <td className="py-3 text-right text-amber-600">★ {c.avg_rating.toFixed(1)}</td>
                      <td className="py-3 text-right text-neutral-600">{fmt(c.bookmarks)}</td>
                    </tr>
                  ))}
                  {(analytics?.per_challenge ?? []).length === 0 && (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-sm text-neutral-400">
                        No published challenges yet. <Link href="/challenges" className="font-semibold text-primary-600">Create one →</Link>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

          {/* Achievements */}
          <section className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-neutral-200/60">
            <h2 className="flex items-center gap-2 text-lg font-bold text-neutral-900">
              <Award className="h-5 w-5 text-amber-500" /> Badges & Achievements
            </h2>
            <div className="mt-4 flex flex-wrap gap-3">
              {(profile?.badges ?? []).map(badge => (
                <div key={badge} className="flex items-center gap-2 rounded-xl bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-800 ring-1 ring-amber-200">
                  <span className="text-lg">{BADGE_ICONS[badge] || "🏅"}</span> {badge.replace(/_/g, " ")}
                </div>
              ))}
              {(profile?.badges ?? []).length === 0 && (
                <p className="text-sm text-neutral-400">Publish your first challenge to start earning badges.</p>
              )}
            </div>
            <div className="mt-5 grid gap-2 sm:grid-cols-2">
              {(profile?.achievements ?? []).slice(0, 6).map(id => (
                <div key={id} className="flex items-center gap-2 text-sm text-neutral-600">
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" /> {id.replace(/^m_/, "").replace(/_/g, " ")}
                </div>
              ))}
            </div>
          </section>

          {/* Events hosted */}
          <section className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-neutral-200/60">
            <h2 className="flex items-center gap-2 text-lg font-bold text-neutral-900">
              <Flame className="h-5 w-5 text-orange-500" /> Creator Growth
            </h2>
            <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
              <MiniStat label="Level" value={profile?.level || "beginner"} />
              <MiniStat label="Ratings (30d)" value={fmt(windowStats?.ratings_received ?? 0)} />
              <MiniStat label="Window rating" value={(windowStats?.avg_rating_window ?? 0).toFixed(1)} />
              <MiniStat label="Level score" value={String(Math.round(profile?.level_score ?? 0))} />
            </div>
          </section>
        </div>

        {/* Right: leaderboard */}
        <aside className="space-y-6">
          <section className="rounded-2xl bg-gradient-to-br from-neutral-900 to-neutral-800 p-6 text-white shadow-md">
            <h2 className="flex items-center gap-2 text-lg font-bold">
              <Trophy className="h-5 w-5 text-amber-400" /> Top Creators
            </h2>
            <ul className="mt-4 space-y-3">
              {(leaderboard ?? []).map(entry => (
                <li key={entry.user_id} className="flex items-center gap-3">
                  <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-sm font-bold ${
                    entry.rank === 1 ? "bg-amber-400 text-neutral-900" :
                    entry.rank === 2 ? "bg-neutral-300 text-neutral-800" :
                    entry.rank === 3 ? "bg-amber-700 text-white" :
                    "bg-white/10 text-white/60"
                  }`}>
                    {entry.rank}
                  </span>
                  <div className="min-w-0 flex-1">
                    <Link href={`/profile/${entry.user_id}`} className="block truncate text-sm font-semibold hover:text-amber-300">
                      {entry.user_name}
                    </Link>
                    <p className="text-xs text-white/50">
                      {entry.level_score} pts · {entry.published_challenges} ch · {entry.followers} followers
                    </p>
                  </div>
                  {entry.verified && <ShieldCheck className="h-4 w-4 shrink-0 text-emerald-400" />}
                </li>
              ))}
              {(leaderboard ?? []).length === 0 && (
                <p className="text-sm text-white/50">The creator leaderboard is waiting for its first hero.</p>
              )}
            </ul>
          </section>

          {/* Quick actions */}
          <section className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-neutral-200/60">
            <h2 className="flex items-center gap-2 text-lg font-bold text-neutral-900">
              <BookOpen className="h-5 w-5 text-primary-600" /> Quick Actions
            </h2>
            <div className="mt-4 space-y-2">
              <Link href="/challenges" className="block rounded-xl bg-neutral-50 px-4 py-3 text-sm font-semibold text-neutral-700 transition-colors hover:bg-primary-50 hover:text-primary-700">
                ➕ Create a challenge
              </Link>
              <Link href="/skills" className="block rounded-xl bg-neutral-50 px-4 py-3 text-sm font-semibold text-neutral-700 transition-colors hover:bg-primary-50 hover:text-primary-700">
                📊 My skill graph
              </Link>
              <Link href="/activity" className="block rounded-xl bg-neutral-50 px-4 py-3 text-sm font-semibold text-neutral-700 transition-colors hover:bg-primary-50 hover:text-primary-700">
                ⚡ Recent activity
              </Link>
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}

function StatCard({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: string; sub: string }) {
  return (
    <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-neutral-200/60">
      <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-neutral-100 text-neutral-600">{icon}</span>
      <p className="mt-3 text-2xl font-bold text-neutral-900">{value}</p>
      <p className="text-sm font-semibold text-neutral-800">{label}</p>
      <p className="truncate text-xs text-neutral-400">{sub}</p>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-neutral-50 p-3">
      <p className="text-xl font-bold text-neutral-900">{value}</p>
      <p className="text-xs font-medium text-neutral-400">{label}</p>
    </div>
  );
}