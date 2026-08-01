"use client";

import { useEffect, useState } from "react";
import { communityApi } from "../../../lib/community-api";
import type { ActivityEvent } from "../../../types/community";

const EVENT_ICONS: Record<string, string> = {
  challenge_completed: "✅",
  challenge_created: "✨",
  skill_improved: "📈",
  badge_earned: "🏅",
  rank_achieved: "🚀",
  milestone: "🎯",
  content_published: "📝",
  reputation_gained: "⭐",
};

const EVENT_COLORS: Record<string, string> = {
  challenge_completed: "bg-emerald-50 border-emerald-200",
  challenge_created: "bg-indigo-50 border-indigo-200",
  skill_improved: "bg-amber-50 border-amber-200",
  badge_earned: "bg-yellow-50 border-yellow-200",
  rank_achieved: "bg-purple-50 border-purple-200",
  milestone: "bg-rose-50 border-rose-200",
  content_published: "bg-sky-50 border-sky-200",
  reputation_gained: "bg-orange-50 border-orange-200",
};

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "vừa xong";
  if (mins < 60) return `${mins} phút trước`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} giờ trước`;
  const days = Math.floor(hours / 24);
  return `${days} ngày trước`;
}

export default function ActivityPage() {
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [myEvents, setMyEvents] = useState<ActivityEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"feed" | "my">("feed");

  useEffect(() => {
    Promise.all([
      communityApi.getActivityFeed(30).catch(() => ({ events: [] })),
      communityApi.getMyActivity(20).catch(() => ({ events: [] })),
    ]).then(([feed, my]) => {
      setEvents(feed.events || []);
      setMyEvents(my.events || []);
      setLoading(false);
    });
  }, []);

  const list = tab === "feed" ? events : myEvents;

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Hoạt Động Cộng Đồng</h1>
        <p className="text-gray-500">Mọi người đang tiến bộ mỗi ngày — bạn cũng vậy!</p>
      </div>

      <div className="flex gap-2 mb-6">
        <button
          onClick={() => setTab("feed")}
          className={`px-4 py-2 rounded-lg text-sm font-medium ${tab === "feed" ? "bg-indigo-600 text-white" : "bg-white border border-gray-200 text-gray-600"}`}
        >
          🌍 Toàn cộng đồng
        </button>
        <button
          onClick={() => setTab("my")}
          className={`px-4 py-2 rounded-lg text-sm font-medium ${tab === "my" ? "bg-indigo-600 text-white" : "bg-white border border-gray-200 text-gray-600"}`}
        >
          👤 Của tôi
        </button>
      </div>

      {loading ? (
        <div className="text-center py-16 text-gray-500">Đang tải hoạt động...</div>
      ) : list.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-xl text-gray-500">
          {tab === "feed" ? "Chưa có hoạt động nào." : "Bạn chưa có hoạt động nào. Hãy bắt đầu luyện tập!"}
        </div>
      ) : (
        <div className="space-y-3">
          {list.map((e, idx) => (
            <div key={e.id || `${e.user_id}-${e.created_at}-${idx}`} className={`bg-white rounded-xl p-4 border ${EVENT_COLORS[e.type] || "border-gray-200"}`}>
              <div className="flex items-start gap-3">
                <div className="text-2xl">{EVENT_ICONS[e.type] || "📌"}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-sm">{e.user_name || "Người dùng"}</span>
                    <span className="text-xs text-gray-400 shrink-0">{timeAgo(e.created_at)}</span>
                  </div>
                  <p className="text-sm text-gray-700 mt-1">{e.label}</p>
                  {e.payload?.challenge_title && e.payload?.challenge_id && (
                    <a href={`/challenges/${e.payload.challenge_id}`} className="text-xs text-indigo-600 hover:underline mt-1 inline-block">
                      {String(e.payload.challenge_title)}
                    </a>
                  )}
                  {e.payload?.skill_name && e.payload?.mastery_after && (
                    <div className="mt-2 flex items-center gap-2">
                      <span className="text-xs">{String(e.payload.skill_name)}</span>
                      <div className="flex-1 bg-gray-200 rounded-full h-1.5 max-w-[120px]">
                        <div className="bg-indigo-500 h-1.5 rounded-full" style={{ width: `${Number(e.payload.mastery_after) || 0}%` }} />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}