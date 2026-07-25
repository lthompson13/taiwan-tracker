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
  const [tagFilter, setTagFilter] = useState('');
  const [togglingNotify, setTogglingNotify] = useState(null);

  // Report mode
  const [reportMode, setReportMode] = useState(false);
  const [selectedBills, setSelectedBills] = useState(new Set());
  const [reportFormat, setReportFormat] = useState('docx');
  const [generating, setGenerating] = useState(false);
  const [generateError, setGenerateError] = useState(null);

  useEffect(() => {
    if (!isSignedIn) { setLoading(false); return; }

    fetch('/api/user/bills', { credentials: 'include' })
      .then((r) => r.json())
      .then((data) => setItems(Array.isArray(data) ? data : []))
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, [isSignedIn]);

  const handleToggleNotify = async (e, item) => {
    e.stopPropagation();
    if (togglingNotify === item.billId) return;
    setTogglingNotify(item.billId);
    const newVal = !item.notifyEnabled;
    try {
      const res = await fetch(`/api/user/bills/${encodeURIComponent(item.billId)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ notifyEnabled: newVal }),
      });
      if (res.ok) {
        setItems((prev) => prev.map((i) => i.billId === item.billId ? { ...i, notifyEnabled: newVal } : i));
      }
    } catch (err) {
      console.error('[watchlist] toggle notify error:', err.message);
    } finally {
      setTogglingNotify(null);
    }
  };

  const handleToggleReportMode = () => {
    setReportMode((prev) => !prev);
    setSelectedBills(new Set());
    setGenerateError(null);
  };

  const handleToggleBillSelect = (e, billId) => {
    e.stopPropagation();
    setSelectedBills((prev) => {
      const next = new Set(prev);
      if (next.has(billId)) next.delete(billId);
      else next.add(billId);
      return next;
    });
  };

  const handleSelectAll = (filteredItems) => {
    setSelectedBills(new Set(filteredItems.map((i) => i.billId)));
  };

  const handleDeselectAll = () => setSelectedBills(new Set());

  const handleGenerateReport = async () => {
    const billIds = [...selectedBills];
    if (billIds.length === 0) return;
    setGenerating(true);
    setGenerateError(null);
    try {
      const res = await fetch('/api/user/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ billIds, format: reportFormat }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Server error ${res.status}`);
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const dateStr = new Date().toISOString().slice(0, 10);
      a.href = url;
      a.download = `billscope-report-${dateStr}.${reportFormat}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      setGenerateError(err.message);
    } finally {
      setGenerating(false);
    }
  };

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

  // Unique tags across all watchlist items for the filter dropdown
  const allTagOptions = [];
  const seenTagIds = new Set();
  for (const item of items) {
    for (const tag of (item.tags || [])) {
      if (!seenTagIds.has(tag.id)) { seenTagIds.add(tag.id); allTagOptions.push(tag); }
    }
  }
  allTagOptions.sort((a, b) => a.name.localeCompare(b.name));

  const filtered = items.filter((item) => {
    if (stanceFilter && item.stance !== stanceFilter) return false;
    if (priorityFilter && item.priority !== priorityFilter) return false;
    if (tagFilter && !(item.tags || []).some((t) => String(t.id) === tagFilter)) return false;
    return true;
  });

  const allFilteredSelected = filtered.length > 0 && filtered.every((i) => selectedBills.has(i.billId));

  return (
    <div style={{ paddingBottom: reportMode ? '112px' : 0 }}>
      {/* Header */}
      <div style={{ marginBottom: '20px', paddingBottom: '12px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700, margin: 0 }}>My Watchlist</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', margin: '4px 0 0 0' }}>
            {items.length} tracked bill{items.length !== 1 ? 's' : ''}
          </p>
        </div>
        {items.length > 0 && (
          <button
            onClick={handleToggleReportMode}
            style={{
              padding: '7px 14px',
              fontSize: '0.825rem',
              fontWeight: 600,
              border: `1px solid ${reportMode ? 'var(--teal)' : 'var(--border-default)'}`,
              borderRadius: 'var(--radius-sm)',
              background: reportMode ? 'var(--teal-light)' : 'var(--bg-elevated)',
              color: reportMode ? 'var(--teal)' : 'var(--text-secondary)',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            {reportMode ? '✕ Cancel' : '⬇ Export Report'}
          </button>
        )}
      </div>

      {/* Filters + select-all in report mode */}
      {items.length > 0 && (
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center', marginBottom: '16px' }}>
          {reportMode && (
            <button
              onClick={() => allFilteredSelected ? handleDeselectAll() : handleSelectAll(filtered)}
              style={{
                padding: '5px 12px',
                fontSize: '0.8rem',
                fontWeight: 600,
                border: '1px solid var(--border-default)',
                borderRadius: 'var(--radius-sm)',
                background: 'var(--bg-elevated)',
                color: 'var(--text-secondary)',
                cursor: 'pointer',
              }}
            >
              {allFilteredSelected ? 'Deselect all' : 'Select all'}
            </button>
          )}
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
          {allTagOptions.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 500 }}>Tag:</label>
              <select style={selectStyle} value={tagFilter} onChange={(e) => setTagFilter(e.target.value)}>
                <option value="">All</option>
                {allTagOptions.map((t) => (
                  <option key={t.id} value={String(t.id)}>{t.name}</option>
                ))}
              </select>
            </div>
          )}
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
            const isSelected = selectedBills.has(item.billId);
            return (
              <div
                key={item.billId}
                onClick={reportMode
                  ? (e) => handleToggleBillSelect(e, item.billId)
                  : () => navigate(`/bills/${encodeURIComponent(item.billId)}`)
                }
                style={{
                  padding: '14px 0',
                  borderBottom: idx < filtered.length - 1 ? '1px solid var(--border-subtle)' : 'none',
                  cursor: 'pointer',
                  background: reportMode && isSelected ? 'var(--teal-light)' : 'transparent',
                  transition: 'background 0.1s',
                }}
                onMouseEnter={(e) => {
                  if (!(reportMode && isSelected)) e.currentTarget.style.background = 'var(--bg-hover)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = reportMode && isSelected ? 'var(--teal-light)' : 'transparent';
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '16px' }}>
                  {/* Checkbox in report mode */}
                  {reportMode && (
                    <div style={{ flexShrink: 0, paddingTop: '2px' }}>
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={(e) => handleToggleBillSelect(e, item.billId)}
                        onClick={(e) => e.stopPropagation()}
                        style={{ width: '16px', height: '16px', accentColor: 'var(--teal)', cursor: 'pointer' }}
                      />
                    </div>
                  )}

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

                      {/* User tags */}
                      {(item.tags || []).map((tag) => (
                        <span key={tag.id} style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--navy)', background: 'var(--navy-light)', border: '1px solid var(--navy)', borderRadius: '999px', padding: '1px 7px' }}>
                          {tag.name}
                        </span>
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

                  {/* Notify toggle + Term / date (hidden in report mode) */}
                  {!reportMode && (
                    <div style={{ textAlign: 'right', flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '6px' }}>
                      <button
                        onClick={(e) => handleToggleNotify(e, item)}
                        disabled={togglingNotify === item.billId}
                        title={item.notifyEnabled ? 'Notifications on — click to turn off' : 'Click to get email alerts for this bill'}
                        style={{ fontSize: '0.9rem', background: item.notifyEnabled ? 'var(--navy-light)' : 'transparent', border: `1px solid ${item.notifyEnabled ? 'var(--navy)' : 'var(--border-default)'}`, borderRadius: 'var(--radius-sm)', padding: '3px 8px', cursor: 'pointer', color: item.notifyEnabled ? 'var(--navy)' : 'var(--text-muted)', lineHeight: 1 }}
                      >
                        🔔
                      </button>
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
                  )}
                </div>
              </div>
            );
          })}
        </Panel>
      )}

      {/* Floating report action bar */}
      {reportMode && (
        <div style={{
          position: 'fixed',
          bottom: 'var(--statusbar-height)',
          left: 0,
          right: 0,
          background: 'var(--bg-elevated)',
          borderTop: '1px solid var(--border-default)',
          padding: '12px 24px',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          flexWrap: 'wrap',
          zIndex: 100,
          boxShadow: '0 -2px 12px rgba(0,0,0,0.08)',
        }}>
          <span style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', fontWeight: 500 }}>
            {selectedBills.size === 0
              ? 'Select bills to include in report'
              : `${selectedBills.size} bill${selectedBills.size !== 1 ? 's' : ''} selected`}
          </span>

          <div style={{ flex: 1 }} />

          {generateError && (
            <span style={{ fontSize: '0.8rem', color: '#b91c1c' }}>{generateError}</span>
          )}

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 500 }}>Format:</label>
            <select style={selectStyle} value={reportFormat} onChange={(e) => setReportFormat(e.target.value)}>
              <option value="docx">Word (.docx)</option>
              <option value="xlsx">Excel (.xlsx)</option>
            </select>
          </div>

          <button
            onClick={handleGenerateReport}
            disabled={generating || selectedBills.size === 0}
            style={{
              padding: '8px 18px',
              fontSize: '0.875rem',
              fontWeight: 600,
              background: selectedBills.size === 0 ? 'var(--border-default)' : 'var(--navy)',
              color: selectedBills.size === 0 ? 'var(--text-muted)' : 'white',
              border: 'none',
              borderRadius: 'var(--radius-sm)',
              cursor: selectedBills.size === 0 || generating ? 'not-allowed' : 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            {generating ? 'Generating…' : '⬇ Generate Report'}
          </button>
        </div>
      )}
    </div>
  );
}

export default Watchlist;
