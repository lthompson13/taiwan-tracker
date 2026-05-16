import { useEffect, useState } from 'react';

/**
 * TranslationBanner — fetches /api/translation-status on mount and renders a
 * warning strip across the top of the app when translation is unavailable.
 *
 * Three states:
 *  - healthy: API key configured AND recent calls succeeded → no banner.
 *  - disabled: API key missing/placeholder → red "OFFLINE" banner.
 *  - impaired: API key present but recent calls failed → yellow "ERROR" banner.
 *
 * The endpoint is cheap (no upstream calls) so we re-check periodically in case
 * a transient outage clears.
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
        // Network error reaching our own server — leave status as null
        // so we don't render a misleading banner. The page's own error
        // handling will surface the connectivity issue.
      }
    };

    fetchStatus();
    const interval = setInterval(fetchStatus, 60_000); // recheck every minute

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  if (!status || status.healthy) return null;

  const isDisabled = !status.enabled;
  // High-contrast palette: dark site background needs vivid alert colors.
  const bgColor = isDisabled ? '#cc0033' : '#cc7700';
  const fgColor = '#ffffff';
  const detailColor = isDisabled ? '#ffcccc' : '#ffe5b3';
  const label = isDisabled ? 'TRANSLATION OFFLINE' : 'TRANSLATION DEGRADED';
  const detail = isDisabled
    ? 'GOOGLE_TRANSLATE_API_KEY is not configured. Content displayed in original Chinese.'
    : `Recent translation requests failed (${status.errorCount} consecutive errors). Some content may appear in Chinese.`;

  return (
    <div
      role="alert"
      style={{
        background: bgColor,
        color: fgColor,
        padding: '10px 16px',
        fontFamily: 'monospace',
        fontSize: '0.8rem',
        letterSpacing: '0.1em',
        textTransform: 'uppercase',
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        marginBottom: '16px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.6)',
      }}
    >
      <span style={{ fontWeight: 700 }}>[!] {label}</span>
      <span style={{ color: detailColor, textTransform: 'none', letterSpacing: 'normal' }}>
        {detail}
      </span>
    </div>
  );
}

export default TranslationBanner;
