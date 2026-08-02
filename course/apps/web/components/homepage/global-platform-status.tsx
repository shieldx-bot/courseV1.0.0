"use client";

import { useEffect, useRef, useState } from "react";

interface PlatformStat {
  label: string;
  value: number;
  suffix?: string;
  icon: string;
  format?: (v: number) => string;
}

const platformStats: PlatformStat[] = [
  { label: "Challenges Solved Today", value: 12847, suffix: "", icon: "⚡", format: (v) => v.toLocaleString() },
  { label: "XP Earned Today", value: 2845900, suffix: "", icon: "⭐", format: (v) => `${Math.round(v / 1000)}K+` },
  { label: "Active Competitions", value: 342, suffix: "", icon: "🏆" },
  { label: "Online Users", value: 8912, suffix: "", icon: "🟢", format: (v) => v.toLocaleString() },
  { label: "Newest Creators", value: 156, suffix: "", icon: "🎨" },
  { label: "Countries Online", value: 87, suffix: "", icon: "🌍" },
];

function useCountUp(target: number, start: boolean, duration = 1800) {
  const [value, setValue] = useState(0);

  useEffect(() => {
    if (!start) return;
    let raf = 0;
    const t0 = performance.now();
    const tick = (t: number) => {
      const p = Math.min((t - t0) / duration, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      setValue(Math.round(target * eased));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [start, target, duration]);

  return value;
}

function PlatformStatCard({ stat, index, start }: { stat: PlatformStat; index: number; start: boolean }) {
  const value = useCountUp(stat.value, start);
  const formatted = stat.format ? stat.format(value) : value.toLocaleString();

  return (
    <div
      className="group relative rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-5 hover:border-accent-500/50 hover:shadow-lg transition-all duration-300 hover:-translate-y-1"
    >
      <div className="flex items-center justify-between mb-3">
        <span className="text-2xl" aria-hidden="true">{stat.icon}</span>
        <span className="relative flex h-2.5 w-2.5">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-60"></span>
          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500"></span>
        </span>
      </div>
      <p className="text-2xl md:text-3xl font-bold text-neutral-900 dark:text-white tabular-nums">
        {formatted}
        {stat.suffix}
      </p>
      <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">{stat.label}</p>
    </div>
  );
}

export function GlobalPlatformStatus() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);

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
    if (sectionRef.current) observer.observe(sectionRef.current);
    return () => observer.disconnect();
  }, []);

  return (
    <section
      ref={sectionRef}
      className="py-16 md:py-24 bg-gradient-to-br from-primary-900 via-primary-900 to-primary-950 text-white relative overflow-hidden"
      aria-label="Global platform status"
    >
      <div className="absolute inset-0 opacity-20">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-accent-500 rounded-full mix-blend-multiply filter blur-3xl animate-float"></div>
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-primary-600 rounded-full mix-blend-multiply filter blur-3xl animate-float" style={{ animationDelay: "2s" }}></div>
      </div>

      <div className="relative mx-auto max-w-page px-6">
        <div className="text-center mb-12 md:mb-16">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/10 border border-white/20 mb-6">
            <span className="w-2 h-2 bg-accent-500 rounded-full animate-pulse"></span>
            <span className="text-sm font-medium text-white/90">Live Platform Activity</span>
          </div>
          <h2 className="display-md text-3xl md:text-4xl font-bold mb-4 text-white">
            The Arena is Alive <span className="bg-gradient-to-r from-accent-400 to-orange-400 bg-clip-text text-transparent">Right Now</span>
          </h2>
          <p className="text-neutral-300 max-w-2xl mx-auto">
            Thousands of developers are solving challenges, earning XP, and climbing the ranks as you read this.
          </p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 md:gap-6">
          {platformStats.map((stat, index) => (
            <PlatformStatCard key={stat.label} stat={stat} index={index} start={isVisible} />
          ))}
        </div>
      </div>
    </section>
  );
}