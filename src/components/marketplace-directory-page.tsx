"use client";

import Link from "next/link";
import {
  ChevronLeft,
  ChevronRight,
  MapPin,
  PackageSearch,
  Search,
  SlidersHorizontal,
  Store,
  Truck,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import {
  MARKETPLACE_CATEGORIES,
  MARKETPLACE_CONDITIONS,
  marketplaceConditionLabel,
  marketplaceFulfillmentLabels,
  marketplaceLocationLabel,
  marketplacePriceLabel,
  type MarketplaceDirectoryResponse,
} from "@/lib/marketplace";

const inputClass =
  "rounded-xl border border-[var(--loombus-border)] bg-[var(--loombus-page-bg)] px-4 py-3 outline-none";

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

  return (
    <main className="min-h-screen bg-[var(--loombus-page-bg)] text-[var(--loombus-text)]">
      <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <section className="overflow-hidden rounded-[2rem] border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-6 shadow-sm sm:p-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-[var(--loombus-text-subtle)]">
                <Store size={16} />
                Loombus Marketplace
              </div>
              <h1 className="mt-3 text-4xl font-semibold tracking-[-0.04em] sm:text-5xl">
                Find useful items from attributable sellers.
              </h1>
              <p className="mt-4 max-w-2xl text-base leading-7 text-[var(--loombus-text-muted)]">
                Browse approved listings without sponsored placement or pay-to-rank. Loombus does not process Marketplace payments in this release.
              </p>
            </div>
            <Link
              href="/marketplace/manage"
              className="inline-flex items-center justify-center rounded-xl bg-[var(--loombus-text)] px-5 py-3 font-semibold text-[var(--loombus-page-bg)]"
            >
              Sell an item
            </Link>
          </div>
        </section>

        <section className="mt-6 rounded-[1.6rem] border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-5 sm:p-6">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <SlidersHorizontal size={18} />
            Search and filters
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <label className="flex items-center gap-2 rounded-xl border border-[var(--loombus-border)] bg-[var(--loombus-page-bg)] px-4">
              <Search size={17} className="text-[var(--loombus-text-subtle)]" />
              <input
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                  setPage(1);
                }}
                placeholder="Search listings, tags, and details"
                className="min-w-0 flex-1 bg-transparent py-3 outline-none"
              />
            </label>
            <input
              value={city}
              onChange={(event) => {
                setCity(event.target.value);
                setPage(1);
              }}
              placeholder="City, region, or postal code"
              className={inputClass}
            />
            <select
              value={category}
              onChange={(event) => {
                setCategory(event.target.value);
                setPage(1);
              }}
              className={inputClass}
              aria-label="Category"
            >
              <option value="">All categories</option>
              {MARKETPLACE_CATEGORIES.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
            <select
              value={condition}
              onChange={(event) => {
                setCondition(event.target.value);
                setPage(1);
              }}
              className={inputClass}
              aria-label="Condition"
            >
              <option value="">Any condition</option>
              {MARKETPLACE_CONDITIONS.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
            <select
              value={fulfillment}
              onChange={(event) => {
                setFulfillment(event.target.value);
                setPage(1);
              }}
              className={inputClass}
              aria-label="Fulfillment"
            >
              <option value="">Pickup, delivery, or shipping</option>
              <option value="pickup">Pickup</option>
              <option value="delivery">Local delivery</option>
              <option value="shipping">Shipping</option>
            </select>
            <input
              inputMode="decimal"
              value={minimumPrice}
              onChange={(event) => {
                setMinimumPrice(event.target.value);
                setPage(1);
              }}
              placeholder="Minimum price"
              className={inputClass}
            />
            <input
              inputMode="decimal"
              value={maximumPrice}
              onChange={(event) => {
                setMaximumPrice(event.target.value);
                setPage(1);
              }}
              placeholder="Maximum price"
              className={inputClass}
            />
            <button
              type="button"
              onClick={() => {
                setQuery("");
                setCategory("");
                setCondition("");
                setCity("");
                setFulfillment("");
                setMinimumPrice("");
                setMaximumPrice("");
                setPage(1);
              }}
              className="rounded-xl border border-[var(--loombus-border)] px-4 py-3 font-semibold"
            >
              Reset filters
            </button>
          </div>
        </section>

        {error ? (
          <div className="mt-6 rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-700 dark:text-red-300">
            {error}
          </div>
        ) : null}

        {!loading && data && !data.directoryActive ? (
          <div className="mt-6 rounded-[1.6rem] border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-8 text-center">
            <PackageSearch className="mx-auto text-[var(--loombus-text-subtle)]" size={36} />
            <h2 className="mt-4 text-xl font-semibold">Marketplace is not active yet</h2>
            <p className="mt-2 text-sm text-[var(--loombus-text-muted)]">
              Apply the Marketplace migrations before opening this directory.
            </p>
          </div>
        ) : null}

        <section className="mt-6 grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {(data?.listings ?? []).map((listing) => {
            const fulfillmentLabels = marketplaceFulfillmentLabels(listing);
            const primaryPhoto = listing.photos[0]?.url;
            return (
              <Link
                key={listing.id}
                href={`/marketplace/${listing.slug}`}
                className="overflow-hidden rounded-[1.5rem] border border-[var(--loombus-border)] bg-[var(--loombus-surface)] transition hover:-translate-y-0.5 hover:shadow-lg"
              >
                <div className="aspect-[4/3] bg-[var(--loombus-surface-muted)]">
                  {primaryPhoto ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={primaryPhoto}
                      alt=""
                      className="h-full w-full object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center text-[var(--loombus-text-subtle)]">
                      <PackageSearch size={42} />
                    </div>
                  )}
                </div>
                <div className="p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--loombus-text-subtle)]">
                        {listing.category}
                      </p>
                      <h2 className="mt-1 text-xl font-semibold leading-snug">
                        {listing.title}
                      </h2>
                    </div>
                    <strong className="shrink-0 text-lg">
                      {marketplacePriceLabel(listing)}
                    </strong>
                  </div>
                  <p className="mt-3 line-clamp-2 text-sm leading-6 text-[var(--loombus-text-muted)]">
                    {listing.description}
                  </p>
                  <div className="mt-4 flex flex-wrap gap-2 text-xs text-[var(--loombus-text-muted)]">
                    <span className="rounded-full bg-[var(--loombus-surface-muted)] px-3 py-1.5">
                      {marketplaceConditionLabel(listing.condition)}
                    </span>
                    {listing.isNegotiable ? (
                      <span className="rounded-full bg-[var(--loombus-surface-muted)] px-3 py-1.5">
                        Negotiable
                      </span>
                    ) : null}
                  </div>
                  <div className="mt-4 space-y-2 text-sm text-[var(--loombus-text-muted)]">
                    <div className="flex items-center gap-2">
                      <MapPin size={15} />
                      {marketplaceLocationLabel(listing)}
                    </div>
                    <div className="flex items-center gap-2">
                      <Truck size={15} />
                      {fulfillmentLabels.join(" · ")}
                    </div>
                  </div>
                  <div className="mt-4 border-t border-[var(--loombus-border)] pt-4 text-xs text-[var(--loombus-text-subtle)]">
                    {listing.businessName || listing.sellerName}
                    {listing.businessVerificationStatus === "verified" ? " · Verified business" : ""}
                  </div>
                </div>
              </Link>
            );
          })}
        </section>

        {loading ? (
          <div className="mt-8 text-center text-sm text-[var(--loombus-text-muted)]">
            Loading Marketplace listings…
          </div>
        ) : null}

        {!loading && data?.directoryActive && data.listings.length === 0 ? (
          <div className="mt-6 rounded-[1.6rem] border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-8 text-center">
            <PackageSearch className="mx-auto text-[var(--loombus-text-subtle)]" size={36} />
            <h2 className="mt-4 text-xl font-semibold">No matching listings</h2>
            <p className="mt-2 text-sm text-[var(--loombus-text-muted)]">
              Adjust the filters or return after more approved items are listed.
            </p>
          </div>
        ) : null}

        {data && totalPages > 1 ? (
          <div className="mt-8 flex items-center justify-center gap-3">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((value) => Math.max(value - 1, 1))}
              className="inline-flex items-center gap-2 rounded-xl border border-[var(--loombus-border)] px-4 py-2.5 disabled:opacity-40"
            >
              <ChevronLeft size={17} /> Previous
            </button>
            <span className="text-sm text-[var(--loombus-text-muted)]">
              Page {page} of {totalPages}
            </span>
            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => setPage((value) => Math.min(value + 1, totalPages))}
              className="inline-flex items-center gap-2 rounded-xl border border-[var(--loombus-border)] px-4 py-2.5 disabled:opacity-40"
            >
              Next <ChevronRight size={17} />
            </button>
          </div>
        ) : null}
      </div>
    </main>
  );
}
