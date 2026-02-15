import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Panel from '../components/Panel';
import StatusBadge from '../components/StatusBadge';
import Loader from '../components/Loader';

function getStatusBadgeType(status) {
  if (!status) return 'default';
  if (status === 'Third Reading (Passed)') return 'success';
  if (status === 'Scheduled for Plenary') return 'warning';
  if (status === 'Review Complete') return 'info';
  if (status === 'Not Reviewed' || status === 'Returned' || status === 'Withdrawn') return 'danger';
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
  flexShrink: 0,
};

const infoValueStyle = {
  color: '#c0c0c0',
  fontSize: '0.8rem',
  fontFamily: 'monospace',
  textAlign: 'right',
  wordBreak: 'break-word',
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

const linkStyle = {
  color: '#00d4ff',
  textDecoration: 'none',
  fontSize: '0.8rem',
  fontFamily: 'monospace',
  borderBottom: '1px solid rgba(0,212,255,0.3)',
};

function BillDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [bill, setBill] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchBill = async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch(`/api/bills/${encodeURIComponent(id)}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        setBill(data);
      } catch (err) {
        setError('FAILED TO RETRIEVE BILL RECORD: ' + err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchBill();
  }, [id]);

  if (loading) return <Loader text="RETRIEVING BILL DOSSIER" />;

  if (error) {
    return (
      <div>
        <button style={backButtonStyle} onClick={() => navigate(-1)}>
          &lt; BACK TO BILLS
        </button>
        <div style={{ padding: '16px', color: '#ff0040', fontFamily: 'monospace', fontSize: '0.85rem' }}>
          <span>[ERROR]</span> {error}
        </div>
      </div>
    );
  }

  if (!bill) {
    return (
      <div style={{ padding: '24px', color: '#555', fontFamily: 'monospace' }}>
        NO RECORD FOUND
      </div>
    );
  }

  const attachments = Array.isArray(bill.attachments) ? bill.attachments : [];
  const lawNames = Array.isArray(bill.lawNames) ? bill.lawNames :
    (bill.lawNames ? [bill.lawNames] : []);

  return (
    <div>
      <button style={backButtonStyle} onClick={() => navigate(-1)}>
        &lt; BACK TO BILLS
      </button>

      {/* Header */}
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{
          color: '#00ff41',
          fontSize: '1.2rem',
          fontWeight: 700,
          fontFamily: 'monospace',
          letterSpacing: '0.05em',
          margin: '0 0 12px 0',
          lineHeight: 1.4,
        }}>
          {bill.billName || 'UNTITLED BILL'}
        </h1>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {bill.status && (
            <StatusBadge label={bill.status} type={getStatusBadgeType(bill.status)} />
          )}
          {bill.category && (
            <StatusBadge label={bill.category} type="info" />
          )}
        </div>
      </div>

      {/* Bill Information */}
      <Panel title="BILL DETAILS">
        <div style={infoRowStyle}>
          <span style={infoLabelStyle}>PROPOSER</span>
          <span style={infoValueStyle}>{bill.proposer || '—'}</span>
        </div>
        <div style={infoRowStyle}>
          <span style={infoLabelStyle}>SOURCE</span>
          <span style={infoValueStyle}>{bill.source || '—'}</span>
        </div>
        <div style={infoRowStyle}>
          <span style={infoLabelStyle}>SESSION / TERM</span>
          <span style={infoValueStyle}>{bill.session || '—'} / TERM {bill.term || '—'}</span>
        </div>
        <div style={infoRowStyle}>
          <span style={infoLabelStyle}>REFERENCE NUMBER</span>
          <span style={infoValueStyle}>{bill.referenceNumber || '—'}</span>
        </div>
        <div style={infoRowStyle}>
          <span style={infoLabelStyle}>PROPOSAL NUMBER</span>
          <span style={infoValueStyle}>{bill.proposalNumber || '—'}</span>
        </div>
        <div style={infoRowStyle}>
          <span style={infoLabelStyle}>LATEST PROGRESS DATE</span>
          <span style={{ ...infoValueStyle, color: '#ffb000' }}>{bill.latestProgressDate || '—'}</span>
        </div>
        {bill.meetingDescription && (
          <div style={infoRowStyle}>
            <span style={infoLabelStyle}>MEETING</span>
            <span style={infoValueStyle}>{bill.meetingDescription}</span>
          </div>
        )}
        <div style={{ ...infoRowStyle, borderBottom: 'none' }}>
          <span style={infoLabelStyle}>BILL ID</span>
          <span style={{ ...infoValueStyle, color: '#555' }}>{bill.billId || '—'}</span>
        </div>
      </Panel>

      {/* Law Names */}
      {lawNames.length > 0 && (
        <Panel title="RELATED LAWS">
          {lawNames.map((name, idx) => (
            <div key={idx} style={{
              padding: '8px 0',
              borderBottom: idx < lawNames.length - 1 ? '1px solid #111' : 'none',
              color: '#c0c0c0',
              fontSize: '0.8rem',
              fontFamily: 'monospace',
            }}>
              <span style={{ color: '#00d4ff' }}>[{idx + 1}]</span> {name}
            </div>
          ))}
        </Panel>
      )}

      {/* Attachments */}
      {attachments.length > 0 && (
        <Panel title="ATTACHMENTS">
          {attachments.map((att, idx) => (
            <div key={idx} style={{
              padding: '8px 0',
              borderBottom: idx < attachments.length - 1 ? '1px solid #111' : 'none',
            }}>
              <a
                href={att.url}
                target="_blank"
                rel="noopener noreferrer"
                style={linkStyle}
              >
                {att.name || `ATTACHMENT ${idx + 1}`}
              </a>
            </div>
          ))}
        </Panel>
      )}

      {/* External Link */}
      {bill.url && (
        <Panel title="EXTERNAL SOURCE">
          <a
            href={bill.url}
            target="_blank"
            rel="noopener noreferrer"
            style={linkStyle}
          >
            VIEW ON LEGISLATIVE YUAN WEBSITE
          </a>
        </Panel>
      )}
    </div>
  );
}

export default BillDetail;
