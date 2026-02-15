import { useState, useMemo } from 'react';
import './DataTable.css';

function DataTable({ columns, data, onRowClick, sortable = true }) {
  const [sortKey, setSortKey] = useState(null);
  const [sortDir, setSortDir] = useState('asc');

  const handleSort = (col) => {
    if (!sortable || col.sortable === false) return;

    if (sortKey === col.key) {
      setSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(col.key);
      setSortDir('asc');
    }
  };

  const sortedData = useMemo(() => {
    if (!sortKey || !data) return data || [];

    return [...data].sort((a, b) => {
      const aVal = a[sortKey];
      const bVal = b[sortKey];

      if (aVal == null && bVal == null) return 0;
      if (aVal == null) return 1;
      if (bVal == null) return -1;

      let comparison = 0;
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        comparison = aVal - bVal;
      } else {
        comparison = String(aVal).localeCompare(String(bVal));
      }

      return sortDir === 'asc' ? comparison : -comparison;
    });
  }, [data, sortKey, sortDir]);

  const getSortIndicator = (col) => {
    if (!sortable || col.sortable === false) return null;
    if (sortKey !== col.key) {
      return <span className="datatable-sort-indicator dimmed">{'\u25B2'}</span>;
    }
    return (
      <span className="datatable-sort-indicator active">
        {sortDir === 'asc' ? '\u25B2' : '\u25BC'}
      </span>
    );
  };

  if (!data || data.length === 0) {
    return (
      <div className="datatable-empty">
        <span className="datatable-empty-icon">[!</span>
        <span>NO DATA AVAILABLE</span>
        <span className="datatable-empty-icon">]</span>
      </div>
    );
  }

  return (
    <div className="datatable-wrapper">
      <table className="datatable">
        <thead>
          <tr>
            {columns.map((col) => (
              <th
                key={col.key}
                className={`datatable-th ${sortable && col.sortable !== false ? 'sortable' : ''}`}
                onClick={() => handleSort(col)}
              >
                {col.label}
                {getSortIndicator(col)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sortedData.map((row, rowIdx) => (
            <tr
              key={row.id || rowIdx}
              className={`datatable-row ${onRowClick ? 'clickable' : ''}`}
              onClick={() => onRowClick && onRowClick(row)}
            >
              {columns.map((col) => (
                <td key={col.key} className="datatable-td">
                  {col.render ? col.render(row[col.key], row) : row[col.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default DataTable;
