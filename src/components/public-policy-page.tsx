import type { ReactNode } from "react";
import Link from "next/link";
import { PolicyPrintButton } from "@/components/policy-content/policy-print-button";
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

const focusRing =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--loombus-gold)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--loombus-bg)]";

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
    <main className={styles.page}>
      <div data-policy-print-root className={`${styles.printRoot} ${styles.shell}`}>
        <div className={styles.utilityRow} data-policy-screen-only>
          <Link href={backHref} className={`${styles.backLink} ${focusRing}`}>
            ← {backLabel}
          </Link>
          <PolicyPrintButton />
        </div>

        <header className={styles.header}>
          <p className={styles.eyebrow}>{eyebrow}</p>
          <h1>{title}</h1>
          <div className={styles.description}>{description}</div>
        </header>

        {jumpSections.length > 0 ? (
          <nav
            aria-label="Jump to section"
            data-policy-screen-only
            className={styles.jumpNav}
          >
            <p>On this page</p>
            <ol>
              {jumpSections.map((section) => (
                <li key={section.id}>
                  <a href={`#${section.id}`} className={focusRing}>
                    <span>{String(section.number).padStart(2, "0")}</span>
                    {section.title}
                  </a>
                </li>
              ))}
            </ol>
          </nav>
        ) : null}

        <div className={styles.sections}>
          {sections.map((section, index) => (
            <section
              key={`${section.id ?? "section"}-${index}`}
              data-policy-print-section
              className={`${styles.printSection} ${styles.section} ${
                section.tone === "danger" ? styles.danger : ""
              }`}
            >
              <div className={styles.sectionHeading}>
                <span aria-hidden="true">{String(index + 1).padStart(2, "0")}</span>
                <h2 id={section.id} className="scroll-mt-28">{section.title}</h2>
              </div>

              <div className={styles.sectionBody}>
                {section.paragraphs?.map((paragraph, paragraphIndex) => (
                  <p key={`${section.id ?? index}-paragraph-${paragraphIndex}`}>
                    {paragraph}
                  </p>
                ))}

                {section.bullets && section.bullets.length > 0 ? (
                  <ul>
                    {section.bullets.map((item, bulletIndex) => (
                      <li key={`${section.id ?? index}-bullet-${bulletIndex}`}>
                        {item}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            </section>
          ))}

          {(effectiveDate || reviewedDate) && (
            <section
              data-policy-print-section
              className={`${styles.printSection} ${styles.section} ${styles.documentStatus}`}
            >
              <div className={styles.sectionHeading}>
                <span aria-hidden="true">—</span>
                <h2>Document status</h2>
              </div>
              <div className={styles.sectionBody}>
                {effectiveDate && <p>Effective date: {effectiveDate}</p>}
                {reviewedDate && <p>Last reviewed: {reviewedDate}</p>}
                <p className={styles.statusNote}>
                  This public explanation describes the current Loombus service and may
                  be updated as features, operational practices, or legal requirements
                  change.
                </p>
              </div>
            </section>
          )}
        </div>
      </div>
    </main>
  );
}
