import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Create an account | Loombus",
  description:
    "Create a Loombus account and join a platform built for thoughtful discussions instead of endless scrolling.",
  alternates: {
    canonical: "https://loombus.com/signup",
  },
};

const footerLinks = [
  { href: "/login", label: "Sign in" },
  { href: "/about", label: "About" },
  { href: "/guidelines", label: "Guidelines" },
  { href: "/safety", label: "Safety" },
  { href: "/terms", label: "Terms" },
  { href: "/privacy", label: "Privacy" },
  { href: "/cookies", label: "Cookies" },
  { href: "/accessibility", label: "Accessibility" },
  { href: "/support", label: "Support" },
];

export default function SignupLayout({ children }: { children: ReactNode }) {
  return (
    <div className="bg-[color:var(--loombus-page-bg)] text-[color:var(--loombus-text)]">
      {children}

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
