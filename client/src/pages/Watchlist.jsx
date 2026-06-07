import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@clerk/clerk-react';
import { useSubscription } from '../hooks/useSubscription';
import Panel from '../components/Panel';
import StatusBadge from '../components/StatusBadge';
import Loader from '../components/Loader';

const STANCE_LABELS = {
  support: { icon: '👍', label: 'Support', color: '#15803d', bg: '#dcfce7' },
  oppose:  { icon: '👎', label: 'Oppose',  color: '#b91c1c', bg: '#fee2e2' },
  monitor: { icon: '👁',  label: 'Monitor', color: 'var(--teal)', bg: 'var(--teal-light)' },
};

const PRIORITY_LABELS = {
  high:   { label: 'High',   color: '#b91c1c', bg: '#fee2e2' },
  medium: { label: 'Medium', color: '#b45309', bg: '#fef3c7' },
  low:    { label: 'Low',    color: '#15803d', bg: '#dcfce7' },
};

const selectStyle = {
  padding: '6px 10px',
  border: '1px solid var(--border-default)',
  borderRadius: 'var(--radius-sm)',
  fontSize: '0.825rem',
  color: 'var(--text-primary)',
  background: 'var(--bg-elevated)',
  cursor: 'pointer',
};

function getStatusBadgeType(status) {
  if (!status) return 'default';
  if (status === 'Third Reading (Passed)') return 'success';
  if (status === 'Scheduled for Plenary' || status === 'Scheduled for Plenary (Discussion)') return 'warning';
  if (status === 'Review Complete' || status === 'Review Complete (Overdue)') return 'info';
  return 'default';
}

function Watchlist() {
  const navigate = useNavigate();
  const { isSignedIn } = useAuth();
  const { isSubscribed } = useSubscription();

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stanceFilter, setStanceFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');

  useEffect(() => {
    if (!isSignedIn) { setLoading(false); return; }

    fetch('/api/user/bills', { credentials: 'include' })
      .then((r) => r.json())
      .then((data) => setItems(Array.isArray(data) ? data : []))
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, [isSignedIn]);

  if (!isSignedIn) {
    return (
      <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-muted)' }}>
        <p style={{ marginBottom: '16px' }}>Sign in to view your watchlist.</p>
        <button
          onClick={() => navigate('/sign-in')}
          style={{ padding: '8px 20px', background: 'var(--navy)', color: 'white', border: 'none', borderRadius: 'var(--radius-sm)', cursor: 'pointer', fontWeight: 500 }}
        >
          Sign in
        </button>
      </div>
    );
  }

  if (!isSubscribed) {
    return (
      <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-muted)' }}>
        <div style={{ fontSize: '2rem', marginBottom: '12px' }}>👁</div>
        <p style={{ fontSize: '0.9rem', marginBottom: '6px' }}>Watchlists are a Pro feature.</p>
        <p style={{ fontSize: '0.825rem', marginBottom: '20px' }}>Track bills, set stance, priority, and notes with a Pro subscription.</p>
        <button
          onClick={() => navigate('/upgrade')}
          style={{ padding: '8px 20px', background: 'var(--navy)', color: 'white', border: 'none', borderRadius: 'var(--radius-sm)', cursor: 'pointer', fontWeight: 500 }}
        >
          Upgrade to Pro →
        </button>
      </div>
    );
  }

  const filtered = items.filter((item) => {
    if (stanceFilter && item.stance !== stanceFilter) return false;
    if (priorityFilter && item.priority !== priorityFilter) return false;
    return true;
  });

  return (
    <div>
      <div style={{ marginBottom: '20px', paddingBottom: '12px', borderBottom: '1px solid var(--border-subtle)' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 700, margin: 0 }}>My Watchlist</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', margin: '4px 0 0 0' }}>
          {items.length} tracked bill{items.length !== 1 ? 's' : ''}
        </p>
      </div>

      {/* Filters */}
      {items.length > 0 && (
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center', marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 500 }}>Stance:</label>
            <select style={selectStyle} value={stanceFilter} onChange={(e) => setStanceFilter(e.target.value)}>
              <option value="">All</option>
              <option value="support">👍 Support</option>
              <option value="oppose">👎 Oppose</option>
              <option value="monitor">👁 Monitor</option>
            </select>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 500 }}>Priority:</label>
            <select style={selectStyle} value={priorityFilter} onChange={(e) => setPriorityFilter(e.target.value)}>
              <option value="">All</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
          </div>
        </div>
      )}

      {loading ? (
        <Loader text="Loading watchlist" />
      ) : items.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-muted)' }}>
          <div style={{ fontSize: '2rem', marginBottom: '12px' }}>👁</div>
          <p style={{ fontSize: '0.9rem' }}>No bills tracked yet.</p>
          <p style={{ fontSize: '0.825rem', marginTop: '6px' }}>
            Open any bill and use the tracking panel to add it here.
          </p>
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
          No bills match your filters.
        </div>
      ) : (
        <Panel>
          {filtered.map((item, idx) => {
            const bill = item.bill;
            const stance = STANCE_LABELS[item.stance];
            const priority = PRIORITY_LABELS[item.priority];
            return (
              <div
                key={item.billId}
                onClick={() => navigate(`/bills/${encodeURIComponent(item.billId)}`)}
                style={{
                  padding: '14px 0',
                  borderBottom: idx < filtered.length - 1 ? '1px solid var(--border-subtle)' : 'none',
                  cursor: 'pointer',
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-hover)'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '16px' }}>
                  <div style={{ flex: 1 }}>
                    {/* Bill name */}
                    <div style={{ fontSize: '0.9rem', color: 'var(--text-primary)', marginBottom: '6px', lineHeight: 1.4 }}>
                      {bill?.billName || item.billId}
                    </div>

                    {/* Bill badges */}
                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center', marginBottom: item.note ? '8px' : 0 }}>
                      {bill?.status && <StatusBadge label={bill.status} type={getStatusBadgeType(bill.status)} />}
                      {bill?.category && <StatusBadge label={bill.category} type="info" />}
                      {Array.isArray(bill?.sectors) && bill.sectors.map((s) => (
                        <StatusBadge key={s} label={s} type="sector" />
                      ))}

                      {/* User annotations */}
                      {item.watching && (
                        <span style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--navy)', background: 'var(--navy-light)', border: '1px solid var(--navy)', borderRadius: '999px', padding: '1px 7px' }}>
                          👁 Watching
                        </span>
                      )}
                      {stance && (
                        <span style={{ fontSize: '0.7rem', fontWeight: 700, color: stance.color, background: stance.bg, border: `1px solid ${stance.color}`, borderRadius: '999px', padding: '1px 7px' }}>
                          {stance.icon} {stance.label}
                        </span>
                      )}
                      {priority && (
                        <span style={{ fontSize: '0.7rem', fontWeight: 700, color: priority.color, background: priority.bg, border: `1px solid ${priority.color}`, borderRadius: '999px', padding: '1px 7px' }}>
                          {priority.label} priority
                        </span>
                      )}
                    </div>

                    {/* Note */}
                    {item.note && (
                      <div style={{ fontSize: '0.825rem', color: 'var(--text-secondary)', fontStyle: 'italic', borderLeft: '3px solid var(--border-default)', paddingLeft: '8px' }}>
                        {item.note}
                      </div>
                    )}
                  </div>

                  {/* Term / date */}
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    {bill?.term && (
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '2px' }}>
                        Term {bill.term}{bill.session ? ` · Session ${bill.session}` : ''}
                      </div>
                    )}
                    {bill?.latestProgressDate && (
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        {bill.latestProgressDate}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </Panel>
      )}
    </div>
  );
}

export default Watchlist;
