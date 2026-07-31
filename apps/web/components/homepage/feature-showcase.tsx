"use client";

import { useEffect, useRef, useState } from "react";

interface Feature {
  title: string;
  description: string;
  icon: string;
  color: string;
}

const features: Feature[] = [
  {
    title: "Competitive Arena",
    description: "Battle other developers in real-time coding challenges. Test your skills against the best.",
    icon: "⚔️",
    color: "from-red-500 to-pink-500",
  },
  {
    title: "Live Leaderboards",
    description: "Compete globally and watch your rank climb. Make it to the top and earn glory.",
    icon: "📊",
    color: "from-purple-500 to-indigo-500",
  },
  {
    title: "AI Mentor",
    description: "Get instant feedback and hints from our AI mentor. Learn from mistakes in real-time.",
    icon: "🤖",
    color: "from-blue-500 to-cyan-500",
  },
  {
    title: "Creator Platform",
    description: "Build and sell your own challenges. Earn rewards for creating quality content.",
    icon: "🎨",
    color: "from-green-500 to-emerald-500",
  },
  {
    title: "Skill Tracking",
    description: "Visual skill graphs show your progress. Track improvement across all domains.",
    icon: "📈",
    color: "from-orange-500 to-amber-500",
  },
  {
    title: "Community Rewards",
    description: "Help others, earn points, and unlock exclusive perks. Grow together.",
    icon: "🎁",
    color: "from-pink-500 to-red-500",
  },
];

export function FeatureShowcase() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [visibleCards, setVisibleCards] = useState<boolean[]>(new Array(features.length).fill(false));

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

    const cards = containerRef.current?.querySelectorAll(".feature-card");
    cards?.forEach((card) => observer.observe(card));

    return () => observer.disconnect();
  }, []);

  return (
    <section className="py-16 md:py-24 bg-neutral-50 dark:bg-neutral-950">
      <div className="mx-auto max-w-page px-6">
        <div className="text-center mb-12 md:mb-16">
          <h2 className="display-md text-3xl md:text-4xl font-bold mb-4">Powerful Features for Champions</h2>
          <p className="text-neutral-600 dark:text-neutral-400 max-w-2xl mx-auto">
            Everything you need to compete, learn, and build your reputation as a tech expert.
          </p>
        </div>

        <div ref={containerRef} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {features.map((feature, index) => (
            <div
              key={feature.title}
              data-index={index}
              className="feature-card"
              style={{
                opacity: visibleCards[index] ? 1 : 0,
                transform: visibleCards[index] ? "translateY(0)" : "translateY(30px)",
                transition: `opacity 0.6s ease-out ${index * 0.1}s, transform 0.6s ease-out ${index * 0.1}s`,
              }}
            >
              <div className={`bg-gradient-to-br ${feature.color} rounded-lg p-8 h-full relative overflow-hidden group cursor-pointer hover-lift`}>
                {/* Background glow effect */}
                <div className="absolute inset-0 opacity-0 group-hover:opacity-20 transition-opacity">
                  <div className="absolute -top-8 -right-8 w-32 h-32 bg-white rounded-full filter blur-2xl"></div>
                </div>

                {/* Content */}
                <div className="relative z-10 text-white">
                  <div className="text-5xl mb-4">{feature.icon}</div>
                  <h3 className="text-xl font-bold mb-3">{feature.title}</h3>
                  <p className="text-white/90 leading-relaxed">{feature.description}</p>
                </div>

                {/* Bottom accent */}
                <div className="absolute bottom-0 right-0 w-32 h-1 bg-white/30 group-hover:w-64 transition-all duration-500"></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
