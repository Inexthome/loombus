import type { ReactNode } from "react";
import Link from "next/link";
import { PolicyPrintButton } from "@/components/policy-content/policy-print-button";
import { PageHeader, PageShell, Panel } from "@/components/ui";
import styles from "./public-policy-page.module.css";

export type PublicPolicySection = {
  id?: string;
  title: string;
  paragraphs?: ReactNode[];
  bullets?: ReactNode[];
  tone?: "default" | "danger";
};

type PublicPolicyPageProps = {
  eyebrow: string;
  title: string;
  description: ReactNode;
  sections: PublicPolicySection[];
  effectiveDate?: string;
  reviewedDate?: string;
  backHref?: string;
  backLabel?: string;
};

export function PublicPolicyPage({
  eyebrow,
  title,
  description,
  sections,
  effectiveDate,
  reviewedDate,
  backHref = "/",
  backLabel = "Back to Loombus",
}: PublicPolicyPageProps) {
  const jumpSections = sections.reduce<
    Array<{ id: string; title: string; number: number }>
  >((items, section, index) => {
    if (!section.id) return items;
    items.push({ id: section.id, title: section.title, number: index + 1 });
    return items;
  }, []);

  return (
    <PageShell width="lg">
      <div data-policy-print-root className={styles.printRoot}>
        <Link
          href={backHref}
          data-policy-screen-only
          className="mb-10 inline-block rounded-sm text-sm text-zinc-500 transition hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--loombus-gold)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--loombus-bg)]"
        >
          ← {backLabel}
        </Link>

        <PageHeader eyebrow={eyebrow} title={title} description={description} />

        <div
          data-policy-screen-only
          className="mb-8 flex flex-col gap-5 rounded-2xl border border-zinc-800 bg-zinc-950/40 p-5 sm:flex-row sm:items-start sm:justify-between"
        >
          {jumpSections.length > 0 && (
            <nav aria-label="Jump to section" className="min-w-0 flex-1">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">
                Jump to
              </p>
              <ul className="mt-3 flex flex-wrap gap-2">
                {jumpSections.map((section) => (
                  <li key={section.id}>
                    <a
                      href={`#${section.id}`}
                      className="inline-flex min-h-10 items-center rounded-full border border-zinc-800 px-3 py-2 text-sm text-zinc-400 transition hover:border-zinc-600 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--loombus-gold)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--loombus-bg)]"
                    >
                      {section.number}. {section.title}
                    </a>
                  </li>
                ))}
              </ul>
            </nav>
          )}

          <PolicyPrintButton />
        </div>

        <div className="space-y-8 leading-relaxed text-zinc-400">
          {sections.map((section, index) => (
            <div
              key={`${section.id ?? "section"}-${index}`}
              data-policy-print-section
              className={styles.printSection}
            >
              <Panel
                {...(section.tone === "danger" ? { tone: "danger" as const } : {})}
              >
                <h2
                  id={section.id}
                  className="mb-4 scroll-mt-28 text-2xl font-semibold text-white"
                >
                  {index + 1}. {section.title}
                </h2>

                {section.paragraphs?.map((paragraph, paragraphIndex) => (
                  <p
                    key={`${section.id ?? index}-paragraph-${paragraphIndex}`}
                    className={paragraphIndex === 0 ? undefined : "mt-4"}
                  >
                    {paragraph}
                  </p>
                ))}

                {section.bullets && section.bullets.length > 0 && (
                  <ul className="mt-4 list-disc space-y-2 pl-6">
                    {section.bullets.map((item, bulletIndex) => (
                      <li key={`${section.id ?? index}-bullet-${bulletIndex}`}>
                        {item}
                      </li>
                    ))}
                  </ul>
                )}
              </Panel>
            </div>
          ))}

          {(effectiveDate || reviewedDate) && (
            <div data-policy-print-section className={styles.printSection}>
              <Panel>
                <h2 className="mb-4 text-2xl font-semibold text-white">
                  Document status
                </h2>
                {effectiveDate && <p>Effective date: {effectiveDate}</p>}
                {reviewedDate && <p className="mt-2">Last reviewed: {reviewedDate}</p>}
                <p className="mt-4 text-sm text-zinc-500">
                  This public explanation describes the current Loombus service and may
                  be updated as features, operational practices, or legal requirements
                  change.
                </p>
              </Panel>
            </div>
          )}
        </div>
      </div>
    </PageShell>
  );
}
