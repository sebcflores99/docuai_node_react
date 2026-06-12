import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { ConversationsProvider } from '../conversations/ConversationsContext';
import { Sidebar } from './Sidebar';

export function Layout() {
  const [navOpen, setNavOpen] = useState(false);

  return (
    <ConversationsProvider>
      <div className="app-shell">
        <Sidebar open={navOpen} onClose={() => setNavOpen(false)} />
        <div className="app-content">
          <header className="app-topbar">
            <button
              type="button"
              className="icon-btn nav-toggle"
              aria-label="Toggle navigation"
              onClick={() => setNavOpen((o) => !o)}
            >
              ☰
            </button>
            <span className="topbar-brand">
              <span className="brand-mark" aria-hidden="true">◆</span> DocuAI
            </span>
          </header>
          <main className="app-main">
            <Outlet />
          </main>
        </div>
      </div>
    </ConversationsProvider>
  );
}
