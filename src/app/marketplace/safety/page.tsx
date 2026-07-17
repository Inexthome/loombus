import type { Metadata } from "next";
import Link from "next/link";
import { AlertTriangle, BadgeCheck, ShieldCheck, WalletCards } from "lucide-react";

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

const saferExchange = [
  "Confirm the seller identity, item condition, total price, and delivery terms before agreeing.",
  "Meet in a visible public location when local pickup is appropriate. Do not enter an unfamiliar private location alone.",
  "Do not send passwords, verification codes, government identification numbers, or banking credentials.",
  "Stop the transaction and report the listing when the item, seller, or payment request changes unexpectedly.",
];

export default function MarketplaceSafetyPage() {
  return (
    <main className="min-h-screen bg-[var(--loombus-page-bg)] px-4 py-8 text-[var(--loombus-text)] sm:px-6">
      <div className="mx-auto max-w-5xl">
        <section className="rounded-[2rem] border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-6 sm:p-8">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-[var(--loombus-text-subtle)]">
            <ShieldCheck size={17} /> Marketplace trust
          </div>
          <h1 className="mt-3 text-4xl font-semibold tracking-[-0.04em] sm:text-5xl">
            Safety, accountability, and transaction boundaries
          </h1>
          <p className="mt-4 max-w-3xl text-base leading-8 text-[var(--loombus-text-muted)]">
            Loombus provides attributable listings, moderation, reporting, saved-item status, and profile-based communication. Loombus does not process Marketplace payments, hold funds, provide escrow, arrange shipping, inspect items, or guarantee a transaction.
          </p>
          <Link
            href="/marketplace"
            className="mt-6 inline-flex rounded-xl bg-[var(--loombus-text)] px-4 py-3 font-semibold text-[var(--loombus-page-bg)]"
          >
            Return to Marketplace
          </Link>
        </section>

        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <section className="rounded-[1.6rem] border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-6">
            <div className="flex items-center gap-2">
              <AlertTriangle size={20} />
              <h2 className="text-xl font-semibold">Listings that are not allowed</h2>
            </div>
            <ul className="mt-4 space-y-3 text-sm leading-6 text-[var(--loombus-text-muted)]">
              {prohibited.map((item) => (
                <li key={item} className="rounded-xl bg-[var(--loombus-page-bg)] p-4">
                  {item}
                </li>
              ))}
            </ul>
          </section>

          <section className="rounded-[1.6rem] border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-6">
            <div className="flex items-center gap-2">
              <BadgeCheck size={20} />
              <h2 className="text-xl font-semibold">Safer buyer and seller practices</h2>
            </div>
            <ol className="mt-4 space-y-3 text-sm leading-6 text-[var(--loombus-text-muted)]">
              {saferExchange.map((item, index) => (
                <li key={item} className="flex gap-3 rounded-xl bg-[var(--loombus-page-bg)] p-4">
                  <strong>{index + 1}.</strong>
                  <span>{item}</span>
                </li>
              ))}
            </ol>
          </section>
        </div>

        <section className="mt-6 rounded-[1.6rem] border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-6">
          <div className="flex items-center gap-2">
            <WalletCards size={20} />
            <h2 className="text-xl font-semibold">Payment and dispute boundary</h2>
          </div>
          <p className="mt-3 leading-7 text-[var(--loombus-text-muted)]">
            Any payment, refund, delivery, return, warranty, or dispute occurs directly between the buyer and seller. A Loombus profile, business verification badge, listing approval, or Signal placement is not a transaction guarantee. Never treat an off-platform payment request as endorsed by Loombus.
          </p>
        </section>
      </div>
    </main>
  );
}
