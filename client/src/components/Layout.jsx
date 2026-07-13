import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { SignedIn, SignedOut, UserButton, useUser } from '@clerk/clerk-react';
import { useSubscription } from '../hooks/useSubscription';
import TranslationBanner from './TranslationBanner';
import './Layout.css';

const NAV_ITEMS = [
  { to: '/', label: 'Dashboard' },
  { to: '/legislators', label: 'Legislators' },
  { to: '/bills', label: 'Bills' },
  { to: '/committees', label: 'Committees' },
  { to: '/activity', label: 'Activity' },
  { to: '/hearings',  label: 'Hearings' },
  { to: '/news',      label: 'News' },
  { to: '/watchlist', label: 'My Watchlist' },
  { to: '/lists',    label: 'My Lists' },
];

function Layout() {
  const navigate = useNavigate();
  const { isSubscribed, isLoaded } = useSubscription();
  const { user } = useUser();
  const isAdmin = user?.publicMetadata?.isAdmin === true;
  const currentDate = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });

  return (
    <div className="layout">
      <header className="layout-topbar">
        <div className="layout-topbar-left" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <svg width="30" height="30" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
            <rect width="32" height="32" rx="6" fill="rgba(255,255,255,0.12)"/>
            <circle cx="14" cy="13" r="7" fill="none" stroke="#2A7F8E" strokeWidth="2.5"/>
            <rect x="10.5" y="10.5" width="7" height="1.5" rx="0.75" fill="white"/>
            <rect x="10.5" y="13.5" width="5" height="1.5" rx="0.75" fill="white" opacity="0.7"/>
            <line x1="19.5" y1="18.5" x2="25" y2="24" stroke="#2A7F8E" strokeWidth="2.5" strokeLinecap="round"/>
          </svg>
          <span className="layout-topbar-title">BillScope Taiwan</span>
        </div>
        <div className="layout-topbar-right">
          <SignedOut>
            <button
              onClick={() => navigate('/sign-in')}
              style={{
                padding: '6px 16px',
                background: 'transparent',
                border: '1px solid rgba(255,255,255,0.35)',
                borderRadius: 'var(--radius-sm)',
                color: 'white',
                fontSize: '0.825rem',
                fontWeight: 500,
                cursor: 'pointer',
              }}
            >
              Sign in
            </button>
          </SignedOut>
          <SignedIn>
            <UserButton afterSignOutUrl="/" />
          </SignedIn>
        </div>
      </header>

      <div className="layout-body">
        <aside className="layout-sidebar">
          <div className="layout-sidebar-label">Navigation</div>
          <nav>
            <ul className="layout-nav">
              {NAV_ITEMS.map(({ to, label }) => (
                <li key={to} className="layout-nav-item">
                  <NavLink
                    to={to}
                    end={to === '/'}
                    className={({ isActive }) =>
                      `layout-nav-link${isActive ? ' active' : ''}`
                    }
                  >
                    {label}
                  </NavLink>
                </li>
              ))}
            </ul>
          </nav>
          {isAdmin && (
            <div style={{ padding: '8px 12px 0' }}>
              <NavLink
                to="/admin"
                className={({ isActive }) => `layout-nav-link${isActive ? ' active' : ''}`}
                style={{ display: 'block', padding: '6px 10px', fontSize: '0.8rem', color: '#7c3aed', fontWeight: 600 }}
              >
                ⚙ Admin
              </NavLink>
            </div>
          )}
          {isLoaded && !isSubscribed && (
            <div style={{ padding: '12px 12px 8px' }}>
              <button
                onClick={() => navigate('/upgrade')}
                style={{
                  display: 'block',
                  width: '100%',
                  padding: '8px 12px',
                  background: 'var(--teal)',
                  color: 'white',
                  border: 'none',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  textAlign: 'center',
                  letterSpacing: '0.02em',
                }}
              >
                Upgrade to Pro →
              </button>
            </div>
          )}
        </aside>

        <main className="layout-main">
          {/* Translation status warning (renders nothing when healthy) */}
          <TranslationBanner />
          <Outlet />
        </main>
      </div>

      <footer className="layout-statusbar">
        <div className="layout-statusbar-left">
          <span className="layout-status-indicator">
            <span className="layout-status-dot" />
            <span>System online</span>
          </span>
          <span className="layout-status-text-dim">{currentDate}</span>
        </div>
        <div className="layout-statusbar-right">
          <span className="layout-status-text-dim">Data source: Legislative Yuan API v2</span>
        </div>
      </footer>
    </div>
  );
}

export default Layout;
