"use client";

import Link from "next/link";
import {
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  Clock3,
  LockKeyhole,
  ShieldCheck,
} from "lucide-react";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase/client";

type AgeSafety = {
  date_of_birth: string | null;
  age_band: string;
  age_state: string;
  teen_safety_mode: boolean;
  guardian_required: boolean;
  turns_18_at: string | null;
  age_declared_at: string | null;
  age_last_confirmed_at: string | null;
  age_transitioned_at: string | null;
};

type Correction = {
  id: string;
  current_date_of_birth: string | null;
  requested_date_of_birth: string;
  member_reason: string | null;
  status: string;
  decision_note: string | null;
  created_at: string;
  updated_at: string;
  reviewed_at: string | null;
};

type Payload = {
  ageSafety: AgeSafety | null;
  correctionRequests: Correction[];
  error?: string;
};

async function accessToken() {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? "";
}

function formatDate(value: string | null | undefined) {
  if (!value) return "Not recorded";
  const date = new Date(value.length === 10 ? `${value}T00:00:00` : value);
  if (!Number.isFinite(date.getTime())) return "Not recorded";
  return date.toLocaleDateString(undefined, {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function label(value: string) {
  return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export default function AgeSafetyClient() {
  const [payload, setPayload] = useState<Payload | null>(null);
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const token = await accessToken();
    if (!token) {
      window.location.href = "/login?next=%2Faccount%2Fage-safety";
      return;
    }
    const response = await fetch("/api/account/age-safety", {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    const next = (await response.json().catch(() => ({}))) as Payload;
    setPayload(next);
    if (!response.ok) setMessage(next.error ?? "Unable to load Age Safety.");
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const openCorrection = useMemo(
    () =>
      payload?.correctionRequests.find((request) =>
        ["pending", "reviewing"].includes(request.status),
      ) ?? null,
    [payload],
  );

  async function submitCorrection(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setMessage("");
    const token = await accessToken();
    if (!token) return;
    const response = await fetch("/api/account/age-safety", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        action: "request_correction",
        dateOfBirth,
        reason,
      }),
    });
    const result = await response.json().catch(() => ({}));
    setMessage(
      response.ok
        ? "Age correction submitted for review. Your current protections remain active."
        : result.error ?? "Unable to submit this correction.",
    );
    if (response.ok) {
      setDateOfBirth("");
      setReason("");
      await load();
    }
    setSubmitting(false);
  }

  async function cancelCorrection(requestId: string) {
    if (submitting) return;
    setSubmitting(true);
    const token = await accessToken();
    if (!token) return;
    const response = await fetch("/api/account/age-safety", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ action: "cancel_correction", requestId }),
    });
    const result = await response.json().catch(() => ({}));
    setMessage(
      response.ok
        ? "Age correction request cancelled."
        : result.error ?? "Unable to cancel this request.",
    );
    if (response.ok) await load();
    setSubmitting(false);
  }

  const age = payload?.ageSafety;

  return (
    <main className="age-safety-page">
      <section className="age-safety-shell">
        <Link href="/settings#privacy" className="age-safety-back">
          <ArrowLeft aria-hidden="true" size={16} /> Back to Settings
        </Link>

        <header className="age-safety-hero">
          <div>
            <p>Account protection</p>
            <h1>Age Safety</h1>
            <span>
              Age state controls privacy defaults and high-risk interactions. Your exact date of birth is not shown on your public profile.
            </span>
          </div>
          <ShieldCheck aria-hidden="true" />
        </header>

        {loading ? <div className="age-safety-state">Loading Age Safety...</div> : null}

        {!loading && age ? (
          <>
            <section className="age-safety-metrics">
              <article>
                <span>Age state</span>
                <strong>{label(age.age_band)}</strong>
              </article>
              <article>
                <span>Date of birth</span>
                <strong>{formatDate(age.date_of_birth)}</strong>
              </article>
              <article>
                <span>Protection state</span>
                <strong>{label(age.age_state)}</strong>
              </article>
            </section>

            {age.teen_safety_mode ? (
              <section className="age-safety-card is-protected">
                <div className="age-safety-card-heading">
                  <LockKeyhole aria-hidden="true" />
                  <div>
                    <h2>Teen Safety is active</h2>
                    <p>
                      The account stays private, new followers require approval, public future Discussion audiences are blocked, adult strangers cannot discover the profile, and an adult cannot start a private conversation with the teen.
                    </p>
                  </div>
                </div>
                <ul>
                  <li>Commercial creation and Room staff roles are limited to adult accounts.</li>
                  <li>Rooms must explicitly allow minors and approve teen admission.</li>
                  <li>Turning 18 does not automatically make the account public.</li>
                </ul>
                <div className="age-safety-transition">
                  <CalendarDays aria-hidden="true" />
                  <span>Scheduled adult transition: {formatDate(age.turns_18_at)}</span>
                </div>
              </section>
            ) : null}

            {age.age_band === "adult" ? (
              <section className="age-safety-card">
                <div className="age-safety-card-heading">
                  <CheckCircle2 aria-hidden="true" />
                  <div>
                    <h2>Adult account</h2>
                    <p>
                      Teen-only interaction rules no longer apply. Privacy and future Discussion visibility remain exactly where the member left them.
                    </p>
                  </div>
                </div>
              </section>
            ) : null}

            <section className="age-safety-card">
              <div className="age-safety-card-heading">
                <Clock3 aria-hidden="true" />
                <div>
                  <h2>Correct a date of birth</h2>
                  <p>
                    A recorded date cannot be replaced directly. Submit a correction for Admin review so safety protections cannot be bypassed by editing age.
                  </p>
                </div>
              </div>

              {openCorrection ? (
                <div className="age-safety-open-request">
                  <div>
                    <strong>{label(openCorrection.status)}</strong>
                    <span>
                      Requested {formatDate(openCorrection.requested_date_of_birth)} on {formatDate(openCorrection.created_at)}
                    </span>
                  </div>
                  {openCorrection.status === "pending" ? (
                    <button
                      type="button"
                      disabled={submitting}
                      onClick={() => void cancelCorrection(openCorrection.id)}
                    >
                      Cancel request
                    </button>
                  ) : null}
                </div>
              ) : (
                <form className="age-safety-form" onSubmit={submitCorrection}>
                  <label>
                    <span>Correct date of birth</span>
                    <input
                      type="date"
                      required
                      value={dateOfBirth}
                      onChange={(event) => setDateOfBirth(event.target.value)}
                    />
                  </label>
                  <label>
                    <span>Why is the current date incorrect?</span>
                    <textarea
                      required
                      minLength={10}
                      maxLength={2000}
                      rows={5}
                      value={reason}
                      onChange={(event) => setReason(event.target.value)}
                      placeholder="Explain the correction without uploading identity documents here."
                    />
                  </label>
                  <button type="submit" disabled={submitting}>
                    {submitting ? "Submitting..." : "Submit correction"}
                  </button>
                </form>
              )}
            </section>

            {payload?.correctionRequests.length ? (
              <section className="age-safety-card">
                <h2>Correction history</h2>
                <div className="age-safety-history">
                  {payload.correctionRequests.map((request) => (
                    <article key={request.id}>
                      <div>
                        <strong>{label(request.status)}</strong>
                        <span>{formatDate(request.created_at)}</span>
                      </div>
                      <p>Requested date: {formatDate(request.requested_date_of_birth)}</p>
                      {request.decision_note ? <small>{request.decision_note}</small> : null}
                    </article>
                  ))}
                </div>
              </section>
            ) : null}
          </>
        ) : null}

        {message ? <div className="age-safety-message" role="status">{message}</div> : null}

        <p className="age-safety-resource">
          Parents, guardians, educators, and members can review the <Link href="/safety/teens">Teen Safety guide</Link>.
        </p>
      </section>
    </main>
  );
}
