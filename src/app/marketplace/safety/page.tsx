import type { Metadata } from "next";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowLeft,
  BadgeCheck,
  ShieldCheck,
  WalletCards,
} from "lucide-react";
import "../marketplace-editorial.css";

export const metadata: Metadata = {
  title: "Marketplace Safety and Policy | Loombus",
  description:
    "Review Loombus Marketplace listing rules, transaction boundaries, reporting, and safer exchange practices.",
};

const prohibited = [
  "Weapons, ammunition, explosives, and restricted self-defense items",
  "Illegal or recreational drugs, alcohol, nicotine, tobacco, and prescription medication",
  "Counterfeit goods, stolen property, wildlife contraband, and hazardous materials",
  "Adult products, pornography, and regulated gambling items",
];

const checks = [
  {
    Icon: BadgeCheck,
    title: "Confirm the seller and item",
    body: "Confirm the seller identity, item condition, total price, and delivery terms before agreeing.",
  },
  {
    Icon: ShieldCheck,
    title: "Use a safer meeting location",
    body: "Meet in a visible public location when local pickup is appropriate. Do not enter an unfamiliar private location alone.",
  },
  {
    Icon: WalletCards,
    title: "Protect account information",
    body: "Do not send passwords, verification codes, government identification numbers, or banking credentials.",
  },
  {
    Icon: AlertTriangle,
    title: "Stop when details change",
    body: "Stop the transaction and report the listing when the item, seller, or payment request changes unexpectedly.",
  },
];

export default function MarketplaceSafetyPage() {
  return (
    <div data-marketplace-editorial="safety">
      <main className="min-h-screen bg-[color:var(--loombus-page-bg)] px-4 pb-20 pt-5 text-[color:var(--loombus-text)] sm:px-6 lg:px-8">
        <div className="mx-auto max-w-5xl">
          <Link href="/marketplace" className="inline-flex items-center gap-2 text-sm font-semibold text-[color:var(--loombus-text-muted)] transition hover:text-[color:var(--loombus-gold)]">
            <ArrowLeft size={16} /> Marketplace
          </Link>

          <header className="mt-5 border-b border-[color:var(--loombus-border-muted)] pb-7">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.28em] text-[color:var(--loombus-gold)]">
              <ShieldCheck size={16} /> Marketplace trust
            </div>
            <h1 className="mt-3 max-w-4xl text-4xl font-semibold tracking-[-0.05em] sm:text-5xl">
              Safety, accountability, and transaction boundaries
            </h1>
            <p className="mt-4 max-w-4xl text-base leading-8 text-[color:var(--loombus-text-muted)]">
              Loombus provides attributable listings, moderation, reporting, saved-item status, and profile-based communication. Loombus does not process Marketplace payments, hold funds, provide escrow, arrange shipping, inspect items, or guarantee a transaction.
            </p>
          </header>

          <section className="border-b border-[color:var(--loombus-border-muted)] py-7">
            <p className="text-xs font-bold uppercase tracking-[0.28em] text-[color:var(--loombus-gold)]">Practical checks</p>
            <h2 className="mt-1 text-2xl font-semibold tracking-[-0.035em]">Before you continue</h2>
            <div className="mt-5 divide-y divide-[color:var(--loombus-border-muted)] border-y border-[color:var(--loombus-border-muted)]">
              {checks.map(({ Icon, title, body }) => (
                <article key={title} className="grid gap-3 py-5 sm:grid-cols-[2.5rem_minmax(0,1fr)] sm:items-start">
                  <span className="grid h-10 w-10 place-items-center text-[color:var(--loombus-gold)]">
                    <Icon size={20} />
                  </span>
                  <div>
                    <h3 className="text-lg font-semibold">{title}</h3>
                    <p className="mt-1 text-sm leading-6 text-[color:var(--loombus-text-muted)]">{body}</p>
                  </div>
                </article>
              ))}
            </div>
          </section>

          <section className="border-b border-[color:var(--loombus-border-muted)] py-7">
            <p className="text-xs font-bold uppercase tracking-[0.28em] text-[color:var(--loombus-gold)]">Platform boundary</p>
            <h2 className="mt-1 text-2xl font-semibold tracking-[-0.035em]">Listings that are not allowed</h2>
            <ul className="mt-5 divide-y divide-[color:var(--loombus-border-muted)] border-y border-[color:var(--loombus-border-muted)]">
              {prohibited.map((item) => (
                <li key={item} className="flex gap-3 py-4 text-sm leading-6 text-[color:var(--loombus-text-muted)]">
                  <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[color:var(--loombus-gold)]" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </section>

          <section className="border-b border-[color:var(--loombus-border-muted)] py-7">
            <p className="text-xs font-bold uppercase tracking-[0.28em] text-[color:var(--loombus-gold)]">Payment and dispute boundary</p>
            <h2 className="mt-1 text-2xl font-semibold tracking-[-0.035em]">Transactions remain between buyer and seller</h2>
            <p className="mt-4 max-w-4xl text-sm leading-7 text-[color:var(--loombus-text-muted)]">
              Any payment, refund, delivery, return, warranty, or dispute occurs directly between the buyer and seller. A Loombus profile, business verification badge, listing approval, or Signal placement is not a transaction guarantee. Never treat an off-platform payment request as endorsed by Loombus.
            </p>
          </section>

          <section className="py-7">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.28em] text-[color:var(--loombus-gold)]">Continue safely</p>
                <p className="mt-2 text-sm text-[color:var(--loombus-text-muted)]">Return to listings, manage your own Marketplace activity, or review broader Loombus guidance.</p>
              </div>
              <div className="flex flex-wrap gap-4">
                <Link href="/marketplace" className="inline-flex min-h-11 items-center rounded-full bg-[color:var(--loombus-gold)] px-4 text-sm font-semibold text-[color:var(--loombus-gold-contrast)]">Return to Marketplace</Link>
                <Link href="/marketplace/manage" className="inline-flex min-h-11 items-center border-b border-[color:var(--loombus-border)] px-1 text-sm font-semibold hover:border-[color:var(--loombus-gold)]">Manage Marketplace</Link>
              </div>
            </div>
            <div className="mt-6 flex flex-wrap gap-x-6 gap-y-3 border-t border-[color:var(--loombus-border-muted)] pt-5 text-sm font-semibold text-[color:var(--loombus-text-muted)]">
              <Link href="/safety" className="hover:text-[color:var(--loombus-gold)]">Loombus Safety</Link>
              <Link href="/guidelines" className="hover:text-[color:var(--loombus-gold)]">Community Guidelines</Link>
              <Link href="/terms" className="hover:text-[color:var(--loombus-gold)]">Terms of Service</Link>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
