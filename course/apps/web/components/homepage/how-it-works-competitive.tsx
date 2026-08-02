"use client";

import { useEffect, useRef, useState } from "react";

interface Step {
  number: number;
  title: string;
  description: string;
  icon: string;
}

const steps: Step[] = [
  { number: 1, title: "Register", description: "Create your account and set up your profile", icon: "👤" },
  { number: 2, title: "Join Challenge", description: "Pick a challenge that matches your skill level", icon: "🎯" },
  { number: 3, title: "Solve & Build", description: "Write code, solve problems, build projects", icon: "💻" },
  { number: 4, title: "Earn XP", description: "Get rewarded for solving challenges", icon: "⭐" },
  { number: 5, title: "Climb Ranks", description: "Rise through the leaderboards", icon: "📈" },
  { number: 6, title: "Earn Badges", description: "Unlock achievements and certifications", icon: "🏆" },
  { number: 7, title: "Build Portfolio", description: "Showcase your skills to employers", icon: "📂" },
  { number: 8, title: "Become Legendary", description: "Join the community of elite developers", icon: "👑" },
];

export function HowItWorksCompetitive() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [visibleSteps, setVisibleSteps] = useState<boolean[]>(new Array(steps.length).fill(false));

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const stepElement = entry.target as HTMLElement;
            const index = parseInt(stepElement.dataset.index || "0");
            setVisibleSteps((prev) => {
              const updated = [...prev];
              updated[index] = true;
              return updated;
            });
          }
        });
      },
      { threshold: 0.2 }
    );

    const stepElements = containerRef.current?.querySelectorAll(".step-item");
    stepElements?.forEach((el) => observer.observe(el));

    return () => observer.disconnect();
  }, []);

  return (
    <section className="py-16 md:py-24 bg-white dark:bg-neutral-900">
      <div className="mx-auto max-w-page px-6">
        <div className="text-center mb-12 md:mb-16">
          <h2 className="display-md text-3xl md:text-4xl font-bold mb-4">Your Journey to Legendary Status</h2>
          <p className="text-neutral-600 dark:text-neutral-400 max-w-2xl mx-auto">
            Follow these 8 steps to transform from learner to competitive legend.
          </p>
        </div>

        <div ref={containerRef} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {steps.map((step, index) => (
            <div
              key={step.number}
              data-index={index}
              className="step-item group"
              style={{
                opacity: visibleSteps[index] ? 1 : 0,
                transform: visibleSteps[index] ? "translateY(0)" : "translateY(20px)",
                transition: `opacity 0.5s ease-out ${index * 0.08}s, transform 0.5s ease-out ${index * 0.08}s`,
              }}
            >
              <div className="relative p-6 rounded-lg bg-neutral-50 dark:bg-neutral-800 hover:bg-neutral-100 dark:hover:bg-neutral-700 border border-neutral-200 dark:border-neutral-700 transition-colors h-full">
                {/* Step number circle */}
                <div className="absolute -top-4 left-6">
                  <div className="w-8 h-8 bg-accent-500 text-white rounded-full flex items-center justify-center font-bold text-sm">
                    {step.number}
                  </div>
                </div>

                {/* Icon */}
                <div className="text-4xl mb-4 mt-2">{step.icon}</div>

                {/* Content */}
                <h3 className="text-lg font-semibold mb-2 text-neutral-900 dark:text-white">{step.title}</h3>
                <p className="text-sm text-neutral-600 dark:text-neutral-400 leading-relaxed">{step.description}</p>

                {/* Connecting line (visual) */}
                {index < steps.length - 1 && (
                  <div className="absolute -right-3 top-1/2 w-6 h-0.5 bg-gradient-to-r from-accent-500 to-transparent hidden lg:block"></div>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Progress visualization */}
        <div className="mt-16 pt-12 border-t border-neutral-200 dark:border-neutral-800">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="text-center">
              <p className="text-4xl md:text-5xl font-bold text-accent-500 mb-2">2-4 weeks</p>
              <p className="text-neutral-600 dark:text-neutral-400">Average time to reach Gold rank</p>
            </div>
            <div className="text-center">
              <p className="text-4xl md:text-5xl font-bold text-accent-500 mb-2">10K+</p>
              <p className="text-neutral-600 dark:text-neutral-400">XP earned per challenge solved</p>
            </div>
            <div className="text-center">
              <p className="text-4xl md:text-5xl font-bold text-accent-500 mb-2">100+</p>
              <p className="text-neutral-600 dark:text-neutral-400">Badges to unlock</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
