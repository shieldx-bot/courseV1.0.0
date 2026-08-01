"use client";

import Link from "next/link";
import { MessageSquare, TrendingUp, Users, Activity, Crown, Trophy, Flame } from "lucide-react";
import type { ActivityEvent, CommunityHubDiscussion, CommunityHubMember } from "@/types/community";

/* ── Helpers ── */

function fmt(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return `${n}`;
}

function timeAgo(iso: string): string {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  if (s < 2592000) return `${Math.floor(s / 86400)}d ago`;
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

const EVENT_META: Record<string, { icon: string; verb: (p: any) => string }> = {
  challenge_completed: { icon: "✅", verb: (p) => `solved ${p?.challenge_title || "a challenge"}` },
  challenge_created: { icon: "🚀", verb: (p) => `published ${p?.challenge_title || "a challenge"}` },
  skill_milestone: { icon: "🎓", verb: (p) => `reached ${p?.level || "a new level"} in ${p?.skill_id || "a skill"}` },
  badge_earned: { icon: "🏅", verb: (p) => `earned ${p?.badge || "a badge"}` },
  creator_level_up: { icon: "👑", verb: (p) => `reached Creator ${p?.level || "Level"}` },
  top_rank: { icon: "🏆", verb: (p) => `made Top ${p?.rank || "rank"}` },
  streak: { icon: "🔥", verb: (p) => `kept a ${p?.days || ""} day streak` },
};

function feedLine(ev: ActivityEvent): { icon: string; text: string } {
  const m = EVENT_META[ev.type];
  if (m) return { icon: m.icon, text: m.verb(ev.payload) };
  return { icon: "•", text: ev.label || ev.type };
}

function SkeletonCard() {
  return (
    <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-neutral-200/60">
      <div className="h-4 w-1/3 animate-pulse rounded bg-neutral-100" />
      <div className="mt-4 space-y-3">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="flex items-center gap-3">
            <div className="h-8 w-8 animate-pulse rounded-lg bg-neutral-100" />
            <div className="flex-1 space-y-1.5">
              <div className="h-3 w-3/4 animate-pulse rounded bg-neutral-100" />
              <div className="h-2.5 w-1/2 animate-pulse rounded bg-neutral-100" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Live Feed ── */

export function FeedPanel({ loading, feed }: { loading: boolean; feed: ActivityEvent[] }) {
  if (loading) return <SkeletonCard />;
  if (feed.length === 0) {
    return (
      <div className="rounded-2xl bg-white p-8 text-center shadow-sm ring-1 ring-neutral-200/60">
        <Activity className="mx-auto h-8 w-8 text-neutral-300" />
        <p className="mt-3 text-sm text-neutral-500">No public activity yet — be the first to make a move.</p>
        <Link href="/challenges" className="mt-3 inline-block text-sm font-semibold text-primary-600 hover:text-primary-700">Browse challenges →</Link>
      </div>
    );
  }
  return (
    <div className="space-y-1 rounded-2xl bg-white p-3 shadow-sm ring-1 ring-neutral-200/60">
      {feed.map((ev) => <FeedItem key={ev.id} ev={ev} />)}
    </div>
  );
}

function FeedItem({ ev }: { ev: ActivityEvent }) {
  const { icon, text } = feedLine(ev);
  const isLink = ev.type === "challenge_completed" || ev.type === "challenge_created";
  const challengeId = ev.payload?.challenge_id;
  const inner = (
    <div className="group flex items-start gap-3 rounded-xl p-3 transition-colors hover:bg-neutral-50">
      <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-neutral-100 text-sm">{icon}</span>
      <div className="min-w-0 flex-1">
        <p className="text-sm text-neutral-800">
          <Link href={`/profile/${ev.user_id}`} className="font-bold hover:underline">{ev.user_name}</Link>{" "}
          <span className="text-neutral-500">{text}</span>
        </p>
        <p className="mt-0.5 text-xs text-neutral-400">{timeAgo(ev.created_at)}</p>
      </div>
      <span className="h-2 w-2 shrink-0 animate-pulse rounded-full bg-emerald-400" aria-hidden="true" />
    </div>
  );
  if (isLink && challengeId) {
    return (
      <Link href={`/challenges/${challengeId}`} className="focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-400">
        {inner}
      </Link>
    );
  }
  return inner;
}

/* ── Trending Discussions ── */

export function DiscussionsPanel({ loading, discussions }: { loading: boolean; discussions: CommunityHubDiscussion[] }) {
  return (
    <section>
      <h2 className="mb-4 flex items-center gap-2 text-lg font-bold text-neutral-900">
        <MessageSquare className="h-5 w-5 text-sky-500" /> Trending Discussions
      </h2>
      {loading ? (
        <SkeletonCard />
      ) : discussions.length === 0 ? (
        <div className="rounded-2xl bg-white p-6 text-center shadow-sm ring-1 ring-neutral-200/60">
          <MessageSquare className="mx-auto h-7 w-7 text-neutral-300" />
          <p className="mt-2 text-sm text-neutral-500">No discussions yet — start one inside any lesson.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {discussions.map((d) => <DiscussionCard key={d.id} d={d} />)}
        </div>
      )}
    </section>
  );
}

function DiscussionCard({ d }: { d: CommunityHubDiscussion }) {
  return (
    <Link
      href={`/learn/${d.course_id}/${d.lesson_id}?tab=discussion`}
      className="group block rounded-xl border border-neutral-200 p-4 transition-all hover:border-primary-300 hover:shadow-md"
    >
      <div className="flex items-center gap-2">
        {d.is_pinned && (
          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold uppercase text-amber-700">Pinned</span>
        )}
        {d.course_title && (
          <span className="truncate rounded-full bg-neutral-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-neutral-400">
            {d.course_title}
          </span>
        )}
      </div>
      <p className="mt-2 line-clamp-2 font-semibold text-neutral-900 group-hover:text-primary-800">{d.title}</p>
      <p className="mt-1 line-clamp-2 text-xs text-neutral-500">{d.excerpt}</p>
      <div className="mt-3 flex items-center gap-3 text-xs text-neutral-400">
        <span className="flex items-center gap-1"><MessageSquare className="h-3.5 w-3.5" />{d.reply_count}</span>
        <span className="flex items-center gap-1"><TrendingUp className="h-3.5 w-3.5" />{d.vote_score} votes</span>
        <span className="ml-auto truncate text-neutral-400">{d.user_name}</span>
      </div>
    </Link>
  );
}

/* ── Top Members ── */

export function MembersPanel({ loading, members }: { loading: boolean; members: CommunityHubMember[] }) {
  return (
    <section>
      <h2 className="mb-4 flex items-center gap-2 text-lg font-bold text-neutral-900">
        <Crown className="h-5 w-5 text-amber-500" /> Top Members
      </h2>
      {loading ? (
        <SkeletonCard />
      ) : members.length === 0 ? (
        <div className="rounded-2xl bg-white p-6 text-center shadow-sm ring-1 ring-neutral-200/60">
          <Trophy className="mx-auto h-7 w-7 text-neutral-300" />
          <p className="mt-2 text-sm text-neutral-500">Top members will appear as the community grows.</p>
        </div>
      ) : (
        <div className="rounded-2xl bg-white p-3 shadow-sm ring-1 ring-neutral-200/60">
          {members.map((m, i) => <MemberRow key={m.user_id} m={m} rank={i + 1} />)}
        </div>
      )}
    </section>
  );
}

function MemberRow({ m, rank }: { m: CommunityHubMember; rank: number }) {
  return (
    <Link href={`/profile/${m.user_id}`} className="group flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors hover:bg-neutral-50">
      <span className="w-5 text-center text-sm font-bold">
        {rank <= 3 ? ["🥇", "🥈", "🥉"][rank - 1] : rank}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-neutral-800 group-hover:text-primary-800">{m.user_name}</p>
        <p className="text-xs capitalize text-neutral-400">{m.level}</p>
      </div>
      <div className="text-right text-xs text-neutral-400">
        <p className="flex items-center justify-end gap-1"><Users className="h-3 w-3" />{fmt(m.followers)}</p>
        <p>{m.published_challenges} challenges</p>
      </div>
    </Link>
  );
}