"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Bell } from "lucide-react";
import { notificationsApi } from "@/lib/notifications-api";

export function NotificationBell() {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        const r = await notificationsApi.unreadCount();
        if (mounted) setCount(r.unread_count);
      } catch {}
    };
    load();
    const interval = setInterval(load, 60000);
    return () => { mounted = false; clearInterval(interval); };
  }, []);

  return (
    <Link href="/notifications" className="relative rounded-lg p-2 text-neutral-200 hover:bg-white/10 hover:text-white transition-all" aria-label={`Notifications${count > 0 ? ` (${count} unread)` : ""}`}>
      <Bell className="h-5 w-5" />
      {count > 0 && (
        <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white">
          {count > 99 ? "99+" : count}
        </span>
      )}
    </Link>
  );
}