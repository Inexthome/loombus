"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowUpRight,
  BadgeCheck,
  CalendarClock,
  Loader2,
  MapPin,
  PackageCheck,
  ShieldCheck,
  Store,
  Truck,
} from "lucide-react";
import type { FormEvent, ReactNode } from "react";
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
import MarketplaceSellerContactActions from "@/components/marketplace-seller-contact-actions";

const inputClass =
  "w-full border-b border-[color:var(--loombus-border)] bg-transparent px-0 py-3 text-[color:var(--loombus-text)] outline-none transition placeholder:text-[color:var(--loombus-text-subtle)] focus:border-[color:var(--loombus-gold)]";
const secondaryButton =
  "inline-flex min-h-11 items-center justify-center gap-2 border-b border-[color:var(--loombus-border)] px-1 text-sm font-semibold transition hover:border-[color:var(--loombus-gold)] hover:text-[color:var(--loombus-gold)] disabled:opacity-50";

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
      const response = await fetch(`/api/marketplace?slug=${encodeURIComponent(slug)}`, {
        cache: "no-store",
      });
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
      setError(cause instanceof Error ? cause.message : "Marketplace listing not found.");
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
      if (!response.ok) throw new Error(payload.error || "Report could not be submitted.");
      setDetails("");
      setReportState("Report submitted for administrator review.");
      setReportOpen(false);
    } catch (cause) {
      setReportState(cause instanceof Error ? cause.message : "Report could not be submitted.");
    } finally {
      setReporting(false);
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-[color:var(--loombus-page-bg)] px-4 pb-24 pt-5 text-[color:var(--loombus-text)] sm:px-6 lg:px-8">
        <div className="mx-auto grid min-h-64 max-w-[86rem] place-items-center border-y border-[color:var(--loombus-border-muted)]">
          <span className="inline-flex items-center gap-2 text-sm font-semibold text-[color:var(--loombus-text-muted)]">
            <Loader2 className="animate-spin text-[color:var(--loombus-gold)]" size={18} /> Loading Marketplace listing
          </span>
        </div>
      </main>
    );
  }

  if (!listing || error) {
    return (
      <main className="min-h-screen bg-[color:var(--loombus-page-bg)] px-4 pb-24 pt-8 text-[color:var(--loombus-text)] sm:px-6">
        <section className="mx-auto max-w-3xl border-y border-[color:var(--loombus-border-muted)] py-12 text-center">
          <AlertTriangle className="mx-auto text-[color:var(--loombus-gold)]" size={42} />
          <h1 className="mt-4 text-3xl font-semibold tracking-[-0.04em]">Listing unavailable</h1>
          <p className="mt-3 text-[color:var(--loombus-text-muted)]">{error || "This item is no longer available."}</p>
          <Link href="/marketplace" className={`${secondaryButton} mt-6`}><ArrowLeft size={16} /> Back to Marketplace</Link>
        </section>
      </main>
    );
  }

  const fulfillment = marketplaceFulfillmentLabels(listing);
  const mainPhoto = listing.photos[selectedPhoto]?.url;
  const expires = formatMarketplaceDate(listing.expiresAt);

  return (
    <main className="min-h-screen bg-[color:var(--loombus-page-bg)] px-4 pb-24 pt-5 text-[color:var(--loombus-text)] sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[86rem]">
        <Link href="/marketplace" className="inline-flex items-center gap-2 text-sm font-semibold text-[color:var(--loombus-text-muted)] transition hover:text-[color:var(--loombus-gold)]">
          <ArrowLeft size={16} /> Marketplace
        </Link>

        <header className="mt-5 border-b border-[color:var(--loombus-border-muted)] pb-6">
          <p className="text-xs font-bold uppercase tracking-[0.28em] text-[color:var(--loombus-gold)]">{listing.category}</p>
          <h1 className="mt-3 max-w-4xl text-4xl font-semibold tracking-[-0.055em] sm:text-5xl">{listing.title}</h1>
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm font-semibold text-[color:var(--loombus-text-muted)]">
            <span>Listed by {listing.businessName || listing.sellerName}</span>
            {listing.isNegotiable ? <span className="text-[color:var(--loombus-gold)]">Price negotiable</span> : null}
          </div>
        </header>

        <section className="grid border-b border-[color:var(--loombus-border-muted)] sm:grid-cols-2 lg:grid-cols-4" aria-label="Listing facts">
          <Fact icon={<PackageCheck size={18} />} label="Condition" value={marketplaceConditionLabel(listing.condition)} />
          <Fact icon={<MapPin size={18} />} label="Location" value={marketplaceLocationLabel(listing)} />
          <Fact icon={<Truck size={18} />} label="Fulfillment" value={fulfillment.join(" · ") || "Confirm with seller"} />
          <Fact icon={<CalendarClock size={18} />} label="Listing active through" value={expires ? `${expires}, unless sold sooner` : "Until sold or removed"} />
        </section>

        <div className="border-b border-[color:var(--loombus-border-muted)] py-5">
          <MarketplaceSellerContactActions listing={listing} />
        </div>

        {reportState ? <p className="border-b border-[color:var(--loombus-border-muted)] py-4 text-sm" role="status">{reportState}</p> : null}

        <section className="py-7" aria-label="Listing media">
          <div className="overflow-hidden rounded-2xl border border-[color:var(--loombus-border)] bg-[color:var(--loombus-surface-muted)]">
            <div className="aspect-[4/3]">
              {mainPhoto ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={mainPhoto} alt={listing.title} className="h-full w-full object-contain" />
              ) : (
                <div className="grid h-full place-items-center text-[color:var(--loombus-gold)]"><PackageCheck size={58} /></div>
              )}
            </div>
            {listing.photos.length > 1 ? (
              <div className="flex gap-3 overflow-x-auto border-t border-[color:var(--loombus-border-muted)] p-3">
                {listing.photos.map((photo, index) => (
                  <button key={photo.path} type="button" onClick={() => setSelectedPhoto(index)} className={`h-20 w-24 shrink-0 overflow-hidden rounded-xl border transition ${selectedPhoto === index ? "border-[color:var(--loombus-gold)]" : "border-[color:var(--loombus-border)]"}`} aria-label={`View photo ${index + 1}`}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={photo.url} alt="" className="h-full w-full object-cover" />
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        </section>

        <section className="border-y border-[color:var(--loombus-border-muted)] py-7">
          <p className="text-xs font-bold uppercase tracking-[0.28em] text-[color:var(--loombus-gold)]">Listing information</p>
          <div className="mt-5 grid gap-8 lg:grid-cols-[minmax(0,1.5fr)_minmax(16rem,0.75fr)]">
            <div>
              <h2 className="text-2xl font-semibold tracking-[-0.035em]">Item details</h2>
              <p className="mt-4 whitespace-pre-wrap text-base leading-8 text-[color:var(--loombus-text-muted)]">{listing.description}</p>
              {listing.tags.length > 0 ? <p className="mt-6 text-sm text-[color:var(--loombus-text-muted)]">{listing.tags.map((tag) => `#${tag}`).join(" · ")}</p> : null}
            </div>
            {Object.keys(listing.attributes).length > 0 ? (
              <div>
                <h3 className="text-sm font-bold uppercase tracking-[0.18em] text-[color:var(--loombus-text-muted)]">Attributes</h3>
                <dl className="mt-3 divide-y divide-[color:var(--loombus-border-muted)] border-y border-[color:var(--loombus-border-muted)]">
                  {Object.entries(listing.attributes).map(([key, value]) => (
                    <div key={key} className="flex items-start justify-between gap-4 py-3">
                      <dt className="text-sm text-[color:var(--loombus-text-muted)]">{key}</dt>
                      <dd className="text-right text-sm font-semibold">{value}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            ) : null}
          </div>
        </section>

        <section className="grid border-b border-[color:var(--loombus-border-muted)] lg:grid-cols-3" aria-label="Seller and transaction details">
          <div className="border-b border-[color:var(--loombus-border-muted)] py-6 lg:border-b-0 lg:border-r lg:pr-6">
            <p className="text-xs font-bold uppercase tracking-[0.24em] text-[color:var(--loombus-gold)]">Price</p>
            <strong className="mt-2 block text-3xl tracking-[-0.04em]">{marketplacePriceLabel(listing)}</strong>
            {listing.isNegotiable ? <p className="mt-2 text-sm text-[color:var(--loombus-text-muted)]">Seller marked this price as negotiable.</p> : null}
          </div>

          <div className="border-b border-[color:var(--loombus-border-muted)] py-6 lg:border-b-0 lg:border-r lg:px-6">
            <p className="text-xs font-bold uppercase tracking-[0.24em] text-[color:var(--loombus-gold)]">Seller</p>
            <div className="mt-3 flex items-center gap-3">
              {listing.businessLogoUrl || listing.sellerAvatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={listing.businessLogoUrl || listing.sellerAvatarUrl} alt="" className="h-11 w-11 rounded-full object-cover" />
              ) : <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-[color:var(--loombus-border)] text-[color:var(--loombus-gold)]"><Store size={19} /></span>}
              <div className="min-w-0"><p className="truncate font-semibold">{listing.businessName || listing.sellerName}</p><p className="text-xs text-[color:var(--loombus-text-muted)]">{listing.businessName ? `Attributed seller · ${listing.sellerName}` : "Personal seller"}</p></div>
              {listing.businessVerificationStatus === "verified" ? <BadgeCheck className="ml-auto shrink-0 text-[color:var(--loombus-gold)]" size={20} aria-label="Verified business" /> : null}
            </div>
            <div className="mt-4 flex flex-wrap gap-4">
              <Link href={sellerHref} className={secondaryButton}><ArrowUpRight size={16} /> View seller profile</Link>
              {listing.businessSlug ? <Link href={`/businesses/${listing.businessSlug}`} className={secondaryButton}><Store size={16} /> Business profile</Link> : null}
            </div>
          </div>

          <div className="py-6 lg:pl-6">
            <div className="flex gap-3">
              <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-[color:var(--loombus-gold)]" />
              <div>
                <h3 className="font-semibold">Transaction boundary</h3>
                <p className="mt-1 text-sm leading-6 text-[color:var(--loombus-text-muted)]">Loombus does not process payment, hold funds, arrange shipping, or guarantee this item. Confirm identity, condition, price, and delivery terms directly with the seller.</p>
                <button type="button" onClick={() => setReportOpen((value) => !value)} className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-red-600 dark:text-red-400"><AlertTriangle size={16} /> Report listing</button>
              </div>
            </div>
          </div>
        </section>

        {reportOpen ? (
          <form onSubmit={submitReport} className="border-b border-red-500/30 py-7">
            <p className="text-xs font-bold uppercase tracking-[0.24em] text-red-600 dark:text-red-400">Marketplace report</p>
            <h2 className="mt-1 text-2xl font-semibold tracking-[-0.035em]">Report this listing</h2>
            <p className="mt-2 text-sm leading-6 text-[color:var(--loombus-text-muted)]">Reports go to administrator review and do not contact the seller.</p>
            <div className="mt-5 grid max-w-2xl gap-5">
              <select value={reason} onChange={(event) => setReason(event.target.value)} className={inputClass}>
                <option>Prohibited or regulated item</option>
                <option>Counterfeit or stolen item</option>
                <option>Misleading description</option>
                <option>Seller safety concern</option>
                <option>Other policy concern</option>
              </select>
              <textarea required minLength={10} value={details} onChange={(event) => setDetails(event.target.value)} placeholder="Explain the concern" rows={5} className={inputClass} />
              <div className="flex flex-wrap gap-3">
                <button type="submit" disabled={reporting} className="inline-flex min-h-11 items-center justify-center gap-2 border-b-2 border-red-600 px-1 text-sm font-semibold text-red-600 disabled:opacity-50">
                  {reporting ? <Loader2 className="animate-spin" size={16} /> : <AlertTriangle size={16} />} Submit report
                </button>
                <button type="button" onClick={() => setReportOpen(false)} className={secondaryButton}>Cancel</button>
              </div>
            </div>
          </form>
        ) : null}

        <div className="flex flex-wrap items-center justify-between gap-4 py-6 text-sm">
          <p className="text-[color:var(--loombus-text-muted)]">Confirm listing details directly with the seller before making plans.</p>
          <Link href="/marketplace" className={secondaryButton}>Browse more listings</Link>
        </div>
      </div>
    </main>
  );
}

function Fact({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="border-b border-[color:var(--loombus-border-muted)] py-4 sm:border-r sm:px-4 sm:first:pl-0 sm:last:border-r-0 lg:border-b-0">
      <span className="text-[color:var(--loombus-gold)]">{icon}</span>
      <strong className="mt-2 block text-xs uppercase tracking-[0.16em] text-[color:var(--loombus-text-muted)]">{label}</strong>
      <span className="mt-1 block text-sm font-semibold leading-6">{value}</span>
    </div>
  );
}
