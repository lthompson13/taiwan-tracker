import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { SignedIn, SignedOut, UserButton } from '@clerk/clerk-react';
import { useSubscription } from '../hooks/useSubscription';
import TranslationBanner from './TranslationBanner';
import './Layout.css';

const NAV_ITEMS = [
  { to: '/', label: 'Dashboard' },
  { to: '/legislators', label: 'Legislators' },
  { to: '/bills', label: 'Bills' },
  { to: '/interpellations', label: 'Interpellations' },
  { to: '/committees', label: 'Committees' },
  { to: '/activity', label: 'Activity' },
  { to: '/watchlist', label: 'My Watchlist' },
];

function Layout() {
  const navigate = useNavigate();
  const { isSubscribed, isLoaded } = useSubscription();
  const currentDate = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });

  return (
    <div className="layout">
      <header className="layout-topbar">
        <div className="layout-topbar-left">
          <span className="layout-topbar-title">Taiwan Legislative Tracker</span>
          <span className="layout-topbar-subtitle">Legislative Yuan monitoring</span>
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
