"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";

const QUICK_REPLIES = [
  "I need help with billing",
  "Technical issue",
  "How to cancel subscription",
  "Something else",
];

export function SupportChatWidget() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<{ role: string; content: string; actions?: any[] }[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open && !historyLoaded) {
      loadHistory();
    }
  }, [open]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, open]);

  async function loadHistory() {
    setHistoryLoaded(true);
    try {
      const res = await fetch("/api/v1/support/chat/history", { headers: { "Content-Type": "application/json" } });
      if (!res.ok) return;
      const json = await res.json();
      if (json.data && Array.isArray(json.data)) {
        setMessages(json.data);
      }
    } catch {
      // ignore
    }
  }

  async function send(text?: string) {
    const content = (text || input).trim();
    if (!content || loading) return;
    setInput("");
    setMessages((m) => [...m, { role: "user", content }]);
    setLoading(true);

    try {
      const res = await fetch("/api/v1/support/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: content }),
      });
      if (!res.ok) throw new Error(await res.text());
      const json = await res.json();
      setMessages((m) => [...m, { role: "assistant", content: json.data.answer, actions: json.data.actions }]);
    } catch (e: any) {
      setMessages((m) => [...m, { role: "assistant", content: `Error: ${e.message}` }]);
    } finally {
      setLoading(false);
    }
  }

  function handleQuickReply(text: string) {
    setInput(text);
    send(text);
  }

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3">
      {open && (
        <Card className="flex h-[500px] w-[360px] flex-col overflow-hidden rounded-lg border-neutral-200 shadow-xl">
          <div className="flex items-center justify-between border-b border-neutral-200 px-4 py-3">
            <div>
              <p className="text-sm font-semibold text-neutral-900">Ascendly Support</p>
              <p className="text-xs text-neutral-600">AI assistant — 24/7</p>
            </div>
            <Button variant="ghost" size="sm" onClick={() => setOpen(false)} className="h-8 w-8 p-0">
              ✕
            </Button>
          </div>
          <div className="flex-1 overflow-y-auto px-4 py-3">
            {messages.length === 0 && (
              <div className="mt-4 space-y-3">
                <p className="text-sm text-neutral-600">Hi! How can I help you today?</p>
                <div className="flex flex-wrap gap-2">
                  {QUICK_REPLIES.map((q) => (
                    <Button key={q} variant="outline" size="sm" onClick={() => handleQuickReply(q)} className="text-xs">
                      {q}
                    </Button>
                  ))}
                </div>
              </div>
            )}
            {messages.map((m, i) => (
              <div key={i} className={`mb-3 flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${
                    m.role === "user" ? "bg-primary-600 text-white" : "border border-neutral-200 bg-white"
                  }`}
                >
                  <p className="whitespace-pre-wrap">{m.content}</p>
                  {m.actions?.some((a: any) => a.type === "create_ticket") && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="mt-2 w-full text-xs"
                      onClick={() => {
                        window.location.href = "/support/tickets";
                      }}
                    >
                      Create support ticket
                    </Button>
                  )}
                </div>
              </div>
            ))}
            {loading && (
              <div className="mb-3 flex justify-start">
                <div className="rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-600">
                  Thinking...
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>
          <div className="border-t border-neutral-200 px-3 py-2">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                send();
              }}
              className="flex gap-2"
            >
              <Textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Type a message..."
                rows={1}
                className="min-h-[40px] resize-none text-sm"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    send();
                  }
                }}
              />
              <Button type="submit" size="sm" disabled={loading || !input.trim()}>
                Send
              </Button>
            </form>
          </div>
        </Card>
      )}
      {!open && (
        <Button
          onClick={() => setOpen(true)}
          className="h-14 w-14 rounded-full bg-accent-500 shadow-lg hover:bg-accent-600"
          aria-label="Open support chat"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
        </Button>
      )}
    </div>
  );
}
