import { apiRequest } from './client';
import type { Conversation, SendMessageResponse } from '../types';

export function listConversations(documentId?: string): Promise<Conversation[]> {
  const query = documentId ? `?documentId=${encodeURIComponent(documentId)}` : '';
  return apiRequest<Conversation[]>(`/conversations${query}`);
}

export function getConversation(id: string): Promise<Conversation> {
  return apiRequest<Conversation>(`/conversations/${id}`);
}

export function createConversation(
  documentId: string,
  title?: string,
): Promise<Conversation> {
  return apiRequest<Conversation>('/conversations', {
    method: 'POST',
    body: { documentId, title },
  });
}

export function sendMessage(
  conversationId: string,
  content: string,
  signal?: AbortSignal,
): Promise<SendMessageResponse> {
  return apiRequest<SendMessageResponse>(`/conversations/${conversationId}/messages`, {
    method: 'POST',
    body: { content },
    signal,
  });
}
