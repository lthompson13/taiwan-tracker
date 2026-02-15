import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Panel from '../components/Panel';
import StatusBadge from '../components/StatusBadge';
import Loader from '../components/Loader';

const feedItemStyle = {
  padding: '16px 0',
  borderBottom: '1px solid #1a1a1a',
  display: 'flex',
  gap: '16px',
  alignItems: 'flex-start',
};

const feedTimestampStyle = {
  color: '#ffb000',
  fontSize: '0.7rem',
  fontFamily: 'monospace',
  whiteSpace: 'nowrap',
  minWidth: '90px',
  flexShrink: 0,
  paddingTop: '2px',
};

const feedTitleStyle = {
  color: '#c0c0c0',
  fontSize: '0.8rem',
  fontFamily: 'monospace',
  lineHeight: 1.4,
  cursor: 'pointer',
};

const feedDetailStyle = {
  color: '#555',
  fontSize: '0.7rem',
  fontFamily: 'monospace',
  marginTop: '6px',
};

function Activity() {
  const navigate = useNavigate();
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchActivity = async () => {
      try {
        setLoading(true);
        setError(null);

        const [billsRes, interpRes] = await Promise.all([
          fetch('/api/bills?page=1&limit=10'),
          fetch('/api/interpellations?page=1&limit=10'),
        ]);

        const [billsData, interpData] = await Promise.all([
          billsRes.json(),
          interpRes.json(),
        ]);

        const billItems = (billsData.bills || []).map((bill) => ({
          type: 'BILL',
          id: bill.billId,
          title: bill.billName || 'UNTITLED BILL',
          date: bill.latestProgressDate || '',
          detail: [
            bill.category,
            bill.status,
            bill.proposer ? `Proposer: ${bill.proposer}` : null,
          ].filter(Boolean).join(' | '),
          category: bill.category,
          status: bill.status,
          navigateTo: `/bills/${encodeURIComponent(bill.billId)}`,
        }));

        const interpItems = (interpData.interpellations || []).map((interp) => ({
          type: 'INTERPELLATION',
          id: interp.interpellationId,
          title: interp.subject || 'UNTITLED INTERPELLATION',
          date: interp.publishDate || '',
          detail: [
            Array.isArray(interp.legislators) ? `Legislators: ${interp.legislators.join(', ')}` : null,
            interp.meetingDescription,
          ].filter(Boolean).join(' | '),
          category: null,
          status: null,
          navigateTo: null,
        }));

        // Merge and sort by date (descending)
        const merged = [...billItems, ...interpItems].sort((a, b) => {
          if (!a.date && !b.date) return 0;
          if (!a.date) return 1;
          if (!b.date) return -1;
          return b.date.localeCompare(a.date);
        });

        setActivities(merged);
      } catch (err) {
        setError('FAILED TO COMPILE ACTIVITY FEED: ' + err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchActivity();
  }, []);

  const getTypeBadgeType = (type) => {
    if (type === 'BILL') return 'warning';
    if (type === 'INTERPELLATION') return 'info';
    return 'default';
  };

  if (loading) return <Loader text="COMPILING ACTIVITY FEED" />;

  if (error) {
    return (
      <div style={{ padding: '16px', color: '#ff0040', fontFamily: 'monospace', fontSize: '0.85rem' }}>
        <span>[ERROR]</span> {error}
      </div>
    );
  }

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
          /// ACTIVITY FEED
        </h1>
        <p style={{
          color: '#555',
          fontSize: '0.7rem',
          fontFamily: 'monospace',
          margin: '4px 0 0 0',
          letterSpacing: '0.08em',
        }}>
          COMBINED CHRONOLOGICAL FEED — BILLS AND INTERPELLATIONS
        </p>
      </div>

      <Panel title="RECENT ACTIVITY LOG">
        {activities.length === 0 ? (
          <div style={{ padding: '24px', textAlign: 'center', color: '#555', fontFamily: 'monospace' }}>
            NO RECENT ACTIVITY DETECTED
          </div>
        ) : (
          <div>
            {activities.map((item, idx) => (
              <div key={`${item.type}-${item.id || idx}`} style={feedItemStyle}>
                {/* Timestamp */}
                <div style={feedTimestampStyle}>
                  {item.date || '—'}
                </div>

                {/* Content */}
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '6px' }}>
                    <StatusBadge label={item.type} type={getTypeBadgeType(item.type)} />
                    {item.status && (
                      <StatusBadge
                        label={item.status}
                        type={item.status === 'Third Reading (Passed)' ? 'success' : 'default'}
                      />
                    )}
                  </div>
                  <div
                    style={feedTitleStyle}
                    onClick={() => {
                      if (item.navigateTo) navigate(item.navigateTo);
                    }}
                  >
                    {item.title.length > 100 ? item.title.slice(0, 100) + '...' : item.title}
                  </div>
                  {item.detail && (
                    <div style={feedDetailStyle}>
                      {item.detail.length > 120 ? item.detail.slice(0, 120) + '...' : item.detail}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </Panel>

      {/* Feed stats */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '16px',
        padding: '12px 16px',
        background: '#0d0d0d',
        border: '1px solid #1a3a1a',
        marginTop: '16px',
      }}>
        <span style={{
          color: '#555',
          fontSize: '0.7rem',
          fontFamily: 'monospace',
          letterSpacing: '0.08em',
        }}>
          DISPLAYING {activities.length} ITEMS
        </span>
        <span style={{
          color: '#333',
          fontSize: '0.7rem',
          fontFamily: 'monospace',
          marginLeft: 'auto',
        }}>
          BILLS: {activities.filter((a) => a.type === 'BILL').length} | INTERPELLATIONS: {activities.filter((a) => a.type === 'INTERPELLATION').length}
        </span>
      </div>
    </div>
  );
}

export default Activity;
