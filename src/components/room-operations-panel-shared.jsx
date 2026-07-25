"use client";

export function formatDate(value) {
  if (!value) return "Not recorded";
  const date = new Date(value);
  return Number.isFinite(date.getTime())
    ? new Intl.DateTimeFormat(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
      }).format(date)
    : "Not recorded";
}

function formatBytes(value) {
  const amount = Number(value) || 0;
  if (amount < 1024) return `${amount} B`;
  const units = ["KB", "MB", "GB", "TB"];
  let size = amount / 1024;
  let index = 0;
  while (size >= 1024 && index < units.length - 1) {
    size /= 1024;
    index += 1;
  }
  return `${size >= 10 ? size.toFixed(0) : size.toFixed(1)} ${units[index]}`;
}

function ratio(used, limit) {
  return limit ? Math.min(100, Math.round((used / limit) * 100)) : 0;
}

export function UsageCard({ label, used, limit, detail, bytes = false }) {
  const percent = ratio(used, limit);
  const shownUsed = bytes ? formatBytes(used) : used;
  const shownLimit = limit == null ? null : bytes ? formatBytes(limit) : limit;
  return (
    <article className="room-operation-metric">
      <span>{label}</span>
      <strong>
        {shownUsed}
        {shownLimit ? ` / ${shownLimit}` : ""}
      </strong>
      <div aria-hidden="true">
        <i style={{ width: `${percent}%` }} />
      </div>
      <small>{detail}</small>
    </article>
  );
}
