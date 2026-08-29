"use client";

import { BUSINESS_SERVICE_AREA_MODES } from "@/lib/business-directory";
import type { BusinessDraft, UpdateBusinessDraft } from "@/components/business-manager-model";

const fieldClass = "border-0 border-b border-[var(--loombus-border)] bg-transparent px-0 py-3 outline-none transition focus:border-[var(--loombus-gold)] focus:ring-0";

export function BusinessListingLocation({ draft, updateDraft }: { draft: BusinessDraft; updateDraft: UpdateBusinessDraft }) {
  return (
    <section className="border-b border-[var(--loombus-border)] py-7">
      <p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--loombus-text-subtle)]">Location and service area</p>
      <div className="mt-4 grid gap-5 md:grid-cols-2">
        <label className="grid gap-1"><span className="text-sm font-semibold">Service model</span><select value={draft.serviceAreaMode} onChange={(event) => updateDraft("serviceAreaMode", event.target.value)} className={fieldClass}>{BUSINESS_SERVICE_AREA_MODES.map((mode) => <option key={mode.value} value={mode.value}>{mode.label}</option>)}</select></label>
        <label className="grid gap-1"><span className="text-sm font-semibold">Service radius in miles</span><input type="number" min="0" max="1000" value={draft.serviceRadiusMiles} onChange={(event) => updateDraft("serviceRadiusMiles", event.target.value)} className={fieldClass} /></label>
        <label className="grid gap-1 md:col-span-2"><span className="text-sm font-semibold">Service areas, separated by commas</span><input value={draft.serviceAreas} onChange={(event) => updateDraft("serviceAreas", event.target.value)} placeholder="Jacksonville, Middleburg, Orange Park" className={fieldClass} /></label>
        <label className="grid gap-1"><span className="text-sm font-semibold">Address line 1</span><input value={draft.addressLine1} onChange={(event) => updateDraft("addressLine1", event.target.value)} className={fieldClass} /></label>
        <label className="grid gap-1"><span className="text-sm font-semibold">Address line 2</span><input value={draft.addressLine2} onChange={(event) => updateDraft("addressLine2", event.target.value)} className={fieldClass} /></label>
        <label className="grid gap-1"><span className="text-sm font-semibold">City</span><input value={draft.city} onChange={(event) => updateDraft("city", event.target.value)} className={fieldClass} /></label>
        <label className="grid gap-1"><span className="text-sm font-semibold">State or region</span><input value={draft.region} onChange={(event) => updateDraft("region", event.target.value)} className={fieldClass} /></label>
        <label className="grid gap-1"><span className="text-sm font-semibold">Postal code</span><input value={draft.postalCode} onChange={(event) => updateDraft("postalCode", event.target.value)} className={fieldClass} /></label>
        <label className="grid gap-1"><span className="text-sm font-semibold">Country code</span><input value={draft.countryCode} onChange={(event) => updateDraft("countryCode", event.target.value.toUpperCase())} maxLength={2} className={`${fieldClass} uppercase`} /></label>
      </div>
      <label className="mt-5 flex items-start gap-3 text-sm"><input type="checkbox" checked={draft.showExactAddress} onChange={(event) => updateDraft("showExactAddress", event.target.checked)} className="mt-1" /><span>Show the exact street address publicly. City, state, and service areas remain public even when this is off.</span></label>
    </section>
  );
}
