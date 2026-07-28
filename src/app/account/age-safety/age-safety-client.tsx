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

  const surfaceClass =
    "rounded-3xl border border-[color:var(--loombus-border)] bg-[color:var(--loombus-surface)]";
  const mutedClass = "text-[color:var(--loombus-text-muted)]";

  return (
    <main
      data-loombus-age-safety
      className="min-h-screen bg-[color:var(--loombus-page-bg)] px-4 py-8 text-[color:var(--loombus-text)] sm:px-6 sm:py-12"
    >
      <div className="mx-auto max-w-5xl space-y-6">
        <header className={`${surfaceClass} p-6 shadow-sm sm:p-8`}>
          <Link href="/privacy-security" className={`text-sm ${mutedClass} hover:underline`}>
            ← Privacy & Security
          </Link>
          <p className={`mt-6 text-xs font-semibold uppercase tracking-[0.24em] ${mutedClass}`}>
            Age safety
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
            Privacy first, especially for teens.
          </h1>
          <p className={`mt-4 max-w-3xl leading-7 ${mutedClass}`}>
            Loombus is available to people age 13 and older. Teen accounts receive stricter privacy and interaction defaults without giving parents or other members secret access to private conversations.
          </p>
        </header>

        {message ? (
          <div className="rounded-2xl border border-[#CBAB5B]/40 bg-[#CBAB5B]/10 px-4 py-3 text-sm" role="status">
            {message}
          </div>
        ) : null}

        {loading ? (
          <section className={`${surfaceClass} p-6`}>
            Loading age-safety protections...
          </section>
        ) : (
          <>
            <section className="grid gap-4 md:grid-cols-2">
              <article className={`${surfaceClass} p-6`}>
                <p className={`text-xs font-semibold uppercase tracking-[0.2em] ${mutedClass}`}>
                  Current age state
                </p>
                <h2 className="mt-3 text-2xl font-semibold capitalize">
                  {data?.ageBand.replace("_", " ") ?? "Unknown"}
                </h2>
                <p className={`mt-3 text-sm leading-6 ${mutedClass}`}>
                  Teen Safety Mode: {data?.teenSafetyMode ? "On" : "Off"}. Guardian-required state: {data?.guardianRequired ? "Yes" : "No"}.
                </p>
              </article>

              <article className={`${surfaceClass} p-6`}>
                <p className={`text-xs font-semibold uppercase tracking-[0.2em] ${mutedClass}`}>
                  Teen defaults
                </p>
                <h2 className="mt-3 text-2xl font-semibold">Protected by default</h2>
                <ul className={`mt-3 space-y-2 text-sm leading-6 ${mutedClass}`}>
                  <li>Future Discussion audience: {data?.defaults?.future_discussion_audience ?? "Not recorded"}</li>
                  <li>Unsolicited adult contact: {data?.defaults?.allow_unsolicited_adult_contact ? "Allowed" : "Blocked"}</li>
                  <li>Personalized recommendations: {data?.defaults?.personalized_recommendations_enabled ? "Enabled" : "Limited"}</li>
                  <li>Commerce discovery: {data?.defaults?.commerce_discovery_enabled ? "Enabled" : "Limited"}</li>
                </ul>
              </article>
            </section>

            <section className={`${surfaceClass} p-6 sm:p-8`}>
              <h2 className="text-2xl font-semibold">Request an age correction</h2>
              <p className={`mt-2 text-sm leading-6 ${mutedClass}`}>
                A stored date of birth cannot be silently replaced. Submit the accurate date and explain the correction. This phase does not collect an identity document or biometric estimate.
              </p>
              <form onSubmit={submitCorrection} className="mt-6 grid gap-4">
                <DateOfBirthSelect
                  value={requestedDateOfBirth}
                  onChange={setRequestedDateOfBirth}
                  idPrefix="age-correction-date-of-birth"
                  disabled={working}
                />
                <textarea
                  value={correctionReason}
                  onChange={(event) => setCorrectionReason(event.target.value)}
                  minLength={10}
                  maxLength={1000}
                  required
                  placeholder="Explain why the date on file needs to be corrected."
                  className="min-h-32 rounded-2xl border border-[color:var(--loombus-border)] bg-[color:var(--loombus-surface)] p-4"
                />
                <button
                  disabled={working}
                  className="w-fit rounded-full bg-[#CBAB5B] px-5 py-3 font-semibold text-black transition hover:brightness-105 disabled:opacity-50"
                >
                  {working ? "Submitting..." : "Submit correction request"}
                </button>
              </form>

              {data?.correctionRequests?.length ? (
                <div className="mt-8 space-y-3">
                  <h3 className="font-semibold">Recent correction requests</h3>
                  {data.correctionRequests.map((request) => (
                    <article
                      key={request.id}
                      className="rounded-2xl border border-[color:var(--loombus-border)] bg-[color:var(--loombus-surface-strong)] p-4 text-sm"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <strong className="capitalize">{request.status.replace("_", " ")}</strong>
                        <span className={mutedClass}>{formatDate(request.created_at)}</span>
                      </div>
                      <p className={`mt-2 ${mutedClass}`}>
                        Requested age band: {request.requested_age_band}
                      </p>
                    </article>
                  ))}
                </div>
              ) : null}
            </section>

            <section className={`${surfaceClass} p-6 sm:p-8`}>
              <h2 className="text-2xl font-semibold">
                Report an account that may belong to a child under 13
              </h2>
              <p className={`mt-2 text-sm leading-6 ${mutedClass}`}>
                Submit only what is necessary. Do not publicly investigate, post private information, or ask the child for proof.
              </p>
              <form onSubmit={submitUnderageReport} className="mt-6 grid gap-4">
                <input
                  value={reportedUserId}
                  onChange={(event) => setReportedUserId(event.target.value)}
                  required
                  placeholder="Reported member ID"
                  className="rounded-2xl border border-[color:var(--loombus-border)] bg-[color:var(--loombus-surface)] px-4 py-3"
                />
                <select
                  value={underageReason}
                  onChange={(event) => setUnderageReason(event.target.value)}
                  className="rounded-2xl border border-[color:var(--loombus-border)] bg-[color:var(--loombus-surface)] px-4 py-3"
                >
                  {UNDERAGE_REASONS.map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
                <textarea
                  value={underageContext}
                  onChange={(event) => setUnderageContext(event.target.value)}
                  maxLength={2000}
                  placeholder="Optional context. Do not include passwords, government IDs, or unnecessary private information."
                  className="min-h-32 rounded-2xl border border-[color:var(--loombus-border)] bg-[color:var(--loombus-surface)] p-4"
                />
                <button
                  disabled={working}
                  className="w-fit rounded-full border border-[#CBAB5B] px-5 py-3 font-semibold text-[color:var(--loombus-trust-accent-text)] transition hover:bg-[#CBAB5B]/10 disabled:opacity-50"
                >
                  {working ? "Submitting..." : "Submit private report"}
                </button>
              </form>
            </section>
          </>
        )}
      </div>
    </main>
  );
}
