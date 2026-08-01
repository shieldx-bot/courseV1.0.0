"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { Bell, CheckCheck, Inbox } from "lucide-react";
import { notificationsApi } from "@/lib/notifications-api";
import type { NotificationItem } from "@/types/notifications";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/toast";

function timeAgo(iso: string): string {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

export default function NotificationsView() {
  const { toast } = useToast();
  const notify = (m: string, t: "info" | "success" | "error" = "info") => toast(m, { type: t });

  const [items, setItems] = useState<NotificationItem[] | null>(null);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "unread">("all");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await notificationsApi.list({ unread_only: filter === "unread" });
      setItems(r.notifications);
      setUnread(r.unread_count);
    } catch (e: any) {
      notify(e?.message || "Failed to load notifications", "error");
    } finally {
      setLoading(false);
    }
  }, [filter, toast]);

  useEffect(() => { load(); }, [load]);

  const markRead = async (id: string) => {
    try {
      await notificationsApi.markRead(id);
      await load();
    } catch {}
  };

  const markAll = async () => {
    try {
      await notificationsApi.markAllRead();
      notify("All marked as read.", "success");
      await load();
    } catch (e: any) {
      notify(e?.message || "Failed", "error");
    }
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-neutral-400">
          <Bell className="h-4 w-4" /> Notifications
        </div>
        {unread > 0 && (
          <Button size="sm" variant="outline" onClick={markAll}>
            <CheckCheck className="h-3.5 w-3.5" /> Mark all read
          </Button>
        )}
      </div>
      <h1 className="mt-2 text-3xl font-bold">Your activity feed</h1>
      <p className="mt-1 text-sm text-neutral-500">Battles, followers, events, achievements — everything that matters in one place.</p>

      <div className="mt-5 flex gap-2">
        {(["all", "unread"] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`rounded-full px-4 py-1.5 text-sm font-semibold ${
              filter === f ? "bg-neutral-900 text-white" : "bg-white text-neutral-600 ring-1 ring-neutral-200"
            }`}
          >
            {f === "all" ? "All" : `Unread${unread > 0 ? ` (${unread})` : ""}`}
          </button>
        ))}
      </div>

      <div className="mt-6 space-y-2">
        {loading ? (
          [0, 1, 2, 3, 4].map(i => <Skeleton key={i} className="h-16 w-full rounded-xl" />)
        ) : (items ?? []).length === 0 ? (
          <div className="rounded-2xl bg-white p-10 text-center shadow-sm ring-1 ring-neutral-200/60">
            <Inbox className="mx-auto h-8 w-8 text-neutral-300" />
            <p className="mt-3 text-sm font-semibold text-neutral-600">
              {filter === "unread" ? "You're all caught up!" : "No notifications yet."}
            </p>
            <p className="mt-1 text-xs text-neutral-400">Follow creators, join events, and compete to start your feed.</p>
          </div>
        ) : (
          (items ?? []).map(n => (
            <button
              key={n.id}
              onClick={() => !n.is_read && markRead(n.id)}
              className={`flex w-full items-start gap-3 rounded-xl p-4 text-left ring-1 transition ${
                n.is_read
                  ? "bg-white ring-neutral-200/60 hover:ring-neutral-300"
                  : "bg-primary-50/50 ring-primary-200 hover:ring-primary-300"
              }`}
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white text-lg ring-1 ring-neutral-200">{n.emoji}</span>
              <div className="min-w-0 flex-1">
                <p className={`text-sm ${n.is_read ? "text-neutral-700" : "font-semibold text-neutral-900"}`}>{n.label}</p>
                {n.actor && <p className="mt-0.5 text-xs text-neutral-400">by {n.actor.name}</p>}
                <p className="mt-0.5 text-xs text-neutral-400">{timeAgo(n.created_at)}</p>
              </div>
              {!n.is_read && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary-500" />}
              {n.link && (
                <Link href={n.link} onClick={e => e.stopPropagation()} className="shrink-0 text-xs font-semibold text-primary-600 hover:underline">
                  Open →
                </Link>
              )}
            </button>
          ))
        )}
      </div>
    </div>
  );
}