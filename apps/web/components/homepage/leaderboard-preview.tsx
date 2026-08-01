"use client";

import { useEffect, useRef, useState } from "react";

interface LeaderboardUser {
  rank: number;
  name: string;
  xp: number;
  badge: string;
  country: string;
  trend: number;
}

const topUsers: LeaderboardUser[] = [
  { rank: 1, name: "DevMaster99", xp: 485920, badge: "👑", country: "🇺🇸", trend: 0 },
  { rank: 2, name: "CodeNinja", xp: 472340, badge: "🏆", country: "🇮🇳", trend: 1 },
  { rank: 3, name: "SysAdmin Pro", xp: 461230, badge: "⭐", country: "🇬🇧", trend: -1 },
  { rank: 4, name: "CloudArchitect", xp: 445680, badge: "🚀", country: "🇨🇦", trend: 2 },
  { rank: 5, name: "DevSecOps", xp: 438920, badge: "🔐", country: "🇬🇧", trend: 0 },
];

export function LeaderboardPreview() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [visibleRows, setVisibleRows] = useState<boolean[]>(new Array(topUsers.length).fill(false));

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const rowElement = entry.target as HTMLElement;
            const index = parseInt(rowElement.dataset.index || "0");
            setVisibleRows((prev) => {
              const updated = [...prev];
              updated[index] = true;
              return updated;
            });
          }
        });
      },
      { threshold: 0.2 }
    );

    const rows = containerRef.current?.querySelectorAll(".leaderboard-row");
    rows?.forEach((row) => observer.observe(row));

    return () => observer.disconnect();
  }, []);

  return (
    <section className="py-16 md:py-24 bg-white dark:bg-neutral-900">
      <div className="mx-auto max-w-page px-6">
        <div className="flex items-center justify-between mb-12">
          <div>
            <h2 className="display-md text-3xl md:text-4xl font-bold mb-2">Global Leaderboard</h2>
            <p className="text-neutral-600 dark:text-neutral-400">
              Top developers competing and building their reputation
            </p>
          </div>
          <a
            href="/leaderboard"
            className="text-accent-500 hover:text-accent-600 font-semibold text-sm md:text-base whitespace-nowrap"
          >
            View Full →
          </a>
        </div>

        <div ref={containerRef} className="overflow-x-auto">
          <table className="w-full" aria-label="Global leaderboard top competitors">
            <caption className="sr-only">
              Top developers ranked by total XP. Includes rank, name, XP, country, and weekly trend.
            </caption>
            <thead>
              <tr className="border-b border-neutral-200 dark:border-neutral-800">
                <th className="text-left py-4 px-4 font-semibold text-neutral-600 dark:text-neutral-400 text-sm">Rank</th>
                <th className="text-left py-4 px-4 font-semibold text-neutral-600 dark:text-neutral-400 text-sm">Name</th>
                <th className="text-left py-4 px-4 font-semibold text-neutral-600 dark:text-neutral-400 text-sm">XP</th>
                <th className="text-left py-4 px-4 font-semibold text-neutral-600 dark:text-neutral-400 text-sm">Country</th>
                <th className="text-right py-4 px-4 font-semibold text-neutral-600 dark:text-neutral-400 text-sm">Trend</th>
              </tr>
            </thead>
            <tbody>
              {topUsers.map((user, index) => (
                <tr
                  key={user.rank}
                  data-index={index}
                  className="leaderboard-row border-b border-neutral-100 dark:border-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-800/50 transition-colors"
                  style={{
                    opacity: visibleRows[index] ? 1 : 0,
                    transition: `opacity 0.5s ease-out ${index * 0.1}s`,
                  }}
                >
                  <td className="py-4 px-4">
                    <div className="flex items-center gap-3">
                      {user.rank <= 3 ? (
                        <span className="text-xl">
                          {user.rank === 1 ? "🥇" : user.rank === 2 ? "🥈" : "🥉"}
                        </span>
                      ) : (
                        <span className="text-lg font-bold text-neutral-400">#{user.rank}</span>
                      )}
                    </div>
                  </td>
                  <td className="py-4 px-4">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{user.badge}</span>
                      <span className="font-semibold text-neutral-900 dark:text-white">{user.name}</span>
                    </div>
                  </td>
                  <td className="py-4 px-4">
                    <span className="font-bold text-accent-500">{user.xp.toLocaleString()} XP</span>
                  </td>
                  <td className="py-4 px-4">
                    <span className="text-2xl">{user.country}</span>
                  </td>
                  <td className="py-4 px-4 text-right">
                    {user.trend !== 0 && (
                      <span className={`font-semibold ${user.trend > 0 ? "text-green-600" : "text-red-600"}`}>
                        {user.trend > 0 ? "↑" : "↓"} {Math.abs(user.trend)}
                      </span>
                    )}
                    {user.trend === 0 && <span className="text-neutral-400">—</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
