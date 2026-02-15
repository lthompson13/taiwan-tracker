import { NavLink, Outlet } from 'react-router-dom';
import './Layout.css';

const NAV_ITEMS = [
  { to: '/', label: 'DASHBOARD' },
  { to: '/legislators', label: 'LEGISLATORS' },
  { to: '/bills', label: 'BILLS' },
  { to: '/interpellations', label: 'INTERPELLATIONS' },
  { to: '/committees', label: 'COMMITTEES' },
  { to: '/activity', label: 'ACTIVITY FEED' },
];

function Layout() {
  const currentDate = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });

  return (
    <div className="layout">
      {/* Top Bar */}
      <header className="layout-topbar">
        <div className="layout-topbar-left">
          <span className="layout-topbar-title">TAIWAN LEGISLATIVE TRACKER</span>
          <span className="layout-topbar-classified">// CLASSIFIED</span>
          <span className="layout-topbar-subtitle">LEGISLATIVE YUAN MONITORING SYSTEM</span>
        </div>
        <div className="layout-topbar-right">
          <span className="layout-classification-marker">TOP SECRET // SI // NOFORN</span>
        </div>
      </header>

      {/* Body: Sidebar + Main */}
      <div className="layout-body">
        <aside className="layout-sidebar">
          <div className="layout-sidebar-label">// Navigation</div>
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
                    <span className="layout-nav-link-prefix">&gt;</span>
                    {label}
                  </NavLink>
                </li>
              ))}
            </ul>
          </nav>
        </aside>

        <main className="layout-main">
          <Outlet />
        </main>
      </div>

      {/* Bottom Status Bar */}
      <footer className="layout-statusbar">
        <div className="layout-statusbar-left">
          <span className="layout-status-indicator">
            <span className="layout-status-dot"></span>
            <span className="layout-status-text-green">SYSTEM STATUS: OPERATIONAL</span>
          </span>
          <span className="layout-status-text-dim">{currentDate}</span>
        </div>
        <div className="layout-statusbar-right">
          <span className="layout-status-indicator">
            <span className="layout-status-dot"></span>
            <span className="layout-status-text-green">API: CONNECTED</span>
          </span>
        </div>
      </footer>
    </div>
  );
}

export default Layout;
