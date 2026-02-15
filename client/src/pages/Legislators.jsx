import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Panel from '../components/Panel';
import DataTable from '../components/DataTable';
import StatusBadge from '../components/StatusBadge';
import SearchBar from '../components/SearchBar';
import Loader from '../components/Loader';
import Pagination from '../components/Pagination';

const PARTY_OPTIONS = [
  { value: '', label: 'ALL PARTIES' },
  { value: 'Democratic Progressive Party', label: 'Democratic Progressive Party' },
  { value: 'Kuomintang (KMT)', label: 'Kuomintang (KMT)' },
  { value: 'Taiwan People\'s Party', label: 'Taiwan People\'s Party' },
  { value: 'New Power Party', label: 'New Power Party' },
  { value: 'Independent', label: 'Independent' },
];

function getPartyBadgeType(party) {
  if (!party) return 'default';
  if (party.includes('Democratic Progressive')) return 'success';
  if (party.includes('Kuomintang')) return 'info';
  if (party.includes('People\'s Party')) return 'warning';
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
        const res = await fetch(`/api/legislators?${params}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();

        setLegislators(data.legislators || []);
        setTotalPages(data.totalPages || 1);
        setTotal(data.total || 0);
      } catch (err) {
        setError('FAILED TO RETRIEVE LEGISLATOR RECORDS: ' + err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchLegislators();
  }, [page]);

  const handleFilterChange = (key, value) => {
    if (key === 'party') {
      setPartyFilter(value);
      setPage(1);
    }
  };

  // Client-side filtering
  const filteredLegislators = legislators.filter((leg) => {
    const matchesSearch = !search ||
      (leg.name && leg.name.toLowerCase().includes(search.toLowerCase())) ||
      (leg.nameEn && leg.nameEn.toLowerCase().includes(search.toLowerCase()));
    const matchesParty = !partyFilter || leg.party === partyFilter;
    return matchesSearch && matchesParty;
  });

  const columns = [
    {
      key: 'name',
      label: 'Name',
      render: (val, row) => (
        <div>
          <div style={{ color: '#00ff41', fontWeight: 600 }}>{row.name}</div>
          {row.nameEn && (
            <div style={{ color: '#555', fontSize: '0.7rem', marginTop: '2px' }}>{row.nameEn}</div>
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
        <span style={{ color: '#c0c0c0', fontSize: '0.75rem' }}>
          {val || '—'}
        </span>
      ),
    },
    {
      key: 'term',
      label: 'Term',
      render: (val) => (
        <span style={{ color: '#ffb000' }}>{val || '—'}</span>
      ),
    },
  ];

  const handleRowClick = (row) => {
    if (row.name) {
      navigate(`/legislators/${encodeURIComponent(row.name)}`);
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
          /// LEGISLATOR DIRECTORY
        </h1>
        <p style={{
          color: '#555',
          fontSize: '0.7rem',
          fontFamily: 'monospace',
          margin: '4px 0 0 0',
          letterSpacing: '0.08em',
        }}>
          {total} RECORDS IN DATABASE
        </p>
      </div>

      <SearchBar
        value={search}
        onChange={(val) => { setSearch(val); }}
        placeholder="SEARCH LEGISLATOR NAME..."
        onSearch={() => {}}
        filters={[
          {
            key: 'party',
            label: 'PARTY FILTER',
            value: partyFilter,
            options: PARTY_OPTIONS,
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
        <Loader text="RETRIEVING PERSONNEL FILES" />
      ) : (
        <Panel title="PERSONNEL RECORDS">
          <DataTable
            columns={columns}
            data={filteredLegislators}
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

export default Legislators;
