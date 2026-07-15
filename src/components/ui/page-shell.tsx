import Link from "next/link";
import type { ReactNode } from "react";
import styles from "./reference-v2.module.css";

type PageShellProps = {
  children: ReactNode;
  width?: "sm" | "md" | "lg" | "xl";
  className?: string;
};

const widthClass = {
  sm: styles.widthSm,
  md: styles.widthMd,
  lg: styles.widthLg,
  xl: styles.widthXl,
};

// Shared navigation for the Guide, trust pages, safety references, and legal family.
const referenceLinks = [
  { href: "/settings/guide", label: "Guide" },
  { href: "/support", label: "Support" },
  { href: "/about", label: "About" },
  { href: "/guidelines", label: "Guidelines" },
  { href: "/safety", label: "Safety" },
  { href: "/privacy", label: "Privacy" },
  { href: "/cookies", label: "Cookies" },
  { href: "/terms", label: "Terms" },
  { href: "/refunds", label: "Refunds" },
  { href: "/dmca", label: "Copyright / DMCA" },
  { href: "/accessibility", label: "Accessibility" },
  { href: "/ai-usage", label: "AI Usage" },
];

export function PageShell({
  children,
  width = "lg",
  className = "",
}: PageShellProps) {
  return (
    <main className={`${styles.page} ${className}`}>
      <div className={`${styles.shell} ${widthClass[width]}`}>
        <nav className={styles.referenceBar} aria-label="Loombus Trust and Reference">
          <Link href="/" className={styles.referenceBrand}>
            <span className={styles.referenceBrandMark} aria-hidden="true">
              L
            </span>
            Trust & Reference
          </Link>

          <div className={styles.referenceLinks}>
            {referenceLinks.map((item) => (
              <Link key={item.href} href={item.href} className={styles.referenceLink}>
                {item.label}
              </Link>
            ))}
          </div>
        </nav>

        {children}

        <footer className={styles.footer}>
          <div>
            <p className={styles.footerEyebrow}>Loombus Trust & Reference</p>
            <p className={styles.footerCopy}>
              Platform guidance, community expectations, legal information, and
              support resources are maintained together so members can find the
              relevant answer without searching across disconnected pages.
            </p>
          </div>
          <div className={styles.footerActions}>
            <Link href="/support" className={styles.footerAction}>
              Contact support
            </Link>
            <Link href="/" className={styles.footerAction}>
              Return to Loombus
            </Link>
          </div>
        </footer>
      </div>
    </main>
  );
}
