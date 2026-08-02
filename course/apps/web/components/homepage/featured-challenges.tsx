"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";

interface FeaturedChallenge {
  id: string;
  title: string;
  difficulty: "Easy" | "Medium" | "Hard";
  rating: number;
  participants: number;
  creator: string;
  estimatedTime: string;
  popularity: number;
  icon: string;
  gradient: string;
  category: string;
}

const featuredChallenges: FeaturedChallenge[] = [
  {
    id: "docker-networking-expert",
    title: "Docker Networking Expert",
    difficulty: "Medium",
    rating: 4.8,
    participants: 12340,
    creator: "TechGuru",
    estimatedTime: "2h",
    popularity: 96,
    icon: "🐳",
    gradient: "from-blue-500 to-cyan-400",
    category: "DevOps",
  },
  {
    id: "k8s-operator-patterns",
    title: "Kubernetes Operator Patterns",
    difficulty: "Hard",
    rating: 4.9,
    participants: 8421,
    creator: "CloudArchitect",
    estimatedTime: "4h",
    popularity: 92,
    icon: "⚙️",
    gradient: "from-indigo-500 to-violet-400",
    category: "Containers",
  },
  {
    id: "serverless-aws-lambda",
    title: "Serverless with AWS Lambda",
    difficulty: "Medium",
    rating: 4.7,
    participants: 15670,
    creator: "OpsPro",
    estimatedTime: "2.5h",
    popularity: 94,
    icon: "⚡",
    gradient: "from-orange-500 to-amber-400",
    category: "Cloud",
  },
];

function getDifficultyStyles(d: FeaturedChallenge["difficulty"]) {
  switch (d) {
    case "Easy":
      return "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400";
    case "Medium":
      return "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400";
    case "Hard":
      return "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400";
  }
}

export function FeaturedChallenges() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.15 }
    );
    if (containerRef.current) observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  return (
    <section ref={containerRef} className="py-16 md:py-24 bg-white dark:bg-neutral-900" aria-label="Featured challenges">
      <div className="mx-auto max-w-page px-6">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-12 gap-6">
          <div>
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-accent-500/10 border border-accent-500/30 text-accent-700 dark:text-accent-400 mb-4">
              <span className="text-sm">🎖️</span>
              <span className="text-sm font-semibold">Editor’s Picks</span>
            </div>
            <h2 className="display-md text-3xl md:text-4xl font-bold mb-2">Featured Challenges</h2>
            <p className="text-neutral-600 dark:text-neutral-400 max-w-xl">
              Hand-picked by the community for the biggest learning impact.
            </p>
          </div>
          <Link
            href="/challenges"
            className="text-accent-500 hover:text-accent-600 font-semibold text-sm md:text-base whitespace-nowrap"
          >
            Browse All Challenges →
          </Link>
        </div>

        <div className="space-y-5">
          {featuredChallenges.map((challenge, index) => (
            <div
              key={challenge.id}
              className="group"
              style={{
                opacity: visible ? 1 : 0,
                transform: visible ? "translateX(0)" : "translateX(24px)",
                transition: `opacity 0.6s ease-out ${index * 0.12}s, transform 0.6s ease-out ${index * 0.12}s`,
              }}
            >
              <Link href={`/courses/${challenge.category.toLowerCase()}/${challenge.id}`} className="block">
                <div className="rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-5 md:p-6 hover:border-accent-500/50 hover:shadow-xl hover:-translate-y-1 transition-all duration-300 flex flex-col md:flex-row gap-5 md:items-center">
                  {/* Icon */}
                  <div className={`w-14 h-14 md:w-16 md:h-16 flex-shrink-0 rounded-2xl bg-gradient-to-br ${challenge.gradient} flex items-center justify-center text-2xl md:text-3xl shadow-lg group-hover:scale-110 transition-transform`}>
                    {challenge.icon}
                  </div>

                  {/* Main info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1.5">
                      <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${getDifficultyStyles(challenge.difficulty)}`}>
                        {challenge.difficulty}
                      </span>
                      <span className="text-xs text-neutral-500 dark:text-neutral-400">{challenge.category}</span>
                    </div>
                    <h3 className="font-bold text-lg text-neutral-900 dark:text-white truncate">{challenge.title}</h3>
                    <p className="text-sm text-neutral-600 dark:text-neutral-400 mt-0.5">
                      by <span className="font-medium text-accent-600 dark:text-accent-400">{challenge.creator}</span> · ⏱️ {challenge.estimatedTime}
                    </p>
                  </div>

                  {/* Stats */}
                  <div className="flex flex-row md:flex-col gap-4 md:gap-2 md:items-end flex-shrink-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-amber-400 text-sm">★</span>
                      <span className="font-bold text-neutral-900 dark:text-white">{challenge.rating.toFixed(1)}</span>
                      <span className="text-xs text-neutral-400">({challenge.participants.toLocaleString()})</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-20 h-1.5 bg-neutral-200 dark:bg-neutral-700 rounded-full overflow-hidden">
                        <div className="h-full rounded-full bg-gradient-to-r from-accent-500 to-orange-400" style={{ width: `${challenge.popularity}%` }}></div>
                      </div>
                      <span className="text-xs text-neutral-500 dark:text-neutral-400">{challenge.popularity}%</span>
                    </div>
                  </div>
                </div>
              </Link>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}