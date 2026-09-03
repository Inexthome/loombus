"use client";

import Link from "next/link";
import { type FormEvent, useState } from "react";
import { supabase } from "@/lib/supabase/client";

function normalizePhone(value: string) {
  return value.trim().replace(/[()\s.-]/g, "");
}

function getNextPath() {
  if (typeof window === "undefined") return "/discussions";
  const requested = new URLSearchParams(window.location.search).get("next");
  if (!requested) return "/discussions";

  try {
    const resolved = new URL(requested, window.location.origin);
    if (resolved.origin !== window.location.origin) return "/discussions";
    return `${resolved.pathname}${resolved.search}${resolved.hash}`;
  } catch {
    return "/discussions";
  }
}

export default function PhoneLoginPage() {
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [working, setWorking] = useState(false);
  const [message, setMessage] = useState("");

  async function sendCode(event: FormEvent) {
    event.preventDefault();
    const normalized = normalizePhone(phone);
    if (!/^\+[1-9]\d{7,14}$/.test(normalized)) {
      setMessage("Enter your mobile number in international format, for example +19045551234.");
      return;
    }

    setWorking(true);
    setMessage("");
    const { error } = await supabase.auth.signInWithOtp({
      phone: normalized,
      options: { shouldCreateUser: true },
    });

    if (error) {
      setMessage(error.message || "Unable to send a sign-in code.");
      setWorking(false);
      return;
    }

    setPhone(normalized);
    setCodeSent(true);
    setMessage("A 6-digit sign-in code was sent by SMS.");
    setWorking(false);
  }

  async function verifyCode(event: FormEvent) {
    event.preventDefault();
    if (!/^\d{6}$/.test(otp.trim())) {
      setMessage("Enter the 6-digit code from the SMS.");
      return;
    }

    setWorking(true);
    setMessage("");
    const { error } = await supabase.auth.verifyOtp({
      phone,
      token: otp.trim(),
      type: "sms",
    });

    if (error) {
      setMessage(error.message || "The sign-in code could not be verified.");
      setWorking(false);
      return;
    }

    window.location.replace(getNextPath());
  }

  return (
    <main className="min-h-[75vh] px-5 py-14 sm:px-8">
      <div className="mx-auto max-w-md rounded-2xl border border-[color:var(--loombus-border)] bg-[color:var(--loombus-surface)] p-6 shadow-sm sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[color:var(--loombus-text-muted)]">Loombus account access</p>
        <h1 className="mt-2 text-2xl font-semibold text-[color:var(--loombus-text)]">Sign in with your phone</h1>
        <p className="mt-2 text-sm leading-6 text-[color:var(--loombus-text-muted)]">
          Use a verified mobile number and a one-time SMS code. Your number is never shown on your public profile.
        </p>

        {!codeSent ? (
          <form className="mt-6 space-y-4" onSubmit={sendCode}>
            <label className="block">
              <span className="mb-2 block text-sm font-medium">Mobile number</span>
              <input
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                placeholder="+19045551234"
                disabled={working}
                className="w-full rounded-xl border border-[color:var(--loombus-border)] bg-[color:var(--loombus-page-bg)] px-4 py-3 text-[color:var(--loombus-text)]"
              />
            </label>
            <button
              type="submit"
              disabled={working}
              className="w-full rounded-xl bg-[color:var(--loombus-text)] px-4 py-3 font-semibold text-[color:var(--loombus-page-bg)] disabled:opacity-60"
            >
              {working ? "Sending…" : "Send sign-in code"}
            </button>
          </form>
        ) : (
          <form className="mt-6 space-y-4" onSubmit={verifyCode}>
            <label className="block">
              <span className="mb-2 block text-sm font-medium">6-digit SMS code</span>
              <input
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                value={otp}
                onChange={(event) => setOtp(event.target.value.replace(/\D/g, ""))}
                placeholder="123456"
                disabled={working}
                className="w-full rounded-xl border border-[color:var(--loombus-border)] bg-[color:var(--loombus-page-bg)] px-4 py-3 text-center text-xl tracking-[0.35em] text-[color:var(--loombus-text)]"
              />
            </label>
            <button
              type="submit"
              disabled={working}
              className="w-full rounded-xl bg-[color:var(--loombus-text)] px-4 py-3 font-semibold text-[color:var(--loombus-page-bg)] disabled:opacity-60"
            >
              {working ? "Verifying…" : "Verify and sign in"}
            </button>
            <button
              type="button"
              disabled={working}
              onClick={() => { setCodeSent(false); setOtp(""); setMessage(""); }}
              className="w-full px-4 py-2 text-sm font-medium text-[color:var(--loombus-text-muted)]"
            >
              Use a different number
            </button>
          </form>
        )}

        {message ? <p className="mt-4 text-sm text-[color:var(--loombus-text-muted)]" role="status">{message}</p> : null}

        <div className="mt-6 border-t border-[color:var(--loombus-border)] pt-5 text-center text-sm">
          <Link href="/login" className="font-semibold hover:underline">Use email, Apple, or Google instead</Link>
        </div>
      </div>
    </main>
  );
}
