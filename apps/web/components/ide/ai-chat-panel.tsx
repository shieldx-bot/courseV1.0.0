"use client";

import { useState, useRef, useEffect, type KeyboardEvent } from "react";
import {
  Sparkles,
  X,
  ChevronLeft,
  Send,
  Loader2,
  Bot,
  User,
  Info,
  Code2,
  Bug,
  Lightbulb,
  FileCode,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { ChatMessage } from "@/types/ide";

interface AiChatPanelProps {
  isOpen: boolean;
  onToggle: () => void;
  onSendMessage?: (message: string) => void;
  currentCode?: string;
  currentLanguage?: string;
}

const QUICK_ACTIONS = [
  { id: "explain", label: "Explain this code", icon: Code2 },
  { id: "fix", label: "Fix errors", icon: Bug },
  { id: "improve", label: "Suggest improvements", icon: Lightbulb },
  { id: "tests", label: "Write tests", icon: FileCode },
] as const;

const INITIAL_MESSAGES: ChatMessage[] = [
  {
    id: "welcome",
    role: "system",
    content:
      "Hello! I'm your AI coding assistant. How can I help you today?",
    timestamp: new Date(),
  },
];

export function AiChatPanel({
  isOpen,
  onToggle,
  onSendMessage,
  currentCode,
  currentLanguage,
}: AiChatPanelProps) {
  const [messages, setMessages] = useState<ChatMessage[]>(INITIAL_MESSAGES);
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = "auto";
      const newHeight = Math.min(textarea.scrollHeight, 160);
      textarea.style.height = `${newHeight}px`;
    }
  }, [inputValue]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isLoading]);

  const mockAssistantResponse = (userMessage: string) => {
    setIsLoading(true);
    setTimeout(() => {
      const assistantMessage: ChatMessage = {
        id: `assistant-${Date.now()}`,
        role: "assistant",
        content: `I received your message: "${userMessage}". This is a mock response. In a real implementation, this would connect to an AI backend to provide actual assistance.`,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, assistantMessage]);
      setIsLoading(false);
    }, 1500);
  };

  const handleSend = () => {
    if (!inputValue.trim() || isLoading) return;

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      content: inputValue.trim(),
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputValue("");

    if (onSendMessage) {
      onSendMessage(userMessage.content);
    } else {
      mockAssistantResponse(userMessage.content);
    }
  };

  const handleQuickAction = (label: string) => {
    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      content: label,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMessage]);

    if (onSendMessage) {
      setIsLoading(true);
      onSendMessage(label);
    } else {
      mockAssistantResponse(label);
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleClear = () => {
    setMessages([]);
  };

  const formatTime = (date: Date) => {
    return new Intl.DateTimeFormat("en-US", {
      hour: "2-digit",
      minute: "2-digit",
    }).format(date);
  };

  const renderMessageContent = (content: string) => {
    const codeBlockRegex = /```(\w+)?\n([\s\S]*?)```/g;
    const parts = content.split(codeBlockRegex);

    return parts.map((part, index) => {
      if (index % 3 === 2) {
        const language = parts[index - 1] || "";
        return (
          <pre
            key={index}
            className="mt-2 rounded-lg bg-neutral-950 p-3 overflow-x-auto border border-neutral-800"
          >
            {language && (
              <div className="mb-2 text-xs text-neutral-500 font-mono uppercase tracking-wide">
                {language}
              </div>
            )}
            <code className="font-mono text-xs text-neutral-100 leading-relaxed">
              {part}
            </code>
          </pre>
        );
      } else if (index % 3 === 0) {
        return (
          <p key={index} className="text-sm leading-relaxed whitespace-pre-wrap">
            {part.split(/(`[^`]+`)/g).map((segment, segIndex) => {
              if (segment.startsWith("`") && segment.endsWith("`")) {
                return (
                  <code
                    key={segIndex}
                    className="rounded bg-neutral-700 px-1.5 py-0.5 font-mono text-xs text-neutral-200"
                  >
                    {segment.slice(1, -1)}
                  </code>
                );
              }
              return segment;
            })}
          </p>
        );
      }
      return null;
    });
  };

  const renderAvatar = (role: "user" | "assistant" | "system") => {
    if (role === "user") {
      return (
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent-600 text-white shadow-sm">
          <User className="h-4 w-4" />
        </div>
      );
    }
    if (role === "assistant") {
      return (
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-neutral-700 text-accent-500 shadow-sm">
          <Bot className="h-4 w-4" />
        </div>
      );
    }
    return (
      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-neutral-700 text-neutral-400 shadow-sm">
        <Info className="h-4 w-4" />
      </div>
    );
  };

  if (!isOpen) {
    return (
      <button
        onClick={onToggle}
        className="flex h-10 w-10 items-center justify-center rounded-lg border border-neutral-700 bg-neutral-800 text-neutral-400 shadow-sm transition-all hover:bg-neutral-700 hover:text-accent-500 hover:border-accent-500/30"
        title="Open AI Assistant"
      >
        <Sparkles className="h-5 w-5" />
      </button>
    );
  }

  return (
    <div className="flex h-full w-full flex-col rounded-xl border border-neutral-700 bg-neutral-900 shadow-2xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-neutral-700 px-4 py-3 bg-neutral-900">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent-600/10 text-accent-500">
            <Sparkles className="h-4.5 w-4.5" />
          </div>
          <h2 className="font-sans text-base font-semibold text-neutral-100">
            AI Assistant
          </h2>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={handleClear}
            className="flex h-8 w-8 items-center justify-center rounded-md text-neutral-400 transition-colors hover:bg-neutral-800 hover:text-neutral-200"
            title="Clear chat"
          >
            <X className="h-4 w-4" />
          </button>
          <button
            onClick={onToggle}
            className="flex h-8 w-8 items-center justify-center rounded-md text-neutral-400 transition-colors hover:bg-neutral-800 hover:text-neutral-200"
            title="Close panel"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Messages */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-4 py-3 space-y-3"
      >
        {messages.length === 0 && (
          <div className="flex h-full items-center justify-center">
            <p className="text-sm text-neutral-500">
              No messages yet. Start a conversation!
            </p>
          </div>
        )}

        {messages.map((message) => (
          <div
            key={message.id}
            className={cn(
              "flex gap-3",
              message.role === "user" ? "flex-row-reverse" : "flex-row",
              message.role === "system" && "justify-center"
            )}
          >
            {message.role !== "system" && renderAvatar(message.role)}
            <div
              className={cn(
                "flex max-w-[85%] flex-col gap-1 rounded-xl px-3.5 py-2.5 shadow-sm transition-all",
                {
                  "bg-accent-600 text-white": message.role === "user",
                  "bg-neutral-800 text-neutral-100": message.role === "assistant",
                  "bg-neutral-800 text-neutral-400 italic text-center max-w-[90%]":
                    message.role === "system",
                }
              )}
            >
              <div className="flex items-center gap-2 text-xs opacity-70">
                {message.role === "user" && <span>You</span>}
                {message.role === "assistant" && <span>Assistant</span>}
                {message.role === "system" && <span>System</span>}
                <span>•</span>
                <span>{formatTime(message.timestamp)}</span>
              </div>
              <div className="text-sm leading-relaxed">
                {renderMessageContent(message.content)}
              </div>
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="flex gap-3">
            {renderAvatar("assistant")}
            <div className="flex items-center gap-2 rounded-xl bg-neutral-800 px-3.5 py-2.5 shadow-sm">
              <Loader2 className="h-4 w-4 animate-spin text-accent-500" />
              <span className="text-sm text-neutral-400">Thinking...</span>
            </div>
          </div>
        )}
      </div>

      {/* Quick actions */}
      {!isLoading && (
        <div className="border-t border-neutral-700 px-4 py-2 bg-neutral-900">
          <div className="flex flex-wrap gap-2">
            {QUICK_ACTIONS.map((action) => (
              <button
                key={action.id}
                onClick={() => handleQuickAction(action.label)}
                className="inline-flex items-center gap-1.5 rounded-md border border-neutral-700 bg-neutral-800 px-2.5 py-1.5 text-xs font-medium text-neutral-300 transition-all hover:border-accent-500/50 hover:bg-neutral-700 hover:text-accent-500"
              >
                <action.icon className="h-3.5 w-3.5" />
                {action.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input area */}
      <div className="border-t border-neutral-700 p-3 bg-neutral-900">
        <div className="flex items-end gap-2">
          <div className="relative flex-1">
            <textarea
              ref={textareaRef}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask anything..."
              rows={1}
              className={cn(
                "w-full rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2.5 pr-10 text-sm text-neutral-100 placeholder:text-neutral-500",
                "focus:border-accent-500 focus:outline-none focus:ring-2 focus:ring-accent-500/20",
                "resize-none overflow-hidden"
              )}
              style={{ minHeight: "40px", maxHeight: "160px" }}
            />
            <button
              onClick={handleSend}
              disabled={!inputValue.trim() || isLoading}
              className="absolute bottom-1.5 right-2 flex h-7 w-7 items-center justify-center rounded-md bg-accent-600 text-white transition-colors hover:bg-accent-500 disabled:opacity-40 disabled:cursor-not-allowed"
              title="Send message"
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
