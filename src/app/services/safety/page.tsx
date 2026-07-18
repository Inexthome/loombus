import type { Metadata } from "next";
import Link from "next/link";
import {
  BadgeAlert,
  Banknote,
  ShieldCheck,
  UserCheck,
  type LucideIcon,
} from "lucide-react";

export const metadata: Metadata = {
  title: "Services Safety",
  description:
    "Safety and accountability guidance for using Loombus Services.",
  alternates: { canonical: "https://loombus.com/services/safety" },
};

const SAFETY_CARDS: Array<{
  Icon: LucideIcon;
  title: string;
  body: string;
}> = [
  {
    Icon: UserCheck,
    title: "Verify the provider",
    body: "Review the attributable profile and independently confirm licenses, insurance, credentials, references, and experience when the work requires them.",
  },
  {
    Icon: Banknote,
    title: "Confirm scope and payment terms",
    body: "Loombus does not process payments or hold escrow. Confirm deliverables, price, deposits, cancellation terms, and change orders in writing.",
  },
  {
    Icon: ShieldCheck,
    title: "Protect private information",
    body: "Do not post addresses, access codes, identification numbers, financial details, or sensitive records in a public inquiry or Service listing.",
  },
  {
    Icon: BadgeAlert,
    title: "Report suspicious listings",
    body: "Report fraud, misleading claims, prohibited activity, harassment, discrimination, or pressure to use unsafe communication or payment channels.",
  },
];

export default function ServicesSafetyPage() {
  return (
    <main className="min-h-screen bg-[var(--loombus-page-bg)] px-4 py-10 text-[var(--loombus-text)] sm:px-6">
      <div className="mx-auto max-w-5xl space-y-6">
        <header className="rounded-[2rem] border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-7 sm:p-10">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-[var(--loombus-text-subtle)]">
            Services safety
          </p>
          <h1 className="mt-3 text-4xl font-semibold sm:text-5xl">
            A published Service is attributable. It is not guaranteed.
          </h1>
          <p className="mt-4 max-w-3xl text-base leading-7 text-[var(--loombus-text-muted)]">
            Loombus connects providers and customers through structured
            inquiries, Requests, conversations, and Appointments. Members remain
            responsible for verifying qualifications, terms, safety, and payment.
          </p>
        </header>

        <section className="grid gap-4 md:grid-cols-2">
          {SAFETY_CARDS.map(({ Icon, title, body }) => (
            <article
              key={title}
              className="rounded-[1.6rem] border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-6"
            >
              <Icon size={22} className="text-[var(--loombus-text-subtle)]" />
              <h2 className="mt-4 text-xl font-semibold">{title}</h2>
              <p className="mt-2 text-sm leading-6 text-[var(--loombus-text-muted)]">
                {body}
              </p>
            </article>
          ))}
        </section>

        <section className="rounded-[1.6rem] border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-6 text-sm leading-7 text-[var(--loombus-text-muted)]">
          Services may not be used for illegal activity, regulated weapons,
          controlled substances, exploitation, harassment, discriminatory
          exclusions, identity fraud, financial scams, false credential claims,
          or attempts to bypass Loombus safety controls.
        </section>

        <div className="flex flex-wrap gap-3">
          <Link
            href="/services"
            className="rounded-full bg-[var(--loombus-primary-bg)] px-5 py-3 text-sm font-semibold text-[var(--loombus-primary-text)]"
          >
            Browse Services
          </Link>
          <Link
            href="/services/manage"
            className="rounded-full border border-[var(--loombus-border)] px-5 py-3 text-sm font-semibold"
          >
            Manage Services
          </Link>
        </div>
      </div>
    </main>
  );
}
