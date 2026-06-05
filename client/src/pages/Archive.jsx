import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import Panel from '../components/Panel';
import StatusBadge from '../components/StatusBadge';
import Loader from '../components/Loader';
import Pagination from '../components/Pagination';

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

const TERM_OPTIONS = [
  { value: '',   label: 'All terms' },
  { value: '11', label: 'Term 11 (2024–present)' },
  { value: '10', label: 'Term 10 (2020–2024)' },
  { value: '9',  label: 'Term 9 (2016–2020)' },
  { value: '8',  label: 'Term 8 (2012–2016)' },
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

const selectStyle = {
  padding: '6px 10px',
  border: '1px solid var(--border-default)',
  borderRadius: 'var(--radius-sm)',
  fontSize: '0.825rem',
  color: 'var(--text-primary)',
  background: 'var(--bg-elevated)',
  cursor: 'pointer',
};

function Archive() {
  const navigate = useNavigate();

  const [query, setQuery] = useState('');
  const [committedQuery, setCommittedQuery] = useState('');
  const [sectorFilter, setSectorFilter] = useState('');
  const [termFilter, setTermFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);

  const [bills, setBills] = useState([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [totalInArchive, setTotalInArchive] = useState(null);
  const [lastSyncedAt, setLastSyncedAt] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [hasSearched, setHasSearched] = useState(false);

  const search = useCallback(async () => {
    setLoading(true);
    setError(null);
    setHasSearched(true);

    try {
      const params = new URLSearchParams({ page: String(page) });
      if (committedQuery) params.set('q', committedQuery);
      if (sectorFilter) params.set('sector', sectorFilter);
      if (termFilter) params.set('term', termFilter);
      if (statusFilter) params.set('status', statusFilter);

      const res = await fetch(`/api/archive?${params}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();

      setBills(data.bills || []);
      setTotal(data.total || 0);
      setTotalPages(data.totalPages || 0);
      setTotalInArchive(data.totalInArchive ?? null);
      setLastSyncedAt(data.lastSyncedAt || null);
    } catch (err) {
      setError('Search failed: ' + err.message);
    } finally {
      setLoading(false);
    }
  }, [page, committedQuery, sectorFilter, termFilter, statusFilter]);

  // Re-run search when filters or page changes
  useEffect(() => {
    if (hasSearched) search();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, sectorFilter, termFilter, statusFilter]);

  const handleSearch = () => {
    setCommittedQuery(query);
    setPage(1);
    setHasSearched(true);
    // Trigger search manually with the new query
    setLoading(true);
    setError(null);
    const params = new URLSearchParams({ page: '1' });
    if (query.trim()) params.set('q', query.trim());
    if (sectorFilter) params.set('sector', sectorFilter);
    if (termFilter) params.set('term', termFilter);
    if (statusFilter) params.set('status', statusFilter);

    fetch(`/api/archive?${params}`)
      .then((res) => { if (!res.ok) throw new Error(`HTTP ${res.status}`); return res.json(); })
      .then((data) => {
        setBills(data.bills || []);
        setTotal(data.total || 0);
        setTotalPages(data.totalPages || 0);
        setTotalInArchive(data.totalInArchive ?? null);
        setLastSyncedAt(data.lastSyncedAt || null);
        setCommittedQuery(query.trim());
      })
      .catch((err) => setError('Search failed: ' + err.message))
      .finally(() => setLoading(false));
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') handleSearch();
  };

  const handleFilterChange = (key, value) => {
    if (key === 'sector') setSectorFilter(value);
    if (key === 'term') setTermFilter(value);
    if (key === 'status') setStatusFilter(value);
    setPage(1);
  };

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: '20px', paddingBottom: '12px', borderBottom: '1px solid var(--border-subtle)' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 700, margin: 0 }}>Legislative Archive</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', margin: '4px 0 0 0' }}>
          {totalInArchive != null
            ? `Full-text search across ${totalInArchive.toLocaleString()} archived bills`
            : 'Full-text search across archived bills from the Legislative Yuan'}
          {lastSyncedAt && (
            <span style={{ marginLeft: '12px', color: 'var(--border-strong)' }}>
              · Last synced {formatSyncDate(lastSyncedAt)}
            </span>
          )}
        </p>
      </div>

      {/* Search bar */}
      <div style={{ marginBottom: '16px' }}>
        <div style={{ display: 'flex', gap: '8px', marginBottom: '10px' }}>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search bill names, proposers… (English or Chinese)"
            style={{
              flex: 1,
              padding: '8px 12px',
              border: '1px solid var(--border-default)',
              borderRadius: 'var(--radius-sm)',
              fontSize: '0.9rem',
              color: 'var(--text-primary)',
              background: 'var(--bg-elevated)',
            }}
            autoComplete="off"
          />
          <button
            onClick={handleSearch}
            style={{
              padding: '8px 20px',
              background: 'var(--navy)',
              color: 'white',
              border: 'none',
              borderRadius: 'var(--radius-sm)',
              fontSize: '0.875rem',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Search
          </button>
        </div>

        {/* Filters */}
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 500 }}>Sector:</label>
            <select style={selectStyle} value={sectorFilter} onChange={(e) => handleFilterChange('sector', e.target.value)}>
              {SECTOR_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 500 }}>Term:</label>
            <select style={selectStyle} value={termFilter} onChange={(e) => handleFilterChange('term', e.target.value)}>
              {TERM_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 500 }}>Status:</label>
            <select style={selectStyle} value={statusFilter} onChange={(e) => handleFilterChange('status', e.target.value)}>
              {STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div style={{ padding: '12px 14px', background: 'var(--danger-bg)', color: 'var(--danger)', borderRadius: 'var(--radius-md)', fontSize: '0.875rem', marginBottom: '16px' }}>
          {error}
        </div>
      )}

      {/* Empty state before first search */}
      {!hasSearched && !loading && (
        <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-muted)' }}>
          <div style={{ fontSize: '2rem', marginBottom: '12px' }}>🗂</div>
          <p style={{ fontSize: '0.9rem' }}>Enter a search term or select a filter to search the archive.</p>
          {totalInArchive === 0 && (
            <p style={{ fontSize: '0.825rem', marginTop: '8px', color: 'var(--border-strong)' }}>
              The archive is empty. Trigger a sync from the admin panel to populate it.
            </p>
          )}
        </div>
      )}

      {/* Loading */}
      {loading && <Loader text="Searching archive" />}

      {/* Results */}
      {!loading && hasSearched && (
        <>
          {bills.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
              No bills found matching your search.
            </div>
          ) : (
            <>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '12px' }}>
                {total.toLocaleString()} result{total !== 1 ? 's' : ''}
                {committedQuery && <span> for "<strong>{committedQuery}</strong>"</span>}
              </div>
              <Panel>
                {bills.map((bill, idx) => (
                  <div
                    key={bill.billId}
                    onClick={() => navigate(`/bills/${encodeURIComponent(bill.billId)}`)}
                    style={{
                      padding: '14px 0',
                      borderBottom: idx < bills.length - 1 ? '1px solid var(--border-subtle)' : 'none',
                      cursor: 'pointer',
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
        </>
      )}
    </div>
  );
}

export default Archive;
