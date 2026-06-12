import { useEffect, useRef, useState } from 'react';
import type { Conversation } from '../types';

// Sidebar list of the user's conversations. Each row supports inline rename
// (double-click or the pencil) and delete; the active chat is highlighted.
export function ConversationList({
  conversations,
  activeId,
  onSelect,
  onDelete,
  onRename,
}: {
  conversations: Conversation[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  onRename: (id: string, title: string) => void;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editingId) inputRef.current?.focus();
  }, [editingId]);

  function startEdit(c: Conversation) {
    setEditingId(c.id);
    setDraft(c.title?.trim() || 'Untitled chat');
  }

  function commit() {
    if (!editingId) return;
    const title = draft.trim();
    if (title) onRename(editingId, title);
    setEditingId(null);
  }

  if (conversations.length === 0) {
    return <p className="conversation-empty muted">No chats yet</p>;
  }

  return (
    <ul className="conversation-items">
      {conversations.map((c) => {
        const isEditing = editingId === c.id;
        return (
          <li
            key={c.id}
            className={`conversation-row ${c.id === activeId ? 'is-active' : ''}`}
          >
            {isEditing ? (
              <input
                ref={inputRef}
                className="conversation-edit"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onBlur={commit}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') commit();
                  if (e.key === 'Escape') setEditingId(null);
                }}
                aria-label="Rename chat"
              />
            ) : (
              <>
                <button
                  type="button"
                  className="conversation-item"
                  onClick={() => onSelect(c.id)}
                  onDoubleClick={() => startEdit(c)}
                  title={c.title?.trim() || 'Untitled chat'}
                >
                  {c.title?.trim() || 'Untitled chat'}
                </button>
                <span className="conversation-actions">
                  <button
                    type="button"
                    className="icon-btn"
                    aria-label={`Rename ${c.title?.trim() || 'chat'}`}
                    title="Rename"
                    onClick={() => startEdit(c)}
                  >
                    ✎
                  </button>
                  <button
                    type="button"
                    className="icon-btn"
                    aria-label={`Delete ${c.title?.trim() || 'chat'}`}
                    title="Delete"
                    onClick={() => onDelete(c.id)}
                  >
                    ✕
                  </button>
                </span>
              </>
            )}
          </li>
        );
      })}
    </ul>
  );
}
