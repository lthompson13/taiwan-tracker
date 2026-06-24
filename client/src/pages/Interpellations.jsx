import { useState, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import Panel from '../components/Panel';
import DataTable from '../components/DataTable';
import Loader from '../components/Loader';
import Pagination from '../components/Pagination';

const LIMIT = 20;

const expandedStyle = {
  padding: '16px',
  background: 'var(--bg-subtle)',
  color: 'var(--text-primary)',
  fontSize: '0.9rem',
  lineHeight: 1.6,
};

const expandedLabelStyle = {
  color: 'var(--text-muted)',
  fontSize: '0.75rem',
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
  fontWeight: 600,
  marginBottom: '10px',
  display: 'block',
};

function Interpellations() {
  const location = useLocation();
  const expandedRef = useRef(null);
  const [interpellations, setInterpellations] = useState([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expandedId, setExpandedId] = useState(null);

  useEffect(() => {
    const fetchInterpellations = async () => {
      try {
        setLoading(true);
        setError(null);
        const params = new URLSearchParams({ page: page.toString(), limit: LIMIT.toString() });
        const res = await fetch(`/api/interpellations?${params}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();

        setInterpellations(data.interpellations || []);
        setTotalPages(data.totalPages || 1);
        setTotal(data.total || 0);
      } catch (err) {
        setError('Failed to load interpellations: ' + err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchInterpellations();
  }, [page]);

  // Deep-link support: auto-expand a row when the URL hash names its ID.
  useEffect(() => {
    if (loading || !location.hash) return;
    const targetId = decodeURIComponent(location.hash.slice(1));
    if (!targetId) return;
    const match = interpellations.find(
      (i) => (i.interpellationId || i.subject) === targetId
    );
    if (match) {
      setExpandedId(targetId);
      setTimeout(() => {
        if (expandedRef.current) {
          expandedRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 50);
    }
  }, [loading, interpellations, location.hash]);

  const getRowId = (row) => row.interpellationId || row.subject;

  const columns = [
    {
      key: 'subject',
      label: 'Subject',
      render: (val) => (
        <span style={{ color: 'var(--text-primary)' }}>
          {val ? (val.length > 100 ? val.slice(0, 100) + '…' : val) : '—'}
        </span>
      ),
    },
    {
      key: 'legislators',
      label: 'Legislators',
      render: (val) => {
        const names = Array.isArray(val) ? val.join(', ') : (val || '—');
        return (
          <span style={{ color: 'var(--text-secondary)', fontSize: '0.825rem' }}>
            {names.length > 40 ? names.slice(0, 40) + '…' : names}
          </span>
        );
      },
    },
    {
      key: 'meetingDescription',
      label: 'Meeting',
      render: (val) => (
        <span style={{ color: 'var(--text-muted)', fontSize: '0.825rem' }}>
          {val ? (val.length > 40 ? val.slice(0, 40) + '…' : val) : '—'}
        </span>
      ),
    },
    {
      key: 'publishDate',
      label: 'Publish date',
      render: (val) => (
        <span style={{ color: 'var(--text-secondary)', fontSize: '0.825rem', whiteSpace: 'nowrap' }}>
          {val || '—'}
        </span>
      ),
    },
  ];

  const handleRowClick = (row) => {
    const rowId = getRowId(row);
    setExpandedId((prev) => (prev === rowId ? null : rowId));
  };

  const renderExpandedContent = (item) => (
    <div ref={expandedRef} style={expandedStyle}>
      <span style={expandedLabelStyle}>Full description</span>
      <div style={{ marginBottom: '12px' }}>
        <strong>Subject:</strong> {item.subject || '—'}
      </div>
      {item.description && (
        <div style={{ marginBottom: '12px' }}>
          <strong>Description:</strong> {item.description}
        </div>
      )}
      <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap', marginTop: '12px', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
        <span>Term: {item.term || '—'}</span>
        <span>Session: {item.session || '—'}</span>
        <span>Meeting #: {item.meetingNumber || '—'}</span>
        <span>Legislators: {Array.isArray(item.legislators) ? item.legislators.join(', ') : (item.legislators || '—')}</span>
      </div>
    </div>
  );

  return (
    <div>
      <div style={{ marginBottom: '20px', paddingBottom: '12px', borderBottom: '1px solid var(--border-subtle)' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 700, margin: 0 }}>Interpellations</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', margin: '4px 0 0 0' }}>
          {total.toLocaleString()} records &bull; Click a row to expand
        </p>
      </div>

      {error && (
        <div style={{ padding: '12px 14px', background: 'var(--danger-bg)', color: 'var(--danger)', borderRadius: 'var(--radius-md)', fontSize: '0.875rem', marginBottom: '16px' }}>
          {error}
        </div>
      )}

      {loading ? (
        <Loader text="Loading interpellations" />
      ) : (
        <Panel title="Interpellation log">
          {interpellations.length === 0 ? (
            <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)' }}>No data available.</div>
          ) : (
            <DataTable
              columns={columns}
              data={interpellations}
              onRowClick={handleRowClick}
              expandedRowId={expandedId}
              getRowId={getRowId}
              renderExpandedContent={renderExpandedContent}
            />
          )}
        </Panel>
      )}

      {!loading && totalPages > 1 && (
        <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
      )}
    </div>
  );
}

export default Interpellations;
