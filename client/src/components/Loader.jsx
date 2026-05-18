const containerStyle = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '60px 20px',
  color: 'var(--text-secondary)',
  fontSize: '0.9rem',
};

const spinnerStyle = {
  width: '16px',
  height: '16px',
  border: '2px solid var(--border-default)',
  borderTopColor: 'var(--navy)',
  borderRadius: '50%',
  marginRight: '10px',
  animation: 'loaderSpin 0.8s linear infinite',
};

const keyframesCSS = `
@keyframes loaderSpin {
  to { transform: rotate(360deg); }
}
`;

function Loader({ text = 'Loading' }) {
  return (
    <div style={containerStyle}>
      <style>{keyframesCSS}</style>
      <span style={spinnerStyle}></span>
      <span>{text}…</span>
    </div>
  );
}

export default Loader;
