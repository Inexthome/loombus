import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Login to Loombus | Loombus",
  description:
    "Login to Loombus to continue your discussions, replies, saved ideas, and community activity.",
  alternates: {
    canonical: "https://loombus.com/login",
  },
};

const footerLinks = [
  { href: "/forgot-password", label: "Forgot password" },
  { href: "/about", label: "About" },
  { href: "/guidelines", label: "Guidelines" },
  { href: "/safety", label: "Safety" },
  { href: "/terms", label: "Terms" },
  { href: "/privacy", label: "Privacy" },
  { href: "/cookies", label: "Cookies" },
  { href: "/accessibility", label: "Accessibility" },
  { href: "/contact", label: "Contact" },
];

export default function LoginLayout({ children }: { children: ReactNode }) {
  return (
    <div className="relative bg-[color:var(--loombus-page-bg)] pb-20 text-[color:var(--loombus-text)]">
      {children}

      <Link
        href="/forgot-password"
        className="fixed bottom-4 left-1/2 z-40 -translate-x-1/2 whitespace-nowrap rounded-full border border-[color:var(--loombus-border)] bg-[color:var(--loombus-surface)] px-5 py-3 text-sm font-semibold text-[color:var(--loombus-text)] shadow-2xl shadow-black/20 transition hover:border-[color:var(--loombus-text-muted)] hover:bg-[color:var(--loombus-surface-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--loombus-text-muted)]"
      >
        Forgot password?
      </Link>

      <footer className="border-t border-[color:var(--loombus-border)] bg-[color:var(--loombus-surface)] px-6 py-8 text-sm text-[color:var(--loombus-text-muted)] sm:px-10">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-5 md:flex-row">
          <p>© {new Date().getFullYear()} Loombus. All rights reserved.</p>

          <nav className="flex flex-wrap justify-center gap-x-6 gap-y-3">
            {footerLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="transition hover:text-[color:var(--loombus-text)]"
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </div>
      </footer>
    </div>
  );
}
