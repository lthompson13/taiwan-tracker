import { useState, useEffect } from 'react';
import Panel from '../components/Panel';
import DataTable from '../components/DataTable';
import StatusBadge from '../components/StatusBadge';
import Loader from '../components/Loader';

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

function Committees() {
  const [committees, setCommittees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expandedId, setExpandedId] = useState(null);

  useEffect(() => {
    const fetchCommittees = async () => {
      try {
        setLoading(true);
        setError(null);

        const res = await fetch('/api/committees?page=1&limit=100');
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();

        setCommittees(data.committees || []);
      } catch (err) {
        setError('FAILED TO RETRIEVE COMMITTEE DATA: ' + err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchCommittees();
  }, []);

  const columns = [
    {
      key: 'name',
      label: 'Committee Name',
      render: (val) => (
        <span style={{ color: '#00ff41', fontWeight: 600, fontSize: '0.8rem' }}>
          {val || '—'}
        </span>
      ),
    },
    {
      key: 'category',
      label: 'Category',
      render: (val) => (
        <StatusBadge label={val || '—'} type="info" />
      ),
    },
    {
      key: 'responsibilities',
      label: 'Responsibilities',
      render: (val) => (
        <span style={{ color: '#888', fontSize: '0.75rem' }}>
          {val ? (val.length > 100 ? val.slice(0, 100) + '...' : val) : '—'}
        </span>
      ),
    },
  ];

  const handleRowClick = (row) => {
    const rowId = row.id || row.name;
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
          /// COMMITTEE REGISTRY
        </h1>
        <p style={{
          color: '#555',
          fontSize: '0.7rem',
          fontFamily: 'monospace',
          margin: '4px 0 0 0',
          letterSpacing: '0.08em',
        }}>
          LEGISLATIVE YUAN STANDING COMMITTEES — CLICK ROW TO EXPAND
        </p>
      </div>

      {error && (
        <div style={{ padding: '16px', color: '#ff0040', fontFamily: 'monospace', fontSize: '0.8rem', marginBottom: '16px' }}>
          <span>[ERROR]</span> {error}
        </div>
      )}

      {loading ? (
        <Loader text="LOADING COMMITTEE DATA" />
      ) : (
        <Panel title="REGISTERED COMMITTEES">
          {committees.length === 0 ? (
            <div style={{ padding: '24px', textAlign: 'center', color: '#555', fontFamily: 'monospace' }}>
              NO DATA AVAILABLE
            </div>
          ) : (
            <div>
              <DataTable
                columns={columns}
                data={committees}
                onRowClick={handleRowClick}
              />
              {/* Expanded detail panel */}
              {expandedId && committees.map((item) => {
                const itemId = item.id || item.name;
                if (itemId !== expandedId) return null;
                return (
                  <div key={itemId} style={expandedStyle}>
                    <span style={expandedLabelStyle}>/// FULL COMMITTEE DETAILS</span>
                    <div style={{ marginBottom: '12px' }}>
                      <strong style={{ color: '#00ff41' }}>NAME:</strong>{' '}
                      <span>{item.name || '—'}</span>
                    </div>
                    {item.category && (
                      <div style={{ marginBottom: '12px' }}>
                        <strong style={{ color: '#00ff41' }}>CATEGORY:</strong>{' '}
                        <span>{item.category}</span>
                        {item.categoryId && (
                          <span style={{ color: '#555', marginLeft: '8px' }}>(ID: {item.categoryId})</span>
                        )}
                      </div>
                    )}
                    {item.responsibilities && (
                      <div style={{ marginBottom: '12px' }}>
                        <strong style={{ color: '#00ff41' }}>RESPONSIBILITIES:</strong>
                        <div style={{ marginTop: '8px', paddingLeft: '12px', borderLeft: '2px solid #1a3a1a' }}>
                          {item.responsibilities}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </Panel>
      )}
    </div>
  );
}

export default Committees;
