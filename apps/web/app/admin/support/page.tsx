"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import Link from "next/link";

export default function AdminSupportPage() {
  const [stats, setStats] = useState<any>(null);
  const [tickets, setTickets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [search, setSearch] = useState("");
  const [selectedTicket, setSelectedTicket] = useState<any>(null);
  const [selectedMessages, setSelectedMessages] = useState<any[]>([]);

  async function loadStats() {
    try {
      const res = await fetch("/api/v1/admin/support/stats");
      if (!res.ok) throw new Error(await res.text());
      const json = await res.json();
      setStats(json.data);
    } catch (e) {
      // ignore
    }
  }

  async function loadTickets() {
    setLoading(true);
    try {
      const q = new URLSearchParams();
      if (statusFilter) q.set("status", statusFilter);
      if (categoryFilter) q.set("category", categoryFilter);
      if (search) q.set("search", search);
      const res = await fetch(`/api/v1/admin/support/tickets?${q.toString()}`);
      if (!res.ok) throw new Error(await res.text());
      const json = await res.json();
      setTickets(json.data || []);
    } catch (e: any) {
      // ignore
    } finally {
      setLoading(false);
    }
  }

  async function selectTicket(ticketId: string) {
    try {
      const res = await fetch(`/api/v1/admin/support/tickets/${encodeURIComponent(ticketId)}`);
      if (!res.ok) throw new Error(await res.text());
      const json = await res.json();
      setSelectedTicket(json.data);
      setSelectedMessages(json.data.messages || []);
    } catch (e) {
      // ignore
    }
  }

  useEffect(() => {
    loadStats();
    loadTickets();
  }, []);

  useEffect(() => {
    loadTickets();
  }, [statusFilter, categoryFilter, search]);

  return (
    <section className="mx-auto max-w-page px-6 py-12">
      <h1 className="text-3xl font-semibold text-neutral-900">Support</h1>
      {stats && (
        <div className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-4">
          <Card className="p-4">
            <p className="text-sm text-neutral-600">Total tickets</p>
            <p className="text-2xl font-semibold text-neutral-900">{stats.total}</p>
          </Card>
          <Card className="p-4">
            <p className="text-sm text-neutral-600">Avg resolution</p>
            <p className="text-2xl font-semibold text-neutral-900">
              {stats.avg_resolution_hours ? `${stats.avg_resolution_hours.toFixed(1)}h` : "—"}
            </p>
          </Card>
          <Card className="p-4">
            <p className="text-sm text-neutral-600">Avg satisfaction</p>
            <p className="text-2xl font-semibold text-neutral-900">
              {stats.avg_satisfaction_rating ? stats.avg_satisfaction_rating.toFixed(1) : "—"}
            </p>
          </Card>
          <Card className="p-4">
            <p className="text-sm text-neutral-600">Open tickets</p>
            <p className="text-2xl font-semibold text-neutral-900">{stats.by_status?.open || 0}</p>
          </Card>
        </div>
      )}
      <div className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-3">
        <Card className="p-6 md:col-span-1">
          <h2 className="text-lg font-medium">Filters</h2>
          <div className="mt-4 space-y-3">
            <div>
              <label className="block text-sm text-neutral-600">Status</label>
              <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="mt-1 w-full rounded-md border border-neutral-300 p-2 text-sm">
                <option value="">All</option>
                <option value="open">Open</option>
                <option value="in_progress">In progress</option>
                <option value="waiting_user">Waiting on user</option>
                <option value="resolved">Resolved</option>
                <option value="closed">Closed</option>
              </select>
            </div>
            <div>
              <label className="block text-sm text-neutral-600">Category</label>
              <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} className="mt-1 w-full rounded-md border border-neutral-300 p-2 text-sm">
                <option value="">All</option>
                <option value="billing">Billing</option>
                <option value="technical">Technical</option>
                <option value="content">Content</option>
                <option value="account">Account</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div>
              <label className="block text-sm text-neutral-600">Search</label>
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Subject search..." />
            </div>
          </div>
        </Card>
        <Card className="p-6 md:col-span-2">
          <h2 className="text-lg font-medium">Tickets</h2>
          {loading ? <p className="mt-4 text-sm text-neutral-600">Loading...</p> : (
            <ul className="mt-4 space-y-3">
              {tickets.map((t) => (
                <li key={t.id} className="cursor-pointer border-b border-neutral-100 pb-3 last:border-0">
                  <div className="flex items-center justify-between">
                    <div onClick={() => selectTicket(t.id)}>
                      <p className="font-medium text-neutral-900">{t.subject}</p>
                      <p className="text-sm text-neutral-600">{t.user_email} · {t.user_name}</p>
                    </div>
                    <span className="text-xs text-neutral-600">{new Date(t.created_at).toLocaleDateString()}</span>
                  </div>
                </li>
              ))}
              {tickets.length === 0 && <p className="text-sm text-neutral-600">No tickets found.</p>}
            </ul>
          )}
        </Card>
      </div>
      {selectedTicket && (
        <Card className="mt-6 p-6">
          <h3 className="text-lg font-medium">Ticket {selectedTicket.subject}</h3>
          <div className="mt-2 space-y-2 text-sm text-neutral-600">
            <p>Status: <span className="font-medium">{selectedTicket.status}</span></p>
            <p>Priority: <span className="font-medium">{selectedTicket.priority}</span></p>
            <p>Category: <span className="font-medium">{selectedTicket.category}</span></p>
            <p>Assigned: <span className="font-medium">{selectedTicket.assigned_to || "unassigned"}</span></p>
          </div>
          <div className="mt-4 space-y-3">
            {selectedMessages.map((m) => (
              <div key={m.id} className={`flex ${m.sender_type === "user" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-2xl rounded-lg px-4 py-3 ${m.sender_type === "user" ? "bg-primary-600 text-white" : "border border-neutral-200 bg-white"}`}>
                  <p className="text-xs font-medium opacity-70">{m.sender_name}</p>
                  <p className="whitespace-pre-wrap text-sm">{m.content}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-4 flex gap-2">
            <select value="" onChange={(e) => {
              if (!e.target.value) return;
              fetch(`/api/v1/admin/support/tickets/${encodeURIComponent(selectedTicket.id)}/status`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ status: e.target.value }),
              }).then(() => {
                setSelectedTicket((t: any) => ({ ...t, status: e.target.value }));
                loadTickets();
              });
            }}>
              <option value="">Update status...</option>
              <option value="open">Open</option>
              <option value="in_progress">In progress</option>
              <option value="waiting_user">Waiting on user</option>
              <option value="resolved">Resolved</option>
              <option value="closed">Closed</option>
            </select>
            <Button onClick={() => selectTicket(selectedTicket.id)}>Refresh</Button>
          </div>
        </Card>
      )}
    </section>
  );
}
