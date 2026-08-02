"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  Users, Zap, CheckCircle2, MessageSquare, FileText, Activity,
  Award, Shield, Flame, Sparkles, Crown, Trophy,
} from "lucide-react";
import { communityApi } from "@/lib/community-api";
import type { CommunityHubData } from "@/types/community";
import { FeedPanel, DiscussionsPanel, MembersPanel } from "./hub-sections";

function fmt(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return `${n}`;
}

function useCountUp(target: number, active: boolean, duration = 1400): number {
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (!active) return;
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setValue(Math.round(target * eased));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, active, duration]);
  return value;
}

function PulseStat({ label, value, icon, active }: { label: string; value: number; icon: React.ReactNode; active: boolean }) {
  const n = useCountUp(value, active);
  return (
    <div className="flex items-center gap-3 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-neutral-200/60">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-neutral-100 text-neutral-500">{icon}</span>
      <div className="min-w-0">
        <p className="text-lg font-bold leading-tight text-neutral-900">{fmt(n)}</p>
        <p className="truncate text-xs font-medium text-neutral-400">{label}</p>
      </div>
    </div>
  );
}

export default function CommunityHubView() {
  const [data, setData] = useState<CommunityHubData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const statsRef = useRef<HTMLDivElement>(null);
  const [statsVisible, setStatsVisible] = useState(false);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const hub = await communityApi.getCommunityHub({ feed_limit: 40, discussions_limit: 6, members_limit: 8 });
      setData(hub);
    } catch (e: any) {
      setError(e?.message || "Failed to load community");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  useEffect(() => {
    const el = statsRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) { setStatsVisible(true); obs.disconnect(); }
    }, { threshold: 0.2 });
    obs.observe(el);
    return () => obs.disconnect();
  }, [loading]);

  if (error) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-20 text-center">
        <p className="text-neutral-500">Community temporarily unavailable.</p>
        <button onClick={load} className="mt-4 rounded-full bg-primary-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-primary-700">
          Retry
        </button>
      </div>
    );
  }

  const stats = data?.stats ?? null;

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      {/* Hero */}
      <div className="rounded-3xl bg-gradient-to-br from-primary-700 via-primary-600 to-cyan-600 p-8 text-white shadow-lg sm:p-10">
        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-white/70">
          <Sparkles className="h-4 w-4" /> Live Community
        </div>
        <h1 className="mt-3 text-3xl font-bold sm:text-4xl">The Arena is alive.</h1>
        <p className="mt-2 max-w-2xl text-sm text-white/85 sm:text-base">
          People are learning. People are competing. People are improving — right now.
        </p>
      </div>

      {/* Platform pulse */}
      <div ref={statsRef} className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {loading || !stats ? (
          Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-20 animate-pulse rounded-2xl bg-neutral-100" />
          ))
        ) : (
          <>
            <PulseStat active={statsVisible} value={stats.members} label="Members" icon={<Users className="h-5 w-5" />} />
            <PulseStat active={statsVisible} value={stats.active_members_24h} label="Active in 24h" icon={<Activity className="h-5 w-5" />} />
            <PulseStat active={statsVisible} value={stats.events_last_24h} label="Events today" icon={<Zap className="h-5 w-5" />} />
            <PulseStat active={statsVisible} value={stats.challenges_solved_24h} label="Solved today" icon={<CheckCircle2 className="h-5 w-5" />} />
            <PulseStat active={statsVisible} value={stats.discussions_total} label="Discussions" icon={<MessageSquare className="h-5 w-5" />} />
            <PulseStat active={statsVisible} value={stats.challenges_published} label="Challenges" icon={<FileText className="h-5 w-5" />} />
          </>
        )}
      </div>

      <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Live feed */}
        <section className="lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-lg font-bold text-neutral-900">
              <Flame className="h-5 w-5 text-orange-500" /> Live Activity
            </h2>
            <span className="flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-600 ring-1 ring-emerald-200">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" /> LIVE
            </span>
          </div>
          <FeedPanel loading={loading} feed={data?.feed ?? []} />
        </section>

        {/* Sidebar */}
        <aside className="space-y-6">
          <DiscussionsPanel loading={loading} discussions={data?.discussions ?? []} />
          <MembersPanel loading={loading} members={data?.members ?? []} />
          <section className="rounded-2xl bg-gradient-to-br from-neutral-900 to-neutral-800 p-6 text-white shadow-md">
            <div className="flex items-center gap-2 text-sm font-bold">
              <Award className="h-4 w-4 text-amber-400" /> Reputation system
            </div>
            <p className="mt-2 text-sm text-white/75">
              Solve challenges, publish content, and help others to climb the leaderboard. Every action builds your identity here.
            </p>
            <Link href="/profile" className="mt-4 inline-flex items-center gap-1 rounded-full bg-white/10 px-4 py-2 text-sm font-semibold text-white ring-1 ring-white/20 transition-all hover:bg-white/20">
              <Shield className="h-3.5 w-3.5" /> View your profile
            </Link>
          </section>
        </aside>
      </div>
    </div>
  );
}