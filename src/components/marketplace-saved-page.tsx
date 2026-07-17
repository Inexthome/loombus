"use client";

import Link from "next/link";
import { Bookmark, Loader2, MapPin, PackageSearch, Trash2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import {
  marketplaceLocationLabel,
  marketplacePriceLabel,
  type MarketplaceListing,
} from "@/lib/marketplace";
import { marketplaceAuthorizedFetch } from "@/lib/marketplace-auth-client";

type SavedItem = {
  listing: MarketplaceListing;
  savedAt: string;
  available: boolean;
};

export default function MarketplaceSavedPage() {
  const [items, setItems] = useState<SavedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [workingId, setWorkingId] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await marketplaceAuthorizedFetch(
        "/api/marketplace/watchlist",
        { cache: "no-store" },
        { redirectTo: "/marketplace/saved" }
      );
      const payload = (await response.json().catch(() => ({}))) as {
        items?: SavedItem[];
        error?: string;
      };
      if (!response.ok) throw new Error(payload.error || "Saved items could not load.");
      setItems(Array.isArray(payload.items) ? payload.items : []);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Saved items could not load.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function removeSaved(listingId: string) {
    if (workingId) return;
    setWorkingId(listingId);
    setError("");
    try {
      const response = await marketplaceAuthorizedFetch("/api/marketplace/watchlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "unsave", listingId }),
      });
      const payload = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) throw new Error(payload.error || "Unable to remove the saved item.");
      setItems((current) => current.filter((item) => item.listing.id !== listingId));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to remove the saved item.");
    } finally {
      setWorkingId("");
    }
  }

  return (
    <main className="min-h-screen bg-[var(--loombus-page-bg)] px-4 py-8 text-[var(--loombus-text)] sm:px-6">
      <div className="mx-auto max-w-6xl">
        <section className="rounded-[2rem] border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-6 sm:p-8">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-[var(--loombus-text-subtle)]">
                <Bookmark size={16} /> Marketplace watchlist
              </div>
              <h1 className="mt-3 text-4xl font-semibold tracking-[-0.04em]">Saved items</h1>
              <p className="mt-3 max-w-2xl leading-7 text-[var(--loombus-text-muted)]">
                Return to listings you are considering. Sold, expired, suspended, or removed items remain visible here with their current status until you remove them.
              </p>
            </div>
            <Link
              href="/marketplace"
              className="rounded-xl border border-[var(--loombus-border)] px-4 py-3 font-semibold"
            >
              Browse Marketplace
            </Link>
          </div>
        </section>

        {error ? (
          <p className="mt-5 rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-700 dark:text-red-300">
            {error}
          </p>
        ) : null}

        {loading ? (
          <div className="flex justify-center py-16 text-[var(--loombus-text-muted)]">
            <Loader2 className="animate-spin" size={28} />
          </div>
        ) : null}

        {!loading && items.length === 0 ? (
          <section className="mt-6 rounded-[1.6rem] border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-10 text-center">
            <PackageSearch className="mx-auto text-[var(--loombus-text-subtle)]" size={38} />
            <h2 className="mt-4 text-xl font-semibold">No saved Marketplace items</h2>
            <p className="mt-2 text-sm text-[var(--loombus-text-muted)]">
              Save a listing to place it in this private watchlist.
            </p>
          </section>
        ) : null}

        <section className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {items.map(({ listing, available }) => {
            const card = (
              <article className="h-full overflow-hidden rounded-[1.5rem] border border-[var(--loombus-border)] bg-[var(--loombus-surface)]">
                <div className="aspect-[4/3] bg-[var(--loombus-surface-muted)]">
                  {listing.photos[0]?.url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={listing.photos[0].url}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center text-[var(--loombus-text-subtle)]">
                      <PackageSearch size={38} />
                    </div>
                  )}
                </div>
                <div className="p-5">
                  <div className="flex items-start justify-between gap-3">
                    <h2 className="text-lg font-semibold leading-snug">{listing.title}</h2>
                    <strong className="shrink-0">{marketplacePriceLabel(listing)}</strong>
                  </div>
                  <p className="mt-3 flex items-center gap-2 text-sm text-[var(--loombus-text-muted)]">
                    <MapPin size={15} /> {marketplaceLocationLabel(listing)}
                  </p>
                  <div className="mt-4 flex items-center justify-between gap-3 border-t border-[var(--loombus-border)] pt-4">
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-semibold ${
                        available
                          ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                          : "bg-amber-500/10 text-amber-700 dark:text-amber-300"
                      }`}
                    >
                      {available ? "Available" : listing.status.replaceAll("_", " ")}
                    </span>
                    <button
                      type="button"
                      onClick={(event: { preventDefault: () => void }) => {
                        event.preventDefault();
                        void removeSaved(listing.id);
                      }}
                      disabled={workingId === listing.id}
                      className="inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--loombus-text-muted)] disabled:opacity-50"
                    >
                      {workingId === listing.id ? (
                        <Loader2 size={14} className="animate-spin" />
                      ) : (
                        <Trash2 size={14} />
                      )}
                      Remove
                    </button>
                  </div>
                </div>
              </article>
            );

            return available ? (
              <Link key={listing.id} href={`/marketplace/${listing.slug}`}>
                {card}
              </Link>
            ) : (
              <div key={listing.id}>{card}</div>
            );
          })}
        </section>
      </div>
    </main>
  );
}
