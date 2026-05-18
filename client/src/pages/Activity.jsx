import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Panel from '../components/Panel';
import StatusBadge from '../components/StatusBadge';
import Loader from '../components/Loader';

const feedItemStyle = {
  padding: '14px 0',
  borderBottom: '1px solid var(--border-subtle)',
  display: 'flex',
  gap: '16px',
  alignItems: 'flex-start',
};

const feedTimestampStyle = {
  color: 'var(--text-muted)',
  fontSize: '0.8rem',
  whiteSpace: 'nowrap',
  minWidth: '90px',
  flexShrink: 0,
  paddingTop: '2px',
};

const feedTitleStyle = {
  color: 'var(--text-primary)',
  fontSize: '0.9rem',
  lineHeight: 1.4,
  cursor: 'pointer',
};

const feedDetailStyle = {
  color: 'var(--text-muted)',
  fontSize: '0.8rem',
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

        const [billsData, interpData] = await Promise.all([billsRes.json(), interpRes.json()]);

        const billItems = (billsData.bills || []).map((bill) => ({
          type: 'Bill',
          id: bill.billId,
          title: bill.billName || 'Untitled bill',
          date: bill.latestProgressDate || '',
          detail: [
            bill.category,
            bill.status,
            bill.proposer ? `Proposer: ${bill.proposer}` : null,
          ].filter(Boolean).join(' • '),
          category: bill.category,
          status: bill.status,
          navigateTo: `/bills/${encodeURIComponent(bill.billId)}`,
        }));

        const interpItems = (interpData.interpellations || []).map((interp) => ({
          type: 'Interpellation',
          id: interp.interpellationId,
          title: interp.subject || 'Untitled interpellation',
          date: interp.publishDate || '',
          detail: [
            Array.isArray(interp.legislators) ? `Legislators: ${interp.legislators.join(', ')}` : null,
            interp.meetingDescription,
          ].filter(Boolean).join(' • '),
          category: null,
          status: null,
          navigateTo: null,
        }));

        const merged = [...billItems, ...interpItems].sort((a, b) => {
          if (!a.date && !b.date) return 0;
          if (!a.date) return 1;
          if (!b.date) return -1;
          return b.date.localeCompare(a.date);
        });

        setActivities(merged);
      } catch (err) {
        setError('Failed to load activity: ' + err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchActivity();
  }, []);

  const getTypeBadgeType = (type) => {
    if (type === 'Bill') return 'warning';
    if (type === 'Interpellation') return 'info';
    return 'default';
  };

  if (loading) return <Loader text="Loading activity" />;

  if (error) {
    return (
      <div style={{ padding: '12px 14px', background: 'var(--danger-bg)', color: 'var(--danger)', borderRadius: 'var(--radius-md)', fontSize: '0.875rem' }}>
        {error}
      </div>
    );
  }

  return (
    <div>
      <div style={{ marginBottom: '20px', paddingBottom: '12px', borderBottom: '1px solid var(--border-subtle)' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 700, margin: 0 }}>Activity</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', margin: '4px 0 0 0' }}>
          Combined chronological feed of bills and interpellations
        </p>
      </div>

      <Panel title="Recent activity">
        {activities.length === 0 ? (
          <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
            No recent activity.
          </div>
        ) : (
          <div>
            {activities.map((item, idx) => (
              <div key={`${item.type}-${item.id || idx}`} style={{
                ...feedItemStyle,
                borderBottom: idx === activities.length - 1 ? 'none' : '1px solid var(--border-subtle)',
              }}>
                <div style={feedTimestampStyle}>{item.date || '—'}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '6px', flexWrap: 'wrap' }}>
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
                    onClick={() => { if (item.navigateTo) navigate(item.navigateTo); }}
                  >
                    {item.title.length > 120 ? item.title.slice(0, 120) + '…' : item.title}
                  </div>
                  {item.detail && (
                    <div style={feedDetailStyle}>
                      {item.detail.length > 140 ? item.detail.slice(0, 140) + '…' : item.detail}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </Panel>

      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '16px',
        padding: '10px 14px',
        background: 'var(--bg-subtle)',
        border: '1px solid var(--border-subtle)',
        borderRadius: 'var(--radius-md)',
        marginTop: '16px',
        fontSize: '0.8rem',
        color: 'var(--text-secondary)',
      }}>
        <span>Showing {activities.length} items</span>
        <span style={{ marginLeft: 'auto', color: 'var(--text-muted)' }}>
          Bills: {activities.filter((a) => a.type === 'Bill').length} • Interpellations: {activities.filter((a) => a.type === 'Interpellation').length}
        </span>
      </div>
    </div>
  );
}

export default Activity;
