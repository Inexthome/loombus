"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { DateOfBirthSelect } from "@/components/date-of-birth-select";
import { supabase } from "@/lib/supabase/client";

type AgeSafetyPayload = {
  ageBand: "unknown" | "under_13" | "teen" | "adult";
  teenSafetyMode: boolean;
  guardianRequired: boolean;
  defaults: {
    future_discussion_audience: string;
    allow_unsolicited_adult_contact: boolean;
    personalized_recommendations_enabled: boolean;
    commerce_discovery_enabled: boolean;
    defaults_applied_at: string | null;
    age_transitioned_at: string | null;
  } | null;
  correctionRequests: Array<{
    id: string;
    requested_age_band: string;
    reason: string;
    status: string;
    created_at: string;
    updated_at: string;
  }>;
};

const UNDERAGE_REASONS = [
  ["appears_under_13", "The account appears to belong to someone under 13"],
  ["self_disclosed_under_13", "The member said they are under 13"],
  ["guardian_report", "I am a parent or guardian reporting the account"],
  ["other", "Another underage-account concern"],
] as const;

function formatDate(value: string | null | undefined) {
  if (!value) return "Not recorded";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Not recorded" : date.toLocaleString();
}

export default function AgeSafetyClient() {
  const [data, setData] = useState<AgeSafetyPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [working, setWorking] = useState(false);
  const [requestedDateOfBirth, setRequestedDateOfBirth] = useState("");
  const [correctionReason, setCorrectionReason] = useState("");
  const [reportedUserId, setReportedUserId] = useState("");
  const [underageReason, setUnderageReason] = useState("appears_under_13");
  const [underageContext, setUnderageContext] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setMessage("");

    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;

    if (!token) {
      window.location.replace("/login?next=%2Faccount%2Fage-safety");
      return;
    }

    const response = await fetch("/api/profile/age-safety", {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
      setMessage(payload.error ?? "Unable to load age-safety settings.");
      setLoading(false);
      return;
    }

    setData(payload as AgeSafetyPayload);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function submitCorrection(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (working) return;

    setWorking(true);
    setMessage("");

    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;

    if (!token) {
      window.location.replace("/login?next=%2Faccount%2Fage-safety");
      return;
    }

    const response = await fetch("/api/profile/age-correction", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ requestedDateOfBirth, reason: correctionReason }),
    });
    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
      setMessage(payload.error ?? "Unable to submit the correction request.");
      setWorking(false);
      return;
    }

    setRequestedDateOfBirth("");
    setCorrectionReason("");
    setMessage("Age correction request submitted for protected review.");
    setWorking(false);
    await load();
  }

  async function submitUnderageReport(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (working) return;

    setWorking(true);
    setMessage("");

    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;

    if (!token) {
      window.location.replace("/login?next=%2Faccount%2Fage-safety");
      return;
    }

    const response = await fetch("/api/safety/underage-report", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        reportedUserId,
        reason: underageReason,
        context: underageContext,
      }),
    });
    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
      setMessage(payload.error ?? "Unable to submit the underage-account report.");
      setWorking(false);
      return;
    }

    setReportedUserId("");
    setUnderageContext("");
    setMessage("Underage-account report submitted privately for review.");
    setWorking(false);
  }

  const mutedClass = "text-[color:var(--loombus-text-muted)]";
  const fieldClass =
    "w-full border-0 border-b border-[color:var(--loombus-border)] bg-transparent px-0 py-3 text-[color:var(--loombus-text)] outline-none transition focus:border-[color:var(--loombus-gold)] focus:ring-0";

  return (
    <main
      data-loombus-age-safety
      className="min-h-screen bg-[color:var(--loombus-page-bg)] px-4 py-8 text-[color:var(--loombus-text)] sm:px-6 sm:py-12"
    >
      <div className="mx-auto max-w-6xl">
        <header className="border-b border-[color:var(--loombus-border)] pb-8 sm:pb-10">
          <Link
            href="/privacy-security"
            className="inline-flex min-h-11 items-center text-sm font-semibold text-[color:var(--loombus-text-muted)] underline-offset-4 hover:text-[color:var(--loombus-text)] hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[color:var(--loombus-gold)]"
          >
            ← Privacy & Security
          </Link>
          <div className="mt-6 max-w-4xl">
            <p className="text-xs font-black uppercase tracking-[0.24em] text-[color:var(--loombus-gold)]">
              Age safety
            </p>
            <h1 className="mt-3 text-4xl font-semibold tracking-[-0.035em] sm:text-5xl">
              Privacy first, especially for teens.
            </h1>
            <p className={`mt-5 max-w-3xl text-base leading-7 ${mutedClass}`}>
              Loombus is available to people age 13 and older. Teen accounts receive stricter privacy and interaction defaults without giving parents or other members secret access to private conversations.
            </p>
          </div>
        </header>

        {message ? (
          <div
            className="border-b border-[color:color-mix(in_srgb,var(--loombus-gold)_40%,var(--loombus-border))] py-4 text-sm font-medium"
            role="status"
          >
            <span className="mr-2 text-[color:var(--loombus-gold)]">Update</span>
            {message}
          </div>
        ) : null}

        {loading ? (
          <section className="border-b border-[color:var(--loombus-border)] py-10 text-sm text-[color:var(--loombus-text-muted)]" aria-live="polite">
            Loading age-safety protections...
          </section>
        ) : (
          <div className="grid gap-0 lg:grid-cols-[minmax(0,1.6fr)_minmax(18rem,0.8fr)] lg:gap-12">
            <div className="min-w-0">
              <section className="grid border-b border-[color:var(--loombus-border)] md:grid-cols-2" aria-label="Current age-safety state">
                <article className="py-7 md:pr-8">
                  <p className="text-xs font-black uppercase tracking-[0.2em] text-[color:var(--loombus-gold)]">
                    Current age state
                  </p>
                  <h2 className="mt-3 text-2xl font-semibold capitalize tracking-tight">
                    {data?.ageBand.replace("_", " ") ?? "Unknown"}
                  </h2>
                  <p className={`mt-3 text-sm leading-6 ${mutedClass}`}>
                    Teen Safety Mode: {data?.teenSafetyMode ? "On" : "Off"}. Guardian-required state: {data?.guardianRequired ? "Yes" : "No"}.
                  </p>
                </article>

                <article className="border-t border-[color:var(--loombus-border)] py-7 md:border-l md:border-t-0 md:pl-8">
                  <p className="text-xs font-black uppercase tracking-[0.2em] text-[color:var(--loombus-gold)]">
                    Teen defaults
                  </p>
                  <h2 className="mt-3 text-2xl font-semibold tracking-tight">Protected by default</h2>
                  <dl className={`mt-4 divide-y divide-[color:var(--loombus-border-muted)] text-sm ${mutedClass}`}>
                    <div className="flex items-start justify-between gap-5 py-2.5 first:pt-0">
                      <dt>Future Discussion audience</dt>
                      <dd className="text-right font-semibold text-[color:var(--loombus-text)]">{data?.defaults?.future_discussion_audience ?? "Not recorded"}</dd>
                    </div>
                    <div className="flex items-start justify-between gap-5 py-2.5">
                      <dt>Unsolicited adult contact</dt>
                      <dd className="text-right font-semibold text-[color:var(--loombus-text)]">{data?.defaults?.allow_unsolicited_adult_contact ? "Allowed" : "Blocked"}</dd>
                    </div>
                    <div className="flex items-start justify-between gap-5 py-2.5">
                      <dt>Personalized recommendations</dt>
                      <dd className="text-right font-semibold text-[color:var(--loombus-text)]">{data?.defaults?.personalized_recommendations_enabled ? "Enabled" : "Limited"}</dd>
                    </div>
                    <div className="flex items-start justify-between gap-5 py-2.5 last:pb-0">
                      <dt>Commerce discovery</dt>
                      <dd className="text-right font-semibold text-[color:var(--loombus-text)]">{data?.defaults?.commerce_discovery_enabled ? "Enabled" : "Limited"}</dd>
                    </div>
                  </dl>
                </article>
              </section>

              <section className="border-b border-[color:var(--loombus-border)] py-8 sm:py-10">
                <div className="max-w-3xl">
                  <p className="text-xs font-black uppercase tracking-[0.2em] text-[color:var(--loombus-gold)]">Protected correction</p>
                  <h2 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">Request an age correction</h2>
                  <p className={`mt-3 text-sm leading-6 ${mutedClass}`}>
                    A stored date of birth cannot be silently replaced. Submit the accurate date and explain the correction. This phase does not collect an identity document or biometric estimate.
                  </p>
                </div>

                <form onSubmit={submitCorrection} className="mt-7 grid max-w-3xl gap-5">
                  <DateOfBirthSelect
                    value={requestedDateOfBirth}
                    onChange={setRequestedDateOfBirth}
                    idPrefix="age-correction-date-of-birth"
                    disabled={working}
                  />
                  <label className="grid gap-2 text-sm font-semibold">
                    Why does the date need correction?
                    <textarea
                      value={correctionReason}
                      onChange={(event) => setCorrectionReason(event.target.value)}
                      minLength={10}
                      maxLength={1000}
                      required
                      placeholder="Explain why the date on file needs to be corrected."
                      className={`${fieldClass} min-h-32 resize-y`}
                    />
                  </label>
                  <button
                    disabled={working}
                    className="min-h-11 w-fit border border-[color:var(--loombus-gold)] bg-[color:var(--loombus-gold)] px-5 py-3 text-sm font-black text-[color:var(--loombus-gold-contrast)] transition hover:brightness-105 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[color:var(--loombus-gold)] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {working ? "Submitting..." : "Submit correction request"}
                  </button>
                </form>

                {data?.correctionRequests?.length ? (
                  <div className="mt-10 max-w-3xl border-t border-[color:var(--loombus-border)] pt-6">
                    <h3 className="text-sm font-black uppercase tracking-[0.16em] text-[color:var(--loombus-text-muted)]">Recent correction requests</h3>
                    <div className="mt-3 divide-y divide-[color:var(--loombus-border-muted)]">
                      {data.correctionRequests.map((request) => (
                        <article key={request.id} className="py-4 text-sm first:pt-0">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <strong className="capitalize text-[color:var(--loombus-text)]">{request.status.replace("_", " ")}</strong>
                            <span className={mutedClass}>{formatDate(request.created_at)}</span>
                          </div>
                          <p className={`mt-2 ${mutedClass}`}>
                            Requested age band: {request.requested_age_band}
                          </p>
                        </article>
                      ))}
                    </div>
                  </div>
                ) : null}
              </section>

              <section className="py-8 sm:py-10">
                <div className="max-w-3xl">
                  <p className="text-xs font-black uppercase tracking-[0.2em] text-[color:var(--loombus-gold)]">Private safety report</p>
                  <h2 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">
                    Report an account that may belong to a child under 13
                  </h2>
                  <p className={`mt-3 text-sm leading-6 ${mutedClass}`}>
                    Submit only what is necessary. Do not publicly investigate, post private information, or ask the child for proof.
                  </p>
                </div>

                <form onSubmit={submitUnderageReport} className="mt-7 grid max-w-3xl gap-5">
                  <label className="grid gap-2 text-sm font-semibold">
                    Reported member ID
                    <input
                      value={reportedUserId}
                      onChange={(event) => setReportedUserId(event.target.value)}
                      required
                      placeholder="Reported member ID"
                      className={fieldClass}
                    />
                  </label>
                  <label className="grid gap-2 text-sm font-semibold">
                    Reason
                    <select
                      value={underageReason}
                      onChange={(event) => setUnderageReason(event.target.value)}
                      className={fieldClass}
                    >
                      {UNDERAGE_REASONS.map(([value, label]) => (
                        <option key={value} value={value}>{label}</option>
                      ))}
                    </select>
                  </label>
                  <label className="grid gap-2 text-sm font-semibold">
                    Optional context
                    <textarea
                      value={underageContext}
                      onChange={(event) => setUnderageContext(event.target.value)}
                      maxLength={2000}
                      placeholder="Optional context. Do not include passwords, government IDs, or unnecessary private information."
                      className={`${fieldClass} min-h-32 resize-y`}
                    />
                  </label>
                  <button
                    disabled={working}
                    className="min-h-11 w-fit border border-[color:var(--loombus-gold)] bg-transparent px-5 py-3 text-sm font-black text-[color:var(--loombus-gold)] transition hover:bg-[color:var(--loombus-gold-surface)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[color:var(--loombus-gold)] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {working ? "Submitting..." : "Submit private report"}
                  </button>
                </form>
              </section>
            </div>

            <aside className="border-t border-[color:var(--loombus-border)] py-8 lg:border-l lg:border-t-0 lg:py-10 lg:pl-10" aria-label="Age safety guidance">
              <div className="lg:sticky lg:top-24">
                <p className="text-xs font-black uppercase tracking-[0.2em] text-[color:var(--loombus-gold)]">What these controls protect</p>
                <h2 className="mt-2 text-xl font-semibold tracking-tight">Safety without silent access.</h2>
                <p className={`mt-3 text-sm leading-6 ${mutedClass}`}>
                  Age protections change defaults and review paths. They do not give another member hidden access to private conversations.
                </p>
                <div className="mt-6 divide-y divide-[color:var(--loombus-border-muted)] border-y border-[color:var(--loombus-border)] text-sm">
                  <p className="py-4 leading-6"><strong className="block text-[color:var(--loombus-text)]">Correction requests</strong><span className={mutedClass}>Reviewed through the protected account process rather than silently overwriting the stored age state.</span></p>
                  <p className="py-4 leading-6"><strong className="block text-[color:var(--loombus-text)]">Underage reports</strong><span className={mutedClass}>Submitted privately for review and should contain only information necessary to explain the concern.</span></p>
                  <p className="py-4 leading-6"><strong className="block text-[color:var(--loombus-text)]">Teen defaults</strong><span className={mutedClass}>Shown from the account’s current server-provided age-safety state; this page does not alter them directly.</span></p>
                </div>
              </div>
            </aside>
          </div>
        )}
      </div>
    </main>
  );
}
