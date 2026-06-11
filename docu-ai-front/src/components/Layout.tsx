import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/useAuth';

export function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate('/login', { replace: true });
  }

  return (
    <div className="app-shell">
      <header className="app-header">
        <Link to="/" className="brand">
          <span className="brand-mark" aria-hidden="true">◆</span>
          DocuAI
        </Link>
        <nav className="app-nav">
          {user && (
            <>
              <NavLink to="/chat" className="nav-link">
                Chat
              </NavLink>
              <NavLink to="/documents" className="nav-link">
                Documents
              </NavLink>
              <span className="user-email" title={user.email}>
                {user.email}
              </span>
              <button type="button" className="btn btn-ghost" onClick={handleLogout}>
                Log out
              </button>
            </>
          )}
        </nav>
      </header>
      <main className="app-main">
        <Outlet />
      </main>
    </div>
  );
}
