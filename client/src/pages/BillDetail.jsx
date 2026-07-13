import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth, useUser, SignInButton } from '@clerk/clerk-react';
import { useSubscription } from '../hooks/useSubscription';
import Panel from '../components/Panel';
import StatusBadge from '../components/StatusBadge';
import Loader from '../components/Loader';

// ─── Status Timeline ──────────────────────────────────────────────────────────

const STAGES = [
  { key: 'submitted',  label: 'Submitted'        },
  { key: 'committee',  label: 'In Committee'      },
  { key: 'complete',   label: 'Review Complete'   },
  { key: 'scheduled',  label: 'Plenary Scheduled' },
  { key: 'passed',     label: 'Third Reading'     },
];

function getStageIndex(status) {
  if (!status) return 1;
  if (status === 'Third Reading (Passed)') return 4;
  if (status.startsWith('Scheduled for Plenary')) return 3;
  if (status.startsWith('Review Complete')) return 2;
  return 1; // default: in committee
}

function StatusTimeline({ status, latestDate }) {
  const N = 15; // notch depth (px)
  const currentIndex = getStageIndex(status);
  const isPassed = status === 'Third Reading (Passed)';

  return (
    <div style={{ display: 'flex', marginBottom: '28px' }}>
      {STAGES.map((stage, i) => {
        const isFirst   = i === 0;
        const isLast    = i === STAGES.length - 1;
        const reached   = i <= currentIndex;
        const isCurrent = i === currentIndex;

        const clipPath = isFirst
          ? `polygon(0 0, calc(100% - ${N}px) 0, 100% 50%, calc(100% - ${N}px) 100%, 0 100%)`
          : isLast
            ? `polygon(${N}px 0, 100% 0, 100% 100%, ${N}px 100%, 0 50%)`
            : `polygon(${N}px 0, calc(100% - ${N}px) 0, 100% 50%, calc(100% - ${N}px) 100%, ${N}px 100%, 0 50%)`;

        let bg, fg;
        if (!reached)              { bg = '#dde3ea';        fg = '#8896a3'; }
        else if (isCurrent && isPassed) { bg = '#15803d';   fg = 'white';   }
        else if (isCurrent)        { bg = 'var(--teal)';    fg = 'white';   }
        else                       { bg = 'var(--navy)';    fg = 'white';   }

        return (
          <div
            key={stage.key}
            style={{
              flex: 1,
              clipPath,
              background: bg,
              color: fg,
              paddingTop: '10px',
              paddingBottom: '10px',
              paddingLeft:  isFirst ? '10px' : `${N + 8}px`,
              paddingRight: isLast  ? '10px' : `${N + 8}px`,
              textAlign: 'center',
              fontSize: '0.68rem',
              fontWeight: reached ? 700 : 400,
              lineHeight: 1.3,
              marginLeft: i > 0 ? '-1px' : 0,
            }}
          >
            <div>{stage.label}</div>
            {isCurrent && latestDate && (
              <div style={{ fontSize: '0.6rem', marginTop: '3px', opacity: 0.88 }}>
                {latestDate}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Shared styles ────────────────────────────────────────────────────────────

const infoRowStyle = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'flex-start',
  padding: '10px 0',
  borderBottom: '1px solid var(--border-subtle)',
  gap: '16px',
};
const infoLabelStyle = {
  color: 'var(--text-muted)',
  fontSize: '0.8rem',
  fontWeight: 500,
  flexShrink: 0,
  paddingTop: '1px',
};
const infoValueStyle = {
  color: 'var(--text-primary)',
  fontSize: '0.875rem',
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
  fontSize: '0.875rem',
  textDecoration: 'none',
};

const TABS = ['Summary', 'Actions', 'Documents', 'Committees'];

// ─── Main component ───────────────────────────────────────────────────────────

function BillDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { isSignedIn } = useAuth();
  const { user } = useUser();
  const { isSubscribed } = useSubscription();
  const isAdmin = user?.publicMetadata?.isAdmin === true;

  const [bill, setBill]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);
  const [activeTab, setActiveTab] = useState('Summary');

  // User annotations
  const [annotation, setAnnotation] = useState({ watching: false, stance: null, priority: null, note: '' });
  const [noteInput, setNoteInput]   = useState('');
  const [savingNote, setSavingNote] = useState(false);

  // Editorial (admin-only) — AI draft generation
  const [editorialText, setEditorialText]         = useState('');
  const [editorialSearchTerms, setEditorialSearchTerms] = useState([]);
  const [editorialLoading, setEditorialLoading]   = useState(false);
  const [editorialError, setEditorialError]       = useState(null);
  const [editorialSaved, setEditorialSaved]       = useState(false);

  // User-triggered AI summary generation (Pro)
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryError, setSummaryError]     = useState(null);

  // Tags (Pro)
  const [allTags, setAllTags]       = useState([]);
  const [billTags, setBillTags]     = useState([]);
  const [tagInput, setTagInput]     = useState('');
  const [showNewTag, setShowNewTag] = useState(false);
  const [tagLoading, setTagLoading] = useState(false);

  // Lists (Pro)
  const [allLists, setAllLists]           = useState([]);
  const [listLoading, setListLoading]     = useState(false);
  const [showNewList, setShowNewList]     = useState(false);
  const [newListName, setNewListName]     = useState('');
  const [creatingList, setCreatingList]   = useState(false);

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

  useEffect(() => {
    if (!isSignedIn || !id) return;
    fetch(`/api/user/bills/${encodeURIComponent(id)}`, { credentials: 'include' })
      .then((r) => r.json())
      .then((data) => {
        if (data) {
          setAnnotation(data);
          setNoteInput(data.note || '');
        }
      })
      .catch(() => {});
  }, [isSignedIn, id]);

  useEffect(() => {
    if (!isSignedIn || !id) return;
    Promise.all([
      fetch('/api/user/tags', { credentials: 'include' }).then((r) => r.ok ? r.json() : []),
      fetch(`/api/user/tags/bills/${encodeURIComponent(id)}`, { credentials: 'include' }).then((r) => r.ok ? r.json() : []),
    ]).then(([tags, applied]) => {
      setAllTags(Array.isArray(tags) ? tags : []);
      setBillTags(Array.isArray(applied) ? applied : []);
    }).catch(() => {});
  }, [isSignedIn, id]);

  useEffect(() => {
    if (!isSignedIn || !id) return;
    setListLoading(true);
    fetch(`/api/user/lists?billId=${encodeURIComponent(id)}`, { credentials: 'include' })
      .then((r) => r.ok ? r.json() : [])
      .then((data) => setAllLists(Array.isArray(data) ? data : []))
      .catch(() => {})
      .finally(() => setListLoading(false));
  }, [isSignedIn, id]);

  const handleGenerateDraft = async () => {
    setEditorialLoading(true);
    setEditorialError(null);
    setEditorialSaved(false);
    try {
      const res = await fetch('/api/editorial/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          billId: bill.billId,
          meta: {
            sectors:  bill.sectors,
            category: bill.category,
            status:   bill.status,
          },
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      setEditorialText(data.draft);
      setEditorialSearchTerms(Array.isArray(data.searchTerms) ? data.searchTerms : []);
    } catch (err) {
      setEditorialError('Generation failed: ' + err.message);
    } finally {
      setEditorialLoading(false);
    }
  };

  const handleSaveEditorial = async () => {
    if (!editorialText.trim()) return;
    setEditorialLoading(true);
    setEditorialError(null);
    try {
      const res = await fetch('/api/editorial/summaries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ billId: bill.billId, summary: editorialText.trim(), searchTerms: editorialSearchTerms }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      setEditorialSaved(true);
      // Refresh the bill so the new summary shows in the Why It Matters panel
      setBill((b) => ({ ...b, summary: { summary: editorialText.trim(), updatedAt: new Date().toISOString().slice(0, 10) } }));
    } catch (err) {
      setEditorialError('Save failed: ' + err.message);
    } finally {
      setEditorialLoading(false);
    }
  };

  const handleDeleteEditorial = async () => {
    if (!window.confirm('Delete this summary?')) return;
    setEditorialLoading(true);
    setEditorialError(null);
    try {
      const res = await fetch(`/api/editorial/summaries/${encodeURIComponent(bill.billId)}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || `HTTP ${res.status}`);
      }
      setEditorialText('');
      setEditorialSaved(false);
      setBill((b) => ({ ...b, summary: undefined }));
    } catch (err) {
      setEditorialError('Delete failed: ' + err.message);
    } finally {
      setEditorialLoading(false);
    }
  };

  const handleGenerateUserSummary = async () => {
    setSummaryLoading(true);
    setSummaryError(null);
    try {
      const res = await fetch(`/api/user/summaries/${encodeURIComponent(bill.billId)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          sectors:  bill.sectors,
          category: bill.category,
          status:   bill.status,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      setBill((b) => ({
        ...b,
        summary: { summary: data.summary, updatedAt: new Date().toISOString().slice(0, 10) },
      }));
    } catch (err) {
      setSummaryError('Generation failed: ' + err.message);
    } finally {
      setSummaryLoading(false);
    }
  };

  const handleToggleTag = async (tag) => {
    const applied = billTags.some((t) => t.id === tag.id);
    setTagLoading(true);
    try {
      const method = applied ? 'DELETE' : 'POST';
      await fetch(`/api/user/tags/bills/${encodeURIComponent(id)}/${tag.id}`, { method, credentials: 'include' });
      setBillTags((prev) => applied ? prev.filter((t) => t.id !== tag.id) : [...prev, tag].sort((a, b) => a.name.localeCompare(b.name)));
    } catch (err) {
      console.error('[tags] toggle error:', err.message);
    } finally {
      setTagLoading(false);
    }
  };

  const handleCreateTag = async () => {
    const name = tagInput.trim();
    if (!name) return;
    setTagLoading(true);
    try {
      const res = await fetch('/api/user/tags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ name }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      const newTag = data;
      setAllTags((prev) => [...prev, newTag].sort((a, b) => a.name.localeCompare(b.name)));
      // Auto-apply to this bill
      await fetch(`/api/user/tags/bills/${encodeURIComponent(id)}/${newTag.id}`, { method: 'POST', credentials: 'include' });
      setBillTags((prev) => [...prev, newTag].sort((a, b) => a.name.localeCompare(b.name)));
      setTagInput('');
      setShowNewTag(false);
    } catch (err) {
      console.error('[tags] create error:', err.message);
    } finally {
      setTagLoading(false);
    }
  };

  const handleToggleList = async (listItem) => {
    const inList = listItem.hasBill;
    try {
      const method = inList ? 'DELETE' : 'POST';
      await fetch(`/api/user/lists/${listItem.id}/bills/${encodeURIComponent(id)}`, { method, credentials: 'include' });
      setAllLists((prev) => prev.map((l) => l.id === listItem.id ? { ...l, hasBill: !inList } : l));
    } catch (err) {
      console.error('[lists] toggle error:', err.message);
    }
  };

  const handleCreateList = async () => {
    const name = newListName.trim();
    if (!name) return;
    setCreatingList(true);
    try {
      const res = await fetch('/api/user/lists', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ name }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      // Add bill to new list immediately
      await fetch(`/api/user/lists/${data.id}/bills/${encodeURIComponent(id)}`, { method: 'POST', credentials: 'include' });
      setAllLists((prev) => [...prev, { ...data, hasBill: true }].sort((a, b) => a.name.localeCompare(b.name)));
      setNewListName('');
      setShowNewList(false);
    } catch (err) {
      console.error('[lists] create error:', err.message);
    } finally {
      setCreatingList(false);
    }
  };

  const updateAnnotation = useCallback(async (patch) => {
    if (!isSignedIn) return;
    try {
      const res = await fetch(`/api/user/bills/${encodeURIComponent(id)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(patch),
      });
      if (res.ok) {
        const updated = await res.json();
        setAnnotation(updated);
      } else {
        console.error('[annotation] save failed:', res.status, await res.text());
      }
    } catch (err) {
      console.error('[annotation] save error:', err.message);
    }
  }, [isSignedIn, id]);

  const handleStance = (stance) => {
    const newStance = annotation.stance === stance ? null : stance;
    setAnnotation((a) => ({ ...a, stance: newStance }));
    updateAnnotation({ stance: newStance });
  };
  const handlePriority = (priority) => {
    const newPriority = annotation.priority === priority ? null : priority;
    setAnnotation((a) => ({ ...a, priority: newPriority }));
    updateAnnotation({ priority: newPriority });
  };
  const handleWatching = () => {
    const newWatching = !annotation.watching;
    setAnnotation((a) => ({ ...a, watching: newWatching }));
    updateAnnotation({ watching: newWatching });
  };
  const handleSaveNote = async () => {
    setSavingNote(true);
    await updateAnnotation({ note: noteInput });
    setSavingNote(false);
  };

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
  const lawNames    = Array.isArray(bill.lawNames) ? bill.lawNames : (bill.lawNames ? [bill.lawNames] : []);

  return (
    <div>
      <button style={backButtonStyle} onClick={() => navigate(-1)}>&larr; Back to bills</button>

      {/* ── Bill header ── */}
      <div style={{ marginBottom: '20px' }}>
        <h1 style={{ fontSize: '1.4rem', fontWeight: 700, margin: '0 0 8px 0', lineHeight: 1.3 }}>
          {bill.billName || 'Untitled bill'}
        </h1>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
          {bill.term    && <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Term {bill.term}</span>}
          {bill.session && <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>· Session {bill.session}</span>}
          {bill.category && (
            <>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>·</span>
              <StatusBadge label={bill.category} type="info" />
            </>
          )}
          {Array.isArray(bill.sectors) && bill.sectors.map((s) => (
            <StatusBadge key={s} label={s} type="sector" />
          ))}
        </div>
      </div>

      {/* ── Annotation / tracking panel (always visible) ── */}
      {!isSignedIn ? (
        <div style={{ border: '1px solid var(--border-default)', borderRadius: 'var(--radius-md)', padding: '14px 20px', marginBottom: '20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--bg-subtle)' }}>
          <span style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>Sign in to track this bill, add notes, and set priority</span>
          <SignInButton mode="modal">
            <button style={{ padding: '6px 14px', background: 'var(--navy)', color: 'white', border: 'none', borderRadius: 'var(--radius-sm)', fontSize: '0.825rem', fontWeight: 500, cursor: 'pointer' }}>
              Sign in →
            </button>
          </SignInButton>
        </div>
      ) : !isSubscribed ? (
        <div style={{ border: '1px solid var(--border-default)', borderRadius: 'var(--radius-md)', padding: '14px 20px', marginBottom: '20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--bg-subtle)' }}>
          <span style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>Pro subscribers can track this bill, add notes, and set priority</span>
          <button onClick={() => navigate('/upgrade')} style={{ padding: '6px 14px', background: 'var(--navy)', color: 'white', border: 'none', borderRadius: 'var(--radius-sm)', fontSize: '0.825rem', fontWeight: 500, cursor: 'pointer', whiteSpace: 'nowrap' }}>
            Upgrade to Pro →
          </button>
        </div>
      ) : (
        <div style={{ border: '1px solid var(--border-default)', borderRadius: 'var(--radius-md)', padding: '16px 20px', marginBottom: '20px', background: 'var(--bg-subtle)' }}>
          <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '14px' }}>
            Your Tracking
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '20px', marginBottom: '14px', alignItems: 'center' }}>
            {/* Watch */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 500 }}>Watch:</span>
              <button onClick={handleWatching} title={annotation.watching ? 'Unwatch' : 'Watch this bill'} style={{ fontSize: '1.1rem', background: annotation.watching ? 'var(--navy-light)' : 'transparent', border: `1px solid ${annotation.watching ? 'var(--navy)' : 'var(--border-default)'}`, borderRadius: 'var(--radius-sm)', padding: '4px 10px', cursor: 'pointer', color: annotation.watching ? 'var(--navy)' : 'var(--text-muted)' }}>
                👁
              </button>
            </div>
            {/* Stance */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 500 }}>Stance:</span>
              {[
                { value: 'support', icon: '👍', activeColor: '#15803d', activeBg: '#dcfce7' },
                { value: 'oppose',  icon: '👎', activeColor: '#b91c1c', activeBg: '#fee2e2' },
                { value: 'monitor', icon: '👁',  activeColor: 'var(--teal)', activeBg: 'var(--teal-light)' },
              ].map(({ value, icon, activeColor, activeBg }) => (
                <button key={value} onClick={() => handleStance(value)} title={value.charAt(0).toUpperCase() + value.slice(1)} style={{ fontSize: '1.1rem', background: annotation.stance === value ? activeBg : 'transparent', border: `1px solid ${annotation.stance === value ? activeColor : 'var(--border-default)'}`, borderRadius: 'var(--radius-sm)', padding: '4px 10px', cursor: 'pointer', color: annotation.stance === value ? activeColor : 'var(--text-muted)' }}>
                  {icon}
                </button>
              ))}
            </div>
            {/* Priority */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 500 }}>Priority:</span>
              {[
                { value: 'high',   label: 'High', activeColor: '#b91c1c', activeBg: '#fee2e2' },
                { value: 'medium', label: 'Med',  activeColor: '#b45309', activeBg: '#fef3c7' },
                { value: 'low',    label: 'Low',  activeColor: '#15803d', activeBg: '#dcfce7' },
              ].map(({ value, label, activeColor, activeBg }) => (
                <button key={value} onClick={() => handlePriority(value)} style={{ fontSize: '0.775rem', fontWeight: 600, background: annotation.priority === value ? activeBg : 'transparent', border: `1px solid ${annotation.priority === value ? activeColor : 'var(--border-default)'}`, borderRadius: 'var(--radius-sm)', padding: '4px 10px', cursor: 'pointer', color: annotation.priority === value ? activeColor : 'var(--text-muted)' }}>
                  {label}
                </button>
              ))}
            </div>
          </div>
          {/* Note */}
          <div>
            <textarea value={noteInput} onChange={(e) => setNoteInput(e.target.value)} placeholder="Add a note…" rows={2} style={{ width: '100%', padding: '8px 10px', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-sm)', fontSize: '0.875rem', color: 'var(--text-primary)', background: 'var(--bg-elevated)', resize: 'vertical', fontFamily: 'var(--font-sans)', boxSizing: 'border-box' }} />
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '6px' }}>
              <button onClick={handleSaveNote} disabled={savingNote || noteInput === (annotation.note || '')} style={{ padding: '5px 14px', background: 'var(--navy)', color: 'white', border: 'none', borderRadius: 'var(--radius-sm)', fontSize: '0.8rem', fontWeight: 500, cursor: savingNote || noteInput === (annotation.note || '') ? 'not-allowed' : 'pointer', opacity: savingNote || noteInput === (annotation.note || '') ? 0.5 : 1 }}>
                {savingNote ? 'Saving…' : 'Save note'}
              </button>
            </div>
          </div>

          {/* Tags */}
          <div style={{ marginTop: '14px', paddingTop: '12px', borderTop: '1px solid var(--border-subtle)' }}>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 500, marginBottom: '8px' }}>Tags</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', alignItems: 'center' }}>
              {/* Applied tags — click to remove */}
              {billTags.map((tag) => (
                <button
                  key={tag.id}
                  onClick={() => handleToggleTag(tag)}
                  disabled={tagLoading}
                  title="Click to remove"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '3px 10px', borderRadius: '999px', border: '1px solid var(--navy)', background: 'var(--navy-light)', color: 'var(--navy)', fontSize: '0.775rem', fontWeight: 600, cursor: 'pointer' }}
                >
                  {tag.name} <span style={{ fontSize: '0.9rem', lineHeight: 1 }}>×</span>
                </button>
              ))}

              {/* Unapplied tags — click to apply */}
              {allTags.filter((t) => !billTags.some((bt) => bt.id === t.id)).map((tag) => (
                <button
                  key={tag.id}
                  onClick={() => handleToggleTag(tag)}
                  disabled={tagLoading}
                  title="Click to apply"
                  style={{ padding: '3px 10px', borderRadius: '999px', border: '1px solid var(--border-default)', background: 'transparent', color: 'var(--text-muted)', fontSize: '0.775rem', cursor: 'pointer' }}
                >
                  {tag.name}
                </button>
              ))}

              {/* Create new tag inline */}
              {showNewTag ? (
                <div style={{ display: 'flex', gap: '5px', alignItems: 'center' }}>
                  <input
                    autoFocus
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleCreateTag(); if (e.key === 'Escape') { setShowNewTag(false); setTagInput(''); } }}
                    placeholder="Tag name…"
                    style={{ padding: '3px 8px', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-sm)', fontSize: '0.775rem', width: '110px' }}
                  />
                  <button onClick={handleCreateTag} disabled={tagLoading || !tagInput.trim()} style={{ padding: '3px 10px', borderRadius: 'var(--radius-sm)', border: 'none', background: 'var(--navy)', color: 'white', fontSize: '0.775rem', fontWeight: 600, cursor: 'pointer' }}>
                    Create
                  </button>
                  <button onClick={() => { setShowNewTag(false); setTagInput(''); }} style={{ padding: '3px 8px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-default)', background: 'transparent', color: 'var(--text-muted)', fontSize: '0.775rem', cursor: 'pointer' }}>
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setShowNewTag(true)}
                  style={{ padding: '3px 10px', borderRadius: '999px', border: '1px dashed var(--border-default)', background: 'transparent', color: 'var(--text-muted)', fontSize: '0.775rem', cursor: 'pointer' }}
                >
                  + New tag
                </button>
              )}
            </div>
          </div>

          {/* Lists */}
          <div style={{ marginTop: '14px', paddingTop: '12px', borderTop: '1px solid var(--border-subtle)' }}>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 500, marginBottom: '8px' }}>Lists</div>
            {listLoading ? (
              <span style={{ fontSize: '0.775rem', color: 'var(--text-muted)' }}>Loading…</span>
            ) : (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', alignItems: 'center' }}>
                {/* Lists containing this bill — click to remove */}
                {allLists.filter((l) => l.hasBill).map((l) => (
                  <button
                    key={l.id}
                    onClick={() => handleToggleList(l)}
                    title="Click to remove from list"
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '3px 10px', borderRadius: '999px', border: '1px solid var(--navy)', background: 'var(--navy-light)', color: 'var(--navy)', fontSize: '0.775rem', fontWeight: 600, cursor: 'pointer' }}
                  >
                    {l.name} <span style={{ fontSize: '0.9rem', lineHeight: 1 }}>×</span>
                  </button>
                ))}

                {/* Lists not containing this bill — click to add */}
                {allLists.filter((l) => !l.hasBill).map((l) => (
                  <button
                    key={l.id}
                    onClick={() => handleToggleList(l)}
                    title="Click to add to list"
                    style={{ padding: '3px 10px', borderRadius: '999px', border: '1px solid var(--border-default)', background: 'transparent', color: 'var(--text-muted)', fontSize: '0.775rem', cursor: 'pointer' }}
                  >
                    {l.name}
                  </button>
                ))}

                {/* Create new list inline */}
                {showNewList ? (
                  <div style={{ display: 'flex', gap: '5px', alignItems: 'center' }}>
                    <input
                      autoFocus
                      value={newListName}
                      onChange={(e) => setNewListName(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') handleCreateList(); if (e.key === 'Escape') { setShowNewList(false); setNewListName(''); } }}
                      placeholder="List name…"
                      style={{ padding: '3px 8px', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-sm)', fontSize: '0.775rem', width: '120px' }}
                    />
                    <button onClick={handleCreateList} disabled={creatingList || !newListName.trim()} style={{ padding: '3px 10px', borderRadius: 'var(--radius-sm)', border: 'none', background: 'var(--navy)', color: 'white', fontSize: '0.775rem', fontWeight: 600, cursor: 'pointer' }}>
                      {creatingList ? '…' : 'Create'}
                    </button>
                    <button onClick={() => { setShowNewList(false); setNewListName(''); }} style={{ padding: '3px 8px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-default)', background: 'transparent', color: 'var(--text-muted)', fontSize: '0.775rem', cursor: 'pointer' }}>
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setShowNewList(true)}
                    style={{ padding: '3px 10px', borderRadius: '999px', border: '1px dashed var(--border-default)', background: 'transparent', color: 'var(--text-muted)', fontSize: '0.775rem', cursor: 'pointer' }}
                  >
                    + New list
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Tab bar ── */}
      <div style={{ display: 'flex', borderBottom: '2px solid var(--border-default)', marginBottom: '24px' }}>
        {TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              background: 'transparent',
              border: 'none',
              borderBottom: activeTab === tab ? '2px solid var(--navy)' : '2px solid transparent',
              marginBottom: '-2px',
              padding: '10px 18px',
              fontSize: '0.775rem',
              fontWeight: activeTab === tab ? 700 : 400,
              color: activeTab === tab ? 'var(--navy)' : 'var(--text-muted)',
              cursor: 'pointer',
              letterSpacing: '0.05em',
              textTransform: 'uppercase',
              transition: 'color 0.15s',
            }}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* ── Tab: Summary ── */}
      {activeTab === 'Summary' && (
        <div>
          {/* Cross-strait sensitivity alert */}
          {bill.crossStraitFlag && (
            <div style={{
              background: '#fffbeb',
              border: '1px solid #d97706',
              borderLeft: '4px solid #d97706',
              borderRadius: 'var(--radius-md)',
              padding: '12px 16px',
              marginBottom: '20px',
              display: 'flex',
              alignItems: 'flex-start',
              gap: '10px',
            }}>
              <span style={{ fontSize: '1.1rem', lineHeight: 1, flexShrink: 0, marginTop: '1px' }}>⚑</span>
              <div>
                <div style={{ fontSize: '0.68rem', fontWeight: 700, color: '#92400e', letterSpacing: '0.07em', textTransform: 'uppercase', marginBottom: '4px' }}>
                  Cross-Strait Sensitivity
                </div>
                <p style={{ color: '#78350f', fontSize: '0.825rem', margin: 0, lineHeight: 1.45 }}>
                  This bill has been flagged for cross-strait or national security relevance. Monitor for developments that may affect Taiwan–China business relations, investment flows, or market access.
                </p>
              </div>
            </div>
          )}

          {/* Status timeline */}
          <StatusTimeline status={bill.status} latestDate={bill.latestProgressDate} />

          {/* Why It Matters — Pro feature */}
          {bill.summary && !isSubscribed && (
            <div style={{ background: 'var(--navy-light)', border: '1px solid var(--navy)', borderLeft: '4px solid var(--navy)', borderRadius: 'var(--radius-md)', padding: '16px 20px', marginBottom: '20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px' }}>
              <div>
                <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--navy)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '4px' }}>Why It Matters — Pro</div>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', margin: 0 }}>
                  Editorial analysis of this bill's business implications is available to Pro subscribers.
                </p>
              </div>
              <button onClick={() => navigate('/upgrade')} style={{ padding: '6px 14px', background: 'var(--navy)', color: 'white', border: 'none', borderRadius: 'var(--radius-sm)', fontSize: '0.825rem', fontWeight: 500, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                Upgrade →
              </button>
            </div>
          )}

          {bill.summary && isSubscribed && (
            <div style={{ background: 'var(--navy-light)', border: '1px solid var(--navy)', borderLeft: '4px solid var(--navy)', borderRadius: 'var(--radius-md)', padding: '16px 20px', marginBottom: '20px' }}>
              <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--navy)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '8px' }}>
                Why It Matters
              </div>
              <p style={{ color: 'var(--text-primary)', fontSize: '0.925rem', lineHeight: 1.65, margin: 0 }}>
                {bill.summary.summary}
              </p>
              {bill.summary.updatedAt && (
                <div style={{ marginTop: '10px', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  Updated {bill.summary.updatedAt}
                </div>
              )}
            </div>
          )}

          {/* Pro user — generate summary when none exists */}
          {isSubscribed && !isAdmin && !bill.summary && (
            <div style={{ border: '1px solid var(--border-default)', borderRadius: 'var(--radius-md)', padding: '16px 20px', marginBottom: '20px', background: 'var(--bg-subtle)' }}>
              <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '8px' }}>
                Why It Matters
              </div>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', margin: '0 0 14px 0', lineHeight: 1.5 }}>
                No summary has been written for this bill yet. Generate one now using AI.
              </p>
              {summaryError && (
                <div style={{ padding: '8px 12px', background: 'var(--danger-bg)', color: 'var(--danger)', borderRadius: 'var(--radius-sm)', fontSize: '0.825rem', marginBottom: '10px' }}>
                  {summaryError}
                </div>
              )}
              <button
                onClick={handleGenerateUserSummary}
                disabled={summaryLoading}
                style={{ padding: '7px 16px', background: summaryLoading ? 'var(--border-default)' : 'var(--navy)', color: 'white', border: 'none', borderRadius: 'var(--radius-sm)', fontSize: '0.825rem', fontWeight: 600, cursor: summaryLoading ? 'not-allowed' : 'pointer' }}
              >
                {summaryLoading ? 'Generating…' : '✦ Generate AI Summary'}
              </button>
            </div>
          )}

          {/* Admin editorial panel */}
          {isAdmin && (
            <div style={{
              border: '1px solid #7c3aed',
              borderLeft: '4px solid #7c3aed',
              borderRadius: 'var(--radius-md)',
              padding: '16px 20px',
              marginBottom: '20px',
              background: '#faf5ff',
            }}>
              <div style={{ fontSize: '0.68rem', fontWeight: 700, color: '#5b21b6', letterSpacing: '0.07em', textTransform: 'uppercase', marginBottom: '12px' }}>
                Editorial — AI Draft
              </div>

              {editorialError && (
                <div style={{ padding: '8px 12px', background: 'var(--danger-bg)', color: 'var(--danger)', borderRadius: 'var(--radius-sm)', fontSize: '0.825rem', marginBottom: '10px' }}>
                  {editorialError}
                </div>
              )}

              {editorialSaved && (
                <div style={{ padding: '8px 12px', background: '#dcfce7', color: '#15803d', borderRadius: 'var(--radius-sm)', fontSize: '0.825rem', marginBottom: '10px' }}>
                  Saved successfully.
                </div>
              )}

              <textarea
                value={editorialText || (bill.summary?.summary || '')}
                onChange={(e) => { setEditorialText(e.target.value); setEditorialSaved(false); }}
                placeholder="Click 'Generate draft' to create an AI draft, or type a summary directly…"
                rows={5}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  border: '1px solid #c4b5fd',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: '0.875rem',
                  color: 'var(--text-primary)',
                  background: 'white',
                  resize: 'vertical',
                  fontFamily: 'var(--font-sans)',
                  lineHeight: 1.6,
                  boxSizing: 'border-box',
                  marginBottom: '10px',
                }}
              />

              {editorialSearchTerms.length > 0 && (
                <div style={{ marginBottom: '10px', fontSize: '0.775rem', color: '#6d28d9' }}>
                  <span style={{ fontWeight: 600 }}>News search terms: </span>
                  {editorialSearchTerms.join(' · ')}
                </div>
              )}

              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <button
                  onClick={handleGenerateDraft}
                  disabled={editorialLoading}
                  style={{ padding: '6px 14px', background: '#7c3aed', color: 'white', border: 'none', borderRadius: 'var(--radius-sm)', fontSize: '0.8rem', fontWeight: 600, cursor: editorialLoading ? 'not-allowed' : 'pointer', opacity: editorialLoading ? 0.6 : 1 }}
                >
                  {editorialLoading ? 'Working…' : '✦ Generate draft'}
                </button>
                <button
                  onClick={handleSaveEditorial}
                  disabled={editorialLoading || !editorialText.trim()}
                  style={{ padding: '6px 14px', background: 'var(--navy)', color: 'white', border: 'none', borderRadius: 'var(--radius-sm)', fontSize: '0.8rem', fontWeight: 600, cursor: editorialLoading || !editorialText.trim() ? 'not-allowed' : 'pointer', opacity: editorialLoading || !editorialText.trim() ? 0.5 : 1 }}
                >
                  Save
                </button>
                {bill.summary && (
                  <button
                    onClick={handleDeleteEditorial}
                    disabled={editorialLoading}
                    style={{ padding: '6px 14px', background: 'transparent', color: 'var(--danger)', border: '1px solid var(--danger)', borderRadius: 'var(--radius-sm)', fontSize: '0.8rem', fontWeight: 600, cursor: editorialLoading ? 'not-allowed' : 'pointer' }}
                  >
                    Delete
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Key bill facts */}
          <Panel title="Bill information">
            {bill.proposer && (
              <div style={infoRowStyle}>
                <span style={infoLabelStyle}>Proposer</span>
                <span style={infoValueStyle}>{bill.proposer}</span>
              </div>
            )}
            {bill.source && (
              <div style={infoRowStyle}>
                <span style={infoLabelStyle}>Source</span>
                <span style={infoValueStyle}>{bill.source}</span>
              </div>
            )}
            <div style={infoRowStyle}>
              <span style={infoLabelStyle}>Term / Session</span>
              <span style={infoValueStyle}>Term {bill.term || '—'} / Session {bill.session || '—'}</span>
            </div>
            {bill.category && (
              <div style={infoRowStyle}>
                <span style={infoLabelStyle}>Committee</span>
                <span style={infoValueStyle}>{bill.category}</span>
              </div>
            )}
            {Array.isArray(bill.sectors) && bill.sectors.length > 0 && (
              <div style={{ ...infoRowStyle, borderBottom: 'none' }}>
                <span style={infoLabelStyle}>Sectors</span>
                <span style={{ ...infoValueStyle, display: 'flex', gap: '6px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                  {bill.sectors.map((s) => <StatusBadge key={s} label={s} type="sector" />)}
                </span>
              </div>
            )}
          </Panel>
        </div>
      )}

      {/* ── Tab: Actions ── */}
      {activeTab === 'Actions' && (
        <div>
          {/* Current status */}
          <Panel title="Current status">
            <div style={{ ...infoRowStyle }}>
              <span style={infoLabelStyle}>Status</span>
              <span style={infoValueStyle}>
                {bill.status ? (
                  <StatusBadge
                    label={bill.status}
                    type={
                      bill.status === 'Third Reading (Passed)' ? 'success' :
                      bill.status.startsWith('Scheduled for Plenary') ? 'warning' :
                      bill.status.startsWith('Review Complete') ? 'info' : 'default'
                    }
                  />
                ) : '—'}
              </span>
            </div>
            {bill.latestProgressDate && (
              <div style={infoRowStyle}>
                <span style={infoLabelStyle}>Latest progress</span>
                <span style={infoValueStyle}>{bill.latestProgressDate}</span>
              </div>
            )}
            {bill.meetingDescription && (
              <div style={{ ...infoRowStyle, borderBottom: 'none' }}>
                <span style={infoLabelStyle}>Meeting</span>
                <span style={infoValueStyle}>{bill.meetingDescription}</span>
              </div>
            )}
          </Panel>

          {/* Administrative identifiers */}
          <Panel title="Administrative details">
            {bill.referenceNumber && (
              <div style={infoRowStyle}>
                <span style={infoLabelStyle}>Reference number</span>
                <span style={infoValueStyle}>{bill.referenceNumber}</span>
              </div>
            )}
            {bill.proposalNumber && (
              <div style={infoRowStyle}>
                <span style={infoLabelStyle}>Proposal number</span>
                <span style={infoValueStyle}>{bill.proposalNumber}</span>
              </div>
            )}
            <div style={{ ...infoRowStyle, borderBottom: 'none' }}>
              <span style={infoLabelStyle}>Bill ID</span>
              <span style={{ ...infoValueStyle, color: 'var(--text-muted)', fontFamily: 'monospace', fontSize: '0.8rem' }}>{bill.billId || '—'}</span>
            </div>
          </Panel>
        </div>
      )}

      {/* ── Tab: Documents ── */}
      {activeTab === 'Documents' && (
        <div>
          {attachments.length > 0 ? (
            <Panel title={`Attachments (${attachments.length})`}>
              {attachments.map((att, idx) => (
                <div key={idx} style={{ padding: '10px 0', borderBottom: idx < attachments.length - 1 ? '1px solid var(--border-subtle)' : 'none', display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', background: 'var(--bg-subtle)', border: '1px solid var(--border-default)', borderRadius: '3px', padding: '2px 6px', flexShrink: 0 }}>
                    {att.url?.split('.').pop()?.toUpperCase() || 'FILE'}
                  </span>
                  <a href={att.url} target="_blank" rel="noopener noreferrer" style={linkStyle}>
                    {att.name || `Attachment ${idx + 1}`}
                  </a>
                </div>
              ))}
            </Panel>
          ) : (
            <Panel>
              <div style={{ padding: '20px 0', color: 'var(--text-muted)', textAlign: 'center', fontSize: '0.875rem' }}>
                No documents attached to this bill.
              </div>
            </Panel>
          )}

          {lawNames.length > 0 && (
            <Panel title="Related laws">
              {lawNames.map((name, idx) => (
                <div key={idx} style={{ padding: '8px 0', borderBottom: idx < lawNames.length - 1 ? '1px solid var(--border-subtle)' : 'none', color: 'var(--text-primary)', fontSize: '0.875rem' }}>
                  <span style={{ color: 'var(--text-muted)', marginRight: '8px' }}>{idx + 1}.</span>
                  {name}
                </div>
              ))}
            </Panel>
          )}

          {bill.url && (
            <Panel title="External source">
              <a href={bill.url} target="_blank" rel="noopener noreferrer" style={linkStyle}>
                View on Legislative Yuan website →
              </a>
            </Panel>
          )}
        </div>
      )}

      {/* ── Tab: Committees ── */}
      {activeTab === 'Committees' && (
        <div>
          {bill.category ? (
            <Panel title="Committee assignment">
              <div style={{ marginBottom: '16px' }}>
                <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' }}>
                  Assigned Committee
                </div>
                <div style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '12px' }}>
                  {bill.category}
                </div>
                {bill.meetingDescription && (
                  <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: '16px', padding: '10px 14px', background: 'var(--bg-subtle)', borderRadius: 'var(--radius-sm)', borderLeft: '3px solid var(--border-default)' }}>
                    {bill.meetingDescription}
                  </div>
                )}
                <button
                  onClick={() => navigate('/hearings')}
                  style={{ padding: '8px 16px', background: 'transparent', border: '1px solid var(--teal)', borderRadius: 'var(--radius-sm)', color: 'var(--teal)', fontSize: '0.825rem', fontWeight: 600, cursor: 'pointer' }}
                >
                  View committee hearings →
                </button>
              </div>
            </Panel>
          ) : (
            <Panel>
              <div style={{ padding: '20px 0', color: 'var(--text-muted)', textAlign: 'center', fontSize: '0.875rem' }}>
                No committee assignment recorded for this bill.
              </div>
            </Panel>
          )}
        </div>
      )}
    </div>
  );
}

export default BillDetail;
