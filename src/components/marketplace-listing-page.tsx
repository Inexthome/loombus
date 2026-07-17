"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import {
  AlertTriangle,
  BadgeCheck,
  CalendarClock,
  ChevronLeft,
  MapPin,
  MessageCircle,
  PackageCheck,
  ShieldCheck,
  Store,
  Truck,
} from "lucide-react";
import type { FormEvent } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  formatMarketplaceDate,
  marketplaceConditionLabel,
  marketplaceFulfillmentLabels,
  marketplaceLocationLabel,
  marketplacePriceLabel,
  type MarketplaceListing,
} from "@/lib/marketplace";
import { marketplaceAuthorizedFetch } from "@/lib/marketplace-auth-client";

const inputClass =
  "w-full rounded-xl border border-[var(--loombus-border)] bg-[var(--loombus-page-bg)] px-4 py-3 outline-none";

export default function MarketplaceListingPage() {
  const params = useParams<{ slug: string }>();
  const slug = Array.isArray(params.slug) ? params.slug[0] : params.slug;
  const [listing, setListing] = useState<MarketplaceListing | null>(null);
  const [selectedPhoto, setSelectedPhoto] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reportOpen, setReportOpen] = useState(false);
  const [reason, setReason] = useState("Prohibited or regulated item");
  const [details, setDetails] = useState("");
  const [reportState, setReportState] = useState("");
  const [reporting, setReporting] = useState(false);

  const load = useCallback(async () => {
    if (!slug) return;
    setLoading(true);
    setError("");
    try {
      const response = await fetch(
        `/api/marketplace?slug=${encodeURIComponent(slug)}`,
        { cache: "no-store" }
      );
      const payload = (await response.json()) as {
        listing?: MarketplaceListing;
        error?: string;
      };
      if (!response.ok || !payload.listing) {
        throw new Error(payload.error || "Marketplace listing not found.");
      }
      setListing(payload.listing);
      setSelectedPhoto(0);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Marketplace listing not found."
      );
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    void load();
  }, [load]);

  const sellerHref = useMemo(() => {
    if (!listing?.sellerUsername) return "/people";
    return `/u/${encodeURIComponent(listing.sellerUsername)}`;
  }, [listing?.sellerUsername]);

  async function submitReport(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!listing) return;
    setReporting(true);
    setReportState("");
    try {
      const response = await marketplaceAuthorizedFetch("/api/marketplace", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "report",
          listingId: listing.id,
          reason,
          details,
        }),
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(payload.error || "Report could not be submitted.");
      }
      setDetails("");
      setReportState("Report submitted for administrator review.");
    } catch (cause) {
      setReportState(
        cause instanceof Error ? cause.message : "Report could not be submitted."
      );
    } finally {
      setReporting(false);
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-[var(--loombus-page-bg)] p-8 text-center text-[var(--loombus-text-muted)]">
        Loading Marketplace listing…
      </main>
    );
  }

  if (!listing || error) {
    return (
      <main className="min-h-screen bg-[var(--loombus-page-bg)] px-4 py-12 text-[var(--loombus-text)]">
        <div className="mx-auto max-w-2xl rounded-[1.6rem] border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-8 text-center">
          <AlertTriangle
            className="mx-auto text-[var(--loombus-text-subtle)]"
            size={36}
          />
          <h1 className="mt-4 text-2xl font-semibold">Listing unavailable</h1>
          <p className="mt-2 text-sm text-[var(--loombus-text-muted)]">
            {error || "This item is no longer available."}
          </p>
          <Link
            href="/marketplace"
            className="mt-5 inline-flex items-center gap-2 rounded-xl border border-[var(--loombus-border)] px-4 py-2.5 font-semibold"
          >
            <ChevronLeft size={17} /> Back to Marketplace
          </Link>
        </div>
      </main>
    );
  }

  const fulfillment = marketplaceFulfillmentLabels(listing);
  const mainPhoto = listing.photos[selectedPhoto]?.url;
  const expires = formatMarketplaceDate(listing.expiresAt);

  return (
    <main className="min-h-screen bg-[var(--loombus-page-bg)] text-[var(--loombus-text)]">
      <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <Link
          href="/marketplace"
          className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--loombus-text-muted)]"
        >
          <ChevronLeft size={17} /> Marketplace
        </Link>

        <div className="mt-5 grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(21rem,0.8fr)]">
          <section className="overflow-hidden rounded-[1.8rem] border border-[var(--loombus-border)] bg-[var(--loombus-surface)]">
            <div className="aspect-[4/3] bg-[var(--loombus-surface-muted)]">
              {mainPhoto ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={mainPhoto}
                  alt={listing.title}
                  className="h-full w-full object-contain"
                />
              ) : (
                <div className="flex h-full items-center justify-center text-[var(--loombus-text-subtle)]">
                  <PackageCheck size={56} />
                </div>
              )}
            </div>
            {listing.photos.length > 1 ? (
              <div className="flex gap-3 overflow-x-auto border-t border-[var(--loombus-border)] p-4">
                {listing.photos.map((photo, index) => (
                  <button
                    key={photo.path}
                    type="button"
                    onClick={() => setSelectedPhoto(index)}
                    className={`h-20 w-24 shrink-0 overflow-hidden rounded-xl border ${
                      selectedPhoto === index
                        ? "border-[var(--loombus-text)]"
                        : "border-[var(--loombus-border)]"
                    }`}
                    aria-label={`View photo ${index + 1}`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={photo.url}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  </button>
                ))}
              </div>
            ) : null}
          </section>

          <aside className="rounded-[1.8rem] border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-6 sm:p-7">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--loombus-text-subtle)]">
              {listing.category}
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-[-0.035em]">
              {listing.title}
            </h1>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <strong className="text-3xl">
                {marketplacePriceLabel(listing)}
              </strong>
              {listing.isNegotiable ? (
                <span className="rounded-full bg-[var(--loombus-surface-muted)] px-3 py-1.5 text-xs font-semibold">
                  Negotiable
                </span>
              ) : null}
            </div>

            <div className="mt-6 grid gap-3 text-sm text-[var(--loombus-text-muted)]">
              <div className="flex items-center gap-3">
                <PackageCheck size={18} />
                {marketplaceConditionLabel(listing.condition)}
              </div>
              <div className="flex items-center gap-3">
                <MapPin size={18} />
                {marketplaceLocationLabel(listing)}
              </div>
              <div className="flex items-center gap-3">
                <Truck size={18} />
                {fulfillment.join(" · ")}
              </div>
              {expires ? (
                <div className="flex items-center gap-3">
                  <CalendarClock size={18} />
                  Available through {expires}, unless sold sooner
                </div>
              ) : null}
            </div>

            <div className="mt-6 rounded-2xl border border-[var(--loombus-border)] bg-[var(--loombus-page-bg)] p-4">
              <div className="flex items-center gap-3">
                {listing.businessLogoUrl || listing.sellerAvatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={listing.businessLogoUrl || listing.sellerAvatarUrl}
                    alt=""
                    className="h-12 w-12 rounded-xl object-cover"
                  />
                ) : (
                  <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--loombus-surface-muted)]">
                    <Store size={21} />
                  </span>
                )}
                <div className="min-w-0">
                  <p className="font-semibold">
                    {listing.businessName || listing.sellerName}
                  </p>
                  <p className="mt-1 text-xs text-[var(--loombus-text-muted)]">
                    {listing.businessName
                      ? `Attributed seller · ${listing.sellerName}`
                      : "Personal seller"}
                  </p>
                </div>
                {listing.businessVerificationStatus === "verified" ? (
                  <BadgeCheck
                    className="ml-auto"
                    size={20}
                    aria-label="Verified business"
                  />
                ) : null}
              </div>
              <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
                <Link
                  href={sellerHref}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-[var(--loombus-text)] px-4 py-3 font-semibold text-[var(--loombus-page-bg)]"
                >
                  <MessageCircle size={17} /> Contact through profile
                </Link>
                {listing.businessSlug ? (
                  <Link
                    href={`/businesses/${listing.businessSlug}`}
                    className="inline-flex items-center justify-center gap-2 rounded-xl border border-[var(--loombus-border)] px-4 py-3 font-semibold"
                  >
                    <Store size={17} /> Business profile
                  </Link>
                ) : null}
              </div>
            </div>

            <div className="mt-5 rounded-2xl border border-[var(--loombus-border)] p-4 text-sm leading-6 text-[var(--loombus-text-muted)]">
              <div className="flex items-center gap-2 font-semibold text-[var(--loombus-text)]">
                <ShieldCheck size={17} /> Transaction boundary
              </div>
              <p className="mt-2">
                Loombus does not process payment, hold funds, arrange shipping, or guarantee this item. Confirm identity, condition, price, and delivery terms directly with the seller.
              </p>
            </div>
          </aside>
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
          <section className="rounded-[1.6rem] border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-6 sm:p-8">
            <h2 className="text-2xl font-semibold">Item details</h2>
            <p className="mt-4 whitespace-pre-wrap text-base leading-8 text-[var(--loombus-text-muted)]">
              {listing.description}
            </p>

            {Object.keys(listing.attributes).length > 0 ? (
              <div className="mt-7 border-t border-[var(--loombus-border)] pt-6">
                <h3 className="text-lg font-semibold">Attributes</h3>
                <dl className="mt-4 grid gap-3 sm:grid-cols-2">
                  {Object.entries(listing.attributes).map(([key, value]) => (
                    <div
                      key={key}
                      className="rounded-xl bg-[var(--loombus-surface-muted)] p-4"
                    >
                      <dt className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--loombus-text-subtle)]">
                        {key}
                      </dt>
                      <dd className="mt-1 text-sm">{value}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            ) : null}

            {listing.tags.length > 0 ? (
              <div className="mt-7 border-t border-[var(--loombus-border)] pt-6">
                <h3 className="text-lg font-semibold">Tags</h3>
                <div className="mt-3 flex flex-wrap gap-2">
                  {listing.tags.map((tag) => (
                    <span
                      key={tag}
                      className="rounded-full bg-[var(--loombus-surface-muted)] px-3 py-1.5 text-sm"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            ) : null}
          </section>

          <aside className="rounded-[1.6rem] border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-5">
            <button
              type="button"
              onClick={() => setReportOpen((value) => !value)}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-[var(--loombus-border)] px-4 py-3 font-semibold"
            >
              <AlertTriangle size={17} /> Report listing
            </button>
            {reportOpen ? (
              <form onSubmit={submitReport} className="mt-4 space-y-3">
                <select
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                  className={inputClass}
                >
                  <option>Prohibited or regulated item</option>
                  <option>Counterfeit or stolen item</option>
                  <option>Misleading description</option>
                  <option>Seller safety concern</option>
                  <option>Other policy concern</option>
                </select>
                <textarea
                  required
                  minLength={10}
                  value={details}
                  onChange={(event) => setDetails(event.target.value)}
                  placeholder="Explain the concern"
                  rows={5}
                  className={inputClass}
                />
                <button
                  type="submit"
                  disabled={reporting}
                  className="w-full rounded-xl bg-[var(--loombus-text)] px-4 py-3 font-semibold text-[var(--loombus-page-bg)] disabled:opacity-50"
                >
                  {reporting ? "Submitting…" : "Submit report"}
                </button>
                {reportState ? (
                  <p className="text-sm leading-6 text-[var(--loombus-text-muted)]">
                    {reportState}
                  </p>
                ) : null}
              </form>
            ) : null}
          </aside>
        </div>
      </div>
    </main>
  );
}
