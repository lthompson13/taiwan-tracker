import { useState, useEffect } from 'react';
import Panel from '../components/Panel';
import DataTable from '../components/DataTable';
import Loader from '../components/Loader';
import Pagination from '../components/Pagination';

const LIMIT = 20;

const expandedStyle = {
  padding: '16px',
  margin: '0 0 16px 0',
  background: '#0d0d0d',
  border: '1px solid #1a3a1a',
  borderTop: 'none',
  color: '#c0c0c0',
  fontSize: '0.8rem',
  fontFamily: 'monospace',
  lineHeight: 1.6,
};

const expandedLabelStyle = {
  color: '#00ff41',
  fontSize: '0.7rem',
  letterSpacing: '0.1em',
  textTransform: 'uppercase',
  marginBottom: '8px',
  display: 'block',
};

function Interpellations() {
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
        setError('FAILED TO RETRIEVE INTERPELLATION RECORDS: ' + err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchInterpellations();
  }, [page]);

  const columns = [
    {
      key: 'subject',
      label: 'Subject',
      render: (val) => (
        <span style={{ color: '#c0c0c0', fontSize: '0.78rem' }}>
          {val ? (val.length > 80 ? val.slice(0, 80) + '...' : val) : '—'}
        </span>
      ),
    },
    {
      key: 'legislators',
      label: 'Legislators',
      render: (val) => {
        const names = Array.isArray(val) ? val.join(', ') : (val || '—');
        return (
          <span style={{ color: '#00d4ff', fontSize: '0.75rem' }}>
            {names.length > 40 ? names.slice(0, 40) + '...' : names}
          </span>
        );
      },
    },
    {
      key: 'meetingDescription',
      label: 'Meeting',
      render: (val) => (
        <span style={{ color: '#888', fontSize: '0.75rem' }}>
          {val ? (val.length > 40 ? val.slice(0, 40) + '...' : val) : '—'}
        </span>
      ),
    },
    {
      key: 'publishDate',
      label: 'Publish Date',
      render: (val) => (
        <span style={{ color: '#ffb000', fontSize: '0.75rem', whiteSpace: 'nowrap' }}>
          {val || '—'}
        </span>
      ),
    },
  ];

  const handleRowClick = (row) => {
    const rowId = row.interpellationId || row.subject;
    setExpandedId((prev) => (prev === rowId ? null : rowId));
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
          /// INTERPELLATION RECORDS
        </h1>
        <p style={{
          color: '#555',
          fontSize: '0.7rem',
          fontFamily: 'monospace',
          margin: '4px 0 0 0',
          letterSpacing: '0.08em',
        }}>
          {total} RECORDS IN DATABASE — CLICK ROW TO EXPAND
        </p>
      </div>

      {error && (
        <div style={{ padding: '16px', color: '#ff0040', fontFamily: 'monospace', fontSize: '0.8rem', marginBottom: '16px' }}>
          <span>[ERROR]</span> {error}
        </div>
      )}

      {loading ? (
        <Loader text="DECODING INTERPELLATION DATA" />
      ) : (
        <Panel title="INTERPELLATION LOG">
          {interpellations.length === 0 ? (
            <div style={{ padding: '24px', textAlign: 'center', color: '#555', fontFamily: 'monospace' }}>
              NO DATA AVAILABLE
            </div>
          ) : (
            <div>
              <DataTable
                columns={columns}
                data={interpellations}
                onRowClick={handleRowClick}
              />
              {/* Expanded detail panel */}
              {expandedId && interpellations.map((item) => {
                const itemId = item.interpellationId || item.subject;
                if (itemId !== expandedId) return null;
                return (
                  <div key={itemId} style={expandedStyle}>
                    <span style={expandedLabelStyle}>/// FULL DESCRIPTION</span>
                    <div style={{ marginBottom: '12px' }}>
                      <strong style={{ color: '#00ff41' }}>SUBJECT:</strong>{' '}
                      <span>{item.subject || '—'}</span>
                    </div>
                    {item.description && (
                      <div style={{ marginBottom: '12px' }}>
                        <strong style={{ color: '#00ff41' }}>DESCRIPTION:</strong>{' '}
                        <span>{item.description}</span>
                      </div>
                    )}
                    <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap', marginTop: '12px', color: '#888', fontSize: '0.75rem' }}>
                      <span>TERM: {item.term || '—'}</span>
                      <span>SESSION: {item.session || '—'}</span>
                      <span>MEETING #: {item.meetingNumber || '—'}</span>
                      <span>LEGISLATORS: {Array.isArray(item.legislators) ? item.legislators.join(', ') : (item.legislators || '—')}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
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

export default Interpellations;
