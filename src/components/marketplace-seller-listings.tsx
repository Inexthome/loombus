"use client";

import Link from "next/link";
import {
  Check,
  ExternalLink,
  PackageCheck,
  Pencil,
  RefreshCcw,
  Trash2,
} from "lucide-react";
import {
  marketplacePriceLabel,
  marketplaceStatusLabel,
  type MarketplaceListing,
} from "@/lib/marketplace";

type Props = {
  listings: MarketplaceListing[];
  working: boolean;
  onRefresh: () => void | Promise<void>;
  startEdit: (listing: MarketplaceListing) => void;
  sellerAction: (
    action: "sold" | "reopen" | "remove",
    listingId: string,
  ) => void | Promise<void>;
};

const secondaryButton =
  "inline-flex min-h-10 items-center justify-center gap-2 rounded-full border border-[color:var(--loombus-border)] px-3 text-sm font-semibold transition hover:border-[color:var(--loombus-gold)] hover:bg-[color:var(--loombus-surface-muted)] disabled:opacity-50";

function statusClass(status: MarketplaceListing["status"]) {
  if (status === "published") return "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300";
  if (status === "pending") return "bg-amber-500/10 text-amber-700 dark:text-amber-300";
  if (status === "rejected" || status === "suspended") return "bg-red-500/10 text-red-700 dark:text-red-300";
  return "bg-[color:var(--loombus-surface-muted)] text-[color:var(--loombus-text-muted)]";
}

export function MarketplaceSellerListings({
  listings,
  working,
  onRefresh,
  startEdit,
  sellerAction,
}: Props) {
  return (
    <section className="overflow-hidden rounded-[1.75rem] border border-[color:var(--loombus-border)] bg-[color:var(--loombus-surface)] shadow-xl shadow-black/10">
      <div className="flex flex-col gap-4 border-b border-[color:var(--loombus-border-muted)] px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.28em] text-[color:var(--loombus-gold)]">Listing records</p>
          <h2 className="mt-1 text-2xl font-semibold tracking-[-0.035em]">Your Marketplace lifecycle</h2>
          <p className="mt-2 text-sm leading-6 text-[color:var(--loombus-text-muted)]">
            Continue drafts, edit active records, mark items sold, reopen closed listings, or remove them from your workspace.
          </p>
        </div>
        <button type="button" onClick={() => void onRefresh()} className={secondaryButton}>
          <RefreshCcw size={16} /> Refresh
        </button>
      </div>

      <div className="divide-y divide-[color:var(--loombus-border-muted)]">
        {listings.map((listing) => (
          <article key={listing.id} className="p-5 sm:p-6">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
              <div className="flex min-w-0 gap-4">
                {listing.photos[0]?.url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={listing.photos[0].url} alt="" className="h-24 w-28 shrink-0 rounded-2xl object-cover" />
                ) : (
                  <span className="grid h-24 w-28 shrink-0 place-items-center rounded-2xl bg-[color:var(--loombus-cream)] text-[color:var(--loombus-gold)] dark:bg-[color:var(--loombus-gold-soft)]">
                    <PackageCheck size={28} />
                  </span>
                )}
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`rounded-full px-3 py-1 text-xs font-semibold ${statusClass(listing.status)}`}>
                      {marketplaceStatusLabel(listing.status)}
                    </span>
                    <span className="rounded-full border border-[color:var(--loombus-border)] px-3 py-1 text-xs font-semibold text-[color:var(--loombus-text-muted)]">
                      {listing.category}
                    </span>
                    {listing.businessName ? (
                      <span className="text-xs text-[color:var(--loombus-text-muted)]">{listing.businessName}</span>
                    ) : null}
                  </div>
                  <h3 className="mt-3 text-xl font-semibold tracking-[-0.025em]">{listing.title || "Untitled draft"}</h3>
                  <p className="mt-2 font-semibold text-[color:var(--loombus-text)]">
                    {listing.status === "draft" ? "Saved privately" : marketplacePriceLabel(listing)}
                  </p>
                  {listing.moderationReason ? (
                    <p className="mt-3 rounded-2xl bg-[color:var(--loombus-page-bg)] p-4 text-sm leading-6 text-[color:var(--loombus-text-muted)]">
                      Review note: {listing.moderationReason}
                    </p>
                  ) : null}
                </div>
              </div>

              <div className="flex shrink-0 flex-wrap gap-2 lg:max-w-[21rem] lg:justify-end">
                {!['sold', 'removed'].includes(listing.status) ? (
                  <button type="button" onClick={() => startEdit(listing)} className={secondaryButton}>
                    <Pencil size={15} /> {listing.status === "draft" ? "Continue editing" : "Edit"}
                  </button>
                ) : null}
                {listing.status === "published" ? (
                  <Link href={`/marketplace/${listing.slug}`} className={secondaryButton}>
                    <ExternalLink size={14} /> Open public listing
                  </Link>
                ) : null}
                {listing.status === "published" ? (
                  <button type="button" disabled={working} onClick={() => void sellerAction("sold", listing.id)} className={secondaryButton}>
                    <Check size={15} /> Mark sold
                  </button>
                ) : null}
                {['sold', 'expired', 'removed'].includes(listing.status) ? (
                  <button type="button" disabled={working} onClick={() => void sellerAction("reopen", listing.id)} className={secondaryButton}>
                    <RefreshCcw size={15} /> Reopen
                  </button>
                ) : null}
                {listing.status !== "removed" ? (
                  <button
                    type="button"
                    disabled={working}
                    onClick={() => void sellerAction("remove", listing.id)}
                    className="inline-flex min-h-10 items-center justify-center gap-2 rounded-full border border-red-500/30 px-3 text-sm font-semibold text-red-700 transition hover:bg-red-500/10 disabled:opacity-50 dark:text-red-300"
                  >
                    <Trash2 size={15} /> Remove
                  </button>
                ) : null}
              </div>
            </div>
          </article>
        ))}

        {listings.length === 0 ? (
          <div className="p-10 text-center text-sm text-[color:var(--loombus-text-muted)]">
            You have not created a Marketplace listing yet.
          </div>
        ) : null}
      </div>
    </section>
  );
}
