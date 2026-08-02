"use client";

import { useEffect, useRef, useState } from "react";

interface Stat {
  value: number;
  label: string;
  suffix: string;
  trend?: string;
}

const stats: Stat[] = [
  { value: 50, label: "Active Competitors", suffix: "K+", trend: "↑ 12% this month" },
  { value: 1000, label: "Challenges Available", suffix: "+" },
  { value: 5, label: "XP Distributed", suffix: "M+", trend: "↑ 18% this month" },
  { value: 120, label: "Countries", suffix: "+" },
];

const formatStat = (stat: Stat, value: number) => {
  if (stat.label === "Challenges Available") return `${value.toLocaleString()}${stat.suffix}`;
  return `${value}${stat.suffix}`;
};

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

    const durations = [1500, 1800, 1400, 1200];
    const intervals = stats.map((stat, index) => {
      return setInterval(() => {
        setCounters((prev) => {
          const updated = [...prev];
          if (updated[index] < stat.value) {
            updated[index] = Math.min(updated[index] + Math.ceil(stat.value / 60), stat.value);
          }
          return updated;
        });
      }, 30);
    });

    const timeout = setTimeout(() => {
      intervals.forEach(clearInterval);
      setCounters(stats.map((s) => s.value));
    }, Math.max(...durations) + 100);

    return () => {
      intervals.forEach(clearInterval);
      clearTimeout(timeout);
    };
  }, [isVisible]);

  return (
    <section ref={containerRef} className="py-12 md:py-16 bg-white dark:bg-neutral-900 border-y border-neutral-200 dark:border-neutral-800">
      <div className="mx-auto max-w-page px-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 md:gap-12">
          {stats.map((stat, index) => (
            <div key={stat.label} className="text-center group">
              <p className="text-4xl md:text-5xl font-bold text-accent-500 mb-2 tabular-nums transition-transform group-hover:scale-105">
                {formatStat(stat, counters[index])}
              </p>
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