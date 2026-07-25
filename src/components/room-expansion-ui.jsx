"use client";

export function formatDate(value) {
  if (!value) return "Not scheduled";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "Not scheduled";
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

export function formatBytes(bytes) {
  const value = Number(bytes ?? 0);
  if (value >= 1024 ** 3) return `${(value / 1024 ** 3).toFixed(1)} GB`;
  if (value >= 1024 ** 2) return `${(value / 1024 ** 2).toFixed(1)} MB`;
  if (value >= 1024) return `${Math.ceil(value / 1024)} KB`;
  return `${value} bytes`;
}

export function displayName(profile, fallback = "Room member") {
  return profile?.full_name?.trim() || profile?.username?.trim() || fallback;
}

export function parseFieldLines(value) {
  return value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [label, type = "text", required = "no", options = ""] = line
        .split("|")
        .map((item) => item.trim());
      return {
        label,
        type,
        required: ["yes", "required", "true"].includes(
          required.toLowerCase()
        ),
        options: options
          .split(";")
          .map((item) => item.trim())
          .filter(Boolean),
      };
    });
}

export function Empty({ Icon, title, text }) {
  return (
    <div className="room-expansion-empty">
      <Icon aria-hidden="true" />
      <h3>{title}</h3>
      <p>{text}</p>
    </div>
  );
}

export function StudioPagination({
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
    <nav className="room-expansion-pagination" aria-label={`${itemLabel} pages`}>
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
