import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Panel from '../components/Panel';
import DataTable from '../components/DataTable';
import StatusBadge from '../components/StatusBadge';
import SearchBar from '../components/SearchBar';
import Loader from '../components/Loader';
import Pagination from '../components/Pagination';

const CATEGORY_OPTIONS = [
  { value: '', label: 'ALL CATEGORIES' },
  { value: 'Legislation', label: 'Legislation' },
  { value: 'Budget', label: 'Budget' },
  { value: 'Resolution', label: 'Resolution' },
  { value: 'Other', label: 'Other' },
];

const STATUS_OPTIONS = [
  { value: '', label: 'ALL STATUSES' },
  { value: 'Scheduled for Plenary', label: 'Scheduled for Plenary' },
  { value: 'Review Complete', label: 'Review Complete' },
  { value: 'Third Reading (Passed)', label: 'Third Reading (Passed)' },
  { value: 'Referred for Review', label: 'Referred for Review' },
  { value: 'Not Reviewed', label: 'Not Reviewed' },
  { value: 'Returned', label: 'Returned' },
  { value: 'Withdrawn', label: 'Withdrawn' },
];

function getStatusBadgeType(status) {
  if (!status) return 'default';
  if (status === 'Third Reading (Passed)') return 'success';
  if (status === 'Scheduled for Plenary') return 'warning';
  if (status === 'Review Complete') return 'info';
  if (status === 'Not Reviewed' || status === 'Returned' || status === 'Withdrawn') return 'danger';
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

        const params = new URLSearchParams({ page: page.toString(), limit: LIMIT.toString() });
        const res = await fetch(`/api/bills?${params}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();

        setBills(data.bills || []);
        setTotalPages(data.totalPages || 1);
        setTotal(data.total || 0);
      } catch (err) {
        setError('FAILED TO RETRIEVE BILL RECORDS: ' + err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchBills();
  }, [page]);

  const handleFilterChange = (key, value) => {
    if (key === 'category') setCategoryFilter(value);
    if (key === 'status') setStatusFilter(value);
    setPage(1);
  };

  // Client-side filtering
  const filteredBills = bills.filter((bill) => {
    const matchesSearch = !search ||
      (bill.billName && bill.billName.toLowerCase().includes(search.toLowerCase())) ||
      (bill.proposer && bill.proposer.toLowerCase().includes(search.toLowerCase()));
    const matchesCategory = !categoryFilter || bill.category === categoryFilter;
    const matchesStatus = !statusFilter || bill.status === statusFilter;
    return matchesSearch && matchesCategory && matchesStatus;
  });

  const columns = [
    {
      key: 'billName',
      label: 'Bill Name',
      render: (val) => (
        <span style={{ color: '#c0c0c0', fontSize: '0.78rem' }}>
          {val ? (val.length > 60 ? val.slice(0, 60) + '...' : val) : '—'}
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
        <span style={{ color: '#888', fontSize: '0.75rem' }}>
          {val ? (val.length > 30 ? val.slice(0, 30) + '...' : val) : '—'}
        </span>
      ),
    },
    {
      key: 'latestProgressDate',
      label: 'Date',
      render: (val) => (
        <span style={{ color: '#ffb000', fontSize: '0.75rem', whiteSpace: 'nowrap' }}>
          {val || '—'}
        </span>
      ),
    },
  ];

  const handleRowClick = (row) => {
    if (row.billId) {
      navigate(`/bills/${encodeURIComponent(row.billId)}`);
    }
  };

  return (
    <div>
      <div style={{
        marginBottom: '20px',
        borderBottom: '1px solid #1a3a1a',
        paddingBottom: '12px',
      }}>
        <h1 style={{
          color: '#00ff41',
          fontSize: '1.1rem',
          fontWeight: 600,
          fontFamily: 'monospace',
          letterSpacing: '0.15em',
          margin: 0,
          textTransform: 'uppercase',
        }}>
          /// BILL TRACKER
        </h1>
        <p style={{
          color: '#555',
          fontSize: '0.7rem',
          fontFamily: 'monospace',
          margin: '4px 0 0 0',
          letterSpacing: '0.08em',
        }}>
          {total} BILLS CATALOGUED
        </p>
      </div>

      <SearchBar
        value={search}
        onChange={(val) => { setSearch(val); }}
        placeholder="SEARCH BILL NAME OR PROPOSER..."
        onSearch={() => {}}
        filters={[
          {
            key: 'category',
            label: 'CATEGORY',
            value: categoryFilter,
            options: CATEGORY_OPTIONS,
          },
          {
            key: 'status',
            label: 'STATUS',
            value: statusFilter,
            options: STATUS_OPTIONS,
          },
        ]}
        onFilterChange={handleFilterChange}
      />

      {error && (
        <div style={{ padding: '16px', color: '#ff0040', fontFamily: 'monospace', fontSize: '0.8rem', marginBottom: '16px' }}>
          <span>[ERROR]</span> {error}
        </div>
      )}

      {loading ? (
        <Loader text="SCANNING BILL DATABASE" />
      ) : (
        <Panel title="LEGISLATIVE BILLS">
          <DataTable
            columns={columns}
            data={filteredBills}
            onRowClick={handleRowClick}
          />
        </Panel>
      )}

      {!loading && totalPages > 1 && (
        <Pagination
          page={page}
          totalPages={totalPages}
          onPageChange={setPage}
        />
      )}
    </div>
  );
}

export default Bills;
