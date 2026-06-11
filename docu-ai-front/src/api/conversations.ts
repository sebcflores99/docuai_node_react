import { apiRequest } from './client';
import type { Conversation, SendMessageResponse } from '../types';

export function listConversations(): Promise<Conversation[]> {
  return apiRequest<Conversation[]>('/conversations');
}

export function getConversation(id: string): Promise<Conversation> {
  return apiRequest<Conversation>(`/conversations/${id}`);
}

/**
 * Creates a cross-document conversation. With no documentIds the assistant
 * retrieves across all of the user's READY documents; pass documentIds to
 * scope it to a subset.
 */
export function createConversation(params: {
  title?: string;
  documentIds?: string[];
} = {}): Promise<Conversation> {
  return apiRequest<Conversation>('/conversations', {
    method: 'POST',
    body: params,
  });
}

export function sendMessage(
  conversationId: string,
  content: string,
  options: { documentIds?: string[]; signal?: AbortSignal } = {},
): Promise<SendMessageResponse> {
  const { documentIds, signal } = options;
  return apiRequest<SendMessageResponse>(
    `/conversations/${conversationId}/messages`,
    {
      method: 'POST',
      body: documentIds && documentIds.length > 0 ? { content, documentIds } : { content },
      signal,
    },
  );
}
