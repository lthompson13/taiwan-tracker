import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Panel from '../components/Panel';
import DataTable from '../components/DataTable';
import StatusBadge from '../components/StatusBadge';
import SearchBar from '../components/SearchBar';
import Loader from '../components/Loader';
import Pagination from '../components/Pagination';

// Status options reflect the actual taxonomy used by the LY API (verified
// via server/scripts/discover-statuses.js). Each value must match a key
// in BILL_STATUS_MAP in server/lib/filterMaps.js.
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

const CATEGORY_OPTIONS = [
  { value: '', label: 'All categories' },
  { value: 'Legislation', label: 'Legislation' },
  { value: 'Budget', label: 'Budget' },
  { value: 'Resolution', label: 'Resolution' },
  { value: 'Other', label: 'Other' },
];

function getStatusBadgeType(status) {
  if (!status) return 'default';
  if (status === 'Third Reading (Passed)') return 'success';
  if (status === 'Scheduled for Plenary' || status === 'Scheduled for Plenary (Discussion)') return 'warning';
  if (status === 'Review Complete' || status === 'Review Complete (Overdue)') return 'info';
  return 'default';
}

const LIMIT = 20;

function Bills() {
  const navigate = useNavigate();
  const [bills, setBills] = useState([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchBills = async () => {
      try {
        setLoading(true);
        setError(null);

        const params = new URLSearchParams({
          page: page.toString(),
          limit: LIMIT.toString(),
        });
        if (categoryFilter) params.set('category', categoryFilter);
        if (statusFilter) params.set('status', statusFilter);

        const res = await fetch(`/api/bills?${params}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();

        setBills(data.bills || []);
        setTotalPages(data.totalPages || 1);
        setTotal(data.total || 0);
      } catch (err) {
        setError('Failed to load bills: ' + err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchBills();
  }, [page, categoryFilter, statusFilter]);

  const handleFilterChange = (key, value) => {
    if (key === 'category') setCategoryFilter(value);
    if (key === 'status') setStatusFilter(value);
    setPage(1);
  };

  // Search remains client-side; server-side filters: category, status.
  const filteredBills = bills.filter((bill) => {
    const matchesSearch = !search ||
      (bill.billName && bill.billName.toLowerCase().includes(search.toLowerCase())) ||
      (bill.proposer && bill.proposer.toLowerCase().includes(search.toLowerCase()));
    return matchesSearch;
  });

  const columns = [
    {
      key: 'billName',
      label: 'Bill name',
      render: (val) => (
        <span style={{ color: 'var(--text-primary)' }}>
          {val ? (val.length > 80 ? val.slice(0, 80) + '…' : val) : '—'}
        </span>
      ),
    },
    {
      key: 'category',
      label: 'Category',
      render: (val) => <StatusBadge label={val || '—'} type="info" />,
    },
    {
      key: 'status',
      label: 'Status',
      render: (val) => <StatusBadge label={val || '—'} type={getStatusBadgeType(val)} />,
    },
    {
      key: 'proposer',
      label: 'Proposer',
      render: (val) => (
        <span style={{ color: 'var(--text-secondary)', fontSize: '0.825rem' }}>
          {val ? (val.length > 40 ? val.slice(0, 40) + '…' : val) : '—'}
        </span>
      ),
    },
    {
      key: 'latestProgressDate',
      label: 'Latest date',
      render: (val) => (
        <span style={{ color: 'var(--text-secondary)', whiteSpace: 'nowrap', fontSize: '0.825rem' }}>
          {val || '—'}
        </span>
      ),
    },
  ];

  const handleRowClick = (row) => {
    if (row.billId) navigate(`/bills/${encodeURIComponent(row.billId)}`);
  };

  return (
    <div>
      <div style={{ marginBottom: '20px', paddingBottom: '12px', borderBottom: '1px solid var(--border-subtle)' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 700, margin: 0 }}>Bills</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', margin: '4px 0 0 0' }}>
          {total.toLocaleString()} bills tracked
        </p>
      </div>

      <SearchBar
        value={search}
        onChange={(val) => { setSearch(val); }}
        placeholder="Search bill name or proposer…"
        onSearch={() => {}}
        filters={[
          { key: 'category', label: 'Category', value: categoryFilter, options: CATEGORY_OPTIONS },
          { key: 'status',   label: 'Status',   value: statusFilter,   options: STATUS_OPTIONS   },
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
      ) : (
        <Panel title="Bills">
          <DataTable columns={columns} data={filteredBills} onRowClick={handleRowClick} />
        </Panel>
      )}

      {!loading && totalPages > 1 && (
        <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
      )}
    </div>
  );
}

export default Bills;
