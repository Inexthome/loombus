import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PolicyChangeNote } from "@/components/policy-content/policy-change-note";
import { StructuredPolicyRenderer } from "@/components/policy-content/structured-policy-renderer";
import { policyHistoryHref } from "@/lib/policy-content-history";
import { getPolicyPayloadSource } from "@/lib/policy-content-payload-registry";
import { resolvePolicyArchiveVersion } from "@/lib/policy-content-resolver";

function exactArchivePath(documentId: string, version: string) {
  return `/policies/archive/${encodeURIComponent(documentId)}/${encodeURIComponent(version)}`;
}

async function resolveArchivePage(params: Promise<{ documentId: string; version: string }>) {
  const { documentId, version } = await params;
  const resolution = resolvePolicyArchiveVersion(documentId, version);
  if (!resolution.resolved || !resolution.family || !resolution.version) {
    return null;
  }

  const source = getPolicyPayloadSource(documentId, version);
  if (!source) return null;

  if (
    source.payloadPath !== resolution.version.payloadPath ||
    source.payload.documentId !== resolution.family.documentId ||
    source.payload.version !== resolution.version.version ||
    source.payload.canonicalRoute !== resolution.family.canonicalRoute ||
    source.payload.sourceRevision !== resolution.version.sourceRevision
  ) {
    return null;
  }

  return {
    family: resolution.family,
    version: resolution.version,
    payload: source.payload,
  };
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ documentId: string; version: string }>;
}): Promise<Metadata> {
  const resolved = await resolveArchivePage(params);
  if (!resolved) {
    return {
      title: "Policy version unavailable | Loombus",
      robots: { index: false, follow: false },
    };
  }

  const archivePath = exactArchivePath(
    resolved.family.documentId,
    resolved.version.version,
  );

  return {
    title: `${resolved.version.title} ${resolved.version.version} | Loombus`,
    description: resolved.version.summary,
    alternates: {
      canonical: `https://loombus.com${archivePath}`,
    },
  };
}

export default async function PolicyArchivePage({
  params,
}: {
  params: Promise<{ documentId: string; version: string }>;
}) {
  const resolved = await resolveArchivePage(params);
  if (!resolved) notFound();

  const statusLabel =
    resolved.version.status === "superseded"
      ? "Historical superseded version"
      : "Exact effective version";

  return (
    <>
      <aside className="mx-auto max-w-5xl px-4 pt-8 sm:px-6">
        <div className="rounded-2xl border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-4 text-sm">
          <p className="font-semibold">{statusLabel}</p>
          <p className="mt-1 text-[var(--loombus-text-muted)]">
            Version {resolved.version.version} · Effective {new Date(resolved.version.effectiveAt ?? "").toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}
          </p>
          <Link
            href={resolved.family.canonicalRoute}
            className="mt-3 inline-block font-semibold underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--loombus-gold)] focus-visible:ring-offset-2"
          >
            View current {resolved.version.title}
          </Link>
        </div>
      </aside>
      <PolicyChangeNote
        changeNote={resolved.version.changeNote}
        version={resolved.version.version}
        historyHref={policyHistoryHref(resolved.family.documentId)}
      />
      <StructuredPolicyRenderer payload={resolved.payload} />
    </>
  );
}
