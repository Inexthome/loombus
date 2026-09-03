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

function getSmsAuthenticationSection(title: string): PublicPolicySection | null {
  if (title === "Privacy Policy") {
    return {
      id: "mobile-sms-auth",
      title: "Mobile Numbers and SMS Authentication",
      paragraphs: [
        <>
          You may voluntarily provide a mobile phone number to use supported
          phone-based sign-in or to add and verify a mobile number on your Loombus
          account. Loombus may use that number to send one-time passcodes and
          closely related transactional authentication or account-verification
          messages that you request. This SMS authentication program is not used
          for marketing or promotional messages.
        </>,
        <>
          Message frequency varies based on your user-initiated sign-in,
          verification, or account-security requests. Message and data rates may
          apply according to your mobile carrier and plan. SMS delivery can depend
          on your carrier, network, device, and service-provider availability.
        </>,
        <>
          Your full mobile number is not displayed on your public Loombus profile.
          Loombus does not sell, rent, or share mobile phone numbers or SMS opt-in
          consent with third parties or affiliates for their own marketing or
          promotional purposes. Loombus may disclose mobile-number information to
          authentication, telecommunications, SMS-delivery, security, hosting, or
          infrastructure providers only as reasonably necessary to provide,
          protect, troubleshoot, or comply with legal requirements for the service.
        </>,
        <>
          Phone-number discovery is off by default and is separate from consent to
          receive an authentication code. Enabling a supported discovery setting
          does not make your phone number public. Where available, you may use
          another supported Loombus sign-in method instead of phone-based sign-in.
          See the{" "}
          <Link href="/terms" className="text-zinc-200 underline-offset-4 hover:underline">
            Terms of Service
          </Link>{" "}
          for additional SMS authentication terms.
        </>,
      ],
    };
  }

  if (title === "Terms of Service") {
    return {
      id: "sms-authentication",
      title: "Phone Sign-In and SMS Authentication",
      paragraphs: [
        <>
          If you enter a mobile phone number and request a one-time code, you
          consent to receive transactional SMS messages from Loombus for
          phone-based sign-in, mobile-number verification, and closely related
          account authentication. Loombus does not use this SMS authentication
          program for marketing or promotional messages.
        </>,
        <>
          Message frequency varies based on your user-initiated authentication or
          verification requests. Message and data rates may apply. You represent
          that you control the number you provide or are otherwise authorized to
          use it for this purpose. Keep verification codes confidential and notify
          Loombus if you believe a code or account has been compromised.
        </>,
        <>
          SMS delivery is not guaranteed and may be delayed or unavailable because
          of mobile-carrier, network, device, filtering, provider, or technical
          conditions outside Loombus&apos;s control. Where available, you may use
          another supported sign-in method instead of phone-based sign-in.
        </>,
        <>
          Loombus&apos;s handling of mobile numbers and SMS consent is governed by
          the{" "}
          <Link href="/privacy" className="text-zinc-200 underline-offset-4 hover:underline">
            Privacy Policy
          </Link>
          , including the restrictions on public display and marketing-related
          sharing of mobile information.
        </>,
      ],
    };
  }

  return null;
}

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
  const smsAuthenticationSection = getSmsAuthenticationSection(title);
  const renderedSections = smsAuthenticationSection
    ? [...sections, smsAuthenticationSection]
    : sections;
  const renderedReviewedDate = smsAuthenticationSection
    ? "September 3, 2026"
    : reviewedDate;

  const jumpSections = renderedSections.reduce<
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
          {renderedSections.map((section, index) => (
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

          {(effectiveDate || renderedReviewedDate) && (
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
                {renderedReviewedDate && <p>Last reviewed: {renderedReviewedDate}</p>}
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
