"use client";

import Link from "next/link";
import { type FormEvent, useEffect, useState } from "react";
import { getAgeBandFromDateOfBirth, getDateYearsAgo } from "@/lib/age-safety";
import { supabase } from "@/lib/supabase/client";

function getSafeNext(value: string | null) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return "/home";
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

    checkSession();
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
      setMessage("Loombus is not available to children under 13.");
      await supabase.auth.signOut();
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
        setMessage(payload.error ?? "Unable to save age safety settings.");

        if (payload.code === "under_13_not_allowed") {
          await supabase.auth.signOut();
        }

        setSaving(false);
        return;
      }

      window.location.replace(next);
    } catch {
      setMessage("Unable to save age safety settings.");
      setSaving(false);
    }
  }

  return (
    <main className="min-h-screen bg-black px-6 py-16 text-white">
      <div className="mx-auto max-w-xl">
        <Link href="/" className="mb-12 inline-block text-sm text-zinc-500 hover:text-white">
          ← Back to Loombus
        </Link>

        <div className="rounded-3xl border border-zinc-800 bg-zinc-950 p-7 shadow-2xl shadow-black/30">
          <p className="mb-3 text-sm uppercase tracking-[0.3em] text-zinc-500">
            Teen Safety Mode
          </p>

          <h1 className="mb-4 text-4xl font-semibold tracking-tight">
            Confirm your age.
          </h1>

          <p className="mb-6 leading-relaxed text-zinc-400">
            Loombus requires date of birth so we can block under-13 accounts and apply teen safety protections for members ages 13–17.
          </p>

          <form onSubmit={submitAgeGate} className="space-y-5">
            <div>
              <label className="mb-2 block text-sm text-zinc-400">
                Date of birth
              </label>

              <input
                type="date"
                value={dateOfBirth}
                required
                max={getDateYearsAgo(13)}
                onChange={(event) => setDateOfBirth(event.target.value)}
                className="w-full rounded-xl border border-zinc-800 bg-black px-4 py-3 text-white outline-none focus:border-zinc-500"
              />

              <p className="mt-2 text-xs leading-relaxed text-zinc-600">
                Members under 13 cannot use Loombus. Ages 13–17 receive additional safety protections.
              </p>
            </div>

            <button
              type="submit"
              disabled={saving}
              className="w-full rounded-full bg-white px-6 py-3 text-black transition hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving ? "Saving..." : "Continue"}
            </button>

            {message && (
              <p className="text-sm text-zinc-400">
                {message}
              </p>
            )}
          </form>
        </div>
      </div>
    </main>
  );
}
