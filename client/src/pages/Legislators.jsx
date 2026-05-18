import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Panel from '../components/Panel';
import DataTable from '../components/DataTable';
import StatusBadge from '../components/StatusBadge';
import SearchBar from '../components/SearchBar';
import Loader from '../components/Loader';
import Pagination from '../components/Pagination';

const PARTY_OPTIONS = [
  { value: '', label: 'All parties' },
  { value: 'Democratic Progressive Party', label: 'Democratic Progressive Party' },
  { value: 'Kuomintang (KMT)', label: 'Kuomintang (KMT)' },
  { value: "Taiwan People's Party", label: "Taiwan People's Party" },
  { value: 'New Power Party', label: 'New Power Party' },
  { value: 'Independent', label: 'Independent' },
];

function getPartyBadgeType(party) {
  if (!party) return 'default';
  if (party.includes('Democratic Progressive')) return 'success';
  if (party.includes('Kuomintang')) return 'info';
  if (party.includes("People's Party")) return 'warning';
  if (party.includes('New Power')) return 'danger';
  return 'default';
}

const LIMIT = 20;

function Legislators() {
  const navigate = useNavigate();
  const [legislators, setLegislators] = useState([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [partyFilter, setPartyFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchLegislators = async () => {
      try {
        setLoading(true);
        setError(null);
        const params = new URLSearchParams({ page: page.toString(), limit: LIMIT.toString() });
        if (partyFilter) params.set('party', partyFilter);

        const res = await fetch(`/api/legislators?${params}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();

        setLegislators(data.legislators || []);
        setTotalPages(data.totalPages || 1);
        setTotal(data.total || 0);
      } catch (err) {
        setError('Failed to load legislators: ' + err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchLegislators();
  }, [page, partyFilter]);

  const handleFilterChange = (key, value) => {
    if (key === 'party') {
      setPartyFilter(value);
      setPage(1);
    }
  };

  const filteredLegislators = legislators.filter((leg) => {
    const matchesSearch = !search ||
      (leg.name && leg.name.toLowerCase().includes(search.toLowerCase())) ||
      (leg.nameEn && leg.nameEn.toLowerCase().includes(search.toLowerCase()));
    return matchesSearch;
  });

  const columns = [
    {
      key: 'name',
      label: 'Name',
      render: (val, row) => (
        <div>
          <div style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{row.name}</div>
          {row.nameEn && (
            <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginTop: '2px' }}>
              {row.nameEn}
            </div>
          )}
        </div>
      ),
    },
    {
      key: 'party',
      label: 'Party',
      render: (val) => <StatusBadge label={val || '—'} type={getPartyBadgeType(val)} />,
    },
    {
      key: 'district',
      label: 'District',
      render: (val) => (
        <span style={{ color: 'var(--text-secondary)', fontSize: '0.825rem' }}>{val || '—'}</span>
      ),
    },
    {
      key: 'term',
      label: 'Term',
      render: (val) => (
        <span style={{ color: 'var(--text-secondary)' }}>{val || '—'}</span>
      ),
    },
  ];

  const handleRowClick = (row) => {
    if (row.name) navigate(`/legislators/${encodeURIComponent(row.name)}`);
  };

  return (
    <div>
      <div style={{ marginBottom: '20px', paddingBottom: '12px', borderBottom: '1px solid var(--border-subtle)' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 700, margin: 0 }}>Legislators</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', margin: '4px 0 0 0' }}>
          {total.toLocaleString()} legislators
        </p>
      </div>

      <SearchBar
        value={search}
        onChange={(val) => { setSearch(val); }}
        placeholder="Search legislator name…"
        onSearch={() => {}}
        filters={[
          { key: 'party', label: 'Party', value: partyFilter, options: PARTY_OPTIONS },
        ]}
        onFilterChange={handleFilterChange}
      />

      {error && (
        <div style={{ padding: '12px 14px', background: 'var(--danger-bg)', color: 'var(--danger)', borderRadius: 'var(--radius-md)', fontSize: '0.875rem', marginBottom: '16px' }}>
          {error}
        </div>
      )}

      {loading ? (
        <Loader text="Loading legislators" />
      ) : (
        <Panel title="Legislators">
          <DataTable columns={columns} data={filteredLegislators} onRowClick={handleRowClick} />
        </Panel>
      )}

      {!loading && totalPages > 1 && (
        <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
      )}
    </div>
  );
}

export default Legislators;
