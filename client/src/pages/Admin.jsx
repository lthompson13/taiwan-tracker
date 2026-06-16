import { useState, useEffect } from 'react';
import { useUser } from '@clerk/clerk-react';
import Panel from '../components/Panel';
import Loader from '../components/Loader';

const PURPLE = '#7c3aed';
const PURPLE_BG = '#f5f3ff';
const PURPLE_BORDER = '#ddd6fe';

function fmtDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

function termsFromStr(str) {
  return str.split(',').map((s) => s.trim()).filter(Boolean);
}

const inputStyle = {
  width: '100%',
  padding: '7px 10px',
  border: '1px solid var(--border-default)',
  borderRadius: 'var(--radius-sm)',
  fontSize: '0.875rem',
  boxSizing: 'border-box',
};

const tdStyle = {
  padding: '10px 12px',
  borderBottom: '1px solid var(--border-subtle)',
  fontSize: '0.8rem',
  verticalAlign: 'top',
};

const thStyle = {
  ...tdStyle,
  fontWeight: 700,
  color: 'var(--text-muted)',
  fontSize: '0.75rem',
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
  background: 'var(--bg-subtle)',
};

function btn(variant = 'primary') {
  return {
    padding: '6px 14px',
    border: 'none',
    borderRadius: 'var(--radius-sm)',
    fontSize: '0.8rem',
    fontWeight: 600,
    cursor: 'pointer',
    background:
      variant === 'primary' ? PURPLE
      : variant === 'danger' ? 'var(--danger-bg)'
      : 'var(--bg-subtle)',
    color:
      variant === 'primary' ? 'white'
      : variant === 'danger' ? 'var(--danger)'
      : 'var(--navy)',
  };
}

function Admin() {
  const { isLoaded, isSignedIn, user } = useUser();
  const [tab, setTab] = useState('summaries');

  // Data
  const [summaries, setSummaries] = useState([]);
  const [subscribers, setSubscribers] = useState([]);
  const [syncStatus, setSyncStatus] = useState(null);
  const [loading, setLoading] = useState(true);

  // Summaries — edit existing
  const [editingId, setEditingId] = useState(null);
  const [editText, setEditText] = useState('');
  const [editTermsStr, setEditTermsStr] = useState('');
  const [saving, setSaving] = useState(false);

  // Summaries — generate new
  const [genBillId, setGenBillId] = useState('');
  const [generating, setGenerating] = useState(false);
  const [genDraft, setGenDraft] = useState(null);
  const [genText, setGenText] = useState('');
  const [genTermsStr, setGenTermsStr] = useState('');
  const [genError, setGenError] = useState(null);
  const [genSaving, setGenSaving] = useState(false);

  // Subscribers — add
  const [newEmail, setNewEmail] = useState('');
  const [newName, setNewName] = useState('');
  const [subAdding, setSubAdding] = useState(false);
  const [subError, setSubError] = useState(null);

  // System — sync
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState(null);

  useEffect(() => {
    if (isLoaded && isSignedIn) loadAll();
  }, [isLoaded, isSignedIn]);

  async function loadAll() {
    setLoading(true);
    try {
      const [sR, subR, stR] = await Promise.all([
        fetch('/api/editorial/summaries', { credentials: 'include' }),
        fetch('/api/editorial/subscribers', { credentials: 'include' }),
        fetch('/api/editorial/sync/status', { credentials: 'include' }),
      ]);
      if (sR.ok) setSummaries(await sR.json());
      if (subR.ok) setSubscribers(await subR.json());
      if (stR.ok) setSyncStatus(await stR.json());
    } finally {
      setLoading(false);
    }
  }

  // ── Guards ────────────────────────────────────────────────────────────────

  if (!isLoaded) return <Loader text="Loading" />;
  if (!isSignedIn || user?.publicMetadata?.isAdmin !== true) {
    return (
      <div style={{ padding: '60px 24px', textAlign: 'center', color: 'var(--text-muted)' }}>
        <p style={{ fontSize: '1rem' }}>You don't have permission to access this page.</p>
      </div>
    );
  }

  // ── Summary actions ───────────────────────────────────────────────────────

  function startEdit(s) {
    setEditingId(s.billId);
    setEditText(s.summary);
    setEditTermsStr((s.searchTermsEn || []).join(', '));
  }

  async function saveEdit() {
    setSaving(true);
    try {
      const res = await fetch('/api/editorial/summaries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          billId: editingId,
          summary: editText.trim(),
          searchTerms: termsFromStr(editTermsStr),
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      setSummaries((prev) =>
        prev.map((s) =>
          s.billId === editingId
            ? { ...s, summary: editText.trim(), searchTermsEn: termsFromStr(editTermsStr) }
            : s
        )
      );
      setEditingId(null);
    } catch (err) {
      alert('Save failed: ' + err.message);
    } finally {
      setSaving(false);
    }
  }

  async function deleteSummary(billId) {
    if (!window.confirm(`Delete summary for ${billId}? This cannot be undone.`)) return;
    try {
      const res = await fetch(`/api/editorial/summaries/${encodeURIComponent(billId)}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!res.ok) throw new Error((await res.json()).error);
      setSummaries((prev) => prev.filter((s) => s.billId !== billId));
      if (editingId === billId) setEditingId(null);
    } catch (err) {
      alert('Delete failed: ' + err.message);
    }
  }

  async function generateDraft() {
    const id = genBillId.trim();
    if (!id) return;
    setGenerating(true);
    setGenError(null);
    setGenDraft(null);
    try {
      const res = await fetch('/api/editorial/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ billId: id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setGenDraft(data);
      setGenText(data.draft || '');
      setGenTermsStr((data.searchTerms || []).join(', '));
    } catch (err) {
      setGenError(err.message);
    } finally {
      setGenerating(false);
    }
  }

  async function saveGenerated() {
    setGenSaving(true);
    try {
      const res = await fetch('/api/editorial/summaries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          billId: genDraft.billId,
          summary: genText.trim(),
          searchTerms: termsFromStr(genTermsStr),
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      const sR = await fetch('/api/editorial/summaries', { credentials: 'include' });
      if (sR.ok) setSummaries(await sR.json());
      setGenBillId('');
      setGenDraft(null);
      setGenText('');
      setGenTermsStr('');
    } catch (err) {
      alert('Save failed: ' + err.message);
    } finally {
      setGenSaving(false);
    }
  }

  // ── Subscriber actions ────────────────────────────────────────────────────

  async function addSubscriber(e) {
    e.preventDefault();
    setSubAdding(true);
    setSubError(null);
    try {
      const res = await fetch('/api/editorial/subscribers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email: newEmail.trim(), name: newName.trim() || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setSubscribers((prev) => [data, ...prev]);
      setNewEmail('');
      setNewName('');
    } catch (err) {
      setSubError(err.message);
    } finally {
      setSubAdding(false);
    }
  }

  async function toggleSubscriber(id) {
    try {
      const res = await fetch(`/api/editorial/subscribers/${id}/toggle`, {
        method: 'PATCH',
        credentials: 'include',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setSubscribers((prev) => prev.map((s) => (s.id === id ? data : s)));
    } catch (err) {
      alert('Toggle failed: ' + err.message);
    }
  }

  async function deleteSubscriber(id, email) {
    if (!window.confirm(`Remove ${email} from subscribers?`)) return;
    try {
      const res = await fetch(`/api/editorial/subscribers/${id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!res.ok) throw new Error((await res.json()).error);
      setSubscribers((prev) => prev.filter((s) => s.id !== id));
    } catch (err) {
      alert('Delete failed: ' + err.message);
    }
  }

  // ── System actions ────────────────────────────────────────────────────────

  async function triggerSync() {
    setSyncing(true);
    setSyncMsg(null);
    try {
      const res = await fetch('/api/editorial/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ terms: [11] }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setSyncMsg('Sync started — running in background. Refresh status in a few minutes.');
    } catch (err) {
      setSyncMsg('Error: ' + err.message);
    } finally {
      setSyncing(false);
    }
  }

  async function refreshStats() {
    try {
      const res = await fetch('/api/editorial/sync/status', { credentials: 'include' });
      if (res.ok) setSyncStatus(await res.json());
    } catch {}
  }

  // ── Tab bar style ─────────────────────────────────────────────────────────

  function tabBtn(active) {
    return {
      padding: '7px 18px',
      border: 'none',
      borderBottom: active ? `2px solid ${PURPLE}` : '2px solid transparent',
      background: 'none',
      color: active ? PURPLE : 'var(--text-muted)',
      fontWeight: active ? 700 : 400,
      fontSize: '0.875rem',
      cursor: 'pointer',
      marginBottom: '-1px',
    };
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div>
      {/* Header */}
      <div
        style={{
          marginBottom: '24px',
          paddingBottom: '12px',
          borderBottom: '1px solid var(--border-subtle)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-end',
        }}
      >
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700, margin: 0, color: PURPLE }}>
            Admin Dashboard
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', margin: '4px 0 0 0' }}>
            Editorial tools — summaries, subscribers, and sync
          </p>
        </div>
        {syncStatus && (
          <div style={{ display: 'flex', gap: '24px', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            <span>
              <strong style={{ color: 'var(--navy)' }}>{syncStatus.billCount?.toLocaleString()}</strong> bills
            </span>
            <span>
              <strong style={{ color: 'var(--navy)' }}>{syncStatus.summaryCount}</strong> summaries
            </span>
            <span>
              <strong style={{ color: 'var(--navy)' }}>{syncStatus.subscriberCount}</strong> subscribers
            </span>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div
        style={{
          borderBottom: '1px solid var(--border-subtle)',
          marginBottom: '24px',
          display: 'flex',
          gap: '4px',
        }}
      >
        {[
          { key: 'summaries', label: `Summaries${summaries.length ? ` (${summaries.length})` : ''}` },
          { key: 'subscribers', label: `Subscribers${subscribers.length ? ` (${subscribers.length})` : ''}` },
          { key: 'system', label: 'System' },
        ].map(({ key, label }) => (
          <button key={key} style={tabBtn(tab === key)} onClick={() => setTab(key)}>
            {label}
          </button>
        ))}
      </div>

      {loading && <Loader text="Loading dashboard" />}

      {/* ── SUMMARIES TAB ──────────────────────────────────────────────────── */}
      {!loading && tab === 'summaries' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>

          {/* Generate new */}
          <Panel title="Generate new summary">
            <div style={{ display: 'flex', gap: '10px', marginBottom: '16px' }}>
              <input
                style={{ ...inputStyle, flex: 1, maxWidth: '320px' }}
                placeholder="Bill ID (e.g. 1140LC14756)"
                value={genBillId}
                onChange={(e) => setGenBillId(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && generateDraft()}
              />
              <button
                style={btn('primary')}
                onClick={generateDraft}
                disabled={generating || !genBillId.trim()}
              >
                {generating ? 'Generating…' : 'Generate Draft'}
              </button>
            </div>

            {genError && (
              <div
                style={{
                  padding: '10px 12px',
                  background: 'var(--danger-bg)',
                  color: 'var(--danger)',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: '0.875rem',
                  marginBottom: '12px',
                }}
              >
                {genError}
              </div>
            )}

            {genDraft && (
              <div
                style={{
                  background: PURPLE_BG,
                  border: `1px solid ${PURPLE_BORDER}`,
                  borderRadius: 'var(--radius-md)',
                  padding: '16px',
                }}
              >
                <div
                  style={{
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    color: PURPLE,
                    marginBottom: '10px',
                    textTransform: 'uppercase',
                    letterSpacing: '0.04em',
                  }}
                >
                  Draft — {genDraft.billId}
                </div>
                <textarea
                  style={{ ...inputStyle, minHeight: '100px', resize: 'vertical', marginBottom: '10px', fontFamily: 'inherit' }}
                  value={genText}
                  onChange={(e) => setGenText(e.target.value)}
                />
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '5px' }}>
                  Search terms (comma-separated)
                </div>
                <input
                  style={{ ...inputStyle, marginBottom: '12px' }}
                  value={genTermsStr}
                  onChange={(e) => setGenTermsStr(e.target.value)}
                />
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    style={btn('primary')}
                    onClick={saveGenerated}
                    disabled={genSaving || !genText.trim()}
                  >
                    {genSaving ? 'Saving…' : 'Publish Summary'}
                  </button>
                  <button
                    style={btn('secondary')}
                    onClick={() => { setGenDraft(null); setGenText(''); setGenTermsStr(''); }}
                  >
                    Discard
                  </button>
                </div>
              </div>
            )}
          </Panel>

          {/* Published summaries table */}
          <Panel title={`Published (${summaries.length})`}>
            {summaries.length === 0 ? (
              <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>No summaries published yet.</p>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      <th style={thStyle}>Bill ID</th>
                      <th style={thStyle}>Summary</th>
                      <th style={thStyle}>Search Terms</th>
                      <th style={thStyle}>Updated</th>
                      <th style={thStyle}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {summaries.flatMap((s) => [
                      <tr key={s.billId}>
                        <td style={tdStyle}>
                          <a
                            href={`/bills/${encodeURIComponent(s.billId)}`}
                            style={{ color: 'var(--teal)', textDecoration: 'none', fontWeight: 600, whiteSpace: 'nowrap' }}
                          >
                            {s.billId}
                          </a>
                        </td>
                        <td style={{ ...tdStyle, maxWidth: '340px' }}>
                          <span
                            style={{
                              display: '-webkit-box',
                              WebkitLineClamp: 2,
                              WebkitBoxOrient: 'vertical',
                              overflow: 'hidden',
                            }}
                          >
                            {s.summary}
                          </span>
                        </td>
                        <td style={tdStyle}>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                            {(s.searchTermsEn || []).map((t) => (
                              <span
                                key={t}
                                style={{
                                  padding: '2px 7px',
                                  background: PURPLE_BG,
                                  color: PURPLE,
                                  borderRadius: '999px',
                                  fontSize: '0.72rem',
                                  fontWeight: 600,
                                  whiteSpace: 'nowrap',
                                }}
                              >
                                {t}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td style={{ ...tdStyle, whiteSpace: 'nowrap' }}>{fmtDate(s.updatedAt)}</td>
                        <td style={{ ...tdStyle, whiteSpace: 'nowrap' }}>
                          <div style={{ display: 'flex', gap: '6px' }}>
                            <button
                              style={btn('secondary')}
                              onClick={() =>
                                editingId === s.billId ? setEditingId(null) : startEdit(s)
                              }
                            >
                              {editingId === s.billId ? 'Cancel' : 'Edit'}
                            </button>
                            <button style={btn('danger')} onClick={() => deleteSummary(s.billId)}>
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>,
                      editingId === s.billId ? (
                        <tr key={`${s.billId}-edit`}>
                          <td
                            colSpan={5}
                            style={{ ...tdStyle, background: PURPLE_BG, borderLeft: `3px solid ${PURPLE}` }}
                          >
                            <textarea
                              style={{
                                ...inputStyle,
                                minHeight: '90px',
                                resize: 'vertical',
                                marginBottom: '10px',
                                fontFamily: 'inherit',
                              }}
                              value={editText}
                              onChange={(e) => setEditText(e.target.value)}
                            />
                            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '5px' }}>
                              Search terms (comma-separated)
                            </div>
                            <input
                              style={{ ...inputStyle, marginBottom: '10px' }}
                              value={editTermsStr}
                              onChange={(e) => setEditTermsStr(e.target.value)}
                            />
                            <button style={btn('primary')} onClick={saveEdit} disabled={saving}>
                              {saving ? 'Saving…' : 'Save Changes'}
                            </button>
                          </td>
                        </tr>
                      ) : null,
                    ])}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>
        </div>
      )}

      {/* ── SUBSCRIBERS TAB ───────────────────────────────────────────────── */}
      {!loading && tab === 'subscribers' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <Panel title="Add subscriber">
            <form
              onSubmit={addSubscriber}
              style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'flex-end' }}
            >
              <div style={{ flex: '1 1 220px' }}>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '5px' }}>Email *</div>
                <input
                  style={inputStyle}
                  type="email"
                  placeholder="name@company.com"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  required
                />
              </div>
              <div style={{ flex: '1 1 180px' }}>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '5px' }}>Name (optional)</div>
                <input
                  style={inputStyle}
                  placeholder="Jane Smith"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                />
              </div>
              <button
                type="submit"
                style={{ ...btn('primary'), height: '36px' }}
                disabled={subAdding || !newEmail.trim()}
              >
                {subAdding ? 'Adding…' : 'Add Subscriber'}
              </button>
            </form>
            {subError && (
              <div
                style={{
                  marginTop: '10px',
                  padding: '8px 12px',
                  background: 'var(--danger-bg)',
                  color: 'var(--danger)',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: '0.875rem',
                }}
              >
                {subError}
              </div>
            )}
          </Panel>

          <Panel title={`Subscribers (${subscribers.length})`}>
            {subscribers.length === 0 ? (
              <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>No subscribers yet.</p>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th style={thStyle}>Email</th>
                    <th style={thStyle}>Name</th>
                    <th style={thStyle}>Status</th>
                    <th style={thStyle}>Added</th>
                    <th style={thStyle}></th>
                  </tr>
                </thead>
                <tbody>
                  {subscribers.map((sub) => (
                    <tr key={sub.id}>
                      <td style={tdStyle}>{sub.email}</td>
                      <td style={tdStyle}>{sub.name || '—'}</td>
                      <td style={tdStyle}>
                        <button
                          onClick={() => toggleSubscriber(sub.id)}
                          style={{
                            padding: '3px 10px',
                            borderRadius: '999px',
                            border: 'none',
                            fontSize: '0.75rem',
                            fontWeight: 700,
                            cursor: 'pointer',
                            background: sub.active ? '#dcfce7' : '#fee2e2',
                            color: sub.active ? '#15803d' : '#b91c1c',
                          }}
                        >
                          {sub.active ? 'Active' : 'Inactive'}
                        </button>
                      </td>
                      <td style={{ ...tdStyle, whiteSpace: 'nowrap' }}>{fmtDate(sub.createdAt)}</td>
                      <td style={tdStyle}>
                        <button style={btn('danger')} onClick={() => deleteSubscriber(sub.id, sub.email)}>
                          Remove
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Panel>
        </div>
      )}

      {/* ── SYSTEM TAB ────────────────────────────────────────────────────── */}
      {!loading && tab === 'system' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <Panel title="Archive statistics">
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
                gap: '16px',
                marginBottom: '16px',
              }}
            >
              {[
                { label: 'Bills in archive', value: syncStatus?.billCount?.toLocaleString() ?? '—' },
                { label: 'Published summaries', value: syncStatus?.summaryCount ?? '—' },
                { label: 'Active subscribers', value: syncStatus?.subscriberCount ?? '—' },
                { label: 'Last synced', value: fmtDate(syncStatus?.lastSyncedAt) },
              ].map(({ label, value }) => (
                <div
                  key={label}
                  style={{
                    padding: '16px',
                    background: 'var(--bg-subtle)',
                    borderRadius: 'var(--radius-md)',
                    textAlign: 'center',
                  }}
                >
                  <div style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--navy)', lineHeight: 1 }}>
                    {value}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '6px' }}>
                    {label}
                  </div>
                </div>
              ))}
            </div>
            <button style={{ ...btn('secondary'), fontSize: '0.8rem' }} onClick={refreshStats}>
              Refresh stats
            </button>
          </Panel>

          <Panel title="Bill sync">
            <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', margin: '0 0 16px 0' }}>
              Pulls recent bills from the Legislative Yuan API for Term 11. Runs in the background
              — takes several minutes to complete.
            </p>
            <button style={btn('primary')} onClick={triggerSync} disabled={syncing}>
              {syncing ? 'Starting…' : 'Sync Term 11 bills'}
            </button>
            {syncMsg && (
              <div
                style={{
                  marginTop: '12px',
                  padding: '10px 14px',
                  background: syncMsg.startsWith('Error') ? 'var(--danger-bg)' : '#f0fdf4',
                  color: syncMsg.startsWith('Error') ? 'var(--danger)' : '#15803d',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: '0.875rem',
                }}
              >
                {syncMsg}
              </div>
            )}
          </Panel>
        </div>
      )}
    </div>
  );
}

export default Admin;
