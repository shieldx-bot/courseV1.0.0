"use client";

import { useEffect, useRef, useState } from "react";

interface TrendingTech {
  name: string;
  growth: number;
  popularity: number;
  activeLearners: number;
  icon: string;
  color: string;
  sparkline: number[];
  tag: string;
}

const trendingTechs: TrendingTech[] = [
  {
    name: "Kubernetes",
    growth: 38,
    popularity: 94,
    activeLearners: 12840,
    icon: "⚙️",
    color: "from-indigo-500 to-violet-400",
    tag: "Orchestration",
    sparkline: [20, 35, 30, 50, 55, 70, 82, 94],
  },
  {
    name: "AI Engineering",
    growth: 52,
    popularity: 98,
    activeLearners: 21900,
    icon: "🤖",
    color: "from-purple-500 to-fuchsia-400",
    tag: "AI/ML",
    sparkline: [15, 22, 28, 40, 55, 68, 84, 98],
  },
  {
    name: "Rust",
    growth: 44,
    popularity: 87,
    activeLearners: 6730,
    icon: "🦀",
    color: "from-orange-600 to-amber-400",
    tag: "Systems",
    sparkline: [10, 18, 25, 38, 45, 60, 74, 87],
  },
  {
    name: "Go",
    growth: 31,
    popularity: 89,
    activeLearners: 8940,
    icon: "🐹",
    color: "from-sky-500 to-cyan-400",
    tag: "Backend",
    sparkline: [18, 28, 32, 45, 52, 65, 78, 89],
  },
  {
    name: "Linux",
    growth: 22,
    popularity: 96,
    activeLearners: 18400,
    icon: "🐧",
    color: "from-yellow-500 to-amber-400",
    tag: "OS",
    sparkline: [40, 48, 55, 62, 70, 82, 90, 96],
  },
  {
    name: "AWS",
    growth: 27,
    popularity: 95,
    activeLearners: 26700,
    icon: "☁️",
    color: "from-orange-500 to-yellow-400",
    tag: "Cloud",
    sparkline: [35, 45, 52, 62, 70, 80, 90, 95],
  },
  {
    name: "Terraform",
    growth: 41,
    popularity: 88,
    activeLearners: 5210,
    icon: "🏗️",
    color: "from-indigo-600 to-blue-400",
    tag: "IaC",
    sparkline: [12, 20, 30, 42, 55, 68, 80, 88],
  },
  {
    name: "Platform Engineering",
    growth: 49,
    popularity: 86,
    activeLearners: 3980,
    icon: "🛠️",
    color: "from-emerald-500 to-teal-400",
    tag: "Platform",
    sparkline: [8, 15, 24, 36, 50, 64, 78, 86],
  },
];

export function TrendingTechnologies() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [visibleCards, setVisibleCards] = useState<boolean[]>(new Array(trendingTechs.length).fill(false));

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const i = parseInt((entry.target as HTMLElement).dataset.index || "0");
            setVisibleCards((prev) => {
              const next = [...prev];
              next[i] = true;
              return next;
            });
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.15 }
    );
    containerRef.current?.querySelectorAll(".trending-card").forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  return (
    <section ref={containerRef} className="py-16 md:py-24 bg-neutral-50 dark:bg-neutral-950" aria-label="Trending technologies">
      <div className="mx-auto max-w-page px-6">
        <div className="text-center mb-12 md:mb-16">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-accent-500/10 border border-accent-500/30 text-accent-700 dark:text-accent-400 mb-4">
            <span className="text-sm">📈</span>
            <span className="text-sm font-semibold">Trending Now</span>
          </div>
          <h2 className="display-md text-3xl md:text-4xl font-bold mb-4">
            Technologies the World is <span className="bg-gradient-to-r from-accent-500 to-orange-400 bg-clip-text text-transparent">Leaning Into</span>
          </h2>
          <p className="text-neutral-600 dark:text-neutral-400 max-w-2xl mx-auto">
            Real-time demand signals from thousands of learners. These skills are shaping the future — are you in?
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {trendingTechs.map((tech, index) => (
            <div
              key={tech.name}
              data-index={index}
              className="trending-card"
              style={{
                opacity: visibleCards[index] ? 1 : 0,
                transform: visibleCards[index] ? "translateY(0)" : "translateY(24px)",
                transition: `opacity 0.6s ease-out ${index * 0.07}s, transform 0.6s ease-out ${index * 0.07}s`,
              }}
            >
              <div className="group h-full rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-800/40 p-5 hover:border-accent-500/50 hover:shadow-xl hover:-translate-y-1 transition-all duration-300">
                <div className="flex items-center justify-between mb-3">
                  <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${tech.color} flex items-center justify-center text-xl shadow-md`}>
                    {tech.icon}
                  </div>
                  <span className="px-2.5 py-1 rounded-full bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 text-xs font-semibold">
                    ↑ {tech.growth}%
                  </span>
                </div>

                <h3 className="font-bold text-lg text-neutral-900 dark:text-white">{tech.name}</h3>
                <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-4">{tech.tag}</p>

                {/* Sparkline */}
                <div className="flex items-end gap-1 h-10 mb-4" aria-hidden="true">
                  {tech.sparkline.map((value, i) => (
                    <div
                      key={i}
                      className={`flex-1 rounded-sm ${index === 0 ? "bg-gradient-to-t from-accent-500 to-orange-400" : "bg-neutral-300 dark:bg-neutral-700"} group-hover:bg-gradient-to-t group-hover:from-accent-500/70 group-hover:to-orange-400/70 transition-colors duration-300`}
                      style={{ height: `${value}%` }}
                    ></div>
                  ))}
                </div>

                <div className="flex justify-between text-xs text-neutral-500 dark:text-neutral-400 pt-3 border-t border-neutral-200 dark:border-neutral-700">
                  <span>Popularity: <strong className="text-neutral-900 dark:text-white">{tech.popularity}%</strong></span>
                  <span><strong className="text-neutral-900 dark:text-white">{tech.activeLearners.toLocaleString()}</strong> learning</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}