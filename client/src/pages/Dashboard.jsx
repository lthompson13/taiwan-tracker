import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSubscription } from '../hooks/useSubscription';
import Panel from '../components/Panel';
import Loader from '../components/Loader';
import StatusBadge from '../components/StatusBadge';

function formatNewsDate(pubDate) {
  if (!pubDate) return '';
  const d = new Date(pubDate);
  if (isNaN(d)) return '';
  const diffH = Math.round((Date.now() - d) / 3600000);
  if (diffH < 1)  return 'Just now';
  if (diffH < 24) return `${diffH}h ago`;
  const diffD = Math.floor(diffH / 24);
  if (diffD < 7)  return `${diffD}d ago`;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

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
  const { isSubscribed } = useSubscription();
  const [stats, setStats] = useState({
    legislators: null, bills: null, committees: null, interpellations: null,
  });
  const [recentBills, setRecentBills] = useState([]);
  const [crossStraitBills, setCrossStraitBills] = useState([]);
  const [newsArticles, setNewsArticles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchAll = async () => {
      try {
        setLoading(true);
        setError(null);

        const [legRes, billRes, comRes, intRes, recentRes, csRes, newsRes] = await Promise.all([
          fetch('/api/legislators?page=1&limit=1'),
          fetch('/api/bills?page=1&limit=1'),
          fetch('/api/committees?page=1&limit=1'),
          fetch('/api/interpellations?page=1&limit=1'),
          fetch('/api/bills?page=1&limit=5'),
          fetch('/api/archive?sector=Cross-Strait&limit=5'),
          fetch('/api/news?limit=5'),
        ]);

        const [legData, billData, comData, intData, recentData, csData, newsData] = await Promise.all([
          legRes.json(), billRes.json(), comRes.json(), intRes.json(), recentRes.json(), csRes.json(), newsRes.json(),
        ]);

        setStats({
          legislators: legData.total ?? 0,
          bills: billData.total ?? 0,
          committees: comData.total ?? 0,
          interpellations: intData.total ?? 0,
        });
        setRecentBills(recentData.bills || []);
        setCrossStraitBills(csData.bills || []);
        setNewsArticles(newsData.articles || []);
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

      {/* Cross-Strait Watch */}
      {crossStraitBills.length > 0 && (
        <div style={{ marginBottom: '24px' }}>
          <div style={{
            background: '#fffbeb',
            border: '1px solid #d97706',
            borderRadius: 'var(--radius-md)',
            overflow: 'hidden',
          }}>
            <div style={{
              padding: '12px 16px',
              borderBottom: '1px solid #fde68a',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '1rem' }}>⚑</span>
                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#92400e', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                  Cross-Strait Watch
                </span>
              </div>
              <button
                onClick={() => navigate('/bills?sector=Cross-Strait')}
                style={{ background: 'transparent', border: 'none', color: '#d97706', fontSize: '0.775rem', fontWeight: 600, cursor: 'pointer', padding: 0 }}
              >
                View all →
              </button>
            </div>
            {crossStraitBills.map((bill, idx) => (
              <div
                key={bill.billId}
                onClick={() => navigate(`/bills/${encodeURIComponent(bill.billId)}`)}
                style={{
                  padding: '11px 16px',
                  borderBottom: idx < crossStraitBills.length - 1 ? '1px solid #fde68a' : 'none',
                  cursor: 'pointer',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                  gap: '12px',
                  transition: 'background 0.1s',
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = '#fef9e7'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
              >
                <div style={{ flex: 1, fontSize: '0.85rem', color: '#78350f', lineHeight: 1.4 }}>
                  {bill.billName
                    ? (bill.billName.length > 90 ? bill.billName.slice(0, 90) + '…' : bill.billName)
                    : bill.billNameZh || 'Untitled'}
                </div>
                <div style={{ fontSize: '0.75rem', color: '#d97706', whiteSpace: 'nowrap', flexShrink: 0 }}>
                  {bill.latestProgressDate || '—'}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

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
                  {bill.summary && isSubscribed && (
                    <p style={{
                      marginTop: '8px',
                      fontSize: '0.825rem',
                      color: 'var(--text-secondary)',
                      lineHeight: 1.55,
                      borderLeft: '3px solid var(--navy)',
                      paddingLeft: '10px',
                    }}>
                      {bill.summary.summary.length > 160
                        ? bill.summary.summary.slice(0, 160) + '…'
                        : bill.summary.summary}
                    </p>
                  )}
                </div>
                <span style={recentDateStyle}>{bill.latestProgressDate || '—'}</span>
              </div>
            ))}
          </div>
        )}
      </Panel>
      {/* Latest News */}
      {newsArticles.length > 0 && (
        <Panel title="Taiwan Legislative News">
          {newsArticles.map((article, idx) => (
            <div
              key={idx}
              style={{
                padding: '12px 0',
                borderBottom: idx < newsArticles.length - 1 ? '1px solid var(--border-subtle)' : 'none',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                gap: '12px',
              }}
            >
              <div style={{ flex: 1 }}>
                <a
                  href={article.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ textDecoration: 'none' }}
                >
                  <div style={{ fontSize: '0.875rem', color: 'var(--teal)', fontWeight: 500, lineHeight: 1.4, marginBottom: '3px' }}>
                    {article.title}
                  </div>
                </a>
                {article.source && (
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{article.source}</span>
                )}
              </div>
              {article.publishedAt && (
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', whiteSpace: 'nowrap', flexShrink: 0 }}>
                  {formatNewsDate(article.publishedAt)}
                </span>
              )}
            </div>
          ))}
          <div style={{ paddingTop: '10px', borderTop: '1px solid var(--border-subtle)', marginTop: '4px' }}>
            <a
              href="https://news.google.com/search?q=Taiwan+legislature+Legislative+Yuan&hl=en-US"
              target="_blank"
              rel="noopener noreferrer"
              style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textDecoration: 'none' }}
            >
              More on Google News →
            </a>
          </div>
        </Panel>
      )}
    </div>
  );
}

export default Dashboard;
