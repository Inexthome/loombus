"use client";

import {
  ChevronDown,
  ChevronUp,
  Loader2,
  Save,
  Search,
  ShieldCheck,
  X,
} from "lucide-react";
import type { FormEvent } from "react";
import {
  JOB_CATEGORIES,
  JOB_COMPENSATION_PERIODS,
  JOB_EMPLOYMENT_TYPES,
  JOB_EXPERIENCE_LEVELS,
  JOB_WORKPLACE_TYPES,
  type JobEmployerOption,
  type JobPosting,
} from "@/lib/jobs-directory";
import type { JobDraft, UpdateJobDraft } from "@/components/job-manager-model";

type Props = {
  editingJob: JobPosting | null;
  formOpen: boolean;
  toggleForm: () => void;
  submit: (event: FormEvent<HTMLFormElement>) => void | Promise<void>;
  draft: JobDraft;
  updateDraft: UpdateJobDraft;
  employers: JobEmployerOption[];
  employerSearch: string;
  onEmployerSearchChange: (value: string) => void;
  searchingEmployers: boolean;
  isAdmin: boolean;
  working: boolean;
  editingId: string;
  startNew: () => void;
};

const inputClass =
  "min-h-12 border-0 border-b border-[var(--loombus-border)] bg-transparent px-0 py-3 outline-none transition-colors placeholder:text-[var(--loombus-text-subtle)] focus:border-[var(--loombus-gold)] focus:ring-0";
const sectionClass = "border-b border-[var(--loombus-border)] py-7 first:pt-0";

export function JobListingEditor({
  editingJob,
  formOpen,
  toggleForm,
  submit,
  draft,
  updateDraft,
  employers,
  employerSearch,
  onEmployerSearchChange,
  searchingEmployers,
  isAdmin,
  working,
  editingId,
  startNew,
}: Props) {
  return (
    <section>
      <button
        type="button"
        onClick={toggleForm}
        className="flex min-h-14 w-full items-center justify-between gap-4 border-b border-[var(--loombus-border)] pb-5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--loombus-gold)]"
      >
        <span>
          <span className="block text-xs font-bold uppercase tracking-[0.18em] text-[var(--loombus-gold)]">
            {editingJob ? "Edit job" : "Post a job"}
          </span>
          <span className="mt-1 block text-xl font-semibold">
            {editingJob?.title || "Structured employer opportunity"}
          </span>
        </span>
        {formOpen ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
      </button>

      {formOpen ? (
        <form onSubmit={submit} className="pt-7">
          <section className={sectionClass}>
            <h2 className="text-lg font-semibold">Employer and role</h2>
            <p className="mt-1 max-w-3xl text-sm leading-6 text-[var(--loombus-text-muted)]">
              Every posting is connected to a Loombus business profile. Business ownership determines who may manage the job.
            </p>

            {isAdmin ? (
              <label className="mt-5 flex min-h-12 items-center gap-2 border-b border-[var(--loombus-border)]">
                <Search size={17} className="text-[var(--loombus-gold)]" />
                <input
                  value={employerSearch}
                  onChange={(event) => onEmployerSearchChange(event.target.value)}
                  placeholder="Search employer profiles"
                  className="min-w-0 flex-1 bg-transparent py-3 outline-none"
                />
                {searchingEmployers ? <Loader2 className="animate-spin" size={16} /> : null}
              </label>
            ) : null}

            <div className="mt-5 grid gap-x-6 gap-y-4 md:grid-cols-2">
              <select
                required
                value={draft.businessId}
                onChange={(event) => updateDraft("businessId", event.target.value)}
                className={inputClass}
                aria-label="Employer profile"
              >
                <option value="">Choose employer profile</option>
                {employers.map((employer) => (
                  <option key={employer.id} value={employer.id}>
                    {employer.name}{employer.status !== "published" ? ` · ${employer.status}` : ""}
                  </option>
                ))}
              </select>

              <input required value={draft.title} onChange={(event) => updateDraft("title", event.target.value)} placeholder="Job title" className={inputClass} />
              <input required value={draft.category} onChange={(event) => updateDraft("category", event.target.value)} list="job-category-options" placeholder="Job category" className={inputClass} />
              <datalist id="job-category-options">
                {JOB_CATEGORIES.map((category) => <option key={category} value={category} />)}
              </datalist>

              <select value={draft.employmentType} onChange={(event) => updateDraft("employmentType", event.target.value)} className={inputClass}>
                {JOB_EMPLOYMENT_TYPES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
              </select>
              <select value={draft.workplaceType} onChange={(event) => updateDraft("workplaceType", event.target.value)} className={inputClass}>
                {JOB_WORKPLACE_TYPES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
              </select>
              <select value={draft.experienceLevel} onChange={(event) => updateDraft("experienceLevel", event.target.value)} className={inputClass}>
                {JOB_EXPERIENCE_LEVELS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
              </select>

              <textarea required value={draft.summary} onChange={(event) => updateDraft("summary", event.target.value)} placeholder="Short opportunity summary" rows={3} className={`${inputClass} md:col-span-2`} />
              <textarea required value={draft.description} onChange={(event) => updateDraft("description", event.target.value)} placeholder="Describe the role, team, schedule, and working conditions" rows={6} className={`${inputClass} md:col-span-2`} />
              <textarea value={draft.responsibilities} onChange={(event) => updateDraft("responsibilities", event.target.value)} placeholder="Responsibilities" rows={5} className={inputClass} />
              <textarea value={draft.qualifications} onChange={(event) => updateDraft("qualifications", event.target.value)} placeholder="Qualifications" rows={5} className={inputClass} />
            </div>
          </section>

          <section className={sectionClass}>
            <h2 className="text-lg font-semibold">Location and compensation</h2>
            <div className="mt-4 grid gap-x-6 gap-y-4 md:grid-cols-2 lg:grid-cols-4">
              <input value={draft.city} onChange={(event) => updateDraft("city", event.target.value)} placeholder="City" className={inputClass} />
              <input value={draft.region} onChange={(event) => updateDraft("region", event.target.value)} placeholder="State or region" className={inputClass} />
              <input value={draft.postalCode} onChange={(event) => updateDraft("postalCode", event.target.value)} placeholder="Postal code" className={inputClass} />
              <input value={draft.countryCode} onChange={(event) => updateDraft("countryCode", event.target.value.toUpperCase())} placeholder="Country code" maxLength={2} className={inputClass} />
              <input type="number" min="0" step="0.01" value={draft.compensationMin} onChange={(event) => updateDraft("compensationMin", event.target.value)} placeholder="Minimum compensation" className={inputClass} />
              <input type="number" min="0" step="0.01" value={draft.compensationMax} onChange={(event) => updateDraft("compensationMax", event.target.value)} placeholder="Maximum compensation" className={inputClass} />
              <input value={draft.compensationCurrency} onChange={(event) => updateDraft("compensationCurrency", event.target.value.toUpperCase())} placeholder="USD" maxLength={3} className={inputClass} />
              <select value={draft.compensationPeriod} onChange={(event) => updateDraft("compensationPeriod", event.target.value)} className={inputClass}>
                {JOB_COMPENSATION_PERIODS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
              </select>
            </div>

            <label className="mt-5 flex min-h-11 items-start gap-3 text-sm">
              <input type="checkbox" checked={draft.showCompensation} onChange={(event) => updateDraft("showCompensation", event.target.checked)} className="mt-1" />
              <span>
                <span className="font-semibold">Show compensation publicly</span>
                <span className="mt-1 block text-[var(--loombus-text-muted)]">Compensation remains stored for this posting only when entered.</span>
              </span>
            </label>
          </section>

          <section className={sectionClass}>
            <h2 className="text-lg font-semibold">Application source and searchable details</h2>
            <p className="mt-1 max-w-3xl text-sm leading-6 text-[var(--loombus-text-muted)]">
              Provide at least one employer-controlled application method. Loombus will not accept résumé uploads for this phase.
            </p>
            <div className="mt-4 grid gap-x-6 gap-y-4 md:grid-cols-2">
              <input type="url" value={draft.applicationUrl} onChange={(event) => updateDraft("applicationUrl", event.target.value)} placeholder="https://employer.com/apply" className={inputClass} />
              <input type="email" value={draft.applicationEmail} onChange={(event) => updateDraft("applicationEmail", event.target.value)} placeholder="jobs@employer.com" className={inputClass} />
              <textarea value={draft.skills} onChange={(event) => updateDraft("skills", event.target.value)} placeholder="Skills, separated by commas" rows={3} className={inputClass} />
              <textarea value={draft.benefits} onChange={(event) => updateDraft("benefits", event.target.value)} placeholder="Benefits, separated by commas" rows={3} className={inputClass} />
              <label className="grid gap-1 text-sm"><span className="font-semibold">Application deadline</span><input type="date" value={draft.applicationDeadline} onChange={(event) => updateDraft("applicationDeadline", event.target.value)} className={inputClass} /></label>
              <label className="grid gap-1 text-sm"><span className="font-semibold">Optional posting expiration</span><input type="date" value={draft.expiresAt} onChange={(event) => updateDraft("expiresAt", event.target.value)} className={inputClass} /></label>
            </div>
          </section>

          {isAdmin ? (
            <section className="border-b border-[var(--loombus-border)] py-7">
              <h2 className="flex items-center gap-2 font-semibold"><ShieldCheck size={18} className="text-[var(--loombus-gold)]" /> Administrator publishing</h2>
              <label className="mt-4 flex min-h-11 items-center gap-2 text-sm">
                <input type="checkbox" checked={draft.publishNow} onChange={(event) => updateDraft("publishNow", event.target.checked)} />
                Publish immediately when the employer profile is public
              </label>
            </section>
          ) : null}

          <div className="flex flex-wrap gap-x-5 gap-y-2 pt-7">
            <button type="submit" disabled={working} className="inline-flex min-h-11 items-center gap-2 border-b-2 border-[var(--loombus-gold)] px-1 font-semibold text-[var(--loombus-gold)] disabled:opacity-50">
              {working ? <Loader2 className="animate-spin" size={17} /> : <Save size={17} />}
              {editingId ? "Save and resubmit" : "Submit for review"}
            </button>
            {editingId ? (
              <button type="button" onClick={startNew} className="inline-flex min-h-11 items-center gap-2 border-b border-[var(--loombus-border)] px-1 font-semibold transition-colors hover:border-[var(--loombus-gold)]">
                <X size={17} /> Cancel edit
              </button>
            ) : null}
          </div>
        </form>
      ) : null}
    </section>
  );
}
