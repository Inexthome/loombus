"use client";

import Link from "next/link";
import {
  Bookmark,
  ChevronLeft,
  ChevronRight,
  MapPin,
  PackageSearch,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Store,
  Truck,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  MARKETPLACE_CATEGORIES,
  MARKETPLACE_CONDITIONS,
  marketplaceConditionLabel,
  marketplaceFulfillmentLabels,
  marketplaceLocationLabel,
  marketplacePriceLabel,
  type MarketplaceDirectoryResponse,
} from "@/lib/marketplace";

const fieldClass =
  "h-12 w-full border-0 border-b border-[color:var(--loombus-border)] bg-transparent px-0 text-sm text-[color:var(--loombus-text)] outline-none transition placeholder:text-[color:var(--loombus-text-subtle)] focus:border-[color:var(--loombus-gold)] focus:ring-0";

const fulfillmentOptions = [
  { value: "", label: "All listings" },
  { value: "pickup", label: "Pickup" },
  { value: "delivery", label: "Local delivery" },
  { value: "shipping", label: "Shipping" },
] as const;

export default function MarketplaceDirectoryPage() {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const [condition, setCondition] = useState("");
  const [city, setCity] = useState("");
  const [fulfillment, setFulfillment] = useState("");
  const [minimumPrice, setMinimumPrice] = useState("");
  const [maximumPrice, setMaximumPrice] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<MarketplaceDirectoryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    const params = new URLSearchParams({ page: String(page), pageSize: "24" });
    if (query.trim()) params.set("q", query.trim());
    if (category) params.set("category", category);
    if (condition) params.set("condition", condition);
    if (city.trim()) params.set("city", city.trim());
    if (fulfillment) params.set("fulfillment", fulfillment);
    if (minimumPrice) params.set("minimumPrice", minimumPrice);
    if (maximumPrice) params.set("maximumPrice", maximumPrice);

    try {
      const response = await fetch(`/api/marketplace?${params.toString()}`, {
        cache: "no-store",
      });
      const payload = (await response.json()) as MarketplaceDirectoryResponse & {
        error?: string;
      };
      if (!response.ok) throw new Error(payload.error || "Marketplace could not load.");
      setData(payload);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Marketplace could not load.");
    } finally {
      setLoading(false);
    }
  }, [category, city, condition, fulfillment, maximumPrice, minimumPrice, page, query]);

  useEffect(() => {
    const timer = window.setTimeout(load, 180);
    return () => window.clearTimeout(timer);
  }, [load]);

  const totalPages = data ? Math.max(Math.ceil(data.total / data.pageSize), 1) : 1;
  const activeFilterCount = useMemo(
    () =>
      [query.trim(), category, condition, city.trim(), fulfillment, minimumPrice, maximumPrice].filter(Boolean)
        .length,
    [category, city, condition, fulfillment, maximumPrice, minimumPrice, query],
  );

  function resetFilters() {
    setQuery("");
    setCategory("");
    setCondition("");
    setCity("");
    setFulfillment("");
    setMinimumPrice("");
    setMaximumPrice("");
    setPage(1);
  }

  function selectCategory(nextCategory: string) {
    setCategory(nextCategory);
    setPage(1);
  }

  function selectFulfillment(nextFulfillment: string) {
    setFulfillment(nextFulfillment);
    setPage(1);
  }

  return (
    <main className="min-h-screen bg-[color:var(--loombus-page-bg)] px-4 pb-24 pt-6 text-[color:var(--loombus-text)] sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <header className="border-b border-[color:var(--loombus-border)] pb-6">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[color:var(--loombus-gold)]">
                Marketplace
              </p>
              <h1 className="mt-2 text-4xl font-semibold tracking-[-0.055em] sm:text-5xl">
                Items worth finding
              </h1>
              <p className="mt-3 max-w-2xl text-base leading-7 text-[color:var(--loombus-text-muted)]">
                Browse attributable listings without sponsored placement or pay-to-rank.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm font-semibold">
              <Link
                href="/marketplace/manage"
                className="inline-flex min-h-11 items-center gap-2 rounded-full bg-[color:var(--loombus-gold)] px-4 text-[color:var(--loombus-gold-contrast)] transition hover:opacity-90"
              >
                <Store className="h-4 w-4" aria-hidden="true" /> Sell an item
              </Link>
              <Link href="/marketplace/manage" className="transition hover:text-[color:var(--loombus-gold)]">
                Manage
              </Link>
              <Link href="/marketplace/saved" className="transition hover:text-[color:var(--loombus-gold)]">
                Saved
              </Link>
              <Link href="/marketplace/safety" className="transition hover:text-[color:var(--loombus-gold)]">
                Safety
              </Link>
            </div>
          </div>
        </header>

        <section className="border-b border-[color:var(--loombus-border)] py-5">
          <label className="relative block">
            <span className="sr-only">Search Marketplace listings</span>
            <Search
              aria-hidden="true"
              className="absolute left-0 top-1/2 h-5 w-5 -translate-y-1/2 text-[color:var(--loombus-text-subtle)]"
            />
            <input
              type="search"
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setPage(1);
              }}
              placeholder="Search listings, tags, and details"
              className="h-14 w-full border-0 border-b border-[color:var(--loombus-border)] bg-transparent pl-8 pr-12 text-lg text-[color:var(--loombus-text)] outline-none transition placeholder:text-[color:var(--loombus-text-subtle)] focus:border-[color:var(--loombus-gold)] focus:ring-0"
            />
            {activeFilterCount > 0 ? (
              <button
                type="button"
                onClick={resetFilters}
                className="absolute right-0 top-1/2 -translate-y-1/2 text-xs font-semibold text-[color:var(--loombus-gold)]"
              >
                Clear {activeFilterCount}
              </button>
            ) : null}
          </label>

          <div className="mt-5 flex gap-5 overflow-x-auto border-b border-[color:var(--loombus-border-muted)]" aria-label="Marketplace fulfillment filters">
            {fulfillmentOptions.map((option) => (
              <button
                key={option.value || "all"}
                type="button"
                onClick={() => selectFulfillment(option.value)}
                className={`relative shrink-0 pb-3 text-sm font-semibold transition ${
                  fulfillment === option.value
                    ? "text-[color:var(--loombus-text)] after:absolute after:inset-x-0 after:bottom-[-1px] after:h-0.5 after:bg-[color:var(--loombus-gold)]"
                    : "text-[color:var(--loombus-text-muted)] hover:text-[color:var(--loombus-text)]"
                }`}
              >
                {option.label}
              </button>
            ))}
            <Link
              href="/marketplace/saved"
              className="inline-flex shrink-0 items-start gap-2 pb-3 text-sm font-semibold text-[color:var(--loombus-text-muted)] transition hover:text-[color:var(--loombus-text)]"
            >
              <Bookmark className="mt-0.5 h-4 w-4" aria-hidden="true" /> Saved
            </Link>
          </div>

          <div className="mt-5 flex items-center justify-between gap-4">
            <div className="inline-flex items-center gap-2 text-sm font-semibold">
              <SlidersHorizontal className="h-4 w-4 text-[color:var(--loombus-gold)]" aria-hidden="true" />
              Refine results
            </div>
            {activeFilterCount > 0 ? (
              <button type="button" onClick={resetFilters} className="text-sm font-semibold text-[color:var(--loombus-gold)]">
                Reset filters
              </button>
            ) : null}
          </div>

          <div className="mt-3 grid gap-x-6 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
            <label>
              <span className="sr-only">City, region, or postal code</span>
              <input
                value={city}
                onChange={(event) => {
                  setCity(event.target.value);
                  setPage(1);
                }}
                placeholder="City, region, or postal code"
                className={fieldClass}
              />
            </label>
            <label>
              <span className="sr-only">Category</span>
              <select value={category} onChange={(event) => selectCategory(event.target.value)} className={fieldClass} aria-label="Category">
                <option value="">All categories</option>
                {MARKETPLACE_CATEGORIES.map((item) => (
                  <option key={item} value={item}>{item}</option>
                ))}
              </select>
            </label>
            <label>
              <span className="sr-only">Condition</span>
              <select
                value={condition}
                onChange={(event) => {
                  setCondition(event.target.value);
                  setPage(1);
                }}
                className={fieldClass}
                aria-label="Condition"
              >
                <option value="">Any condition</option>
                {MARKETPLACE_CONDITIONS.map((item) => (
                  <option key={item.value} value={item.value}>{item.label}</option>
                ))}
              </select>
            </label>
            <label>
              <span className="sr-only">Fulfillment</span>
              <select value={fulfillment} onChange={(event) => selectFulfillment(event.target.value)} className={fieldClass} aria-label="Fulfillment">
                <option value="">Pickup, delivery, or shipping</option>
                <option value="pickup">Pickup</option>
                <option value="delivery">Local delivery</option>
                <option value="shipping">Shipping</option>
              </select>
            </label>
            <label>
              <span className="sr-only">Minimum price</span>
              <input
                inputMode="decimal"
                value={minimumPrice}
                onChange={(event) => {
                  setMinimumPrice(event.target.value);
                  setPage(1);
                }}
                placeholder="Minimum price"
                className={fieldClass}
              />
            </label>
            <label>
              <span className="sr-only">Maximum price</span>
              <input
                inputMode="decimal"
                value={maximumPrice}
                onChange={(event) => {
                  setMaximumPrice(event.target.value);
                  setPage(1);
                }}
                placeholder="Maximum price"
                className={fieldClass}
              />
            </label>
          </div>
        </section>

        {error ? (
          <div className="border-b border-red-500/30 py-4 text-sm text-red-700 dark:text-red-300">{error}</div>
        ) : null}

        {!loading && data && !data.directoryActive ? (
          <section className="border-b border-[color:var(--loombus-border)] py-10 text-center">
            <PackageSearch className="mx-auto text-[color:var(--loombus-gold)]" size={34} />
            <h2 className="mt-4 text-xl font-semibold">Marketplace is not active yet</h2>
            <p className="mt-2 text-sm text-[color:var(--loombus-text-muted)]">
              Apply the Marketplace migrations before opening this directory.
            </p>
          </section>
        ) : null}

        <section className="py-7">
          <div className="mb-3 flex items-end justify-between gap-4 border-b border-[color:var(--loombus-border)] pb-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[color:var(--loombus-gold)]">Approved listings</p>
              <h2 className="mt-1 text-2xl font-semibold tracking-[-0.035em]">
                {loading ? "Loading Marketplace" : `${data?.total ?? 0} items found`}
              </h2>
            </div>
            {category ? <span className="text-sm font-semibold text-[color:var(--loombus-text-muted)]">{category}</span> : null}
          </div>

          <div className="divide-y divide-[color:var(--loombus-border)]">
            {(data?.listings ?? []).map((listing) => {
              const fulfillmentLabels = marketplaceFulfillmentLabels(listing);
              const primaryPhoto = listing.photos[0]?.url;
              return (
                <Link
                  key={listing.id}
                  href={`/marketplace/${listing.slug}`}
                  className="group grid gap-5 py-6 transition hover:bg-[color:var(--loombus-surface-muted)] sm:grid-cols-[13rem_minmax(0,1fr)] sm:px-2 lg:grid-cols-[16rem_minmax(0,1fr)]"
                >
                  <div className="aspect-[4/3] overflow-hidden rounded-xl bg-[color:var(--loombus-surface-muted)]">
                    {primaryPhoto ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={primaryPhoto} alt="" className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.02]" loading="lazy" />
                    ) : (
                      <div className="flex h-full items-center justify-center text-[color:var(--loombus-gold)]"><PackageSearch size={40} /></div>
                    )}
                  </div>

                  <div className="min-w-0 self-center">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-[color:var(--loombus-text-muted)]">
                          <span>{listing.category}</span>
                          {listing.status === "reserved" ? <span className="text-[color:var(--loombus-gold)]">Reserved</span> : null}
                        </div>
                        <h3 className="mt-2 text-2xl font-semibold tracking-[-0.03em]">{listing.title}</h3>
                      </div>
                      <strong className="shrink-0 text-xl">{marketplacePriceLabel(listing)}</strong>
                    </div>

                    <p className="mt-3 line-clamp-2 max-w-3xl text-sm leading-6 text-[color:var(--loombus-text-muted)]">{listing.description}</p>

                    <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-sm text-[color:var(--loombus-text-muted)]">
                      <span>{marketplaceConditionLabel(listing.condition)}</span>
                      {listing.isNegotiable ? <span>Negotiable</span> : null}
                      <span className="inline-flex items-center gap-1.5"><MapPin className="h-4 w-4 text-[color:var(--loombus-gold)]" />{marketplaceLocationLabel(listing)}</span>
                      <span className="inline-flex items-center gap-1.5"><Truck className="h-4 w-4 text-[color:var(--loombus-gold)]" />{fulfillmentLabels.join(" · ")}</span>
                    </div>

                    <div className="mt-4 flex items-center justify-between gap-4 text-xs font-semibold text-[color:var(--loombus-text-muted)]">
                      <span>{listing.businessName || listing.sellerName}{listing.businessVerificationStatus === "verified" ? " · Verified business" : ""}</span>
                      <span className="inline-flex items-center gap-1 text-[color:var(--loombus-gold)]">View listing <ChevronRight className="h-4 w-4" /></span>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>

          {loading ? <div className="border-b border-[color:var(--loombus-border)] py-8 text-center text-sm text-[color:var(--loombus-text-muted)]">Loading Marketplace listings…</div> : null}

          {!loading && data?.directoryActive && data.listings.length === 0 ? (
            <section className="border-b border-[color:var(--loombus-border)] py-10 text-center">
              <PackageSearch className="mx-auto text-[color:var(--loombus-gold)]" size={34} />
              <h2 className="mt-4 text-xl font-semibold">No matching listings</h2>
              <p className="mt-2 text-sm text-[color:var(--loombus-text-muted)]">Adjust the filters or return after more approved items are listed.</p>
              {activeFilterCount > 0 ? (
                <button type="button" onClick={resetFilters} className="mt-5 text-sm font-semibold text-[color:var(--loombus-gold)]">Clear filters</button>
              ) : null}
            </section>
          ) : null}

          {data && totalPages > 1 ? (
            <div className="mt-8 flex items-center justify-center gap-4">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((value) => Math.max(value - 1, 1))}
                className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold disabled:opacity-40"
              >
                <ChevronLeft size={17} /> Previous
              </button>
              <span className="text-sm text-[color:var(--loombus-text-muted)]">Page {page} of {totalPages}</span>
              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => setPage((value) => Math.min(value + 1, totalPages))}
                className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold disabled:opacity-40"
              >
                Next <ChevronRight size={17} />
              </button>
            </div>
          ) : null}
        </section>

        <footer className="grid gap-4 border-t border-[color:var(--loombus-border)] py-6 text-sm text-[color:var(--loombus-text-muted)] sm:grid-cols-3">
          <div className="flex gap-2"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[color:var(--loombus-gold)]" /><span>Listings come from attributable Loombus sellers.</span></div>
          <div className="flex gap-2"><Search className="mt-0.5 h-4 w-4 shrink-0 text-[color:var(--loombus-gold)]" /><span>No sponsored placement and no pay-to-rank.</span></div>
          <div className="flex gap-2"><Truck className="mt-0.5 h-4 w-4 shrink-0 text-[color:var(--loombus-gold)]" /><span>Confirm fulfillment and payment terms directly with the seller.</span></div>
        </footer>
      </div>
    </main>
  );
}
