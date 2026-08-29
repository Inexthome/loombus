"use client";

import { ChevronDown, ChevronUp, Loader2, Save, ShieldCheck, X } from "lucide-react";
import type { FormEvent } from "react";
import type { BusinessProfile } from "@/lib/business-directory";
import type { BusinessDraft, ServiceDraft, UpdateBusinessDraft } from "@/components/business-manager-model";
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
  updateService: (index: number, key: keyof ServiceDraft, value: string) => void;
  addService: () => void;
  removeService: (index: number) => void;
  isAdmin: boolean;
  working: boolean;
  editingId: string;
  startNew: () => void;
};

export function BusinessListingEditor({ editingBusiness, formOpen, toggleForm, submit, draft, updateDraft, updateService, addService, removeService, isAdmin, working, editingId, startNew }: BusinessListingEditorProps) {
  return (
    <section>
      <button type="button" onClick={toggleForm} className="flex w-full items-start justify-between gap-4 border-b border-[color:var(--loombus-border)] pb-5 text-left">
        <span><span className="block text-xs font-bold uppercase tracking-[0.2em] text-[color:var(--loombus-gold)]">{editingBusiness ? "Edit business" : "Business editor"}</span><span className="mt-1 block text-2xl font-semibold">{editingBusiness?.name || "Profile, location, and services"}</span><span className="mt-2 block text-sm leading-6 text-[color:var(--loombus-text-muted)]">Complete the attributable business record and submit material changes for review.</span></span>
        {formOpen ? <ChevronUp size={19} /> : <ChevronDown size={19} />}
      </button>

      {formOpen ? (
        <form onSubmit={submit} className="pt-6">
          <BusinessListingFields draft={draft} updateDraft={updateDraft} />
          <BusinessListingLocation draft={draft} updateDraft={updateDraft} />
          <BusinessListingServices services={draft.services} updateService={updateService} addService={addService} removeService={removeService} />

          {isAdmin ? <fieldset className="mt-7 border-y border-[color:var(--loombus-gold)] py-5"><legend className="flex items-center gap-2 pr-3 text-sm font-semibold"><ShieldCheck size={16} className="text-[color:var(--loombus-gold)]" /> Administrator publishing</legend><div className="mt-3 grid gap-3 text-sm sm:grid-cols-3"><label className="flex items-start gap-2"><input type="checkbox" checked={draft.unclaimed} onChange={(event) => updateDraft("unclaimed", event.target.checked)} className="mt-0.5" /><span>Create as an unclaimed listing</span></label><label className="flex items-start gap-2"><input type="checkbox" checked={draft.publishNow} onChange={(event) => updateDraft("publishNow", event.target.checked)} className="mt-0.5" /><span>Publish immediately</span></label><label className="flex items-start gap-2"><input type="checkbox" checked={draft.verified} onChange={(event) => updateDraft("verified", event.target.checked)} className="mt-0.5" /><span>Mark verified</span></label></div></fieldset> : null}

          <div className="mt-6 flex flex-wrap gap-5 border-t border-[color:var(--loombus-border)] pt-6">
            <button type="submit" disabled={working} className="inline-flex items-center gap-2 border-b-2 border-[color:var(--loombus-gold)] py-2 text-sm font-semibold disabled:opacity-50">{working ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}{editingId ? "Save and resubmit" : "Submit for review"}</button>
            {editingId ? <button type="button" onClick={startNew} className="inline-flex items-center gap-2 py-2 text-sm font-semibold text-[color:var(--loombus-text-muted)] hover:text-[color:var(--loombus-gold)]"><X size={16} /> Cancel edit</button> : null}
          </div>
        </form>
      ) : null}
    </section>
  );
}
