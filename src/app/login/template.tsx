import type { ReactNode } from "react";
import Link from "next/link";

const footerLinks = [
  { href: "/about", label: "About" },
  { href: "/guidelines", label: "Guidelines" },
  { href: "/safety", label: "Safety" },
  { href: "/terms", label: "Terms" },
  { href: "/privacy", label: "Privacy" },
  { href: "/cookies", label: "Cookies" },
  { href: "/accessibility", label: "Accessibility" },
  { href: "/contact", label: "Contact" },
];

export default function LoginTemplate({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-stone-50 text-slate-900">
      {children}
      <footer className="border-t border-slate-300 bg-stone-50 px-6 py-8 text-sm text-slate-600">
        <div className="mx-auto flex max-w-7xl flex-col gap-5 md:flex-row md:items-center md:justify-between">
          <p>© 2026 Loombus. All rights reserved.</p>
          <nav aria-label="Loombus policies" className="flex flex-wrap gap-x-6 gap-y-3">
            {footerLinks.map((link) => (
              <Link key={link.href} href={link.href} className="font-medium hover:text-slate-950">
                {link.label}
              </Link>
            ))}
          </nav>
        </div>
      </footer>
    </div>
  );
}
