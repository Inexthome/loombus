"use client";

export function RoomCorePagination({
  pageInfo,
  loading,
  onPageChange,
  itemLabel = "items",
}) {
  if (!pageInfo || pageInfo.totalPages <= 1) return null;
  const summary = pageInfo.totalItems
    ? `Showing ${pageInfo.from}–${pageInfo.to} of ${pageInfo.totalItems} ${itemLabel}`
    : `No ${itemLabel}`;

  return (
    <nav className="room-core-pagination" aria-label={`${itemLabel} pages`}>
      <p aria-live="polite">{summary}</p>
      <div>
        <button
          type="button"
          disabled={loading || !pageInfo.hasPrevious}
          onClick={() => onPageChange(pageInfo.page - 1)}
        >
          Previous
        </button>
        <span aria-current="page">
          Page {pageInfo.page} of {pageInfo.totalPages}
        </span>
        <button
          type="button"
          disabled={loading || !pageInfo.hasNext}
          onClick={() => onPageChange(pageInfo.page + 1)}
        >
          Next
        </button>
      </div>
    </nav>
  );
}
