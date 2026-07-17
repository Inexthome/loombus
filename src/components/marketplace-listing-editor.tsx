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
  submitListing: (event: FormEvent<HTMLFormElement>) => void | Promise<void>;
  startNew: () => void;
};

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
  submitListing,
  startNew,
}: Props) {
  return (
    <section className="mt-6 rounded-[1.7rem] border border-[var(--loombus-border)] bg-[var(--loombus-surface)]">
      <button
        type="button"
        onClick={() => setFormOpen((value) => !value)}
        className="flex w-full items-center justify-between gap-4 p-5 text-left sm:p-6"
      >
        <span>
          <span className="block text-xs font-bold uppercase tracking-[0.18em] text-[var(--loombus-text-subtle)]">
            {editing ? "Edit listing" : "Create listing"}
          </span>
          <span className="mt-1 block text-xl font-semibold">
            {editing?.title || "Item details and seller attribution"}
          </span>
        </span>
        {formOpen ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
      </button>

      {formOpen ? (
        <form
          onSubmit={submitListing}
          className="border-t border-[var(--loombus-border)] p-5 sm:p-6"
        >
          <div className="grid gap-4 lg:grid-cols-2">
            <label className="lg:col-span-2">
              <span className="mb-2 block text-sm font-semibold">Seller attribution</span>
              <select
                value={draft.businessId}
                onChange={(event) => updateDraft("businessId", event.target.value)}
                className={inputClass}
              >
                <option value="">Personal seller · your Loombus profile</option>
                {(data?.businesses ?? []).map((business) => (
                  <option key={business.id} value={business.id}>
                    {business.name}
                    {business.verificationStatus === "verified" ? " · Verified" : ""}
                  </option>
                ))}
              </select>
            </label>

            <input
              required
              minLength={3}
              maxLength={200}
              value={draft.title}
              onChange={(event) => updateDraft("title", event.target.value)}
              placeholder="Listing title"
              className={inputClass}
            />
            <input
              required
              value={draft.category}
              onChange={(event) => updateDraft("category", event.target.value)}
              list="marketplace-category-options"
              placeholder="Category"
              className={inputClass}
            />
            <datalist id="marketplace-category-options">
              {usedCategories.map((category) => (
                <option key={category} value={category} />
              ))}
            </datalist>

            <select
              value={draft.condition}
              onChange={(event) => updateDraft("condition", event.target.value)}
              className={inputClass}
            >
              {MARKETPLACE_CONDITIONS.map((condition) => (
                <option key={condition.value} value={condition.value}>
                  {condition.label}
                </option>
              ))}
            </select>

            <div className="grid grid-cols-[minmax(0,1fr)_7rem] gap-3">
              <input
                required={!draft.isFree}
                disabled={draft.isFree}
                inputMode="decimal"
                value={draft.price}
                onChange={(event) => updateDraft("price", event.target.value)}
                placeholder={draft.isFree ? "Free" : "Price"}
                className={inputClass}
              />
              <input
                required
                maxLength={3}
                value={draft.currency}
                onChange={(event) =>
                  updateDraft("currency", event.target.value.toUpperCase())
                }
                aria-label="Currency"
                className={inputClass}
              />
            </div>

            <textarea
              required
              minLength={30}
              maxLength={16000}
              value={draft.description}
              onChange={(event) => updateDraft("description", event.target.value)}
              placeholder="Describe the item, condition, included parts, known issues, and transaction expectations"
              rows={7}
              className={`${inputClass} lg:col-span-2`}
            />
          </div>

          <div className="mt-5 flex flex-wrap gap-4 rounded-2xl bg-[var(--loombus-surface-muted)] p-4 text-sm">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={draft.isFree}
                onChange={(event) => {
                  updateDraft("isFree", event.target.checked);
                  if (event.target.checked) updateDraft("isNegotiable", false);
                }}
              />
              Free item
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                disabled={draft.isFree}
                checked={draft.isNegotiable}
                onChange={(event) =>
                  updateDraft("isNegotiable", event.target.checked)
                }
              />
              Price negotiable
            </label>
          </div>

          <section className="mt-7 border-t border-[var(--loombus-border)] pt-6">
            <h2 className="text-lg font-semibold">Location and fulfillment</h2>
            <div className="mt-4 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <input
                value={draft.city}
                onChange={(event) => updateDraft("city", event.target.value)}
                placeholder="City"
                className={inputClass}
              />
              <input
                value={draft.region}
                onChange={(event) => updateDraft("region", event.target.value)}
                placeholder="State or region"
                className={inputClass}
              />
              <input
                value={draft.postalCode}
                onChange={(event) => updateDraft("postalCode", event.target.value)}
                placeholder="Postal code"
                className={inputClass}
              />
              <input
                maxLength={2}
                value={draft.countryCode}
                onChange={(event) =>
                  updateDraft("countryCode", event.target.value.toUpperCase())
                }
                placeholder="US"
                className={inputClass}
              />
            </div>
            <div className="mt-4 flex flex-wrap gap-4 rounded-2xl bg-[var(--loombus-surface-muted)] p-4 text-sm">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={draft.pickupAvailable}
                  onChange={(event) =>
                    updateDraft("pickupAvailable", event.target.checked)
                  }
                />
                Pickup
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={draft.localDeliveryAvailable}
                  onChange={(event) =>
                    updateDraft("localDeliveryAvailable", event.target.checked)
                  }
                />
                Local delivery
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={draft.shippingAvailable}
                  onChange={(event) =>
                    updateDraft("shippingAvailable", event.target.checked)
                  }
                />
                Shipping
              </label>
            </div>
          </section>

          <section className="mt-7 border-t border-[var(--loombus-border)] pt-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold">Photos</h2>
                <p className="mt-1 text-sm text-[var(--loombus-text-muted)]">
                  Add legitimate item photos as needed. Each file must be JPEG, PNG, or WebP and 12 MB or smaller.
                </p>
              </div>
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-[var(--loombus-border)] px-4 py-2.5 font-semibold">
                {uploading ? <Loader2 className="animate-spin" size={17} /> : <Upload size={17} />}
                Add photos
                <input
                  type="file"
                  multiple
                  accept="image/jpeg,image/png,image/webp"
                  onChange={uploadPhotos}
                  disabled={uploading}
                  className="sr-only"
                />
              </label>
            </div>
            {draft.photos.length > 0 ? (
              <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {draft.photos.map((photo) => (
                  <div
                    key={photo.path}
                    className="overflow-hidden rounded-xl border border-[var(--loombus-border)]"
                  >
                    <div className="aspect-[4/3] bg-[var(--loombus-surface-muted)]">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={photo.url} alt="" className="h-full w-full object-cover" />
                    </div>
                    <button
                      type="button"
                      onClick={() => void removePhoto(photo)}
                      className="inline-flex w-full items-center justify-center gap-2 border-t border-[var(--loombus-border)] px-3 py-2 text-sm font-semibold"
                    >
                      <Trash2 size={15} /> Remove photo
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="mt-4 flex items-center gap-3 rounded-2xl border border-dashed border-[var(--loombus-border)] p-5 text-sm text-[var(--loombus-text-muted)]">
                <ImagePlus size={20} /> Photos are optional, but attributable item photos improve clarity.
              </div>
            )}
          </section>

          <section className="mt-7 border-t border-[var(--loombus-border)] pt-6">
            <div className="grid gap-5 lg:grid-cols-2">
              <label>
                <span className="mb-2 block text-sm font-semibold">Search tags</span>
                <textarea
                  value={draft.tags}
                  onChange={(event) => updateDraft("tags", event.target.value)}
                  placeholder="One tag per line or separated by commas"
                  rows={7}
                  className={inputClass}
                />
              </label>
              <div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm font-semibold">Item attributes</span>
                  <button
                    type="button"
                    onClick={() =>
                      updateDraft("attributes", [
                        ...draft.attributes,
                        { id: crypto.randomUUID(), key: "", value: "" },
                      ])
                    }
                    className="inline-flex items-center gap-2 rounded-xl border border-[var(--loombus-border)] px-3 py-2 text-sm font-semibold"
                  >
                    <Plus size={15} /> Add attribute
                  </button>
                </div>
                <div className="mt-3 space-y-3">
                  {draft.attributes.map((attribute) => (
                    <div key={attribute.id} className="grid grid-cols-[1fr_1.4fr_auto] gap-2">
                      <input
                        value={attribute.key}
                        onChange={(event) =>
                          updateDraft(
                            "attributes",
                            draft.attributes.map((item) =>
                              item.id === attribute.id
                                ? { ...item, key: event.target.value }
                                : item
                            )
                          )
                        }
                        placeholder="Attribute"
                        className={inputClass}
                      />
                      <input
                        value={attribute.value}
                        onChange={(event) =>
                          updateDraft(
                            "attributes",
                            draft.attributes.map((item) =>
                              item.id === attribute.id
                                ? { ...item, value: event.target.value }
                                : item
                            )
                          )
                        }
                        placeholder="Value"
                        className={inputClass}
                      />
                      <button
                        type="button"
                        onClick={() =>
                          updateDraft(
                            "attributes",
                            draft.attributes.filter((item) => item.id !== attribute.id)
                          )
                        }
                        className="rounded-xl border border-[var(--loombus-border)] px-3"
                        aria-label="Remove attribute"
                      >
                        <X size={17} />
                      </button>
                    </div>
                  ))}
                  {draft.attributes.length === 0 ? (
                    <p className="rounded-xl bg-[var(--loombus-surface-muted)] p-4 text-sm text-[var(--loombus-text-muted)]">
                      Add details such as brand, model, dimensions, color, material, or compatibility.
                    </p>
                  ) : null}
                </div>
              </div>
            </div>
          </section>

          <section className="mt-7 grid gap-4 border-t border-[var(--loombus-border)] pt-6 md:grid-cols-2">
            <label>
              <span className="mb-2 block text-sm font-semibold">Optional expiration</span>
              <input
                type="date"
                value={draft.expiresAt}
                onChange={(event) => updateDraft("expiresAt", event.target.value)}
                className={inputClass}
              />
            </label>
            <div className="rounded-2xl border border-[var(--loombus-border)] p-4 text-sm leading-6 text-[var(--loombus-text-muted)]">
              <div className="flex items-center gap-2 font-semibold text-[var(--loombus-text)]">
                <ShieldCheck size={17} /> Marketplace policy
              </div>
              Weapons, drugs, alcohol, nicotine, prescription items, counterfeit or stolen goods, adult products, hazardous materials, and regulated listings are prohibited.
            </div>
          </section>

          <div className="mt-7 flex flex-wrap gap-3 border-t border-[var(--loombus-border)] pt-6">
            <button
              type="submit"
              disabled={working || uploading}
              className="inline-flex items-center gap-2 rounded-xl bg-[var(--loombus-text)] px-5 py-3 font-semibold text-[var(--loombus-page-bg)] disabled:opacity-50"
            >
              {working ? <Loader2 className="animate-spin" size={17} /> : <Save size={17} />}
              {editing ? "Save and resubmit" : "Submit for review"}
            </button>
            {editing ? (
              <button
                type="button"
                onClick={startNew}
                className="rounded-xl border border-[var(--loombus-border)] px-5 py-3 font-semibold"
              >
                Cancel edit
              </button>
            ) : null}
          </div>
        </form>
      ) : null}
    </section>
  );
}
