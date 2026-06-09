import { useState, useEffect } from 'react';
import Panel from '../components/Panel';
import StatusBadge from '../components/StatusBadge';
import Loader from '../components/Loader';
import Pagination from '../components/Pagination';

const TODAY = new Date().toISOString().slice(0, 10); // "YYYY-MM-DD"

function isUpcoming(dates) {
  if (!Array.isArray(dates) || dates.length === 0) return false;
  // Upcoming if any date is today or in the future
  return dates.some((d) => d >= TODAY);
}

function formatDates(dates) {
  if (!dates || dates.length === 0) return '—';
  const fmt = (d) => {
    const [y, m, day] = d.split('-');
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    return `${months[parseInt(m, 10) - 1]} ${parseInt(day, 10)}`;
  };
  if (dates.length === 1) return fmt(dates[0]);
  // Multi-day: show range if same month
  const first = dates[0];
  const last  = dates[dates.length - 1];
  const [fy, fm] = first.split('-');
  const [ly, lm, ld] = last.split('-');
  if (fy === ly && fm === lm) {
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    return `${months[parseInt(fm, 10) - 1]} ${parseInt(first.split('-')[2], 10)}–${parseInt(ld, 10)}`;
  }
  return `${fmt(first)} – ${fmt(last)}`;
}

function formatTime(startTime, endTime) {
  if (!startTime) return null;
  const t = (iso) => iso.slice(11, 16); // "HH:MM"
  return endTime ? `${t(startTime)}–${t(endTime)}` : t(startTime);
}

const selectStyle = {
  padding: '6px 10px',
  border: '1px solid var(--border-default)',
  borderRadius: 'var(--radius-sm)',
  fontSize: '0.825rem',
  color: 'var(--text-primary)',
  background: 'var(--bg-elevated)',
  cursor: 'pointer',
};

function Hearings() {
  const [meets, setMeets]         = useState([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState(null);
  const [page, setPage]           = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal]         = useState(0);

  const [term, setTerm]           = useState('11');
  const [session, setSession]     = useState('5');
  const [committees, setCommittees] = useState([]); // unique names from loaded data
  const [committeeFilter, setCommitteeFilter] = useState('');

  useEffect(() => {
    const fetchMeets = async () => {
      try {
        setLoading(true);
        setError(null);
        const params = new URLSearchParams({ page, limit: 20 });
        if (term)    params.set('term',    term);
        if (session) params.set('session', session);

        const res = await fetch(`/api/meets?${params}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();

        const items = data.meets || [];
        setMeets(items);
        setTotalPages(data.totalPages || 1);
        setTotal(data.total || 0);

        // Extract unique committee names for filter dropdown
        const names = [...new Set(
          items.flatMap((m) => m.committeeNames || []).filter(Boolean)
        )].sort();
        setCommittees((prev) => {
          const merged = [...new Set([...prev, ...names])].sort();
          return merged;
        });
      } catch (err) {
        setError('Failed to load hearings: ' + err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchMeets();
  }, [term, session, page]);

  const handleTermChange = (e) => {
    setTerm(e.target.value);
    setSession('');
    setPage(1);
    setCommittees([]);
    setCommitteeFilter('');
  };

  const handleSessionChange = (e) => {
    setSession(e.target.value);
    setPage(1);
  };

  const filtered = committeeFilter
    ? meets.filter((m) => (m.committeeNames || []).includes(committeeFilter))
    : meets;

  return (
    <div>
      <div style={{ marginBottom: '20px', paddingBottom: '12px', borderBottom: '1px solid var(--border-subtle)' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 700, margin: 0 }}>Committee Hearings</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', margin: '4px 0 0 0' }}>
          Legislative Yuan committee meetings — upcoming and recent
        </p>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center', marginBottom: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 500 }}>Term:</label>
          <select style={selectStyle} value={term} onChange={handleTermChange}>
            <option value="11">Term 11</option>
            <option value="10">Term 10</option>
            <option value="9">Term 9</option>
          </select>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 500 }}>Session:</label>
          <select style={selectStyle} value={session} onChange={handleSessionChange}>
            <option value="">All sessions</option>
            {[1,2,3,4,5,6,7,8].map((s) => (
              <option key={s} value={String(s)}>Session {s}</option>
            ))}
          </select>
        </div>
        {committees.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 500 }}>Committee:</label>
            <select style={selectStyle} value={committeeFilter} onChange={(e) => setCommitteeFilter(e.target.value)}>
              <option value="">All committees</option>
              {committees.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
        )}
        <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginLeft: 'auto' }}>
          {total} meeting{total !== 1 ? 's' : ''}
        </span>
      </div>

      {error && (
        <div style={{ padding: '12px 14px', background: 'var(--danger-bg)', color: 'var(--danger)', borderRadius: 'var(--radius-md)', fontSize: '0.875rem', marginBottom: '16px' }}>
          {error}
        </div>
      )}

      {loading ? (
        <Loader text="Loading hearings" />
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-muted)' }}>
          No meetings found for the selected filters.
        </div>
      ) : (
        <>
          <Panel>
            {filtered.map((meet, idx) => {
              const upcoming = isUpcoming(meet.dates);
              const time = formatTime(meet.startTime, meet.endTime);
              return (
                <div
                  key={meet.meetingCode}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '100px 1fr',
                    gap: '16px',
                    padding: '16px 0',
                    borderBottom: idx < filtered.length - 1 ? '1px solid var(--border-subtle)' : 'none',
                    opacity: !upcoming ? 0.72 : 1,
                  }}
                >
                  {/* Date column */}
                  <div style={{ paddingTop: '2px' }}>
                    <div style={{
                      fontSize: '0.875rem',
                      fontWeight: 700,
                      color: upcoming ? 'var(--navy)' : 'var(--text-muted)',
                      lineHeight: 1.3,
                    }}>
                      {formatDates(meet.dates)}
                    </div>
                    {time && (
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '3px' }}>
                        {time}
                      </div>
                    )}
                    {upcoming && (
                      <div style={{
                        marginTop: '6px',
                        display: 'inline-block',
                        fontSize: '0.65rem',
                        fontWeight: 700,
                        letterSpacing: '0.06em',
                        color: 'var(--teal)',
                        background: 'var(--teal-light)',
                        border: '1px solid var(--teal)',
                        borderRadius: '999px',
                        padding: '1px 6px',
                      }}>
                        UPCOMING
                      </div>
                    )}
                  </div>

                  {/* Content column */}
                  <div>
                    {/* Committee badges */}
                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '6px' }}>
                      {(meet.committeeNames || []).map((name) => (
                        <StatusBadge key={name} label={name} type="info" />
                      ))}
                    </div>

                    {/* Title */}
                    <div style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '6px', lineHeight: 1.4 }}>
                      {meet.title || '—'}
                    </div>

                    {/* Location */}
                    {meet.location && (
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '6px' }}>
                        📍 {meet.location}
                        {meet.convener && (
                          <span style={{ marginLeft: '12px' }}>· Convened by {meet.convener}</span>
                        )}
                      </div>
                    )}

                    {/* Agenda excerpt */}
                    {meet.agenda && (
                      <div style={{
                        fontSize: '0.825rem',
                        color: 'var(--text-secondary)',
                        lineHeight: 1.5,
                        borderLeft: '3px solid var(--border-default)',
                        paddingLeft: '10px',
                        marginBottom: '8px',
                      }}>
                        {meet.agenda.length > 220
                          ? meet.agenda.slice(0, 220).replace(/\n/g, ' ') + '…'
                          : meet.agenda.replace(/\n/g, ' ')}
                      </div>
                    )}

                    {/* Links */}
                    <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
                      {meet.url && (
                        <a
                          href={meet.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{ fontSize: '0.8rem', color: 'var(--teal)', textDecoration: 'none', fontWeight: 500 }}
                        >
                          View on LY →
                        </a>
                      )}
                      {meet.videoUrl && (
                        <a
                          href={meet.videoUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{ fontSize: '0.8rem', color: 'var(--teal)', textDecoration: 'none', fontWeight: 500 }}
                        >
                          🎬 Video
                        </a>
                      )}
                      {meet.attachments.slice(0, 2).map((att, i) => (
                        <a
                          key={i}
                          href={att.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textDecoration: 'none' }}
                        >
                          📎 {att.format?.toUpperCase()}
                        </a>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })}
          </Panel>

          {totalPages > 1 && (
            <div style={{ marginTop: '16px' }}>
              <Pagination
                page={page}
                totalPages={totalPages}
                onPageChange={(p) => { setPage(p); window.scrollTo(0, 0); }}
              />
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default Hearings;
