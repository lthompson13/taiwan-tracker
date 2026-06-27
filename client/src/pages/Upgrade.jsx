import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth, SignInButton } from '@clerk/clerk-react';
import { useSubscription } from '../hooks/useSubscription';

const features = {
  free: [
    'Browse all synced Legislative Yuan bills',
    'Full-text search across 20,000+ bills',
    'Sector tags (Semiconductors, Defense, Energy, and 10 more)',
    'Bill status tracking',
    'Legislator and committee profiles',
  ],
  paid: [
    'Everything in Free',
    '"Why It Matters" editorial summaries — business impact analysis written for analysts and investors',
    'Bill watchlist — track bills important to your work',
    'Stance tracking — mark bills as Support / Oppose / Monitor',
    'Priority tagging — flag bills as High / Medium / Low priority',
    'Personal notes on any bill',
    'All future premium features',
  ],
};

function Upgrade() {
  const navigate = useNavigate();
  const { isSignedIn } = useAuth();
  const { isSubscribed, isTrial, trialDaysLeft } = useSubscription();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleSubscribe = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        credentials: 'include',
      });
      const data = await res.json();
      if (res.status === 409 && data.error === 'already_subscribed') {
        // Subscription exists in Stripe but metadata wasn't synced — reload to pick up updated metadata
        window.location.reload();
        return;
      }
      if (!res.ok) throw new Error(data.error || 'Failed to start checkout');
      window.location.href = data.url;
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  };

  const handleManageBilling = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/stripe/portal', { credentials: 'include' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      window.location.href = data.url;
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: '720px', margin: '0 auto' }}>
      <div style={{ marginBottom: '32px', paddingBottom: '12px', borderBottom: '1px solid var(--border-subtle)' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 700, margin: 0 }}>Upgrade to Pro</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', margin: '4px 0 0 0' }}>
          Professional legislative intelligence for analysts, investors, and advisors with Taiwan exposure.
        </p>
      </div>

      {isTrial && (
        <div style={{ padding: '14px 18px', background: 'var(--bg-subtle)', border: '1px solid var(--teal)', borderRadius: 'var(--radius-md)', marginBottom: '24px', color: 'var(--teal)', fontSize: '0.875rem', fontWeight: 500 }}>
          ◎ You are on a free trial.{trialDaysLeft !== null ? ` ${trialDaysLeft} day${trialDaysLeft !== 1 ? 's' : ''} remaining.` : ''}{' '}
          <button onClick={handleManageBilling} style={{ background: 'none', border: 'none', color: 'var(--teal)', textDecoration: 'underline', cursor: 'pointer', fontSize: '0.875rem', fontWeight: 500 }}>
            Manage billing →
          </button>
        </div>
      )}

      {isSubscribed && !isTrial && (
        <div style={{ padding: '14px 18px', background: 'var(--success-bg)', border: '1px solid var(--success)', borderRadius: 'var(--radius-md)', marginBottom: '24px', color: 'var(--success)', fontSize: '0.875rem', fontWeight: 500 }}>
          ✓ You have an active Pro subscription.{' '}
          <button onClick={handleManageBilling} style={{ background: 'none', border: 'none', color: 'var(--success)', textDecoration: 'underline', cursor: 'pointer', fontSize: '0.875rem', fontWeight: 500 }}>
            Manage billing →
          </button>
        </div>
      )}

      {/* Pricing card */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '32px' }}>

        {/* Free tier */}
        <div style={{ border: '1px solid var(--border-default)', borderRadius: 'var(--radius-lg)', padding: '24px' }}>
          <div style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '4px' }}>Free</div>
          <div style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--navy)', marginBottom: '20px' }}>$0</div>
          <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 24px 0' }}>
            {features.free.map((f) => (
              <li key={f} style={{ display: 'flex', gap: '8px', alignItems: 'flex-start', marginBottom: '8px', fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                <span style={{ color: 'var(--success)', flexShrink: 0, marginTop: '1px' }}>✓</span>
                {f}
              </li>
            ))}
          </ul>
        </div>

        {/* Pro tier */}
        <div style={{ border: '2px solid var(--navy)', borderRadius: 'var(--radius-lg)', padding: '24px', position: 'relative' }}>
          <div style={{ position: 'absolute', top: '-12px', left: '20px', background: 'var(--navy)', color: 'white', fontSize: '0.7rem', fontWeight: 700, padding: '3px 10px', borderRadius: '999px', letterSpacing: '0.05em' }}>
            PRO
          </div>
          <div style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '4px' }}>Pro</div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px', marginBottom: '4px' }}>
            <span style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--navy)' }}>$99</span>
            <span style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>/month</span>
          </div>
          <div style={{ fontSize: '0.8rem', color: 'var(--teal)', fontWeight: 600, marginBottom: '16px' }}>
            First month free — no charge until day 31
          </div>
          <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 24px 0' }}>
            {features.paid.map((f) => (
              <li key={f} style={{ display: 'flex', gap: '8px', alignItems: 'flex-start', marginBottom: '8px', fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                <span style={{ color: 'var(--navy)', flexShrink: 0, marginTop: '1px' }}>✓</span>
                {f}
              </li>
            ))}
          </ul>

          {!isSubscribed && (
            isSignedIn ? (
              <button
                onClick={handleSubscribe}
                disabled={loading}
                style={{
                  width: '100%',
                  padding: '10px',
                  background: loading ? 'var(--border-default)' : 'var(--navy)',
                  color: 'white',
                  border: 'none',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: '0.9rem',
                  fontWeight: 600,
                  cursor: loading ? 'not-allowed' : 'pointer',
                }}
              >
                {loading ? 'Redirecting to checkout…' : 'Start free trial — $99/month after 30 days'}
              </button>
            ) : (
              <SignInButton mode="modal" redirectUrl="/upgrade">
                <button style={{
                  width: '100%',
                  padding: '10px',
                  background: 'var(--navy)',
                  color: 'white',
                  border: 'none',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: '0.9rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}>
                  Sign in to subscribe
                </button>
              </SignInButton>
            )
          )}

          {isSubscribed && (
            <button
              onClick={handleManageBilling}
              disabled={loading}
              style={{
                width: '100%',
                padding: '10px',
                background: 'transparent',
                color: 'var(--navy)',
                border: '1px solid var(--navy)',
                borderRadius: 'var(--radius-sm)',
                fontSize: '0.9rem',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Manage subscription
            </button>
          )}
        </div>
      </div>

      {error && (
        <div style={{ padding: '12px 14px', background: 'var(--danger-bg)', color: 'var(--danger)', borderRadius: 'var(--radius-md)', fontSize: '0.875rem', marginBottom: '16px' }}>
          {error}
        </div>
      )}

      <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textAlign: 'center' }}>
        Free for 30 days, then $99/month. Cancel anytime.
      </p>
    </div>
  );
}

export default Upgrade;
