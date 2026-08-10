import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PageShell, Panel } from "@/components/ui";
import { resolvePolicyPublicHistory } from "@/lib/policy-content-history";

async function resolveHistoryPage(params: Promise<{ documentId: string }>) {
  const { documentId } = await params;
  const history = resolvePolicyPublicHistory(documentId);
  if (!history.visible || !history.family || history.entries.length === 0) {
    return null;
  }
  return history;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ documentId: string }>;
}): Promise<Metadata> {
  const history = await resolveHistoryPage(params);
  if (!history) {
    return {
      title: "Policy history unavailable | Loombus",
      robots: { index: false, follow: false },
    };
  }

  const title = history.entries[0]?.title ?? history.family.documentId;
  return {
    title: `${title} version history | Loombus`,
    description: `Public version history for ${title}.`,
  };
}

export default async function PolicyHistoryPage({
  params,
}: {
  params: Promise<{ documentId: string }>;
}) {
  const history = await resolveHistoryPage(params);
  if (!history) notFound();

  const title = history.entries[0]?.title ?? history.family.documentId;

  return (
    <PageShell width="lg">
      <Link
        href={history.family.canonicalRoute}
        className="mb-8 inline-block text-sm font-semibold underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--loombus-gold)] focus-visible:ring-offset-2"
      >
        ← Back to current {title}
      </Link>

      <header className="mb-8">
        <p className="text-sm font-semibold uppercase tracking-[0.14em] text-[var(--loombus-gold)]">
          Version history
        </p>
        <h1 className="mt-2 text-3xl font-semibold">{title}</h1>
        <p className="mt-3 max-w-3xl text-[var(--loombus-text-muted)]">
          This page lists public effective and superseded versions only. Internal review notes, publication blockers, and reviewer details are not included.
        </p>
      </header>

      <div className="space-y-4">
        {history.entries.map((entry) => (
          <Panel key={entry.version}>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h2 className="text-xl font-semibold">Version {entry.version}</h2>
                <p className="mt-1 text-sm text-[var(--loombus-text-muted)]">
                  {entry.status === "effective" ? "Current effective version" : "Superseded version"} · Effective {new Date(entry.effectiveAt).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}
                </p>
              </div>
              <Link
                href={entry.archiveHref}
                className="w-fit text-sm font-semibold underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--loombus-gold)] focus-visible:ring-offset-2"
              >
                View exact version
              </Link>
            </div>
            {entry.changeNote ? (
              <p className="mt-4 text-sm text-[var(--loombus-text-muted)]">
                {entry.changeNote}
              </p>
            ) : null}
          </Panel>
        ))}
      </div>
    </PageShell>
  );
}
