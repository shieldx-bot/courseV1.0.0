"use client";

import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

const CATEGORIES = ["billing", "technical", "content", "account", "general"];
const STATUSES = ["open", "in_progress", "waiting_user", "resolved", "closed"];
const PRIORITIES = ["P1", "P2", "P3"];

/** Service-level targets used to approximate SLA breaches from the loaded list. */
const SLA_HOURS: Record<string, number> = { P1: 4, P2: 24, P3: 72 };

interface Ticket {
  id: string;
  subject: string;
  user_email: string;
  user_name: string;
  status: string;
  category?: string;
  priority?: string;
  created_at: string;
  assigned_to?: string;
}

type Tab = "tickets" | "knowledge" | "proactive";

const STATUS_LABELS: Record<string, string> = {
  open: "Open",
  in_progress: "In progress",
  waiting_user: "Waiting on user",
  resolved: "Resolved",
  closed: "Closed",
};

function countSlaBreaches(tickets: Ticket[]): number {
  const now = Date.now();
  return tickets.filter((t) => {
    if (t.status === "resolved" || t.status === "closed") return false;
    const hours = SLA_HOURS[t.priority || "P3"] ?? SLA_HOURS.P3;
    const created = new Date(t.created_at).getTime();
    if (!created) return false;
    return now - created > hours * 3_600_000;
  }).length;
}

export function SupportDashboard() {
  const [tab, setTab] = useState<Tab>("tickets");

  // Tickets
  const [stats, setStats] = useState<Record<string, any> | null>(null);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("");
  const [search, setSearch] = useState("");
  const [selectedTicket, setSelectedTicket] = useState<any>(null);
  const [selectedMessages, setSelectedMessages] = useState<any[]>([]);
  const [statusNote, setStatusNote] = useState("");
  const [assignId, setAssignId] = useState("");

  // Knowledge base
  const [articles, setArticles] = useState<any[]>([]);
  const [articleQuery, setArticleQuery] = useState("");
  const [articleFormOpen, setArticleFormOpen] = useState(false);
  const [editingArticle, setEditingArticle] = useState<any>(null);
  const [articleForm, setArticleForm] = useState({ title: "", category: "general", content: "", summary: "", tags: "", slug: "", is_published: true });
  const [articleLoading, setArticleLoading] = useState(false);

  // Proactive
  const [interventions, setInterventions] = useState<any[]>([]);
  const [interventionsLoading, setInterventionsLoading] = useState(false);

  async function loadStats() {
    try {
      const res = await fetch("/api/v1/admin/support/stats");
      if (!res.ok) throw new Error(await res.text());
      const json = await res.json();
      setStats(json.data);
    } catch {
      // ignore
    }
  }

  async function loadTickets() {
    setLoading(true);
    try {
      const q = new URLSearchParams();
      if (statusFilter) q.set("status", statusFilter);
      if (categoryFilter) q.set("category", categoryFilter);
      if (priorityFilter) q.set("priority", priorityFilter);
      if (search) q.set("search", search);
      const res = await fetch(`/api/v1/admin/support/tickets?${q.toString()}`);
      if (!res.ok) throw new Error(await res.text());
      const json = await res.json();
      setTickets(json.data || []);
    } catch {
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
      setStatusNote("");
      setAssignId("");
    } catch {
      // ignore
    }
  }

  async function updateStatus(status: string) {
    if (!selectedTicket) return;
    try {
      const res = await fetch(`/api/v1/admin/support/tickets/${encodeURIComponent(selectedTicket.id)}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, note: statusNote || undefined }),
      });
      if (!res.ok) throw new Error(await res.text());
      setSelectedTicket((t: any) => ({ ...t, status }));
      setStatusNote("");
      await loadTickets();
    } catch {
      // ignore
    }
  }

  async function assignTicket() {
    if (!selectedTicket || !assignId.trim()) return;
    try {
      const res = await fetch(`/api/v1/admin/support/tickets/${encodeURIComponent(selectedTicket.id)}/assign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ admin_id: assignId.trim() }),
      });
      if (!res.ok) throw new Error(await res.text());
      const json = await res.json();
      setSelectedTicket((t: any) => ({ ...t, assigned_to: json.data?.assigned_to || assignId.trim() }));
      setAssignId("");
      await loadTickets();
    } catch {
      // ignore
    }
  }

  async function loadArticles() {
    setArticleLoading(true);
    try {
      const res = await fetch("/api/v1/admin/help/articles");
      if (!res.ok) throw new Error(await res.text());
      const json = await res.json();
      setArticles(json.data || []);
    } catch {
      // ignore
    } finally {
      setArticleLoading(false);
    }
  }

  async function loadInterventions() {
    setInterventionsLoading(true);
    try {
      const res = await fetch("/api/v1/admin/proactive/interventions/all");
      if (!res.ok) throw new Error(await res.text());
      const json = await res.json();
      setInterventions(json.data || []);
    } catch {
      // ignore
    } finally {
      setInterventionsLoading(false);
    }
  }

  async function saveArticle(e: React.FormEvent) {
    e.preventDefault();
    setArticleLoading(true);
    try {
      const body = {
        title: articleForm.title,
        category: articleForm.category,
        content: articleForm.content,
        summary: articleForm.summary,
        tags: articleForm.tags.split(",").map((t) => t.trim()).filter(Boolean),
        slug: articleForm.slug || undefined,
        is_published: articleForm.is_published,
      };
      const url = editingArticle ? `/api/v1/admin/help/articles/${encodeURIComponent(editingArticle.id)}` : "/api/v1/admin/help/articles";
      const method = editingArticle ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(await res.text());
      setArticleForm({ title: "", category: "general", content: "", summary: "", tags: "", slug: "", is_published: true });
      setEditingArticle(null);
      setArticleFormOpen(false);
      await loadArticles();
    } catch (e: any) {
      alert(e.message);
    } finally {
      setArticleLoading(false);
    }
  }

  async function deleteArticle(id: string) {
    if (!confirm("Delete this article?")) return;
    const res = await fetch(`/api/v1/admin/help/articles/${encodeURIComponent(id)}`, { method: "DELETE" });
    if (!res.ok) {
      alert(await res.text());
      return;
    }
    await loadArticles();
  }

  function editArticle(a: any) {
    setEditingArticle(a);
    setArticleForm({
      title: a.title,
      category: a.category,
      content: a.content || "",
      summary: a.summary || "",
      tags: (a.tags || []).join(", "),
      slug: a.slug || "",
      is_published: a.is_published,
    });
    setArticleFormOpen(true);
  }

  useEffect(() => {
    loadStats();
    loadTickets();
  }, []);

  useEffect(() => {
    loadTickets();
  }, [statusFilter, categoryFilter, priorityFilter, search]);

  useEffect(() => {
    if (tab === "knowledge") loadArticles();
    if (tab === "proactive") loadInterventions();
  }, [tab]);

  const slaBreaches = useMemo(() => countSlaBreaches(tickets), [tickets]);

  const filteredArticles = useMemo(() => {
    const q = articleQuery.trim().toLowerCase();
    if (!q) return articles;
    return articles.filter(
      (a) =>
        (a.title || "").toLowerCase().includes(q) ||
        (a.summary || "").toLowerCase().includes(q) ||
        (a.category || "").toLowerCase().includes(q)
    );
  }, [articles, articleQuery]);

  return (
    <section className="mx-auto max-w-page px-6 py-12" aria-label="Support admin">
      <h1 className="text-3xl font-semibold text-neutral-900">Support</h1>
      <div role="tablist" aria-label="Support admin sections" className="mt-6 flex gap-2">
        {(["tickets", "knowledge", "proactive"] as const).map((t) => (
          <Button
            key={t}
            role="tab"
            aria-selected={tab === t}
            variant={tab === t ? "primary" : "outline"}
            onClick={() => setTab(t)}
          >
            {t === "tickets" ? "Tickets" : t === "knowledge" ? "Knowledge Base" : "Proactive"}
          </Button>
        ))}
      </div>

      {tab === "tickets" && (
        <>
          <div className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-4">
            <Card className="p-4">
              <p className="text-sm text-neutral-600">Total tickets</p>
              <p className="text-2xl font-semibold text-neutral-900">{stats?.total ?? "—"}</p>
            </Card>
            <Card className="p-4">
              <p className="text-sm text-neutral-600">Avg resolution</p>
              <p className="text-2xl font-semibold text-neutral-900">
                {stats?.avg_resolution_hours ? `${stats.avg_resolution_hours.toFixed(1)}h` : "—"}
              </p>
            </Card>
            <Card className="p-4">
              <p className="text-sm text-neutral-600">Avg satisfaction</p>
              <p className="text-2xl font-semibold text-neutral-900">
                {stats?.avg_satisfaction_rating ? stats.avg_satisfaction_rating.toFixed(1) : "—"}
              </p>
            </Card>
            <Card className="p-4">
              <p className="text-sm text-neutral-600">SLA breaches (open)</p>
              <p className="text-2xl font-semibold text-neutral-900">{slaBreaches}</p>
            </Card>
          </div>

          <div className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-3">
            <Card className="p-6 md:col-span-1">
              <h2 className="text-lg font-medium">Filters</h2>
              <div className="mt-4 space-y-3">
                <div>
                  <label className="block text-sm text-neutral-600" htmlFor="ticket-status-filter">Status</label>
                  <select id="ticket-status-filter" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="mt-1 w-full rounded-md border border-neutral-300 p-2 text-sm">
                    <option value="">All</option>
                    {STATUSES.map((s) => (
                      <option key={s} value={s}>{STATUS_LABELS[s]}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-neutral-600" htmlFor="ticket-category-filter">Category</label>
                  <select id="ticket-category-filter" value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} className="mt-1 w-full rounded-md border border-neutral-300 p-2 text-sm">
                    <option value="">All</option>
                    {CATEGORIES.map((c) => (
                      <option key={c} value={c} className="capitalize">{c}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-neutral-600" htmlFor="ticket-priority-filter">Priority</label>
                  <select id="ticket-priority-filter" value={priorityFilter} onChange={(e) => setPriorityFilter(e.target.value)} className="mt-1 w-full rounded-md border border-neutral-300 p-2 text-sm">
                    <option value="">All</option>
                    {PRIORITIES.map((p) => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-neutral-600" htmlFor="ticket-search">Search</label>
                  <Input id="ticket-search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Subject search..." />
                </div>
              </div>
            </Card>

            <Card className="p-6 md:col-span-2">
              <h2 className="text-lg font-medium">Tickets</h2>
              {loading ? (
                <p className="mt-4 text-sm text-neutral-600">Loading...</p>
              ) : tickets.length === 0 ? (
                <p className="mt-4 text-sm text-neutral-600">No tickets found.</p>
              ) : (
                <div className="mt-4 overflow-x-auto">
                  <table className="w-full text-left text-sm" aria-label="Support tickets">
                    <thead>
                      <tr className="border-b border-neutral-200 text-neutral-600">
                        <th className="pb-2 pr-4 font-medium">Subject</th>
                        <th className="pb-2 pr-4 font-medium">User</th>
                        <th className="pb-2 pr-4 font-medium">Status</th>
                        <th className="pb-2 pr-4 font-medium">Category</th>
                        <th className="pb-2 font-medium">Created</th>
                      </tr>
                    </thead>
                    <tbody>
                      {tickets.map((t) => (
                        <tr
                          key={t.id}
                          onClick={() => selectTicket(t.id)}
                          className="cursor-pointer border-b border-neutral-100 last:border-0 hover:bg-neutral-50"
                        >
                          <td className="py-3 pr-4 font-medium text-neutral-900">{t.subject}</td>
                          <td className="py-3 pr-4 text-neutral-600">{t.user_name || t.user_email}</td>
                          <td className="py-3 pr-4">
                            <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs text-neutral-700">
                              {STATUS_LABELS[t.status] || t.status}
                            </span>
                          </td>
                          <td className="py-3 pr-4 capitalize text-neutral-600">{t.category || "—"}</td>
                          <td className="py-3 text-neutral-600">{new Date(t.created_at).toLocaleDateString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          </div>

          {selectedTicket && (
            <Card className="mt-6 p-6">
              <h3 className="text-lg font-medium">Ticket — {selectedTicket.subject}</h3>
              <div className="mt-2 space-y-2 text-sm text-neutral-600">
                <p>Status: <span className="font-medium">{selectedTicket.status}</span></p>
                <p>Priority: <span className="font-medium">{selectedTicket.priority || "—"}</span></p>
                <p>Category: <span className="font-medium">{selectedTicket.category || "—"}</span></p>
                <p>Assigned: <span className="font-medium">{selectedTicket.assigned_to || "unassigned"}</span></p>
              </div>
              <div className="mt-4 space-y-3">
                {selectedMessages.map((m: any) => (
                  <div key={m.id} className={`flex ${m.sender_type === "user" ? "justify-end" : "justify-start"}`}>
                    <div className={`max-w-2xl rounded-lg px-4 py-3 ${m.sender_type === "user" ? "bg-primary-600 text-white" : "border border-neutral-200 bg-white"}`}>
                      <p className="text-xs font-medium opacity-70">{m.sender_name}</p>
                      <p className="whitespace-pre-wrap text-sm">{m.content}</p>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-4 flex flex-wrap items-end gap-3">
                <div>
                  <label className="block text-sm text-neutral-600" htmlFor="ticket-status-update">Update status</label>
                  <select
                    id="ticket-status-update"
                    value=""
                    onChange={(e) => {
                      if (!e.target.value) return;
                      updateStatus(e.target.value);
                    }}
                    className="mt-1 rounded-md border border-neutral-300 p-2 text-sm"
                  >
                    <option value="">Update status...</option>
                    {STATUSES.map((s) => (
                      <option key={s} value={s}>{STATUS_LABELS[s]}</option>
                    ))}
                  </select>
                </div>
                <div className="flex-1">
                  <label className="block text-sm text-neutral-600" htmlFor="ticket-status-note">Note (optional, added as message)</label>
                  <Input id="ticket-status-note" value={statusNote} onChange={(e) => setStatusNote(e.target.value)} placeholder="e.g. escalated to billing team" />
                </div>
                <div>
                  <label className="block text-sm text-neutral-600" htmlFor="ticket-assign">Assign to admin id</label>
                  <div className="mt-1 flex gap-2">
                    <Input id="ticket-assign" value={assignId} onChange={(e) => setAssignId(e.target.value)} placeholder="admin user id" className="w-48" />
                    <Button variant="outline" onClick={assignTicket} disabled={!assignId.trim()}>Assign</Button>
                  </div>
                </div>
                <Button onClick={() => selectTicket(selectedTicket.id)}>Refresh</Button>
              </div>
            </Card>
          )}
        </>
      )}

      {tab === "knowledge" && (
        <div className="mt-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-medium">Help Articles</h2>
            <div className="flex items-center gap-3">
              <Input value={articleQuery} onChange={(e) => setArticleQuery(e.target.value)} placeholder="Search articles..." className="w-56" aria-label="Search articles" />
              <Button onClick={() => { setEditingArticle(null); setArticleForm({ title: "", category: "general", content: "", summary: "", tags: "", slug: "", is_published: true }); setArticleFormOpen((v) => !v); }}>
                {articleFormOpen ? "Cancel" : "New Article"}
              </Button>
            </div>
          </div>
          {articleFormOpen && (
            <Card className="mt-4 p-6">
              <form onSubmit={saveArticle} className="space-y-4">
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div>
                    <label className="block text-sm font-medium text-neutral-700" htmlFor="article-title">Title</label>
                    <Input id="article-title" value={articleForm.title} onChange={(e) => setArticleForm({ ...articleForm, title: e.target.value })} required />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-neutral-700" htmlFor="article-category">Category</label>
                    <select id="article-category" value={articleForm.category} onChange={(e) => setArticleForm({ ...articleForm, category: e.target.value })} className="mt-1 w-full rounded-md border border-neutral-300 p-2 text-sm">
                      {CATEGORIES.map((c) => <option key={c} value={c} className="capitalize">{c}</option>)}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-neutral-700" htmlFor="article-summary">Summary</label>
                  <Input id="article-summary" value={articleForm.summary} onChange={(e) => setArticleForm({ ...articleForm, summary: e.target.value })} required />
                </div>
                <div>
                  <label className="block text-sm font-medium text-neutral-700" htmlFor="article-content">Content</label>
                  <Textarea id="article-content" value={articleForm.content} onChange={(e) => setArticleForm({ ...articleForm, content: e.target.value })} rows={6} required />
                </div>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div>
                    <label className="block text-sm font-medium text-neutral-700" htmlFor="article-tags">Tags (comma separated)</label>
                    <Input id="article-tags" value={articleForm.tags} onChange={(e) => setArticleForm({ ...articleForm, tags: e.target.value })} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-neutral-700" htmlFor="article-slug">Slug (optional)</label>
                    <Input id="article-slug" value={articleForm.slug} onChange={(e) => setArticleForm({ ...articleForm, slug: e.target.value })} />
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <input id="article-published" type="checkbox" checked={articleForm.is_published} onChange={(e) => setArticleForm({ ...articleForm, is_published: e.target.checked })} />
                  <label htmlFor="article-published" className="text-sm text-neutral-700">Published</label>
                </div>
                <Button type="submit" disabled={articleLoading}>{editingArticle ? "Update" : "Create"} Article</Button>
              </form>
            </Card>
          )}
          {articleLoading && <p className="mt-4 text-sm text-neutral-600">Loading...</p>}
          <div className="mt-4 space-y-3">
            {filteredArticles.map((a) => (
              <Card key={a.id} className="p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-medium text-neutral-900">{a.title}</p>
                    <p className="mt-1 text-sm text-neutral-600">{a.summary}</p>
                    <div className="mt-2 flex items-center gap-2 text-xs text-neutral-600">
                      <span className="capitalize">{a.category}</span>
                      <span>·</span>
                      <span>{a.views || 0} views</span>
                      <span>·</span>
                      <span>👍 {a.helpful_count}</span>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => editArticle(a)} aria-label={`Edit ${a.title}`}>Edit</Button>
                    <Button variant="outline" size="sm" onClick={() => deleteArticle(a.id)} aria-label={`Delete ${a.title}`}>Delete</Button>
                  </div>
                </div>
              </Card>
            ))}
            {filteredArticles.length === 0 && <p className="text-sm text-neutral-600">{articles.length === 0 ? "No articles yet." : "No articles match your search."}</p>}
          </div>
        </div>
      )}

      {tab === "proactive" && (
        <div className="mt-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-medium">Recent Interventions</h2>
            <Button onClick={loadInterventions} aria-label="Refresh interventions">Refresh</Button>
          </div>
          {interventionsLoading && <p className="mt-4 text-sm text-neutral-600">Loading...</p>}
          <div className="mt-4 space-y-3">
            {interventions.map((item, idx) => (
              <Card key={item.id || idx} className="p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-accent-100 px-2 py-0.5 text-xs font-medium text-accent-800">{item.type}</span>
                  <span className="text-xs text-neutral-500">{item.user_id ? `${item.user_id} · ` : ""}{new Date(item.created_at).toLocaleString()}</span>
                </div>
                <p className="mt-2 text-sm text-neutral-800">{item.message}</p>
              </Card>
            ))}
            {!interventionsLoading && interventions.length === 0 && (
              <p className="text-sm text-neutral-600">
                No interventions recorded yet. The admin interventions API (<code className="rounded bg-neutral-100 px-1">/admin/proactive/interventions/all</code>) is
                pending backend support — this list will populate once AI-A ships it.
              </p>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
