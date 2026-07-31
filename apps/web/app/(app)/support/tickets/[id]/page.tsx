"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import Link from "next/link";
import { useToast } from "@/components/ui/toast";

const STATUS_COLORS: Record<string, string> = {
  open: "bg-warning/10 text-warning",
  in_progress: "bg-primary-100 text-primary-700",
  waiting_user: "bg-accent-100 text-accent-600",
  resolved: "bg-success/10 text-success",
  closed: "bg-neutral-100 text-neutral-600",
};

const PRIORITY_COLORS: Record<string, string> = {
  P1: "bg-error/10 text-error",
  P2: "bg-warning/10 text-warning",
  P3: "bg-neutral-100 text-neutral-600",
};

export default function SupportTicketDetailPage() {
  const params = useParams();
  const ticketId = params.id as string;
  const [ticket, setTicket] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reply, setReply] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const { toast } = useToast();

  async function load() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/v1/support/tickets/${encodeURIComponent(ticketId)}`, {
        headers: { "Content-Type": "application/json" },
      });
      if (!res.ok) throw new Error(await res.text());
      const json = await res.json();
      setTicket(json.data);
      setMessages(json.data.messages || []);
    } catch (e: any) {
      setError(e.message);
      toast(e.message, { type: "error" });
    } finally {
      setLoading(false);
    }
  }

  async function sendReply(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await fetch(`/api/v1/support/tickets/${encodeURIComponent(ticketId)}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: reply }),
      });
      if (!res.ok) throw new Error(await res.text());
      setReply("");
      toast("Reply sent", { type: "success" });
      await load();
    } catch (e: any) {
      setError(e.message);
      toast(e.message, { type: "error" });
    } finally {
      setSubmitting(false);
    }
  }

  async function rate(r: number) {
    try {
      const res = await fetch(`/api/v1/support/tickets/${encodeURIComponent(ticketId)}/satisfaction`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rating: r }),
      });
      if (!res.ok) throw new Error(await res.text());
      toast("Thank you for your feedback!", { type: "success" });
      await load();
    } catch (e: any) {
      setError(e.message);
      toast(e.message, { type: "error" });
    }
  }

  useEffect(() => {
    load();
    // placeholder for polling
    const interval = setInterval(load, 15000);
    return () => clearInterval(interval);
  }, [ticketId]);

  if (loading) return <section className="mx-auto max-w-page px-6 py-12"><p className="text-neutral-600">Loading...</p></section>;
  if (error) return <section className="mx-auto max-w-page px-6 py-12"><p className="text-error">{error}</p></section>;
  if (!ticket) return <section className="mx-auto max-w-page px-6 py-12"><p className="text-neutral-600">Ticket not found</p></section>;

  return (
    <section className="mx-auto max-w-page px-6 py-12">
      <Link href="/support/tickets" className="text-sm text-primary-600 hover:underline">
        ← Back to tickets
      </Link>
      <Card className="mt-4 p-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-xl font-semibold text-neutral-900">{ticket.subject}</h1>
            <div className="mt-2 flex items-center gap-3 text-sm text-neutral-600">
              <span className="capitalize">{ticket.category}</span>
              <span>·</span>
              <span className={`font-medium ${PRIORITY_COLORS[ticket.priority] || PRIORITY_COLORS.P3}`}>{ticket.priority}</span>
              <span>·</span>
              <span>{new Date(ticket.created_at).toLocaleString()}</span>
            </div>
          </div>
          <span className={`rounded px-2 py-1 text-xs font-medium ${STATUS_COLORS[ticket.status] || STATUS_COLORS.open}`}>{ticket.status}</span>
        </div>
      </Card>
      <div className="mt-6 space-y-4">
        {messages.map((m) => (
          <div key={m.id} className={`flex ${m.sender_type === "user" ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-2xl rounded-lg px-4 py-3 ${m.sender_type === "user" ? "bg-primary-600 text-white" : "border border-neutral-200 bg-white"}`}>
              <p className="text-xs font-medium opacity-70">{m.sender_name} · {new Date(m.created_at).toLocaleString()}</p>
              <p className="whitespace-pre-wrap text-sm">{m.content}</p>
            </div>
          </div>
        ))}
      </div>
      {ticket.status !== "resolved" && ticket.status !== "closed" && (
        <Card className="mt-6 p-6">
          <form onSubmit={sendReply} className="space-y-4">
            <Textarea value={reply} onChange={(e) => setReply(e.target.value)} placeholder="Write a reply..." rows={4} required />
            <div className="flex items-center justify-between">
              <Button type="button" variant="outline" onClick={() => window.history.back()}>Close</Button>
              <Button type="submit" disabled={submitting}>{submitting ? "Sending..." : "Send reply"}</Button>
            </div>
          </form>
        </Card>
      )}
      {ticket.status === "resolved" && !ticket.satisfaction_rating && (
        <Card className="mt-6 p-6">
          <p className="text-sm text-neutral-600">How would you rate this support?</p>
          <div className="mt-2 flex gap-2">
            {[1, 2, 3, 4, 5].map((r) => (
              <Button key={r} variant="outline" onClick={() => rate(r)}>{r}</Button>
            ))}
          </div>
        </Card>
      )}
      {error && <p className="mt-3 text-sm text-error">{error}</p>}
    </section>
  );
}
