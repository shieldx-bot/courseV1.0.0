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

const onlineMembers = [
  { name: "Olivia", emoji: "🦊", status: "solving" },
  { name: "Liam", emoji: "🐺", status: "competing" },
  { name: "Emma", emoji: "🐼", status: "mentoring" },
  { name: "Noah", emoji: "🦉", status: "creating" },
  { name: "Ava", emoji: "🦄", status: "solving" },
  { name: "Ethan", emoji: "🐯", status: "competing" },
];

const trendingDiscussions = [
  { title: "Best strategy to break into Kubernetes?", replies: 42, heat: "🔥" },
  { title: "Share your AWS cert study roadmap", replies: 28, heat: "💬" },
  { title: "Linux or Cloud first in 2026?", replies: 36, heat: "⚡" },
];

const recentlyJoined = ["Mia", "Lucas", "Zoe", "Mateo"];

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
    <section className="py-16 md:py-24 bg-neutral-50 dark:bg-neutral-950">
      <div className="mx-auto max-w-page px-6">
        <div className="flex items-center justify-between mb-12">
          <div>
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-accent-500/10 border border-accent-500/30 text-accent-700 dark:text-accent-400 mb-4">
              <span className="text-sm">💬</span>
              <span className="text-sm font-semibold">Live Community</span>
            </div>
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

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Activity feed */}
          <div ref={containerRef} className="lg:col-span-2 space-y-4">
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
                <div className="p-4 md:p-5 rounded-lg bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 hover:border-accent-500/50 dark:hover:border-accent-500/50 transition-colors group">
                  <div className="flex items-start gap-4">
                    {/* Icon */}
                    <div className="text-3xl flex-shrink-0 mt-1 group-hover:scale-110 transition-transform">{activity.icon}</div>

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

          {/* Community side panel */}
          <div className="space-y-6">
            {/* Who's online */}
            <div className="rounded-lg border border-neutral-200 dark:border-neutral-800 p-5 bg-neutral-50 dark:bg-neutral-800/40">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-neutral-900 dark:text-white">Who’s Online</h3>
                <span className="flex items-center gap-1.5 text-xs font-semibold text-green-600 dark:text-green-400">
                  <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                  1,284
                </span>
              </div>
              <div className="flex flex-wrap gap-2 mb-4">
                {onlineMembers.map((member) => (
                  <div key={member.name} className="relative group" title={`${member.name} · ${member.status}`}>
                    <span className="w-10 h-10 rounded-full bg-gradient-to-br from-accent-500 to-orange-400 flex items-center justify-center text-lg cursor-pointer hover:scale-110 transition-transform">
                      {member.emoji}
                    </span>
                    <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-green-500 border-2 border-white dark:border-neutral-900"></span>
                  </div>
                ))}
              </div>
              <a href="/community" className="text-xs font-semibold text-accent-500 hover:text-accent-600">
                See who’s teaching →
              </a>
            </div>

            {/* Trending discussions */}
            <div className="rounded-lg border border-neutral-200 dark:border-neutral-800 p-5 bg-neutral-50 dark:bg-neutral-800/40">
              <h3 className="font-semibold text-neutral-900 dark:text-white mb-4">Trending Discussions</h3>
              <ul className="space-y-3">
                {trendingDiscussions.map((discussion) => (
                  <li key={discussion.title}>
                    <a href="/community" className="group flex items-start gap-2">
                      <span className="text-lg flex-shrink-0">{discussion.heat}</span>
                      <div>
                        <p className="text-sm font-medium text-neutral-800 dark:text-neutral-200 group-hover:text-accent-500 transition-colors leading-snug">
                          {discussion.title}
                        </p>
                        <p className="text-xs text-neutral-500 dark:text-neutral-500 mt-0.5">{discussion.replies} replies</p>
                      </div>
                    </a>
                  </li>
                ))}
              </ul>
            </div>

            {/* Recently joined */}
            <div className="rounded-lg border border-neutral-200 dark:border-neutral-800 p-5 bg-neutral-50 dark:bg-neutral-800/40">
              <h3 className="font-semibold text-neutral-900 dark:text-white mb-3">Recently Joined</h3>
              <div className="flex items-center gap-2">
                <div className="flex -space-x-2">
                  {recentlyJoined.map((name) => (
                    <span key={name} className="w-8 h-8 rounded-full bg-gradient-to-br from-primary-500 to-accent-500 border-2 border-white dark:border-neutral-900 flex items-center justify-center text-xs font-bold text-white">
                      {name[0]}
                    </span>
                  ))}
                </div>
                <span className="text-xs text-neutral-500 dark:text-neutral-500">+214 this week</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}