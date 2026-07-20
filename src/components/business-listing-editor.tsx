"use client";

import {
  ChevronDown,
  ChevronUp,
  Loader2,
  Save,
  ShieldCheck,
  X,
} from "lucide-react";
import type { FormEvent } from "react";
import type { BusinessProfile } from "@/lib/business-directory";
import type {
  BusinessDraft,
  ServiceDraft,
  UpdateBusinessDraft,
} from "@/components/business-manager-model";
import { BusinessListingFields } from "@/components/business-listing-fields";
import { BusinessListingLocation } from "@/components/business-listing-location";
import { BusinessListingServices } from "@/components/business-listing-services";

type BusinessListingEditorProps = {
  editingBusiness: BusinessProfile | null;
  formOpen: boolean;
  toggleForm: () => void;
  submit: (event: FormEvent<HTMLFormElement>) => void | Promise<void>;
  draft: BusinessDraft;
  updateDraft: UpdateBusinessDraft;
  updateService: (
    index: number,
    key: keyof ServiceDraft,
    value: string,
  ) => void;
  addService: () => void;
  removeService: (index: number) => void;
  isAdmin: boolean;
  working: boolean;
  editingId: string;
  startNew: () => void;
};

export function BusinessListingEditor({
  editingBusiness,
  formOpen,
  toggleForm,
  submit,
  draft,
  updateDraft,
  updateService,
  addService,
  removeService,
  isAdmin,
  working,
  editingId,
  startNew,
}: BusinessListingEditorProps) {
  return (
    <section className="overflow-hidden rounded-[1.75rem] border border-[color:var(--loombus-border)] bg-[color:var(--loombus-surface)] shadow-xl shadow-black/10">
      <button
        type="button"
        onClick={toggleForm}
        className="flex w-full items-center justify-between gap-4 p-5 text-left transition hover:bg-[color:var(--loombus-surface-muted)] sm:p-6"
      >
        <span>
          <span className="block text-xs font-bold uppercase tracking-[0.28em] text-[color:var(--loombus-gold)]">
            {editingBusiness ? "Edit business" : "Business editor"}
          </span>
          <span className="mt-1 block text-2xl font-semibold tracking-[-0.035em]">
            {editingBusiness?.name || "Profile, location, and Services"}
          </span>
          <span className="mt-2 block text-sm leading-6 text-[color:var(--loombus-text-muted)]">
            Complete the attributable business record and submit material changes for review.
          </span>
        </span>
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-[color:var(--loombus-cream)] text-[color:var(--loombus-gold)] dark:bg-[color:var(--loombus-gold-soft)]">
          {formOpen ? <ChevronUp size={19} /> : <ChevronDown size={19} />}
        </span>
      </button>

      {formOpen ? (
        <form
          onSubmit={submit}
          className="border-t border-[color:var(--loombus-border-muted)] p-5 sm:p-6"
        >
          <BusinessListingFields draft={draft} updateDraft={updateDraft} />
          <BusinessListingLocation draft={draft} updateDraft={updateDraft} />
          <BusinessListingServices
            services={draft.services}
            updateService={updateService}
            addService={addService}
            removeService={removeService}
          />

          {isAdmin ? (
            <div className="mt-6 rounded-[1.4rem] border border-[color:var(--loombus-gold)] bg-[color:var(--loombus-cream)] p-5 text-[color:var(--loombus-cream-contrast)] dark:bg-[color:var(--loombus-gold-soft)] dark:text-[color:var(--loombus-text)]">
              <h2 className="flex items-center gap-2 font-semibold">
                <ShieldCheck size={18} className="text-[color:var(--loombus-gold)]" /> Administrator publishing
              </h2>
              <div className="mt-4 grid gap-3 text-sm sm:grid-cols-3">
                <label className="flex items-start gap-2 rounded-2xl bg-white/45 p-3 dark:bg-black/10">
                  <input type="checkbox" checked={draft.unclaimed} onChange={(event) => updateDraft("unclaimed", event.target.checked)} className="mt-0.5" />
                  <span>Create as an unclaimed listing</span>
                </label>
                <label className="flex items-start gap-2 rounded-2xl bg-white/45 p-3 dark:bg-black/10">
                  <input type="checkbox" checked={draft.publishNow} onChange={(event) => updateDraft("publishNow", event.target.checked)} className="mt-0.5" />
                  <span>Publish immediately</span>
                </label>
                <label className="flex items-start gap-2 rounded-2xl bg-white/45 p-3 dark:bg-black/10">
                  <input type="checkbox" checked={draft.verified} onChange={(event) => updateDraft("verified", event.target.checked)} className="mt-0.5" />
                  <span>Mark verified</span>
                </label>
              </div>
            </div>
          ) : null}

          <div className="mt-6 flex flex-wrap gap-3 border-t border-[color:var(--loombus-border-muted)] pt-6">
            <button
              type="submit"
              disabled={working}
              className="inline-flex min-h-12 items-center gap-2 rounded-2xl bg-[color:var(--loombus-gold)] px-5 font-semibold text-[color:var(--loombus-gold-contrast)] transition hover:opacity-90 disabled:opacity-50"
            >
              {working ? <Loader2 className="animate-spin" size={17} /> : <Save size={17} />}
              {editingId ? "Save and resubmit" : "Submit for review"}
            </button>
            {editingId ? (
              <button
                type="button"
                onClick={startNew}
                className="inline-flex min-h-12 items-center gap-2 rounded-2xl border border-[color:var(--loombus-border)] px-5 font-semibold transition hover:border-[color:var(--loombus-gold)]"
              >
                <X size={17} /> Cancel edit
              </button>
            ) : null}
          </div>
        </form>
      ) : null}
    </section>
  );
}
