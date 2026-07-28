"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase/client";

type Profile = {
  id: string;
  username: string | null;
  full_name: string | null;
  account_status: string | null;
};

type Correction = {
  id: string;
  user_id: string;
  current_age_band: string;
  requested_date_of_birth: string;
  requested_age_band: string;
  reason: string;
  status: string;
  resolution_note: string | null;
  created_at: string;
};

type UnderageReport = {
  id: string;
  reporter_id: string;
  reported_user_id: string;
  reason: string;
  context: string | null;
  status: string;
  resolution_note: string | null;
  created_at: string;
};

type Payload = {
  corrections: Correction[];
  underageReports: UnderageReport[];
  profiles: Profile[];
};

function name(profile: Profile | undefined, fallback: string) {
  return profile?.full_name?.trim() || profile?.username?.trim() || fallback;
}

export default function AdminAgeSafetyClient() {
  const [payload, setPayload] = useState<Payload>({
    corrections: [],
    underageReports: [],
    profiles: [],
  });
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [working, setWorking] = useState("");
  const [notes, setNotes] = useState<Record<string, string>>({});

  const profiles = useMemo(
    () => Object.fromEntries(payload.profiles.map((profile) => [profile.id, profile])),
    [payload.profiles]
  );

  const load = useCallback(async () => {
    setLoading(true);
    setMessage("");
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;
    if (!token) {
      window.location.replace("/login?next=%2Fadmin%2Fage-safety");
      return;
    }

    const response = await fetch("/api/admin/age-safety", {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    const result = await response.json().catch(() => ({}));

    if (!response.ok) {
      setMessage(result.error ?? "Unable to load age-safety operations.");
      setLoading(false);
      return;
    }

    setPayload(result as Payload);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function act(
    workflow: "correction" | "underage_report",
    id: string,
    action: string
  ) {
    if (working) return;
    setWorking(`${workflow}:${id}:${action}`);
    setMessage("");

    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;
    if (!token) {
      window.location.replace("/login?next=%2Fadmin%2Fage-safety");
      return;
    }

    const response = await fetch("/api/admin/age-safety", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        workflow,
        id,
        action,
        resolutionNote: notes[id] ?? "",
      }),
    });
    const result = await response.json().catch(() => ({}));
    setWorking("");

    if (!response.ok) {
      setMessage(result.error ?? "Unable to update the age-safety review.");
      return;
    }

    setMessage("Age-safety review updated.");
    await load();
  }

  const surfaceClass =
    "rounded-3xl border border-[color:var(--loombus-border)] bg-[color:var(--loombus-surface)]";
  const mutedClass = "text-[color:var(--loombus-text-muted)]";
  const secondaryButtonClass =
    "rounded-full border border-[color:var(--loombus-border)] bg-[color:var(--loombus-surface)] px-4 py-2 text-sm text-[color:var(--loombus-text)] transition hover:bg-[color:var(--loombus-surface-strong)] disabled:opacity-50";
  const primaryButtonClass =
    "rounded-full bg-[#CBAB5B] px-4 py-2 text-sm font-semibold text-black transition hover:brightness-105 disabled:opacity-50";

  return (
    <main
      data-loombus-admin-age-safety
      className="min-h-screen bg-[color:var(--loombus-page-bg)] px-4 py-8 text-[color:var(--loombus-text)] sm:px-6"
    >
      <div className="mx-auto max-w-6xl space-y-6">
        <header className={`${surfaceClass} p-6 sm:p-8`}>
          <Link href="/admin" className={`text-sm ${mutedClass} hover:underline`}>
            ← Admin Operations
          </Link>
          <p className={`mt-6 text-xs font-semibold uppercase tracking-[0.22em] ${mutedClass}`}>
            Age safety operations
          </p>
          <h1 className="mt-2 text-3xl font-semibold">
            Review age corrections and underage-account reports.
          </h1>
          <p className={`mt-3 max-w-3xl text-sm leading-6 ${mutedClass}`}>
            Age corrections recalculate Teen Safety Mode and privacy defaults. Underage reports do not automatically change an account and require a separate account-enforcement decision where action is justified.
          </p>
        </header>

        {message ? (
          <div
            className="rounded-2xl border border-[#CBAB5B]/40 bg-[#CBAB5B]/10 p-4 text-sm"
            role="status"
          >
            {message}
          </div>
        ) : null}

        {loading ? (
          <div className={`${surfaceClass} p-6`}>Loading age-safety reviews...</div>
        ) : (
          <>
            <section className="space-y-4">
              <div>
                <h2 className="text-2xl font-semibold">Age correction requests</h2>
                <p className={`text-sm ${mutedClass}`}>
                  {payload.corrections.length} request(s)
                </p>
              </div>

              {payload.corrections.map((item) => (
                <article key={item.id} className={`${surfaceClass} p-5`}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <strong>{name(profiles[item.user_id], item.user_id)}</strong>
                      <p className={`mt-1 text-sm ${mutedClass}`}>
                        {item.current_age_band} → {item.requested_age_band} · {item.requested_date_of_birth}
                      </p>
                    </div>
                    <span className="rounded-full border border-[color:var(--loombus-border)] bg-[color:var(--loombus-surface-strong)] px-3 py-1 text-xs uppercase">
                      {item.status}
                    </span>
                  </div>
                  <p className="mt-4 text-sm leading-6">{item.reason}</p>
                  <textarea
                    value={notes[item.id] ?? ""}
                    onChange={(event) =>
                      setNotes((current) => ({
                        ...current,
                        [item.id]: event.target.value,
                      }))
                    }
                    maxLength={2000}
                    placeholder="Internal resolution note"
                    className="mt-4 min-h-24 w-full rounded-2xl border border-[color:var(--loombus-border)] bg-[color:var(--loombus-surface)] p-3"
                  />
                  <div className="mt-4 flex flex-wrap gap-2">
                    <button
                      onClick={() => void act("correction", item.id, "review")}
                      disabled={Boolean(working)}
                      className={secondaryButtonClass}
                    >
                      Start review
                    </button>
                    <button
                      onClick={() => void act("correction", item.id, "approve")}
                      disabled={Boolean(working)}
                      className={primaryButtonClass}
                    >
                      Approve
                    </button>
                    <button
                      onClick={() => void act("correction", item.id, "deny")}
                      disabled={Boolean(working)}
                      className={secondaryButtonClass}
                    >
                      Deny
                    </button>
                  </div>
                </article>
              ))}

              {payload.corrections.length === 0 ? (
                <p className={`${surfaceClass} p-6 text-sm ${mutedClass}`}>
                  No age correction requests.
                </p>
              ) : null}
            </section>

            <section className="space-y-4">
              <div>
                <h2 className="text-2xl font-semibold">Underage-account reports</h2>
                <p className={`text-sm ${mutedClass}`}>
                  {payload.underageReports.length} report(s)
                </p>
              </div>

              {payload.underageReports.map((item) => (
                <article key={item.id} className={`${surfaceClass} p-5`}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <strong>
                        Reported: {name(profiles[item.reported_user_id], item.reported_user_id)}
                      </strong>
                      <p className={`mt-1 text-sm ${mutedClass}`}>
                        Reporter: {name(profiles[item.reporter_id], item.reporter_id)} · {item.reason.replaceAll("_", " ")}
                      </p>
                    </div>
                    <span className="rounded-full border border-[color:var(--loombus-border)] bg-[color:var(--loombus-surface-strong)] px-3 py-1 text-xs uppercase">
                      {item.status}
                    </span>
                  </div>
                  {item.context ? (
                    <p className="mt-4 text-sm leading-6">{item.context}</p>
                  ) : null}
                  <textarea
                    value={notes[item.id] ?? ""}
                    onChange={(event) =>
                      setNotes((current) => ({
                        ...current,
                        [item.id]: event.target.value,
                      }))
                    }
                    maxLength={2000}
                    placeholder="Internal resolution note"
                    className="mt-4 min-h-24 w-full rounded-2xl border border-[color:var(--loombus-border)] bg-[color:var(--loombus-surface)] p-3"
                  />
                  <div className="mt-4 flex flex-wrap gap-2">
                    <button
                      onClick={() => void act("underage_report", item.id, "review")}
                      disabled={Boolean(working)}
                      className={secondaryButtonClass}
                    >
                      Start review
                    </button>
                    <button
                      onClick={() => void act("underage_report", item.id, "actioned")}
                      disabled={Boolean(working)}
                      className={primaryButtonClass}
                    >
                      Mark actioned
                    </button>
                    <button
                      onClick={() => void act("underage_report", item.id, "dismiss")}
                      disabled={Boolean(working)}
                      className={secondaryButtonClass}
                    >
                      Dismiss
                    </button>
                  </div>
                </article>
              ))}

              {payload.underageReports.length === 0 ? (
                <p className={`${surfaceClass} p-6 text-sm ${mutedClass}`}>
                  No underage-account reports.
                </p>
              ) : null}
            </section>
          </>
        )}
      </div>
    </main>
  );
}
