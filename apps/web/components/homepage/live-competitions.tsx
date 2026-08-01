"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

interface Competition {
  id: string;
  name: string;
  difficulty: "Beginner" | "Intermediate" | "Advanced" | "Expert";
  participants: number;
  prize: string;
  endsInHours: number;
  icon: string;
  color: string;
  category: string;
}

const competitions: Competition[] = [
  {
    id: "aws-battle-royale",
    name: "AWS Battle Royale",
    difficulty: "Advanced",
    participants: 3421,
    prize: "$500 + Legendary Badge",
    endsInHours: 6.5,
    icon: "☁️",
    color: "from-orange-500 to-amber-400",
    category: "Cloud",
  },
  {
    id: "kubernetes-gauntlet",
    name: "Kubernetes Gauntlet",
    difficulty: "Expert",
    participants: 1847,
    prize: "$1,000 + Mythic Trophy",
    endsInHours: 22,
    icon: "⚙️",
    color: "from-indigo-500 to-violet-400",
    category: "Containers",
  },
  {
    id: "linux-speedrun",
    name: "Linux Speedrun Challenge",
    difficulty: "Intermediate",
    participants: 5230,
    prize: "$250 + Epic Badge",
    endsInHours: 3.25,
    icon: "🐧",
    color: "from-blue-500 to-cyan-400",
    category: "Linux",
  },
  {
    id: "ai-ml-clash",
    name: "AI/ML Model Clash",
    difficulty: "Advanced",
    participants: 1204,
    prize: "$750 + Creator Spotlight",
    endsInHours: 47,
    icon: "🤖",
    color: "from-purple-500 to-fuchsia-400",
    category: "AI/ML",
  },
];

function formatTimeLeft(hours: number) {
  const totalMinutes = Math.floor(hours * 60);
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return `${h}h ${m}m`;
}

function getDifficultyStyles(difficulty: Competition["difficulty"]) {
  switch (difficulty) {
    case "Beginner":
      return "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400";
    case "Intermediate":
      return "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400";
    case "Advanced":
      return "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400";
    case "Expert":
      return "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400";
  }
}

export function LiveCompetitions() {
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => setIsHydrated(true), []);

  return (
    <section className="py-16 md:py-24 bg-white dark:bg-neutral-900" aria-label="Live competitions">
      <div className="mx-auto max-w-page px-6">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-12 gap-6">
          <div>
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-red-500/10 border border-red-500/30 text-red-600 dark:text-red-400 mb-4">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-60"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
              </span>
              <span className="text-sm font-semibold">Happening Now</span>
            </div>
            <h2 className="display-md text-3xl md:text-4xl font-bold mb-2">Live Competitions</h2>
            <p className="text-neutral-600 dark:text-neutral-400 max-w-xl">
              Real-time battles with real rewards. The clock is ticking — join before time runs out.
            </p>
          </div>
          <a
            href="/arena"
            className="text-accent-500 hover:text-accent-600 font-semibold text-sm md:text-base whitespace-nowrap"
          >
            View All Arenas →
          </a>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {competitions.map((comp, index) => (
            <div
              key={comp.id}
              className="group relative rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-800/50 p-6 hover:border-accent-500/50 hover:shadow-xl hover:-translate-y-1 transition-all duration-300"
            >
              <div className="flex items-start justify-between mb-4">
                <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${comp.color} flex items-center justify-center text-2xl shadow-lg`}>
                  {comp.icon}
                </div>
                <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${getDifficultyStyles(comp.difficulty)}`}>
                  {comp.difficulty}
                </span>
              </div>

              <h3 className="text-lg font-bold text-neutral-900 dark:text-white mb-1">{comp.name}</h3>
              <p className="text-sm text-neutral-500 dark:text-neutral-400 mb-4">{comp.category}</p>

              <div className="grid grid-cols-2 gap-4 mb-5">
                <div className="flex items-center gap-2 text-sm text-neutral-600 dark:text-neutral-300">
                  <span className="text-lg" aria-hidden="true">👥</span>
                  <span><strong className="font-semibold">{comp.participants.toLocaleString()}</strong> competing</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-neutral-600 dark:text-neutral-300">
                  <span className="text-lg" aria-hidden="true">⏳</span>
                  <span>
                    {isHydrated ? (
                      <><strong className="font-semibold text-red-600 dark:text-red-400">{formatTimeLeft(comp.endsInHours)}</strong> left</>
                    ) : (
                      <><strong className="font-semibold">--</strong> left</>
                    )}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-sm text-neutral-600 dark:text-neutral-300">
                  <span className="text-lg" aria-hidden="true">🏆</span>
                  <span className="truncate"><strong className="font-semibold">{comp.prize}</strong></span>
                </div>
                <div className="flex items-center gap-2 text-sm text-neutral-600 dark:text-neutral-300">
                  <span className="text-lg" aria-hidden="true">🔥</span>
                  <span><strong className="font-semibold">{comp.participants + Math.floor(comp.participants * 0.07)}</strong> joined this hour</span>
                </div>
              </div>

              <div className="flex items-center justify-between gap-4">
                <div className="flex-1 h-1.5 bg-neutral-200 dark:bg-neutral-700 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-accent-500 to-orange-400 rounded-full"
                    style={{ width: `${Math.max(15, 100 - (comp.endsInHours / 48) * 100)}%` }}
                  ></div>
                </div>
                <span className="text-xs text-neutral-500 dark:text-neutral-400 flex-shrink-0">{Math.max(15, Math.round(100 - (comp.endsInHours / 48) * 100))}% full</span>
              </div>

              <Link href={`/arena/${comp.id}`} className="mt-5 block">
                <Button className="w-full group-hover:bg-accent-600 bg-accent-500 text-primary-900 font-semibold">
                  Join Competition <span aria-hidden="true">→</span>
                </Button>
              </Link>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}