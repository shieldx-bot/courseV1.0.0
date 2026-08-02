import type { NotificationItem, NotificationPreferences } from "../types/notifications";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "/api/v1";

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    credentials: "include",
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
  });
  const json = await res.json();
  if (!json.success) throw new Error(json.error || "Request failed");
  return json.data as T;
}

export const notificationsApi = {
  list: (params?: { unread_only?: boolean; limit?: number }) => {
    const q = new URLSearchParams();
    if (params?.unread_only) q.set("unread_only", "true");
    if (params?.limit) q.set("limit", String(params.limit));
    const qs = q.toString();
    return request<{ notifications: NotificationItem[]; unread_count: number; total: number }>(`/notifications${qs ? `?${qs}` : ""}`);
  },
  unreadCount: () => request<{ unread_count: number }>("/notifications/unread-count"),
  markRead: (id: string) => request<{ success: boolean }>(`/notifications/${id}/read`, { method: "POST" }),
  markAllRead: () => request<{ success: boolean }>("/notifications/read-all", { method: "POST" }),
  getPreferences: () => request<NotificationPreferences>("/notifications/preferences"),
  updatePreferences: (body: Partial<NotificationPreferences>) =>
    request<NotificationPreferences>("/notifications/preferences", { method: "PUT", body: JSON.stringify(body) }),
};