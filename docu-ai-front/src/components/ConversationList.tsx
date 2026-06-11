import type { Conversation } from '../types';

// Sidebar list of the user's conversations with a "new chat" affordance.
export function ConversationList({
  conversations,
  activeId,
  onSelect,
  onNew,
}: {
  conversations: Conversation[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
}) {
  return (
    <aside className="conversations">
      <button type="button" className="btn btn-primary btn-block" onClick={onNew}>
        + New chat
      </button>
      <ul className="conversation-items">
        {conversations.map((c) => (
          <li key={c.id}>
            <button
              type="button"
              className={`conversation-item ${c.id === activeId ? 'is-active' : ''}`}
              onClick={() => onSelect(c.id)}
            >
              {c.title?.trim() || 'Untitled chat'}
            </button>
          </li>
        ))}
        {conversations.length === 0 && (
          <li className="conversation-empty muted">No chats yet</li>
        )}
      </ul>
    </aside>
  );
}
