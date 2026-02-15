import './Pagination.css';

function Pagination({ page, totalPages, onPageChange }) {
  const isFirstPage = page <= 1;
  const isLastPage = page >= totalPages;

  return (
    <div className="pagination">
      <button
        className={`pagination-btn ${isFirstPage ? 'disabled' : ''}`}
        onClick={() => !isFirstPage && onPageChange(page - 1)}
        disabled={isFirstPage}
        type="button"
      >
        &laquo; PREV
      </button>

      <span className="pagination-info">
        PAGE <span className="pagination-current">{page}</span> OF{' '}
        <span className="pagination-total">{totalPages}</span>
      </span>

      <button
        className={`pagination-btn ${isLastPage ? 'disabled' : ''}`}
        onClick={() => !isLastPage && onPageChange(page + 1)}
        disabled={isLastPage}
        type="button"
      >
        NEXT &raquo;
      </button>
    </div>
  );
}

export default Pagination;
