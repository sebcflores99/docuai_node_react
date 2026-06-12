import { NavLink, useLocation, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../auth/useAuth';
import { useConversations } from '../conversations/ConversationsContext';
import * as convApi from '../api/conversations';
import { ConversationList } from './ConversationList';

/**
 * Persistent left rail (ChatGPT/Claude-style): brand, new-chat, primary nav,
 * the conversation history, and the signed-in user. Collapsible on small
 * screens via the `open` flag owned by the Layout.
 */
export function Sidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { conversationId } = useParams<{ conversationId: string }>();
  const { user, logout } = useAuth();
  const { conversations, upsertConversation, removeConversation } = useConversations();

  const activeId = location.pathname.startsWith('/chat') ? conversationId ?? null : null;

  function go(path: string) {
    navigate(path);
    onClose();
  }

  async function handleDelete(id: string) {
    if (!window.confirm('Delete this chat? This can\u2019t be undone.')) return;
    removeConversation(id);
    if (activeId === id) navigate('/chat');
    try {
      await convApi.deleteConversation(id);
    } catch {
      // The list refetches on next load; ignore transient failures here.
    }
  }

  async function handleRename(id: string, title: string) {
    // Optimistic; reconcile with the server response.
    upsertConversation({ id, title });
    try {
      const updated = await convApi.renameConversation(id, title);
      upsertConversation(updated);
    } catch {
      // Ignore; the stored title will reconcile on next refresh.
    }
  }

  function handleLogout() {
    logout();
    navigate('/login', { replace: true });
  }

  return (
    <>
      <div
        className={`sidebar-scrim ${open ? 'is-open' : ''}`}
        onClick={onClose}
        aria-hidden="true"
      />
      <aside className={`sidebar ${open ? 'is-open' : ''}`}>
        <div className="sidebar-top">
          <button type="button" className="brand" onClick={() => go('/chat')}>
            <span className="brand-mark" aria-hidden="true">◆</span>
            DocuAI
          </button>
        </div>

        <button type="button" className="btn btn-primary btn-block new-chat" onClick={() => go('/chat')}>
          <span aria-hidden="true">＋</span> New chat
        </button>

        <nav className="sidebar-nav">
          <NavLink to="/chat" className="sidebar-link" onClick={onClose} end>
            <span aria-hidden="true">💬</span> Chat
          </NavLink>
          <NavLink to="/documents" className="sidebar-link" onClick={onClose}>
            <span aria-hidden="true">📄</span> Documents
          </NavLink>
        </nav>

        <div className="sidebar-history">
          <p className="sidebar-heading">Recent chats</p>
          <ConversationList
            conversations={conversations}
            activeId={activeId}
            onSelect={(id) => go(`/chat/${id}`)}
            onDelete={(id) => void handleDelete(id)}
            onRename={(id, title) => void handleRename(id, title)}
          />
        </div>

        <div className="sidebar-footer">
          <div className="sidebar-user" title={user?.email}>
            <span className="sidebar-avatar" aria-hidden="true">
              {user?.email?.[0]?.toUpperCase() ?? 'U'}
            </span>
            <span className="sidebar-user-email">{user?.email}</span>
          </div>
          <button type="button" className="btn btn-ghost btn-sm" onClick={handleLogout}>
            Log out
          </button>
        </div>
      </aside>
    </>
  );
}
