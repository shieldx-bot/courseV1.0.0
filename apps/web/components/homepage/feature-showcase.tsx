"use client";

import { useEffect, useRef, useState } from "react";

interface Feature {
  title: string;
  problem: string;
  solution: string;
  outcome: string;
  icon: string;
  color: string;
  metric: string;
}

const features: Feature[] = [
  {
    title: "Competitive Arena",
    problem: "Passive tutorials don't build real skill.",
    solution: "Battle other developers in real-time coding challenges.",
    outcome: "5× faster skill acquisition through applied practice.",
    icon: "⚔️",
    color: "from-red-500 to-pink-500",
    metric: "5× faster",
  },
  {
    title: "Live Leaderboards",
    problem: "No way to measure yourself against the best.",
    solution: "Compete globally and watch your rank climb in real time.",
    outcome: "Top 1% earners promoted into partner roles.",
    icon: "📊",
    color: "from-purple-500 to-indigo-500",
    metric: "Top 1%",
  },
  {
    title: "AI Mentor",
    problem: "Getting stuck means losing momentum.",
    solution: "Get instant, context-aware hints from our AI mentor.",
    outcome: "72% of learners finish challenges without giving up.",
    icon: "🤖",
    color: "from-blue-500 to-cyan-500",
    metric: "72% finish",
  },
  {
    title: "Creator Platform",
    problem: "Your expertise deserves more than a resume bullet.",
    solution: "Build and publish challenges that thousands will solve.",
    outcome: "Top creators earn $2K+/month in rewards.",
    icon: "🎨",
    color: "from-green-500 to-emerald-500",
    metric: "$2K+/mo",
  },
  {
    title: "Skill Tracking",
    problem: "You can't improve what you can't visualize.",
    solution: "Live skill graphs show progress across every domain.",
    outcome: "Learners improve their weakest skill 3× faster.",
    icon: "📈",
    color: "from-orange-500 to-amber-500",
    metric: "3× faster",
  },
  {
    title: "Community Rewards",
    problem: "Learning alone is lonely and unsustainable.",
    solution: "Help peers, earn points, and unlock exclusive perks.",
    outcome: "Members who mentor are 4× more likely to stay active.",
    icon: "🎁",
    color: "from-pink-500 to-red-500",
    metric: "4× retention",
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
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-accent-500/10 border border-accent-500/30 text-accent-700 dark:text-accent-400 mb-4">
            <span className="text-sm">✨</span>
            <span className="text-sm font-semibold">Why Ascendly Works</span>
          </div>
          <h2 className="display-md text-3xl md:text-4xl font-bold mb-4">Powerful Features for Champions</h2>
          <p className="text-neutral-600 dark:text-neutral-400 max-w-2xl mx-auto">
            Every feature is built to solve a real problem and deliver a measurable outcome.
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
                <div className="relative z-10 text-white flex flex-col h-full">
                  <div className="flex items-start justify-between mb-4">
                    <div className="text-5xl">{feature.icon}</div>
                    <span className="bg-white/20 px-3 py-1 rounded-full text-xs font-bold whitespace-nowrap">
                      {feature.metric}
                    </span>
                  </div>

                  <h3 className="text-xl font-bold mb-4">{feature.title}</h3>

                  {/* Problem → Solution → Outcome */}
                  <div className="space-y-3 text-sm leading-relaxed flex-1">
                    <div className="flex items-start gap-2">
                      <span className="text-xs font-bold uppercase text-red-200 bg-red-500/20 px-2 py-0.5 rounded flex-shrink-0 mt-0.5">Problem</span>
                      <p className="text-white/80">{feature.problem}</p>
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="text-xs font-bold uppercase text-blue-200 bg-blue-500/20 px-2 py-0.5 rounded flex-shrink-0 mt-0.5">Solution</span>
                      <p className="text-white/90">{feature.solution}</p>
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="text-xs font-bold uppercase text-green-200 bg-green-500/20 px-2 py-0.5 rounded flex-shrink-0 mt-0.5">Outcome</span>
                      <p className="text-white font-medium">{feature.outcome}</p>
                    </div>
                  </div>
                </div>

                {/* Bottom accent */}
                <div className="absolute bottom-0 left-0 w-32 h-1 bg-white/30 group-hover:w-full transition-all duration-500"></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}