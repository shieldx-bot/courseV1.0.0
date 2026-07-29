"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import Link from "next/link";

const CATEGORIES = ["billing", "technical", "content", "account", "general"];

export default function AdminSupportPage() {
  const [stats, setStats] = useState<any>(null);
  const [tickets, setTickets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [search, setSearch] = useState("");
  const [selectedTicket, setSelectedTicket] = useState<any>(null);
  const [selectedMessages, setSelectedMessages] = useState<any[]>([]);

  // Knowledge base state
  const [articles, setArticles] = useState<any[]>([]);
  const [articleFormOpen, setArticleFormOpen] = useState(false);
  const [editingArticle, setEditingArticle] = useState<any>(null);
  const [articleForm, setArticleForm] = useState({ title: "", category: "general", content: "", summary: "", tags: "", slug: "", is_published: true });
  const [articleLoading, setArticleLoading] = useState(false);

  // Proactive state
  const [interventions, setInterventions] = useState<any[]>([]);
  const [interventionsLoading, setInterventionsLoading] = useState(false);

  // Tabs
  const [tab, setTab] = useState<"tickets" | "knowledge" | "proactive">("tickets");

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

  async function loadArticles() {
    setArticleLoading(true);
    try {
      const res = await fetch("/api/v1/admin/help/articles");
      if (!res.ok) throw new Error(await res.text());
      const json = await res.json();
      setArticles(json.data || []);
    } catch (e) {
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
    } catch (e) {
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
  }, [statusFilter, categoryFilter, search]);

  useEffect(() => {
    if (tab === "knowledge") loadArticles();
    if (tab === "proactive") loadInterventions();
  }, [tab]);

  return (
    <section className="mx-auto max-w-page px-6 py-12">
      <h1 className="text-3xl font-semibold text-neutral-900">Support</h1>
      <div className="mt-6 flex gap-2">
        <Button variant={tab === "tickets" ? "primary" : "outline"} onClick={() => setTab("tickets")}>Tickets</Button>
        <Button variant={tab === "knowledge" ? "primary" : "outline"} onClick={() => setTab("knowledge")}>Knowledge Base</Button>
        <Button variant={tab === "proactive" ? "primary" : "outline"} onClick={() => setTab("proactive")}>Proactive</Button>
      </div>

      {tab === "tickets" && (
        <>
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
                <p className="text-sm text-neutral-600">SLA breaches</p>
                <p className="text-2xl font-semibold text-neutral-900">{stats.sla_breached_count || 0}</p>
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
        </>
      )}

      {tab === "knowledge" && (
        <div className="mt-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-medium">Help Articles</h2>
            <Button onClick={() => { setEditingArticle(null); setArticleForm({ title: "", category: "general", content: "", summary: "", tags: "", slug: "", is_published: true }); setArticleFormOpen((v) => !v); }}>
              {articleFormOpen ? "Cancel" : "New Article"}
            </Button>
          </div>
          {articleFormOpen && (
            <Card className="mt-4 p-6">
              <form onSubmit={saveArticle} className="space-y-4">
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div>
                    <label className="block text-sm font-medium text-neutral-700">Title</label>
                    <Input value={articleForm.title} onChange={(e) => setArticleForm({ ...articleForm, title: e.target.value })} required />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-neutral-700">Category</label>
                    <select value={articleForm.category} onChange={(e) => setArticleForm({ ...articleForm, category: e.target.value })} className="mt-1 w-full rounded-md border border-neutral-300 p-2 text-sm">
                      {CATEGORIES.map((c) => <option key={c} value={c} className="capitalize">{c}</option>)}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-neutral-700">Summary</label>
                  <Input value={articleForm.summary} onChange={(e) => setArticleForm({ ...articleForm, summary: e.target.value })} required />
                </div>
                <div>
                  <label className="block text-sm font-medium text-neutral-700">Content</label>
                  <Textarea value={articleForm.content} onChange={(e) => setArticleForm({ ...articleForm, content: e.target.value })} rows={6} required />
                </div>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div>
                    <label className="block text-sm font-medium text-neutral-700">Tags (comma separated)</label>
                    <Input value={articleForm.tags} onChange={(e) => setArticleForm({ ...articleForm, tags: e.target.value })} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-neutral-700">Slug (optional)</label>
                    <Input value={articleForm.slug} onChange={(e) => setArticleForm({ ...articleForm, slug: e.target.value })} />
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <input id="published" type="checkbox" checked={articleForm.is_published} onChange={(e) => setArticleForm({ ...articleForm, is_published: e.target.checked })} />
                  <label htmlFor="published" className="text-sm text-neutral-700">Published</label>
                </div>
                <Button type="submit" disabled={articleLoading}>{editingArticle ? "Update" : "Create"} Article</Button>
              </form>
            </Card>
          )}
          {articleLoading && <p className="mt-4 text-sm text-neutral-600">Loading...</p>}
          <div className="mt-4 space-y-3">
            {articles.map((a) => (
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
                    <Button variant="outline" size="sm" onClick={() => editArticle(a)}>Edit</Button>
                    <Button variant="outline" size="sm" onClick={() => deleteArticle(a.id)}>Delete</Button>
                  </div>
                </div>
              </Card>
            ))}
            {articles.length === 0 && <p className="text-sm text-neutral-600">No articles yet.</p>}
          </div>
        </div>
      )}

      {tab === "proactive" && (
        <div className="mt-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-medium">Recent Interventions</h2>
            <Button onClick={loadInterventions}>Refresh</Button>
          </div>
          {interventionsLoading && <p className="mt-4 text-sm text-neutral-600">Loading...</p>}
          <div className="mt-4 space-y-3">
            {interventions.map((item, idx) => (
              <Card key={idx} className="p-4">
                <p className="text-sm font-medium text-neutral-900">{item.type}</p>
                <p className="text-sm text-neutral-600">{item.message}</p>
                <p className="mt-1 text-xs text-neutral-600">{item.user_id} · {new Date(item.created_at).toLocaleString()}</p>
              </Card>
            ))}
            {interventions.length === 0 && <p className="text-sm text-neutral-600">No recent interventions.</p>}
          </div>
        </div>
      )}
    </section>
  );
}
