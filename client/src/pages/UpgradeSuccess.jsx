import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUser } from '@clerk/clerk-react';

function UpgradeSuccess() {
  const navigate = useNavigate();
  const { user, isLoaded } = useUser();
  const [checking, setChecking] = useState(true);
  const [ready, setReady] = useState(false);

  // Poll Clerk user metadata until subscription is confirmed active
  useEffect(() => {
    if (!isLoaded) return;

    let attempts = 0;
    const interval = setInterval(async () => {
      attempts++;
      await user?.reload();
      const status = user?.publicMetadata?.subscriptionStatus;
      if (status === 'active') {
        setReady(true);
        setChecking(false);
        clearInterval(interval);
      }
      if (attempts >= 15) {
        // Give up after ~30s — webhook might be delayed
        setChecking(false);
        clearInterval(interval);
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [isLoaded, user]);

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'var(--bg-subtle)',
      padding: '40px',
      textAlign: 'center',
    }}>
      {checking ? (
        <>
          <div style={{ fontSize: '2.5rem', marginBottom: '16px' }}>⏳</div>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--navy)', marginBottom: '8px' }}>
            Activating your subscription…
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
            This usually takes a few seconds.
          </p>
        </>
      ) : ready ? (
        <>
          <div style={{ fontSize: '2.5rem', marginBottom: '16px' }}>✓</div>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--navy)', marginBottom: '8px' }}>
            You're subscribed to BillScope Taiwan Pro
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginBottom: '24px' }}>
            Your account now has full access to editorial summaries, watchlists, and annotations.
          </p>
          <button
            onClick={() => navigate('/')}
            style={{
              padding: '10px 24px',
              background: 'var(--navy)',
              color: 'white',
              border: 'none',
              borderRadius: 'var(--radius-sm)',
              fontSize: '0.9rem',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Go to Dashboard →
          </button>
        </>
      ) : (
        <>
          <div style={{ fontSize: '2.5rem', marginBottom: '16px' }}>✓</div>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--navy)', marginBottom: '8px' }}>
            Payment received
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginBottom: '24px' }}>
            Your subscription is being activated. If features aren't unlocked yet, please refresh the page in a moment.
          </p>
          <button
            onClick={() => navigate('/')}
            style={{
              padding: '10px 24px',
              background: 'var(--navy)',
              color: 'white',
              border: 'none',
              borderRadius: 'var(--radius-sm)',
              fontSize: '0.9rem',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Go to Dashboard →
          </button>
        </>
      )}
    </div>
  );
}

export default UpgradeSuccess;
