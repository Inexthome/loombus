"use client";

import Link from "next/link";
import { PackageSearch } from "lucide-react";
import { useEffect, useState } from "react";
import {
  marketplaceLocationLabel,
  marketplacePriceLabel,
  type MarketplaceListing,
} from "@/lib/marketplace";

export default function MarketplacePublicListingsSection({
  sellerUsername,
  businessSlug,
  heading = "Marketplace listings",
}: {
  sellerUsername?: string;
  businessSlug?: string;
  heading?: string;
}) {
  const [listings, setListings] = useState<MarketplaceListing[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let active = true;
    const params = new URLSearchParams({ limit: "6" });
    if (sellerUsername) params.set("sellerUsername", sellerUsername);
    if (businessSlug) params.set("businessSlug", businessSlug);

    void fetch(`/api/marketplace/public-listings?${params.toString()}`, {
      cache: "no-store",
    })
      .then((response) => response.json())
      .then((payload) => {
        if (active) setListings(Array.isArray(payload.listings) ? payload.listings : []);
      })
      .catch(() => null)
      .finally(() => {
        if (active) setLoaded(true);
      });

    return () => {
      active = false;
    };
  }, [businessSlug, sellerUsername]);

  if (!loaded || listings.length === 0) return null;

  return (
    <section className="bg-[var(--loombus-page-bg)] px-4 pb-10 text-[var(--loombus-text)] sm:px-6">
      <div className="mx-auto max-w-6xl rounded-[1.6rem] border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-5 sm:p-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--loombus-text-subtle)]">
              Loombus Marketplace
            </p>
            <h2 className="mt-1 text-2xl font-semibold">{heading}</h2>
          </div>
          <Link href="/marketplace" className="text-sm font-semibold">
            Browse all
          </Link>
        </div>
        <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {listings.map((listing) => (
            <Link
              key={listing.id}
              href={`/marketplace/${listing.slug}`}
              className="overflow-hidden rounded-2xl border border-[var(--loombus-border)] bg-[var(--loombus-page-bg)]"
            >
              <div className="aspect-[4/3] bg-[var(--loombus-surface-muted)]">
                {listing.photos[0]?.url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={listing.photos[0].url}
                    alt=""
                    className="h-full w-full object-cover"
                    loading="lazy"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center text-[var(--loombus-text-subtle)]">
                    <PackageSearch size={34} />
                  </div>
                )}
              </div>
              <div className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <h3 className="font-semibold leading-snug">{listing.title}</h3>
                  <strong className="shrink-0">{marketplacePriceLabel(listing)}</strong>
                </div>
                <p className="mt-2 text-xs text-[var(--loombus-text-muted)]">
                  {marketplaceLocationLabel(listing)}
                </p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
