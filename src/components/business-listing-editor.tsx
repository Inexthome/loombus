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
    value: string
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
    <section className="mt-5 rounded-[1.5rem] border border-[var(--loombus-border)] bg-[var(--loombus-surface)]">
      <button
        type="button"
        onClick={toggleForm}
        className="flex w-full items-center justify-between gap-4 p-5 text-left sm:p-6"
      >
        <span>
          <span className="block text-xs font-bold uppercase tracking-[0.18em] text-[var(--loombus-text-subtle)]">
            {editingBusiness ? "Edit listing" : "Submit listing"}
          </span>
          <span className="mt-1 block text-xl font-semibold">
            {editingBusiness?.name || "Business profile and services"}
          </span>
        </span>
        {formOpen ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
      </button>

      {formOpen ? (
        <form
          onSubmit={submit}
          className="border-t border-[var(--loombus-border)] p-5 sm:p-6"
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
            <div className="mt-6 rounded-[1.3rem] border border-[var(--loombus-border)] p-5">
              <h2 className="flex items-center gap-2 font-semibold">
                <ShieldCheck size={18} /> Administrator publishing
              </h2>
              <div className="mt-4 flex flex-wrap gap-5 text-sm">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={draft.unclaimed}
                    onChange={(event) =>
                      updateDraft("unclaimed", event.target.checked)
                    }
                  />
                  Create as an unclaimed listing
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={draft.publishNow}
                    onChange={(event) =>
                      updateDraft("publishNow", event.target.checked)
                    }
                  />
                  Publish immediately
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={draft.verified}
                    onChange={(event) =>
                      updateDraft("verified", event.target.checked)
                    }
                  />
                  Mark verified
                </label>
              </div>
            </div>
          ) : null}

          <div className="mt-6 flex flex-wrap gap-3">
            <button
              type="submit"
              disabled={working}
              className="inline-flex items-center gap-2 rounded-xl bg-[var(--loombus-primary-bg)] px-5 py-3 font-semibold text-[var(--loombus-primary-text)] disabled:opacity-50"
            >
              {working ? (
                <Loader2 className="animate-spin" size={17} />
              ) : (
                <Save size={17} />
              )}
              {editingId ? "Save and resubmit" : "Submit for review"}
            </button>
            {editingId ? (
              <button
                type="button"
                onClick={startNew}
                className="inline-flex items-center gap-2 rounded-xl border border-[var(--loombus-border)] px-5 py-3 font-semibold"
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
