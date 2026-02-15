import './Panel.css';

function Panel({ title, children, className = '' }) {
  return (
    <div className={`panel ${className}`}>
      {title && (
        <div className="panel-header">
          <span className="panel-header-decoration">///</span>
          <span className="panel-header-title">{title}</span>
        </div>
      )}
      <div className="panel-content">
        {children}
      </div>
    </div>
  );
}

export default Panel;
