"use client";

import Link from "next/link";
import { type FormEvent, useCallback, useEffect, useState } from "react";
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

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState<"google" | "apple" | null>(null);
  const [nativeApp, setNativeApp] = useState<boolean | null>(null);
  const [showResendVerification, setShowResendVerification] = useState(false);
  const [resendingVerification, setResendingVerification] = useState(false);

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

      if (!mounted) {
        return;
      }

      if (data.session) {
        window.location.replace(getNextPath());
        return;
      }
    }

    void loadLoginState();

    return () => {
      mounted = false;
    };
  }, [getNextPath]);

  async function handleLogin(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();

    if (loading) {
      return;
    }

    setLoading(true);
    setMessage("");
    setShowResendVerification(false);

    const cleanEmail = email.trim();
    const { error } = await supabase.auth.signInWithPassword({
      email: cleanEmail,
      password,
    });

    if (error) {
      setMessage(`Error: ${getAuthErrorMessage(error, "login")}`);
      setShowResendVerification(isEmailNotConfirmedError(error.message));
      setLoading(false);
      return;
    }

    const { data: sessionData } = await supabase.auth.getSession();

    if (!sessionData.session) {
      setMessage(
        "Login succeeded, but the browser session was not ready. Please try again."
      );
      setLoading(false);
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

  async function handleResendVerification() {
    const cleanEmail = email.trim();

    if (!cleanEmail || resendingVerification) {
      return;
    }

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
    if (loading || oauthLoading) {
      return;
    }

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
        options: {
          redirectTo: getOAuthRedirectTo(getNextPath()),
        },
      });

      if (error) {
        setMessage(
          `${provider === "apple" ? "Apple" : "Google"} login error: ${
            error.message
          }`
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
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[color:var(--loombus-gold)]">
            Loombus
          </p>
          <h1 className="mt-3 max-w-3xl text-4xl font-semibold tracking-[-0.04em] sm:text-5xl">
            Log in
          </h1>
          <p className="mt-4 max-w-2xl text-sm leading-7 text-[color:var(--loombus-text-muted)] sm:text-base">
            Return to your discussions, saved ideas, and Loombus activity.
          </p>
        </header>

        <div className="grid gap-0 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
          <section className="border-b border-[color:var(--loombus-border)] py-8 lg:border-b-0 lg:border-r lg:pr-10 sm:py-10">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[color:var(--loombus-text-muted)]">
              Continue with a provider
            </p>
            <div className="mt-6 divide-y divide-[color:var(--loombus-border)] border-y border-[color:var(--loombus-border)]">
              <button
                type="button"
                onClick={() => void handleOAuthLogin("apple")}
                disabled={loading || Boolean(oauthLoading)}
                className="flex min-h-14 w-full items-center justify-between gap-4 px-1 py-3 text-left text-sm font-medium transition hover:text-[color:var(--loombus-gold)] disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--loombus-gold)]"
              >
                <span className="flex items-center gap-3">
                  <AppleLogoMark />
                  Continue with Apple
                </span>
                <span className="text-xs text-[color:var(--loombus-text-muted)]">
                  {oauthLoading === "apple" ? "Opening…" : "→"}
                </span>
              </button>

              <button
                type="button"
                onClick={() => void handleOAuthLogin("google")}
                disabled={loading || Boolean(oauthLoading)}
                className="flex min-h-14 w-full items-center justify-between gap-4 px-1 py-3 text-left text-sm font-medium transition hover:text-[color:var(--loombus-gold)] disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--loombus-gold)]"
              >
                <span className="flex items-center gap-3">
                  <GoogleLogoMark />
                  Continue with Google
                </span>
                <span className="text-xs text-[color:var(--loombus-text-muted)]">
                  {oauthLoading === "google" ? "Opening…" : "→"}
                </span>
              </button>
            </div>

            <p className="mt-6 text-xs leading-6 text-[color:var(--loombus-text-muted)]">
              Prefer email? Use your Loombus email and password in the sign-in form.
            </p>
          </section>

          <section className="py-8 lg:pl-10 sm:py-10">
            <div className="flex items-end justify-between gap-4 border-b border-[color:var(--loombus-border)] pb-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[color:var(--loombus-gold)]">
                  Email access
                </p>
                <h2 className="mt-2 text-xl font-semibold tracking-tight">Sign in to your account</h2>
              </div>
              <Link
                href="/forgot-password"
                className="min-h-11 shrink-0 content-center text-sm text-[color:var(--loombus-text-muted)] underline underline-offset-4 transition hover:text-[color:var(--loombus-text)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[color:var(--loombus-gold)]"
              >
                Forgot password?
              </Link>
            </div>

            <form onSubmit={handleLogin} className="mt-6 space-y-6">
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-[color:var(--loombus-text)]">
                  Email
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  value={email}
                  autoComplete="username"
                  inputMode="email"
                  autoCapitalize="none"
                  spellCheck={false}
                  required
                  onChange={(event) => {
                    setEmail(event.target.value);
                    setShowResendVerification(false);
                  }}
                  className="mt-2 min-h-12 w-full border-0 border-b border-[color:var(--loombus-border)] bg-transparent px-0 py-3 text-[color:var(--loombus-text)] outline-none transition focus:border-[color:var(--loombus-gold)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[color:var(--loombus-gold)]"
                />
              </div>

              <div>
                <label htmlFor="password" className="block text-sm font-medium text-[color:var(--loombus-text)]">
                  Password
                </label>
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

              {nativeApp === true ? (
                <div className="border-y border-[color:var(--loombus-border)] py-4 text-xs leading-6 text-[color:var(--loombus-text-muted)]">
                  After a successful email login, your device password manager can offer to save or update this login. Face ID or device biometrics remain an optional app lock.
                </div>
              ) : null}

              <button
                type="submit"
                disabled={loading}
                className="min-h-12 w-full border border-[color:var(--loombus-gold)] bg-[color:var(--loombus-gold)] px-6 py-3 text-sm font-semibold text-[#17140B] transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[color:var(--loombus-gold)]"
              >
                {loading ? "Logging in..." : "Log In"}
              </button>

              {message ? (
                <p role="status" className="border-t border-[color:var(--loombus-border)] pt-4 text-sm leading-6 text-[color:var(--loombus-text-muted)]">
                  {message}
                </p>
              ) : null}

              {showResendVerification ? (
                <div className="border-t border-[color:var(--loombus-border)] pt-5">
                  <p className="text-sm leading-6 text-[color:var(--loombus-text-muted)]">
                    The previous confirmation link may have expired. Send a new link to the email above.
                  </p>
                  <button
                    type="button"
                    onClick={() => void handleResendVerification()}
                    disabled={resendingVerification}
                    className="mt-4 min-h-11 border-b border-[color:var(--loombus-gold)] px-0 py-2 text-sm font-medium text-[color:var(--loombus-text)] transition hover:text-[color:var(--loombus-gold)] disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[color:var(--loombus-gold)]"
                  >
                    {resendingVerification
                      ? "Sending verification email..."
                      : "Resend verification email"}
                  </button>
                </div>
              ) : null}
            </form>

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
          By logging in or continuing with Apple, Google, or email, you agree to the{" "}
          <Link href="/terms" className="underline-offset-4 hover:underline">Terms</Link>
          ,{" "}
          <Link href="/privacy" className="underline-offset-4 hover:underline">Privacy Policy</Link>
          ,{" "}
          <Link href="/cookies" className="underline-offset-4 hover:underline">Cookie Use</Link>
          ,{" "}
          <Link href="/guidelines" className="underline-offset-4 hover:underline">Community Guidelines</Link>
          ,{" "}
          <Link href="/safety" className="underline-offset-4 hover:underline">Safety</Link>
          , and{" "}
          <Link href="/support" className="underline-offset-4 hover:underline">Support</Link>.
        </section>
      </div>
    </main>
  );
}
