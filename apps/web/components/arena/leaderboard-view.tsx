"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Trophy, Users, Swords, Zap, Globe, Building2, GraduationCap, Flame } from "lucide-react";
import { communityApi } from "@/lib/community-api";
import type { ArenaLeaderboardData, ArenaLiveBattle, ArenaPlayer } from "@/types/community";

/* ── Rank styling ── */
const RANK_STYLES: Record<string, { chip: string; text: string; bar: string }> = {
  Bronze: { chip: "bg-orange-100 text-orange-800 ring-orange-200", text: "text-orange-700", bar: "from-orange-500 to-orange-700" },
  Silver: { chip: "bg-neutral-200 text-neutral-700 ring-neutral-300", text: "text-neutral-600", bar: "from-neutral-400 to-neutral-600" },
  Gold: { chip: "bg-amber-100 text-amber-800 ring-amber-200", text: "text-amber-700", bar: "from-amber-400 to-amber-600" },
  Platinum: { chip: "bg-cyan-100 text-cyan-800 ring-cyan-200", text: "text-cyan-700", bar: "from-cyan-400 to-cyan-600" },
  Diamond: { chip: "bg-sky-100 text-sky-800 ring-sky-200", text: "text-sky-700", bar: "from-sky-400 to-sky-600" },
  Master: { chip: "bg-violet-100 text-violet-800 ring-violet-200", text: "text-violet-700", bar: "from-violet-400 to-violet-600" },
  Grandmaster: { chip: "bg-fuchsia-100 text-fuchsia-800 ring-fuchsia-200", text: "text-fuchsia-700", bar: "from-fuchsia-500 to-fuchsia-700" },
  Legend: { chip: "bg-orange-100 text-orange-800 ring-orange-300", text: "text-orange-800", bar: "from-orange-500 via-red-500 to-orange-600" },
  Mythic: { chip: "bg-rose-100 text-rose-800 ring-rose-300", text: "text-rose-800", bar: "from-rose-500 via-purple-500 to-rose-600" },
  Immortal: { chip: "bg-gradient-to-r from-red-500 to-purple-600 text-white ring-transparent", text: "text-transparent bg-clip-text bg-gradient-to-r from-red-500 to-purple-600", bar: "from-red-500 via-purple-500 to-indigo-600" },
};

function rankChip(rank: string) {
  return RANK_STYLES[rank] ?? RANK_STYLES.Bronze;
}

function initials(name: string) {
  return name.split(" ").slice(0, 2).map((p) => p[0]).join("").toUpperCase() || "?";
}

function fmt(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return `${n}`;
}

/* ── Tab helper ── */
function useTabs<T extends string>(initial: T) {
  const [tab, setTab] = useState<T>(initial);
  return { tab, setTab };
}

const SCOPES = [
  { id: "global", label: "Global", icon: Globe },
  { id: "country", label: "Country", icon: Building2 },
  { id: "company", label: "Company", icon: Building2 },
  { id: "university", label: "Universities", icon: GraduationCap },
] as const;

const PERIODS = [
  { id: "all", label: "All Time", icon: Trophy },
  { id: "week", label: "This Week", icon: Flame },
  { id: "month", label: "This Month", icon: Zap },
] as const;

export default function LeaderboardView() {
  const { tab: scope, setTab: setScope } = useTabs<(typeof SCOPES)[number]["id"]>("global");
  const { tab: period, setTab: setPeriod } = useTabs<(typeof PERIODS)[number]["id"]>("all");
  const [data, setData] = useState<ArenaLeaderboardData | null>(null);
  const [live, setLive] = useState<ArenaLiveBattle[]>([]);
  const [stats, setStats] = useState<{ battles_today: number; players_total: number; matches_total: number; live_battles: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [board, liveData, statsData] = await Promise.all([
        communityApi.getArenaLeaderboard({ scope, period, limit: 50 }),
        communityApi.getArenaLive(6),
        communityApi.getArenaStats().catch(() => null),
      ]);
      setData(board);
      setLive(liveData.battles);
      setStats(statsData);
    } catch (e: any) {
      setError(e?.message || "Failed to load the Arena");
    } finally {
      setLoading(false);
    }
  }, [scope, period]);

  useEffect(() => { load(); }, [load]);

  const players = data?.players ?? [];

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      {/* Hero */}
      <div className="rounded-3xl bg-gradient-to-br from-neutral-900 via-neutral-800 to-primary-900 p-8 text-white shadow-lg sm:p-10">
        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-white/60">
          <Swords className="h-4 w-4" /> Competitive Arena
        </div>
        <h1 className="mt-3 text-3xl font-bold sm:text-4xl">Prove yourself. Climb the ladder.</h1>
        <p className="mt-2 max-w-2xl text-sm text-white/75 sm:text-base">
          Rating measures competitive skill. XP measures effort. The Arena ranks both — every battle tells a story.
        </p>
      </div>

      {/* Stats strip */}
      <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: "Battles today", value: stats?.battles_today },
          { label: "Total players", value: stats?.players_total },
          { label: "Total matches", value: stats?.matches_total },
          { label: "Live battles", value: stats?.live_battles },
        ].map((s) => (
          <div key={s.label} className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-neutral-200/60">
            <p className="text-2xl font-bold text-neutral-900">
              {s.value === undefined ? <span className="inline-block h-6 w-10 animate-pulse rounded bg-neutral-100" /> : fmt(s.value ?? 0)}
            </p>
            <p className="mt-0.5 text-xs font-medium text-neutral-400">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Leaderboard */}
        <section className="lg:col-span-2">
          <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-neutral-200/60 sm:p-6">
            {/* Header */}
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <h2 className="flex items-center gap-2 text-lg font-bold text-neutral-900">
                <Trophy className="h-5 w-5 text-amber-500" /> Leaderboard
              </h2>
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-neutral-100 px-3 py-1 text-sm font-medium text-neutral-500">
                  {data?.my_rank ? `You're #${data.my_rank}` : "Sign in to track your rank"}
                </span>
              </div>
            </div>

            {/* Scope tabs */}
            <div className="mt-4 flex flex-wrap gap-2" role="tablist" aria-label="Leaderboard scope">
              {SCOPES.map((s) => (
                <button
                  key={s.id}
                  role="tab"
                  aria-selected={scope === s.id}
                  onClick={() => setScope(s.id)}
                  className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-semibold transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-400 ${
                    scope === s.id ? "bg-neutral-900 text-white shadow" : "bg-neutral-100 text-neutral-500 hover:bg-neutral-200"
                  }`}
                >
                  <s.icon className="h-3.5 w-3.5" /> {s.label}
                </button>
              ))}
            </div>

            {/* Period tabs */}
            <div className="mt-3 flex flex-wrap gap-2" role="tablist" aria-label="Leaderboard period">
              {PERIODS.map((p) => (
                <button
                  key={p.id}
                  role="tab"
                  aria-selected={period === p.id}
                  onClick={() => setPeriod(p.id)}
                  className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-400 ${
                    period === p.id ? "bg-primary-600 text-white shadow" : "bg-neutral-50 text-neutral-500 ring-1 ring-neutral-200 hover:bg-neutral-100"
                  }`}
                >
                  <p.icon className="h-3 w-3" /> {p.label}
                </button>
              ))}
            </div>

            {/* Podium */}
            {!loading && players.length >= 3 && (
              <div className="mt-6 grid grid-cols-3 gap-2 sm:gap-3">
                {[1, 0, 2].map((idx) => {
                  const p = players[idx];
                  const style = rankChip(p.rank);
                  return (
                    <Link
                      key={p.user_id}
                      href={`/profile/${p.user_id}`}
                      className={`group rounded-2xl border p-3 text-center transition-all hover:-translate-y-0.5 hover:shadow-lg sm:p-4 ${idx === 0 ? "border-amber-200 bg-gradient-to-b from-amber-50 to-white" : idx === 1 ? "border-neutral-200 bg-gradient-to-b from-neutral-50 to-white" : "border-orange-200 bg-gradient-to-b from-orange-50 to-white"}`}
                    >
                      <div className="text-xl sm:text-2xl">{["🥇", "🥈", "🥉"][idx]}</div>
                      <div className={`mx-auto mt-2 flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br ${style.bar} text-xs font-bold text-white sm:h-10 sm:w-10 sm:text-sm`}>
                        {initials(p.user_name || p.user_id)}
                      </div>
                      <p className="mt-2 truncate text-xs font-bold text-neutral-900 sm:text-sm">{p.user_name || "Anonymous"}</p>
                      <p className={`text-xs font-bold ${style.text}`}>{p.rating}</p>
                      <p className="mt-0.5 text-[10px] text-neutral-400">
                        {p.country || p.company || p.university || "—"} · {p.wins}W
                      </p>
                    </Link>
                  );
                })}
              </div>
            )}

            {/* Rows */}
            <div className="mt-6 space-y-1">
              {loading ? (
                Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-3 rounded-xl p-3">
                    <div className="h-6 w-6 animate-pulse rounded bg-neutral-100" />
                    <div className="h-8 w-8 animate-pulse rounded-full bg-neutral-100" />
                    <div className="flex-1 space-y-1.5">
                      <div className="h-3 w-1/3 animate-pulse rounded bg-neutral-100" />
                      <div className="h-2.5 w-1/4 animate-pulse rounded bg-neutral-100" />
                    </div>
                    <div className="h-4 w-12 animate-pulse rounded bg-neutral-100" />
                  </div>
                ))
              ) : error ? (
                <div className="rounded-xl bg-red-50 p-6 text-center text-sm text-red-600">
                  {error}
                  <button onClick={load} className="mt-3 rounded-full bg-red-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-red-700">
                    Retry
                  </button>
                </div>
              ) : players.length === 0 ? (
                <div className="rounded-xl bg-neutral-50 p-10 text-center">
                  <Trophy className="mx-auto h-8 w-8 text-neutral-300" />
                  <p className="mt-3 text-sm font-medium text-neutral-500">No competitive players yet.</p>
                  <p className="mt-1 text-xs text-neutral-400">The first battle will write history. Be the first.</p>
                  <Link href="/challenges" className="mt-4 inline-block rounded-full bg-neutral-900 px-5 py-2 text-sm font-semibold text-white hover:bg-neutral-800">
                    Start a challenge
                  </Link>
                </div>
              ) : (
                players.map((p, i) => <LeaderboardRow key={p.user_id} p={p} rank={i + 1} myRank={data?.my_rank === i + 1} />)
              )}
            </div>
          </div>
        </section>

        {/* Live battles sidebar */}
        <aside className="space-y-6">
          <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-neutral-200/60">
            <h2 className="flex items-center gap-2 text-lg font-bold text-neutral-900">
              <Swords className="h-5 w-5 text-primary-600" /> Live Battles
            </h2>
            {live.length === 0 ? (
              <p className="mt-3 text-sm text-neutral-400">No public battles in the lobby right now. Create one from any challenge.</p>
            ) : (
              <div className="mt-4 space-y-3">
                {live.map((b) => (
                  <div key={b.id} className="rounded-xl border border-neutral-200 p-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-bold text-neutral-900">{b.topic}</span>
                      <span className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${b.status === "live" ? "bg-emerald-50 text-emerald-600 ring-1 ring-emerald-200" : "bg-amber-50 text-amber-600 ring-1 ring-amber-200"}`}>
                        <span className={`h-1.5 w-1.5 animate-pulse rounded-full ${b.status === "live" ? "bg-emerald-500" : "bg-amber-500"}`} />
                        {b.status}
                      </span>
                    </div>
                    <div className="mt-3 flex items-center gap-2">
                      {b.participants.slice(0, 2).map((part) => (
                        <div key={part.user_id} className="flex items-center gap-1.5 rounded-full bg-neutral-100 px-2.5 py-1 text-xs font-medium text-neutral-600">
                          <span className="h-4 w-4 rounded-full bg-neutral-800 text-[9px] font-bold text-white flex items-center justify-center">
                            {initials(part.user_name)}
                          </span>
                          {part.user_name}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="rounded-2xl bg-gradient-to-br from-primary-700 to-cyan-700 p-6 text-white shadow-md">
            <div className="flex items-center gap-2 text-sm font-bold">
              <Users className="h-4 w-4 text-white/80" /> How the Arena works
            </div>
            <ul className="mt-3 space-y-2 text-sm text-white/80">
              <li>• Solve challenges head-to-head</li>
              <li>• Win → rating rises, lose → rating adjusts</li>
              <li>• First 20 matches are provisional (faster gains)</li>
              <li>• Season points track your streak of dominance</li>
            </ul>
            <Link href="/challenges" className="mt-4 inline-flex items-center gap-1 rounded-full bg-white/15 px-4 py-2 text-sm font-semibold text-white ring-1 ring-white/25 transition-all hover:bg-white/25">
              <Zap className="h-3.5 w-3.5" /> Enter the Arena
            </Link>
          </section>
        </aside>
      </div>
    </div>
  );
}

function LeaderboardRow({ p, rank, myRank }: { p: ArenaPlayer; rank: number; myRank: boolean }) {
  const style = rankChip(p.rank);
  return (
    <Link
      href={`/profile/${p.user_id}`}
      className={`group flex items-center gap-3 rounded-xl p-3 transition-all hover:bg-neutral-50 hover:shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-400 ${myRank ? "bg-primary-50/60 ring-1 ring-primary-200" : ""}`}
    >
      <span className={`w-7 text-center text-sm font-bold ${rank <= 3 ? "text-transparent bg-clip-text bg-gradient-to-br from-amber-500 to-orange-600" : "text-neutral-400"}`}>
        {rank <= 3 ? ["🥇", "🥈", "🥉"][rank - 1] : `#${rank}`}
      </span>
      <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br ${style.bar} text-xs font-bold text-white`}>
        {initials(p.user_name || p.user_id)}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-neutral-900 group-hover:text-primary-800">
          {p.user_name || "Anonymous"}
          {myRank && <span className="ml-2 rounded-full bg-primary-100 px-2 py-0.5 text-[10px] font-bold text-primary-700">YOU</span>}
        </p>
        <p className="truncate text-xs text-neutral-400">
          {p.wins}W · {p.losses}L{p.provisional && " · provisional"}
        </p>
      </div>
      <div className="text-right">
        <p className={`text-sm font-bold ${style.text}`}>{p.rating}</p>
        <p className={`mt-0.5 rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 ${style.chip}`}>{p.rank}</p>
      </div>
    </Link>
  );
}