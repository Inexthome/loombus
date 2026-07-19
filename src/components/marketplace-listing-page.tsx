"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowUpRight,
  BadgeCheck,
  CalendarClock,
  ChevronRight,
  Loader2,
  MapPin,
  MessageCircle,
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

const inputClass =
  "w-full rounded-2xl border border-[color:var(--loombus-border)] bg-[color:var(--loombus-page-bg)] px-4 py-3 text-[color:var(--loombus-text)] outline-none transition placeholder:text-[color:var(--loombus-text-subtle)] focus:border-[color:var(--loombus-gold)] focus:ring-4 focus:ring-[color:var(--loombus-gold-soft)]";
const secondaryButton =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-[color:var(--loombus-border)] bg-[color:var(--loombus-surface)] px-4 text-sm font-semibold transition hover:border-[color:var(--loombus-gold)] hover:bg-[color:var(--loombus-surface-muted)] disabled:opacity-50";
const primaryButton =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-[color:var(--loombus-gold)] px-4 text-sm font-semibold text-[color:var(--loombus-gold-contrast)] transition hover:opacity-90 disabled:opacity-50";

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
        <div className="mx-auto grid min-h-64 max-w-[86rem] place-items-center rounded-[1.75rem] border border-[color:var(--loombus-border)] bg-[color:var(--loombus-surface)] shadow-xl shadow-black/10">
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
        <section className="mx-auto max-w-3xl rounded-[1.75rem] border border-[color:var(--loombus-border)] bg-[color:var(--loombus-surface)] p-10 text-center shadow-xl shadow-black/10">
          <AlertTriangle className="mx-auto text-[color:var(--loombus-gold)]" size={42} />
          <h1 className="mt-4 text-3xl font-semibold tracking-[-0.04em]">Listing unavailable</h1>
          <p className="mt-3 text-[color:var(--loombus-text-muted)]">{error || "This item is no longer available."}</p>
          <Link href="/marketplace" className={`${secondaryButton} mt-6`}>
            <ArrowLeft size={16} /> Back to Marketplace
          </Link>
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
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-[color:var(--loombus-border)] bg-[color:var(--loombus-surface)] px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-[color:var(--loombus-text-muted)]">{listing.category}</span>
            {listing.isNegotiable ? (
              <span className="rounded-full bg-[color:var(--loombus-cream)] px-3 py-1.5 text-xs font-semibold text-[color:var(--loombus-cream-contrast)] dark:bg-[color:var(--loombus-gold-soft)] dark:text-[color:var(--loombus-gold)]">Negotiable</span>
            ) : null}
          </div>
          <h1 className="mt-4 max-w-4xl text-4xl font-semibold tracking-[-0.055em] sm:text-5xl">{listing.title}</h1>
          <p className="mt-3 text-base font-semibold text-[color:var(--loombus-text-muted)]">Listed by {listing.businessName || listing.sellerName}</p>
        </header>

        <section className="my-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Fact icon={<PackageCheck size={18} />} label="Condition" value={marketplaceConditionLabel(listing.condition)} featured />
          <Fact icon={<MapPin size={18} />} label="Location" value={marketplaceLocationLabel(listing)} />
          <Fact icon={<Truck size={18} />} label="Fulfillment" value={fulfillment.join(" · ") || "Confirm with seller"} />
          <Fact icon={<CalendarClock size={18} />} label="Availability" value={expires ? `Through ${expires}, unless sold sooner` : "Until sold or removed"} />
        </section>

        {reportState ? (
          <p className="mb-6 rounded-2xl border border-[color:var(--loombus-border)] bg-[color:var(--loombus-surface)] p-4 text-sm shadow-sm" role="status">{reportState}</p>
        ) : null}

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
          <section className="min-w-0 space-y-5">
            <section className="overflow-hidden rounded-[1.75rem] border border-[color:var(--loombus-border)] bg-[color:var(--loombus-surface)] shadow-xl shadow-black/10">
              <div className="aspect-[4/3] bg-[color:var(--loombus-surface-muted)]">
                {mainPhoto ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={mainPhoto} alt={listing.title} className="h-full w-full object-contain" />
                ) : (
                  <div className="grid h-full place-items-center text-[color:var(--loombus-gold)]"><PackageCheck size={58} /></div>
                )}
              </div>
              {listing.photos.length > 1 ? (
                <div className="flex gap-3 overflow-x-auto border-t border-[color:var(--loombus-border-muted)] p-4">
                  {listing.photos.map((photo, index) => (
                    <button
                      key={photo.path}
                      type="button"
                      onClick={() => setSelectedPhoto(index)}
                      className={`h-20 w-24 shrink-0 overflow-hidden rounded-2xl border transition ${selectedPhoto === index ? "border-[color:var(--loombus-gold)] ring-4 ring-[color:var(--loombus-gold-soft)]" : "border-[color:var(--loombus-border)]"}`}
                      aria-label={`View photo ${index + 1}`}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={photo.url} alt="" className="h-full w-full object-cover" />
                    </button>
                  ))}
                </div>
              ) : null}
            </section>

            <section className="rounded-[1.75rem] border border-[color:var(--loombus-border)] bg-[color:var(--loombus-surface)] p-6 shadow-xl shadow-black/10 sm:p-7">
              <p className="text-xs font-bold uppercase tracking-[0.28em] text-[color:var(--loombus-gold)]">Listing information</p>
              <h2 className="mt-1 text-2xl font-semibold tracking-[-0.035em]">Item details</h2>
              <p className="mt-4 whitespace-pre-wrap text-base leading-8 text-[color:var(--loombus-text-muted)]">{listing.description}</p>

              {Object.keys(listing.attributes).length > 0 ? (
                <div className="mt-7 border-t border-[color:var(--loombus-border-muted)] pt-6">
                  <h3 className="text-lg font-semibold">Attributes</h3>
                  <dl className="mt-4 grid gap-3 sm:grid-cols-2">
                    {Object.entries(listing.attributes).map(([key, value]) => (
                      <div key={key} className="rounded-2xl bg-[color:var(--loombus-page-bg)] p-4">
                        <dt className="text-xs font-bold uppercase tracking-[0.14em] text-[color:var(--loombus-text-subtle)]">{key}</dt>
                        <dd className="mt-1 text-sm font-semibold">{value}</dd>
                      </div>
                    ))}
                  </dl>
                </div>
              ) : null}

              {listing.tags.length > 0 ? (
                <div className="mt-7 border-t border-[color:var(--loombus-border-muted)] pt-6">
                  <h3 className="text-lg font-semibold">Tags</h3>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {listing.tags.map((tag) => <span key={tag} className="rounded-full border border-[color:var(--loombus-border)] bg-[color:var(--loombus-page-bg)] px-3 py-1.5 text-sm text-[color:var(--loombus-text-muted)]">{tag}</span>)}
                  </div>
                </div>
              ) : null}
            </section>

            {reportOpen ? (
              <form onSubmit={submitReport} className="rounded-[1.75rem] border border-red-500/30 bg-[color:var(--loombus-surface)] p-6 shadow-xl shadow-black/10 sm:p-7">
                <p className="text-xs font-bold uppercase tracking-[0.24em] text-red-600 dark:text-red-400">Marketplace report</p>
                <h2 className="mt-1 text-2xl font-semibold tracking-[-0.035em]">Report this listing</h2>
                <p className="mt-2 text-sm leading-6 text-[color:var(--loombus-text-muted)]">Reports go to administrator review and do not contact the seller.</p>
                <div className="mt-5 grid gap-4">
                  <select value={reason} onChange={(event) => setReason(event.target.value)} className={inputClass}>
                    <option>Prohibited or regulated item</option>
                    <option>Counterfeit or stolen item</option>
                    <option>Misleading description</option>
                    <option>Seller safety concern</option>
                    <option>Other policy concern</option>
                  </select>
                  <textarea required minLength={10} value={details} onChange={(event) => setDetails(event.target.value)} placeholder="Explain the concern" rows={5} className={inputClass} />
                  <div className="flex flex-wrap gap-3">
                    <button type="submit" disabled={reporting} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-red-600 px-4 text-sm font-semibold text-white disabled:opacity-50">
                      {reporting ? <Loader2 className="animate-spin" size={16} /> : <AlertTriangle size={16} />} Submit report
                    </button>
                    <button type="button" onClick={() => setReportOpen(false)} className={secondaryButton}>Cancel</button>
                  </div>
                </div>
              </form>
            ) : null}
          </section>

          <aside className="space-y-5 xl:sticky xl:top-28 xl:self-start">
            <section className="rounded-[1.75rem] border border-[color:var(--loombus-gold)] bg-[color:var(--loombus-cream)] p-5 text-[color:var(--loombus-cream-contrast)] shadow-2xl shadow-black/10 dark:bg-[color:var(--loombus-gold-soft)] dark:text-[color:var(--loombus-text)]">
              <p className="text-xs font-bold uppercase tracking-[0.3em] text-[color:var(--loombus-gold)]">Price</p>
              <strong className="mt-2 block text-3xl tracking-[-0.04em]">{marketplacePriceLabel(listing)}</strong>
              {listing.isNegotiable ? <p className="mt-2 text-sm">Seller marked this price as negotiable.</p> : null}
            </section>

            <section className="rounded-[1.75rem] border border-[color:var(--loombus-border)] bg-[color:var(--loombus-surface)] p-5 shadow-2xl shadow-black/10">
              <p className="text-xs font-bold uppercase tracking-[0.3em]">Seller</p>
              <div className="mt-4 flex items-center gap-3">
                {listing.businessLogoUrl || listing.sellerAvatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={listing.businessLogoUrl || listing.sellerAvatarUrl} alt="" className="h-12 w-12 rounded-2xl object-cover" />
                ) : (
                  <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-[color:var(--loombus-cream)] text-[color:var(--loombus-gold)] dark:bg-[color:var(--loombus-gold-soft)]"><Store size={21} /></span>
                )}
                <div className="min-w-0">
                  <p className="truncate font-semibold">{listing.businessName || listing.sellerName}</p>
                  <p className="mt-1 text-xs text-[color:var(--loombus-text-muted)]">{listing.businessName ? `Attributed seller · ${listing.sellerName}` : "Personal seller"}</p>
                </div>
                {listing.businessVerificationStatus === "verified" ? <BadgeCheck className="ml-auto shrink-0 text-[color:var(--loombus-gold)]" size={20} aria-label="Verified business" /> : null}
              </div>
              <div className="mt-4 grid gap-2">
                <Link href={sellerHref} className={primaryButton}><MessageCircle size={16} /> Contact through profile</Link>
                {listing.businessSlug ? (
                  <Link href={`/businesses/${listing.businessSlug}`} className={secondaryButton}><Store size={16} /> Business profile</Link>
                ) : null}
              </div>
            </section>

            <section className="rounded-[1.75rem] border border-[color:var(--loombus-border)] bg-[color:var(--loombus-surface)] p-5 shadow-2xl shadow-black/10">
              <p className="text-xs font-bold uppercase tracking-[0.3em]">Before contacting</p>
              <div className="mt-4 space-y-2 text-sm text-[color:var(--loombus-text-muted)]">
                <span className="flex items-center justify-between rounded-2xl bg-[color:var(--loombus-page-bg)] px-4 py-3"><span>Condition</span><strong className="text-[color:var(--loombus-text)]">{marketplaceConditionLabel(listing.condition)}</strong></span>
                <span className="flex items-center justify-between gap-3 rounded-2xl bg-[color:var(--loombus-page-bg)] px-4 py-3"><span>Location</span><strong className="text-right text-[color:var(--loombus-text)]">{marketplaceLocationLabel(listing)}</strong></span>
                <span className="flex items-center justify-between gap-3 rounded-2xl bg-[color:var(--loombus-page-bg)] px-4 py-3"><span>Fulfillment</span><strong className="text-right text-[color:var(--loombus-text)]">{fulfillment.join(" · ") || "Confirm directly"}</strong></span>
              </div>
            </section>

            <section className="rounded-[1.75rem] border border-[color:var(--loombus-border)] bg-[color:var(--loombus-surface)] p-5 shadow-2xl shadow-black/10">
              <div className="flex gap-3">
                <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-[color:var(--loombus-gold)]" />
                <div>
                  <h3 className="font-semibold">Transaction boundary</h3>
                  <p className="mt-1 text-sm leading-6 text-[color:var(--loombus-text-muted)]">Loombus does not process payment, hold funds, arrange shipping, or guarantee this item. Confirm identity, condition, price, and delivery terms directly with the seller.</p>
                  <button type="button" onClick={() => setReportOpen((value) => !value)} className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-red-600 dark:text-red-400"><AlertTriangle size={16} /> Report listing</button>
                </div>
              </div>
            </section>

            <Link href="/marketplace" className="flex items-center justify-between rounded-[1.75rem] border border-[color:var(--loombus-border)] bg-[color:var(--loombus-surface)] px-5 py-4 text-sm font-semibold shadow-xl shadow-black/10 transition hover:border-[color:var(--loombus-gold)]">
              Browse more listings <ChevronRight className="h-4 w-4 text-[color:var(--loombus-gold)]" />
            </Link>
          </aside>
        </div>
      </div>
    </main>
  );
}

function Fact({
  icon,
  label,
  value,
  featured = false,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  featured?: boolean;
}) {
  return (
    <article className={`rounded-[1.4rem] border p-4 shadow-sm ${featured ? "border-[color:var(--loombus-gold)] bg-[color:var(--loombus-cream)] text-[color:var(--loombus-cream-contrast)] dark:bg-[color:var(--loombus-gold-soft)] dark:text-[color:var(--loombus-text)]" : "border-[color:var(--loombus-border)] bg-[color:var(--loombus-surface)]"}`}>
      <span className="text-[color:var(--loombus-gold)]">{icon}</span>
      <strong className="mt-3 block text-xs uppercase tracking-[0.16em] text-[color:var(--loombus-text-muted)]">{label}</strong>
      <span className="mt-1 block text-sm font-semibold leading-6">{value}</span>
    </article>
  );
}
