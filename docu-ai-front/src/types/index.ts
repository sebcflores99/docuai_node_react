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
  content: string;
  status: DocumentStatus;
  createdAt: string;
  updatedAt: string;
}

// A source chunk the assistant used to ground its answer (from the vector store).
export interface MessageSource {
  documentId: string;
  documentTitle?: string;
  snippet: string;
  score?: number;
}

export interface Message {
  id: string;
  conversationId: string;
  role: MessageRole;
  content: string;
  model?: string | null;
  promptTokens?: number | null;
  completionTokens?: number | null;
  // AI-aware UX metadata (assistant messages only).
  confidence?: number | null;
  sources?: MessageSource[];
  createdAt: string;
}

export interface Conversation {
  id: string;
  userId: string;
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
