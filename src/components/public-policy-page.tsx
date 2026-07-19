import type { ReactNode } from "react";
import Link from "next/link";
import { PageHeader, PageShell, Panel } from "@/components/ui";

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
  return (
    <PageShell width="lg">
      <Link
        href={backHref}
        className="mb-10 inline-block text-sm text-zinc-500 transition hover:text-white"
      >
        ← {backLabel}
      </Link>

      <PageHeader eyebrow={eyebrow} title={title} description={description} />

      <div className="space-y-8 leading-relaxed text-zinc-400">
        {sections.map((section, index) => (
          <Panel
            key={`${section.id ?? "section"}-${index}`}
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
                  <li key={`${section.id ?? index}-bullet-${bulletIndex}`}>{item}</li>
                ))}
              </ul>
            )}
          </Panel>
        ))}

        {(effectiveDate || reviewedDate) && (
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
        )}
      </div>
    </PageShell>
  );
}
