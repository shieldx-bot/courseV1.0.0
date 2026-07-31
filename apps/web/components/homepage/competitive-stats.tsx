"use client";

import { useEffect, useRef, useState } from "react";

interface Stat {
  value: string;
  label: string;
  trend?: string;
}

const stats: Stat[] = [
  { value: "50K+", label: "Active Competitors", trend: "↑ 12% this month" },
  { value: "1000+", label: "Challenges Available" },
  { value: "5M+", label: "XP Distributed" },
  { value: "120+", label: "Countries" },
];

export function CompetitiveStats() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [counters, setCounters] = useState<number[]>([0, 0, 0, 0]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.3 }
    );

    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!isVisible) return;

    const intervals = [
      setInterval(() => setCounters((prev) => {
        const updated = [...prev];
        if (updated[0] < 50) updated[0] += 1;
        return updated;
      }), 30),
    ];

    return () => intervals.forEach(clearInterval);
  }, [isVisible]);

  return (
    <section ref={containerRef} className="py-12 md:py-16 bg-white dark:bg-neutral-900 border-y border-neutral-200 dark:border-neutral-800">
      <div className="mx-auto max-w-page px-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 md:gap-12">
          {stats.map((stat, index) => (
            <div key={stat.label} className="text-center">
              <p className="text-4xl md:text-5xl font-bold text-accent-500 mb-2">{stat.value}</p>
              <p className="text-sm md:text-base text-neutral-600 dark:text-neutral-400 font-medium">{stat.label}</p>
              {stat.trend && (
                <p className="text-xs text-green-600 dark:text-green-400 mt-2 font-semibold">{stat.trend}</p>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
