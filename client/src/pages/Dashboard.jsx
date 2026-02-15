import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Panel from '../components/Panel';
import Loader from '../components/Loader';
import StatusBadge from '../components/StatusBadge';

const statCardStyle = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '8px 0',
};

const statNumberStyle = {
  fontSize: '2.8rem',
  fontWeight: 700,
  fontFamily: "'IBM Plex Mono', monospace",
  color: '#00ff41',
  lineHeight: 1.1,
  textShadow: '0 0 20px rgba(0,255,65,0.3)',
};

const statLabelStyle = {
  fontSize: '0.7rem',
  color: '#888',
  letterSpacing: '0.1em',
  marginTop: '8px',
  fontFamily: 'monospace',
  textTransform: 'uppercase',
};

const recentItemStyle = {
  padding: '12px 0',
  borderBottom: '1px solid #1a1a1a',
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'flex-start',
  gap: '16px',
};

const recentTitleStyle = {
  color: '#c0c0c0',
  fontSize: '0.8rem',
  fontFamily: 'monospace',
  flex: 1,
  cursor: 'pointer',
};

const recentDateStyle = {
  color: '#555',
  fontSize: '0.7rem',
  fontFamily: 'monospace',
  whiteSpace: 'nowrap',
};

function Dashboard() {
  const navigate = useNavigate();
  const [stats, setStats] = useState({
    legislators: null,
    bills: null,
    committees: null,
    interpellations: null,
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
          legRes.json(),
          billRes.json(),
          comRes.json(),
          intRes.json(),
          recentRes.json(),
        ]);

        setStats({
          legislators: legData.total ?? 0,
          bills: billData.total ?? 0,
          committees: comData.total ?? 0,
          interpellations: intData.total ?? 0,
        });

        setRecentBills(recentData.bills || []);
      } catch (err) {
        setError('FAILED TO ESTABLISH CONNECTION TO LEGISLATIVE DATABASE: ' + err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchAll();
  }, []);

  if (loading) return <Loader text="INITIALIZING DASHBOARD" />;

  if (error) {
    return (
      <div style={{ padding: '24px', color: '#ff0040', fontFamily: 'monospace', fontSize: '0.85rem' }}>
        <span style={{ color: '#ff0040' }}>[ERROR]</span> {error}
      </div>
    );
  }

  const statItems = [
    { label: 'LEGISLATORS', value: stats.legislators, color: '#00ff41' },
    { label: 'ACTIVE BILLS', value: stats.bills, color: '#ffb000' },
    { label: 'COMMITTEES', value: stats.committees, color: '#00d4ff' },
    { label: 'INTERPELLATIONS', value: stats.interpellations, color: '#ff0040' },
  ];

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
          /// SYSTEM OVERVIEW
        </h1>
        <p style={{
          color: '#555',
          fontSize: '0.7rem',
          fontFamily: 'monospace',
          margin: '4px 0 0 0',
          letterSpacing: '0.08em',
        }}>
          LEGISLATIVE YUAN MONITORING DASHBOARD — REAL-TIME INTELLIGENCE FEED
        </p>
      </div>

      {/* Stats Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: '16px',
        marginBottom: '24px',
      }}>
        {statItems.map((item) => (
          <Panel key={item.label} title={item.label}>
            <div style={statCardStyle}>
              <span style={{ ...statNumberStyle, color: item.color, textShadow: `0 0 20px ${item.color}33` }}>
                {item.value != null ? item.value.toLocaleString() : '—'}
              </span>
              <span style={statLabelStyle}>TOTAL RECORDS</span>
            </div>
          </Panel>
        ))}
      </div>

      {/* Recent Legislative Activity */}
      <Panel title="RECENT LEGISLATIVE ACTIVITY">
        {recentBills.length === 0 ? (
          <p style={{ color: '#555', fontFamily: 'monospace', fontSize: '0.8rem' }}>
            NO RECENT ACTIVITY DETECTED
          </p>
        ) : (
          <div>
            {recentBills.map((bill, idx) => (
              <div key={bill.billId || idx} style={recentItemStyle}>
                <div style={{ flex: 1 }}>
                  <div
                    style={recentTitleStyle}
                    onClick={() => navigate(`/bills/${encodeURIComponent(bill.billId)}`)}
                  >
                    {bill.billName
                      ? (bill.billName.length > 80 ? bill.billName.slice(0, 80) + '...' : bill.billName)
                      : 'UNTITLED BILL'}
                  </div>
                  <div style={{ marginTop: '4px', display: 'flex', gap: '8px', alignItems: 'center' }}>
                    {bill.category && <StatusBadge label={bill.category} type="info" />}
                    {bill.status && <StatusBadge label={bill.status} type={bill.status === 'Third Reading (Passed)' ? 'success' : 'default'} />}
                    {bill.proposer && (
                      <span style={{ color: '#555', fontSize: '0.7rem', fontFamily: 'monospace' }}>
                        {bill.proposer.length > 30 ? bill.proposer.slice(0, 30) + '...' : bill.proposer}
                      </span>
                    )}
                  </div>
                </div>
                <span style={recentDateStyle}>
                  {bill.latestProgressDate || '—'}
                </span>
              </div>
            ))}
          </div>
        )}
      </Panel>

      {/* System Status */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        padding: '12px 16px',
        background: '#0d0d0d',
        border: '1px solid #1a3a1a',
        marginTop: '16px',
      }}>
        <div style={{
          width: '8px',
          height: '8px',
          borderRadius: '50%',
          background: '#00ff41',
          boxShadow: '0 0 8px rgba(0,255,65,0.6)',
        }} />
        <span style={{
          color: '#00ff41',
          fontSize: '0.75rem',
          fontFamily: 'monospace',
          letterSpacing: '0.1em',
          fontWeight: 600,
        }}>
          SYSTEM STATUS: OPERATIONAL
        </span>
        <span style={{
          color: '#333',
          fontSize: '0.7rem',
          fontFamily: 'monospace',
          marginLeft: 'auto',
        }}>
          ALL SUBSYSTEMS NOMINAL
        </span>
      </div>
    </div>
  );
}

export default Dashboard;
