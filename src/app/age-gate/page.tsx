"use client";

import Link from "next/link";
import { type FormEvent, useEffect, useState } from "react";
import { DateOfBirthSelect } from "@/components/date-of-birth-select";
import { getAgeBandFromDateOfBirth } from "@/lib/age-safety";
import { signOutCurrentDevice } from "@/lib/auth-sign-out";
import { supabase } from "@/lib/supabase/client";

function getSafeNext(value: string | null) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return "/discussions";
  }

  return value;
}

export default function AgeGatePage() {
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [next, setNext] = useState("/home");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setNext(getSafeNext(params.get("next")));

    async function checkSession() {
      const { data } = await supabase.auth.getSession();

      if (!data.session) {
        window.location.replace("/login");
      }
    }

    void checkSession();
  }, []);

  async function submitAgeGate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (saving) {
      return;
    }

    setMessage("");

    const ageBand = getAgeBandFromDateOfBirth(dateOfBirth);

    if (!ageBand) {
      setMessage("Enter a valid date of birth.");
      return;
    }

    if (ageBand === "under_13") {
      setMessage("This account is not eligible to use Loombus.");
      await signOutCurrentDevice();
      return;
    }

    setSaving(true);

    const { data } = await supabase.auth.getSession();
    const accessToken = data.session?.access_token ?? "";

    if (!accessToken) {
      window.location.replace("/login");
      return;
    }

    try {
      const response = await fetch("/api/profile/age-gate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          dateOfBirth,
        }),
      });

      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        setMessage(payload.error ?? "Unable to save date-of-birth verification.");

        if (
          payload.code === "account_not_eligible" ||
          payload.code === "under_13_not_allowed"
        ) {
          await signOutCurrentDevice();
        }

        setSaving(false);
        return;
      }

      window.location.replace(next);
    } catch {
      setMessage("Unable to save date-of-birth verification.");
      setSaving(false);
    }
  }

  return (
    <main
      data-loombus-auth-shell
      data-loombus-age-gate
      className="min-h-screen bg-[color:var(--loombus-page-bg)] px-4 py-8 text-[color:var(--loombus-text)] sm:px-6 sm:py-12"
    >
      <div className="mx-auto max-w-5xl">
        <header className="border-b border-[color:var(--loombus-border)] pb-8 sm:pb-10">
          <Link
            href="/"
            className="inline-flex min-h-11 items-center text-sm font-semibold text-[color:var(--loombus-text-muted)] underline-offset-4 hover:text-[color:var(--loombus-text)] hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[color:var(--loombus-gold)]"
          >
            ← Back to Loombus
          </Link>

          <div className="mt-6 max-w-3xl">
            <p className="text-xs font-black uppercase tracking-[0.24em] text-[color:var(--loombus-gold)]">
              Account verification
            </p>
            <h1 className="mt-3 text-4xl font-semibold tracking-[-0.035em] sm:text-5xl">
              Confirm your date of birth.
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-7 text-[color:var(--loombus-text-muted)]">
              Loombus uses your date of birth to apply the correct age-safety protections before you continue.
            </p>
          </div>
        </header>

        <div className="grid gap-0 lg:grid-cols-[minmax(0,1.35fr)_minmax(18rem,0.65fr)] lg:gap-12">
          <section className="border-b border-[color:var(--loombus-border)] py-8 sm:py-10 lg:border-b-0" aria-labelledby="age-gate-form-title">
            <div className="max-w-2xl">
              <p className="text-xs font-black uppercase tracking-[0.2em] text-[color:var(--loombus-gold)]">
                Verification
              </p>
              <h2 id="age-gate-form-title" className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">
                Enter your actual date of birth
              </h2>
              <p className="mt-3 text-sm leading-6 text-[color:var(--loombus-text-muted)]">
                Use the date shown on your official records.
              </p>
            </div>

            <form onSubmit={submitAgeGate} className="mt-7 grid max-w-2xl gap-6">
              <div>
                <label className="mb-2 block text-sm font-semibold text-[color:var(--loombus-text)]">
                  Date of birth
                </label>
                <DateOfBirthSelect
                  value={dateOfBirth}
                  onChange={setDateOfBirth}
                  idPrefix="account-date-of-birth"
                  disabled={saving}
                />
              </div>

              <button
                type="submit"
                disabled={saving}
                className="age-gate-primary min-h-11 w-fit border border-[color:var(--loombus-gold)] bg-[color:var(--loombus-gold)] px-6 py-3 text-sm font-black text-[color:var(--loombus-gold-contrast)] transition hover:brightness-105 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[color:var(--loombus-gold)] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {saving ? "Saving..." : "Continue"}
              </button>

              {message ? (
                <p className="border-t border-[color:var(--loombus-border)] pt-4 text-sm text-[color:var(--loombus-text-muted)]" role="status">
                  {message}
                </p>
              ) : null}
            </form>
          </section>

          <aside className="border-t border-[color:var(--loombus-border)] py-8 lg:border-l lg:border-t-0 lg:pl-10 lg:pt-10" aria-label="Age verification guidance">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-[color:var(--loombus-gold)]">
              Why Loombus asks
            </p>
            <h2 className="mt-2 text-xl font-semibold tracking-tight">Age protections follow the account.</h2>
            <p className="mt-3 text-sm leading-6 text-[color:var(--loombus-text-muted)]">
              Your age band determines which safety and privacy defaults apply. This step does not replace the protected age-correction process available later in Account settings.
            </p>
          </aside>
        </div>
      </div>
    </main>
  );
}
