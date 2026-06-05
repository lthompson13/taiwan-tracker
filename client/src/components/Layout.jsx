import { NavLink, Outlet } from 'react-router-dom';
import TranslationBanner from './TranslationBanner';
import './Layout.css';

const NAV_ITEMS = [
  { to: '/', label: 'Dashboard' },
  { to: '/legislators', label: 'Legislators' },
  { to: '/bills', label: 'Bills' },
  { to: '/interpellations', label: 'Interpellations' },
  { to: '/committees', label: 'Committees' },
  { to: '/activity', label: 'Activity' },
  { to: '/archive', label: 'Archive' },
];

function Layout() {
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
        <div className="layout-topbar-right" />
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
