import type {
  ChatAction,
  ChatMessage,
  ChatResponse,
  ConvertTicketPayload,
  ConvertTicketResult,
} from "@/types/support";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "/api/v1";

export const SUPPORT_CHAT_STORAGE_KEY = "ascendly-support-chat";

// ── envelope parsing (matches backend `api_response`) ─────────────────────

interface Envelope<T> {
  success: boolean;
  data?: T;
  error?: { code?: string; message?: string } | string;
}

async function parseEnvelope<T>(res: Response): Promise<T> {
  const json = (await res.json().catch(() => null)) as Envelope<T> | null;
  if (!json || !json.success) {
    const message =
      !json ? `Request failed (${res.status})`
      : typeof json.error === "string" ? json.error
      : json.error?.message ?? `Request failed (${res.status})`;
    throw new Error(message);
  }
  return json.data as T;
}

// ── JSON (non-streaming) fallback ──────────────────────────────────────────

export async function sendChat(question: string): Promise<ChatResponse> {
  const res = await fetch(`${API_URL}/support/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message: question }),
  });
  if (!res.ok) throw new Error(await res.text().catch(() => `Request failed (${res.status})`));
  return parseEnvelope<ChatResponse>(res);
}

// ── SSE streaming ───────────────────────────────────────────────────────────

export interface ChatStreamHandlers {
  onMessage: (delta: string) => void;
  onActions?: (actions: ChatAction[]) => void;
  onContext?: (context: string[]) => void;
  onDone?: (conversationId?: string) => void;
  onError?: (message: string) => void;
}

/**
 * POST /support/chat/stream (SSE) via fetch + ReadableStream.
 *
 * Contract (from backend AI-A):
 *   event: message -> data: {"delta": "..."} | plain text chunk
 *   event: context -> data: ["article 1", ...] | {"context": [...]}
 *   event: actions -> data: [{"type": "create_ticket", "label": "..."}] | {"actions": [...]}
 *   event: done    -> data: {"conversation_id": "..."} | [DONE]
 *   event: error   -> data: "message"
 *
 * Resolves when the stream completes (`done`), rejects when the transport
 * fails (non-2xx, missing body, read error) so callers can fall back to JSON.
 */
export async function sendChatStream(question: string, handlers: ChatStreamHandlers, timeoutMs = 90_000): Promise<void> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  let res: Response;
  try {
    res = await fetch(`${API_URL}/support/chat/stream`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "text/event-stream" },
      body: JSON.stringify({ message: question }),
      signal: controller.signal,
    });
  } catch (err) {
    clearTimeout(timer);
    throw err instanceof Error ? err : new Error("Stream unavailable");
  }

  if (!res.ok || !res.body) {
    clearTimeout(timer);
    throw new Error(`Stream unavailable (${res.status})`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const events = buffer.split("\n\n");
      buffer = events.pop() ?? "";
      for (const raw of events) {
        handleSSEEvent(raw, handlers);
      }
    }
    if (buffer.trim()) handleSSEEvent(buffer, handlers);
  } catch (err) {
    clearTimeout(timer);
    throw err instanceof Error ? err : new Error("Stream interrupted");
  } finally {
    clearTimeout(timer);
  }
}

function handleSSEEvent(raw: string, handlers: ChatStreamHandlers): void {
  let event = "message";
  const dataLines: string[] = [];

  for (const line of raw.split("\n")) {
    if (line.startsWith("event:")) event = line.slice(6).trim();
    else if (line.startsWith("data:")) dataLines.push(line.slice(5).trimStart());
  }
  if (dataLines.length === 0) return;
  const data = dataLines.join("\n");

  switch (event) {
    case "actions": {
      const actions = parseJsonish(data, ["actions", ""]) as ChatAction[] | null;
      if (Array.isArray(actions)) handlers.onActions?.(actions);
      break;
    }
    case "context": {
      const context = parseJsonish(data, ["context", ""]) as string[] | null;
      if (Array.isArray(context)) handlers.onContext?.(context);
      break;
    }
    case "done": {
      let conversationId: string | undefined;
      const parsed = parseJsonish(data, [""]);
      if (parsed && typeof parsed === "object") conversationId = (parsed as { conversation_id?: string }).conversation_id;
      handlers.onDone?.(conversationId);
      break;
    }
    case "error":
      handlers.onError?.(data);
      break;
    case "message":
    default: {
      if (data.trim() === "[DONE]") {
        handlers.onDone?.();
        break;
      }
      const parsed = parseJsonish(data, ["delta", "text", "chunk", ""]);
      const text =
        typeof parsed === "string" ? parsed
        : parsed !== null ? String(parsed)
        : data;
      if (text) handlers.onMessage(text);
      break;
    }
  }
}

/**
 * Tries to interpret `data` as JSON. If `keys` is given, prefers the value of
 * the first key present (falling back to the raw payload). Returns `null` when
 * the payload is not JSON.
 */
function parseJsonish(data: string, keys: string[] = []): unknown {
  let parsed: unknown = null;
  try {
    parsed = JSON.parse(data);
  } catch {
    return null;
  }
  if (parsed && typeof parsed === "object" && keys.length > 0) {
    const record = parsed as Record<string, unknown>;
    for (const key of keys) {
      if (key && key in record) return record[key];
    }
  }
  return parsed;
}

// ── Convert conversation to ticket ──────────────────────────────────────────

export async function convertChatToTicket(payload: ConvertTicketPayload): Promise<ConvertTicketResult> {
  const res = await fetch(`${API_URL}/support/chat/convert-to-ticket`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(await res.text().catch(() => `Request failed (${res.status})`));
  return parseEnvelope<ConvertTicketResult>(res);
}

// ── History ──────────────────────────────────────────────────────────────────

export async function getChatHistory(): Promise<ChatMessage[]> {
  const res = await fetch(`${API_URL}/support/chat/history`, { headers: { "Content-Type": "application/json" } });
  if (!res.ok) return [];
  const data = await parseEnvelope<ChatMessage[]>(res);
  return Array.isArray(data) ? data : [];
}

export async function clearChatHistory(): Promise<void> {
  const res = await fetch(`${API_URL}/support/chat/history`, { method: "DELETE" });
  if (!res.ok) throw new Error(`Failed to clear history (${res.status})`);
}

// ── Local persistence (fast session restore) ────────────────────────────────

export function loadLocalHistory(): ChatMessage[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(SUPPORT_CHAT_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as ChatMessage[]) : [];
  } catch {
    return [];
  }
}

export function saveLocalHistory(messages: ChatMessage[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(SUPPORT_CHAT_STORAGE_KEY, JSON.stringify(messages));
  } catch {
    // storage full / unavailable — ignore
  }
}

export function clearLocalHistory(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(SUPPORT_CHAT_STORAGE_KEY);
  } catch {
    // ignore
  }
}
