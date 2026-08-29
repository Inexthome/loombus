"use client";

import Link from "next/link";
import {
  ArrowUpRight,
  Bookmark,
  Clock3,
  Loader2,
  MapPin,
  PackageSearch,
  Search,
  Trash2,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  formatMarketplaceDate,
  marketplaceLocationLabel,
  marketplacePriceLabel,
  marketplaceStatusLabel,
  type MarketplaceListing,
} from "@/lib/marketplace";
import { marketplaceAuthorizedFetch } from "@/lib/marketplace-auth-client";

type SavedItem = {
  listing: MarketplaceListing;
  savedAt: string;
  available: boolean;
};

type AvailabilityFilter = "all" | "available" | "unavailable";

const secondaryButton =
  "inline-flex min-h-11 items-center justify-center gap-2 border-b border-transparent px-1 text-sm font-semibold text-[color:var(--loombus-text-muted)] transition hover:border-[color:var(--loombus-gold)] hover:text-[color:var(--loombus-text)] disabled:opacity-50";

export default function MarketplaceSavedPage() {
  const [items, setItems] = useState<SavedItem[]>([]);
  const [query, setQuery] = useState("");
  const [availability, setAvailability] = useState<AvailabilityFilter>("all");
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
        { redirectTo: "/marketplace/saved" },
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

  const availableCount = useMemo(
    () => items.filter((item) => item.available).length,
    [items],
  );
  const unavailableCount = items.length - availableCount;

  const filteredItems = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return items.filter((item) => {
      if (availability === "available" && !item.available) return false;
      if (availability === "unavailable" && item.available) return false;
      if (!normalized) return true;
      const listing = item.listing;
      return [
        listing.title,
        listing.category,
        listing.description,
        listing.businessName,
        listing.sellerName,
        marketplaceLocationLabel(listing),
        marketplaceStatusLabel(listing.status),
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(normalized));
    });
  }, [availability, items, query]);

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

  const views: Array<{ key: AvailabilityFilter; label: string; count: number }> = [
    { key: "all", label: "Everything saved", count: items.length },
    { key: "available", label: "Active or reserved", count: availableCount },
    { key: "unavailable", label: "Closed or unavailable", count: unavailableCount },
  ];

  return (
    <main className="min-h-screen bg-[color:var(--loombus-page-bg)] px-4 pb-24 pt-5 text-[color:var(--loombus-text)] sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <header className="border-b border-[color:var(--loombus-border-muted)] pb-6">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <p className="text-xs font-bold uppercase tracking-[0.28em] text-[color:var(--loombus-gold)]">Private watchlist</p>
              <h1 className="mt-2 text-4xl font-semibold tracking-[-0.05em] sm:text-5xl">Saved Marketplace items</h1>
              <p className="mt-3 text-base leading-7 text-[color:var(--loombus-text-muted)]">
                Keep track of listings you want to revisit. Saving stays private and does not change Marketplace ranking.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-4">
              <button type="button" onClick={() => void load()} className={secondaryButton} disabled={loading}>
                {loading ? <Loader2 className="animate-spin" size={16} /> : <Clock3 size={16} />}
                Refresh
              </button>
              <Link href="/marketplace" className="inline-flex min-h-11 items-center gap-2 rounded-full bg-[color:var(--loombus-gold)] px-4 text-sm font-semibold text-[color:var(--loombus-gold-contrast)] transition hover:opacity-90">
                Browse Marketplace <ArrowUpRight size={15} />
              </Link>
            </div>
          </div>
        </header>

        <nav className="flex gap-6 overflow-x-auto border-b border-[color:var(--loombus-border-muted)]" aria-label="Saved Marketplace views">
          {views.map((view) => (
            <button
              key={view.key}
              type="button"
              onClick={() => setAvailability(view.key)}
              className={`relative flex min-h-12 shrink-0 items-center gap-2 py-3 text-sm font-semibold transition ${availability === view.key ? "text-[color:var(--loombus-text)]" : "text-[color:var(--loombus-text-muted)] hover:text-[color:var(--loombus-text)]"}`}
              aria-current={availability === view.key ? "page" : undefined}
            >
              {view.label}
              <span className="text-xs text-[color:var(--loombus-text-subtle)]">{view.count}</span>
              {availability === view.key ? <span className="absolute inset-x-0 bottom-0 h-0.5 bg-[color:var(--loombus-gold)]" /> : null}
            </button>
          ))}
        </nav>

        <div className="flex items-end gap-4 border-b border-[color:var(--loombus-border-muted)] py-5">
          <label className="relative min-w-0 flex-1">
            <span className="sr-only">Search saved Marketplace items</span>
            <Search className="pointer-events-none absolute left-0 top-1/2 h-5 w-5 -translate-y-1/2 text-[color:var(--loombus-text-subtle)]" />
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search title, category, seller, or location"
              className="h-12 w-full border-0 border-b border-[color:var(--loombus-border)] bg-transparent pl-8 pr-3 text-base outline-none transition placeholder:text-[color:var(--loombus-text-subtle)] focus:border-[color:var(--loombus-gold)]"
            />
          </label>
          {(query || availability !== "all") ? (
            <button type="button" onClick={() => { setQuery(""); setAvailability("all"); }} className={secondaryButton}>Clear filters</button>
          ) : null}
        </div>

        {error ? <p className="border-b border-red-500/30 py-4 text-sm text-red-700 dark:text-red-300" role="alert">{error}</p> : null}

        <section className="py-6" aria-label="Saved Marketplace items">
          <div className="mb-4 flex items-end justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.28em] text-[color:var(--loombus-gold)]">Saved results</p>
              <h2 className="mt-1 text-2xl font-semibold tracking-[-0.035em]">
                {loading ? "Loading saved items" : `${filteredItems.length} item${filteredItems.length === 1 ? "" : "s"}`}
              </h2>
            </div>
            <p className="hidden max-w-sm text-right text-xs leading-5 text-[color:var(--loombus-text-subtle)] sm:block">
              Availability can change. Confirm the listing before arranging payment, delivery, or pickup.
            </p>
          </div>

          {loading ? (
            <div className="grid min-h-56 place-items-center border-y border-[color:var(--loombus-border-muted)]">
              <Loader2 className="animate-spin text-[color:var(--loombus-gold)]" size={28} />
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="border-y border-dashed border-[color:var(--loombus-border)] py-12 text-center">
              <PackageSearch className="mx-auto text-[color:var(--loombus-gold)]" size={38} />
              <h2 className="mt-4 text-xl font-semibold">No saved items match this view.</h2>
              <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-[color:var(--loombus-text-muted)]">Clear the current filter or save a Marketplace listing to place it in this private watchlist.</p>
            </div>
          ) : (
            <div className="divide-y divide-[color:var(--loombus-border-muted)] border-y border-[color:var(--loombus-border-muted)]">
              {filteredItems.map(({ listing, available, savedAt }) => {
                const reserved = listing.status === "reserved";
                const content = (
                  <article className="group grid gap-4 py-5 sm:grid-cols-[9rem_minmax(0,1fr)_auto] sm:items-center">
                    <div className="aspect-[4/3] overflow-hidden rounded-xl bg-[color:var(--loombus-surface-muted)]">
                      {listing.photos[0]?.url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={listing.photos[0].url} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <div className="grid h-full place-items-center text-[color:var(--loombus-gold)]"><PackageSearch size={32} /></div>
                      )}
                    </div>

                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-semibold">
                        <span className={reserved ? "text-[color:var(--loombus-gold)]" : available ? "text-emerald-700 dark:text-emerald-300" : "text-amber-700 dark:text-amber-300"}>
                          {reserved ? "Reserved" : available ? "Available" : marketplaceStatusLabel(listing.status)}
                        </span>
                        <span className="text-[color:var(--loombus-text-subtle)]">{listing.category}</span>
                      </div>
                      <h3 className="mt-1 text-xl font-semibold tracking-[-0.025em] group-hover:underline">{listing.title}</h3>
                      <p className="mt-1 font-semibold">{marketplacePriceLabel(listing)}</p>
                      <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-sm text-[color:var(--loombus-text-muted)]">
                        <span className="inline-flex items-center gap-2"><MapPin size={15} className="text-[color:var(--loombus-gold)]" />{marketplaceLocationLabel(listing)}</span>
                        <span className="inline-flex items-center gap-2"><Bookmark size={15} className="text-[color:var(--loombus-gold)]" />Saved {formatMarketplaceDate(savedAt) || "to your watchlist"}</span>
                      </div>
                      <p className="mt-2 text-xs text-[color:var(--loombus-text-subtle)]">{listing.businessName || listing.sellerName}</p>
                    </div>

                    <div className="flex items-center gap-3 sm:flex-col sm:items-end">
                      <button
                        type="button"
                        onClick={(event) => {
                          event.preventDefault();
                          void removeSaved(listing.id);
                        }}
                        disabled={workingId === listing.id}
                        className="inline-flex min-h-10 items-center gap-1.5 border-b border-transparent px-1 text-xs font-semibold text-[color:var(--loombus-text-muted)] transition hover:border-red-500/50 hover:text-red-600 disabled:opacity-50"
                      >
                        {workingId === listing.id ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                        Remove
                      </button>
                    </div>
                  </article>
                );

                return available ? <Link key={listing.id} href={`/marketplace/${listing.slug}`}>{content}</Link> : <div key={listing.id}>{content}</div>;
              })}
            </div>
          )}
        </section>

        <footer className="flex flex-col gap-3 border-t border-[color:var(--loombus-border-muted)] py-6 text-sm text-[color:var(--loombus-text-muted)] sm:flex-row sm:items-center sm:justify-between">
          <p>Saved items are private and member-controlled.</p>
          <div className="flex flex-wrap gap-5">
            <Link href="/marketplace/manage" className="font-semibold hover:text-[color:var(--loombus-gold)]">Sell or manage</Link>
            <Link href="/marketplace/safety" className="font-semibold hover:text-[color:var(--loombus-gold)]">Safety and policy</Link>
            <Link href="/local" className="font-semibold hover:text-[color:var(--loombus-gold)]">Explore Local</Link>
          </div>
        </footer>
      </div>
    </main>
  );
}
