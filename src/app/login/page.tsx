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
      className="min-h-screen bg-black px-4 py-8 text-white sm:px-6 sm:py-16"
    >
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-xl flex-col justify-center sm:min-h-0 sm:block">
        <Link href="/" className="mb-10 inline-block text-sm text-zinc-500 hover:text-white sm:mb-12">
          ← Back to home
        </Link>

        <p className="mb-4 text-sm uppercase tracking-[0.3em] text-zinc-500">Loombus</p>

        <h1 className="mb-6 text-4xl font-semibold tracking-tight sm:text-5xl">Log in.</h1>

        <p className="mb-8 leading-relaxed text-zinc-400 sm:mb-10">
          Return to your Loombus signal hub.
        </p>

        <div className="mb-6 rounded-3xl border border-zinc-800 bg-zinc-950 p-6 shadow-2xl shadow-black/30">
          <button
            type="button"
            onClick={() => void handleOAuthLogin("apple")}
            disabled={loading || Boolean(oauthLoading)}
            className="mb-3 flex w-full items-center justify-center gap-3 rounded-full bg-white px-6 py-3 text-sm font-medium text-black transition hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <AppleLogoMark />
            {oauthLoading === "apple" ? "Opening Apple..." : "Continue with Apple"}
          </button>

          <button
            type="button"
            onClick={() => void handleOAuthLogin("google")}
            disabled={loading || Boolean(oauthLoading)}
            className="flex w-full items-center justify-center gap-3 rounded-full bg-white px-6 py-3 text-sm font-medium text-black transition hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <GoogleLogoMark />
            {oauthLoading === "google" ? "Opening Google..." : "Continue with Google"}
          </button>

          <div className="mt-5 flex items-center gap-3 text-xs uppercase tracking-[0.2em] text-zinc-700">
            <span className="h-px flex-1 bg-zinc-900" />
            Or log in with email
            <span className="h-px flex-1 bg-zinc-900" />
          </div>
        </div>

        <form
          onSubmit={handleLogin}
          className="space-y-5 rounded-3xl border border-zinc-800 bg-zinc-950 p-6 shadow-2xl shadow-black/30"
        >
              <div>
                <label htmlFor="email" className="mb-2 block text-sm text-zinc-400">Email</label>
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
                  className="w-full rounded-xl border border-zinc-800 bg-black px-4 py-3 text-white outline-none focus:border-zinc-500"
                />
              </div>

              <div>
                <label htmlFor="password" className="mb-2 block text-sm text-zinc-400">Password</label>
                <input
                  id="password"
                  name="password"
                  type="password"
                  value={password}
                  autoComplete="current-password"
                  required
                  onChange={(event) => setPassword(event.target.value)}
                  className="w-full rounded-xl border border-zinc-800 bg-black px-4 py-3 text-white outline-none focus:border-zinc-500"
                />
              </div>

              <div className="text-right">
                <Link
                  href="/forgot-password"
                  className="text-sm font-medium text-zinc-400 underline decoration-zinc-600 underline-offset-4 transition hover:text-white"
                >
                  Forgot password?
                </Link>
              </div>

              {nativeApp === true ? (
                <p className="rounded-2xl border border-zinc-900 bg-black p-4 text-xs leading-relaxed text-zinc-500">
                  After a successful email login, your device password manager can offer to save or update this login. Face ID or device biometrics remain an optional app lock.
                </p>
              ) : null}

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-full bg-white px-6 py-3 text-black transition hover:bg-zinc-200 disabled:opacity-50"
              >
                {loading ? "Logging in..." : "Log In"}
              </button>

              {message ? <p className="text-sm text-zinc-400">{message}</p> : null}

              {showResendVerification ? (
                <div className="rounded-2xl border border-zinc-800 bg-black p-4">
                  <p className="text-sm leading-relaxed text-zinc-400">
                    The previous confirmation link may have expired. Send a new link to the email above.
                  </p>
                  <button
                    type="button"
                    onClick={() => void handleResendVerification()}
                    disabled={resendingVerification}
                    className="mt-3 w-full rounded-full border border-zinc-700 px-5 py-2.5 text-sm font-medium text-zinc-200 transition hover:border-zinc-500 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {resendingVerification
                      ? "Sending verification email..."
                      : "Resend verification email"}
                  </button>
                </div>
              ) : null}

              <p className="text-xs leading-relaxed text-zinc-500">
                By logging in or continuing with Apple, Google, or email, you agree to the{" "}
                <Link href="/terms" className="text-zinc-400 underline-offset-4 hover:underline">Terms</Link>
                ,{" "}
                <Link href="/privacy" className="text-zinc-400 underline-offset-4 hover:underline">Privacy Policy</Link>
                ,{" "}
                <Link href="/cookies" className="text-zinc-400 underline-offset-4 hover:underline">Cookie Use</Link>
                ,{" "}
                <Link href="/guidelines" className="text-zinc-400 underline-offset-4 hover:underline">Community Guidelines</Link>
                ,{" "}
                <Link href="/safety" className="text-zinc-400 underline-offset-4 hover:underline">Safety</Link>
                , and{" "}
                <Link href="/support" className="text-zinc-400 underline-offset-4 hover:underline">Support</Link>.
              </p>

              <p className="text-center text-sm text-zinc-500">
                Don’t have an account?{" "}
                <Link href="/signup" className="text-zinc-300 underline underline-offset-4 hover:text-white">
                  Create one
                </Link>
              </p>
        </form>
      </div>
    </main>
  );
}
