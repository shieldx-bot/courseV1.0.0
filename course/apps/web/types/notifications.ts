export interface NotificationItem {
  id: string;
  type: string;
  label: string;
  emoji: string;
  payload: Record<string, any>;
  actor: { user_id: string; name: string; avatar_url?: string } | null;
  link: string | null;
  importance: string;
  is_read: boolean;
  created_at: string;
}

export interface NotificationPreferences {
  in_app_enabled: boolean;
  email_enabled: boolean;
  muted_types: string[];
  quiet_hours: { enabled: boolean; start: string; end: string };
}