"use client";

import {
  ChevronDown,
  ChevronUp,
  ImagePlus,
  Loader2,
  Plus,
  Save,
  ShieldCheck,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import type { ChangeEvent, Dispatch, FormEvent, SetStateAction } from "react";
import {
  MARKETPLACE_CONDITIONS,
  type MarketplaceListing,
  type MarketplaceManageResponse,
  type MarketplacePhoto,
} from "@/lib/marketplace";
import {
  marketplaceInputClass as inputClass,
  type MarketplaceDraft,
  type UpdateMarketplaceDraft,
} from "@/components/marketplace-manager-model";

type Props = {
  data: MarketplaceManageResponse | null;
  draft: MarketplaceDraft;
  editing: MarketplaceListing | null;
  formOpen: boolean;
  setFormOpen: Dispatch<SetStateAction<boolean>>;
  usedCategories: string[];
  working: boolean;
  uploading: boolean;
  updateDraft: UpdateMarketplaceDraft;
  uploadPhotos: (event: ChangeEvent<HTMLInputElement>) => void | Promise<void>;
  removePhoto: (photo: MarketplacePhoto) => void | Promise<void>;
  saveDraft: () => void | Promise<void>;
  submitListing: (event: FormEvent<HTMLFormElement>) => void | Promise<void>;
  startNew: () => void;
};

const secondaryButton =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-[color:var(--loombus-border)] px-4 text-sm font-semibold transition hover:border-[color:var(--loombus-gold)] hover:bg-[color:var(--loombus-surface-muted)] disabled:opacity-50";
const primaryButton =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-[color:var(--loombus-gold)] px-4 text-sm font-semibold text-[color:var(--loombus-gold-contrast)] transition hover:opacity-90 disabled:opacity-50";

export function MarketplaceListingEditor({
  data,
  draft,
  editing,
  formOpen,
  setFormOpen,
  usedCategories,
  working,
  uploading,
  updateDraft,
  uploadPhotos,
  removePhoto,
  saveDraft,
  submitListing,
  startNew,
}: Props) {
  return (
    <section className="overflow-hidden rounded-[1.75rem] border border-[color:var(--loombus-border)] bg-[color:var(--loombus-surface)] shadow-xl shadow-black/10">
      <button
        type="button"
        onClick={() => setFormOpen((value) => !value)}
        className="flex w-full items-center justify-between gap-4 p-5 text-left sm:p-6"
      >
        <span>
          <span className="block text-xs font-bold uppercase tracking-[0.28em] text-[color:var(--loombus-gold)]">
            {editing ? "Edit listing" : "Create listing"}
          </span>
          <span className="mt-1 block text-2xl font-semibold tracking-[-0.035em]">
            {editing?.title || "Item details and seller attribution"}
          </span>
          <span className="mt-2 block text-sm leading-6 text-[color:var(--loombus-text-muted)]">
            State the item, ownership context, condition, price, location, fulfillment options, and known limitations clearly.
          </span>
        </span>
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[color:var(--loombus-cream)] text-[color:var(--loombus-gold)] dark:bg-[color:var(--loombus-gold-soft)]">
          {formOpen ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
        </span>
      </button>

      {formOpen ? (
        <form onSubmit={submitListing} className="border-t border-[color:var(--loombus-border-muted)] p-5 sm:p-6">
          <section>
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-[color:var(--loombus-text-subtle)]">Identity and price</p>
            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              <label className="lg:col-span-2">
                <span className="mb-2 block text-sm font-semibold">Seller attribution</span>
                <select value={draft.businessId} onChange={(event) => updateDraft("businessId", event.target.value)} className={inputClass}>
                  <option value="">Personal seller · your Loombus profile</option>
                  {(data?.businesses ?? []).map((business) => (
                    <option key={business.id} value={business.id}>
                      {business.name}{business.verificationStatus === "verified" ? " · Verified" : ""}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                <span className="mb-2 block text-sm font-semibold">Listing title</span>
                <input required minLength={3} maxLength={200} value={draft.title} onChange={(event) => updateDraft("title", event.target.value)} placeholder="What are you listing?" className={inputClass} />
              </label>

              <label>
                <span className="mb-2 block text-sm font-semibold">Category</span>
                <input required value={draft.category} onChange={(event) => updateDraft("category", event.target.value)} list="marketplace-category-options" placeholder="Choose or enter a category" className={inputClass} />
                <datalist id="marketplace-category-options">
                  {usedCategories.map((category) => <option key={category} value={category} />)}
                </datalist>
              </label>

              <label>
                <span className="mb-2 block text-sm font-semibold">Condition</span>
                <select value={draft.condition} onChange={(event) => updateDraft("condition", event.target.value)} className={inputClass}>
                  {MARKETPLACE_CONDITIONS.map((condition) => <option key={condition.value} value={condition.value}>{condition.label}</option>)}
                </select>
              </label>

              <label>
                <span className="mb-2 block text-sm font-semibold">Price and currency</span>
                <div className="grid grid-cols-[minmax(0,1fr)_7rem] gap-3">
                  <input required={!draft.isFree} disabled={draft.isFree} inputMode="decimal" value={draft.price} onChange={(event) => updateDraft("price", event.target.value)} placeholder={draft.isFree ? "Free" : "Price"} className={inputClass} />
                  <input required maxLength={3} value={draft.currency} onChange={(event) => updateDraft("currency", event.target.value.toUpperCase())} aria-label="Currency" className={inputClass} />
                </div>
              </label>

              <label className="lg:col-span-2">
                <span className="mb-2 block text-sm font-semibold">Description</span>
                <textarea required minLength={30} maxLength={16000} value={draft.description} onChange={(event) => updateDraft("description", event.target.value)} placeholder="Describe the item, condition, included parts, known issues, and transaction expectations" rows={7} className={inputClass} />
              </label>
            </div>

            <div className="mt-4 flex flex-wrap gap-4 rounded-2xl bg-[color:var(--loombus-page-bg)] p-4 text-sm">
              <label className="flex items-center gap-2 font-semibold">
                <input type="checkbox" checked={draft.isFree} onChange={(event) => { updateDraft("isFree", event.target.checked); if (event.target.checked) updateDraft("isNegotiable", false); }} className="accent-[color:var(--loombus-gold)]" />
                Free item
              </label>
              <label className="flex items-center gap-2 font-semibold">
                <input type="checkbox" disabled={draft.isFree} checked={draft.isNegotiable} onChange={(event) => updateDraft("isNegotiable", event.target.checked)} className="accent-[color:var(--loombus-gold)]" />
                Price negotiable
              </label>
            </div>
          </section>

          <section className="mt-7 border-t border-[color:var(--loombus-border-muted)] pt-6">
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-[color:var(--loombus-text-subtle)]">Location and fulfillment</p>
            <div className="mt-4 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <input value={draft.city} onChange={(event) => updateDraft("city", event.target.value)} placeholder="City" className={inputClass} />
              <input value={draft.region} onChange={(event) => updateDraft("region", event.target.value)} placeholder="State or region" className={inputClass} />
              <input value={draft.postalCode} onChange={(event) => updateDraft("postalCode", event.target.value)} placeholder="Postal code" className={inputClass} />
              <input maxLength={2} value={draft.countryCode} onChange={(event) => updateDraft("countryCode", event.target.value.toUpperCase())} placeholder="US" className={inputClass} />
            </div>
            <div className="mt-4 flex flex-wrap gap-4 rounded-2xl bg-[color:var(--loombus-page-bg)] p-4 text-sm">
              <label className="flex items-center gap-2 font-semibold"><input type="checkbox" checked={draft.pickupAvailable} onChange={(event) => updateDraft("pickupAvailable", event.target.checked)} className="accent-[color:var(--loombus-gold)]" /> Pickup</label>
              <label className="flex items-center gap-2 font-semibold"><input type="checkbox" checked={draft.localDeliveryAvailable} onChange={(event) => updateDraft("localDeliveryAvailable", event.target.checked)} className="accent-[color:var(--loombus-gold)]" /> Local delivery</label>
              <label className="flex items-center gap-2 font-semibold"><input type="checkbox" checked={draft.shippingAvailable} onChange={(event) => updateDraft("shippingAvailable", event.target.checked)} className="accent-[color:var(--loombus-gold)]" /> Shipping</label>
            </div>
          </section>

          <section className="mt-7 border-t border-[color:var(--loombus-border-muted)] pt-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.22em] text-[color:var(--loombus-text-subtle)]">Photos</p>
                <p className="mt-2 text-sm leading-6 text-[color:var(--loombus-text-muted)]">Add legitimate item photos as needed. Each file must be JPEG, PNG, or WebP and 12 MB or smaller.</p>
              </div>
              <label className={`${secondaryButton} cursor-pointer`}>
                {uploading ? <Loader2 className="animate-spin" size={17} /> : <Upload size={17} />}
                Add photos
                <input type="file" multiple accept="image/jpeg,image/png,image/webp" onChange={uploadPhotos} disabled={uploading} className="sr-only" />
              </label>
            </div>

            {draft.photos.length > 0 ? (
              <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {draft.photos.map((photo) => (
                  <div key={photo.path} className="overflow-hidden rounded-2xl border border-[color:var(--loombus-border)]">
                    <div className="aspect-[4/3] bg-[color:var(--loombus-surface-muted)]">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={photo.url} alt="" className="h-full w-full object-cover" />
                    </div>
                    <button type="button" onClick={() => void removePhoto(photo)} className="inline-flex w-full items-center justify-center gap-2 border-t border-[color:var(--loombus-border)] px-3 py-2 text-sm font-semibold transition hover:bg-[color:var(--loombus-surface-muted)]">
                      <Trash2 size={15} /> Remove photo
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="mt-4 flex items-center gap-3 rounded-2xl border border-dashed border-[color:var(--loombus-border)] p-5 text-sm text-[color:var(--loombus-text-muted)]">
                <ImagePlus className="text-[color:var(--loombus-gold)]" size={20} /> Photos are optional, but attributable item photos improve clarity.
              </div>
            )}
          </section>

          <section className="mt-7 border-t border-[color:var(--loombus-border-muted)] pt-6">
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-[color:var(--loombus-text-subtle)]">Discovery details</p>
            <div className="mt-4 grid gap-5 lg:grid-cols-2">
              <label>
                <span className="mb-2 block text-sm font-semibold">Search tags</span>
                <textarea value={draft.tags} onChange={(event) => updateDraft("tags", event.target.value)} placeholder="One tag per line or separated by commas" rows={7} className={inputClass} />
              </label>
              <div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm font-semibold">Item attributes</span>
                  <button type="button" onClick={() => updateDraft("attributes", [...draft.attributes, { id: crypto.randomUUID(), key: "", value: "" }])} className={secondaryButton}>
                    <Plus size={15} /> Add attribute
                  </button>
                </div>
                <div className="mt-3 space-y-3">
                  {draft.attributes.map((attribute) => (
                    <div key={attribute.id} className="grid grid-cols-[1fr_1.4fr_auto] gap-2">
                      <input value={attribute.key} onChange={(event) => updateDraft("attributes", draft.attributes.map((item) => item.id === attribute.id ? { ...item, key: event.target.value } : item))} placeholder="Attribute" className={inputClass} />
                      <input value={attribute.value} onChange={(event) => updateDraft("attributes", draft.attributes.map((item) => item.id === attribute.id ? { ...item, value: event.target.value } : item))} placeholder="Value" className={inputClass} />
                      <button type="button" onClick={() => updateDraft("attributes", draft.attributes.filter((item) => item.id !== attribute.id))} className="rounded-2xl border border-[color:var(--loombus-border)] px-3 transition hover:border-red-500/40" aria-label="Remove attribute"><X size={17} /></button>
                    </div>
                  ))}
                  {draft.attributes.length === 0 ? (
                    <p className="rounded-2xl bg-[color:var(--loombus-page-bg)] p-4 text-sm text-[color:var(--loombus-text-muted)]">Add details such as brand, model, dimensions, color, material, or compatibility.</p>
                  ) : null}
                </div>
              </div>
            </div>
          </section>

          <section className="mt-7 grid gap-4 border-t border-[color:var(--loombus-border-muted)] pt-6 md:grid-cols-2">
            <label>
              <span className="mb-2 block text-sm font-semibold">Optional expiration</span>
              <input type="date" value={draft.expiresAt} onChange={(event) => updateDraft("expiresAt", event.target.value)} className={inputClass} />
            </label>
            <div className="rounded-2xl border border-[color:var(--loombus-border)] bg-[color:var(--loombus-page-bg)] p-4 text-sm leading-6 text-[color:var(--loombus-text-muted)]">
              <div className="flex items-center gap-2 font-semibold text-[color:var(--loombus-text)]"><ShieldCheck className="text-[color:var(--loombus-gold)]" size={17} /> Marketplace policy</div>
              Weapons, drugs, alcohol, nicotine, prescription items, counterfeit or stolen goods, adult products, hazardous materials, and regulated listings are prohibited.
            </div>
          </section>

          <div className="mt-7 flex flex-wrap gap-3 border-t border-[color:var(--loombus-border-muted)] pt-6">
            <button type="button" onClick={() => void saveDraft()} disabled={working || uploading} className={secondaryButton}>
              {working ? <Loader2 className="animate-spin" size={17} /> : <Save size={17} />}
              {editing?.status === "draft" ? "Update draft" : "Save draft"}
            </button>
            <button type="submit" disabled={working || uploading} className={primaryButton}>
              {working ? <Loader2 className="animate-spin" size={17} /> : <Save size={17} />}
              {editing?.status === "draft" ? "Submit for review" : editing ? "Save and resubmit" : "Submit for review"}
            </button>
            {editing ? <button type="button" onClick={startNew} className={secondaryButton}>Cancel edit</button> : null}
          </div>
        </form>
      ) : null}
    </section>
  );
}
