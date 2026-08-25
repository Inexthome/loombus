import Link from "next/link";

export function PolicyChangeNote({
  changeNote,
  version,
  historyHref,
  label = "What changed",
}: {
  changeNote: string | null | undefined;
  version: string;
  historyHref?: string;
  label?: string;
}) {
  const note = changeNote?.trim();
  if (!note) return null;

  return (
    <aside
      aria-label={`${label} in version ${version}`}
      className="mx-auto max-w-5xl px-4 pt-6 sm:px-6"
    >
      <div className="rounded-2xl border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-4 text-sm">
        <p className="font-semibold">{label}</p>
        <p className="mt-2 text-[var(--loombus-text-muted)]">{note}</p>
        {historyHref ? (
          <Link
            href={historyHref}
            className="mt-3 inline-block font-semibold underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--loombus-gold)] focus-visible:ring-offset-2"
          >
            View version history
          </Link>
        ) : null}
      </div>
    </aside>
  );
}
