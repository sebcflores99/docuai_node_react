import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import type { ReactNode } from 'react';
import type { Conversation } from '../types';
import * as convApi from '../api/conversations';
import { ApiError } from '../api/client';

interface ConversationsValue {
  conversations: Conversation[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  /** Inserts a newly created conversation at the top (optimistic). */
  addConversation: (conversation: Conversation) => void;
  /** Merges a partial conversation in place (e.g. after rename). */
  upsertConversation: (conversation: Pick<Conversation, 'id'> & Partial<Conversation>) => void;
  removeConversation: (id: string) => void;
}

const ConversationsContext = createContext<ConversationsValue | null>(null);

/**
 * Shares the conversation list across the persistent sidebar and the chat page
 * so both stay in sync without prop-drilling or duplicate fetches.
 */
export function ConversationsProvider({ children }: { children: ReactNode }) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const convs = await convApi.listConversations();
      setConversations(convs);
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load chats.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const addConversation = useCallback((conversation: Conversation) => {
    setConversations((prev) =>
      prev.some((c) => c.id === conversation.id) ? prev : [conversation, ...prev],
    );
  }, []);

  const upsertConversation = useCallback(
    (conversation: Pick<Conversation, 'id'> & Partial<Conversation>) => {
      setConversations((prev) =>
        prev.map((c) => (c.id === conversation.id ? { ...c, ...conversation } : c)),
      );
    },
    [],
  );

  const removeConversation = useCallback((id: string) => {
    setConversations((prev) => prev.filter((c) => c.id !== id));
  }, []);

  const value = useMemo<ConversationsValue>(
    () => ({
      conversations,
      loading,
      error,
      refresh,
      addConversation,
      upsertConversation,
      removeConversation,
    }),
    [conversations, loading, error, refresh, addConversation, upsertConversation, removeConversation],
  );

  return (
    <ConversationsContext.Provider value={value}>{children}</ConversationsContext.Provider>
  );
}

export function useConversations(): ConversationsValue {
  const ctx = useContext(ConversationsContext);
  if (!ctx) {
    throw new Error('useConversations must be used within a ConversationsProvider');
  }
  return ctx;
}
