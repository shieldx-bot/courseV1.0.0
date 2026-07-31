"use client";

import { useEffect, useRef, useState } from "react";

interface Activity {
  type: "achievement" | "challenge" | "rank" | "badge";
  user: string;
  action: string;
  details: string;
  timestamp: string;
  icon: string;
}

const activities: Activity[] = [
  {
    type: "achievement",
    user: "Sarah Chen",
    action: "Unlocked Achievement",
    details: "Cloud Master",
    timestamp: "2 mins ago",
    icon: "🏆",
  },
  {
    type: "challenge",
    user: "Alex Rivera",
    action: "Solved Challenge",
    details: "Kubernetes Advanced - Deploy a Microservices App",
    timestamp: "5 mins ago",
    icon: "✅",
  },
  {
    type: "rank",
    user: "Jordan Kim",
    action: "Promoted to",
    details: "Platinum Rank",
    timestamp: "12 mins ago",
    icon: "📈",
  },
  {
    type: "badge",
    user: "Morgan Lee",
    action: "Earned Badge",
    details: "Linux Warrior (50 Challenges)",
    timestamp: "28 mins ago",
    icon: "⭐",
  },
  {
    type: "achievement",
    user: "Casey Taylor",
    action: "Reached",
    details: "500K XP Milestone",
    timestamp: "1 hour ago",
    icon: "🎉",
  },
];

export function CommunityActivity() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [visibleActivities, setVisibleActivities] = useState<boolean[]>(
    new Array(activities.length).fill(false)
  );

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const activityElement = entry.target as HTMLElement;
            const index = parseInt(activityElement.dataset.index || "0");
            setVisibleActivities((prev) => {
              const updated = [...prev];
              updated[index] = true;
              return updated;
            });
          }
        });
      },
      { threshold: 0.2 }
    );

    const items = containerRef.current?.querySelectorAll(".activity-item");
    items?.forEach((item) => observer.observe(item));

    return () => observer.disconnect();
  }, []);

  return (
    <section className="py-16 md:py-24 bg-white dark:bg-neutral-900">
      <div className="mx-auto max-w-page px-6">
        <div className="flex items-center justify-between mb-12">
          <div>
            <h2 className="display-md text-3xl md:text-4xl font-bold mb-2">Community Highlights</h2>
            <p className="text-neutral-600 dark:text-neutral-400">
              See what the community is accomplishing right now
            </p>
          </div>
          <a
            href="/community"
            className="text-accent-500 hover:text-accent-600 font-semibold text-sm md:text-base whitespace-nowrap"
          >
            View Feed →
          </a>
        </div>

        <div ref={containerRef} className="space-y-4">
          {activities.map((activity, index) => (
            <div
              key={index}
              data-index={index}
              className="activity-item"
              style={{
                opacity: visibleActivities[index] ? 1 : 0,
                transform: visibleActivities[index] ? "translateX(0)" : "translateX(-20px)",
                transition: `opacity 0.5s ease-out ${index * 0.1}s, transform 0.5s ease-out ${index * 0.1}s`,
              }}
            >
              <div className="p-4 md:p-5 rounded-lg bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 hover:border-accent-500/50 dark:hover:border-accent-500/50 transition-colors">
                <div className="flex items-start gap-4">
                  {/* Icon */}
                  <div className="text-3xl flex-shrink-0 mt-1">{activity.icon}</div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 sm:gap-2">
                      <p className="text-neutral-900 dark:text-white">
                        <span className="font-semibold">{activity.user}</span>
                        <span className="text-neutral-600 dark:text-neutral-400"> {activity.action}</span>
                      </p>
                      <p className="text-xs text-neutral-500 dark:text-neutral-500 flex-shrink-0">
                        {activity.timestamp}
                      </p>
                    </div>
                    <p className="text-sm text-accent-600 dark:text-accent-400 font-medium mt-1">
                      {activity.details}
                    </p>
                  </div>

                  {/* Arrow */}
                  <div className="text-neutral-300 dark:text-neutral-700 flex-shrink-0">→</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
