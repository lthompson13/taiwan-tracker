import './SearchBar.css';

function SearchBar({
  value,
  onChange,
  placeholder = 'ENTER SEARCH QUERY...',
  onSearch,
  filters,
  onFilterChange,
}) {
  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && onSearch) {
      onSearch(value);
    }
  };

  return (
    <div className="searchbar">
      <div className="searchbar-input-group">
        <span className="searchbar-prompt">&gt;_</span>
        <input
          type="text"
          className="searchbar-input"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          spellCheck={false}
          autoComplete="off"
        />
        {onSearch && (
          <button
            className="searchbar-button"
            onClick={() => onSearch(value)}
            type="button"
          >
            SEARCH
          </button>
        )}
      </div>

      {filters && filters.length > 0 && (
        <div className="searchbar-filters">
          {filters.map((filter) => (
            <div key={filter.key} className="searchbar-filter">
              <label className="searchbar-filter-label">{filter.label}:</label>
              <select
                className="searchbar-select"
                value={filter.value || ''}
                onChange={(e) =>
                  onFilterChange && onFilterChange(filter.key, e.target.value)
                }
              >
                {filter.options.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default SearchBar;
