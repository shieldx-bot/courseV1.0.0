"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { Calendar, Users, MapPin, Repeat, Play, Sparkles } from "lucide-react";
import { ecosystemApi } from "@/lib/ecosystem-api";
import type { PlatformEvent } from "@/types/ecosystem";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/toast";

const EVENT_TYPE_META: Record<string, { label: string; badge: string; icon: string }> = {
  weekly_challenge: { label: "Weekly Challenge", badge: "bg-emerald-100 text-emerald-700", icon: "⚡" },
  monthly_championship: { label: "Championship", badge: "bg-amber-100 text-amber-700", icon: "🏆" },
  hackathon: { label: "Hackathon", badge: "bg-purple-100 text-purple-700", icon: "💻" },
  community_night: { label: "Community Night", badge: "bg-sky-100 text-sky-700", icon: "🌙" },
  office_hours: { label: "Office Hours", badge: "bg-cyan-100 text-cyan-700", icon: "🕐" },
  creator_livestream: { label: "Livestream", badge: "bg-rose-100 text-rose-700", icon: "📺" },
  ama: { label: "AMA", badge: "bg-indigo-100 text-indigo-700", icon: "🎤" },
  certification_week: { label: "Certification", badge: "bg-teal-100 text-teal-700", icon: "📜" },
  university_cup: { label: "University Cup", badge: "bg-orange-100 text-orange-700", icon: "🎓" },
  company_event: { label: "Company Event", badge: "bg-slate-100 text-slate-700", icon: "🏢" },
};

const EVENT_TYPES = Object.keys(EVENT_TYPE_META);

function fmtDate(iso: string): { date: string; time: string } {
  const d = new Date(iso);
  const date = d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
  const time = d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  return { date, time };
}

export default function EventsPage() {
  const { toast } = useToast();
  const notify = (message: string, type: "info" | "success" | "error" | "warning" = "info") =>
    toast(message, { type });

  const [events, setEvents] = useState<PlatformEvent[] | null>(null);
  const [filter, setFilter] = useState<string>("all");
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState({
    title: "", description: "", event_type: "community_night",
    start_time: "", mode: "online", location: "", capacity: "",
    recurring: false, interval_days: "",
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = filter === "all" ? {} : { event_type: filter };
      const result = await ecosystemApi.listEvents(params);
      setEvents(result.events);
    } catch (e: any) {
      notify(e?.message || "Failed to load events", "error");
    } finally {
      setLoading(false);
    }
  }, [filter, toast]);

  useEffect(() => { load(); }, [load]);

  const createEvent = async () => {
    if (!createForm.title) { notify("Event title is required", "error"); return; }
    setCreating(true);
    try {
      await ecosystemApi.createEvent({
        title: createForm.title,
        description: createForm.description,
        event_type: createForm.event_type,
        start_time: createForm.start_time || undefined,
        mode: createForm.mode,
        location: createForm.location,
        capacity: createForm.capacity ? Number(createForm.capacity) : undefined,
        recurring: createForm.recurring,
        interval_days: createForm.interval_days ? Number(createForm.interval_days) : undefined,
      });
      notify("Event created! The community can now join.", "success");
      setCreateOpen(false);
      setCreateForm({ title: "", description: "", event_type: "community_night", start_time: "", mode: "online", location: "", capacity: "", recurring: false, interval_days: "" });
      await load();
    } catch (e: any) {
      notify(e?.message || "Failed to create event", "error");
    } finally {
      setCreating(false);
    }
  };

  const join = async (eventId: string) => {
    try {
      await ecosystemApi.joinEvent(eventId);
      notify("You're in! See you there.", "success");
      await load();
    } catch (e: any) {
      notify(e?.message || "Failed to join", "error");
    }
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Hero */}
      <div className="rounded-3xl bg-gradient-to-br from-indigo-700 via-violet-600 to-purple-600 p-8 text-white shadow-lg sm:p-10">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-white/70">
              <Calendar className="h-4 w-4" /> Community Calendar
            </div>
            <h1 className="mt-2 text-3xl font-bold sm:text-4xl">Events, live & together.</h1>
            <p className="mt-2 max-w-xl text-sm text-white/85 sm:text-base">
              Weekly challenges, AMAs, hackathons, and more — where the community levels up together.
            </p>
          </div>
          <Button onClick={() => setCreateOpen(v => !v)} className="bg-white text-violet-700 hover:bg-violet-50">
            <Sparkles className="h-4 w-4" /> Host an event
          </Button>
        </div>

        {/* Create form */}
        {createOpen && (
          <div className="mt-6 rounded-2xl bg-white/10 p-5 ring-1 ring-white/25 backdrop-blur-sm">
            <h3 className="font-bold text-white">Create a Community Event</h3>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div>
                <label className="text-xs font-semibold text-white/60">Title *</label>
                <input
                  value={createForm.title}
                  onChange={e => setCreateForm(f => ({ ...f, title: e.target.value }))}
                  placeholder="Weekly Algorithm Battle #2"
                  className="mt-1 w-full rounded-xl border border-white/20 bg-white/10 px-4 py-2.5 text-sm text-white placeholder-white/40 outline-none"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-white/60">Type</label>
                <select
                  value={createForm.event_type}
                  onChange={e => setCreateForm(f => ({ ...f, event_type: e.target.value }))}
                  className="mt-1 w-full rounded-xl border border-white/20 bg-white/10 px-4 py-2.5 text-sm text-white outline-none"
                >
                  {EVENT_TYPES.map(t => (
                    <option key={t} value={t} className="text-neutral-800">{EVENT_TYPE_META[t]?.label || t}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-white/60">Start time</label>
                <input
                  type="datetime-local"
                  value={createForm.start_time}
                  onChange={e => setCreateForm(f => ({ ...f, start_time: e.target.value }))}
                  className="mt-1 w-full rounded-xl border border-white/20 bg-white/10 px-4 py-2.5 text-sm text-white outline-none"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-white/60">Mode</label>
                <select
                  value={createForm.mode}
                  onChange={e => setCreateForm(f => ({ ...f, mode: e.target.value }))}
                  className="mt-1 w-full rounded-xl border border-white/20 bg-white/10 px-4 py-2.5 text-sm text-white outline-none"
                >
                  <option value="online" className="text-neutral-800">Online</option>
                  <option value="offline" className="text-neutral-800">Offline</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-white/60">Location (if offline)</label>
                <input
                  value={createForm.location}
                  onChange={e => setCreateForm(f => ({ ...f, location: e.target.value }))}
                  placeholder="HCM City, Vietnam"
                  className="mt-1 w-full rounded-xl border border-white/20 bg-white/10 px-4 py-2.5 text-sm text-white placeholder-white/40 outline-none"
                />
              </div>
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="text-xs font-semibold text-white/60">Capacity</label>
                  <input
                    value={createForm.capacity}
                    onChange={e => setCreateForm(f => ({ ...f, capacity: e.target.value }))}
                    placeholder="Unlimited"
                    className="mt-1 w-full rounded-xl border border-white/20 bg-white/10 px-4 py-2.5 text-sm text-white placeholder-white/40 outline-none"
                  />
                </div>
                <div className="flex-1">
                  <label className="text-xs font-semibold text-white/60">Repeat every (days)</label>
                  <input
                    value={createForm.interval_days}
                    onChange={e => setCreateForm(f => ({ ...f, interval_days: e.target.value, recurring: !!e.target.value }))}
                    placeholder="7 for weekly"
                    className="mt-1 w-full rounded-xl border border-white/20 bg-white/10 px-4 py-2.5 text-sm text-white placeholder-white/40 outline-none"
                  />
                </div>
              </div>
            </div>
            <textarea
              value={createForm.description}
              onChange={e => setCreateForm(f => ({ ...f, description: e.target.value }))}
              placeholder="What will happen at this event?"
              rows={3}
              className="mt-3 w-full rounded-xl border border-white/20 bg-white/10 px-4 py-2.5 text-sm text-white placeholder-white/40 outline-none"
            />
            <div className="mt-3 flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setCreateOpen(false)} className="text-white hover:bg-white/10">Cancel</Button>
              <Button onClick={createEvent} loading={creating} className="bg-white text-violet-700 hover:bg-violet-50">
                <Sparkles className="h-4 w-4" /> Publish event
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Filters */}
      <div className="mt-6 flex flex-wrap gap-2">
        <FilterChip active={filter === "all"} onClick={() => setFilter("all")}>All</FilterChip>
        {EVENT_TYPES.map(t => (
          <FilterChip key={t} active={filter === t} onClick={() => setFilter(t)}>
            {EVENT_TYPE_META[t]?.icon} {EVENT_TYPE_META[t]?.label}
          </FilterChip>
        ))}
      </div>

      {/* Events grid */}
      <div className="mt-6">
        {loading ? (
          <div className="grid gap-5 md:grid-cols-2">
            {[0, 1, 2, 3].map(i => <Skeleton key={i} className="h-56 w-full rounded-2xl" />)}
          </div>
        ) : (events ?? []).length === 0 ? (
          <div className="rounded-2xl bg-white p-12 text-center shadow-sm ring-1 ring-neutral-200/60">
            <Calendar className="mx-auto h-10 w-10 text-neutral-300" />
            <h3 className="mt-3 text-lg font-bold text-neutral-800">No upcoming events</h3>
            <p className="mt-1 text-sm text-neutral-500">
              Be the first to host a challenge, AMA, or community night.
            </p>
            <button onClick={() => setCreateOpen(true)} className="mt-4 rounded-full bg-primary-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-primary-700">
              Host the first event
            </button>
          </div>
        ) : (
          <div className="grid gap-5 md:grid-cols-2">
            {(events ?? []).map(ev => {
              const meta = EVENT_TYPE_META[ev.event_type] || { label: "Event", badge: "bg-neutral-100 text-neutral-700", icon: "🎉" };
              const { date, time } = fmtDate(ev.start_time);
              return (
                <div key={ev.id} className="group rounded-2xl bg-white p-6 shadow-sm ring-1 ring-neutral-200/60 transition-all hover:shadow-md">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold ${meta.badge}`}>
                        {meta.icon} {meta.label}
                      </span>
                      {ev.status === "live" && (
                        <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-rose-50 px-2.5 py-1 text-xs font-bold text-rose-600 ring-1 ring-rose-200">
                          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-rose-500" /> LIVE
                        </span>
                      )}
                    </div>
                    {ev.recurring && (
                      <span className="flex items-center gap-1 text-xs text-neutral-400">
                        <Repeat className="h-3.5 w-3.5" /> every {ev.interval_days}d
                      </span>
                    )}
                  </div>

                  <h3 className="mt-3 text-lg font-bold text-neutral-900 group-hover:text-primary-700">
                    {ev.emoji} {ev.title}
                  </h3>
                  <p className="mt-1 line-clamp-2 text-sm text-neutral-500">
                    {ev.description || "No description yet — join to find out more!"}
                  </p>

                  <div className="mt-4 flex items-center gap-4 text-sm text-neutral-500">
                    <span className="flex items-center gap-1.5"><Calendar className="h-4 w-4 text-neutral-400" /> {date} · {time}</span>
                    <span className="flex items-center gap-1.5"><MapPin className="h-4 w-4 text-neutral-400" /> {ev.mode === "online" ? "Online" : ev.location || "Location TBD"}</span>
                  </div>

                  <div className="mt-4 flex items-center justify-between border-t border-neutral-100 pt-4">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-neutral-700">Hosted by {ev.host_name}</p>
                      <p className="flex items-center gap-1 text-xs text-neutral-400">
                        <Users className="h-3.5 w-3.5" /> {ev.attendee_count} attending{ev.capacity ? ` / ${ev.capacity}` : ""}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {ev.challenge_id && (
                        <Link href={`/challenges/${ev.challenge_id}`} className="rounded-lg border border-neutral-200 px-3 py-1.5 text-xs font-semibold text-neutral-600 hover:border-primary-300 hover:text-primary-600">
                          View challenge
                        </Link>
                      )}
                      <Button size="sm" onClick={() => join(ev.id)}>
                        <Play className="h-3.5 w-3.5" /> Join
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function FilterChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors ${
        active
          ? "bg-neutral-900 text-white"
          : "bg-white text-neutral-600 ring-1 ring-neutral-200 hover:ring-primary-300 hover:text-primary-600"
      }`}
    >
      {children}
    </button>
  );
}