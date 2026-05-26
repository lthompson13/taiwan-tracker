import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Panel from '../components/Panel';
import StatusBadge from '../components/StatusBadge';
import Loader from '../components/Loader';

function getStatusBadgeType(status) {
  if (!status) return 'default';
  if (status === 'Third Reading (Passed)') return 'success';
  if (status === 'Scheduled for Plenary' || status === 'Scheduled for Plenary (Discussion)') return 'warning';
  if (status === 'Review Complete' || status === 'Review Complete (Overdue)') return 'info';
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
  flexShrink: 0,
};

const infoValueStyle = {
  color: 'var(--text-primary)',
  fontSize: '0.9rem',
  textAlign: 'right',
  wordBreak: 'break-word',
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

const linkStyle = {
  color: 'var(--teal)',
  fontSize: '0.9rem',
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
        setError('Failed to load bill: ' + err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchBill();
  }, [id]);

  if (loading) return <Loader text="Loading bill" />;

  if (error) {
    return (
      <div>
        <button style={backButtonStyle} onClick={() => navigate(-1)}>&larr; Back to bills</button>
        <div style={{ padding: '12px 14px', background: 'var(--danger-bg)', color: 'var(--danger)', borderRadius: 'var(--radius-md)', fontSize: '0.875rem' }}>
          {error}
        </div>
      </div>
    );
  }

  if (!bill) {
    return <div style={{ padding: '24px', color: 'var(--text-muted)' }}>No record found.</div>;
  }

  const attachments = Array.isArray(bill.attachments) ? bill.attachments : [];
  const lawNames = Array.isArray(bill.lawNames) ? bill.lawNames : (bill.lawNames ? [bill.lawNames] : []);

  return (
    <div>
      <button style={backButtonStyle} onClick={() => navigate(-1)}>&larr; Back to bills</button>

      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 700, margin: '0 0 12px 0', lineHeight: 1.3 }}>
          {bill.billName || 'Untitled bill'}
        </h1>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {bill.status && <StatusBadge label={bill.status} type={getStatusBadgeType(bill.status)} />}
          {bill.category && <StatusBadge label={bill.category} type="info" />}
          {Array.isArray(bill.sectors) && bill.sectors.map((s) => (
            <StatusBadge key={s} label={s} type="sector" />
          ))}
        </div>
      </div>

      {bill.summary && (
        <div style={{
          background: 'var(--navy-light)',
          border: '1px solid var(--navy)',
          borderLeft: '4px solid var(--navy)',
          borderRadius: 'var(--radius-md)',
          padding: '16px 20px',
          marginBottom: '20px',
        }}>
          <div style={{
            fontSize: '0.7rem',
            fontWeight: 700,
            color: 'var(--navy)',
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            marginBottom: '8px',
          }}>
            Why It Matters
          </div>
          <p style={{
            color: 'var(--text-primary)',
            fontSize: '0.925rem',
            lineHeight: 1.65,
            margin: 0,
          }}>
            {bill.summary.summary}
          </p>
          {bill.summary.updatedAt && (
            <div style={{ marginTop: '10px', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              Updated {bill.summary.updatedAt}
            </div>
          )}
        </div>
      )}

      <Panel title="Bill details">
        <div style={infoRowStyle}><span style={infoLabelStyle}>Proposer</span><span style={infoValueStyle}>{bill.proposer || '—'}</span></div>
        <div style={infoRowStyle}><span style={infoLabelStyle}>Source</span><span style={infoValueStyle}>{bill.source || '—'}</span></div>
        <div style={infoRowStyle}><span style={infoLabelStyle}>Session / Term</span><span style={infoValueStyle}>{bill.session || '—'} / Term {bill.term || '—'}</span></div>
        <div style={infoRowStyle}><span style={infoLabelStyle}>Reference number</span><span style={infoValueStyle}>{bill.referenceNumber || '—'}</span></div>
        <div style={infoRowStyle}><span style={infoLabelStyle}>Proposal number</span><span style={infoValueStyle}>{bill.proposalNumber || '—'}</span></div>
        <div style={infoRowStyle}><span style={infoLabelStyle}>Latest progress date</span><span style={infoValueStyle}>{bill.latestProgressDate || '—'}</span></div>
        {bill.meetingDescription && (
          <div style={infoRowStyle}><span style={infoLabelStyle}>Meeting</span><span style={infoValueStyle}>{bill.meetingDescription}</span></div>
        )}
        <div style={{ ...infoRowStyle, borderBottom: 'none' }}><span style={infoLabelStyle}>Bill ID</span><span style={{ ...infoValueStyle, color: 'var(--text-muted)' }}>{bill.billId || '—'}</span></div>
      </Panel>

      {lawNames.length > 0 && (
        <Panel title="Related laws">
          {lawNames.map((name, idx) => (
            <div key={idx} style={{
              padding: '8px 0',
              borderBottom: idx < lawNames.length - 1 ? '1px solid var(--border-subtle)' : 'none',
              color: 'var(--text-primary)',
              fontSize: '0.9rem',
            }}>
              <span style={{ color: 'var(--text-muted)', marginRight: '8px' }}>{idx + 1}.</span> {name}
            </div>
          ))}
        </Panel>
      )}

      {attachments.length > 0 && (
        <Panel title="Attachments">
          {attachments.map((att, idx) => (
            <div key={idx} style={{
              padding: '8px 0',
              borderBottom: idx < attachments.length - 1 ? '1px solid var(--border-subtle)' : 'none',
            }}>
              <a href={att.url} target="_blank" rel="noopener noreferrer" style={linkStyle}>
                {att.name || `Attachment ${idx + 1}`}
              </a>
            </div>
          ))}
        </Panel>
      )}

      {bill.url && (
        <Panel title="External source">
          <a href={bill.url} target="_blank" rel="noopener noreferrer" style={linkStyle}>
            View on Legislative Yuan website
          </a>
        </Panel>
      )}
    </div>
  );
}

export default BillDetail;
