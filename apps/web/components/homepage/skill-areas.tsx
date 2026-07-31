"use client";

import { useEffect, useRef, useState } from "react";

interface SkillArea {
  name: string;
  challenges: number;
  users: number;
  icon: string;
  color: string;
}

const skillAreas: SkillArea[] = [
  { name: "Linux", challenges: 156, users: 8400, icon: "🐧", color: "from-blue-600 to-blue-400" },
  { name: "AWS", challenges: 203, users: 12300, icon: "☁️", color: "from-orange-600 to-orange-400" },
  { name: "Docker", challenges: 98, users: 6200, icon: "🐳", color: "from-blue-600 to-cyan-400" },
  { name: "Kubernetes", challenges: 87, users: 4100, icon: "⚙️", color: "from-indigo-600 to-indigo-400" },
  { name: "DevOps", challenges: 124, users: 7800, icon: "🚀", color: "from-red-600 to-pink-400" },
  { name: "Networking", challenges: 112, users: 5900, icon: "🌐", color: "from-green-600 to-emerald-400" },
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
              <div className={`relative h-48 bg-gradient-to-br ${skill.color} rounded-lg p-6 text-white overflow-hidden cursor-pointer hover-lift elevation-2 group-hover:elevation-4 transition-all`}>
                <div className="absolute inset-0 opacity-10 group-hover:opacity-20 transition-opacity">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-white rounded-full mix-blend-overlay filter blur-2xl"></div>
                </div>

                <div className="relative z-10 h-full flex flex-col justify-between">
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="text-2xl font-bold mb-1">{skill.name}</h3>
                      <p className="text-white/80 text-sm">{skill.challenges} challenges</p>
                    </div>
                    <span className="text-4xl">{skill.icon}</span>
                  </div>

                  <div className="flex justify-between text-sm">
                    <span className="bg-white/20 px-3 py-1 rounded-full text-white/90 font-medium">{skill.users.toLocaleString()} competing</span>
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
