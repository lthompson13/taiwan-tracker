/**
 * StatusBadge — small label pill used inline for status/category indicators.
 *
 * Light palette: each type pairs a subtle tinted background with a darker
 * foreground from the design tokens. Falls back to a neutral gray.
 */
const TYPE_STYLES = {
  success: { color: 'var(--success)', bg: 'var(--success-bg)', border: 'var(--success)' },
  warning: { color: 'var(--warning)', bg: 'var(--warning-bg)', border: 'var(--warning)' },
  danger:  { color: 'var(--danger)',  bg: 'var(--danger-bg)',  border: 'var(--danger)'  },
  info:    { color: 'var(--info)',    bg: 'var(--info-bg)',    border: 'var(--info)'    },
  sector:  { color: 'var(--teal)',    bg: 'var(--teal-light)', border: 'var(--teal)'   },
  default: { color: 'var(--text-secondary)', bg: 'var(--bg-subtle)', border: 'var(--border-default)' },
};

function StatusBadge({ label, type = 'default' }) {
  const t = TYPE_STYLES[type] || TYPE_STYLES.default;

  const style = {
    display: 'inline-block',
    padding: '2px 8px',
    borderRadius: '999px',
    fontSize: '0.7rem',
    fontWeight: 600,
    color: t.color,
    background: t.bg,
    border: `1px solid ${t.border}`,
    lineHeight: '1.5',
    whiteSpace: 'nowrap',
  };

  return <span style={style}>{label}</span>;
}

export default StatusBadge;
