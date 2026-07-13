import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@clerk/clerk-react';
import Panel from '../components/Panel';
import StatusBadge from '../components/StatusBadge';
import Loader from '../components/Loader';

function fmtDate(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function getStatusBadgeType(status) {
  if (!status) return 'default';
  if (status === 'Third Reading (Passed)') return 'success';
  if (status.startsWith('Scheduled for Plenary')) return 'warning';
  if (status.startsWith('Review Complete')) return 'info';
  return 'default';
}

function ListDetail() {
  const { listId } = useParams();
  const navigate = useNavigate();
  const { isSignedIn } = useAuth();

  const [list, setList] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Inline rename
  const [editingName, setEditingName] = useState(false);
  const [editName, setEditName] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [saving, setSaving] = useState(false);

  // Delete
  const [deleting, setDeleting] = useState(false);

  // Per-bill remove
  const [removing, setRemoving] = useState(null);

  useEffect(() => {
    if (!isSignedIn) { setLoading(false); return; }
    fetch(`/api/user/lists/${listId}`, { credentials: 'include' })
      .then(async (r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((data) => {
        setList(data);
        setEditName(data.name);
        setEditDesc(data.description || '');
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [isSignedIn, listId]);

  const handleSaveRename = async () => {
    const name = editName.trim();
    if (!name || name === list.name && editDesc.trim() === (list.description || '')) {
      setEditingName(false);
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/user/lists/${listId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ name, description: editDesc.trim() || null }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setList((l) => ({ ...l, name, description: editDesc.trim() || null }));
      setEditingName(false);
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm(`Delete list "${list.name}"? This cannot be undone.`)) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/user/lists/${listId}`, { method: 'DELETE', credentials: 'include' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      navigate('/lists');
    } catch (err) {
      console.error(err);
      setDeleting(false);
    }
  };

  const handleRemoveBill = async (billId) => {
    setRemoving(billId);
    try {
      const res = await fetch(`/api/user/lists/${listId}/bills/${encodeURIComponent(billId)}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setList((l) => ({ ...l, items: l.items.filter((i) => i.billId !== billId) }));
    } catch (err) {
      console.error(err);
    } finally {
      setRemoving(null);
    }
  };

  if (loading) return <Loader text="Loading list" />;

  if (!isSignedIn) {
    return <div style={{ padding: '40px 0', textAlign: 'center', color: 'var(--text-muted)' }}>Sign in to view your lists.</div>;
  }

  if (error) {
    return (
      <div>
        <button onClick={() => navigate('/lists')} style={{ background: 'transparent', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-sm)', color: 'var(--navy)', padding: '6px 14px', fontSize: '0.825rem', fontWeight: 500, cursor: 'pointer', marginBottom: '20px' }}>
          &larr; My Lists
        </button>
        <div style={{ padding: '12px 14px', background: 'var(--danger-bg)', color: 'var(--danger)', borderRadius: 'var(--radius-md)', fontSize: '0.875rem' }}>
          {error}
        </div>
      </div>
    );
  }

  if (!list) return null;

  const items = list.items || [];

  return (
    <div>
      {/* Back */}
      <button
        onClick={() => navigate('/lists')}
        style={{ background: 'transparent', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-sm)', color: 'var(--navy)', padding: '6px 14px', fontSize: '0.825rem', fontWeight: 500, cursor: 'pointer', marginBottom: '20px' }}
      >
        &larr; My Lists
      </button>

      {/* Header */}
      <div style={{ marginBottom: '24px', paddingBottom: '14px', borderBottom: '1px solid var(--border-subtle)' }}>
        {editingName ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxWidth: '480px' }}>
            <input
              autoFocus
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleSaveRename(); if (e.key === 'Escape') setEditingName(false); }}
              style={{ fontSize: '1.4rem', fontWeight: 700, padding: '4px 8px', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-sm)', fontFamily: 'var(--font-sans)', color: 'var(--text-primary)', background: 'var(--bg-elevated)' }}
            />
            <input
              placeholder="Description (optional)"
              value={editDesc}
              onChange={(e) => setEditDesc(e.target.value)}
              style={{ fontSize: '0.875rem', padding: '4px 8px', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-sm)', fontFamily: 'var(--font-sans)', color: 'var(--text-primary)', background: 'var(--bg-elevated)' }}
            />
            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={handleSaveRename} disabled={saving || !editName.trim()} style={{ padding: '5px 14px', background: 'var(--navy)', color: 'white', border: 'none', borderRadius: 'var(--radius-sm)', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer' }}>
                {saving ? 'Saving…' : 'Save'}
              </button>
              <button onClick={() => { setEditingName(false); setEditName(list.name); setEditDesc(list.description || ''); }} style={{ padding: '5px 14px', background: 'transparent', color: 'var(--text-muted)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-sm)', fontSize: '0.8rem', cursor: 'pointer' }}>
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '16px' }}>
            <div>
              <h1 style={{ fontSize: '1.5rem', fontWeight: 700, margin: 0 }}>{list.name}</h1>
              {list.description && (
                <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', margin: '4px 0 0 0' }}>{list.description}</p>
              )}
              <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', margin: '6px 0 0 0' }}>
                {items.length} bill{items.length !== 1 ? 's' : ''}
              </p>
            </div>
            <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
              <button
                onClick={() => setEditingName(true)}
                style={{ padding: '6px 14px', background: 'transparent', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-sm)', fontSize: '0.8rem', color: 'var(--text-secondary)', cursor: 'pointer' }}
              >
                Rename
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                style={{ padding: '6px 14px', background: 'transparent', border: '1px solid var(--danger)', borderRadius: 'var(--radius-sm)', fontSize: '0.8rem', color: 'var(--danger)', cursor: 'pointer' }}
              >
                {deleting ? 'Deleting…' : 'Delete list'}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Bills */}
      {items.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-muted)' }}>
          <div style={{ fontSize: '2rem', marginBottom: '12px' }}>📋</div>
          <p style={{ fontSize: '0.9rem' }}>No bills in this list yet.</p>
          <p style={{ fontSize: '0.825rem', marginTop: '6px' }}>
            Open a bill and add it to this list from the tracking panel.
          </p>
        </div>
      ) : (
        <Panel>
          {items.map((item, idx) => {
            const bill = item.bill;
            return (
              <div
                key={item.billId}
                style={{ padding: '14px 0', borderBottom: idx < items.length - 1 ? '1px solid var(--border-subtle)' : 'none', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}
              >
                <div
                  style={{ flex: 1, cursor: 'pointer' }}
                  onClick={() => navigate(`/bills/${encodeURIComponent(item.billId)}`)}
                >
                  <div style={{ fontSize: '0.9rem', color: 'var(--text-primary)', marginBottom: '6px', lineHeight: 1.4, fontWeight: 500 }}>
                    {bill?.billName || item.billId}
                  </div>
                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
                    {bill?.status && <StatusBadge label={bill.status} type={getStatusBadgeType(bill.status)} />}
                    {bill?.category && <StatusBadge label={bill.category} type="info" />}
                    {Array.isArray(bill?.sectors) && bill.sectors.map((s) => (
                      <StatusBadge key={s} label={s} type="sector" />
                    ))}
                  </div>
                  {bill?.latestProgressDate && (
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                      {bill.latestProgressDate}
                      {bill.term ? ` · Term ${bill.term}` : ''}
                      {bill.session ? ` · Session ${bill.session}` : ''}
                    </div>
                  )}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0, paddingTop: '2px' }}>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Added {fmtDate(item.addedAt)}</span>
                  <button
                    onClick={() => handleRemoveBill(item.billId)}
                    disabled={removing === item.billId}
                    title="Remove from list"
                    style={{ background: 'transparent', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-sm)', color: 'var(--text-muted)', padding: '3px 10px', fontSize: '0.775rem', cursor: 'pointer' }}
                  >
                    {removing === item.billId ? '…' : 'Remove'}
                  </button>
                </div>
              </div>
            );
          })}
        </Panel>
      )}
    </div>
  );
}

export default ListDetail;
