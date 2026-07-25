import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@clerk/clerk-react';
import { useSubscription } from '../hooks/useSubscription';
import Panel from '../components/Panel';
import StatusBadge from '../components/StatusBadge';
import Loader from '../components/Loader';

// ─── Shared constants ────────────────────────────────────────────────────────

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

const SECTOR_OPTIONS = [
  'Semiconductors', 'Defense', 'Energy', 'Financial Regulation', 'Healthcare',
  'Trade', 'Cross-Strait', 'Foreign Investment', 'Data & Technology', 'Labor',
  'Environment', 'Agriculture', 'Transportation',
];

const selectStyle = {
  padding: '6px 10px',
  border: '1px solid var(--border-default)',
  borderRadius: 'var(--radius-sm)',
  fontSize: '0.825rem',
  color: 'var(--text-primary)',
  background: 'var(--bg-elevated)',
  cursor: 'pointer',
};

function fmtDate(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function getStatusBadgeType(status) {
  if (!status) return 'default';
  if (status === 'Third Reading (Passed)') return 'success';
  if (status === 'Scheduled for Plenary' || status === 'Scheduled for Plenary (Discussion)') return 'warning';
  if (status === 'Review Complete' || status === 'Review Complete (Overdue)') return 'info';
  return 'default';
}

// ─── Smart list criteria builder ─────────────────────────────────────────────

const TERM_OPTS    = [{ v: '',   l: 'Any term' }, { v: '11', l: 'Term 11' }, { v: '10', l: 'Term 10' }];
const SESSION_OPTS = [{ v: '', l: 'Any session' }, ...[1,2,3,4,5,6,7,8].map(n => ({ v: String(n), l: `Session ${n}` }))];
const STANCE_OPTS  = [{ v: '', l: 'Any stance' }, { v: 'support', l: '👍 Support' }, { v: 'oppose', l: '👎 Oppose' }, { v: 'monitor', l: '👁 Monitor' }];
const PRIORITY_OPTS= [{ v: '', l: 'Any priority' }, { v: 'high', l: 'High' }, { v: 'medium', l: 'Medium' }, { v: 'low', l: 'Low' }];

const emptyCriteria = { term: '', session: '', sector: '', stance: '', priority: '', watching: false };

function CriteriaBuilder({ value, onChange }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '2px' }}>
        Auto-fill this list with bills matching these criteria:
      </div>
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        <select style={selectStyle} value={value.term} onChange={e => onChange({ ...value, term: e.target.value })}>
          {TERM_OPTS.map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
        </select>
        <select style={selectStyle} value={value.session} onChange={e => onChange({ ...value, session: e.target.value })}>
          {SESSION_OPTS.map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
        </select>
        <select style={selectStyle} value={value.sector} onChange={e => onChange({ ...value, sector: e.target.value })}>
          <option value="">Any sector</option>
          {SECTOR_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        <select style={selectStyle} value={value.stance} onChange={e => onChange({ ...value, stance: e.target.value })}>
          {STANCE_OPTS.map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
        </select>
        <select style={selectStyle} value={value.priority} onChange={e => onChange({ ...value, priority: e.target.value })}>
          {PRIORITY_OPTS.map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
        </select>
        <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.825rem', color: 'var(--text-secondary)', cursor: 'pointer' }}>
          <input type="checkbox" checked={value.watching} onChange={e => onChange({ ...value, watching: e.target.checked })} />
          Watching only
        </label>
      </div>
    </div>
  );
}

// ─── Watchlist tab ────────────────────────────────────────────────────────────

function WatchlistTab() {
  const navigate = useNavigate();
  const { isSignedIn } = useAuth();

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stanceFilter, setStanceFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [tagFilter, setTagFilter] = useState('');
  const [sectorFilter, setSectorFilter] = useState('');
  const [togglingNotify, setTogglingNotify] = useState(null);

  const [reportMode, setReportMode] = useState(false);
  const [selectedBills, setSelectedBills] = useState(new Set());
  const [reportFormat, setReportFormat] = useState('docx');
  const [generating, setGenerating] = useState(false);
  const [generateError, setGenerateError] = useState(null);

  useEffect(() => {
    if (!isSignedIn) { setLoading(false); return; }
    fetch('/api/user/bills', { credentials: 'include' })
      .then(r => r.json())
      .then(data => setItems(Array.isArray(data) ? data : []))
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
      if (res.ok) setItems(prev => prev.map(i => i.billId === item.billId ? { ...i, notifyEnabled: newVal } : i));
    } catch (err) {
      console.error('[watchlist] toggle notify error:', err.message);
    } finally {
      setTogglingNotify(null);
    }
  };

  const handleGenerateReport = async () => {
    const billIds = [...selectedBills];
    if (!billIds.length) return;
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
      a.href = url;
      a.download = `billscope-report-${new Date().toISOString().slice(0, 10)}.${reportFormat}`;
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

  // Unique user tags across all items
  const allTagOptions = [];
  const seenTagIds = new Set();
  for (const item of items) {
    for (const tag of (item.tags || [])) {
      if (!seenTagIds.has(tag.id)) { seenTagIds.add(tag.id); allTagOptions.push(tag); }
    }
  }
  allTagOptions.sort((a, b) => a.name.localeCompare(b.name));

  const filtered = items.filter(item => {
    if (stanceFilter && item.stance !== stanceFilter) return false;
    if (priorityFilter && item.priority !== priorityFilter) return false;
    if (tagFilter && !(item.tags || []).some(t => String(t.id) === tagFilter)) return false;
    if (sectorFilter && !(item.bill?.sectors || []).includes(sectorFilter)) return false;
    return true;
  });

  const allFilteredSelected = filtered.length > 0 && filtered.every(i => selectedBills.has(i.billId));

  if (loading) return <Loader text="Loading watchlist" />;

  if (items.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-muted)' }}>
        <div style={{ fontSize: '2rem', marginBottom: '12px' }}>👁</div>
        <p style={{ fontSize: '0.9rem' }}>No bills tracked yet.</p>
        <p style={{ fontSize: '0.825rem', marginTop: '6px' }}>Open any bill and use the tracking panel to add it here.</p>
      </div>
    );
  }

  return (
    <div style={{ paddingBottom: reportMode ? '112px' : 0 }}>
      {/* Subheader row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <span style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
          {items.length} tracked bill{items.length !== 1 ? 's' : ''}
        </span>
        {items.length > 0 && (
          <button
            onClick={() => { setReportMode(v => !v); setSelectedBills(new Set()); setGenerateError(null); }}
            style={{ padding: '7px 14px', fontSize: '0.825rem', fontWeight: 600, border: `1px solid ${reportMode ? 'var(--teal)' : 'var(--border-default)'}`, borderRadius: 'var(--radius-sm)', background: reportMode ? 'var(--teal-light)' : 'var(--bg-elevated)', color: reportMode ? 'var(--teal)' : 'var(--text-secondary)', cursor: 'pointer' }}
          >
            {reportMode ? '✕ Cancel' : '⬇ Export Report'}
          </button>
        )}
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center', marginBottom: '16px' }}>
        {reportMode && (
          <button
            onClick={() => allFilteredSelected ? setSelectedBills(new Set()) : setSelectedBills(new Set(filtered.map(i => i.billId)))}
            style={{ padding: '5px 12px', fontSize: '0.8rem', fontWeight: 600, border: '1px solid var(--border-default)', borderRadius: 'var(--radius-sm)', background: 'var(--bg-elevated)', color: 'var(--text-secondary)', cursor: 'pointer' }}
          >
            {allFilteredSelected ? 'Deselect all' : 'Select all'}
          </button>
        )}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 500 }}>Stance:</label>
          <select style={selectStyle} value={stanceFilter} onChange={e => setStanceFilter(e.target.value)}>
            <option value="">All</option>
            <option value="support">👍 Support</option>
            <option value="oppose">👎 Oppose</option>
            <option value="monitor">👁 Monitor</option>
          </select>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 500 }}>Priority:</label>
          <select style={selectStyle} value={priorityFilter} onChange={e => setPriorityFilter(e.target.value)}>
            <option value="">All</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 500 }}>Sector:</label>
          <select style={selectStyle} value={sectorFilter} onChange={e => setSectorFilter(e.target.value)}>
            <option value="">All</option>
            {SECTOR_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        {allTagOptions.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 500 }}>Tag:</label>
            <select style={selectStyle} value={tagFilter} onChange={e => setTagFilter(e.target.value)}>
              <option value="">All</option>
              {allTagOptions.map(t => <option key={t.id} value={String(t.id)}>{t.name}</option>)}
            </select>
          </div>
        )}
      </div>

      {filtered.length === 0 ? (
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
                  ? () => setSelectedBills(prev => { const n = new Set(prev); n.has(item.billId) ? n.delete(item.billId) : n.add(item.billId); return n; })
                  : () => navigate(`/bills/${encodeURIComponent(item.billId)}`)
                }
                style={{ padding: '14px 0', borderBottom: idx < filtered.length - 1 ? '1px solid var(--border-subtle)' : 'none', cursor: 'pointer', background: reportMode && isSelected ? 'var(--teal-light)' : 'transparent', transition: 'background 0.1s' }}
                onMouseEnter={e => { if (!(reportMode && isSelected)) e.currentTarget.style.background = 'var(--bg-hover)'; }}
                onMouseLeave={e => { e.currentTarget.style.background = reportMode && isSelected ? 'var(--teal-light)' : 'transparent'; }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '16px' }}>
                  {reportMode && (
                    <div style={{ flexShrink: 0, paddingTop: '2px' }}>
                      <input type="checkbox" checked={isSelected} readOnly style={{ width: '16px', height: '16px', accentColor: 'var(--teal)', cursor: 'pointer' }} />
                    </div>
                  )}
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '0.9rem', color: 'var(--text-primary)', marginBottom: '6px', lineHeight: 1.4 }}>
                      {bill?.billName || item.billId}
                    </div>
                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center', marginBottom: item.note ? '8px' : 0 }}>
                      {bill?.status && <StatusBadge label={bill.status} type={getStatusBadgeType(bill.status)} />}
                      {bill?.category && <StatusBadge label={bill.category} type="info" />}
                      {/* Sectors shown as system tags */}
                      {Array.isArray(bill?.sectors) && bill.sectors.map(s => (
                        <StatusBadge key={s} label={s} type="sector" />
                      ))}
                      {/* User tags */}
                      {(item.tags || []).map(tag => (
                        <span key={tag.id} style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--navy)', background: 'var(--navy-light)', border: '1px solid var(--navy)', borderRadius: '999px', padding: '1px 7px' }}>
                          {tag.name}
                        </span>
                      ))}
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
                    {item.note && (
                      <div style={{ fontSize: '0.825rem', color: 'var(--text-secondary)', fontStyle: 'italic', borderLeft: '3px solid var(--border-default)', paddingLeft: '8px' }}>
                        {item.note}
                      </div>
                    )}
                  </div>
                  {!reportMode && (
                    <div style={{ textAlign: 'right', flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '6px' }}>
                      <button
                        onClick={e => handleToggleNotify(e, item)}
                        disabled={togglingNotify === item.billId}
                        title={item.notifyEnabled ? 'Notifications on — click to turn off' : 'Click to get email alerts for this bill'}
                        style={{ fontSize: '0.9rem', background: item.notifyEnabled ? 'var(--navy-light)' : 'transparent', border: `1px solid ${item.notifyEnabled ? 'var(--navy)' : 'var(--border-default)'}`, borderRadius: 'var(--radius-sm)', padding: '3px 8px', cursor: 'pointer', color: item.notifyEnabled ? 'var(--navy)' : 'var(--text-muted)', lineHeight: 1 }}
                      >
                        🔔
                      </button>
                      {bill?.term && (
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                          Term {bill.term}{bill.session ? ` · Session ${bill.session}` : ''}
                        </div>
                      )}
                      {bill?.latestProgressDate && (
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{bill.latestProgressDate}</div>
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
        <div style={{ position: 'fixed', bottom: 'var(--statusbar-height)', left: 0, right: 0, background: 'var(--bg-elevated)', borderTop: '1px solid var(--border-default)', padding: '12px 24px', display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap', zIndex: 100, boxShadow: '0 -2px 12px rgba(0,0,0,0.08)' }}>
          <span style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', fontWeight: 500 }}>
            {selectedBills.size === 0 ? 'Select bills to include in report' : `${selectedBills.size} bill${selectedBills.size !== 1 ? 's' : ''} selected`}
          </span>
          <div style={{ flex: 1 }} />
          {generateError && <span style={{ fontSize: '0.8rem', color: '#b91c1c' }}>{generateError}</span>}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 500 }}>Format:</label>
            <select style={selectStyle} value={reportFormat} onChange={e => setReportFormat(e.target.value)}>
              <option value="docx">Word (.docx)</option>
              <option value="xlsx">Excel (.xlsx)</option>
            </select>
          </div>
          <button
            onClick={handleGenerateReport}
            disabled={generating || selectedBills.size === 0}
            style={{ padding: '8px 18px', fontSize: '0.875rem', fontWeight: 600, background: selectedBills.size === 0 ? 'var(--border-default)' : 'var(--navy)', color: selectedBills.size === 0 ? 'var(--text-muted)' : 'white', border: 'none', borderRadius: 'var(--radius-sm)', cursor: selectedBills.size === 0 || generating ? 'not-allowed' : 'pointer' }}
          >
            {generating ? 'Generating…' : '⬇ Generate Report'}
          </button>
        </div>
      )}
    </div>
  );
}

// ─── My Lists tab ─────────────────────────────────────────────────────────────

function ListsTab() {
  const navigate = useNavigate();
  const { isSignedIn } = useAuth();

  const [lists, setLists] = useState([]);
  const [loading, setLoading] = useState(true);

  // Create form
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [isSmart, setIsSmart] = useState(false);
  const [criteria, setCriteria] = useState(emptyCriteria);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState(null);

  useEffect(() => {
    if (!isSignedIn) { setLoading(false); return; }
    fetch('/api/user/lists', { credentials: 'include' })
      .then(r => r.json())
      .then(data => setLists(Array.isArray(data) ? data : []))
      .catch(() => setLists([]))
      .finally(() => setLoading(false));
  }, [isSignedIn]);

  const handleCreate = async (e) => {
    e.preventDefault();
    const name = newName.trim();
    if (!name) return;
    setCreating(true);
    setCreateError(null);

    // Build filterCriteria for smart lists — strip empty values
    let filterCriteria = null;
    if (isSmart) {
      const fc = {};
      if (criteria.term)     fc.term     = criteria.term;
      if (criteria.session)  fc.session  = criteria.session;
      if (criteria.sector)   fc.sector   = criteria.sector;
      if (criteria.stance)   fc.stance   = criteria.stance;
      if (criteria.priority) fc.priority = criteria.priority;
      if (criteria.watching) fc.watching = true;
      if (Object.keys(fc).length > 0) filterCriteria = fc;
    }

    try {
      const res = await fetch('/api/user/lists', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ name, description: newDesc.trim() || undefined, filterCriteria }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setLists(prev => [data, ...prev]);
      setNewName(''); setNewDesc(''); setIsSmart(false); setCriteria(emptyCriteria); setShowCreate(false);
    } catch (err) {
      setCreateError(err.message);
    } finally {
      setCreating(false);
    }
  };

  if (loading) return <Loader text="Loading lists" />;

  return (
    <div>
      {/* Subheader row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <span style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
          {lists.length} list{lists.length !== 1 ? 's' : ''}
        </span>
        <button
          onClick={() => setShowCreate(v => !v)}
          style={{ padding: '7px 16px', background: 'var(--navy)', color: 'white', border: 'none', borderRadius: 'var(--radius-sm)', fontSize: '0.825rem', fontWeight: 600, cursor: 'pointer' }}
        >
          {showCreate ? 'Cancel' : '+ New list'}
        </button>
      </div>

      {/* Create form */}
      {showCreate && (
        <form
          onSubmit={handleCreate}
          style={{ border: '1px solid var(--border-default)', borderRadius: 'var(--radius-md)', padding: '16px 20px', marginBottom: '24px', background: 'var(--bg-subtle)' }}
        >
          <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '12px' }}>
            New list
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <input
              autoFocus required
              placeholder="List name (e.g. Q3 Client Watch)"
              value={newName}
              onChange={e => setNewName(e.target.value)}
              style={{ padding: '8px 10px', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-sm)', fontSize: '0.875rem', background: 'var(--bg-elevated)' }}
            />
            <input
              placeholder="Description (optional)"
              value={newDesc}
              onChange={e => setNewDesc(e.target.value)}
              style={{ padding: '8px 10px', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-sm)', fontSize: '0.875rem', background: 'var(--bg-elevated)' }}
            />

            {/* Smart list toggle */}
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.875rem', color: 'var(--text-secondary)', cursor: 'pointer', userSelect: 'none' }}>
              <input type="checkbox" checked={isSmart} onChange={e => setIsSmart(e.target.checked)} />
              <span>Smart list — auto-fill by filter criteria</span>
            </label>

            {isSmart && <CriteriaBuilder value={criteria} onChange={setCriteria} />}

            {createError && <div style={{ fontSize: '0.825rem', color: 'var(--danger)' }}>{createError}</div>}
            <div>
              <button
                type="submit"
                disabled={creating || !newName.trim()}
                style={{ padding: '7px 18px', background: 'var(--navy)', color: 'white', border: 'none', borderRadius: 'var(--radius-sm)', fontSize: '0.825rem', fontWeight: 600, cursor: 'pointer' }}
              >
                {creating ? 'Creating…' : 'Create list'}
              </button>
            </div>
          </div>
        </form>
      )}

      {lists.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-muted)' }}>
          <div style={{ fontSize: '2rem', marginBottom: '12px' }}>📋</div>
          <p style={{ fontSize: '0.9rem' }}>No lists yet.</p>
          <p style={{ fontSize: '0.825rem', marginTop: '6px' }}>Create a manual list, then add bills from any bill detail page. Or create a smart list to auto-fill by filter.</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '16px' }}>
          {lists.map(list => (
            <div
              key={list.id}
              onClick={() => navigate(`/lists/${list.id}`)}
              style={{ border: '1px solid var(--border-default)', borderRadius: 'var(--radius-md)', padding: '18px 20px', cursor: 'pointer', background: 'var(--bg-elevated)', transition: 'border-color 0.15s, box-shadow 0.15s' }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--navy)'; e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.08)'; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-default)'; e.currentTarget.style.boxShadow = 'none'; }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                {list.filterCriteria && (
                  <span style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--teal)', background: 'var(--teal-light)', border: '1px solid var(--teal)', borderRadius: '999px', padding: '0px 6px', letterSpacing: '0.04em' }}>
                    SMART
                  </span>
                )}
                <div style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--navy)' }}>{list.name}</div>
              </div>
              {list.description && (
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '10px', lineHeight: 1.4 }}>
                  {list.description}
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '12px' }}>
                <span style={{ fontSize: '0.775rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                  {list.filterCriteria ? 'Auto-populated' : `${list._count.items} bill${list._count.items !== 1 ? 's' : ''}`}
                </span>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{fmtDate(list.updatedAt)}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Combined My Bills page ───────────────────────────────────────────────────

function Watchlist() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { isSignedIn } = useAuth();
  const { isSubscribed } = useSubscription();

  const tab = searchParams.get('tab') || 'watchlist';
  const setTab = (t) => {
    if (t === 'watchlist') setSearchParams({});
    else setSearchParams({ tab: t });
  };

  const tabBtnStyle = (active) => ({
    padding: '7px 18px',
    fontSize: '0.875rem',
    fontWeight: active ? 700 : 500,
    border: 'none',
    borderBottom: active ? '2px solid var(--navy)' : '2px solid transparent',
    background: 'transparent',
    color: active ? 'var(--navy)' : 'var(--text-muted)',
    cursor: 'pointer',
    transition: 'color 0.15s, border-color 0.15s',
  });

  if (!isSignedIn) {
    return (
      <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-muted)' }}>
        <p style={{ marginBottom: '16px' }}>Sign in to view your watchlist and lists.</p>
        <button onClick={() => navigate('/sign-in')} style={{ padding: '8px 20px', background: 'var(--navy)', color: 'white', border: 'none', borderRadius: 'var(--radius-sm)', cursor: 'pointer', fontWeight: 500 }}>
          Sign in
        </button>
      </div>
    );
  }

  if (!isSubscribed) {
    return (
      <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-muted)' }}>
        <div style={{ fontSize: '2rem', marginBottom: '12px' }}>👁</div>
        <p style={{ fontSize: '0.9rem', marginBottom: '6px' }}>Watchlists and Bill Lists are Pro features.</p>
        <p style={{ fontSize: '0.825rem', marginBottom: '20px' }}>Track bills, set stance, priority, and notes with a Pro subscription.</p>
        <button onClick={() => navigate('/upgrade')} style={{ padding: '8px 20px', background: 'var(--navy)', color: 'white', border: 'none', borderRadius: 'var(--radius-sm)', cursor: 'pointer', fontWeight: 500 }}>
          Upgrade to Pro →
        </button>
      </div>
    );
  }

  return (
    <div>
      {/* Page header */}
      <div style={{ marginBottom: '0', paddingBottom: '0', borderBottom: '1px solid var(--border-subtle)' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 700, margin: '0 0 12px 0' }}>My Bills</h1>

        {/* Tab bar */}
        <div style={{ display: 'flex', gap: '0', marginBottom: '-1px' }}>
          <button style={tabBtnStyle(tab === 'watchlist')} onClick={() => setTab('watchlist')}>
            Watchlist
          </button>
          <button style={tabBtnStyle(tab === 'lists')} onClick={() => setTab('lists')}>
            My Lists
          </button>
        </div>
      </div>

      <div style={{ paddingTop: '20px' }}>
        {tab === 'watchlist' && <WatchlistTab />}
        {tab === 'lists'     && <ListsTab />}
      </div>
    </div>
  );
}

export default Watchlist;
