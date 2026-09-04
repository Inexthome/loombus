"use client";

import Link from "next/link";
import { type FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { AppleLogoMark, GoogleLogoMark } from "@/components/auth-provider-icons";
import { getAuthErrorMessage } from "@/lib/auth-error-message";
import {
  restorePersistedSupabaseSession,
  supabase,
} from "@/lib/supabase/client";
import { isIosNativeApp, isNativeApp } from "@/lib/native-app";
import { clearLegacyNativeBiometricLoginCredentials } from "@/lib/native-biometric";
import { signInWithNativeGoogle } from "@/lib/native-google-auth";
import { saveLoginToSystemPasswordManager } from "@/lib/native-password-manager";

function getSafeNext(value: string | null) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return "/discussions";
  }
  return value;
}

function getOAuthRedirectTo(nextPath: string) {
  const safeNext = getSafeNext(nextPath);
  const encodedNext = encodeURIComponent(safeNext);
  if (isIosNativeApp()) {
    return `loombus://auth/callback?next=${encodedNext}`;
  }
  return `${window.location.origin}/auth/callback?next=${encodedNext}`;
}

function isEmailNotConfirmedError(message: string) {
  const normalized = message.toLowerCase();
  return (
    normalized.includes("email not confirmed") ||
    normalized.includes("email_not_confirmed")
  );
}

function getUsNationalDigits(value: string) {
  let digits = value.replace(/\D/g, "");
  if (digits.length > 10 && digits.startsWith("1")) digits = digits.slice(1);
  return digits.slice(0, 10);
}

function normalizeUsPhone(value: string) {
  const digits = getUsNationalDigits(value);
  return digits.length === 10 ? `+1${digits}` : null;
}

function formatUsPhone(value: string) {
  const digits = getUsNationalDigits(value);
  if (!digits) return "";
  if (digits.length < 4) return `(${digits}`;
  if (digits.length < 7) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
}

function identifierLooksLikePhone(value: string) {
  const trimmed = value.trim();
  if (!trimmed || trimmed.includes("@")) return false;
  return /^[+()\d\s.-]+$/.test(trimmed) && getUsNationalDigits(trimmed).length > 0;
}

export default function LoginPage() {
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [verifiedPhone, setVerifiedPhone] = useState("");
  const [phoneCodeSent, setPhoneCodeSent] = useState(false);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState<"google" | "apple" | null>(null);
  const [nativeApp, setNativeApp] = useState<boolean | null>(null);
  const [showResendVerification, setShowResendVerification] = useState(false);
  const [resendingVerification, setResendingVerification] = useState(false);

  const phoneMode = useMemo(
    () => identifierLooksLikePhone(identifier),
    [identifier]
  );

  useEffect(() => {
    const timeout = window.setTimeout(() => setNativeApp(isNativeApp()), 0);
    return () => window.clearTimeout(timeout);
  }, []);

  const getNextPath = useCallback(() => {
    const params = new URLSearchParams(window.location.search);
    return getSafeNext(params.get("next"));
  }, []);

  useEffect(() => {
    let mounted = true;
    async function loadLoginState() {
      try {
        await clearLegacyNativeBiometricLoginCredentials();
        await restorePersistedSupabaseSession();
      } catch {
        if (mounted) {
          setMessage(
            "Loombus could not restore your saved session. Check your connection and try again."
          );
        }
        return;
      }
      const { data } = await supabase.auth.getSession();
      if (!mounted) return;
      if (data.session) {
        window.location.replace(getNextPath());
      }
    }
    void loadLoginState();
    return () => {
      mounted = false;
    };
  }, [getNextPath]);

  async function handleEmailLogin() {
    const cleanEmail = identifier.trim().toLowerCase();
    if (!cleanEmail.includes("@")) {
      setMessage("Enter a valid email address or U.S. mobile number.");
      return;
    }

    const { error } = await supabase.auth.signInWithPassword({
      email: cleanEmail,
      password,
    });

    if (error) {
      setMessage(`Error: ${getAuthErrorMessage(error, "login")}`);
      setShowResendVerification(isEmailNotConfirmedError(error.message));
      return;
    }

    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData.session) {
      setMessage(
        "Login succeeded, but the browser session was not ready. Please try again."
      );
      return;
    }

    if (isNativeApp()) {
      const saved = await saveLoginToSystemPasswordManager(cleanEmail, password);
      if (!saved.ok && !saved.cancelled) {
        console.warn(
          "Loombus could not offer this login to the system password manager.",
          saved.error
        );
      }
    }

    window.location.replace(getNextPath());
  }

  async function sendPhoneCode() {
    const normalized = normalizeUsPhone(identifier);
    if (!normalized) {
      setMessage("Enter a valid 10-digit U.S. mobile number.");
      return;
    }

    const { error } = await supabase.auth.signInWithOtp({
      phone: normalized,
      options: { shouldCreateUser: true },
    });

    if (error) {
      setMessage(error.message || "Unable to send a sign-in code.");
      return;
    }

    setVerifiedPhone(normalized);
    setPhoneCodeSent(true);
    setOtp("");
    setMessage("A 6-digit sign-in code was sent by SMS.");
  }

  async function handleLogin(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    if (loading) return;

    setLoading(true);
    setMessage("");
    setShowResendVerification(false);

    try {
      if (phoneMode) {
        await sendPhoneCode();
      } else {
        await handleEmailLogin();
      }
    } finally {
      setLoading(false);
    }
  }

  async function verifyPhoneCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading) return;
    if (!/^\d{6}$/.test(otp.trim())) {
      setMessage("Enter the 6-digit code from the SMS.");
      return;
    }

    setLoading(true);
    setMessage("");
    try {
      const { error } = await supabase.auth.verifyOtp({
        phone: verifiedPhone,
        token: otp.trim(),
        type: "sms",
      });
      if (error) {
        setMessage(error.message || "The sign-in code could not be verified.");
        return;
      }
      window.location.replace(getNextPath());
    } finally {
      setLoading(false);
    }
  }

  async function handleResendVerification() {
    const cleanEmail = identifier.trim().toLowerCase();
    if (!cleanEmail || resendingVerification) return;

    setResendingVerification(true);
    setMessage("");
    const { error } = await supabase.auth.resend({
      type: "signup",
      email: cleanEmail,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback?next=/discussions`,
      },
    });

    if (error) {
      setMessage(`Error: ${getAuthErrorMessage(error, "signup")}`);
      setResendingVerification(false);
      return;
    }

    setMessage(
      "Verification email sent. Use the newest link. It expires after 60 minutes."
    );
    setShowResendVerification(false);
    setResendingVerification(false);
  }

  async function handleOAuthLogin(provider: "google" | "apple") {
    if (loading || oauthLoading) return;
    setMessage("");
    setOauthLoading(provider);

    try {
      if (provider === "google" && isIosNativeApp()) {
        const nativeGoogle = await signInWithNativeGoogle();
        if (nativeGoogle.ok) {
          const { error } = await supabase.auth.signInWithIdToken({
            provider: "google",
            token: nativeGoogle.idToken,
            ...(nativeGoogle.accessToken
              ? { access_token: nativeGoogle.accessToken }
              : {}),
          });
          if (error) {
            setMessage(`Google login error: ${error.message}`);
            setOauthLoading(null);
            return;
          }
          window.location.replace(
            `/auth/callback?next=${encodeURIComponent(getNextPath())}`
          );
          return;
        }
        if (!nativeGoogle.unavailable) {
          setMessage(`Google login error: ${nativeGoogle.error}`);
          setOauthLoading(null);
          return;
        }
      }

      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: { redirectTo: getOAuthRedirectTo(getNextPath()) },
      });
      if (error) {
        setMessage(
          `${provider === "apple" ? "Apple" : "Google"} login error: ${error.message}`
        );
        setOauthLoading(null);
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unable to start OAuth login.";
      setMessage(
        `${provider === "apple" ? "Apple" : "Google"} login error: ${errorMessage}`
      );
      setOauthLoading(null);
    }
  }

  function resetPhoneStep() {
    setPhoneCodeSent(false);
    setVerifiedPhone("");
    setOtp("");
    setMessage("");
  }

  return (
    <main
      data-loombus-auth-shell
      data-loombus-login-editorial
      className="min-h-screen bg-[color:var(--loombus-page-bg)] px-4 py-8 text-[color:var(--loombus-text)] sm:px-6 sm:py-14"
    >
      <div className="mx-auto w-full max-w-5xl">
        <Link
          href="/"
          className="inline-flex min-h-11 items-center text-sm text-[color:var(--loombus-text-muted)] underline-offset-4 transition hover:text-[color:var(--loombus-text)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[color:var(--loombus-gold)]"
        >
          ← Back to home
        </Link>

        <header className="mt-10 border-b border-[color:var(--loombus-border)] pb-8 sm:mt-14 sm:pb-10">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[color:var(--loombus-gold)]">Loombus</p>
          <h1 className="mt-3 max-w-3xl text-4xl font-semibold tracking-[-0.04em] sm:text-5xl">Log in</h1>
          <p className="mt-4 max-w-2xl text-sm leading-7 text-[color:var(--loombus-text-muted)] sm:text-base">
            Return to your discussions, saved ideas, and Loombus activity.
          </p>
        </header>

        <div className="grid gap-0 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
          <section className="border-b border-[color:var(--loombus-border)] py-8 lg:border-b-0 lg:border-r lg:pr-10 sm:py-10">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[color:var(--loombus-text-muted)]">Continue with a provider</p>
            <div className="mt-6 divide-y divide-[color:var(--loombus-border)] border-y border-[color:var(--loombus-border)]">
              <button
                type="button"
                onClick={() => void handleOAuthLogin("apple")}
                disabled={loading || Boolean(oauthLoading)}
                className="flex min-h-14 w-full items-center justify-between gap-4 px-1 py-3 text-left text-sm font-medium transition hover:text-[color:var(--loombus-gold)] disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--loombus-gold)]"
              >
                <span className="flex items-center gap-3"><AppleLogoMark />Continue with Apple</span>
                <span className="text-xs text-[color:var(--loombus-text-muted)]">{oauthLoading === "apple" ? "Opening…" : "→"}</span>
              </button>
              <button
                type="button"
                onClick={() => void handleOAuthLogin("google")}
                disabled={loading || Boolean(oauthLoading)}
                className="flex min-h-14 w-full items-center justify-between gap-4 px-1 py-3 text-left text-sm font-medium transition hover:text-[color:var(--loombus-gold)] disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--loombus-gold)]"
              >
                <span className="flex items-center gap-3"><GoogleLogoMark />Continue with Google</span>
                <span className="text-xs text-[color:var(--loombus-text-muted)]">{oauthLoading === "google" ? "Opening…" : "→"}</span>
              </button>
            </div>
          </section>

          <section className="py-8 lg:pl-10 sm:py-10">
            <div className="flex items-end justify-between gap-4 border-b border-[color:var(--loombus-border)] pb-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[color:var(--loombus-gold)]">
                  {phoneCodeSent ? "SMS verification" : "Account access"}
                </p>
                <h2 className="mt-2 text-xl font-semibold tracking-tight">
                  {phoneCodeSent ? "Enter your sign-in code" : "Sign in to your account"}
                </h2>
              </div>
              {!phoneCodeSent ? (
                <Link
                  href="/forgot-password"
                  className="min-h-11 shrink-0 content-center text-sm text-[color:var(--loombus-text-muted)] underline underline-offset-4 transition hover:text-[color:var(--loombus-text)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[color:var(--loombus-gold)]"
                >
                  Forgot password?
                </Link>
              ) : null}
            </div>

            {!phoneCodeSent ? (
              <form onSubmit={handleLogin} className="mt-6 space-y-6">
                <div>
                  <label htmlFor="identifier" className="block text-sm font-medium text-[color:var(--loombus-text)]">
                    Email or phone number
                  </label>
                  <input
                    id="identifier"
                    name="identifier"
                    type="text"
                    value={identifier}
                    autoComplete="username"
                    inputMode="text"
                    autoCapitalize="none"
                    spellCheck={false}
                    required
                    placeholder="Email or U.S. mobile number"
                    onChange={(event) => {
                      const next = event.target.value;
                      setIdentifier(identifierLooksLikePhone(next) ? formatUsPhone(next) : next);
                      setShowResendVerification(false);
                      setMessage("");
                    }}
                    className="mt-2 min-h-12 w-full border-0 border-b border-[color:var(--loombus-border)] bg-transparent px-0 py-3 text-[color:var(--loombus-text)] outline-none transition focus:border-[color:var(--loombus-gold)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[color:var(--loombus-gold)]"
                  />
                </div>

                {!phoneMode ? (
                  <div>
                    <label htmlFor="password" className="block text-sm font-medium text-[color:var(--loombus-text)]">Password</label>
                    <input
                      id="password"
                      name="password"
                      type="password"
                      value={password}
                      autoComplete="current-password"
                      required
                      onChange={(event) => setPassword(event.target.value)}
                      className="mt-2 min-h-12 w-full border-0 border-b border-[color:var(--loombus-border)] bg-transparent px-0 py-3 text-[color:var(--loombus-text)] outline-none transition focus:border-[color:var(--loombus-gold)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[color:var(--loombus-gold)]"
                    />
                  </div>
                ) : (
                  <p className="border-y border-[color:var(--loombus-border)] py-4 text-xs leading-6 text-[color:var(--loombus-text-muted)]">
                    Phone sign-in uses a 6-digit SMS code. By requesting a code, you consent to receive a transactional authentication SMS from Loombus. Message and data rates may apply. No marketing messages are sent. See the{" "}
                    <Link href="/terms#sms-authentication" className="font-semibold underline underline-offset-2">Terms</Link>{" "}
                    and{" "}
                    <Link href="/privacy#mobile-sms-auth" className="font-semibold underline underline-offset-2">Privacy Policy</Link>.
                  </p>
                )}

                {nativeApp === true && !phoneMode ? (
                  <div className="border-y border-[color:var(--loombus-border)] py-4 text-xs leading-6 text-[color:var(--loombus-text-muted)]">
                    After a successful email login, your device password manager can offer to save or update this login. Face ID or device biometrics remain an optional app lock.
                  </div>
                ) : null}

                <button
                  type="submit"
                  disabled={loading}
                  className="min-h-12 w-full border border-[color:var(--loombus-gold)] bg-[color:var(--loombus-gold)] px-6 py-3 text-sm font-semibold text-[#17140B] transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[color:var(--loombus-gold)]"
                >
                  {loading
                    ? phoneMode ? "Sending code..." : "Logging in..."
                    : phoneMode ? "Send sign-in code" : "Log In"}
                </button>

                {message ? (
                  <p role="status" aria-live="polite" className="border-t border-[color:var(--loombus-border)] pt-4 text-sm leading-6 text-[color:var(--loombus-text-muted)]">
                    {message}
                  </p>
                ) : null}

                {showResendVerification ? (
                  <div className="border-t border-[color:var(--loombus-border)] pt-5">
                    <button
                      type="button"
                      onClick={() => void handleResendVerification()}
                      disabled={resendingVerification}
                      className="min-h-11 border-b border-[color:var(--loombus-gold)] px-0 py-2 text-sm font-medium text-[color:var(--loombus-text)] transition hover:text-[color:var(--loombus-gold)] disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[color:var(--loombus-gold)]"
                    >
                      {resendingVerification ? "Sending verification email..." : "Resend verification email"}
                    </button>
                  </div>
                ) : null}
              </form>
            ) : (
              <form onSubmit={verifyPhoneCode} className="mt-6 space-y-6">
                <p className="text-sm leading-6 text-[color:var(--loombus-text-muted)]">
                  Code sent to +1 {formatUsPhone(verifiedPhone)}.
                </p>
                <div>
                  <label htmlFor="otp" className="block text-sm font-medium text-[color:var(--loombus-text)]">6-digit SMS code</label>
                  <input
                    id="otp"
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={6}
                    value={otp}
                    onChange={(event) => setOtp(event.target.value.replace(/\D/g, ""))}
                    required
                    className="mt-2 min-h-12 w-full border-0 border-b border-[color:var(--loombus-border)] bg-transparent px-0 py-3 text-center text-xl tracking-[0.3em] text-[color:var(--loombus-text)] outline-none transition focus:border-[color:var(--loombus-gold)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[color:var(--loombus-gold)]"
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="min-h-12 w-full border border-[color:var(--loombus-gold)] bg-[color:var(--loombus-gold)] px-6 py-3 text-sm font-semibold text-[#17140B] transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[color:var(--loombus-gold)]"
                >
                  {loading ? "Verifying..." : "Verify and sign in"}
                </button>
                <button
                  type="button"
                  onClick={resetPhoneStep}
                  disabled={loading}
                  className="min-h-11 border-b border-[color:var(--loombus-gold)] px-0 py-2 text-sm font-medium text-[color:var(--loombus-text)] transition hover:text-[color:var(--loombus-gold)] disabled:opacity-50"
                >
                  Use a different email or phone number
                </button>
                {message ? (
                  <p role="status" aria-live="polite" className="border-t border-[color:var(--loombus-border)] pt-4 text-sm leading-6 text-[color:var(--loombus-text-muted)]">
                    {message}
                  </p>
                ) : null}
              </form>
            )}

            <div className="mt-8 border-t border-[color:var(--loombus-border)] pt-6">
              <p className="text-sm text-[color:var(--loombus-text-muted)]">
                Don’t have an account?{" "}
                <Link
                  href="/signup"
                  className="font-medium text-[color:var(--loombus-text)] underline decoration-[color:var(--loombus-gold)] underline-offset-4 transition hover:text-[color:var(--loombus-gold)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[color:var(--loombus-gold)]"
                >
                  Create one
                </Link>
              </p>
            </div>
          </section>
        </div>

        <section className="border-t border-[color:var(--loombus-border)] py-6 text-xs leading-6 text-[color:var(--loombus-text-muted)]">
          By logging in or continuing with Apple, Google, email, or phone, you agree to the{" "}
          <Link href="/terms" className="underline-offset-4 hover:underline">Terms</Link>,{" "}
          <Link href="/privacy" className="underline-offset-4 hover:underline">Privacy Policy</Link>,{" "}
          <Link href="/cookies" className="underline-offset-4 hover:underline">Cookie Use</Link>,{" "}
          <Link href="/guidelines" className="underline-offset-4 hover:underline">Community Guidelines</Link>,{" "}
          <Link href="/safety" className="underline-offset-4 hover:underline">Safety</Link>, and{" "}
          <Link href="/support" className="underline-offset-4 hover:underline">Support</Link>.
        </section>
      </div>
    </main>
  );
}
