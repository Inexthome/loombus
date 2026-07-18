"use client";

import Link from "next/link";
import { Check, PackageCheck, Pencil, RefreshCcw, Trash2 } from "lucide-react";
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
    listingId: string
  ) => void | Promise<void>;
};

export function MarketplaceSellerListings({
  listings,
  working,
  onRefresh,
  startEdit,
  sellerAction,
}: Props) {
  return (
    <section className="mt-7">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold">Your listings</h2>
          <p className="mt-1 text-sm text-[var(--loombus-text-muted)]">
            Save private drafts, continue editing, submit for review, mark sold, reopen, or remove listings.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void onRefresh()}
          className="inline-flex items-center gap-2 rounded-xl border border-[var(--loombus-border)] px-4 py-2.5 font-semibold"
        >
          <RefreshCcw size={16} /> Refresh
        </button>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        {listings.map((listing) => (
          <article
            key={listing.id}
            className="rounded-[1.5rem] border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-5"
          >
            <div className="flex gap-4">
              {listing.photos[0]?.url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={listing.photos[0].url}
                  alt=""
                  className="h-24 w-28 shrink-0 rounded-xl object-cover"
                />
              ) : (
                <span className="flex h-24 w-28 shrink-0 items-center justify-center rounded-xl bg-[var(--loombus-surface-muted)]">
                  <PackageCheck size={26} />
                </span>
              )}
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-[var(--loombus-surface-muted)] px-3 py-1 text-xs font-semibold">
                    {marketplaceStatusLabel(listing.status)}
                  </span>
                  {listing.businessName ? (
                    <span className="text-xs text-[var(--loombus-text-muted)]">
                      {listing.businessName}
                    </span>
                  ) : null}
                </div>
                <h3 className="mt-2 text-xl font-semibold">
                  {listing.title || "Untitled draft"}
                </h3>
                {listing.status === "draft" ? (
                  <p className="mt-1 text-sm font-semibold text-[var(--loombus-text-muted)]">
                    Saved privately
                  </p>
                ) : (
                  <p className="mt-1 font-semibold">
                    {marketplacePriceLabel(listing)}
                  </p>
                )}
                {listing.moderationReason ? (
                  <p className="mt-2 text-sm leading-6 text-[var(--loombus-text-muted)]">
                    Review note: {listing.moderationReason}
                  </p>
                ) : null}
              </div>
            </div>
            <div className="mt-4 flex flex-wrap gap-2 border-t border-[var(--loombus-border)] pt-4">
              {!['sold', 'removed'].includes(listing.status) ? (
                <button
                  type="button"
                  onClick={() => startEdit(listing)}
                  className="inline-flex items-center gap-2 rounded-xl border border-[var(--loombus-border)] px-3 py-2 text-sm font-semibold"
                >
                  <Pencil size={15} />{" "}
                  {listing.status === "draft"
                    ? "Continue editing"
                    : "Edit"}
                </button>
              ) : null}
              {listing.status === "published" ? (
                <Link
                  href={`/marketplace/${listing.slug}`}
                  className="rounded-xl border border-[var(--loombus-border)] px-3 py-2 text-sm font-semibold"
                >
                  View public listing
                </Link>
              ) : null}
              {listing.status === "published" ? (
                <button
                  type="button"
                  disabled={working}
                  onClick={() => void sellerAction("sold", listing.id)}
                  className="inline-flex items-center gap-2 rounded-xl border border-[var(--loombus-border)] px-3 py-2 text-sm font-semibold"
                >
                  <Check size={15} /> Mark sold
                </button>
              ) : null}
              {['sold', 'expired', 'removed'].includes(listing.status) ? (
                <button
                  type="button"
                  disabled={working}
                  onClick={() => void sellerAction("reopen", listing.id)}
                  className="inline-flex items-center gap-2 rounded-xl border border-[var(--loombus-border)] px-3 py-2 text-sm font-semibold"
                >
                  <RefreshCcw size={15} /> Reopen
                </button>
              ) : null}
              {listing.status !== "removed" ? (
                <button
                  type="button"
                  disabled={working}
                  onClick={() => void sellerAction("remove", listing.id)}
                  className="inline-flex items-center gap-2 rounded-xl border border-red-500/30 px-3 py-2 text-sm font-semibold text-red-700 dark:text-red-300"
                >
                  <Trash2 size={15} /> Remove
                </button>
              ) : null}
            </div>
          </article>
        ))}
      </div>

      {listings.length === 0 ? (
        <div className="mt-4 rounded-[1.5rem] border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-8 text-center text-[var(--loombus-text-muted)]">
          You have not created a Marketplace listing yet.
        </div>
      ) : null}
    </section>
  );
}
