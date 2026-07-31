"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { TicketCard } from "@/components/support/TicketDashboard";
import { useToast } from "@/components/ui/toast";

const CATEGORIES = ["billing", "technical", "content", "account", "other"];

export default function SupportTicketsPage() {
  const [tickets, setTickets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [category, setCategory] = useState("other");
  const [submitting, setSubmitting] = useState(false);
  const { toast } = useToast();

  async function load() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/v1/support/tickets", { headers: { "Content-Type": "application/json" } });
      if (!res.ok) throw new Error(await res.text());
      const json = await res.json();
      setTickets(json.data || []);
    } catch (e: any) {
      setError(e.message);
      toast(e.message, { type: "error" });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch("/api/v1/support/tickets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject, message, category }),
      });
      if (!res.ok) throw new Error(await res.text());
      await res.json();
      setSubject("");
      setMessage("");
      setShowForm(false);
      toast("Ticket submitted successfully!", { type: "success" });
      await load();
    } catch (e: any) {
      setError(e.message);
      toast(e.message, { type: "error" });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="mx-auto max-w-page px-6 py-12">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-semibold text-neutral-900">My tickets</h1>
        <Button onClick={() => setShowForm((v) => !v)}>
          {showForm ? "Cancel" : "Create ticket"}
        </Button>
      </div>
      {error && <p className="mt-4 text-sm text-error">{error}</p>}
      {showForm && (
        <Card className="mt-6 p-6">
          <form onSubmit={submit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-neutral-700">Category</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="mt-1 w-full rounded-md border border-neutral-300 p-2 text-sm"
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c} className="capitalize">{c}</option>
                ))}
              </select>
            </div>
            <Input
              label="Subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Brief summary"
              required
              error={error}
            />
            <div>
              <label className="block text-sm font-medium text-neutral-700">Message</label>
              <Textarea value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Describe your issue..." rows={5} required />
            </div>
            <Button type="submit" disabled={submitting}>{submitting ? "Submitting..." : "Submit ticket"}</Button>
          </form>
        </Card>
      )}
      <div className="mt-8">
        {loading ? (
          <p className="text-neutral-600">Loading...</p>
        ) : tickets.length === 0 ? (
          <Card className="p-8 text-center text-neutral-600">
            <p className="text-lg font-medium">No tickets yet</p>
            <p className="text-sm mt-1">Create your first support ticket above.</p>
          </Card>
        ) : (
          <ul className="space-y-4">
            {tickets.map((t) => (
              <li key={t.id}>
                <TicketCard ticket={t} onClick={() => (window.location.href = `/support/tickets/${t.id}`)} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
