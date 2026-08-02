"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { CreatorProfile, Skill, ActivityEvent, Challenge } from "@/types/community";

/* ---------- Shared helpers ---------- */

function fmt(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return `${n}`;
}

function pct(n: number): string {
  return `${Math.round(n * 100)}%`;
}

/* ============================================================
   SKILL IDENTITY + AI INSIGHTS
   ============================================================ */

interface SkillIdentityProps {
  skills: Skill[];
}

export function SkillIdentity({ skills }: SkillIdentityProps) {
  const sorted = useMemo(() => [...skills].sort((a, b) => b.mastery_score - a.mastery_score), [skills]);
  const weakest = useMemo(() => [...skills].sort((a, b) => a.mastery_score - b.mastery_score).slice(0, 3), [skills]);
  const mostPracticed = useMemo(() => [...skills].sort((a, b) => b.attempts - a.attempts).slice(0, 3), [skills]);

  const fastestGrowing = useMemo(() => {
    return [...skills]
      .map((s) => {
        const h = s.recent_history || [];
        if (h.length < 2) return { ...s, growth: 0 };
        const first = h[0]?.score ?? s.mastery_score;
        const last = h[h.length - 1]?.score ?? s.mastery_score;
        return { ...s, growth: last - first };
      })
      .sort((a, b) => b.growth - a.growth)
      .slice(0, 3);
  }, [skills]);

  /* ---- AI-generated narrative from real data ---- */
  const insights = useMemo(() => {
    const list: string[] = [];
    if (sorted.length >= 2) {
      const top = sorted[0];
      const low = weakest[0];
      if (top && low && top.skill_id !== low.skill_id) {
        list.push(
          `You consistently perform well in ${top.name} but are building momentum in ${low.name} — a focused session there will balance your skill graph.`
        );
      }
    }
    if (fastestGrowing.length > 0 && fastestGrowing[0].growth > 0) {
      const f = fastestGrowing[0];
      list.push(`${f.name} is your fastest-growing skill (+${f.growth} points). Keep the same practice pattern for ${sorted[0]?.name || "your next skill"}.`);
    }
    const practiced = mostPracticed[0];
    if (practiced) {
      list.push(`Most practiced: ${practiced.name} (${practiced.attempts} attempts). Consistency is the strongest predictor of long-term mastery.`);
    }
    if (list.length === 0) {
      list.push("Solve a few more challenges in a skill family and your AI insight will appear here.");
    }
    return list.slice(0, 3);
  }, [sorted, weakest, fastestGrowing, mostPracticed]);

  if (skills.length === 0) {
    return (
      <section className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-neutral-200/60">
        <SectionTitle>🧠 Skill Identity</SectionTitle>
        <p className="mt-3 text-sm text-neutral-500">
          No skill data yet. Complete challenges to build your interactive skill graph.
        </p>
      </section>
    );
  }

  return (
    <section className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-neutral-200/60">
      <SectionTitle>🧠 Skill Identity</SectionTitle>

      {/* AI insights */}
      <div className="mt-4 rounded-xl bg-gradient-to-br from-primary-50 to-cyan-50 p-4 ring-1 ring-primary-100">
        <p className="text-xs font-bold uppercase tracking-wide text-primary-700">✦ AI Insights</p>
        <ul className="mt-2 space-y-2">
          {insights.map((ins, i) => (
            <li key={i} className="flex gap-2 text-sm text-neutral-700">
              <span className="mt-0.5 shrink-0 text-primary-600">•</span>
              {ins}
            </li>
          ))}
        </ul>
      </div>

      {/* Skill bars */}
      <div className="mt-5 space-y-3">
        {sorted.slice(0, 6).map((s) => (
          <SkillBar key={s.skill_id} skill={s} />
        ))}
      </div>

      {/* Quick insights */}
      <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <MiniList title="🔻 Weakest" items={weakest.map((s) => s.name)} />
        <MiniList title="⚡ Fastest growing" items={fastestGrowing.filter((s) => s.growth > 0).map((s) => `${s.name} +${s.growth}`)} empty="Track a few sessions…" />
        <MiniList title="🏋️ Most practiced" items={mostPracticed.map((s) => `${s.name} (${s.attempts})`)} />
      </div>
    </section>
  );
}

function SkillBar({ skill }: { skill: Skill }) {
  const [hover, setHover] = useState(false);
  const confidence = skill.consistency_score ?? 0;
  const level = skill.level || "beginner";

  return (
    <div
      className="group relative flex items-center gap-3"
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <span className="w-40 shrink-0 truncate text-sm font-medium text-neutral-800 sm:w-48">{skill.name}</span>
      <div className="relative h-2.5 flex-1 overflow-hidden rounded-full bg-neutral-100" role="progressbar" aria-valuenow={Math.round(skill.mastery_score)} aria-valuemin={0} aria-valuemax={100}>
        <div className={`h-full rounded-full bg-gradient-to-r ${levelColor(level)} transition-all duration-500`} style={{ width: `${skill.mastery_score}%` }} />
      </div>
      <span className="w-12 shrink-0 text-right text-xs font-semibold text-neutral-600">{Math.round(skill.mastery_score)}%</span>
      {hover && (
        <div className="absolute right-0 top-full z-10 mt-1 w-52 rounded-lg bg-neutral-900 px-3 py-2 text-xs text-white shadow-lg">
          <p><span className="text-neutral-400">Level:</span> {level}</p>
          <p><span className="text-neutral-400">Confidence:</span> {pct(confidence)}</p>
          <p><span className="text-neutral-400">Attempts:</span> {skill.attempts}</p>
          <p><span className="text-neutral-400">Correct:</span> {skill.correct_count}</p>
        </div>
      )}
    </div>
  );
}

function levelColor(level: string): string {
  switch (level) {
    case "expert": return "from-fuchsia-500 to-purple-500";
    case "advanced": return "from-cyan-500 to-sky-500";
    case "intermediate": return "from-emerald-500 to-teal-500";
    default: return "from-amber-500 to-orange-500";
  }
}

function MiniList({ title, items, empty }: { title: string; items: string[]; empty?: string }) {
  return (
    <div className="rounded-xl bg-neutral-50 p-3">
      <p className="text-[11px] font-bold uppercase tracking-wide text-neutral-400">{title}</p>
      {items.length > 0 ? (
        <ul className="mt-1.5 space-y-1">
          {items.map((it, i) => (
            <li key={i} className="truncate text-sm text-neutral-700">{it}</li>
          ))}
        </ul>
      ) : (
        <p className="mt-1.5 text-sm text-neutral-400">{empty || "No data yet"}</p>
      )}
    </div>
  );
}

/* ============================================================
   CONTRIBUTION CALENDAR (GitHub-style)
   ============================================================ */

interface ContributionsProps {
  events: ActivityEvent[];
}

export function ContributionCalendar({ events }: ContributionsProps) {
  const weeks = useMemo(() => buildWeeks(events), [events]);
  const [active, setActive] = useState<{ date: string; count: number; items: string[] } | null>(null);

  return (
    <section className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-neutral-200/60">
      <SectionTitle>📅 91-Day Contribution Graph</SectionTitle>
      <div className="mt-4 text-sm font-semibold text-neutral-700">
        {totalContribs(events)} contributions in the last 91 days
      </div>

      <div className="mt-3 overflow-y-auto">
        <div className="flex gap-1" role="table" aria-label="Contribution calendar">
          {weeks.map((week, w) => (
            <div key={w} className="flex flex-col gap-1" role="row">
              {week.map((day) => (
                <button
                  key={day.date}
                  onMouseEnter={() => setActive(day.count > 0 ? day : null)}
                  onFocus={() => setActive(day.count > 0 ? day : null)}
                  onBlur={() => setActive(null)}
                  onClick={() => setActive(day)}
                  className={`h-3 w-3 rounded-[3px] ${dayColor(day.count)} transition-transform hover:scale-125 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-400`}
                  aria-label={`${day.date}: ${day.count} contributions`}
                />
              ))}
            </div>
          ))}
        </div>
      </div>

      {active && (
        <div className="mt-3 rounded-lg bg-neutral-100 px-3 py-2 text-sm">
          <p className="font-semibold text-neutral-800">{active.date} — {fmt(active.count)} contribution{active.count !== 1 ? "s" : ""}</p>
          <p className="mt-0.5 line-clamp-1 text-xs text-neutral-500">{active.items.join(" · ")}</p>
        </div>
      )}
    </section>
  );
}

function dayColor(count: number): string {
  if (count === 0) return "bg-neutral-100";
  if (count < 2) return "bg-primary-200";
  if (count < 4) return "bg-primary-400";
  if (count < 7) return "bg-primary-600";
  return "bg-primary-800";
}

function buildWeeks(events: ActivityEvent[]): { date: string; count: number; items: string[] }[][] {
  const end = new Date();
  const start = new Date(end);
  start.setDate(end.getDate() - 90);
  const map = new Map<string, { count: number; items: string[] }>();

  for (const ev of events) {
    const d = new Date(ev.created_at);
    if (Number.isNaN(d.getTime()) || d < start || d > end) continue;
    const key = d.toISOString().slice(0, 10);
    const cur = map.get(key) || { count: 0, items: [] };
    cur.count += 1;
    if (cur.items.length < 3) cur.items.push(ev.label || ev.type);
    map.set(key, cur);
  }

  const weeks: { date: string; count: number; items: string[] }[][] = [];
  const cur = new Date(start);
  while (cur <= end) {
    const week: { date: string; count: number; items: string[] }[] = [];
    for (let i = 0; i < 7; i++) {
      const date = cur.toISOString().slice(0, 10);
      week.push({ date, count: map.get(date)?.count || 0, items: map.get(date)?.items || [] });
      cur.setDate(cur.getDate() + 1);
      if (cur > end) break;
    }
    weeks.push(week);
  }
  return weeks;
}

function totalContribs(events: ActivityEvent[]): number {
  const start = Date.now() - 91 * 86400000;
  return events.filter((e) => new Date(e.created_at).getTime() >= start).length;
}

/* ============================================================
   ANALYTICS
   ============================================================ */

interface AnalyticsProps {
  challenges: Challenge[];
  skills: Skill[];
}

export function ProfileAnalytics({ challenges, skills }: AnalyticsProps) {
  const solved = challenges.filter((c) => c.status === "published").length;
  const avgRating = challenges.length ? challenges.reduce((a, c) => a + (c.stats?.avg_rating || 0), 0) / challenges.length : 0;
  const avgCompletion = challenges.length ? challenges.reduce((a, c) => a + (c.stats?.completion_rate || 0), 0) / challenges.length : 0;
  const avgTime = skills.length ? skills.reduce((a, s) => a + (s.avg_time_seconds || 0), 0) / Math.max(1, skills.filter((s) => s.avg_time_seconds).length) : 0;
  const accuracy = skills.length ? Math.round((skills.reduce((a, s) => a + s.correct_count, 0) / Math.max(1, skills.reduce((a, s) => a + s.attempts, 0))) * 100) : 0;

  const favCategories = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const c of challenges) {
      counts[c.topic || c.domain || "General"] = (counts[c.topic || c.domain || "General"] || 0) + 1;
    }
    return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 5);
  }, [challenges]);

  return (
    <section className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-neutral-200/60">
      <SectionTitle>📊 Profile Analytics</SectionTitle>
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Stat label="Challenges" value={fmt(solved)} />
        <Stat label="Avg rating" value={avgRating ? `★ ${avgRating.toFixed(1)}` : "—"} />
        <Stat label="Completion" value={pct(avgCompletion)} />
        <Stat label="Avg solve time" value={avgTime ? `${Math.round(avgTime / 60)}m` : "—"} />
        <Stat label="Accuracy" value={`${accuracy}%`} />
        <Stat label="Skills" value={fmt(skills.length)} />
      </div>
      {favCategories.length > 0 && (
        <div className="mt-4">
          <p className="text-[11px] font-bold uppercase tracking-wide text-neutral-400">Favorite technologies</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {favCategories.map(([cat, count]) => (
              <span key={cat} className="rounded-full bg-neutral-100 px-3 py-1 text-sm text-neutral-700">
                {cat} <span className="text-neutral-400">· {count}</span>
              </span>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-neutral-50 p-3 text-center">
      <p className="text-base font-bold text-neutral-900">{value}</p>
      <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-wider text-neutral-400">{label}</p>
    </div>
  );
}

/* ============================================================
   CREATOR SHOWCASE
   ============================================================ */

interface CreatorShowcaseProps {
  profile: CreatorProfile;
  challenges: Challenge[];
  showEmpty: boolean;
}

export function CreatorShowcase({ profile, challenges, showEmpty }: CreatorShowcaseProps) {
  if (!showEmpty && challenges.length === 0) return null;

  return (
    <section className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-neutral-200/60">
      <SectionTitle>👑 Creator Profile</SectionTitle>

      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <CreatorStat label="Creator level" value={profile.level || "—"} />
        <CreatorStat label="Published" value={fmt(profile.published_challenges ?? 0)} />
        <CreatorStat label="Avg rating" value={profile.avg_rating ? `★ ${profile.avg_rating.toFixed(1)}` : "—"} />
        <CreatorStat label="Avg completion" value={profile.avg_completion_rate ? pct(profile.avg_completion_rate) : "—"} />
      </div>

      {challenges.length > 0 && (
        <div className="mt-5">
          <p className="text-[11px] font-bold uppercase tracking-wide text-neutral-400">Featured challenges</p>
          <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-2">
            {challenges.slice(0, 4).map((c) => (
              <Link
                key={c._id}
                href={`/challenges/${c._id}`}
                className="group rounded-xl border border-neutral-200 p-4 transition-all hover:border-primary-300 hover:shadow-md"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="rounded-full bg-neutral-100 px-2.5 py-0.5 text-xs font-semibold capitalize text-neutral-700">{c.difficulty}</span>
                  <span className="text-xs text-neutral-400">★ {c.stats?.avg_rating?.toFixed(1) || "—"}</span>
                </div>
                <p className="mt-2 line-clamp-2 font-semibold text-neutral-900 group-hover:text-primary-800">{c.title}</p>
                <p className="mt-1 text-xs text-neutral-500">
                  {pct(c.stats?.completion_rate || 0)} completion · {fmt(c.stats?.attempts || 0)} attempts · Q {c.quality_score?.toFixed(1) ?? "—"}
                </p>
              </Link>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

function CreatorStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-neutral-50 p-3 text-center">
      <p className="text-base font-bold text-neutral-900">{value}</p>
      <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-wider text-neutral-400">{label}</p>
    </div>
  );
}

/* ============================================================
   ACTIVITY TIMELINE
   ============================================================ */

interface ActivityTimelineProps {
  events: ActivityEvent[];
  limit?: number;
}

const EVENT_ICONS: Record<string, string> = {
  solve: "✅",
  challenge_solved: "✅",
  create: "📝",
  challenge_created: "📝",
  publish: "🚀",
  challenge_published: "🚀",
  achievement: "🏆",
  badge: "🏅",
  follow: "👤",
  discussion: "💬",
  review: "⭐",
  answer: "🤝",
  mentor: "🎓",
  competition: "⚔️",
  streak: "🔥",
};

export function ActivityTimeline({ events, limit = 10 }: ActivityTimelineProps) {
  const list = useMemo(() => [...events].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).slice(0, limit), [events, limit]);

  if (list.length === 0) {
    return (
      <section className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-neutral-200/60">
        <SectionTitle>⚡ Activity</SectionTitle>
        <p className="mt-3 text-sm text-neutral-500">No public activity yet. Solve challenges to start your timeline.</p>
      </section>
    );
  }

  return (
    <section className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-neutral-200/60">
      <SectionTitle>⚡ Recent Activity</SectionTitle>
      <ol className="relative mt-4 ml-3 border-l-2 border-neutral-100">
        {list.map((ev) => (
          <li key={ev.id} className="relative mb-4 pl-5 last:mb-0">
            <span className="absolute -left-px top-0.5 flex h-6 w-6 -translate-x-1/2 items-center justify-center rounded-full bg-white text-sm ring-1 ring-neutral-200">
              {EVENT_ICONS[ev.type] || "•"}
            </span>
            <div className="min-w-0">
              <p className="text-sm text-neutral-700">{ev.label || ev.type}</p>
              <p className="text-xs text-neutral-400">{timeAgoShort(ev.created_at)}</p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}

function timeAgoShort(iso: string): string {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  if (s < 2592000) return `${Math.floor(s / 86400)}d ago`;
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

/* ---------- Section title ---------- */

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="text-sm font-bold uppercase tracking-wide text-neutral-400">{children}</h2>;
}