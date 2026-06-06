import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Panel from '../components/Panel';
import StatusBadge from '../components/StatusBadge';
import SearchBar from '../components/SearchBar';
import Loader from '../components/Loader';
import Pagination from '../components/Pagination';

// Bills page now queries the local database (via /api/archive) rather than
// the live LY API. This enables full-text search and sector filtering across
// the full dataset, and supports future user annotations, comments, and
// watchlists. The LY API runs as a background sync to keep the database fresh.

const TERM_OPTIONS = [
  { value: '',   label: 'All terms' },
  { value: '11', label: 'Term 11 (2024–present)' },
  { value: '10', label: 'Term 10 (2020–2024)' },
  { value: '9',  label: 'Term 9 (2016–2020)' },
  { value: '8',  label: 'Term 8 (2012–2016)' },
];

const SESSION_OPTIONS = [
  { value: '', label: 'All sessions' },
  { value: '1', label: 'Session 1' },
  { value: '2', label: 'Session 2' },
  { value: '3', label: 'Session 3' },
  { value: '4', label: 'Session 4' },
  { value: '5', label: 'Session 5' },
  { value: '6', label: 'Session 6' },
  { value: '7', label: 'Session 7' },
  { value: '8', label: 'Session 8' },
];

const SECTOR_OPTIONS = [
  { value: '', label: 'All sectors' },
  { value: 'Semiconductors',       label: 'Semiconductors' },
  { value: 'Defense',              label: 'Defense' },
  { value: 'Energy',               label: 'Energy' },
  { value: 'Financial Regulation', label: 'Financial Regulation' },
  { value: 'Healthcare',           label: 'Healthcare' },
  { value: 'Trade',                label: 'Trade' },
  { value: 'Cross-Strait',         label: 'Cross-Strait' },
  { value: 'Foreign Investment',   label: 'Foreign Investment' },
  { value: 'Data & Technology',    label: 'Data & Technology' },
  { value: 'Labor',                label: 'Labor' },
  { value: 'Environment',          label: 'Environment' },
  { value: 'Agriculture',          label: 'Agriculture' },
  { value: 'Transportation',       label: 'Transportation' },
];

const STATUS_OPTIONS = [
  { value: '', label: 'All statuses' },
  { value: 'Scheduled for Plenary', label: 'Scheduled for Plenary' },
  { value: 'Scheduled for Plenary (Discussion)', label: 'Scheduled for Plenary (Discussion)' },
  { value: 'Review Complete', label: 'Review Complete' },
  { value: 'Review Complete (Overdue)', label: 'Review Complete (Overdue)' },
  { value: 'Referred for Review', label: 'Referred for Review' },
  { value: 'Direct to Second Reading', label: 'Direct to Second Reading' },
  { value: 'Third Reading (Passed)', label: 'Third Reading (Passed)' },
  { value: 'Reply for Reference', label: 'Reply for Reference' },
];

function getStatusBadgeType(status) {
  if (!status) return 'default';
  if (status === 'Third Reading (Passed)') return 'success';
  if (status === 'Scheduled for Plenary' || status === 'Scheduled for Plenary (Discussion)') return 'warning';
  if (status === 'Review Complete' || status === 'Review Complete (Overdue)') return 'info';
  return 'default';
}

function formatSyncDate(iso) {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

const LIMIT = 20;

function Bills() {
  const navigate = useNavigate();

  const [search, setSearch] = useState('');
  const [termFilter, setTermFilter] = useState('');
  const [sessionFilter, setSessionFilter] = useState('');
  const [sectorFilter, setSectorFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);

  const [bills, setBills] = useState([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [totalInArchive, setTotalInArchive] = useState(null);
  const [lastSyncedAt, setLastSyncedAt] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchBills = async () => {
      try {
        setLoading(true);
        setError(null);

        const params = new URLSearchParams({ page: String(page), limit: String(LIMIT) });
        if (search.trim()) params.set('q', search.trim());
        if (termFilter) params.set('term', termFilter);
        if (sessionFilter) params.set('session', sessionFilter);
        if (sectorFilter) params.set('sector', sectorFilter);
        if (statusFilter) params.set('status', statusFilter);

        const res = await fetch(`/api/archive?${params}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();

        setBills(data.bills || []);
        setTotal(data.total || 0);
        setTotalPages(data.totalPages || 1);
        setTotalInArchive(data.totalInArchive ?? null);
        setLastSyncedAt(data.lastSyncedAt || null);
      } catch (err) {
        setError('Failed to load bills: ' + err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchBills();
  }, [page, search, termFilter, sessionFilter, sectorFilter, statusFilter]);

  const handleFilterChange = (key, value) => {
    if (key === 'term') { setTermFilter(value); setSessionFilter(''); }
    if (key === 'session') setSessionFilter(value);
    if (key === 'sector') setSectorFilter(value);
    if (key === 'status') setStatusFilter(value);
    setPage(1);
  };

  return (
    <div>
      <div style={{ marginBottom: '20px', paddingBottom: '12px', borderBottom: '1px solid var(--border-subtle)' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 700, margin: 0 }}>Bills</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', margin: '4px 0 0 0' }}>
          {totalInArchive != null
            ? `${totalInArchive.toLocaleString()} bills in database`
            : 'Legislative Yuan bill database'}
          {lastSyncedAt && (
            <span style={{ marginLeft: '10px', color: 'var(--border-strong)' }}>
              · Last synced {formatSyncDate(lastSyncedAt)}
            </span>
          )}
        </p>
      </div>

      <SearchBar
        value={search}
        onChange={(val) => { setSearch(val); setPage(1); }}
        placeholder="Search bill name, number, or proposer…"
        onSearch={() => {}}
        filters={[
          { key: 'term',    label: 'Term',    value: termFilter,    options: TERM_OPTIONS    },
          { key: 'session', label: 'Session', value: sessionFilter, options: SESSION_OPTIONS },
          { key: 'sector',  label: 'Sector',  value: sectorFilter,  options: SECTOR_OPTIONS  },
          { key: 'status',  label: 'Status',  value: statusFilter,  options: STATUS_OPTIONS  },
        ]}
        onFilterChange={handleFilterChange}
      />

      {error && (
        <div style={{ padding: '12px 14px', background: 'var(--danger-bg)', color: 'var(--danger)', borderRadius: 'var(--radius-md)', fontSize: '0.875rem', marginBottom: '16px' }}>
          {error}
        </div>
      )}

      {loading ? (
        <Loader text="Loading bills" />
      ) : bills.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
          No bills found matching your filters.
        </div>
      ) : (
        <>
          {(search || termFilter || sessionFilter || sectorFilter || statusFilter) && (
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '12px' }}>
              {total.toLocaleString()} result{total !== 1 ? 's' : ''}
            </div>
          )}
          <Panel title="Bills">
            {bills.map((bill, idx) => (
              <div
                key={bill.billId}
                onClick={() => navigate(`/bills/${encodeURIComponent(bill.billId)}`)}
                style={{
                  padding: '14px 0',
                  borderBottom: idx < bills.length - 1 ? '1px solid var(--border-subtle)' : 'none',
                  cursor: 'pointer',
                  transition: 'background 0.1s',
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-hover)'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '16px' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '0.9rem', color: 'var(--text-primary)', marginBottom: '6px', lineHeight: 1.4 }}>
                      {bill.billName || bill.billNameZh || 'Untitled'}
                    </div>
                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
                      {bill.status && <StatusBadge label={bill.status} type={getStatusBadgeType(bill.status)} />}
                      {bill.category && <StatusBadge label={bill.category} type="info" />}
                      {Array.isArray(bill.sectors) && bill.sectors.map((s) => (
                        <StatusBadge key={s} label={s} type="sector" />
                      ))}
                      {bill.proposer && (
                        <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                          {bill.proposer.length > 50 ? bill.proposer.slice(0, 50) + '…' : bill.proposer}
                        </span>
                      )}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    {bill.term && (
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '2px' }}>
                        Term {bill.term}{bill.session ? ` · Session ${bill.session}` : ''}
                      </div>
                    )}
                    {bill.latestProgressDate && (
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        {bill.latestProgressDate}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </Panel>

          {totalPages > 1 && (
            <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
          )}
        </>
      )}
    </div>
  );
}

export default Bills;
