"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toast";
import {
  clearChatHistory,
  clearLocalHistory,
  convertChatToTicket,
  getChatHistory,
  loadLocalHistory,
  saveLocalHistory,
  sendChat,
  sendChatStream,
} from "@/lib/support-api";
import type { ChatAction, ChatMessage } from "@/types/support";

const QUICK_REPLIES = [
  "I need help with billing",
  "Technical issue",
  "How to cancel subscription",
  "Something else",
];

let idCounter = 0;
function nextId(): string {
  idCounter += 1;
  return `msg-${Date.now()}-${idCounter}`;
}

function normalizeHistoryMessage(message: Partial<ChatMessage>): ChatMessage {
  return {
    id: message.id || nextId(),
    role: message.role === "user" ? "user" : "assistant",
    content: message.content || "",
    actions: Array.isArray(message.actions) ? message.actions : undefined,
    conversation_id: message.conversation_id,
    streaming: false,
  };
}

export function SupportChatWidget() {
  const { toast } = useToast();
  const router = useRouter();

  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [convertingTicket, setConvertingTicket] = useState(false);
  const [historyLoaded, setHistoryLoaded] = useState(false);

  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const launcherRef = useRef<HTMLButtonElement>(null);
  const hasOpenedRef = useRef(false);

  // Load history once when the panel opens for the first time.
  useEffect(() => {
    if (open) {
      hasOpenedRef.current = true;
      inputRef.current?.focus();
      if (!historyLoaded) {
        setHistoryLoaded(true);
        loadHistory();
      }
    } else if (hasOpenedRef.current) {
      launcherRef.current?.focus();
    }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  // Keep the latest message in view.
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, open, loading]);

  // Persist finished sessions locally for fast restore on reload.
  useEffect(() => {
    if (!loading && messages.length > 0) saveLocalHistory(messages);
  }, [messages, loading]);

  async function loadHistory() {
    let backend: ChatMessage[] = [];
    try {
      backend = await getChatHistory();
    } catch {
      backend = [];
    }
    if (Array.isArray(backend) && backend.length > 0) {
      const normalized = backend.map(normalizeHistoryMessage);
      setMessages(normalized);
      saveLocalHistory(normalized);
      return;
    }
    const local = loadLocalHistory();
    if (local.length > 0) setMessages(local);
  }

  async function send(text?: string) {
    const content = (text || input).trim();
    if (!content || loading) return;
    setInput("");
    setMessages((prev) => [
      ...prev,
      { id: nextId(), role: "user", content, createdAt: new Date().toISOString() },
    ]);
    setLoading(true);
    await runChat(content);
  }

  async function runChat(content: string) {
    const assistantId = nextId();
    setMessages((prev) => [
      ...prev,
      { id: assistantId, role: "assistant", content: "", streaming: true },
    ]);

    let finished = false;
    let streamedSoFar = "";
    const finish = (patch: Partial<ChatMessage>) => {
      if (finished) return;
      finished = true;
      setMessages((prev) =>
        prev.map((m) => (m.id === assistantId ? { ...m, streaming: false, ...patch } : m))
      );
      setLoading(false);
    };

    try {
      await sendChatStream(content, {
        onMessage: (delta) => {
          streamedSoFar += delta;
          setMessages((prev) =>
            prev.map((m) => (m.id === assistantId ? { ...m, content: m.content + delta } : m))
          );
        },
        onActions: (actions: ChatAction[]) => {
          setMessages((prev) =>
            prev.map((m) => (m.id === assistantId ? { ...m, actions } : m))
          );
        },
        onDone: (conversationId) => {
          finish({ conversation_id: conversationId });
        },
        onError: (message) => {
          finish({
            content: message || "Something went wrong. Please try again.",
            error: true,
          });
        },
      });
      if (!finished) finish({});
    } catch {
      // Stream unavailable → keep partial output if any, else JSON fallback.
      if (streamedSoFar) {
        toast("Connection lost — showing partial response.", { type: "warning" });
        finish({});
        return;
      }
      try {
        const res = await sendChat(content);
        finish({ content: res.answer, actions: res.actions, conversation_id: res.conversation_id });
      } catch (err) {
        finish({
          content: err instanceof Error ? err.message : "Something went wrong. Please try again.",
          error: true,
        });
      }
    }
  }

  function handleQuickReply(text: string) {
    send(text);
  }

  function handleClear() {
    setMessages([]);
    clearLocalHistory();
    clearChatHistory().catch(() => {});
    toast("Chat history cleared.", { type: "info" });
  }

  async function handleCreateTicket(assistantMsg: ChatMessage) {
    if (convertingTicket) return;
    const idx = messages.findIndex((m) => m.id === assistantMsg.id);
    let question = "";
    for (let i = idx - 1; i >= 0; i--) {
      if (messages[i].role === "user") {
        question = messages[i].content;
        break;
      }
    }
    setConvertingTicket(true);
    try {
      const result = await convertChatToTicket({
        question,
        answer: assistantMsg.content,
        conversation_id: assistantMsg.conversation_id,
      });
      setMessages((prev) =>
        prev.map((m) => (m.id === assistantMsg.id ? { ...m, ticket_id: result.ticket_id } : m))
      );
      toast(`Ticket #${result.ticket_id} created.`, {
        type: "success",
        duration: 6000,
        action: {
          label: "View ticket",
          onClick: () => router.push(`/support/tickets/${result.ticket_id}`),
        },
      });
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed to create ticket", { type: "error" });
    } finally {
      setConvertingTicket(false);
    }
  }

  function renderActions(message: ChatMessage) {
    if (!message.actions || message.actions.length === 0 || message.streaming) return null;
    return (
      <div className="mt-2 space-y-2">
        {message.actions.map((action, i) => {
          if (action.type === "create_ticket") {
            if (message.ticket_id) {
              return (
                <Link
                  key={i}
                  href={`/support/tickets/${message.ticket_id}`}
                  className="block rounded-md bg-success/10 px-3 py-2 text-xs font-medium text-success hover:bg-success/20"
                >
                  Ticket #{message.ticket_id} created — view it
                </Link>
              );
            }
            return (
              <Button
                key={i}
                size="sm"
                variant="outline"
                className="w-full text-xs"
                loading={convertingTicket}
                disabled={convertingTicket}
                onClick={() => handleCreateTicket(message)}
              >
                Create support ticket
              </Button>
            );
          }
          if (action.type === "articles" && action.articles?.length) {
            return (
              <div key={i} className="space-y-1">
                <p className="text-xs font-medium text-neutral-500">{action.label}</p>
                {action.articles.map((article) => (
                  <Link
                    key={article.id}
                    href={`/help/${article.slug}`}
                    className="block rounded-md bg-neutral-100 px-3 py-1.5 text-xs text-neutral-700 hover:bg-neutral-200"
                  >
                    {article.title}
                  </Link>
                ))}
              </div>
            );
          }
          return null;
        })}
      </div>
    );
  }

  const activeStream = messages.find((m) => m.streaming);
  const showTyping = loading && activeStream && activeStream.content === "";

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col items-end gap-3 sm:bottom-6 sm:right-6">
      {open && (
        <div
          role="dialog"
          aria-label="Ascendly support chat"
          className="flex h-[min(70dvh,560px)] w-[min(92vw,380px)] flex-col overflow-hidden rounded-lg border border-neutral-200 bg-neutral-0 shadow-xl dark:border-neutral-800 dark:bg-neutral-900"
        >
          <div className="flex items-center justify-between border-b border-neutral-200 px-4 py-3 dark:border-neutral-800">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">Ascendly Support</p>
              <p className="text-xs text-neutral-600 dark:text-neutral-400">AI assistant — 24/7</p>
            </div>
            <div className="flex items-center gap-1">
              {messages.length > 0 && (
                <Button variant="ghost" size="sm" onClick={handleClear} className="h-8 px-2 text-xs text-neutral-500">
                  Clear
                </Button>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setOpen(false)}
                aria-label="Close support chat"
                className="h-8 w-8 p-0"
              >
                ✕
              </Button>
            </div>
          </div>

          <div
            role="log"
            aria-live="polite"
            aria-relevant="additions"
            aria-busy={loading}
            className="flex-1 overflow-y-auto px-4 py-3"
          >
            {messages.length === 0 && (
              <div className="mt-4 space-y-3">
                <p className="text-sm text-neutral-600 dark:text-neutral-400">Hi! How can I help you today?</p>
                <div className="flex flex-wrap gap-2">
                  {QUICK_REPLIES.map((q) => (
                    <Button
                      key={q}
                      variant="outline"
                      size="sm"
                      onClick={() => handleQuickReply(q)}
                      className="text-xs"
                    >
                      {q}
                    </Button>
                  ))}
                </div>
              </div>
            )}
            {messages.map((m) => (
              <div key={m.id} className={`mb-3 flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${
                    m.role === "user"
                      ? "bg-primary-600 text-white"
                      : m.error
                        ? "border border-error/30 bg-error/5 text-neutral-800 dark:text-neutral-200"
                        : "border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-800"
                  }`}
                >
                  <p className="whitespace-pre-wrap">{m.content}</p>
                  {renderActions(m)}
                </div>
              </div>
            ))}
            {showTyping && (
              <div className="mb-3 flex justify-start" aria-label="Assistant is typing">
                <div className="rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-600 dark:border-neutral-800 dark:bg-neutral-800 dark:text-neutral-300">
                  <span className="typing-dots" aria-hidden="true">
                    <span>.</span>
                    <span>.</span>
                    <span>.</span>
                  </span>
                  <span className="sr-only">Thinking…</span>
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          <div className="border-t border-neutral-200 px-3 py-2 dark:border-neutral-800">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                send();
              }}
              className="flex gap-2"
            >
              <Textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Type a message..."
                aria-label="Chat message"
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
        </div>
      )}
      {!open && (
        <Button
          ref={launcherRef}
          onClick={() => setOpen(true)}
          aria-label="Open support chat"
          aria-expanded={false}
          className="h-14 w-14 rounded-full bg-accent-500 shadow-lg hover:bg-accent-600"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
        </Button>
      )}
    </div>
  );
}
