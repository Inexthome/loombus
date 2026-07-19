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
  Sparkles,
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

const inputClass =
  "h-12 w-full rounded-xl border border-[color:var(--loombus-border)] bg-[color:var(--loombus-surface)] px-3.5 text-sm text-[color:var(--loombus-text)] outline-none transition placeholder:text-[color:var(--loombus-text-subtle)] focus:border-[#b45309] focus:ring-4 focus:ring-orange-500/10";

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
  const visibleCategories = MARKETPLACE_CATEGORIES.slice(0, 8);

  const activeFilterCount = useMemo(
    () =>
      [query.trim(), category, condition, city.trim(), fulfillment, minimumPrice, maximumPrice].filter(
        Boolean
      ).length,
    [category, city, condition, fulfillment, maximumPrice, minimumPrice, query]
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
    <main className="min-h-screen bg-[color:var(--loombus-page-bg)] px-4 pb-24 pt-5 text-[color:var(--loombus-text)] sm:px-6 lg:px-8">
      <div className="mx-auto grid max-w-[88rem] gap-6 xl:grid-cols-[14.5rem_minmax(0,1fr)_20rem]">
        <aside className="hidden xl:block">
          <section className="sticky top-28 rounded-[1.75rem] border border-[color:var(--loombus-border)] bg-[color:var(--loombus-surface)] p-4 shadow-2xl shadow-black/10">
            <p className="mb-4 text-xs font-bold uppercase tracking-[0.34em] text-[color:var(--loombus-text)]">
              Browse categories
            </p>

            <div className="space-y-2">
              <button
                type="button"
                onClick={() => selectCategory("")}
                className={`flex w-full items-center justify-between gap-3 rounded-2xl px-3 py-3 text-left text-sm font-semibold transition ${
                  category === ""
                    ? "bg-[color:var(--loombus-surface-muted)] text-[#b45309]"
                    : "bg-[color:var(--loombus-page-bg)] text-[color:var(--loombus-text)] hover:bg-[color:var(--loombus-surface-muted)]"
                }`}
              >
                <span className="flex min-w-0 items-center gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-[color:var(--loombus-surface)] text-[#b45309]">
                    <Sparkles aria-hidden="true" className="h-4 w-4" strokeWidth={2.1} />
                  </span>
                  <span className="truncate">All listings</span>
                </span>
                <span className="text-xs text-[#b45309]">{data?.total ?? 0}</span>
              </button>

              {visibleCategories.map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => selectCategory(item)}
                  className={`flex w-full items-center justify-between gap-3 rounded-2xl px-3 py-3 text-left text-sm font-semibold transition ${
                    category === item
                      ? "bg-[color:var(--loombus-surface-muted)] text-[#b45309]"
                      : "bg-[color:var(--loombus-page-bg)] text-[color:var(--loombus-text)] hover:bg-[color:var(--loombus-surface-muted)]"
                  }`}
                >
                  <span className="flex min-w-0 items-center gap-3">
                    <span
                      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-[color:var(--loombus-surface)] ${
                        category === item
                          ? "text-[#b45309]"
                          : "text-[color:var(--loombus-text-muted)]"
                      }`}
                    >
                      <Store aria-hidden="true" className="h-4 w-4" strokeWidth={2.1} />
                    </span>
                    <span className="truncate">{item}</span>
                  </span>
                  <ChevronRight aria-hidden="true" className="h-4 w-4 shrink-0 text-[#b45309]" />
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={resetFilters}
              className="mt-5 flex w-full items-center justify-between rounded-2xl px-1 py-2 text-left text-sm font-semibold text-[#b45309] transition hover:text-[color:var(--loombus-text)]"
            >
              Clear all filters
              <ChevronRight aria-hidden="true" className="h-4 w-4" />
            </button>
          </section>
        </aside>

        <section className="min-w-0">
          <div className="mb-6">
            <h1 className="text-4xl font-semibold tracking-[-0.055em] text-[color:var(--loombus-text)] sm:text-5xl">
              Marketplace
            </h1>
            <p className="mt-3 text-base leading-7 text-[color:var(--loombus-text-muted)]">
              Browse useful items from attributable sellers. Search by category, location, and fulfillment.
            </p>
          </div>

          <div className="mb-4 flex gap-3">
            <label className="relative flex-1">
              <span className="sr-only">Search Marketplace listings</span>
              <Search
                aria-hidden="true"
                className="absolute left-5 top-1/2 h-5 w-5 -translate-y-1/2 text-[color:var(--loombus-text-subtle)]"
                strokeWidth={2.1}
              />
              <input
                type="search"
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                  setPage(1);
                }}
                placeholder="Search listings, tags, and details"
                className="h-14 w-full rounded-2xl border border-[color:var(--loombus-border)] bg-[color:var(--loombus-surface)] pl-14 pr-5 text-base text-[color:var(--loombus-text)] outline-none shadow-sm transition placeholder:text-[color:var(--loombus-text-subtle)] focus:border-[#b45309] focus:ring-4 focus:ring-orange-500/10"
              />
            </label>

            <button
              type="button"
              onClick={resetFilters}
              className="relative flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-[color:var(--loombus-border)] bg-[color:var(--loombus-surface)] text-[color:var(--loombus-text)] shadow-sm transition hover:border-[#b45309]"
              aria-label="Reset Marketplace filters"
              title="Reset filters"
            >
              <SlidersHorizontal aria-hidden="true" className="h-5 w-5" strokeWidth={2.1} />
              {activeFilterCount > 0 ? (
                <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-[#b45309] px-1 text-[10px] font-bold text-white">
                  {activeFilterCount}
                </span>
              ) : null}
            </button>
          </div>

          <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
            {fulfillmentOptions.map((option) => (
              <button
                key={option.value || "all"}
                type="button"
                onClick={() => selectFulfillment(option.value)}
                className={`shrink-0 rounded-full border px-4 py-2.5 text-sm font-semibold shadow-sm transition ${
                  fulfillment === option.value
                    ? "border-orange-200 bg-orange-50 text-[#b45309] dark:border-orange-400/30 dark:bg-orange-400/10"
                    : "border-transparent bg-[color:var(--loombus-surface-muted)] text-[color:var(--loombus-text)] hover:border-[color:var(--loombus-border)]"
                }`}
              >
                {option.label}
              </button>
            ))}
            <Link
              href="/marketplace/saved"
              className="inline-flex shrink-0 items-center gap-2 rounded-full border border-transparent bg-[color:var(--loombus-surface-muted)] px-4 py-2.5 text-sm font-semibold text-[color:var(--loombus-text)] shadow-sm transition hover:border-[color:var(--loombus-border)]"
            >
              <Bookmark aria-hidden="true" className="h-4 w-4" />
              Saved
            </Link>
          </div>

          <section className="mb-7 rounded-[1.75rem] border border-[color:var(--loombus-border)] bg-[color:var(--loombus-surface)] p-4 shadow-xl shadow-black/5 sm:p-5">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-sm font-semibold text-[color:var(--loombus-text)]">
                <SlidersHorizontal aria-hidden="true" className="h-4 w-4 text-[#b45309]" />
                Refine results
              </div>
              {activeFilterCount > 0 ? (
                <button
                  type="button"
                  onClick={resetFilters}
                  className="text-sm font-semibold text-[#b45309] transition hover:text-[color:var(--loombus-text)]"
                >
                  Reset
                </button>
              ) : null}
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <label>
                <span className="sr-only">City, region, or postal code</span>
                <input
                  value={city}
                  onChange={(event) => {
                    setCity(event.target.value);
                    setPage(1);
                  }}
                  placeholder="City, region, or postal code"
                  className={inputClass}
                />
              </label>

              <label>
                <span className="sr-only">Category</span>
                <select
                  value={category}
                  onChange={(event) => selectCategory(event.target.value)}
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
              </label>

              <label>
                <span className="sr-only">Condition</span>
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
              </label>

              <label>
                <span className="sr-only">Fulfillment</span>
                <select
                  value={fulfillment}
                  onChange={(event) => selectFulfillment(event.target.value)}
                  className={inputClass}
                  aria-label="Fulfillment"
                >
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
                  className={inputClass}
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
                  className={inputClass}
                />
              </label>
            </div>
          </section>

          {error ? (
            <div className="mb-6 rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-700 dark:text-red-300">
              {error}
            </div>
          ) : null}

          {!loading && data && !data.directoryActive ? (
            <section className="rounded-[1.75rem] border border-[color:var(--loombus-border)] bg-[color:var(--loombus-surface)] p-8 text-center shadow-xl shadow-black/10">
              <PackageSearch className="mx-auto text-[#b45309]" size={36} />
              <h2 className="mt-4 text-xl font-semibold">Marketplace is not active yet</h2>
              <p className="mt-2 text-sm text-[color:var(--loombus-text-muted)]">
                Apply the Marketplace migrations before opening this directory.
              </p>
            </section>
          ) : null}

          <div className="mb-4 flex items-end justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.28em] text-[#b45309]">
                Approved listings
              </p>
              <h2 className="mt-1 text-2xl font-semibold tracking-[-0.035em] text-[color:var(--loombus-text)]">
                {loading ? "Loading Marketplace" : `${data?.total ?? 0} items found`}
              </h2>
            </div>
            {category ? (
              <span className="hidden rounded-full bg-orange-50 px-3 py-1.5 text-xs font-bold text-[#b45309] dark:bg-orange-400/10 sm:inline-flex">
                {category}
              </span>
            ) : null}
          </div>

          <section className="grid gap-5 md:grid-cols-2">
            {(data?.listings ?? []).map((listing) => {
              const fulfillmentLabels = marketplaceFulfillmentLabels(listing);
              const primaryPhoto = listing.photos[0]?.url;
              return (
                <Link
                  key={listing.id}
                  href={`/marketplace/${listing.slug}`}
                  className="group overflow-hidden rounded-[1.75rem] border border-[color:var(--loombus-border)] bg-[color:var(--loombus-surface)] shadow-xl shadow-black/10 transition hover:-translate-y-0.5 hover:border-[color:var(--loombus-text-subtle)]"
                >
                  <div className="aspect-[4/3] bg-[color:var(--loombus-surface-muted)]">
                    {primaryPhoto ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={primaryPhoto}
                        alt=""
                        className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.02]"
                        loading="lazy"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center text-[#b45309]">
                        <PackageSearch size={42} />
                      </div>
                    )}
                  </div>
                  <div className="p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <span className="inline-flex rounded-full bg-orange-50 px-3 py-1 text-xs font-bold text-[#b45309] dark:bg-orange-400/10">
                          {listing.category}
                        </span>
                        <h3 className="mt-3 text-xl font-semibold leading-snug tracking-[-0.025em] text-[color:var(--loombus-text)]">
                          {listing.title}
                        </h3>
                      </div>
                      <strong className="shrink-0 text-lg text-[color:var(--loombus-text)]">
                        {marketplacePriceLabel(listing)}
                      </strong>
                    </div>
                    <p className="mt-3 line-clamp-2 text-sm leading-6 text-[color:var(--loombus-text-muted)]">
                      {listing.description}
                    </p>
                    <div className="mt-4 flex flex-wrap gap-2 text-xs text-[color:var(--loombus-text-muted)]">
                      <span className="rounded-full border border-[color:var(--loombus-border)] px-3 py-1.5">
                        {marketplaceConditionLabel(listing.condition)}
                      </span>
                      {listing.isNegotiable ? (
                        <span className="rounded-full border border-[color:var(--loombus-border)] px-3 py-1.5">
                          Negotiable
                        </span>
                      ) : null}
                    </div>
                    <div className="mt-4 space-y-2 text-sm text-[color:var(--loombus-text-muted)]">
                      <div className="flex items-center gap-2">
                        <MapPin size={15} className="text-[#b45309]" />
                        {marketplaceLocationLabel(listing)}
                      </div>
                      <div className="flex items-center gap-2">
                        <Truck size={15} className="text-[#b45309]" />
                        {fulfillmentLabels.join(" · ")}
                      </div>
                    </div>
                    <div className="mt-4 border-t border-[color:var(--loombus-border)] pt-4 text-xs font-semibold text-[color:var(--loombus-text-muted)]">
                      {listing.businessName || listing.sellerName}
                      {listing.businessVerificationStatus === "verified" ? " · Verified business" : ""}
                    </div>
                  </div>
                </Link>
              );
            })}
          </section>

          {loading ? (
            <section className="mt-5 rounded-[1.75rem] border border-[color:var(--loombus-border)] bg-[color:var(--loombus-surface)] p-7 text-center text-sm text-[color:var(--loombus-text-muted)] shadow-xl shadow-black/10">
              Loading Marketplace listings…
            </section>
          ) : null}

          {!loading && data?.directoryActive && data.listings.length === 0 ? (
            <section className="mt-5 rounded-[1.75rem] border border-[color:var(--loombus-border)] bg-[color:var(--loombus-surface)] p-8 text-center shadow-xl shadow-black/10">
              <PackageSearch className="mx-auto text-[#b45309]" size={36} />
              <h2 className="mt-4 text-xl font-semibold">No matching listings</h2>
              <p className="mt-2 text-sm text-[color:var(--loombus-text-muted)]">
                Adjust the filters or return after more approved items are listed.
              </p>
              {activeFilterCount > 0 ? (
                <button
                  type="button"
                  onClick={resetFilters}
                  className="mt-5 rounded-full bg-[color:var(--loombus-primary-bg)] px-5 py-3 text-sm font-semibold text-[color:var(--loombus-primary-text)] transition hover:opacity-90"
                >
                  Clear filters
                </button>
              ) : null}
            </section>
          ) : null}

          {data && totalPages > 1 ? (
            <div className="mt-8 flex items-center justify-center gap-3">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((value) => Math.max(value - 1, 1))}
                className="inline-flex items-center gap-2 rounded-xl border border-[color:var(--loombus-border)] bg-[color:var(--loombus-surface)] px-4 py-2.5 font-semibold disabled:opacity-40"
              >
                <ChevronLeft size={17} /> Previous
              </button>
              <span className="text-sm text-[color:var(--loombus-text-muted)]">
                Page {page} of {totalPages}
              </span>
              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => setPage((value) => Math.min(value + 1, totalPages))}
                className="inline-flex items-center gap-2 rounded-xl border border-[color:var(--loombus-border)] bg-[color:var(--loombus-surface)] px-4 py-2.5 font-semibold disabled:opacity-40"
              >
                Next <ChevronRight size={17} />
              </button>
            </div>
          ) : null}
        </section>

        <aside className="hidden xl:block">
          <div className="sticky top-28 space-y-5">
            <section className="rounded-[1.75rem] border border-[color:var(--loombus-border)] bg-[color:var(--loombus-surface)] p-5 shadow-2xl shadow-black/10">
              <p className="text-xs font-bold uppercase tracking-[0.34em] text-[color:var(--loombus-text)]">
                Marketplace actions
              </p>

              <Link
                href="/marketplace/manage"
                className="mt-5 flex w-full items-center justify-center gap-2 rounded-2xl bg-[#b45309] px-4 py-3.5 text-sm font-bold text-white transition hover:bg-[#92400e]"
              >
                <Store aria-hidden="true" className="h-4 w-4" />
                Sell an item
              </Link>

              <div className="mt-3 space-y-2">
                <Link
                  href="/marketplace/manage"
                  className="flex items-center justify-between rounded-2xl bg-[color:var(--loombus-page-bg)] px-4 py-3 text-sm font-semibold text-[color:var(--loombus-text)] transition hover:bg-[color:var(--loombus-surface-muted)]"
                >
                  Manage listings
                  <ChevronRight aria-hidden="true" className="h-4 w-4 text-[#b45309]" />
                </Link>
                <Link
                  href="/marketplace/saved"
                  className="flex items-center justify-between rounded-2xl bg-[color:var(--loombus-page-bg)] px-4 py-3 text-sm font-semibold text-[color:var(--loombus-text)] transition hover:bg-[color:var(--loombus-surface-muted)]"
                >
                  Saved items
                  <ChevronRight aria-hidden="true" className="h-4 w-4 text-[#b45309]" />
                </Link>
                <Link
                  href="/marketplace/safety"
                  className="flex items-center justify-between rounded-2xl bg-[color:var(--loombus-page-bg)] px-4 py-3 text-sm font-semibold text-[color:var(--loombus-text)] transition hover:bg-[color:var(--loombus-surface-muted)]"
                >
                  Safety and policy
                  <ChevronRight aria-hidden="true" className="h-4 w-4 text-[#b45309]" />
                </Link>
              </div>
            </section>

            <section className="rounded-[1.75rem] border border-[color:var(--loombus-border)] bg-[color:var(--loombus-surface)] p-5 shadow-2xl shadow-black/10">
              <div className="mb-4 flex items-center justify-between gap-3">
                <p className="text-xs font-bold uppercase tracking-[0.34em] text-[color:var(--loombus-text)]">
                  Marketplace standard
                </p>
                <ShieldCheck aria-hidden="true" className="h-5 w-5 text-[#b45309]" />
              </div>

              <div className="space-y-4 text-sm leading-6 text-[color:var(--loombus-text-muted)]">
                <div className="flex gap-3">
                  <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[#b45309]" />
                  <p>Listings come from attributable Loombus sellers.</p>
                </div>
                <div className="flex gap-3">
                  <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[#b45309]" />
                  <p>No sponsored placement and no pay-to-rank.</p>
                </div>
                <div className="flex gap-3">
                  <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[#b45309]" />
                  <p>Loombus does not process Marketplace payments in this release.</p>
                </div>
              </div>
            </section>

            <section className="rounded-[1.75rem] border border-[color:var(--loombus-border)] bg-[color:var(--loombus-surface)] p-5 shadow-2xl shadow-black/10">
              <div className="mb-4 flex items-center gap-2">
                <Truck aria-hidden="true" className="h-5 w-5 text-[#b45309]" />
                <p className="text-xs font-bold uppercase tracking-[0.34em] text-[color:var(--loombus-text)]">
                  Fulfillment
                </p>
              </div>

              <div className="space-y-2">
                {fulfillmentOptions.slice(1).map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => selectFulfillment(option.value)}
                    className={`flex w-full items-center justify-between rounded-2xl px-4 py-3 text-left text-sm font-semibold transition ${
                      fulfillment === option.value
                        ? "bg-orange-50 text-[#b45309] dark:bg-orange-400/10"
                        : "bg-[color:var(--loombus-page-bg)] text-[color:var(--loombus-text)] hover:bg-[color:var(--loombus-surface-muted)]"
                    }`}
                  >
                    {option.label}
                    <ChevronRight aria-hidden="true" className="h-4 w-4 text-[#b45309]" />
                  </button>
                ))}
              </div>
            </section>
          </div>
        </aside>
      </div>
    </main>
  );
}
