"use client";

import { BUSINESS_CATEGORIES } from "@/lib/business-directory";
import type { BusinessDraft, UpdateBusinessDraft } from "@/components/business-manager-model";

const fieldClass = "border-0 border-b border-[var(--loombus-border)] bg-transparent px-0 py-3 outline-none transition focus:border-[var(--loombus-gold)] focus:ring-0";

export function BusinessListingFields({ draft, updateDraft }: { draft: BusinessDraft; updateDraft: UpdateBusinessDraft }) {
  return (
    <section className="border-b border-[var(--loombus-border)] pb-7">
      <p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--loombus-text-subtle)]">Profile</p>
      <div className="mt-4 grid gap-5 md:grid-cols-2">
        <label className="grid gap-1"><span className="text-sm font-semibold">Business name</span><input value={draft.name} onChange={(event) => updateDraft("name", event.target.value)} className={fieldClass} required /></label>
        <label className="grid gap-1"><span className="text-sm font-semibold">Category</span><select value={draft.category} onChange={(event) => updateDraft("category", event.target.value)} className={fieldClass} required><option value="">Choose a category</option>{BUSINESS_CATEGORIES.map((category) => <option key={category} value={category}>{category}</option>)}</select></label>
      </div>
      <label className="mt-5 grid gap-1"><span className="text-sm font-semibold">Business description</span><textarea value={draft.description} onChange={(event) => updateDraft("description", event.target.value)} rows={5} placeholder="Explain what the business does, who it serves, and what makes the listing useful." className={fieldClass} required /></label>
      <div className="mt-5 grid gap-5 md:grid-cols-3">
        <label className="grid gap-1"><span className="text-sm font-semibold">Phone</span><input value={draft.phone} onChange={(event) => updateDraft("phone", event.target.value)} className={fieldClass} /></label>
        <label className="grid gap-1"><span className="text-sm font-semibold">Public business email</span><input type="email" value={draft.contactEmail} onChange={(event) => updateDraft("contactEmail", event.target.value)} className={fieldClass} /></label>
        <label className="grid gap-1"><span className="text-sm font-semibold">Website</span><input type="url" value={draft.websiteUrl} onChange={(event) => updateDraft("websiteUrl", event.target.value)} placeholder="https://" className={fieldClass} /></label>
        <label className="grid gap-1"><span className="text-sm font-semibold">Booking or request URL</span><input type="url" value={draft.bookingUrl} onChange={(event) => updateDraft("bookingUrl", event.target.value)} placeholder="https://" className={fieldClass} /></label>
        <label className="grid gap-1"><span className="text-sm font-semibold">Logo image URL</span><input type="url" value={draft.logoUrl} onChange={(event) => updateDraft("logoUrl", event.target.value)} placeholder="https://" className={fieldClass} /></label>
        <label className="grid gap-1"><span className="text-sm font-semibold">Cover image URL</span><input type="url" value={draft.coverImageUrl} onChange={(event) => updateDraft("coverImageUrl", event.target.value)} placeholder="https://" className={fieldClass} /></label>
      </div>
    </section>
  );
}
