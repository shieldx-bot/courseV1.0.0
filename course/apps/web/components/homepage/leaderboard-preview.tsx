"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { communityApi } from "@/lib/community-api";
import type { ArenaPlayer } from "@/types/community";

/* Small country → flag map (falls back to the country code itself) */
const FLAGS: Record<string, string> = {
  US: "🇺🇸", IN: "🇮🇳", GB: "🇬🇧", CA: "🇨🇦", DE: "🇩🇪", FR: "�🇷",
  AU: "🇦�🇺", SG: "🇸🇬", JP: "🇯🇵", BR: "🇧🇷", NL: "🇳🇱", SE: "🇸🇪",
  PL: "🇵🇱", UA: "�🇦", VN: "�🇳", TH: "🇹🇭", ID: "🇮🇩", PH: "🇵🇭",
  MY: "🇲🇾", KR: "🇰🇷", CN: "🇨🇳", HK: "🇭🇰", TW: "🇹🇼", PK: "🇵🇰",
  BD: "🇧🇩", NG: "🇳🇬", KE: "🇰🇪", ZA: "��", EG: "🇪🇬", SA: "🇸🇦",
  AE: "🇦🇪", IL: "🇮🇱", TR: "🇹🇷", RU: "🇷🇺", MX: "🇲🇽", AR: "🇦🇷",
  CO: "🇨�", CL: "🇨🇱", PE: "🇵🇪", ES: "🇪🇸", IT: "🇮🇹", PT: "🇵🇹",
  IE: "🇮🇪", NZ: "🇳🇿",
};

function flagOf(country?: string): string {
  if (!country) return "�";
  return FLAGS[country.toUpperCase()] ?? country.toUpperCase();
}

function fmt(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return `${n}`;
}

export function LeaderboardPreview() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [players, setPlayers] = useState<ArenaPlayer[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [visibleRows, setVisibleRows] = useState<boolean[]>([]);

  useEffect(() => {
    let cancelled = false;
    communityApi
      .getArenaLeaderboard({ scope: "global", period: "all", limit: 5 })
      .then((data) => {
        if (cancelled) return;
        setPlayers(data.players);
        setVisibleRows(new Array(data.players.length).fill(false));
        setLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setFailed(true);
        setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  // Row scroll-fade (existing interaction, now driven by real data length)
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
  }, [loading, players.length]);

  return (
    <section className="py-16 md:py-24 bg-white dark:bg-neutral-900">
      <div className="mx-auto max-w-page px-6">
        <div className="flex items-center justify-between mb-12">
          <div>
            <h2 className="display-md text-3xl md:text-4xl font-bold mb-2">Global Leaderboard</h2>
            <p className="text-neutral-600 dark:text-neutral-400">
              Top competitors ranked by competitive rating — updated after every battle
            </p>
          </div>
          <Link
            href="/leaderboard"
            className="text-accent-500 hover:text-accent-600 font-semibold text-sm md:text-base whitespace-nowrap"
          >
            View Full Arena →
          </Link>
        </div>

        <div ref={containerRef} className="overflow-x-auto">
          {loading ? (
            <div className="space-y-3" aria-label="Loading leaderboard">
              {[0, 1, 2, 3, 4].map((i) => (
                <div key={i} className="flex items-center gap-4 py-4 px-4 border-b border-neutral-100 dark:border-neutral-800">
                  <div className="h-6 w-6 animate-pulse rounded bg-neutral-100 dark:bg-neutral-800" />
                  <div className="h-8 w-8 animate-pulse rounded-full bg-neutral-100 dark:bg-neutral-800" />
                  <div className="flex-1 space-y-1.5">
                    <div className="h-3 w-1/4 animate-pulse rounded bg-neutral-100 dark:bg-neutral-800" />
                    <div className="h-2.5 w-1/6 animate-pulse rounded bg-neutral-100 dark:bg-neutral-800" />
                  </div>
                  <div className="h-4 w-14 animate-pulse rounded bg-neutral-100 dark:bg-neutral-800" />
                </div>
              ))}
            </div>
          ) : failed ? (
            <div className="rounded-2xl bg-neutral-50 dark:bg-neutral-800/50 p-10 text-center">
              <p className="text-neutral-500 dark:text-neutral-400">
                The Arena is warming up. Live ratings will appear here once the first battles are completed.
              </p>
            </div>
          ) : players.length === 0 ? (
            <div className="rounded-2xl bg-neutral-50 dark:bg-neutral-800/50 p-10 text-center">
              <p className="text-neutral-500 dark:text-neutral-400">
                No rated battles yet. Be the first competitor to make history.
              </p>
              <Link
                href="/leaderboard"
                className="mt-4 inline-block rounded-full bg-neutral-900 dark:bg-white px-5 py-2 text-sm font-semibold text-white dark:text-neutral-900"
              >
                Enter the Arena
              </Link>
            </div>
          ) : (
            <table className="w-full" aria-label="Global leaderboard top competitors">
              <caption className="sr-only">
                Top competitors ranked by competitive rating. Includes rank, name, rating, country, and record.
              </caption>
              <thead>
                <tr className="border-b border-neutral-200 dark:border-neutral-800">
                  <th className="text-left py-4 px-4 font-semibold text-neutral-600 dark:text-neutral-400 text-sm">Rank</th>
                  <th className="text-left py-4 px-4 font-semibold text-neutral-600 dark:text-neutral-400 text-sm">Name</th>
                  <th className="text-left py-4 px-4 font-semibold text-neutral-600 dark:text-neutral-400 text-sm">Rating</th>
                  <th className="text-left py-4 px-4 font-semibold text-neutral-600 dark:text-neutral-400 text-sm">Country</th>
                  <th className="text-right py-4 px-4 font-semibold text-neutral-600 dark:text-neutral-400 text-sm">Record</th>
                </tr>
              </thead>
              <tbody>
                {players.map((user, index) => (
                  <tr
                    key={user.user_id}
                    data-index={index}
                    className="leaderboard-row border-b border-neutral-100 dark:border-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-800/50 transition-colors"
                    style={{
                      opacity: visibleRows[index] ? 1 : 0,
                      transition: `opacity 0.5s ease-out ${index * 0.1}s`,
                    }}
                  >
                    <td className="py-4 px-4">
                      <div className="flex items-center gap-3">
                        {index < 3 ? (
                          <span className="text-xl">{["🥇", "🥈", "🥉"][index]}</span>
                        ) : (
                          <span className="text-lg font-bold text-neutral-400">#{index + 1}</span>
                        )}
                      </div>
                    </td>
                    <td className="py-4 px-4">
                      <div className="flex items-center gap-2">
                        <Link
                          href={`/profile/${user.user_id}`}
                          className="font-semibold text-neutral-900 dark:text-white hover:text-accent-500 hover:underline"
                        >
                          {user.user_name || "Anonymous"}
                        </Link>
                      </div>
                    </td>
                    <td className="py-4 px-4">
                      <span className="font-bold text-accent-500">{fmt(user.rating)} <span className="text-xs font-medium text-neutral-400">{user.rank}</span></span>
                    </td>
                    <td className="py-4 px-4">
                      <span className="text-2xl" title={user.country || "Unknown"}>{flagOf(user.country)}</span>
                    </td>
                    <td className="py-4 px-4 text-right">
                      <span className="font-semibold text-neutral-500 dark:text-neutral-400">
                        {user.wins}W · {user.losses}L
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </section>
  );
}