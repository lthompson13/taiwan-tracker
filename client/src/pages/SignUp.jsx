import { SignUp } from '@clerk/clerk-react';

function SignUpPage() {
  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'var(--bg-subtle)',
      gap: '24px',
    }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--navy)', marginBottom: '4px' }}>
          Taiwan Legislative Tracker
        </div>
        <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
          Legislative Yuan monitoring
        </div>
      </div>
      <SignUp routing="path" path="/sign-up" signInUrl="/sign-in" />
    </div>
  );
}

export default SignUpPage;
