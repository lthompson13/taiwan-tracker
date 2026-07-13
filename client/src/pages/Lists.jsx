import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@clerk/clerk-react';
import { useSubscription } from '../hooks/useSubscription';
import Loader from '../components/Loader';

function fmtDate(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function Lists() {
  const navigate = useNavigate();
  const { isSignedIn } = useAuth();
  const { isSubscribed } = useSubscription();

  const [lists, setLists] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState(null);

  useEffect(() => {
    if (!isSignedIn) { setLoading(false); return; }
    fetch('/api/user/lists', { credentials: 'include' })
      .then((r) => r.json())
      .then((data) => setLists(Array.isArray(data) ? data : []))
      .catch(() => setLists([]))
      .finally(() => setLoading(false));
  }, [isSignedIn]);

  if (!isSignedIn) {
    return (
      <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-muted)' }}>
        <p style={{ marginBottom: '16px' }}>Sign in to create and manage bill lists.</p>
        <button onClick={() => navigate('/sign-in')} style={{ padding: '8px 20px', background: 'var(--navy)', color: 'white', border: 'none', borderRadius: 'var(--radius-sm)', cursor: 'pointer', fontWeight: 500 }}>
          Sign in
        </button>
      </div>
    );
  }

  if (!isSubscribed) {
    return (
      <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-muted)' }}>
        <div style={{ fontSize: '2rem', marginBottom: '12px' }}>📋</div>
        <p style={{ fontSize: '0.9rem', marginBottom: '6px' }}>Bill lists are a Pro feature.</p>
        <p style={{ fontSize: '0.825rem', marginBottom: '20px' }}>Create named lists to organize bills for research, reporting, or client tracking.</p>
        <button onClick={() => navigate('/upgrade')} style={{ padding: '8px 20px', background: 'var(--navy)', color: 'white', border: 'none', borderRadius: 'var(--radius-sm)', cursor: 'pointer', fontWeight: 500 }}>
          Upgrade to Pro →
        </button>
      </div>
    );
  }

  async function handleCreate(e) {
    e.preventDefault();
    const name = newName.trim();
    if (!name) return;
    setCreating(true);
    setCreateError(null);
    try {
      const res = await fetch('/api/user/lists', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ name, description: newDesc.trim() || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setLists((prev) => [data, ...prev]);
      setNewName('');
      setNewDesc('');
      setShowCreate(false);
    } catch (err) {
      setCreateError(err.message);
    } finally {
      setCreating(false);
    }
  }

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: '24px', paddingBottom: '12px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700, margin: 0 }}>My Lists</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', margin: '4px 0 0 0' }}>
            {lists.length} list{lists.length !== 1 ? 's' : ''}
          </p>
        </div>
        <button
          onClick={() => setShowCreate((v) => !v)}
          style={{ padding: '7px 16px', background: 'var(--navy)', color: 'white', border: 'none', borderRadius: 'var(--radius-sm)', fontSize: '0.825rem', fontWeight: 600, cursor: 'pointer' }}
        >
          {showCreate ? 'Cancel' : '+ New list'}
        </button>
      </div>

      {/* Create form */}
      {showCreate && (
        <form
          onSubmit={handleCreate}
          style={{ border: '1px solid var(--border-default)', borderRadius: 'var(--radius-md)', padding: '16px 20px', marginBottom: '24px', background: 'var(--bg-subtle)' }}
        >
          <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '12px' }}>
            New list
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <input
              autoFocus
              required
              placeholder="List name (e.g. Q3 Client Watch)"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              style={{ padding: '8px 10px', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-sm)', fontSize: '0.875rem', background: 'var(--bg-elevated)' }}
            />
            <input
              placeholder="Description (optional)"
              value={newDesc}
              onChange={(e) => setNewDesc(e.target.value)}
              style={{ padding: '8px 10px', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-sm)', fontSize: '0.875rem', background: 'var(--bg-elevated)' }}
            />
            {createError && <div style={{ fontSize: '0.825rem', color: 'var(--danger)' }}>{createError}</div>}
            <div>
              <button
                type="submit"
                disabled={creating || !newName.trim()}
                style={{ padding: '7px 18px', background: 'var(--navy)', color: 'white', border: 'none', borderRadius: 'var(--radius-sm)', fontSize: '0.825rem', fontWeight: 600, cursor: 'pointer' }}
              >
                {creating ? 'Creating…' : 'Create list'}
              </button>
            </div>
          </div>
        </form>
      )}

      {loading ? (
        <Loader text="Loading lists" />
      ) : lists.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-muted)' }}>
          <div style={{ fontSize: '2rem', marginBottom: '12px' }}>📋</div>
          <p style={{ fontSize: '0.9rem' }}>No lists yet.</p>
          <p style={{ fontSize: '0.825rem', marginTop: '6px' }}>
            Create a list, then add bills to it from any bill detail page.
          </p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '16px' }}>
          {lists.map((list) => (
            <div
              key={list.id}
              onClick={() => navigate(`/lists/${list.id}`)}
              style={{ border: '1px solid var(--border-default)', borderRadius: 'var(--radius-md)', padding: '18px 20px', cursor: 'pointer', background: 'var(--bg-elevated)', transition: 'border-color 0.15s, box-shadow 0.15s' }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--navy)'; e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.08)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border-default)'; e.currentTarget.style.boxShadow = 'none'; }}
            >
              <div style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--navy)', marginBottom: '4px' }}>
                {list.name}
              </div>
              {list.description && (
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '10px', lineHeight: 1.4 }}>
                  {list.description}
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '12px' }}>
                <span style={{ fontSize: '0.775rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                  {list._count.items} bill{list._count.items !== 1 ? 's' : ''}
                </span>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  {fmtDate(list.updatedAt)}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default Lists;
