// Domain types mirroring the backend Prisma schema, plus the AI response
// metadata the chat endpoint returns for AI-aware UX.

export type DocumentStatus = 'PENDING' | 'PROCESSING' | 'READY' | 'FAILED';

export type MessageRole = 'USER' | 'ASSISTANT' | 'SYSTEM';

export interface User {
  id: string;
  email: string;
  createdAt: string;
}

export interface AuthResponse {
  token: string;
  user: User;
}

export interface Document {
  id: string;
  ownerId: string;
  title: string;
  // Original extracted text. May be omitted by the API for file-based uploads
  // (the backend keeps it for retrieval; the UI doesn't need the full body).
  content?: string;
  status: DocumentStatus;
  // Ingestion progress 0–100, surfaced while status is PROCESSING.
  progress?: number | null;
  // File metadata (present for uploaded files).
  fileName?: string | null;
  mimeType?: string | null;
  sizeBytes?: number | null;
  // Reason for a FAILED ingestion, if any.
  error?: string | null;
  createdAt: string;
  updatedAt: string;
}

// A source chunk the assistant used to ground its answer (from the vector store).
export interface MessageSource {
  documentId: string;
  documentTitle?: string;
  snippet: string;
  score?: number;
  // Human-readable page range the snippet came from, e.g. "1" or "1–2".
  page?: string;
}

export interface Message {
  id: string;
  conversationId: string;
  role: MessageRole;
  content: string;
  model?: string | null;
  promptTokens?: number | null;
  completionTokens?: number | null;
  // Grounding passages (assistant messages only).
  sources?: MessageSource[];
  createdAt: string;
}

export interface Conversation {
  id: string;
  userId: string;
  // Legacy single-document binding. Null for cross-document conversations,
  // which retrieve across all of the user's READY documents.
  documentId: string | null;
  title: string | null;
  createdAt: string;
  updatedAt: string;
  messages?: Message[];
}

export interface SendMessageResponse {
  userMessage: Message;
  assistantMessage: Message;
}
