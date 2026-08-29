"use client";

import { BadgeCheck, Building2, MapPin, Wrench } from "lucide-react";
import { type BusinessProfile, businessLocationLabel, businessServiceAreaLabel } from "@/lib/business-directory";

export function BusinessProfileOverview({ business }: { business: BusinessProfile }) {
  const location = businessLocationLabel(business) || "Location not published";
  const serviceArea = businessServiceAreaLabel(business);

  return (
    <section className="border-b border-[color:var(--loombus-border)] py-7">
      {business.coverImageUrl ? <div className="mb-7 h-44 overflow-hidden border-y border-[color:var(--loombus-border)] sm:h-60"><img src={business.coverImageUrl} alt="" className="h-full w-full object-cover" /></div> : null}
      <div className="grid gap-6 lg:grid-cols-[5rem_minmax(0,1fr)]">
        <span className="flex h-20 w-20 items-center justify-center overflow-hidden border border-[color:var(--loombus-border)] text-[color:var(--loombus-gold)]">{business.logoUrl ? <img src={business.logoUrl} alt="" className="h-full w-full object-cover" /> : <Building2 size={31} />}</span>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--loombus-text-subtle)]">
            <span>{business.category}</span>
            {business.verificationStatus === "verified" ? <span className="inline-flex items-center gap-1.5 text-[color:var(--loombus-gold)]"><BadgeCheck size={14} /> Verified business</span> : <span>Ownership not verified</span>}
          </div>
          <h1 className="mt-3 text-4xl font-semibold tracking-[-0.055em] sm:text-5xl">{business.name}</h1>
          <p className="mt-4 max-w-4xl whitespace-pre-wrap text-base leading-7 text-[color:var(--loombus-text-muted)]">{business.description}</p>
        </div>
      </div>
      <dl className="mt-7 grid border-t border-[color:var(--loombus-border)] sm:grid-cols-3">
        <div className="border-b border-[color:var(--loombus-border-muted)] py-4 sm:border-b-0 sm:border-r sm:pr-5"><dt className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.13em] text-[color:var(--loombus-text-subtle)]"><MapPin size={14} className="text-[color:var(--loombus-gold)]" />Public location</dt><dd className="mt-2 text-sm leading-6">{location}</dd></div>
        <div className="border-b border-[color:var(--loombus-border-muted)] py-4 sm:border-b-0 sm:border-r sm:px-5"><dt className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.13em] text-[color:var(--loombus-text-subtle)]"><Wrench size={14} className="text-[color:var(--loombus-gold)]" />Service area</dt><dd className="mt-2 text-sm leading-6">{serviceArea}</dd></div>
        <div className="py-4 sm:pl-5"><dt className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.13em] text-[color:var(--loombus-text-subtle)]"><Building2 size={14} className="text-[color:var(--loombus-gold)]" />Listed offerings</dt><dd className="mt-2 text-sm leading-6">{business.services.length} service{business.services.length === 1 ? "" : "s"}</dd></div>
      </dl>
    </section>
  );
}
