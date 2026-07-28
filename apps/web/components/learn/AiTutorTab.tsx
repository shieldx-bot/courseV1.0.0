"use client";

import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import { Sparkles, Send, Trash2, Loader2, Bot, User, AlertCircle } from "lucide-react";

interface AiTutorTabProps {
  courseId: string;
  lessonId: string;
}

interface Message {
  role: "user" | "assistant";
  content: string;
  timestamp: string;
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export function AiTutorTab({ courseId, lessonId }: AiTutorTabProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [messages, setMessages] = useState<Message[]>([]);
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Load history on mount
  useEffect(() => {
    if (!user) {
      setLoadingHistory(false);
      return;
    }
    fetch(`${API_BASE}/api/v1/courses/${courseId}/lessons/${lessonId}/ai-tutor/history`, {
      credentials: "include",
    })
      .then((res) => res.json())
      .then((data) => {
        if (data?.data?.messages) {
          setMessages(data.data.messages);
        }
      })
      .catch(() => {
        // Silently fail — history is not critical
      })
      .finally(() => setLoadingHistory(false));
  }, [courseId, lessonId, user]);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleAsk = async () => {
    if (!question.trim() || loading) return;

    const userMessage: Message = {
      role: "user",
      content: question.trim(),
      timestamp: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setQuestion("");
    setLoading(true);

    // Add a placeholder assistant message
    const placeholder: Message = {
      role: "assistant",
      content: "",
      timestamp: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, placeholder]);

    try {
      const res = await fetch(
        `${API_BASE}/api/v1/courses/${courseId}/lessons/${lessonId}/ai-tutor/ask`,
        {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ question: userMessage.content }),
        }
      );

      if (!res.ok) {
        throw new Error("Failed to get answer");
      }

      const data = await res.json();
      const answer = data?.data?.answer || "Xin lỗi, tôi không thể trả lời câu hỏi này ngay lúc này.";

      // Replace placeholder with actual answer
      setMessages((prev) => {
        const updated = [...prev];
        updated[updated.length - 1] = {
          role: "assistant",
          content: answer,
          timestamp: new Date().toISOString(),
        };
        return updated;
      });
    } catch (err) {
      // Replace placeholder with error
      setMessages((prev) => {
        const updated = [...prev];
        updated[updated.length - 1] = {
          role: "assistant",
          content: "Xin lỗi, đã xảy ra lỗi khi kết nối với AI Tutor. Vui lòng thử lại sau.",
          timestamp: new Date().toISOString(),
        };
        return updated;
      });
      toast("Failed to get AI response", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleClearHistory = async () => {
    if (!confirm("Clear all conversation history?") || !user) return;

    try {
      await fetch(
        `${API_BASE}/api/v1/courses/${courseId}/lessons/${lessonId}/ai-tutor/history`,
        {
          method: "DELETE",
          credentials: "include",
        }
      );
      setMessages([]);
      toast("History cleared", "success");
    } catch {
      toast("Failed to clear history", "error");
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleAsk();
    }
  };

  if (!user) {
    return (
      <Card className="p-8 text-center text-neutral-600">
        <Bot className="h-12 w-12 mx-auto text-neutral-300 mb-4" />
        <p className="text-lg font-medium">AI Tutor</p>
        <p className="mt-2 text-sm">Sign in to ask questions about this lesson.</p>
      </Card>
    );
  }

  return (
    <div className="flex flex-col h-[500px]">
      {/* Header */}
      <div className="flex items-center justify-between px-1 pb-3">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-accent-500" />
          <span className="font-semibold text-primary-900">AI Tutor</span>
          <span className="text-xs text-neutral-400">Ask anything about this lesson</span>
        </div>
        {messages.length > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleClearHistory}
            className="text-neutral-400 hover:text-error"
            title="Clear history"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto space-y-4 mb-4 pr-1">
        {loadingHistory ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-neutral-400" />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <Bot className="h-10 w-10 text-neutral-300 mb-3" />
            <p className="text-sm text-neutral-500 max-w-xs">
              Ask a question about this lesson and I&apos;ll help you understand it better.
            </p>
            <p className="mt-2 text-xs text-neutral-400">
              Example: &ldquo;Can you explain the main concept in simpler terms?&rdquo;
            </p>
          </div>
        ) : (
          messages.map((msg, i) => (
            <div
              key={i}
              className={cn(
                "flex gap-3",
                msg.role === "user" ? "justify-end" : "justify-start"
              )}
            >
              {msg.role === "assistant" && (
                <div className="h-8 w-8 rounded-full bg-accent-100 flex items-center justify-center shrink-0">
                  <Bot className="h-4 w-4 text-accent-600" />
                </div>
              )}
              <div
                className={cn(
                  "max-w-[80%] rounded-2xl px-4 py-3 text-sm",
                  msg.role === "user"
                    ? "bg-accent-600 text-white rounded-br-md"
                    : "bg-neutral-100 text-neutral-900 rounded-bl-md"
                )}
              >
                {msg.content ? (
                  <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                ) : (
                  <div className="flex items-center gap-2 text-neutral-400">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Thinking...</span>
                  </div>
                )}
                {msg.content && (
                  <p className="mt-1 text-[10px] text-right opacity-60">
                    {new Date(msg.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </p>
                )}
              </div>
              {msg.role === "user" && (
                <div className="h-8 w-8 rounded-full bg-primary-100 flex items-center justify-center shrink-0">
                  <User className="h-4 w-4 text-primary-600" />
                </div>
              )}
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="flex gap-2 items-end">
        <Textarea
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask a question about this lesson..."
          className="min-h-[44px] max-h-[120px] resize-none text-sm"
          maxLength={2000}
          disabled={loading}
        />
        <Button
          onClick={handleAsk}
          disabled={!question.trim() || loading}
          className="h-[44px] w-[44px] p-0 shrink-0"
          title="Send (Enter)"
        >
          {loading ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <Send className="h-5 w-5" />
          )}
        </Button>
      </div>
      <p className="mt-1 text-[10px] text-neutral-400 text-right">
        Press Enter to send · Shift+Enter for new line
      </p>
    </div>
  );
}