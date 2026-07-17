"use client";

import Link from "next/link";
import {
  BadgeCheck,
  Building2,
  CalendarCheck,
  ExternalLink,
  Globe2,
  Mail,
  MapPin,
  Phone,
  Wrench,
} from "lucide-react";
import {
  type BusinessProfile,
  businessLocationLabel,
  businessServiceAreaLabel,
} from "@/lib/business-directory";

function safeExternalHref(value: string) {
  if (!value) return "";
  try {
    const parsed = new URL(value);
    return ["http:", "https:"].includes(parsed.protocol)
      ? parsed.toString()
      : "";
  } catch {
    return "";
  }
}

export function BusinessProfileOverview({
  business,
}: {
  business: BusinessProfile;
}) {
  const location = businessLocationLabel(business);
  const serviceArea = businessServiceAreaLabel(business);
  const website = safeExternalHref(business.websiteUrl);
  const booking = safeExternalHref(business.bookingUrl);

  return (
    <section className="relative mt-5 overflow-hidden rounded-[2rem] border border-[var(--loombus-border)] bg-[var(--loombus-surface)] shadow-xl shadow-black/5">
      {business.coverImageUrl ? (
        <div className="h-44 overflow-hidden border-b border-[var(--loombus-border)] sm:h-60">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={business.coverImageUrl}
            alt=""
            className="h-full w-full object-cover"
          />
        </div>
      ) : null}

      <div className="p-6 sm:p-9">
        <div className="grid gap-7 lg:grid-cols-[minmax(0,1fr)_20rem]">
          <div className="flex items-start gap-5">
            <span className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-[1.4rem] border border-[var(--loombus-border)] bg-[var(--loombus-surface-muted)]">
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
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full border border-[var(--loombus-border)] px-3 py-1 text-xs font-semibold text-[var(--loombus-text-muted)]">
                  {business.category}
                </span>
                {business.verificationStatus === "verified" ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--loombus-surface-muted)] px-3 py-1 text-xs font-semibold">
                    <BadgeCheck size={14} /> Verified business
                  </span>
                ) : (
                  <span className="rounded-full bg-[var(--loombus-surface-muted)] px-3 py-1 text-xs text-[var(--loombus-text-muted)]">
                    Ownership not verified
                  </span>
                )}
              </div>
              <h1 className="mt-3 text-4xl font-semibold tracking-[-0.05em] sm:text-5xl">
                {business.name}
              </h1>
              <p className="mt-4 max-w-3xl whitespace-pre-wrap leading-7 text-[var(--loombus-text-muted)]">
                {business.description}
              </p>
            </div>
          </div>

          <aside className="rounded-[1.5rem] border border-[var(--loombus-border)] bg-[var(--loombus-page-bg)] p-5">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--loombus-text-subtle)]">
              Business details
            </p>
            <div className="mt-4 grid gap-3 text-sm">
              {location ? (
                <span className="flex items-start gap-2">
                  <MapPin className="mt-0.5 shrink-0" size={16} />
                  {location}
                </span>
              ) : null}
              <span className="flex items-start gap-2">
                <Wrench className="mt-0.5 shrink-0" size={16} />
                {serviceArea}
              </span>
              {business.phone ? (
                <a
                  href={`tel:${business.phone}`}
                  className="flex items-center gap-2 hover:underline"
                >
                  <Phone size={16} /> {business.phone}
                </a>
              ) : null}
              {business.contactEmail ? (
                <a
                  href={`mailto:${business.contactEmail}`}
                  className="flex items-center gap-2 hover:underline"
                >
                  <Mail size={16} /> {business.contactEmail}
                </a>
              ) : null}
              {website ? (
                <a
                  href={website}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-2 hover:underline"
                >
                  <Globe2 size={16} /> Website <ExternalLink size={13} />
                </a>
              ) : null}
            </div>

            <div className="mt-5 grid gap-2">
              {booking ? (
                <a
                  href={booking}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-[var(--loombus-primary-bg)] px-4 py-2.5 text-sm font-semibold text-[var(--loombus-primary-text)]"
                >
                  <CalendarCheck size={16} /> Request or book service
                </a>
              ) : null}
              <Link
                href={`/search?q=${encodeURIComponent(business.name)}`}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-[var(--loombus-border)] px-4 py-2.5 text-sm font-semibold"
              >
                Search Loombus discussions
              </Link>
            </div>
          </aside>
        </div>
      </div>
    </section>
  );
}
