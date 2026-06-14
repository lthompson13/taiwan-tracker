import { useState, useEffect } from 'react';
import Panel from '../components/Panel';
import Loader from '../components/Loader';

function formatDate(pubDate) {
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

function ArticleList({ articles }) {
  return articles.map((article, idx) => (
    <div
      key={idx}
      style={{
        padding: '13px 0',
        borderBottom: idx < articles.length - 1 ? '1px solid var(--border-subtle)' : 'none',
      }}
    >
      <a href={article.url} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none' }}>
        <div style={{ fontSize: '0.9rem', fontWeight: 500, color: 'var(--teal)', lineHeight: 1.45, marginBottom: '4px' }}>
          {article.title}
        </div>
      </a>
      <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
        {article.source && (
          <span style={{ fontSize: '0.775rem', color: 'var(--text-muted)', fontWeight: 500 }}>
            {article.source}
          </span>
        )}
        {article.publishedAt && (
          <span style={{ fontSize: '0.775rem', color: 'var(--text-muted)' }}>
            · {formatDate(article.publishedAt)}
          </span>
        )}
      </div>
    </div>
  ));
}

function News() {
  const [enArticles, setEnArticles] = useState([]);
  const [zhArticles, setZhArticles] = useState([]);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState(null);
  const [refreshedAt, setRefreshedAt] = useState(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const [enRes, zhRes] = await Promise.all([
        fetch('/api/news?lang=en&limit=15'),
        fetch('/api/news?lang=zh&limit=15'),
      ]);
      const [enData, zhData] = await Promise.all([enRes.json(), zhRes.json()]);
      setEnArticles(enData.articles || []);
      setZhArticles(zhData.articles || []);
      setRefreshedAt(new Date());
    } catch (err) {
      setError('Failed to load news: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  return (
    <div>
      <div style={{ marginBottom: '24px', paddingBottom: '12px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700, margin: 0 }}>News</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', margin: '4px 0 0 0' }}>
            Taiwan legislative and political coverage
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {refreshedAt && (
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              Updated {formatDate(refreshedAt.toISOString())}
            </span>
          )}
          <button
            onClick={load}
            disabled={loading}
            style={{ padding: '5px 14px', background: 'transparent', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-sm)', fontSize: '0.8rem', color: 'var(--navy)', fontWeight: 500, cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.5 : 1 }}
          >
            Refresh
          </button>
        </div>
      </div>

      {loading && <Loader text="Loading news" />}

      {error && (
        <div style={{ padding: '12px 14px', background: 'var(--danger-bg)', color: 'var(--danger)', borderRadius: 'var(--radius-md)', fontSize: '0.875rem' }}>
          {error}
        </div>
      )}

      {!loading && !error && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
          <Panel title={`English coverage (${enArticles.length})`}>
            {enArticles.length === 0 ? (
              <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>No articles found.</p>
            ) : (
              <ArticleList articles={enArticles} />
            )}
            <div style={{ paddingTop: '12px', borderTop: '1px solid var(--border-subtle)', marginTop: '4px' }}>
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

          <Panel title={`中文報導 (${zhArticles.length})`}>
            {zhArticles.length === 0 ? (
              <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>找不到文章。</p>
            ) : (
              <ArticleList articles={zhArticles} />
            )}
            <div style={{ paddingTop: '12px', borderTop: '1px solid var(--border-subtle)', marginTop: '4px' }}>
              <a
                href="https://news.google.com/search?q=%E7%AB%8B%E6%B3%95%E9%99%A2&hl=zh-TW"
                target="_blank"
                rel="noopener noreferrer"
                style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textDecoration: 'none' }}
              >
                更多新聞 →
              </a>
            </div>
          </Panel>
        </div>
      )}
    </div>
  );
}

export default News;
