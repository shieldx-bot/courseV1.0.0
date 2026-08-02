"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

const dailyChallenge = {
  title: "Deploy a Multi-Stage Docker Build",
  description:
    "Optimize a Dockerfile using multi-stage builds to reduce image size by 60%+ and deploy it to a Kubernetes cluster.",
  difficulty: "Intermediate" as const,
  estimatedTime: "45 min",
  participants: 1284,
  completionRate: 76,
  rewardXp: 150,
  category: "DevOps",
  icon: "🐳",
  color: "from-blue-500 to-cyan-400",
  tags: ["Docker", "Kubernetes", "CI/CD"],
};

export function DailyChallenge() {
  const [isHydrated, setIsHydrated] = useState(false);
  const [participantsNow, setParticipantsNow] = useState(dailyChallenge.participants);

  useEffect(() => setIsHydrated(true), []);

  useEffect(() => {
    if (isHydrated) {
      const interval = setInterval(() => {
        setParticipantsNow((prev) => prev + Math.floor(Math.random() * 3) + 1);
      }, 8000);
      return () => clearInterval(interval);
    }
  }, [isHydrated]);

  return (
    <section className="py-16 md:py-24 bg-neutral-50 dark:bg-neutral-950" aria-label="Daily challenge">
      <div className="mx-auto max-w-page px-6">
        <div className="rounded-2xl md:rounded-3xl overflow-hidden border border-neutral-200 dark:border-neutral-800 bg-gradient-to-br from-primary-900 via-primary-900 to-primary-950 text-white relative">
          {/* Background decorations */}
          <div className="absolute inset-0 opacity-20">
            <div className="absolute top-0 right-1/4 w-72 h-72 bg-accent-500 rounded-full mix-blend-multiply filter blur-3xl animate-float"></div>
            <div className="absolute bottom-0 left-1/4 w-72 h-72 bg-primary-600 rounded-full mix-blend-multiply filter blur-3xl animate-float" style={{ animationDelay: "2s" }}></div>
          </div>

          <div className="relative p-6 md:p-12">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
              <div>
                <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-accent-500/20 border border-accent-500/30 text-accent-300 mb-4">
                  <span className="text-sm">📅</span>
                  <span className="text-sm font-semibold">Today’s Challenge</span>
                </div>
                <h2 className="display-md text-2xl md:text-4xl font-bold mb-2">{dailyChallenge.title}</h2>
                <p className="text-neutral-300 text-base md:text-lg max-w-2xl leading-relaxed">{dailyChallenge.description}</p>
              </div>
              <div className={`w-16 h-16 md:w-20 md:h-20 rounded-2xl bg-gradient-to-br ${dailyChallenge.color} flex items-center justify-center text-3xl md:text-4xl shadow-xl flex-shrink-0`}>
                {dailyChallenge.icon}
              </div>
            </div>

            {/* Meta grid */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
              <div className="p-4 rounded-xl bg-white/10 border border-white/10">
                <p className="text-xs text-neutral-300 uppercase tracking-wide mb-1">Difficulty</p>
                <p className="font-semibold text-accent-300">{dailyChallenge.difficulty}</p>
              </div>
              <div className="p-4 rounded-xl bg-white/10 border border-white/10">
                <p className="text-xs text-neutral-300 uppercase tracking-wide mb-1">Est. Time</p>
                <p className="font-semibold">⏱️ {dailyChallenge.estimatedTime}</p>
              </div>
              <div className="p-4 rounded-xl bg-white/10 border border-white/10">
                <p className="text-xs text-neutral-300 uppercase tracking-wide mb-1">Participants</p>
                <p className="font-semibold">
                  {isHydrated ? (
                    <span className="tabular-nums animate-count-up" key={participantsNow}>{participantsNow.toLocaleString()}</span>
                  ) : (
                    "—"
                  )}
                </p>
              </div>
              <div className="p-4 rounded-xl bg-white/10 border border-white/10">
                <p className="text-xs text-neutral-300 uppercase tracking-wide mb-1">Completion</p>
                <p className="font-semibold text-green-400">✅ {dailyChallenge.completionRate}%</p>
              </div>
              <div className="p-4 rounded-xl bg-white/10 border border-white/10">
                <p className="text-xs text-neutral-300 uppercase tracking-wide mb-1">Reward</p>
                <p className="font-semibold text-accent-300">⭐ {dailyChallenge.rewardXp} XP</p>
              </div>
            </div>

            {/* Tags */}
            <div className="flex flex-wrap items-center gap-3 mb-8">
              {dailyChallenge.tags.map((tag) => (
                <span key={tag} className="px-3 py-1 rounded-full bg-white/10 border border-white/20 text-xs font-medium text-white/90">
                  #{tag}
                </span>
              ))}
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-4">
              <Link href="/arena/daily" className="w-full sm:w-auto">
                <Button size="lg" className="w-full sm:w-auto bg-accent-500 hover:bg-accent-600 text-primary-900 font-semibold">
                  Start Today’s Challenge →
                </Button>
              </Link>
              <p className="text-sm text-neutral-300">
                <span className="font-semibold text-white">{participantsNow.toLocaleString()}</span> developers already started
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}