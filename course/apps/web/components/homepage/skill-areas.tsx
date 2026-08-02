"use client";

import { useEffect, useRef, useState } from "react";

interface DifficultyDistribution {
  easy: number;
  medium: number;
  hard: number;
}

interface SkillArea {
  name: string;
  challenges: number;
  users: number;
  icon: string;
  color: string;
  rating: number;
  topContributor: string;
  trending: boolean;
  difficulty: DifficultyDistribution;
}

const skillAreas: SkillArea[] = [
  { name: "Linux", challenges: 156, users: 8400, icon: "🐧", color: "from-blue-600 to-blue-400", rating: 4.8, topContributor: "SysAdmin Pro", trending: true, difficulty: { easy: 45, medium: 70, hard: 41 } },
  { name: "AWS", challenges: 203, users: 12300, icon: "☁️", color: "from-orange-600 to-orange-400", rating: 4.7, topContributor: "CloudArchitect", trending: true, difficulty: { easy: 68, medium: 95, hard: 40 } },
  { name: "Docker", challenges: 98, users: 6200, icon: "🐳", color: "from-blue-600 to-cyan-400", rating: 4.9, topContributor: "TechGuru", trending: false, difficulty: { easy: 40, medium: 41, hard: 17 } },
  { name: "Kubernetes", challenges: 87, users: 4100, icon: "⚙️", color: "from-indigo-600 to-indigo-400", rating: 4.6, topContributor: "K8sRanger", trending: true, difficulty: { easy: 20, medium: 38, hard: 29 } },
  { name: "DevOps", challenges: 124, users: 7800, icon: "🚀", color: "from-red-600 to-pink-400", rating: 4.8, topContributor: "OpsPro", trending: true, difficulty: { easy: 38, medium: 56, hard: 30 } },
  { name: "Networking", challenges: 112, users: 5900, icon: "🌐", color: "from-green-600 to-emerald-400", rating: 4.5, topContributor: "NetNinja", trending: false, difficulty: { easy: 42, medium: 48, hard: 22 } },
];

export function SkillAreas() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const [visibleCards, setVisibleCards] = useState<boolean[]>(new Array(skillAreas.length).fill(false));

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const cardElement = entry.target as HTMLElement;
            const index = parseInt(cardElement.dataset.index || "0");
            setVisibleCards((prev) => {
              const updated = [...prev];
              updated[index] = true;
              return updated;
            });
          }
        });
      },
      { threshold: 0.1 }
    );

    const cards = sectionRef.current?.querySelectorAll(".skill-card");
    cards?.forEach((card) => observer.observe(card));

    return () => observer.disconnect();
  }, []);

  return (
    <section ref={sectionRef} className="py-16 md:py-24 bg-neutral-50 dark:bg-neutral-950">
      <div className="mx-auto max-w-page px-6">
        <div className="text-center mb-12 md:mb-16">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-accent-500/10 border border-accent-500/30 text-accent-700 dark:text-accent-400 mb-4">
            <span className="text-sm">🛠️</span>
            <span className="text-sm font-semibold">Skill Arenas</span>
          </div>
          <h2 className="display-md text-3xl md:text-4xl font-bold mb-4">Master Key Technologies</h2>
          <p className="text-neutral-600 dark:text-neutral-400 max-w-2xl mx-auto">
            Compete across the most in-demand skills and become an expert in your domain.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {skillAreas.map((skill, index) => (
            <div
              key={skill.name}
              data-index={index}
              className="skill-card group"
              style={{
                opacity: visibleCards[index] ? 1 : 0,
                transform: visibleCards[index] ? "translateY(0)" : "translateY(20px)",
                transition: `opacity 0.6s ease-out ${index * 0.1}s, transform 0.6s ease-out ${index * 0.1}s`,
              }}
            >
              <div className={`relative h-[220px] bg-gradient-to-br ${skill.color} rounded-lg p-6 text-white overflow-hidden cursor-pointer hover-lift elevation-2 group-hover:elevation-4 transition-all`}>
                <div className="absolute inset-0 opacity-10 group-hover:opacity-20 transition-opacity">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-white rounded-full mix-blend-overlay filter blur-2xl"></div>
                </div>

                <div className="relative z-10 h-full flex flex-col">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-2xl font-bold">{skill.name}</h3>
                        {skill.trending && (
                          <span className="text-xs font-bold bg-white/20 px-2 py-0.5 rounded-full animate-micro-pulse">
                            🔥 Trending
                          </span>
                        )}
                      </div>
                      <p className="text-white/80 text-sm">{skill.challenges} challenges</p>
                    </div>
                    <span className="text-4xl">{skill.icon}</span>
                  </div>

                  {/* Rating + contributor */}
                  <div className="mb-3">
                    <div className="flex items-center gap-1 text-sm">
                      <span className="text-amber-300">★★★★★</span>
                      <span className="font-bold">{skill.rating.toFixed(1)}</span>
                      <span className="text-white/50 mx-1">·</span>
                      <span className="text-white/70">Top: {skill.topContributor}</span>
                    </div>
                  </div>

                  {/* Difficulty distribution */}
                  <div className="space-y-1.5 mb-3">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-semibold uppercase w-10 text-white/70">Easy</span>
                      <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden">
                        <div className="h-full bg-green-400 rounded-full" style={{ width: `${(skill.difficulty.easy / skill.challenges) * 100}%` }}></div>
                      </div>
                      <span className="text-xs text-white/60 tabular-nums w-8 text-right">{skill.difficulty.easy}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-semibold uppercase w-10 text-white/70">Med</span>
                      <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden">
                        <div className="h-full bg-blue-400 rounded-full" style={{ width: `${(skill.difficulty.medium / skill.challenges) * 100}%` }}></div>
                      </div>
                      <span className="text-xs text-white/60 tabular-nums w-8 text-right">{skill.difficulty.medium}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-semibold uppercase w-10 text-white/70">Hard</span>
                      <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden">
                        <div className="h-full bg-red-400 rounded-full" style={{ width: `${(skill.difficulty.hard / skill.challenges) * 100}%` }}></div>
                      </div>
                      <span className="text-xs text-white/60 tabular-nums w-8 text-right">{skill.difficulty.hard}</span>
                    </div>
                  </div>

                  <div className="mt-auto flex justify-between text-sm">
                    <span className="bg-white/20 px-3 py-1 rounded-full text-white/90 font-medium">{skill.users.toLocaleString()} active</span>
                    <span className="text-white/80">→</span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}