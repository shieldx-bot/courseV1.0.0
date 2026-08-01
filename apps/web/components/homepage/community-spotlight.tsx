"use client";

import { useEffect, useRef, useState } from "react";

interface SpotlightMember {
  name: string;
  role: string;
  achievement: string;
  xpContribution: number;
  helpsGiven: number;
  icon: string;
  gradient: string;
  type: "Top Competitor" | "Top Creator" | "Top Mentor" | "Top Contributor";
}

const spotlightMembers: SpotlightMember[] = [
  {
    name: "DevMaster99",
    role: "Principal Engineer @ CloudScale",
    achievement: "Reached Legendary Rank this month",
    xpContribution: 48200,
    helpsGiven: 132,
    icon: "👑",
    gradient: "from-yellow-500 to-orange-400",
    type: "Top Competitor",
  },
  {
    name: "TechGuru",
    role: "DevOps Lead",
    achievement: "Published 15 challenges this quarter",
    xpContribution: 12400,
    helpsGiven: 86,
    icon: "🎨",
    gradient: "from-purple-500 to-fuchsia-400",
    type: "Top Creator",
  },
  {
    name: "CloudArchitect",
    role: "Solutions Architect @ AWS",
    achievement: "Helped 200+ members pass AWS certs",
    xpContribution: 9800,
    helpsGiven: 214,
    icon: "🤝",
    gradient: "from-blue-500 to-cyan-400",
    type: "Top Mentor",
  },
  {
    name: "OpsPro",
    role: "SRE @ FinTech",
    achievement: "Earned 5,000 XP from community reviews",
    xpContribution: 31000,
    helpsGiven: 47,
    icon: "⭐",
    gradient: "from-green-500 to-emerald-400",
    type: "Top Contributor",
  },
];

export function CommunitySpotlight() {
  const sectionRef = useRef<HTMLElement>(null);
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
    if (sectionRef.current) observer.observe(sectionRef.current);
    return () => observer.disconnect();
  }, []);

  return (
    <section ref={sectionRef} className="py-16 md:py-24 bg-white dark:bg-neutral-900" aria-label="Community spotlight">
      <div className="mx-auto max-w-page px-6">
        <div className="text-center mb-12 md:mb-16">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-accent-500/10 border border-accent-500/30 text-accent-700 dark:text-accent-400 mb-4">
            <span className="text-sm">🌍</span>
            <span className="text-sm font-semibold">Monthly Champions</span>
          </div>
          <h2 className="display-md text-3xl md:text-4xl font-bold mb-4">
            Members Making <span className="bg-gradient-to-r from-accent-500 to-orange-400 bg-clip-text text-transparent">the Community Great</span>
          </h2>
          <p className="text-neutral-600 dark:text-neutral-400 max-w-2xl mx-auto">
            From legendary competitors to selfless mentors — these members embody what Ascendly is all about.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {spotlightMembers.map((member, index) => (
            <div
              key={member.name}
              className="group"
              style={{
                opacity: visible ? 1 : 0,
                transform: visible ? "translateY(0)" : "translateY(24px)",
                transition: `opacity 0.6s ease-out ${index * 0.1}s, transform 0.6s ease-out ${index * 0.1}s`,
              }}
            >
              <div className="h-full rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-800/40 p-6 hover:border-accent-500/50 hover:shadow-xl hover:-translate-y-1 transition-all duration-300 flex flex-col">
                {/* Type badge */}
                <span className="self-start text-xs font-semibold text-accent-700 dark:text-accent-400 px-2.5 py-1 rounded-full bg-accent-500/10 mb-4">
                  {member.type}
                </span>

                {/* Avatar */}
                <div className={`w-16 h-16 rounded-full bg-gradient-to-br ${member.gradient} flex items-center justify-center text-3xl shadow-lg mb-4 group-hover:scale-110 transition-transform`}>
                  {member.icon}
                </div>

                <h3 className="font-bold text-lg text-neutral-900 dark:text-white">{member.name}</h3>
                <p className="text-sm text-neutral-500 dark:text-neutral-400 mb-3">{member.role}</p>

                <p className="text-sm text-neutral-700 dark:text-neutral-300 leading-relaxed mb-5 flex-1">
                  {member.achievement}
                </p>

                <div className="flex items-center justify-between pt-4 border-t border-neutral-200 dark:border-neutral-700">
                  <div className="text-center">
                    <p className="font-bold text-accent-600 dark:text-accent-400 text-sm">{(member.xpContribution / 1000).toFixed(1)}K</p>
                    <p className="text-xs text-neutral-500 dark:text-neutral-400">XP given</p>
                  </div>
                  <div className="text-center">
                    <p className="font-bold text-accent-600 dark:text-accent-400 text-sm">{member.helpsGiven}</p>
                    <p className="text-xs text-neutral-500 dark:text-neutral-400">helps given</p>
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