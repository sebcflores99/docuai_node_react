import { useCallback, useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import type { Conversation, Document, Message } from '../types';
import { getDocument } from '../api/documents';
import * as convApi from '../api/conversations';
import { ApiError } from '../api/client';
import { Loading, ErrorState } from '../components/States';
import { MessageBubble } from '../components/MessageBubble';
import { ModelStatus } from '../components/ModelStatus';
import type { ModelPhase } from '../components/ModelStatus';
import { DocumentStatusBadge } from '../components/DocumentStatusBadge';

// "Results" page: chat with the AI assistant over a single document.
export function ChatPage() {
  const { documentId } = useParams<{ documentId: string }>();

  const [doc, setDoc] = useState<Document | null>(null);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const [input, setInput] = useState('');
  const [phase, setPhase] = useState<ModelPhase>('idle');

  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!documentId) return;
    let active = true;
    void (async () => {
      try {
        const [document, conversations] = await Promise.all([
          getDocument(documentId),
          convApi.listConversations(documentId),
        ]);
        if (!active) return;
        setDoc(document);
        const existing: Conversation | undefined = conversations[0];
        if (existing) {
          setConversationId(existing.id);
          const full = await convApi.getConversation(existing.id);
          if (active) setMessages(full.messages ?? []);
        }
        if (active) setLoadError(null);
      } catch (err) {
        if (active) {
          setLoadError(
            err instanceof ApiError ? err.message : 'Failed to load conversation.',
          );
        }
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [documentId, reloadKey]);

  const retry = useCallback(() => {
    setLoading(true);
    setLoadError(null);
    setReloadKey((k) => k + 1);
  }, []);

  // Auto-scroll to the newest message.
  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [messages, phase]);

  const send = useCallback(
    async (content: string) => {
      const text = content.trim();
      if (!text || !documentId || phase === 'thinking') return;

      setPhase('thinking');
      const optimisticUser: Message = {
        id: `tmp-${Date.now()}`,
        conversationId: conversationId ?? 'pending',
        role: 'USER',
        content: text,
        createdAt: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, optimisticUser]);

      try {
        let convId = conversationId;
        if (!convId) {
          const conv = await convApi.createConversation(documentId);
          convId = conv.id;
          setConversationId(conv.id);
        }
        const res = await convApi.sendMessage(convId, text);
        // Replace optimistic user message with the persisted pair.
        setMessages((prev) => [
          ...prev.filter((m) => m.id !== optimisticUser.id),
          res.userMessage,
          res.assistantMessage,
        ]);
        setPhase('idle');
      } catch {
        // Keep the user message visible so they can re-ask.
        setPhase('error');
      }
    },
    [conversationId, documentId, phase],
  );

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const text = input;
    setInput('');
    void send(text);
  }

  if (loading) return <Loading label="Loading conversation…" />;
  if (loadError) return <ErrorState message={loadError} onRetry={retry} />;

  return (
    <div className="chat-page">
      <header className="chat-header card">
        <div>
          <Link to="/documents" className="link-button">← Documents</Link>
          <h1>{doc?.title}</h1>
        </div>
        {doc && <DocumentStatusBadge status={doc.status} />}
      </header>

      <div className="chat-messages" ref={listRef}>
        {messages.length === 0 && phase === 'idle' && (
          <div className="chat-intro">
            <p className="muted">
              Ask anything about <strong>{doc?.title}</strong>. The assistant answers
              using only this document and shows the passages it relied on.
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
          placeholder="Ask a question about this document…"
          disabled={phase === 'thinking'}
        />
        <button
          type="submit"
          className="btn btn-primary"
          disabled={phase === 'thinking' || !input.trim()}
        >
          {phase === 'thinking' ? 'Thinking…' : 'Ask'}
        </button>
      </form>
    </div>
  );
}
