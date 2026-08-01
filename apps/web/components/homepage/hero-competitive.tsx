"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";

interface LivePulse {
  id: number;
  icon: string;
  text: string;
  xp: string;
  color: string;
}

const initialPulses: LivePulse[] = [
  { id: 1, icon: "🏆", text: "DevMaster99 reached Legendary Rank", xp: "+2,450 XP", color: "from-yellow-500 to-orange-400" },
  { id: 2, icon: "☁️", text: "Emily Tran solved Kubernetes Expert", xp: "+1,200 XP", color: "from-indigo-500 to-blue-400" },
  { id: 3, icon: "⚔️", text: "Alex Nguyen started AWS Battle Royale", xp: "+350 XP", color: "from-orange-500 to-amber-400" },
];

const pulsePool: Omit<LivePulse, "id">[] = [
  { icon: "🐧", text: "Sarah Kim earned Linux Master", xp: "+900 XP", color: "from-blue-500 to-cyan-400" },
  { icon: "🚀", text: "Michael Chen published a Challenge", xp: "+600 XP", color: "from-red-500 to-pink-400" },
  { icon: "⚡", text: "Jake Miller solved Terraform in 4 mins", xp: "+1,050 XP", color: "from-purple-500 to-violet-400" },
  { icon: "🔥", text: "Sofia Garcia earned 10-Day Streak", xp: "+500 XP", color: "from-red-500 to-orange-400" },
  { icon: "💎", text: "Priya Patel reached 1M Total XP", xp: "+3,000 XP", color: "from-indigo-500 to-purple-400" },
];

const topHeroUsers = [
  { rank: 1, name: "DevMaster99", xp: "485K", medal: "🥇", country: "🇺🇸", gradient: "from-yellow-500 to-orange-400" },
  { rank: 2, name: "CodeNinja", xp: "472K", medal: "🥈", country: "🇮🇳", gradient: "from-neutral-400 to-neutral-300" },
  { rank: 3, name: "SysAdmin Pro", xp: "461K", medal: "🥉", country: "🇬🇧", gradient: "from-amber-600 to-amber-400" },
];

export function HeroCompetitive() {
  const [pulses, setPulses] = useState<LivePulse[]>(initialPulses);
  const nextIdRef = useRef(4);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const [xpTick, setXpTick] = useState(0);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setPrefersReducedMotion(mq.matches);
    const handler = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  useEffect(() => {
    if (prefersReducedMotion) return;
    const interval = setInterval(() => {
      const item = pulsePool[Math.floor(Math.random() * pulsePool.length)];
      setPulses((prev) => [{ ...item, id: nextIdRef.current++ }, ...prev.slice(0, 2)]);
      setXpTick((prev) => prev + Math.floor(Math.random() * 40) + 10);
    }, 5000);
    return () => clearInterval(interval);
  }, [prefersReducedMotion]);

  return (
    <section className="relative overflow-hidden bg-gradient-to-b from-primary-900 to-primary-950 py-20 text-white md:py-32">
      {/* Animated background gradient */}
      <div className="absolute inset-0 opacity-30">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-accent-500 rounded-full mix-blend-multiply filter blur-3xl animate-float"></div>
        <div className="absolute top-1/2 right-1/4 w-96 h-96 bg-primary-700 rounded-full mix-blend-multiply filter blur-3xl animate-float" style={{ animationDelay: "2s" }}></div>
      </div>

      <div className="relative mx-auto max-w-page text-center z-10">
        <div className="inline-block mb-6">
          <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 border border-white/20">
            <span className="w-2 h-2 bg-accent-500 rounded-full animate-pulse"></span>
            <span className="text-sm font-medium">Join 50,000+ competitive learners</span>
          </span>
        </div>

        <h1 className="display-lg text-4xl md:text-6xl font-bold leading-tight text-balance">
          Learn. Compete.{" "}
          <span className="bg-gradient-to-r from-accent-500 to-orange-400 bg-clip-text text-transparent">
            Become Legendary
          </span>
          .
        </h1>

        <p className="mx-auto mt-8 max-w-2xl text-lg md:text-xl text-neutral-200 text-balance leading-relaxed">
          Join the ultimate competitive learning platform. Solve real-world challenges, climb the leaderboards, and build your reputation as a tech expert.
        </p>

        <div className="mt-12 flex flex-col items-center justify-center gap-4 sm:flex-row">
          <Link href="/arena">
            <Button size="lg" className="w-full sm:w-auto bg-accent-500 hover:bg-accent-600 text-primary-900 font-semibold">
              Start Competing
            </Button>
          </Link>
          <Link href="/courses">
            <Button size="lg" variant="secondary" className="w-full border-white/20 text-white hover:bg-white/10 sm:w-auto">
              Browse Challenges
            </Button>
          </Link>
        </div>

        {/* Quick stats */}
        <div className="mt-16 grid grid-cols-3 gap-6 md:gap-12">
          <div className="text-center">
            <p className="text-3xl md:text-4xl font-bold text-accent-500">1000+</p>
            <p className="text-sm text-neutral-300 mt-2">Challenges</p>
          </div>
          <div className="text-center">
            <p className="text-3xl md:text-4xl font-bold text-accent-500">50K+</p>
            <p className="text-sm text-neutral-300 mt-2">Competing</p>
          </div>
          <div className="text-center">
            <p className="text-3xl md:text-4xl font-bold text-accent-500">120+</p>
            <p className="text-sm text-neutral-300 mt-2">Countries</p>
          </div>
        </div>
      </div>

      {/* Floating activity / leaderboard panel */}
      <div className="relative mx-auto max-w-page px-6 mt-14" aria-hidden="true">
        <div className="grid md:grid-cols-2 gap-4 md:gap-6 items-stretch">
          {/* Live feed pulse */}
          <div className="rounded-2xl bg-white/5 border border-white/10 backdrop-blur-sm p-5">
            <div className="flex items-center gap-2 mb-4">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-60"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
              </span>
              <p className="text-sm font-semibold text-white/90 uppercase tracking-wide">Live Activity</p>
            </div>
            <ul className="space-y-3">
              {pulses.map((pulse, i) => (
                <li key={pulse.id} className={`flex items-center gap-3 ${i === 0 ? "animate-premium-fade-in" : ""}`}>
                  <span className={`w-8 h-8 rounded-lg bg-gradient-to-br ${pulse.color} flex items-center justify-center text-sm flex-shrink-0`}>
                    {pulse.icon}
                  </span>
                  <p className="text-sm text-white/80 truncate flex-1">{pulse.text}</p>
                  <span className="text-xs font-semibold text-accent-300 flex-shrink-0">{pulse.xp}</span>
                </li>
              ))}
            </ul>
            <p className="text-xs text-white/40 mt-4 pt-3 border-t border-white/10">
              <span className="font-semibold text-accent-300 tabular-nums">{(2845900 + xpTick * 1000).toLocaleString()}</span> XP earned today
            </p>
          </div>

          {/* Mini leaderboard */}
          <div className="rounded-2xl bg-white/5 border border-white/10 backdrop-blur-sm p-5">
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm font-semibold text-white/90 uppercase tracking-wide">Leaderboard</p>
              <Link href="/leaderboard" className="text-xs text-accent-300 hover:text-accent-200 font-medium">
                View Full →
              </Link>
            </div>
            <ul className="space-y-2.5">
              {topHeroUsers.map((user) => (
                <li key={user.rank} className="flex items-center gap-3 rounded-xl bg-white/5 p-3 group hover:bg-white/10 transition-colors">
                  <span className="text-lg flex-shrink-0">{user.medal}</span>
                  <span className={`w-8 h-8 rounded-full bg-gradient-to-br ${user.gradient} flex items-center justify-center text-primary-900 font-bold text-xs flex-shrink-0`}>
                    {user.name.slice(0, 1)}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-white truncate">{user.name}</p>
                    <p className="text-xs text-white/50">{user.country} · {user.xp} XP</p>
                  </div>
                  <span className="text-xs font-semibold text-accent-300 flex-shrink-0">#{user.rank}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}