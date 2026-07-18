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
  title: "Requests Safety",
  description: "Safety and accountability guidance for using Loombus Requests.",
  alternates: { canonical: "https://loombus.com/requests/safety" },
};

const SAFETY_CARDS: Array<{
  Icon: LucideIcon;
  title: string;
  body: string;
}> = [
  {
    Icon: UserCheck,
    title: "Verify the person or business",
    body: "Review the attributable profile, ask for relevant credentials, and independently confirm licenses or insurance when the work requires them.",
  },
  {
    Icon: Banknote,
    title: "Keep payment terms explicit",
    body: "Loombus does not process request payments or escrow funds. Confirm the price, deposit, cancellation terms, and deliverables in writing.",
  },
  {
    Icon: ShieldCheck,
    title: "Protect private information",
    body: "Do not post sensitive addresses, identification numbers, account details, medical records, or access codes in a public Request.",
  },
  {
    Icon: BadgeAlert,
    title: "Report suspicious activity",
    body: "Report fraud, harassment, prohibited activity, misleading claims, or pressure to move into unsafe communication or payment channels.",
  },
];

export default function RequestsSafetyPage() {
  return (
    <main className="min-h-screen bg-[var(--loombus-page-bg)] px-4 py-10 text-[var(--loombus-text)] sm:px-6">
      <div className="mx-auto max-w-5xl space-y-6">
        <header className="rounded-[2rem] border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-7 sm:p-10">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-[var(--loombus-text-subtle)]">
            Requests safety
          </p>
          <h1 className="mt-3 text-4xl font-semibold sm:text-5xl">
            A request starts a connection. It is not a guarantee.
          </h1>
          <p className="mt-4 max-w-3xl text-base leading-7 text-[var(--loombus-text-muted)]">
            Loombus keeps requesters and responders attributable, but members
            remain responsible for checking identity, qualifications, scope,
            pricing, location, and safety before meeting or paying anyone.
          </p>
        </header>

        <section className="grid gap-4 md:grid-cols-2">
          {SAFETY_CARDS.map(({ Icon, title, body }) => (
            <article
              key={title}
              className="rounded-[1.6rem] border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-6"
            >
              <Icon
                size={22}
                className="text-[var(--loombus-text-subtle)]"
              />
              <h2 className="mt-4 text-xl font-semibold">{title}</h2>
              <p className="mt-2 text-sm leading-6 text-[var(--loombus-text-muted)]">
                {body}
              </p>
            </article>
          ))}
        </section>

        <section className="rounded-[1.6rem] border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-6 text-sm leading-7 text-[var(--loombus-text-muted)]">
          Requests may not be used for illegal services, regulated weapons,
          controlled substances, exploitation, harassment, discriminatory
          exclusions, identity fraud, financial scams, or attempts to bypass
          Loombus safety controls. Private Room Request Centers should be used
          for needs that must stay inside an organization or community.
        </section>

        <div className="flex flex-wrap gap-3">
          <Link
            href="/requests"
            className="rounded-full bg-[var(--loombus-primary-bg)] px-5 py-3 text-sm font-semibold text-[var(--loombus-primary-text)]"
          >
            Browse Requests
          </Link>
          <Link
            href="/requests/manage"
            className="rounded-full border border-[var(--loombus-border)] px-5 py-3 text-sm font-semibold"
          >
            Manage Requests
          </Link>
        </div>
      </div>
    </main>
  );
}
