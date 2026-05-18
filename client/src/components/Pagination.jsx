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
        &laquo; Previous
      </button>

      <span className="pagination-info">
        Page <span className="pagination-current">{page}</span> of{' '}
        <span className="pagination-total">{totalPages}</span>
      </span>

      <button
        className={`pagination-btn ${isLastPage ? 'disabled' : ''}`}
        onClick={() => !isLastPage && onPageChange(page + 1)}
        disabled={isLastPage}
        type="button"
      >
        Next &raquo;
      </button>
    </div>
  );
}

export default Pagination;
