import { useCallback, useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import type { Conversation, Document, Message } from '../types';
import * as convApi from '../api/conversations';
import { listDocuments } from '../api/documents';
import { ApiError } from '../api/client';
import { Loading, ErrorState, EmptyState } from '../components/States';
import { MessageBubble } from '../components/MessageBubble';
import { ModelStatus } from '../components/ModelStatus';
import type { ModelPhase } from '../components/ModelStatus';
import { ConversationList } from '../components/ConversationList';
import { DocumentScope } from '../components/DocumentScope';
import { messageSchema, validate } from '../validation/schemas';

// Cross-document chat: ask questions answered from any of the user's READY
// documents. Conversations are listed in a sidebar; answers cite their sources.
export function ChatPage() {
  const { conversationId: routeId } = useParams<{ conversationId: string }>();
  const navigate = useNavigate();

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [scopeIds, setScopeIds] = useState<string[]>([]);

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const [input, setInput] = useState('');
  const [inputError, setInputError] = useState<string | null>(null);
  const [phase, setPhase] = useState<ModelPhase>('idle');

  const listRef = useRef<HTMLDivElement>(null);
  const loadedRef = useRef<string | null>(null);

  // Initial load: conversations + documents.
  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const [convs, docs] = await Promise.all([
          convApi.listConversations(),
          listDocuments(),
        ]);
        if (!active) return;
        setConversations(convs);
        setDocuments(docs);
        setLoadError(null);
      } catch (err) {
        if (active) {
          setLoadError(
            err instanceof ApiError ? err.message : 'Failed to load chats.',
          );
        }
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [reloadKey]);

  // Load the active conversation's messages when the route changes.
  useEffect(() => {
    let active = true;
    void (async () => {
      if (!routeId || loadedRef.current === routeId) return;
      try {
        const conv = await convApi.getConversation(routeId);
        if (!active) return;
        setMessages(conv.messages ?? []);
        loadedRef.current = routeId;
      } catch {
        if (active) setMessages([]);
      }
    })();
    return () => {
      active = false;
    };
  }, [routeId]);

  // Auto-scroll to the newest message.
  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [messages, phase]);

  const startNewChat = useCallback(() => {
    setMessages([]);
    loadedRef.current = null;
    setPhase('idle');
    navigate('/chat');
  }, [navigate]);

  const send = useCallback(
    async (content: string) => {
      const text = content.trim();
      if (!text || phase === 'thinking') return;

      setPhase('thinking');
      const optimisticUser: Message = {
        id: `tmp-${Date.now()}`,
        conversationId: routeId ?? 'pending',
        role: 'USER',
        content: text,
        createdAt: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, optimisticUser]);

      try {
        let convId = routeId ?? null;
        if (!convId) {
          const conv = await convApi.createConversation({
            documentIds: scopeIds.length > 0 ? scopeIds : undefined,
          });
          convId = conv.id;
          loadedRef.current = conv.id;
          setConversations((prev) => [conv, ...prev]);
          navigate(`/chat/${conv.id}`, { replace: true });
        }

        const res = await convApi.sendMessage(convId, text, {
          documentIds: scopeIds.length > 0 ? scopeIds : undefined,
        });
        setMessages((prev) => [
          ...prev.filter((m) => m.id !== optimisticUser.id),
          res.userMessage,
          res.assistantMessage,
        ]);
        setPhase('idle');
      } catch {
        setPhase('error');
      }
    },
    [routeId, scopeIds, navigate, phase],
  );

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const result = validate(messageSchema, { content: input });
    if (!result.success) {
      setInputError(result.errors.content ?? 'Type a question first');
      return;
    }
    setInputError(null);
    const text = input;
    setInput('');
    void send(text);
  }

  if (loading) return <Loading label="Loading chat…" />;
  if (loadError) {
    return (
      <ErrorState
        message={loadError}
        onRetry={() => {
          setLoading(true);
          setLoadError(null);
          setReloadKey((k) => k + 1);
        }}
      />
    );
  }

  const readyCount = documents.filter((d) => d.status === 'READY').length;

  return (
    <div className="chat-layout">
      <ConversationList
        conversations={conversations}
        activeId={routeId ?? null}
        onSelect={(id) => navigate(`/chat/${id}`)}
        onNew={startNewChat}
      />

      <div className="chat-main">
        {readyCount === 0 ? (
          <EmptyState
            title="No documents ready yet"
            detail="Upload and process a document before chatting."
            action={
              <Link to="/documents" className="btn btn-primary">
                Go to documents
              </Link>
            }
          />
        ) : (
          <>
            <div className="chat-messages" ref={listRef}>
              {messages.length === 0 && phase === 'idle' && (
                <div className="chat-intro">
                  <h2>Ask about your documents</h2>
                  <p className="muted">
                    Questions are answered from your {readyCount} ready document
                    {readyCount === 1 ? '' : 's'}. Each answer shows the passages it
                    used.
                  </p>
                </div>
              )}

              {messages.map((m) => (
                <MessageBubble
                  key={m.id}
                  message={m}
                  onReask={phase !== 'thinking' ? (c) => void send(c) : undefined}
                />
              ))}

              <ModelStatus phase={phase} />
            </div>

            <form onSubmit={handleSubmit} className="chat-input">
              <DocumentScope
                documents={documents}
                selected={scopeIds}
                onChange={setScopeIds}
              />
              <div className="chat-input-row">
                <textarea
                  rows={2}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSubmit(e);
                    }
                  }}
                  placeholder="Ask a question about your documents…"
                  disabled={phase === 'thinking'}
                  aria-invalid={Boolean(inputError)}
                />
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={phase === 'thinking' || !input.trim()}
                >
                  {phase === 'thinking' ? 'Thinking…' : 'Ask'}
                </button>
              </div>
              {inputError && <span className="field-error">{inputError}</span>}
            </form>
          </>
        )}
      </div>
    </div>
  );
}
