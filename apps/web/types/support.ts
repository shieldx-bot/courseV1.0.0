export type ChatRole = "user" | "assistant";

export interface ChatArticle {
  id: string;
  title: string;
  slug: string;
}

export interface ChatAction {
  type: string;
  label: string;
  articles?: ChatArticle[];
}

export interface ChatMessage {
  id: string;
  role: ChatRole;
  content: string;
  actions?: ChatAction[];
  conversation_id?: string;
  ticket_id?: string;
  streaming?: boolean;
  error?: boolean;
  createdAt?: string;
}

export interface ChatResponse {
  answer: string;
  actions?: ChatAction[];
  conversation_id?: string;
  error?: string | null;
}

export interface ConvertTicketPayload {
  question: string;
  answer: string;
  conversation_id?: string;
}

export interface ConvertTicketResult {
  ticket_id: string;
}

export type ChatStreamEventType = "message" | "context" | "actions" | "done" | "error";
