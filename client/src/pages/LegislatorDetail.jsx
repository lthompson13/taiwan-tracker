import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Panel from '../components/Panel';
import StatusBadge from '../components/StatusBadge';
import Loader from '../components/Loader';

function getPartyBadgeType(party) {
  if (!party) return 'default';
  if (party.includes('Democratic Progressive')) return 'success';
  if (party.includes('Kuomintang')) return 'info';
  if (party.includes("People's Party")) return 'warning';
  if (party.includes('New Power')) return 'danger';
  return 'default';
}

const infoRowStyle = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: '10px 0',
  borderBottom: '1px solid var(--border-subtle)',
  gap: '16px',
};

const infoLabelStyle = {
  color: 'var(--text-muted)',
  fontSize: '0.8rem',
  fontWeight: 500,
};

const infoValueStyle = {
  color: 'var(--text-primary)',
  fontSize: '0.9rem',
  textAlign: 'right',
};

const listItemStyle = {
  padding: '8px 0',
  borderBottom: '1px solid var(--border-subtle)',
  color: 'var(--text-primary)',
  fontSize: '0.9rem',
  lineHeight: 1.5,
};

const backButtonStyle = {
  background: 'transparent',
  border: '1px solid var(--border-default)',
  borderRadius: 'var(--radius-sm)',
  color: 'var(--navy)',
  padding: '6px 14px',
  fontSize: '0.825rem',
  fontWeight: 500,
  cursor: 'pointer',
  marginBottom: '20px',
};

function LegislatorDetail() {
  const { name } = useParams();
  const navigate = useNavigate();
  const [legislator, setLegislator] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchLegislator = async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch(`/api/legislators/${encodeURIComponent(name)}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        setLegislator(data);
      } catch (err) {
        setError('Failed to load legislator: ' + err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchLegislator();
  }, [name]);

  if (loading) return <Loader text="Loading legislator" />;

  if (error) {
    return (
      <div>
        <button style={backButtonStyle} onClick={() => navigate(-1)}>&larr; Back to legislators</button>
        <div style={{ padding: '12px 14px', background: 'var(--danger-bg)', color: 'var(--danger)', borderRadius: 'var(--radius-md)', fontSize: '0.875rem' }}>
          {error}
        </div>
      </div>
    );
  }

  if (!legislator) {
    return <div style={{ padding: '24px', color: 'var(--text-muted)' }}>No record found.</div>;
  }

  const committees = Array.isArray(legislator.committees) ? legislator.committees : [];
  const education  = Array.isArray(legislator.education)  ? legislator.education  : (legislator.education  ? [legislator.education]  : []);
  const experience = Array.isArray(legislator.experience) ? legislator.experience : (legislator.experience ? [legislator.experience] : []);

  return (
    <div>
      <button style={backButtonStyle} onClick={() => navigate(-1)}>&larr; Back to legislators</button>

      <div style={{ display: 'flex', gap: '24px', alignItems: 'flex-start', marginBottom: '24px', flexWrap: 'wrap' }}>
        {legislator.photo && (
          <div style={{
            width: '140px', height: '180px',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-md)',
            background: 'var(--bg-subtle)',
            overflow: 'hidden',
            flexShrink: 0,
          }}>
            <img
              src={legislator.photo}
              alt={legislator.name}
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              onError={(e) => { e.target.style.display = 'none'; }}
            />
          </div>
        )}

        <div style={{ flex: 1, minWidth: '240px' }}>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 700, margin: '0 0 4px 0', lineHeight: 1.2 }}>
            {legislator.name}
          </h1>
          {legislator.nameEn && (
            <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem', margin: '0 0 12px 0' }}>
              {legislator.nameEn}
            </p>
          )}
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
            <StatusBadge label={legislator.party || 'Unknown'} type={getPartyBadgeType(legislator.party)} />
            {legislator.caucus && legislator.caucus !== legislator.party && (
              <StatusBadge label={`Caucus: ${legislator.caucus}`} type="default" />
            )}
            {legislator.resigned === '是' && <StatusBadge label="Resigned" type="danger" />}
          </div>
        </div>
      </div>

      <Panel title="Details">
        <div style={infoRowStyle}><span style={infoLabelStyle}>District</span><span style={infoValueStyle}>{legislator.district || '—'}</span></div>
        <div style={infoRowStyle}><span style={infoLabelStyle}>Gender</span><span style={infoValueStyle}>{legislator.gender || '—'}</span></div>
        <div style={infoRowStyle}><span style={infoLabelStyle}>Start date</span><span style={infoValueStyle}>{legislator.startDate || '—'}</span></div>
        <div style={infoRowStyle}><span style={infoLabelStyle}>Caucus</span><span style={infoValueStyle}>{legislator.caucus || '—'}</span></div>
        <div style={{ ...infoRowStyle, borderBottom: 'none' }}><span style={infoLabelStyle}>Term</span><span style={infoValueStyle}>{legislator.term || '—'}</span></div>
      </Panel>

      {committees.length > 0 && (
        <Panel title="Committee assignments">
          {committees.map((c, idx) => (
            <div key={idx} style={{ ...listItemStyle, borderBottom: idx === committees.length - 1 ? 'none' : '1px solid var(--border-subtle)' }}>
              <span style={{ color: 'var(--text-muted)', marginRight: '8px' }}>{idx + 1}.</span>{' '}
              {typeof c === 'string' ? c : c.name || JSON.stringify(c)}
            </div>
          ))}
        </Panel>
      )}

      {education.length > 0 && (
        <Panel title="Education">
          {education.map((e, idx) => (
            <div key={idx} style={{ ...listItemStyle, borderBottom: idx === education.length - 1 ? 'none' : '1px solid var(--border-subtle)' }}>
              <span style={{ color: 'var(--text-muted)', marginRight: '8px' }}>{idx + 1}.</span>{' '}
              {typeof e === 'string' ? e : JSON.stringify(e)}
            </div>
          ))}
        </Panel>
      )}

      {experience.length > 0 && (
        <Panel title="Experience">
          {experience.map((e, idx) => (
            <div key={idx} style={{ ...listItemStyle, borderBottom: idx === experience.length - 1 ? 'none' : '1px solid var(--border-subtle)' }}>
              <span style={{ color: 'var(--text-muted)', marginRight: '8px' }}>{idx + 1}.</span>{' '}
              {typeof e === 'string' ? e : JSON.stringify(e)}
            </div>
          ))}
        </Panel>
      )}
    </div>
  );
}

export default LegislatorDetail;
