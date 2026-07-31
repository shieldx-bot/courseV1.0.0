"use client";

import { useEffect, useRef, useState } from "react";

interface Achievement {
  name: string;
  description: string;
  icon: string;
  rarity: "common" | "rare" | "epic" | "legendary";
  earnedBy: number;
}

const achievements: Achievement[] = [
  { name: "First Blood", description: "Solve your first challenge", icon: "🩸", rarity: "common", earnedBy: 45230 },
  { name: "Linux Warrior", description: "Complete 50 Linux challenges", icon: "🐧", rarity: "rare", earnedBy: 8923 },
  { name: "Cloud Master", description: "Achieve 100K XP in AWS", icon: "☁️", rarity: "rare", earnedBy: 4521 },
  { name: "DevOps Champion", description: "Complete 5 DevOps challenges in a row", icon: "🚀", rarity: "epic", earnedBy: 892 },
  { name: "Speed Demon", description: "Solve a challenge in under 5 minutes", icon: "⚡", rarity: "rare", earnedBy: 12453 },
  { name: "Legendary Rank", description: "Reach Legendary rank", icon: "👑", rarity: "legendary", earnedBy: 143 },
];

const rarityColors = {
  common: "from-gray-400 to-gray-300",
  rare: "from-blue-500 to-blue-400",
  epic: "from-purple-600 to-purple-400",
  legendary: "from-yellow-500 to-orange-400",
};

const rarityBorders = {
  common: "border-gray-400",
  rare: "border-blue-500",
  epic: "border-purple-600",
  legendary: "border-yellow-500",
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
                  className={`relative mx-auto w-20 h-20 md:w-24 md:h-24 rounded-full bg-gradient-to-br ${rarityColors[achievement.rarity]} border-4 ${rarityBorders[achievement.rarity]} flex items-center justify-center text-4xl md:text-5xl mb-3 transition-transform group-hover:scale-110 shadow-lg`}
                >
                  <div className="absolute inset-0 rounded-full animate-pulse opacity-0 group-hover:opacity-100 transition-opacity"></div>
                  {achievement.icon}
                </div>

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
