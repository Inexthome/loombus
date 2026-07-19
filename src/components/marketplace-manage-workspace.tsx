import Link from "next/link";
import {
  ArrowUpRight,
  Bookmark,
  ChevronRight,
  PackageCheck,
  ShieldCheck,
  Store,
} from "lucide-react";
import MarketplaceAdminMetrics from "@/components/marketplace-admin-metrics";
import MarketplaceManagerPage from "@/components/marketplace-manager-page";

export default function MarketplaceManageWorkspace() {
  return (
    <div className="min-h-screen bg-[color:var(--loombus-page-bg)] px-4 pb-24 pt-5 text-[color:var(--loombus-text)] sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[88rem]">
        <header className="mb-6 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <h1 className="text-4xl font-semibold tracking-[-0.055em] sm:text-5xl">
              Manage Marketplace
            </h1>
            <p className="mt-3 text-base leading-7 text-[color:var(--loombus-text-muted)]">
              Create attributable listings, manage drafts and active inventory, review status changes, and keep Marketplace activity connected to the original seller.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href="/marketplace/saved"
              className="inline-flex h-12 items-center gap-2 rounded-2xl border border-[color:var(--loombus-border)] bg-[color:var(--loombus-surface)] px-4 text-sm font-semibold shadow-sm transition hover:border-[color:var(--loombus-gold)]"
            >
              <Bookmark size={16} className="text-[color:var(--loombus-gold)]" /> Saved items
            </Link>
            <Link
              href="/marketplace"
              className="inline-flex h-12 items-center gap-2 rounded-2xl bg-[color:var(--loombus-gold)] px-4 text-sm font-semibold text-[color:var(--loombus-gold-contrast)] transition hover:opacity-90"
            >
              Browse Marketplace <ArrowUpRight size={16} />
            </Link>
          </div>
        </header>

        <section className="mb-6 grid gap-3 sm:grid-cols-3">
          <article className="rounded-[1.4rem] border border-[color:var(--loombus-gold)] bg-[color:var(--loombus-cream)] p-4 text-[color:var(--loombus-cream-contrast)] shadow-sm dark:bg-[color:var(--loombus-gold-soft)] dark:text-[color:var(--loombus-text)]">
            <span className="text-xs font-bold uppercase tracking-[0.18em] text-[color:var(--loombus-gold)]">Seller workspace</span>
            <strong className="mt-2 block text-lg tracking-[-0.025em]">Create and manage listings</strong>
          </article>
          <article className="rounded-[1.4rem] border border-[color:var(--loombus-border)] bg-[color:var(--loombus-surface)] p-4 shadow-sm">
            <span className="text-xs font-bold uppercase tracking-[0.18em] text-[color:var(--loombus-text-muted)]">Attribution</span>
            <strong className="mt-2 block text-lg tracking-[-0.025em]">Personal or approved business</strong>
          </article>
          <article className="rounded-[1.4rem] border border-[color:var(--loombus-border)] bg-[color:var(--loombus-surface)] p-4 shadow-sm">
            <span className="text-xs font-bold uppercase tracking-[0.18em] text-[color:var(--loombus-text-muted)]">Transactions</span>
            <strong className="mt-2 block text-lg tracking-[-0.025em]">Handled directly by members</strong>
          </article>
        </section>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_21rem]">
          <section className="min-w-0">
            <div className="[&>main]:min-h-0 [&>main]:bg-transparent [&>main>div]:max-w-none [&>main>div]:px-0 [&>main>div]:py-0 [&>main>div>section:first-child]:hidden">
              <MarketplaceManagerPage />
            </div>
            <MarketplaceAdminMetrics />
          </section>

          <aside className="space-y-5 xl:sticky xl:top-28 xl:self-start">
            <section className="rounded-[1.75rem] border border-[color:var(--loombus-border)] bg-[color:var(--loombus-surface)] p-5 shadow-2xl shadow-black/10">
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs font-bold uppercase tracking-[0.3em]">Workspace guide</p>
                <Store className="h-5 w-5 text-[color:var(--loombus-gold)]" />
              </div>
              <div className="mt-4 space-y-3 text-sm leading-6 text-[color:var(--loombus-text-muted)]">
                <div className="rounded-2xl bg-[color:var(--loombus-page-bg)] p-4">
                  <strong className="block text-[color:var(--loombus-text)]">1. Build the listing</strong>
                  Add clear condition, price, location, fulfillment options, photos, and item-specific attributes.
                </div>
                <div className="rounded-2xl bg-[color:var(--loombus-page-bg)] p-4">
                  <strong className="block text-[color:var(--loombus-text)]">2. Save or submit</strong>
                  Drafts remain private. Submitted listings enter administrator review before publication.
                </div>
                <div className="rounded-2xl bg-[color:var(--loombus-page-bg)] p-4">
                  <strong className="block text-[color:var(--loombus-text)]">3. Maintain status</strong>
                  Edit, mark sold, reopen, or remove listings from the seller records below the editor.
                </div>
              </div>
            </section>

            <section className="rounded-[1.75rem] border border-[color:var(--loombus-border)] bg-[color:var(--loombus-surface)] p-5 shadow-2xl shadow-black/10">
              <p className="text-xs font-bold uppercase tracking-[0.3em]">Marketplace tools</p>
              <div className="mt-4 space-y-2">
                <Link href="/marketplace" className="flex items-center justify-between rounded-2xl bg-[color:var(--loombus-page-bg)] px-4 py-3 text-sm font-semibold transition hover:bg-[color:var(--loombus-surface-muted)]">
                  Browse listings <ChevronRight className="h-4 w-4 text-[color:var(--loombus-gold)]" />
                </Link>
                <Link href="/marketplace/saved" className="flex items-center justify-between rounded-2xl bg-[color:var(--loombus-page-bg)] px-4 py-3 text-sm font-semibold transition hover:bg-[color:var(--loombus-surface-muted)]">
                  Saved items <ChevronRight className="h-4 w-4 text-[color:var(--loombus-gold)]" />
                </Link>
                <Link href="/messages" className="flex items-center justify-between rounded-2xl bg-[color:var(--loombus-page-bg)] px-4 py-3 text-sm font-semibold transition hover:bg-[color:var(--loombus-surface-muted)]">
                  Marketplace messages <ChevronRight className="h-4 w-4 text-[color:var(--loombus-gold)]" />
                </Link>
              </div>
            </section>

            <section className="rounded-[1.75rem] border border-[color:var(--loombus-border)] bg-[color:var(--loombus-surface)] p-5 shadow-2xl shadow-black/10">
              <div className="flex gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[color:var(--loombus-cream)] text-[color:var(--loombus-gold)] dark:bg-[color:var(--loombus-gold-soft)]">
                  <PackageCheck className="h-5 w-5" />
                </span>
                <div>
                  <h3 className="font-semibold">Seller accountability</h3>
                  <p className="mt-1 text-sm leading-6 text-[color:var(--loombus-text-muted)]">
                    Keep listing status accurate and remove unavailable items. Business attribution is available only for published profiles you control.
                  </p>
                </div>
              </div>
            </section>

            <section className="rounded-[1.75rem] border border-[color:var(--loombus-border)] bg-[color:var(--loombus-surface)] p-5 shadow-2xl shadow-black/10">
              <div className="flex gap-3">
                <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-[color:var(--loombus-gold)]" />
                <p className="text-sm leading-6 text-[color:var(--loombus-text-muted)]">
                  Loombus does not process Marketplace payments, hold funds, arrange shipping, or guarantee item condition. Members must confirm material details directly.
                </p>
              </div>
            </section>
          </aside>
        </div>
      </div>
    </div>
  );
}
