"use client";

import { useEffect, useRef, useState } from "react";

interface Achievement {
  name: string;
  description: string;
  icon: string;
  rarity: "common" | "rare" | "epic" | "legendary" | "mythic";
  earnedBy: number;
}

const achievements: Achievement[] = [
  { name: "First Blood", description: "Solve your first challenge", icon: "🩸", rarity: "common", earnedBy: 45230 },
  { name: "Linux Warrior", description: "Complete 50 Linux challenges", icon: "🐧", rarity: "rare", earnedBy: 8923 },
  { name: "Cloud Master", description: "Achieve 100K XP in AWS", icon: "☁️", rarity: "rare", earnedBy: 4521 },
  { name: "DevOps Champion", description: "Complete 5 DevOps challenges in a row", icon: "🚀", rarity: "epic", earnedBy: 892 },
  { name: "Speed Demon", description: "Solve a challenge in under 5 minutes", icon: "⚡", rarity: "rare", earnedBy: 12453 },
  { name: "Conqueror", description: "Reach #1 on the global leaderboard", icon: "🌍", rarity: "mythic", earnedBy: 12 },
];

const rarityColors: Record<Achievement["rarity"], string> = {
  common: "from-gray-400 to-gray-300",
  rare: "from-blue-500 to-blue-400",
  epic: "from-purple-600 to-purple-400",
  legendary: "from-yellow-500 to-orange-400",
  mythic: "from-rose-500 to-fuchsia-500",
};

const rarityBorders: Record<Achievement["rarity"], string> = {
  common: "border-gray-400",
  rare: "border-blue-500",
  epic: "border-purple-600",
  legendary: "border-yellow-500",
  mythic: "border-rose-500",
};

const rarityLabels: Record<Achievement["rarity"], string> = {
  common: "Common",
  rare: "Rare",
  epic: "Epic",
  legendary: "Legendary",
  mythic: "Mythic",
};

const rarityLabelStyles: Record<Achievement["rarity"], string> = {
  common: "bg-gray-100 text-gray-600 dark:bg-neutral-800 dark:text-neutral-400",
  rare: "bg-blue-100 text-blue-600 dark:bg-blue-900/40 dark:text-blue-400",
  epic: "bg-purple-100 text-purple-600 dark:bg-purple-900/40 dark:text-purple-400",
  legendary: "bg-yellow-100 text-yellow-600 dark:bg-yellow-900/40 dark:text-yellow-400",
  mythic: "bg-rose-100 text-rose-600 dark:bg-rose-900/40 dark:text-rose-400",
};

const rarityGlow: Record<Achievement["rarity"], string> = {
  common: "",
  rare: "",
  epic: "shadow-lg shadow-purple-500/30",
  legendary: "shadow-xl shadow-yellow-500/40",
  mythic: "shadow-2xl shadow-rose-500/50 animate-mythic-glow",
};

export function AchievementsShowcase() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [visibleBadges, setVisibleBadges] = useState<boolean[]>(new Array(achievements.length).fill(false));

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const badgeElement = entry.target as HTMLElement;
            const index = parseInt(badgeElement.dataset.index || "0");
            setVisibleBadges((prev) => {
              const updated = [...prev];
              updated[index] = true;
              return updated;
            });
          }
        });
      },
      { threshold: 0.2 }
    );

    const badges = containerRef.current?.querySelectorAll(".achievement-badge");
    badges?.forEach((badge) => observer.observe(badge));

    return () => observer.disconnect();
  }, []);

  return (
    <section className="py-16 md:py-24 bg-neutral-50 dark:bg-neutral-950">
      <div className="mx-auto max-w-page px-6">
        <div className="text-center mb-12 md:mb-16">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-accent-500/10 border border-accent-500/30 text-accent-700 dark:text-accent-400 mb-4">
            <span className="text-sm">🏅</span>
            <span className="text-sm font-semibold">Collectible Ranks</span>
          </div>
          <h2 className="display-md text-3xl md:text-4xl font-bold mb-4">Unlock Legendary Achievements</h2>
          <p className="text-neutral-600 dark:text-neutral-400 max-w-2xl mx-auto">
            Earn badges and achievements as you progress through challenges. Each badge represents real expertise.
          </p>
        </div>

        <div ref={containerRef} className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-6 md:gap-8">
          {achievements.map((achievement, index) => (
            <div
              key={achievement.name}
              data-index={index}
              className="achievement-badge"
              style={{
                opacity: visibleBadges[index] ? 1 : 0,
                transform: visibleBadges[index] ? "scale(1)" : "scale(0.8)",
                transition: `opacity 0.5s ease-out ${index * 0.08}s, transform 0.5s ease-out ${index * 0.08}s`,
              }}
            >
              <div className="text-center group cursor-pointer">
                {/* Badge circle */}
                <div
                  className={`relative mx-auto w-20 h-20 md:w-24 md:h-24 rounded-full bg-gradient-to-br ${rarityColors[achievement.rarity]} border-4 ${rarityBorders[achievement.rarity]} ${rarityGlow[achievement.rarity]} flex items-center justify-center text-4xl md:text-5xl mb-3 transition-transform group-hover:scale-110 group-hover:-rotate-6 shadow-lg`}
                >
                  <div className="absolute inset-0 rounded-full animate-pulse opacity-0 group-hover:opacity-100 transition-opacity"></div>
                  {achievement.icon}
                </div>

                {/* Rarity label */}
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide mb-1.5 ${rarityLabelStyles[achievement.rarity]}`}>
                  {rarityLabels[achievement.rarity]}
                </span>

                {/* Badge info */}
                <h3 className="font-bold text-sm md:text-base text-neutral-900 dark:text-white mb-1">
                  {achievement.name}
                </h3>
                <p className="text-xs text-neutral-600 dark:text-neutral-400 leading-tight mb-2">
                  {achievement.description}
                </p>
                <p className="text-xs font-semibold text-accent-500">{achievement.earnedBy.toLocaleString()} earned</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
