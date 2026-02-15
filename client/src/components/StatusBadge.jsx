const TYPE_COLORS = {
  success: '#00ff41',
  warning: '#ffb000',
  danger: '#ff0040',
  info: '#00d4ff',
  default: '#888888',
};

function StatusBadge({ label, type = 'default' }) {
  const color = TYPE_COLORS[type] || TYPE_COLORS.default;

  const style = {
    display: 'inline-block',
    padding: '2px 8px',
    borderRadius: '2px',
    fontSize: '0.65rem',
    fontWeight: 600,
    fontFamily: "'IBM Plex Mono', monospace",
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    color: color,
    background: `${color}33`,
    border: `1px solid ${color}44`,
    lineHeight: '1.6',
    whiteSpace: 'nowrap',
  };

  return <span style={style}>{label}</span>;
}

export default StatusBadge;
