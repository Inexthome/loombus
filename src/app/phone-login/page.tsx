"use client";

import Link from "next/link";
import { type FormEvent, useState } from "react";
import { ShieldCheck } from "lucide-react";
import { supabase } from "@/lib/supabase/client";

function getUsNationalDigits(value: string) {
  let digits = value.replace(/\D/g, "");
  if (digits.length > 10 && digits.startsWith("1")) digits = digits.slice(1);
  return digits.slice(0, 10);
}

function formatUsPhone(value: string) {
  const digits = getUsNationalDigits(value);
  if (!digits) return "";
  if (digits.length < 4) return `(${digits}`;
  if (digits.length < 7) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
}

function normalizeUsPhone(value: string) {
  const digits = getUsNationalDigits(value);
  return digits.length === 10 ? `+1${digits}` : null;
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
  const [verifiedPhone, setVerifiedPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [working, setWorking] = useState(false);
  const [message, setMessage] = useState("");

  async function sendCode(event: FormEvent) {
    event.preventDefault();
    const normalized = normalizeUsPhone(phone);
    if (!normalized) {
      setMessage("Enter a valid 10-digit U.S. mobile number.");
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

    setVerifiedPhone(normalized);
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
      phone: verifiedPhone,
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
    <main className="min-h-[78vh] bg-[color:var(--loombus-page-bg)] px-5 py-10 text-[color:var(--loombus-text)] sm:px-8 sm:py-16">
      <div className="mx-auto grid max-w-4xl overflow-hidden rounded-3xl border border-[color:var(--loombus-border)] bg-[color:var(--loombus-surface)] shadow-sm md:grid-cols-[0.9fr_1.1fr]">
        <aside className="border-b border-[color:var(--loombus-border)] bg-[color:var(--loombus-page-bg)] p-7 md:border-b-0 md:border-r md:p-9">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[color:var(--loombus-text-muted)]">Loombus account access</p>
          <h1 className="mt-4 max-w-sm text-3xl font-semibold leading-tight">A quieter way to prove it is you.</h1>
          <p className="mt-4 max-w-sm text-sm leading-6 text-[color:var(--loombus-text-muted)]">
            Sign in with a one-time code sent to your mobile number. The number stays private and is never shown on your public profile.
          </p>

          <div className="mt-8 flex items-start gap-3 border-t border-[color:var(--loombus-border)] pt-6">
            <span className="mt-0.5 rounded-full border border-[color:var(--loombus-border)] p-2">
              <ShieldCheck className="h-4 w-4" aria-hidden="true" />
            </span>
            <div>
              <p className="text-sm font-semibold">Private by design</p>
              <p className="mt-1 text-xs leading-5 text-[color:var(--loombus-text-muted)]">Phone discovery remains off unless you explicitly enable it later in Settings.</p>
            </div>
          </div>
        </aside>

        <section className="p-7 md:p-9" aria-labelledby="phone-login-heading">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[color:var(--loombus-text-muted)]">{codeSent ? "Step 2 of 2" : "Step 1 of 2"}</p>
              <h2 id="phone-login-heading" className="mt-2 text-2xl font-semibold">{codeSent ? "Enter your code" : "Sign in with your phone"}</h2>
            </div>
            <span className="rounded-full border border-[color:var(--loombus-border)] px-3 py-1 text-xs font-semibold text-[color:var(--loombus-text-muted)]">U.S. +1</span>
          </div>

          {!codeSent ? (
            <form className="mt-7 space-y-5" onSubmit={sendCode}>
              <label className="block">
                <span className="mb-2 block text-sm font-medium">Mobile number</span>
                <div className="flex overflow-hidden rounded-xl border border-[color:var(--loombus-border)] bg-[color:var(--loombus-page-bg)] focus-within:ring-2 focus-within:ring-[color:var(--loombus-border)]">
                  <span className="flex items-center gap-2 border-r border-[color:var(--loombus-border)] px-3 text-sm font-semibold" aria-hidden="true">
                    <span>🇺🇸</span><span>+1</span>
                  </span>
                  <input
                    type="tel"
                    inputMode="tel"
                    autoComplete="tel-national"
                    value={phone}
                    onChange={(event) => setPhone(formatUsPhone(event.target.value))}
                    placeholder="(904) 555-1234"
                    disabled={working}
                    aria-label="U.S. mobile number"
                    className="min-w-0 flex-1 bg-transparent px-4 py-3 text-[color:var(--loombus-text)] outline-none"
                  />
                </div>
                <span className="mt-2 block text-xs text-[color:var(--loombus-text-muted)]">Enter the 10-digit number. Loombus adds the +1 country code automatically.</span>
              </label>

              <p className="text-xs leading-5 text-[color:var(--loombus-text-muted)]">
                By requesting a code, you consent to receive a transactional SMS from Loombus for authentication. Message frequency varies based on your requests. Message and data rates may apply. No marketing messages are sent through this program. See the{" "}
                <Link href="/terms#sms-authentication" className="font-semibold underline underline-offset-2">Terms</Link>{" "}
                and{" "}
                <Link href="/privacy#mobile-sms-auth" className="font-semibold underline underline-offset-2">Privacy Policy</Link>.
              </p>
              <button
                type="submit"
                disabled={working}
                className="w-full rounded-xl bg-[color:var(--loombus-text)] px-4 py-3 font-semibold text-[color:var(--loombus-page-bg)] transition disabled:opacity-60"
              >
                {working ? "Sending…" : "Send sign-in code"}
              </button>
            </form>
          ) : (
            <form className="mt-7 space-y-5" onSubmit={verifyCode}>
              <p className="text-sm leading-6 text-[color:var(--loombus-text-muted)]">We sent a code to +1 {formatUsPhone(verifiedPhone)}.</p>
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
                  className="w-full rounded-xl border border-[color:var(--loombus-border)] bg-[color:var(--loombus-page-bg)] px-4 py-3 text-center text-xl tracking-[0.35em] text-[color:var(--loombus-text)] outline-none focus:ring-2 focus:ring-[color:var(--loombus-border)]"
                />
              </label>
              <button
                type="submit"
                disabled={working}
                className="w-full rounded-xl bg-[color:var(--loombus-text)] px-4 py-3 font-semibold text-[color:var(--loombus-page-bg)] transition disabled:opacity-60"
              >
                {working ? "Verifying…" : "Verify and sign in"}
              </button>
              <button
                type="button"
                disabled={working}
                onClick={() => { setCodeSent(false); setVerifiedPhone(""); setOtp(""); setMessage(""); }}
                className="w-full px-4 py-2 text-sm font-medium text-[color:var(--loombus-text-muted)] hover:text-[color:var(--loombus-text)]"
              >
                Use a different number
              </button>
            </form>
          )}

          {message ? <p className="mt-4 rounded-lg border border-[color:var(--loombus-border)] bg-[color:var(--loombus-page-bg)] px-3 py-2 text-sm text-[color:var(--loombus-text-muted)]" role="status">{message}</p> : null}

          <div className="mt-7 border-t border-[color:var(--loombus-border)] pt-5 text-center text-sm">
            <Link href="/login" className="font-semibold hover:underline">Use email, Apple, or Google instead</Link>
          </div>
        </section>
      </div>
    </main>
  );
}
