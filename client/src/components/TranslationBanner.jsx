import { useEffect, useState } from 'react';

/**
 * TranslationBanner — alerts the user when the translation service is
 * disabled (missing API key) or impaired (recent API errors). Renders
 * nothing when healthy.
 */
function TranslationBanner() {
  const [status, setStatus] = useState(null);

  useEffect(() => {
    let cancelled = false;

    const fetchStatus = async () => {
      try {
        const res = await fetch('/api/translation-status');
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled) setStatus(data);
      } catch {
        // ignore — page-level error handling surfaces connectivity issues
      }
    };

    fetchStatus();
    const interval = setInterval(fetchStatus, 60_000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  if (!status || status.healthy) return null;

  const isDisabled = !status.enabled;

  const label = isDisabled ? 'Translation offline' : 'Translation degraded';
  const detail = isDisabled
    ? 'GOOGLE_TRANSLATE_API_KEY is not configured. Content displayed in original Chinese.'
    : `Recent translation requests failed (${status.errorCount} consecutive errors). Some content may appear in Chinese.`;

  const bg = isDisabled ? 'var(--danger-bg)' : 'var(--warning-bg)';
  const fg = isDisabled ? 'var(--danger)' : 'var(--warning)';
  const border = fg;

  return (
    <div
      role="alert"
      style={{
        background: bg,
        color: fg,
        border: `1px solid ${border}`,
        borderRadius: 'var(--radius-md)',
        padding: '10px 14px',
        fontSize: '0.85rem',
        display: 'flex',
        alignItems: 'baseline',
        gap: '12px',
        marginBottom: '16px',
      }}
    >
      <span style={{ fontWeight: 600 }}>{label}.</span>
      <span style={{ color: 'var(--text-secondary)' }}>{detail}</span>
    </div>
  );
}

export default TranslationBanner;
