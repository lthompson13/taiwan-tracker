import { useState, useEffect } from 'react';
import Panel from '../components/Panel';
import DataTable from '../components/DataTable';
import StatusBadge from '../components/StatusBadge';
import Loader from '../components/Loader';

const expandedStyle = {
  padding: '16px',
  margin: '0 0 16px 0',
  background: 'var(--bg-subtle)',
  border: '1px solid var(--border-subtle)',
  borderTop: 'none',
  borderRadius: '0 0 var(--radius-md) var(--radius-md)',
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
        setError('Failed to load committees: ' + err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchCommittees();
  }, []);

  const columns = [
    {
      key: 'name',
      label: 'Committee',
      render: (val) => (
        <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>
          {val || '—'}
        </span>
      ),
    },
    {
      key: 'category',
      label: 'Category',
      render: (val) => <StatusBadge label={val || '—'} type="info" />,
    },
    {
      key: 'responsibilities',
      label: 'Responsibilities',
      render: (val) => (
        <span style={{ color: 'var(--text-secondary)', fontSize: '0.825rem' }}>
          {val ? (val.length > 100 ? val.slice(0, 100) + '…' : val) : '—'}
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
      <div style={{ marginBottom: '20px', paddingBottom: '12px', borderBottom: '1px solid var(--border-subtle)' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 700, margin: 0 }}>Committees</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', margin: '4px 0 0 0' }}>
          Legislative Yuan standing committees • Click a row to expand
        </p>
      </div>

      {error && (
        <div style={{ padding: '12px 14px', background: 'var(--danger-bg)', color: 'var(--danger)', borderRadius: 'var(--radius-md)', fontSize: '0.875rem', marginBottom: '16px' }}>
          {error}
        </div>
      )}

      {loading ? (
        <Loader text="Loading committees" />
      ) : (
        <Panel title="Committees">
          {committees.length === 0 ? (
            <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)' }}>No data available.</div>
          ) : (
            <div>
              <DataTable columns={columns} data={committees} onRowClick={handleRowClick} />
              {expandedId && committees.map((item) => {
                const itemId = item.id || item.name;
                if (itemId !== expandedId) return null;
                return (
                  <div key={itemId} style={expandedStyle}>
                    <span style={expandedLabelStyle}>Committee details</span>
                    <div style={{ marginBottom: '12px' }}>
                      <strong>Name:</strong> {item.name || '—'}
                    </div>
                    {item.category && (
                      <div style={{ marginBottom: '12px' }}>
                        <strong>Category:</strong> {item.category}
                        {item.categoryId && (
                          <span style={{ color: 'var(--text-muted)', marginLeft: '8px' }}>(ID: {item.categoryId})</span>
                        )}
                      </div>
                    )}
                    {item.responsibilities && (
                      <div style={{ marginBottom: '12px' }}>
                        <strong>Responsibilities:</strong>
                        <div style={{ marginTop: '8px', paddingLeft: '12px', borderLeft: '3px solid var(--border-default)' }}>
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
