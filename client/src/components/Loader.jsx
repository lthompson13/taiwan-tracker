const containerStyle = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '60px 20px',
};

const textStyle = {
  color: '#00ff41',
  fontSize: '0.85rem',
  fontWeight: 600,
  fontFamily: "'IBM Plex Mono', monospace",
  letterSpacing: '0.12em',
  textTransform: 'uppercase',
  animation: 'loaderPulse 1.5s ease-in-out infinite',
};

const keyframesCSS = `
@keyframes loaderPulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.3; }
}

@keyframes loaderDots {
  0% { content: ''; }
  25% { content: '.'; }
  50% { content: '..'; }
  75% { content: '...'; }
}

.loader-dots::after {
  content: '';
  animation: loaderDots 1.2s steps(4, end) infinite;
}
`;

function Loader({ text = 'DECRYPTING DATA' }) {
  return (
    <div style={containerStyle}>
      <style>{keyframesCSS}</style>
      <span style={textStyle}>
        [{text}<span className="loader-dots"></span>]
      </span>
    </div>
  );
}

export default Loader;
