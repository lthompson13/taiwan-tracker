import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Panel from '../components/Panel';
import Loader from '../components/Loader';
import StatusBadge from '../components/StatusBadge';

const statCardStyle = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'flex-start',
  padding: '4px 0',
};

const statNumberStyle = {
  fontSize: '2.2rem',
  fontWeight: 700,
  color: 'var(--navy)',
  lineHeight: 1.1,
  letterSpacing: '-0.02em',
};

const statLabelStyle = {
  fontSize: '0.75rem',
  color: 'var(--text-muted)',
  marginTop: '6px',
  fontWeight: 500,
};

const recentItemStyle = {
  padding: '14px 0',
  borderBottom: '1px solid var(--border-subtle)',
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'flex-start',
  gap: '16px',
};

const recentTitleStyle = {
  color: 'var(--text-primary)',
  fontSize: '0.9rem',
  flex: 1,
  cursor: 'pointer',
};

const recentDateStyle = {
  color: 'var(--text-muted)',
  fontSize: '0.8rem',
  whiteSpace: 'nowrap',
};

function Dashboard() {
  const navigate = useNavigate();
  const [stats, setStats] = useState({
    legislators: null, bills: null, committees: null, interpellations: null,
  });
  const [recentBills, setRecentBills] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchAll = async () => {
      try {
        setLoading(true);
        setError(null);

        const [legRes, billRes, comRes, intRes, recentRes] = await Promise.all([
          fetch('/api/legislators?page=1&limit=1'),
          fetch('/api/bills?page=1&limit=1'),
          fetch('/api/committees?page=1&limit=1'),
          fetch('/api/interpellations?page=1&limit=1'),
          fetch('/api/bills?page=1&limit=5'),
        ]);

        const [legData, billData, comData, intData, recentData] = await Promise.all([
          legRes.json(), billRes.json(), comRes.json(), intRes.json(), recentRes.json(),
        ]);

        setStats({
          legislators: legData.total ?? 0,
          bills: billData.total ?? 0,
          committees: comData.total ?? 0,
          interpellations: intData.total ?? 0,
        });
        setRecentBills(recentData.bills || []);
      } catch (err) {
        setError('Failed to load dashboard: ' + err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchAll();
  }, []);

  if (loading) return <Loader text="Loading dashboard" />;

  if (error) {
    return (
      <div style={{ padding: '12px 14px', background: 'var(--danger-bg)', color: 'var(--danger)', borderRadius: 'var(--radius-md)', fontSize: '0.875rem' }}>
        {error}
      </div>
    );
  }

  const statItems = [
    { label: 'Legislators', value: stats.legislators },
    { label: 'Bills', value: stats.bills },
    { label: 'Committees', value: stats.committees },
    { label: 'Interpellations', value: stats.interpellations },
  ];

  return (
    <div>
      <div style={{ marginBottom: '24px', paddingBottom: '12px', borderBottom: '1px solid var(--border-subtle)' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 700, margin: 0 }}>Dashboard</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', margin: '4px 0 0 0' }}>
          Overview of Legislative Yuan activity
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '24px' }}>
        {statItems.map((item) => (
          <Panel key={item.label} title={item.label}>
            <div style={statCardStyle}>
              <span style={statNumberStyle}>
                {item.value != null ? item.value.toLocaleString() : '—'}
              </span>
              <span style={statLabelStyle}>Total records</span>
            </div>
          </Panel>
        ))}
      </div>

      <Panel title="Recent bills">
        {recentBills.length === 0 ? (
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>No recent bills.</p>
        ) : (
          <div>
            {recentBills.map((bill, idx) => (
              <div key={bill.billId || idx} style={{
                ...recentItemStyle,
                borderBottom: idx === recentBills.length - 1 ? 'none' : '1px solid var(--border-subtle)',
              }}>
                <div style={{ flex: 1 }}>
                  <div style={recentTitleStyle} onClick={() => navigate(`/bills/${encodeURIComponent(bill.billId)}`)}>
                    {bill.billName ? (bill.billName.length > 100 ? bill.billName.slice(0, 100) + '…' : bill.billName) : 'Untitled bill'}
                  </div>
                  <div style={{ marginTop: '6px', display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
                    {bill.category && <StatusBadge label={bill.category} type="info" />}
                    {bill.status && <StatusBadge label={bill.status} type={bill.status === 'Third Reading (Passed)' ? 'success' : 'default'} />}
                    {Array.isArray(bill.sectors) && bill.sectors.map((s) => (
                      <StatusBadge key={s} label={s} type="sector" />
                    ))}
                    {bill.proposer && (
                      <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                        {bill.proposer.length > 40 ? bill.proposer.slice(0, 40) + '…' : bill.proposer}
                      </span>
                    )}
                  </div>
                </div>
                <span style={recentDateStyle}>{bill.latestProgressDate || '—'}</span>
              </div>
            ))}
          </div>
        )}
      </Panel>
    </div>
  );
}

export default Dashboard;
