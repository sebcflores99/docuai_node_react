import { useCallback, useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import type { Document, Message } from '../types';
import * as convApi from '../api/conversations';
import { listDocuments } from '../api/documents';
import { ApiError } from '../api/client';
import { Loading, ErrorState } from '../components/States';
import { MessageBubble } from '../components/MessageBubble';
import { ModelStatus } from '../components/ModelStatus';
import type { ModelPhase } from '../components/ModelStatus';
import { DocumentScope } from '../components/DocumentScope';
import { useConversations } from '../conversations/ConversationsContext';
import { messageSchema, validate } from '../validation/schemas';

// Focused, single-thread chat view (the conversation history lives in the
// persistent sidebar). Answers are grounded in the user's documents via the
// RAG agent and cite their sources.
export function ChatPage() {
  const { conversationId: routeId } = useParams<{ conversationId: string }>();
  const navigate = useNavigate();
  const { addConversation } = useConversations();

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

  // Initial load: documents (for the scope picker).
  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const docs = await listDocuments();
        if (!active) return;
        setDocuments(docs);
        setLoadError(null);
      } catch (err) {
        if (active) {
          setLoadError(err instanceof ApiError ? err.message : 'Failed to load chat.');
        }
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [reloadKey]);

  // Load the active conversation's messages when the route changes; clear when
  // starting a fresh chat (no route id).
  useEffect(() => {
    let active = true;
    if (!routeId) {
      setMessages([]);
      loadedRef.current = null;
      setPhase('idle');
      return;
    }
    void (async () => {
      if (loadedRef.current === routeId) return;
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
          addConversation(conv);
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
    [routeId, scopeIds, navigate, phase, addConversation],
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
    <div className="chat-view">
      <div className="chat-messages" ref={listRef}>
        {messages.length === 0 && phase === 'idle' && (
          <div className="chat-intro">
            <span className="chat-intro-mark" aria-hidden="true">◆</span>
            <h2>How can I help?</h2>
            <p className="muted">
              {readyCount > 0
                ? `Ask anything — I can search your ${readyCount} ready document${
                    readyCount === 1 ? '' : 's'
                  } and cite the passages I use.`
                : 'Ask me anything. Upload documents to ground my answers in your own content.'}
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

      <form onSubmit={handleSubmit} className="composer">
        <div className="composer-box">
          <textarea
            rows={1}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSubmit(e);
              }
            }}
            placeholder="Message DocuAI…"
            disabled={phase === 'thinking'}
            aria-invalid={Boolean(inputError)}
          />
          <div className="composer-bar">
            <DocumentScope documents={documents} selected={scopeIds} onChange={setScopeIds} />
            <button
              type="submit"
              className="btn btn-primary composer-send"
              disabled={phase === 'thinking' || !input.trim()}
            >
              {phase === 'thinking' ? 'Thinking…' : 'Send'}
            </button>
          </div>
        </div>
        {inputError && <span className="field-error">{inputError}</span>}
      </form>
    </div>
  );
}
