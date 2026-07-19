"use client";

import Link from "next/link";
import {
  ArrowUpRight,
  Bookmark,
  ChevronRight,
  Clock3,
  Loader2,
  MapPin,
  PackageSearch,
  Search,
  ShieldCheck,
  SlidersHorizontal,
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
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-[color:var(--loombus-border)] bg-[color:var(--loombus-surface)] px-4 text-sm font-semibold text-[color:var(--loombus-text)] transition hover:border-[color:var(--loombus-gold)] hover:bg-[color:var(--loombus-surface-muted)] disabled:opacity-50";

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

  function clearFilters() {
    setQuery("");
    setAvailability("all");
  }

  return (
    <main className="min-h-screen bg-[color:var(--loombus-page-bg)] px-4 pb-24 pt-5 text-[color:var(--loombus-text)] sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[84rem]">
        <header className="mb-6 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <h1 className="text-4xl font-semibold tracking-[-0.055em] sm:text-5xl">Saved Marketplace items</h1>
            <p className="mt-3 text-base leading-7 text-[color:var(--loombus-text-muted)]">
              Review your private watchlist, separate active listings from closed ones, and return to an item without changing its public ranking.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => void load()} className={secondaryButton}>
              {loading ? <Loader2 className="animate-spin" size={16} /> : <Clock3 size={16} />}
              Refresh watchlist
            </button>
            <Link
              href="/marketplace"
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-[color:var(--loombus-gold)] px-4 text-sm font-semibold text-[color:var(--loombus-gold-contrast)] transition hover:opacity-90"
            >
              Browse Marketplace <ArrowUpRight size={16} />
            </Link>
          </div>
        </header>

        <section className="mb-6 grid gap-3 sm:grid-cols-3">
          <button
            type="button"
            onClick={() => setAvailability("all")}
            className={`rounded-[1.4rem] border p-4 text-left shadow-sm transition ${
              availability === "all"
                ? "border-[color:var(--loombus-gold)] bg-[color:var(--loombus-cream)] text-[color:var(--loombus-cream-contrast)] dark:bg-[color:var(--loombus-gold-soft)] dark:text-[color:var(--loombus-text)]"
                : "border-[color:var(--loombus-border)] bg-[color:var(--loombus-surface)] hover:border-[color:var(--loombus-gold)]"
            }`}
          >
            <span className="text-xs font-bold uppercase tracking-[0.18em] text-[color:var(--loombus-gold)]">Saved total</span>
            <strong className="mt-2 block text-3xl tracking-[-0.04em]">{items.length}</strong>
          </button>
          <button
            type="button"
            onClick={() => setAvailability("available")}
            className={`rounded-[1.4rem] border p-4 text-left shadow-sm transition ${
              availability === "available"
                ? "border-[color:var(--loombus-gold)] bg-[color:var(--loombus-cream)] text-[color:var(--loombus-cream-contrast)] dark:bg-[color:var(--loombus-gold-soft)] dark:text-[color:var(--loombus-text)]"
                : "border-[color:var(--loombus-border)] bg-[color:var(--loombus-surface)] hover:border-[color:var(--loombus-gold)]"
            }`}
          >
            <span className="text-xs font-bold uppercase tracking-[0.18em] text-[color:var(--loombus-text-muted)]">Still available</span>
            <strong className="mt-2 block text-3xl tracking-[-0.04em]">{availableCount}</strong>
          </button>
          <button
            type="button"
            onClick={() => setAvailability("unavailable")}
            className={`rounded-[1.4rem] border p-4 text-left shadow-sm transition ${
              availability === "unavailable"
                ? "border-[color:var(--loombus-gold)] bg-[color:var(--loombus-cream)] text-[color:var(--loombus-cream-contrast)] dark:bg-[color:var(--loombus-gold-soft)] dark:text-[color:var(--loombus-text)]"
                : "border-[color:var(--loombus-border)] bg-[color:var(--loombus-surface)] hover:border-[color:var(--loombus-gold)]"
            }`}
          >
            <span className="text-xs font-bold uppercase tracking-[0.18em] text-[color:var(--loombus-text-muted)]">Closed or unavailable</span>
            <strong className="mt-2 block text-3xl tracking-[-0.04em]">{unavailableCount}</strong>
          </button>
        </section>

        {error ? (
          <p className="mb-6 rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-700 dark:text-red-300" role="alert">
            {error}
          </p>
        ) : null}

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_20rem]">
          <section className="min-w-0">
            <div className="mb-5 flex gap-3">
              <label className="relative flex-1">
                <span className="sr-only">Search saved Marketplace items</span>
                <Search className="pointer-events-none absolute left-5 top-1/2 h-5 w-5 -translate-y-1/2 text-[color:var(--loombus-text-subtle)]" />
                <input
                  type="search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search title, category, seller, or location"
                  className="h-14 w-full rounded-2xl border border-[color:var(--loombus-border)] bg-[color:var(--loombus-surface)] pl-14 pr-5 text-base outline-none shadow-sm transition placeholder:text-[color:var(--loombus-text-subtle)] focus:border-[color:var(--loombus-gold)] focus:ring-4 focus:ring-[color:var(--loombus-gold-soft)]"
                />
              </label>
              <button
                type="button"
                onClick={clearFilters}
                className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl border border-[color:var(--loombus-border)] bg-[color:var(--loombus-surface)] shadow-sm transition hover:border-[color:var(--loombus-gold)]"
                aria-label="Clear saved-item filters"
              >
                <SlidersHorizontal size={19} />
              </button>
            </div>

            <div className="mb-4">
              <p className="text-xs font-bold uppercase tracking-[0.28em] text-[color:var(--loombus-gold)]">Private watchlist</p>
              <h2 className="mt-1 text-2xl font-semibold tracking-[-0.035em]">
                {loading ? "Loading saved items" : `${filteredItems.length} item${filteredItems.length === 1 ? "" : "s"} in this view`}
              </h2>
            </div>

            {loading ? (
              <section className="grid min-h-64 place-items-center rounded-[1.75rem] border border-[color:var(--loombus-border)] bg-[color:var(--loombus-surface)] shadow-xl shadow-black/10">
                <Loader2 className="animate-spin text-[color:var(--loombus-gold)]" size={28} />
              </section>
            ) : filteredItems.length === 0 ? (
              <section className="rounded-[1.75rem] border border-dashed border-[color:var(--loombus-border)] bg-[color:var(--loombus-surface)] p-10 text-center shadow-xl shadow-black/10">
                <PackageSearch className="mx-auto text-[color:var(--loombus-gold)]" size={42} />
                <h2 className="mt-4 text-2xl font-semibold tracking-[-0.035em]">No saved items match this view.</h2>
                <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-[color:var(--loombus-text-muted)]">
                  Clear the current filter or save a Marketplace listing to place it in this private watchlist.
                </p>
                <Link href="/marketplace" className="mt-5 inline-flex rounded-full bg-[color:var(--loombus-gold)] px-5 py-3 text-sm font-semibold text-[color:var(--loombus-gold-contrast)]">
                  Browse Marketplace
                </Link>
              </section>
            ) : (
              <section className="grid gap-4 md:grid-cols-2" aria-label="Saved Marketplace items">
                {filteredItems.map(({ listing, available, savedAt }) => {
                  const card = (
                    <article className="group flex h-full min-h-[390px] flex-col overflow-hidden rounded-[1.75rem] border border-[color:var(--loombus-border)] bg-[color:var(--loombus-surface)] shadow-lg shadow-black/5 transition hover:-translate-y-0.5 hover:border-[color:var(--loombus-gold)] hover:shadow-xl">
                      <div className="aspect-[16/10] bg-[color:var(--loombus-surface-muted)]">
                        {listing.photos[0]?.url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={listing.photos[0].url} alt="" className="h-full w-full object-cover" />
                        ) : (
                          <div className="grid h-full place-items-center text-[color:var(--loombus-gold)]">
                            <PackageSearch size={42} />
                          </div>
                        )}
                      </div>
                      <div className="flex flex-1 flex-col p-5">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span
                            className={`rounded-full px-3 py-1 text-xs font-semibold ${
                              available
                                ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                                : "bg-amber-500/10 text-amber-700 dark:text-amber-300"
                            }`}
                          >
                            {available ? "Available" : marketplaceStatusLabel(listing.status)}
                          </span>
                          <span className="text-xs font-semibold text-[color:var(--loombus-text-muted)]">{listing.category}</span>
                        </div>
                        <h3 className="mt-4 text-2xl font-semibold leading-tight tracking-[-0.035em] group-hover:underline">{listing.title}</h3>
                        <p className="mt-2 text-lg font-semibold">{marketplacePriceLabel(listing)}</p>
                        <div className="mt-auto space-y-3 pt-6 text-sm text-[color:var(--loombus-text-muted)]">
                          <span className="flex items-start gap-2"><MapPin className="mt-0.5 shrink-0 text-[color:var(--loombus-gold)]" size={16} />{marketplaceLocationLabel(listing)}</span>
                          <span className="flex items-start gap-2"><Bookmark className="mt-0.5 shrink-0 text-[color:var(--loombus-gold)]" size={16} />Saved {formatMarketplaceDate(savedAt) || "to your watchlist"}</span>
                        </div>
                        <div className="mt-5 flex items-center justify-between gap-3 border-t border-[color:var(--loombus-border-muted)] pt-4">
                          <span className="text-xs text-[color:var(--loombus-text-subtle)]">{listing.businessName || listing.sellerName}</span>
                          <button
                            type="button"
                            onClick={(event) => {
                              event.preventDefault();
                              void removeSaved(listing.id);
                            }}
                            disabled={workingId === listing.id}
                            className="inline-flex items-center gap-1.5 rounded-full border border-[color:var(--loombus-border)] px-3 py-2 text-xs font-semibold transition hover:border-red-500/40 disabled:opacity-50"
                          >
                            {workingId === listing.id ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                            Remove
                          </button>
                        </div>
                      </div>
                    </article>
                  );

                  return available ? (
                    <Link key={listing.id} href={`/marketplace/${listing.slug}`}>{card}</Link>
                  ) : (
                    <div key={listing.id}>{card}</div>
                  );
                })}
              </section>
            )}
          </section>

          <aside className="space-y-5 xl:sticky xl:top-28 xl:self-start">
            <section className="rounded-[1.75rem] border border-[color:var(--loombus-border)] bg-[color:var(--loombus-surface)] p-5 shadow-2xl shadow-black/10">
              <p className="text-xs font-bold uppercase tracking-[0.3em]">Watchlist views</p>
              <div className="mt-4 space-y-2">
                {[
                  ["all", "Everything saved", items.length],
                  ["available", "Still available", availableCount],
                  ["unavailable", "Closed or unavailable", unavailableCount],
                ].map(([value, label, count]) => (
                  <button
                    key={String(value)}
                    type="button"
                    onClick={() => setAvailability(value as AvailabilityFilter)}
                    className={`flex w-full items-center justify-between rounded-2xl px-4 py-3 text-left text-sm font-semibold transition ${
                      availability === value
                        ? "bg-[color:var(--loombus-cream)] text-[color:var(--loombus-cream-contrast)] dark:bg-[color:var(--loombus-gold-soft)] dark:text-[color:var(--loombus-gold)]"
                        : "bg-[color:var(--loombus-page-bg)] hover:bg-[color:var(--loombus-surface-muted)]"
                    }`}
                  >
                    <span>{label}</span>
                    <span className="rounded-full bg-[color:var(--loombus-surface)] px-2 py-0.5 text-xs">{count}</span>
                  </button>
                ))}
              </div>
            </section>

            <section className="rounded-[1.75rem] border border-[color:var(--loombus-border)] bg-[color:var(--loombus-surface)] p-5 shadow-2xl shadow-black/10">
              <p className="text-xs font-bold uppercase tracking-[0.3em]">Marketplace tools</p>
              <div className="mt-4 space-y-2">
                <Link href="/marketplace" className="flex items-center justify-between rounded-2xl bg-[color:var(--loombus-page-bg)] px-4 py-3 text-sm font-semibold transition hover:bg-[color:var(--loombus-surface-muted)]">
                  Browse listings <ChevronRight className="h-4 w-4 text-[color:var(--loombus-gold)]" />
                </Link>
                <Link href="/marketplace/manage" className="flex items-center justify-between rounded-2xl bg-[color:var(--loombus-page-bg)] px-4 py-3 text-sm font-semibold transition hover:bg-[color:var(--loombus-surface-muted)]">
                  Sell or manage <ChevronRight className="h-4 w-4 text-[color:var(--loombus-gold)]" />
                </Link>
                <Link href="/local" className="flex items-center justify-between rounded-2xl bg-[color:var(--loombus-page-bg)] px-4 py-3 text-sm font-semibold transition hover:bg-[color:var(--loombus-surface-muted)]">
                  Explore Local <ArrowUpRight className="h-4 w-4 text-[color:var(--loombus-gold)]" />
                </Link>
              </div>
            </section>

            <section className="rounded-[1.75rem] border border-[color:var(--loombus-border)] bg-[color:var(--loombus-surface)] p-5 shadow-2xl shadow-black/10">
              <div className="flex gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[color:var(--loombus-cream)] text-[color:var(--loombus-gold)] dark:bg-[color:var(--loombus-gold-soft)]">
                  <ShieldCheck className="h-5 w-5" />
                </span>
                <div>
                  <h3 className="font-semibold">Private and member-controlled</h3>
                  <p className="mt-1 text-sm leading-6 text-[color:var(--loombus-text-muted)]">
                    Saving an item does not notify the seller or affect ranking. Availability can change, so confirm the listing before arranging payment or pickup.
                  </p>
                </div>
              </div>
            </section>
          </aside>
        </div>
      </div>
    </main>
  );
}
