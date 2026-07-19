"use client";

import {
  BadgeCheck,
  Building2,
  MapPin,
  Wrench,
} from "lucide-react";
import {
  type BusinessProfile,
  businessLocationLabel,
  businessServiceAreaLabel,
} from "@/lib/business-directory";

export function BusinessProfileOverview({
  business,
}: {
  business: BusinessProfile;
}) {
  const location = businessLocationLabel(business) || "Location not published";
  const serviceArea = businessServiceAreaLabel(business);

  return (
    <section className="overflow-hidden rounded-[1.75rem] border border-[color:var(--loombus-border)] bg-[color:var(--loombus-surface)] shadow-xl shadow-black/10">
      {business.coverImageUrl ? (
        <div className="h-40 overflow-hidden border-b border-[color:var(--loombus-border-muted)] sm:h-56">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={business.coverImageUrl}
            alt=""
            className="h-full w-full object-cover"
          />
        </div>
      ) : null}

      <div className="p-5 sm:p-7">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
          <span className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-[1.4rem] border border-[color:var(--loombus-border)] bg-[color:var(--loombus-cream)] text-[color:var(--loombus-gold)] shadow-sm dark:bg-[color:var(--loombus-gold-soft)]">
            {business.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={business.logoUrl}
                alt=""
                className="h-full w-full object-cover"
              />
            ) : (
              <Building2 size={32} />
            )}
          </span>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-[color:var(--loombus-border)] px-3 py-1.5 text-xs font-semibold text-[color:var(--loombus-text-muted)]">
                {business.category}
              </span>
              {business.verificationStatus === "verified" ? (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-[color:var(--loombus-cream)] px-3 py-1.5 text-xs font-semibold text-[color:var(--loombus-cream-contrast)] dark:bg-[color:var(--loombus-gold-soft)] dark:text-[color:var(--loombus-gold)]">
                  <BadgeCheck size={14} /> Verified business
                </span>
              ) : (
                <span className="rounded-full border border-[color:var(--loombus-border)] px-3 py-1.5 text-xs text-[color:var(--loombus-text-subtle)]">
                  Ownership not verified
                </span>
              )}
            </div>

            <h1 className="mt-4 text-4xl font-semibold tracking-[-0.055em] sm:text-5xl">
              {business.name}
            </h1>
            <p className="mt-4 max-w-4xl whitespace-pre-wrap text-base leading-7 text-[color:var(--loombus-text-muted)]">
              {business.description}
            </p>
          </div>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          <article className="rounded-2xl bg-[color:var(--loombus-page-bg)] p-4">
            <MapPin className="text-[color:var(--loombus-gold)]" size={18} />
            <strong className="mt-3 block text-sm">Public location</strong>
            <span className="mt-1 block text-sm leading-6 text-[color:var(--loombus-text-muted)]">
              {location}
            </span>
          </article>
          <article className="rounded-2xl bg-[color:var(--loombus-page-bg)] p-4">
            <Wrench className="text-[color:var(--loombus-gold)]" size={18} />
            <strong className="mt-3 block text-sm">Service area</strong>
            <span className="mt-1 block text-sm leading-6 text-[color:var(--loombus-text-muted)]">
              {serviceArea}
            </span>
          </article>
          <article className="rounded-2xl bg-[color:var(--loombus-page-bg)] p-4">
            <Building2 className="text-[color:var(--loombus-gold)]" size={18} />
            <strong className="mt-3 block text-sm">Listed offerings</strong>
            <span className="mt-1 block text-sm leading-6 text-[color:var(--loombus-text-muted)]">
              {business.services.length} service{business.services.length === 1 ? "" : "s"} on this profile
            </span>
          </article>
        </div>
      </div>
    </section>
  );
}
