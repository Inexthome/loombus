import type { Metadata } from "next";
import { LEGAL_LINKS } from "@/lib/legal-links";

export const metadata: Metadata = {
  title: "Legal Center | Loombus",
  description: "Loombus legal, privacy, safety, billing, and accessibility documents.",
  alternates: {
    canonical: LEGAL_LINKS.center,
  },
};

const documents = [
  ["Privacy Policy", LEGAL_LINKS.privacy],
  ["Terms", LEGAL_LINKS.terms],
  ["Community Guidelines", LEGAL_LINKS.communityGuidelines],
  ["Cookies", LEGAL_LINKS.cookies],
  ["Refund Policy", LEGAL_LINKS.refunds],
  ["Copyright / DMCA", LEGAL_LINKS.dmca],
  ["Accessibility", LEGAL_LINKS.accessibility],
] as const;

export default function LegalCenterPage() {
  return (
    <main className="min-h-screen bg-black px-6 py-16 text-white">
      <div className="mx-auto max-w-3xl">
        <a
          href="https://loombus.com"
          className="text-sm font-semibold tracking-[0.18em] text-[#CBAB5B] uppercase"
        >
          Loombus
        </a>
        <h1 className="mt-6 text-4xl font-semibold tracking-tight">Legal Center</h1>
        <div className="mt-10 divide-y divide-white/10 border-y border-white/10">
          {documents.map(([label, href]) => (
            <a
              key={href}
              href={href}
              className="flex items-center justify-between gap-6 py-5 text-base font-medium transition-opacity hover:opacity-70"
            >
              <span>{label}</span>
              <span aria-hidden="true" className="text-[#CBAB5B]">
                →
              </span>
            </a>
          ))}
        </div>
        <p className="mt-8 text-sm text-white/60">
          © {new Date().getFullYear()} Loombus. Signal over noise.
        </p>
      </div>
    </main>
  );
}
