import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Panel from '../components/Panel';
import StatusBadge from '../components/StatusBadge';
import Loader from '../components/Loader';

function getPartyBadgeType(party) {
  if (!party) return 'default';
  if (party.includes('Democratic Progressive')) return 'success';
  if (party.includes('Kuomintang')) return 'info';
  if (party.includes('People\'s Party')) return 'warning';
  if (party.includes('New Power')) return 'danger';
  return 'default';
}

const infoRowStyle = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: '10px 0',
  borderBottom: '1px solid #1a1a1a',
};

const infoLabelStyle = {
  color: '#555',
  fontSize: '0.7rem',
  fontFamily: 'monospace',
  letterSpacing: '0.1em',
  textTransform: 'uppercase',
};

const infoValueStyle = {
  color: '#c0c0c0',
  fontSize: '0.8rem',
  fontFamily: 'monospace',
};

const listItemStyle = {
  padding: '8px 0',
  borderBottom: '1px solid #111',
  color: '#c0c0c0',
  fontSize: '0.8rem',
  fontFamily: 'monospace',
  lineHeight: 1.5,
};

const backButtonStyle = {
  background: 'transparent',
  border: '1px solid #1a3a1a',
  color: '#00ff41',
  padding: '8px 20px',
  fontSize: '0.75rem',
  fontFamily: 'monospace',
  letterSpacing: '0.1em',
  cursor: 'pointer',
  textTransform: 'uppercase',
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
        setError('FAILED TO RETRIEVE PERSONNEL FILE: ' + err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchLegislator();
  }, [name]);

  if (loading) return <Loader text="ACCESSING PERSONNEL FILE" />;

  if (error) {
    return (
      <div>
        <button style={backButtonStyle} onClick={() => navigate(-1)}>
          &lt; BACK TO DIRECTORY
        </button>
        <div style={{ padding: '16px', color: '#ff0040', fontFamily: 'monospace', fontSize: '0.85rem' }}>
          <span>[ERROR]</span> {error}
        </div>
      </div>
    );
  }

  if (!legislator) {
    return (
      <div style={{ padding: '24px', color: '#555', fontFamily: 'monospace' }}>
        NO RECORD FOUND
      </div>
    );
  }

  const committees = Array.isArray(legislator.committees) ? legislator.committees : [];
  const education = Array.isArray(legislator.education) ? legislator.education :
    (legislator.education ? [legislator.education] : []);
  const experience = Array.isArray(legislator.experience) ? legislator.experience :
    (legislator.experience ? [legislator.experience] : []);

  return (
    <div>
      <button style={backButtonStyle} onClick={() => navigate(-1)}>
        &lt; BACK TO DIRECTORY
      </button>

      {/* Header Section */}
      <div style={{
        display: 'flex',
        gap: '24px',
        alignItems: 'flex-start',
        marginBottom: '24px',
        flexWrap: 'wrap',
      }}>
        {/* Photo */}
        {legislator.photo && (
          <div style={{
            width: '140px',
            height: '180px',
            border: '2px solid #1a3a1a',
            background: '#111',
            overflow: 'hidden',
            flexShrink: 0,
          }}>
            <img
              src={legislator.photo}
              alt={legislator.name}
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                filter: 'grayscale(30%) contrast(1.1)',
              }}
              onError={(e) => {
                e.target.style.display = 'none';
              }}
            />
          </div>
        )}

        {/* Name and Party */}
        <div style={{ flex: 1 }}>
          <h1 style={{
            color: '#00ff41',
            fontSize: '1.6rem',
            fontWeight: 700,
            fontFamily: 'monospace',
            letterSpacing: '0.1em',
            margin: '0 0 4px 0',
          }}>
            {legislator.name}
          </h1>
          {legislator.nameEn && (
            <p style={{
              color: '#888',
              fontSize: '0.85rem',
              fontFamily: 'monospace',
              margin: '0 0 12px 0',
            }}>
              {legislator.nameEn}
            </p>
          )}
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
            <StatusBadge
              label={legislator.party || 'UNKNOWN'}
              type={getPartyBadgeType(legislator.party)}
            />
            {legislator.caucus && legislator.caucus !== legislator.party && (
              <StatusBadge label={`CAUCUS: ${legislator.caucus}`} type="default" />
            )}
            {legislator.resigned === '是' && (
              <StatusBadge label="RESIGNED" type="danger" />
            )}
          </div>
        </div>
      </div>

      {/* Information Grid */}
      <Panel title="PERSONNEL DETAILS">
        <div style={infoRowStyle}>
          <span style={infoLabelStyle}>DISTRICT</span>
          <span style={infoValueStyle}>{legislator.district || '—'}</span>
        </div>
        <div style={infoRowStyle}>
          <span style={infoLabelStyle}>GENDER</span>
          <span style={infoValueStyle}>{legislator.gender || '—'}</span>
        </div>
        <div style={infoRowStyle}>
          <span style={infoLabelStyle}>START DATE</span>
          <span style={infoValueStyle}>{legislator.startDate || '—'}</span>
        </div>
        <div style={infoRowStyle}>
          <span style={infoLabelStyle}>CAUCUS</span>
          <span style={infoValueStyle}>{legislator.caucus || '—'}</span>
        </div>
        <div style={{ ...infoRowStyle, borderBottom: 'none' }}>
          <span style={infoLabelStyle}>TERM</span>
          <span style={infoValueStyle}>{legislator.term || '—'}</span>
        </div>
      </Panel>

      {/* Committees */}
      {committees.length > 0 && (
        <Panel title="COMMITTEE ASSIGNMENTS">
          {committees.map((c, idx) => (
            <div key={idx} style={listItemStyle}>
              <span style={{ color: '#00d4ff' }}>[{idx + 1}]</span>{' '}
              {typeof c === 'string' ? c : c.name || JSON.stringify(c)}
            </div>
          ))}
        </Panel>
      )}

      {/* Education */}
      {education.length > 0 && (
        <Panel title="EDUCATION BACKGROUND">
          {education.map((e, idx) => (
            <div key={idx} style={listItemStyle}>
              <span style={{ color: '#ffb000' }}>[{idx + 1}]</span>{' '}
              {typeof e === 'string' ? e : JSON.stringify(e)}
            </div>
          ))}
        </Panel>
      )}

      {/* Experience */}
      {experience.length > 0 && (
        <Panel title="PROFESSIONAL EXPERIENCE">
          {experience.map((e, idx) => (
            <div key={idx} style={listItemStyle}>
              <span style={{ color: '#ffb000' }}>[{idx + 1}]</span>{' '}
              {typeof e === 'string' ? e : JSON.stringify(e)}
            </div>
          ))}
        </Panel>
      )}
    </div>
  );
}

export default LegislatorDetail;
