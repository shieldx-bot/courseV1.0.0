"use client";

import { useEffect, useRef, useState } from "react";

interface LiveActivityItem {
  id: number;
  icon: string;
  user: string;
  action: string;
  target: string;
  timestamp: string;
  color: string;
}

const baseActivities: LiveActivityItem[] = [
  { id: 1, icon: "🏆", user: "John Reyes", action: "reached", target: "Diamond Rank", timestamp: "Just now", color: "from-yellow-500 to-orange-400" },
  { id: 2, icon: "☁️", user: "Emily Tran", action: "solved", target: "Kubernetes Expert", timestamp: "1m ago", color: "from-indigo-500 to-blue-400" },
  { id: 3, icon: "⚔️", user: "Alex Nguyen", action: "started", target: "AWS Battle Royale", timestamp: "3m ago", color: "from-orange-500 to-amber-400" },
  { id: 4, icon: "🐧", user: "Sarah Kim", action: "earned", target: "Linux Master", timestamp: "5m ago", color: "from-blue-500 to-cyan-400" },
  { id: 5, icon: "🚀", user: "Michael Chen", action: "published", target: "a new Challenge", timestamp: "8m ago", color: "from-red-500 to-pink-400" },
  { id: 6, icon: "💎", user: "Priya Patel", action: "reached", target: "1M Total XP", timestamp: "12m ago", color: "from-purple-500 to-indigo-400" },
];

const rotationPool: Omit<LiveActivityItem, "id">[] = [
  { icon: "⚡", user: "Daniel Kim", action: "solved", target: "Terraform State Basics", timestamp: "2m ago", color: "from-purple-500 to-violet-400" },
  { icon: "🔥", user: "Sofia Garcia", action: "earned", target: "10-Day Streak Badge", timestamp: "4m ago", color: "from-red-500 to-orange-400" },
  { icon: "🌐", user: "Tom Wilson", action: "reached", target: "Global Top 50", timestamp: "6m ago", color: "from-green-500 to-emerald-400" },
  { icon: "📦", user: "Anna Kovacs", action: "solved", target: "Docker Networking Expert", timestamp: "9m ago", color: "from-blue-500 to-sky-400" },
  { icon: "🏅", user: "Jake Miller", action: "earned", target: "Rust Pioneer Achievement", timestamp: "15m ago", color: "from-amber-500 to-yellow-400" },
  { icon: "🤖", user: "Lena Fischer", action: "completed", target: "AI/ML Path Week 3", timestamp: "18m ago", color: "from-cyan-500 to-teal-400" },
];

export function LiveActivity() {
  const [activities, setActivities] = useState<LiveActivityItem[]>(baseActivities);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const nextIdRef = useRef(baseActivities.length + 1);

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
      const newItem = rotationPool[Math.floor(Math.random() * rotationPool.length)];
      setActivities((prev) => [
        { ...newItem, id: nextIdRef.current++ },
        ...prev.slice(0, 4),
      ]);
    }, 6000);
    return () => clearInterval(interval);
  }, [prefersReducedMotion]);

  return (
    <section className="py-16 md:py-24 bg-neutral-50 dark:bg-neutral-950" aria-label="Live member activity">
      <div className="mx-auto max-w-page px-6">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-12 gap-6">
          <div>
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-accent-500/10 border border-accent-500/30 text-accent-700 dark:text-accent-400 mb-4">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent-500 opacity-60"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-accent-500"></span>
              </span>
              <span className="text-sm font-semibold">Live Now</span>
            </div>
            <h2 className="display-md text-3xl md:text-4xl font-bold mb-2">
              The Community is <span className="bg-gradient-to-r from-accent-500 to-orange-400 bg-clip-text text-transparent">Moving</span>
            </h2>
            <p className="text-neutral-600 dark:text-neutral-400 max-w-xl">
              Real achievements from real members — happening right now.
            </p>
          </div>
          <a
            href="/community"
            className="text-accent-500 hover:text-accent-600 font-semibold text-sm md:text-base whitespace-nowrap"
          >
            View Full Feed →
          </a>
        </div>

        <div className="relative">
          {/* Timeline gradient line */}
          <div className="absolute left-5 md:left-6 top-0 bottom-0 w-px bg-gradient-to-b from-accent-500/50 via-neutral-200 dark:via-neutral-800 to-transparent" aria-hidden="true"></div>

          <ul className="space-y-4" role="list">
            {activities.map((activity, index) => (
              <li
                key={activity.id}
                className="relative pl-14 md:pl-16 group"
                style={{ animationDelay: `${index * 0.15}s` }}
              >
                {/* Node dot */}
                <div className="absolute left-0 top-1 flex items-center justify-center">
                  <div className={`w-10 h-10 md:w-12 md:h-12 rounded-full bg-gradient-to-br ${activity.color} flex items-center justify-center text-lg md:text-xl shadow-lg group-hover:scale-110 transition-transform`}>
                    {activity.icon}
                  </div>
                </div>

                {/* Card */}
                <div className="p-4 md:p-5 rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 hover:border-accent-500/50 hover:shadow-lg transition-all duration-300 group-hover:-translate-y-0.5">
                  {index < 3 && (
                    <div className="flex items-center gap-2 mb-2">
                      <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-60"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                      </span>
                      <span className="text-xs font-medium text-green-600 dark:text-green-400 uppercase tracking-wide">Live</span>
                    </div>
                  )}
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="font-semibold text-neutral-900 dark:text-white">{activity.user}</span>
                    <span className="text-neutral-500 dark:text-neutral-400">·</span>
                    <span className="text-neutral-600 dark:text-neutral-300">{activity.action}</span>
                    <span className="font-medium text-accent-600 dark:text-accent-400">{activity.target}</span>
                  </div>
                  <p className="text-xs text-neutral-400 dark:text-neutral-500 mt-1.5">{activity.timestamp}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}