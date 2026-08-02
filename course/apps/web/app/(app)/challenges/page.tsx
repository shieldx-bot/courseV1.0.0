"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import Link from "next/link";
import { communityApi } from "@/lib/community-api";
import type { Challenge, Skill } from "@/types/community";
import { useToast } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

/* ---------- Difficulty / visual config ---------- */

const DIFFICULTY_META: Record<string, { label: string; badge: string; chip: string; xp: number }> = {
  easy: { label: "Easy", badge: "bg-emerald-100 text-emerald-700", chip: "border-emerald-200 text-emerald-700 hover:bg-emerald-50", xp: 50 },
  medium: { label: "Medium", badge: "bg-amber-100 text-amber-700", chip: "border-amber-200 text-amber-700 hover:bg-amber-50", xp: 100 },
  hard: { label: "Hard", badge: "bg-rose-100 text-rose-700", chip: "border-rose-200 text-rose-700 hover:bg-rose-50", xp: 150 },
  expert: { label: "Expert", badge: "bg-purple-100 text-purple-700", chip: "border-purple-200 text-purple-700 hover:bg-purple-50", xp: 250 },
};

const DIFFICULTIES = ["easy", "medium", "hard", "expert"] as const;

const SOURCE_META: Record<string, { label: string; icon: string }> = {
  ai: { label: "AI generated", icon: "🤖" },
  user: { label: "Community", icon: "👤" },
  mentor: { label: "Mentor", icon: "🎓" },
};

const TYPE_LABELS: Record<string, string> = {
  theory: "Theory",
  scenario: "Scenario",
  lab: "Lab",
  quiz: "Quiz",
};

const PER_PAGE = 12;

type ViewKey = "all" | "for-you" | "popular" | "newest" | "rated" | "saved" | "mine";

/** Estimated minutes per difficulty — used when a challenge has no explicit duration. */
const EST_DA_MIN: Record<string, number> = { easy: 10, medium: 20, hard: 35, expert: 60 };

const VIEWS: { key: ViewKey; label: string; icon: string }[] = [
  { key: "all", label: "All challenges", icon: "🗂️" },
  { key: "for-you", label: "✨ For you", icon: "" },
  { key: "popular", label: "🔥 Trending", icon: "" },
  { key: "newest", label: "🆕 New", icon: "" },
  { key: "rated", label: "🏆 Top rated", icon: "" },
  { key: "saved", label: "🔖 Saved", icon: "" },
  { key: "mine", label: "📝 Mine", icon: "" },
];

/** View → API sort mapping (static — must stay at module scope). */
const VIEW_SORT: Record<ViewKey, string> = {
  all: "newest", // overridden by sort state at runtime
  "for-you": "popular",
  popular: "popular",
  newest: "newest",
  rated: "rating",
  saved: "popular",
  mine: "newest",
};

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return `${n}`;
}

function estMinutes(c: Challenge): number {
  return (c as any).estimated_minutes || EST_DA_MIN[c.difficulty] || 20;
}

function xpReward(c: Challenge): number {
  return (c as any).xp_reward || DIFFICULTY_META[c.difficulty]?.xp || 100;
}

/* ---------- Reusable challenge card ---------- */

function ChallengeCard({
  c,
  bookmarked,
  onToggleBookmark,
}: {
  c: Challenge;
  bookmarked: boolean;
  onToggleBookmark: (e: React.MouseEvent, id: string) => void;
}) {
  const diff = DIFFICULTY_META[c.difficulty] || DIFFICULTY_META.medium;
  const source = SOURCE_META[c.source] || SOURCE_META.user;
  const completion = Math.round((c.stats?.completion_rate || 0) * 100);
  const typeLabel = TYPE_LABELS[c.type] || c.type;

  return (
    <Link
      href={`/challenges/${c._id}`}
      className="group relative flex flex-col rounded-2xl border border-neutral-200 bg-white p-5 transition-all duration-200 hover:-translate-y-0.5 hover:border-primary-300 hover:shadow-lg hover:shadow-primary-100/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
    >
      <div className="flex items-center justify-between gap-2">
        <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${diff.badge}`}>
          {diff.label}
        </span>
        <div className="flex items-center gap-2">
          {c.status === "draft" && (
            <span className="rounded-full bg-orange-100 px-2 py-0.5 text-xs font-medium text-orange-600">Draft</span>
          )}
          <span className="text-xs text-neutral-400" title={`${source.label}`}>
            {source.icon}
          </span>
          <button
            type="button"
            onClick={(e) => onToggleBookmark(e, c._id)}
            className={`text-lg leading-none transition-all duration-150 ${
              bookmarked ? "text-amber-500 hover:scale-110" : "text-neutral-300 hover:scale-110 hover:text-amber-400"
            }`}
            aria-label={bookmarked ? "Remove bookmark" : "Bookmark challenge"}
          >
            {bookmarked ? "★" : "☆"}
          </button>
        </div>
      </div>

      <h3 className="mt-3 line-clamp-2 text-[15px] font-semibold leading-snug text-neutral-900 group-hover:text-primary-800">
        {c.title}
      </h3>
      <p className="mt-1.5 line-clamp-2 text-sm text-neutral-500">{c.description}</p>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {c.skills_raw?.slice(0, 3).map((s: string, i: number) => (
          <span key={i} className="rounded-full bg-primary-50 px-2 py-0.5 text-[11px] font-medium text-primary-700">
            {s}
          </span>
        ))}
        {typeLabel && c.type !== "theory" && (
          <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-[11px] font-medium text-neutral-600">
            {typeLabel}
          </span>
        )}
      </div>

      <div className="mt-4 grid grid-cols-4 gap-2 border-t border-neutral-100 pt-3 text-center">
        <div>
          <p className="text-sm font-bold text-neutral-900">{formatNumber(c.stats?.attempts || 0)}</p>
          <p className="text-[10px] uppercase tracking-wide text-neutral-400">Attempts</p>
        </div>
        <div>
          <p className="text-sm font-bold text-emerald-600">{completion}%</p>
          <p className="text-[10px] uppercase tracking-wide text-neutral-400">Win rate</p>
        </div>
        <div>
          <p className="text-sm font-bold text-neutral-900">{xpReward(c)}</p>
          <p className="text-[10px] uppercase tracking-wide text-neutral-400">XP</p>
        </div>
        <div>
          <p className="text-sm font-bold text-amber-500">★ {c.stats?.avg_rating?.toFixed(1) || "—"}</p>
          <p className="text-[10px] uppercase tracking-wide text-neutral-400">Rated</p>
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between text-xs text-neutral-400">
        <span className="inline-flex items-center gap-1">⏱️ ~{estMinutes(c)} min</span>
        <span className="inline-flex items-center gap-1">
          {c.quality_score > 0 && `Q ${c.quality_score.toFixed(1)}`}
          <span className="text-primary-600 group-hover:translate-x-0.5 transition-transform">Solve →</span>
        </span>
      </div>
    </Link>
  );
}

/* ---------- Skeleton card ---------- */
function CardSkeleton() {
  return (
    <div className="rounded-2xl border border-neutral-200 bg-white p-5">
      <div className="flex items-center justify-between">
        <Skeleton className="h-5 w-16 rounded-full" />
        <Skeleton className="h-4 w-8" />
      </div>
      <Skeleton className="mt-3 h-4 w-3/4" />
      <Skeleton className="mt-2 h-3 w-full" />
      <Skeleton className="mt-1.5 h-3 w-5/6" />
      <div className="mt-3 flex gap-1.5">
        <Skeleton className="h-5 w-16 rounded-full" />
        <Skeleton className="h-5 w-14 rounded-full" />
      </div>
      <div className="mt-4 grid grid-cols-4 gap-2 border-t border-neutral-100 pt-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="text-center">
            <Skeleton className="mx-auto h-4 w-10" />
            <Skeleton className="mx-auto mt-1 h-2.5 w-8" />
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------- Main page ---------- */

export default function ChallengesPage() {
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [recommended, setRecommended] = useState<Challenge[]>([]);
  const [myChallenges, setMyChallenges] = useState<Challenge[]>([]);
  const [savedChallenges, setSavedChallenges] = useState<Challenge[]>([]);
  const [bookmarkedIds, setBookmarkedIds] = useState<Set<string>>(new Set());

  const [skills, setSkills] = useState<Skill[]>([]);

  const [view, setView] = useState<ViewKey>("all");
  const [search, setSearch] = useState("");
  const [difficulty, setDifficulty] = useState("");
  const [skillFilter, setSkillFilter] = useState("");
  const [sourceFilter, setSourceFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [sort, setSort] = useState("newest");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  const [loading, setLoading] = useState(true);
  const [showGenerator, setShowGenerator] = useState(false);
  const [genTopic, setGenTopic] = useState("");
  const [genLoading, setGenLoading] = useState(false);

  const { toast } = useToast();

  /* Load main grid */
  const load = useCallback(async () => {
    setLoading(true);
    try {
      if (view === "saved") {
        const data = await communityApi.getBookmarked(100);
        setSavedChallenges(data.challenges || []);
        setTotal((data.challenges || []).length);
      } else if (view === "mine") {
        const data = await communityApi.getMyChallenges(100);
        setMyChallenges(data.challenges || []);
        setTotal((data.challenges || []).length);
      } else {
        const params: any = {
          page,
          per_page: view === "for-you" ? 6 : PER_PAGE,
          sort: view === "all" ? sort : VIEW_SORT[view],
        };
        if (skillFilter) params.skill = skillFilter;
        if (difficulty) params.difficulty = difficulty;
        if (sourceFilter) params.source = sourceFilter;
        const data = await communityApi.listChallenges(params);
        setChallenges(data.challenges || []);
        setTotal(data.total || 0);
      }
    } catch {
      setChallenges([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [view, sort, skillFilter, difficulty, sourceFilter, page]);

  /* Initial side-loads */
  const loadAux = useCallback(async () => {
    try {
      const [skillsRes, recRes] = await Promise.allSettled([
        communityApi.getSkills(),
        communityApi.getRecommended(6),
      ]);
      if (skillsRes.status === "fulfilled") setSkills(skillsRes.value.skills || []);
      if (recRes.status === "fulfilled") setRecommended(recRes.value.challenges || []);
      communityApi.getBookmarked(100)
        .then((d) => setBookmarkedIds(new Set((d.challenges || []).map((c) => c._id))))
        .catch(() => {});
      communityApi.getMyChallenges(100)
        .then((d) => setMyChallenges(d.challenges || []))
        .catch(() => {});
    } catch {}
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { loadAux(); }, [loadAux]);

  /* Reset page when filters change */
  useEffect(() => { setPage(1); }, [view, search, difficulty, skillFilter, sourceFilter, typeFilter, sort]);

  const toggleBookmark = async (e: React.MouseEvent, id: string) => {
    e.preventDefault();
    e.stopPropagation();
    const isBookmarked = bookmarkedIds.has(id);
    try {
      if (isBookmarked) {
        await communityApi.unbookmark(id);
        setBookmarkedIds((prev) => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
        toast("Removed from saved", { type: "success" });
      } else {
        await communityApi.bookmark(id);
        setBookmarkedIds((prev) => new Set(prev).add(id));
        toast("Saved for later", { type: "success" });
      }
    } catch (err: any) {
      toast(err.message || "Could not update bookmark", { type: "error" });
    }
  };

  const handleGenerate = async () => {
    if (!genTopic.trim()) return;
    setGenLoading(true);
    try {
      await communityApi.generateChallenge({
        topic: genTopic,
        difficulty: difficulty || "medium",
        type: typeFilter || "theory",
      });
      setGenTopic("");
      setShowGenerator(false);
      toast("Challenge generated by AI ✨", { type: "success" });
      await load();
      communityApi.getMyChallenges(100).then((d) => setMyChallenges(d.challenges || [])).catch(() => {});
    } catch (e: any) {
      toast(e.message || "Generation failed", { type: "error" });
    } finally {
      setGenLoading(false);
    }
  };

  /* Client-side search across the current view list */
  const results = useMemo(() => {
    const base =
      view === "saved" ? savedChallenges
      : view === "mine" ? myChallenges
      : view === "for-you" ? recommended
      : challenges;

    const q = search.trim().toLowerCase();
    if (!q) return base;
    return base.filter((c) => {
      const haystack = [c.title, c.description, (c.skills_raw || []).join(" "), c.topic]
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [view, search, challenges, recommended, myChallenges, savedChallenges]);

  /* Type filter is client-side (API has no type param) */
  const filteredByType = useMemo(() => {
    if (!typeFilter) return results;
    return results.filter((c) => c.type === typeFilter);
  }, [results, typeFilter]);

  const display = filteredByType;
  const totalPages = view === "saved" || view === "mine" ? 1 : Math.max(1, Math.ceil(total / PER_PAGE));

  const showForYouRail = view === "all" && recommended.length > 0;

  return (
    <div className="min-h-screen bg-neutral-50/50">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        {/* ---------- Header ---------- */}
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-primary-600">Challenge Arena</p>
            <h1 className="mt-1 text-3xl font-bold tracking-tight text-neutral-900">Challenges</h1>
            <p className="mt-1 max-w-xl text-sm text-neutral-500">
              Solve real-world scenarios, earn XP, climb the ranks, and prove your skills to the world.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => setShowGenerator((v) => !v)}>
              ✨ Generate with AI
            </Button>
            <Link href="/ide">
              <Button>💻 Open IDE</Button>
            </Link>
          </div>
        </div>

        {/* ---------- AI Generator ---------- */}
        {showGenerator && (
          <div className="mt-6 rounded-2xl border border-primary-200 bg-gradient-to-br from-primary-50 via-white to-indigo-50 p-6">
            <h3 className="font-semibold text-neutral-900">AI Challenge Generator</h3>
            <p className="mt-1 text-sm text-neutral-500">
              Describe a topic and the AI will craft a complete challenge with objectives, scenario, and solution notes.
            </p>
            <div className="mt-4 flex flex-col gap-3 sm:flex-row">
              <input
                value={genTopic}
                onChange={(e) => setGenTopic(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleGenerate()}
                placeholder="e.g. Kubernetes networking debug, AWS architecture scenario, Rust ownership challenge…"
                className="flex-1 rounded-xl border border-neutral-300 bg-white px-4 py-2.5 text-sm shadow-sm outline-none transition focus:border-primary-500 focus:ring-2 focus:ring-primary-200"
              />
              <Button onClick={handleGenerate} disabled={genLoading || !genTopic.trim()}>
                {genLoading ? "Generating…" : "Generate challenge"}
              </Button>
            </div>
          </div>
        )}

        {/* ---------- View rail ---------- */}
        <div className="mt-8 -mx-1 flex gap-2 overflow-x-auto px-1 pb-1" role="tablist" aria-label="Challenge views">
          {VIEWS.map((v) => {
            const count =
              v.key === "saved" ? savedChallenges.length
              : v.key === "mine" ? myChallenges.length
              : v.key === "for-you" ? recommended.length
              : null;
            return (
              <button
                key={v.key}
                role="tab"
                aria-selected={view === v.key}
                onClick={() => { setView(v.key); setPage(1); setSearch(""); }}
                className={`shrink-0 rounded-full px-4 py-2 text-sm font-medium transition-all ${
                  view === v.key
                    ? "bg-neutral-900 text-white shadow"
                    : "bg-white text-neutral-600 border border-neutral-200 hover:border-neutral-300 hover:bg-neutral-50"
                }`}
              >
                {v.label}
                {count !== null && <span className={`ml-1.5 text-xs ${view === v.key ? "text-neutral-300" : "text-neutral-400"}`}>({count})</span>}
              </button>
            );
          })}
        </div>

        {/* ---------- For You rail (only on All view) ---------- */}
        {showForYouRail && (
          <div className="mt-8">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-neutral-900">✨ Recommended for you</h2>
              <Link href="/skills" className="text-sm font-medium text-primary-600 hover:underline">
                Improve your skills →
              </Link>
            </div>
            <div className="mt-3 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              {recommended.slice(0, 3).map((c) => (
                <ChallengeCard key={c._id} c={c} bookmarked={bookmarkedIds.has(c._id)} onToggleBookmark={toggleBookmark} />
              ))}
            </div>
          </div>
        )}

        {/* ---------- Filters ---------- */}
        <div className="mt-6 rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            {/* Search */}
            <div className="relative flex-1">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400">🔍</span>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search challenges, skills, topics…"
                aria-label="Search challenges"
                className="w-full rounded-xl border border-neutral-200 bg-neutral-50 py-2 pl-9 pr-4 text-sm outline-none transition focus:border-primary-400 focus:bg-white focus:ring-2 focus:ring-primary-100"
              />
            </div>

            {/* Skill */}
            <select
              value={skillFilter}
              onChange={(e) => setSkillFilter(e.target.value)}
              aria-label="Filter by skill"
              className="rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-700 outline-none transition focus:border-primary-400"
            >
              <option value="">All skills</option>
              {skills.map((s) => (
                <option key={s.skill_id} value={s.slug}>{s.name}</option>
              ))}
            </select>

            {/* Source */}
            <select
              value={sourceFilter}
              onChange={(e) => setSourceFilter(e.target.value)}
              aria-label="Filter by source"
              className="rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-700 outline-none transition focus:border-primary-400"
            >
              <option value="">All sources</option>
              <option value="ai">🤖 AI generated</option>
              <option value="user">👤 Community</option>
            </select>

            {/* Type */}
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              aria-label="Filter by type"
              className="rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-700 outline-none transition focus:border-primary-400"
            >
              <option value="">All types</option>
              {Object.entries(TYPE_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>

            {/* Sort */}
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value)}
              disabled={view === "saved" || view === "mine" || view === "for-you"}
              aria-label="Sort challenges"
              className="rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-700 outline-none transition focus:border-primary-400 disabled:opacity-50"
            >
              <option value="newest">Newest</option>
              <option value="popular">Most attempted</option>
              <option value="quality">Highest quality</option>
              <option value="rating">Top rated</option>
            </select>
          </div>

          {/* Difficulty pills */}
          <div className="mt-3 flex flex-wrap items-center gap-2" role="group" aria-label="Difficulty filter">
            {["", ...DIFFICULTIES].map((d) => {
              const active = difficulty === d;
              return (
                <button
                  key={d || "all"}
                  onClick={() => setDifficulty(d)}
                  className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition-all ${
                    active
                      ? "bg-neutral-900 text-white shadow"
                      : DIFFICULTY_META[d]?.chip || "border border-neutral-200 text-neutral-600 hover:bg-neutral-50"
                  }`}
                >
                  {d ? DIFFICULTY_META[d].label : "All levels"}
                </button>
              );
            })}
          </div>
        </div>

        {/* ---------- Results ---------- */}
        {loading ? (
          <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => <CardSkeleton key={i} />)}
          </div>
        ) : display.length === 0 ? (
          <div className="mt-10 flex flex-col items-center justify-center rounded-2xl border border-dashed border-neutral-300 bg-white px-6 py-16 text-center">
            <span className="text-4xl">🧭</span>
            <h3 className="mt-4 text-lg font-semibold text-neutral-900">No challenges found</h3>
            <p className="mt-1 max-w-sm text-sm text-neutral-500">
              {search
                ? `Nothing matches “${search}”. Try a different keyword or clear filters.`
                : "Try adjusting the filters, or generate a fresh challenge with AI."}
            </p>
            <div className="mt-5 flex gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setSearch(""); setDifficulty(""); setSkillFilter(""); setSourceFilter(""); setTypeFilter(""); setView("all");
                }}
              >
                Clear filters
              </Button>
              <Button onClick={() => setShowGenerator(true)}>✨ Generate with AI</Button>
            </div>
          </div>
        ) : (
          <>
            <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              {display.map((c) => (
                <ChallengeCard key={c._id} c={c} bookmarked={bookmarkedIds.has(c._id)} onToggleBookmark={toggleBookmark} />
              ))}
            </div>

            {/* Pagination */}
            {(view === "all" || view === "popular" || view === "newest" || view === "rated") && totalPages > 1 && (
              <div className="mt-8 flex items-center justify-center gap-3">
                <Button variant="outline" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}>
                  ← Previous
                </Button>
                <span className="text-sm text-neutral-500">
                  Page <span className="font-semibold text-neutral-900">{page}</span> of {totalPages} · {total} challenges
                </span>
                <Button variant="outline" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages}>
                  Next →
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}