"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { Card } from "@/components/ui/card";

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

export function TicketCard({ ticket, onClick }: { ticket: any; onClick?: () => void }) {
  return (
    <Card
      className="cursor-pointer p-4 transition hover:border-primary-300"
      onClick={onClick}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium text-neutral-900">{ticket.subject}</p>
          <p className="mt-1 text-sm text-neutral-600">{ticket.user_email}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span className={`rounded px-2 py-0.5 text-xs font-medium ${PRIORITY_COLORS[ticket.priority] || PRIORITY_COLORS.P3}`}>
            {ticket.priority}
          </span>
          <span className={`rounded px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[ticket.status] || STATUS_COLORS.open}`}>
            {ticket.status}
          </span>
        </div>
      </div>
      <div className="mt-3 flex items-center justify-between text-xs text-neutral-600">
        <span className="capitalize">{ticket.category}</span>
        <span>{new Date(ticket.created_at).toLocaleDateString()}</span>
      </div>
    </Card>
  );
}

export function TicketDetail({ ticket, messages }: { ticket: any; messages: any[] }) {
  const router = useRouter();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Link href="/support/tickets" className="text-sm text-primary-600 hover:underline">
          ← Back to tickets
        </Link>
        <span className={`rounded px-2 py-1 text-xs font-medium ${STATUS_COLORS[ticket.status] || STATUS_COLORS.open}`}>
          {ticket.status}
        </span>
      </div>
      <Card className="p-6">
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
        </div>
      </Card>
      <div className="space-y-4">
        {messages.map((m) => (
          <div key={m.id} className={`flex ${m.sender_type === "user" ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-2xl rounded-lg px-4 py-3 ${m.sender_type === "user" ? "bg-primary-600 text-white" : "border border-neutral-200 bg-white"}`}>
              <p className="text-xs font-medium opacity-70">{m.sender_name} · {new Date(m.created_at).toLocaleString()}</p>
              <p className="whitespace-pre-wrap text-sm">{m.content}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
