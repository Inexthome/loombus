"use client";

function getSafeNext(value: string | null) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return "/discussions";
  }

  return value;
}

import Link from "next/link";
import { type FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { isNativeApp } from "@/lib/native-app";
import {
  isBiometricUnlockEnabled,
  verifyNativeBiometric,
} from "@/lib/native-biometric";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [biometricSessionReady, setBiometricSessionReady] = useState(false);
  const [checkingBiometricSession, setCheckingBiometricSession] = useState(true);
  const [biometricUnlocking, setBiometricUnlocking] = useState(false);
  const biometricPromptInFlight = useRef(false);

  const getNextPath = useCallback(() => {
    const params = new URLSearchParams(window.location.search);
    return getSafeNext(params.get("next"));
  }, []);

  const redirectWithOptionalBiometric = useCallback(
    async (reason = "Unlock Loombus to continue.") => {
      const next = getNextPath();

      if (!isNativeApp() || !isBiometricUnlockEnabled()) {
        window.location.replace(next);
        return;
      }

      setBiometricSessionReady(true);

      if (biometricPromptInFlight.current) {
        return;
      }

      biometricPromptInFlight.current = true;
      setBiometricUnlocking(true);
      setMessage("");

      const result = await verifyNativeBiometric(reason);

      biometricPromptInFlight.current = false;
      setBiometricUnlocking(false);

      if (result.ok) {
        window.location.replace(next);
        return;
      }

      setMessage("Face ID unlock was canceled. Try again or sign in manually.");
    },
    [getNextPath]
  );

  useEffect(() => {
    let mounted = true;

    async function redirectIfAlreadyLoggedIn() {
      setCheckingBiometricSession(true);

      const { data } = await supabase.auth.getSession();

      if (!mounted) {
        return;
      }

      if (data.session) {
        await redirectWithOptionalBiometric("Unlock Loombus to continue.");
      }

      if (mounted) {
        setCheckingBiometricSession(false);
      }
    }

    void redirectIfAlreadyLoggedIn();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) {
        void redirectWithOptionalBiometric("Unlock Loombus after signing in.");
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [redirectWithOptionalBiometric]);
  const [loading, setLoading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState<"google" | "apple" | null>(null);
  async function handleLogin(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();

    if (loading) {
      return;
    }

    setLoading(true);
    setMessage("");

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setMessage(`Error: ${error.message}`);
      setLoading(false);
      return;
    }

    const { data: sessionData } = await supabase.auth.getSession();

    if (!sessionData.session) {
      setMessage("Login succeeded, but the browser session was not ready. Please try again.");
      setLoading(false);
      return;
    }

    setMessage("Login successful.");
    await redirectWithOptionalBiometric("Unlock Loombus after signing in.");
  }

  async function handleUseAnotherAccount() {
    setMessage("");
    setBiometricSessionReady(false);
    await supabase.auth.signOut();
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
          redirectTo: `${window.location.origin}/auth/callback?next=/discussions`,
        },
      });

      if (error) {
        setMessage(`${provider === "apple" ? "Apple" : "Google"} login error: ${error.message}`);
        setOauthLoading(null);
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unable to start OAuth login.";
      setMessage(`${provider === "apple" ? "Apple" : "Google"} login error: ${message}`);
      setOauthLoading(null);
    }
  }

  return (
    <main className="min-h-screen bg-black px-6 py-16 text-white">
      <div className="mx-auto max-w-xl">
        <Link href="/" className="mb-12 inline-block text-sm text-zinc-500 hover:text-white">
          ← Back to home
        </Link>

        <p className="mb-4 text-sm uppercase tracking-[0.3em] text-zinc-500">
          Loombus
        </p>

        <h1 className="mb-6 text-5xl font-semibold tracking-tight">
          Log in.
        </h1>

        <p className="mb-10 leading-relaxed text-zinc-400">
          Return to your high-signal discussion environment.
        </p>

        {biometricSessionReady ? (
          <div className="mb-6 rounded-3xl border border-zinc-800 bg-zinc-950 p-6 shadow-2xl shadow-black/30">
            <p className="mb-2 text-xs uppercase tracking-[0.22em] text-zinc-500">
              Saved session
            </p>

            <h2 className="mb-3 text-xl font-medium">
              Unlock Loombus with Face ID.
            </h2>

            <p className="mb-5 text-sm leading-relaxed text-zinc-500">
              A saved Loombus session exists on this device. Use Face ID, Touch ID,
              fingerprint, or your device passcode to continue.
            </p>

            <button
              type="button"
              onClick={() =>
                void redirectWithOptionalBiometric("Unlock Loombus to continue.")
              }
              disabled={biometricUnlocking}
              className="mb-3 w-full rounded-full bg-white px-6 py-3 text-sm font-medium text-black transition hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {biometricUnlocking ? "Unlocking..." : "Unlock with Face ID"}
            </button>

            <button
              type="button"
              onClick={() => void handleUseAnotherAccount()}
              className="w-full rounded-full border border-zinc-800 px-6 py-3 text-sm font-medium text-zinc-400 transition hover:border-zinc-600 hover:text-white"
            >
              Use another account
            </button>
          </div>
        ) : checkingBiometricSession ? (
          <p className="mb-6 text-sm text-zinc-600">
            Checking this device for a saved Loombus session...
          </p>
        ) : null}

        <div className="mb-6 rounded-3xl border border-zinc-800 bg-zinc-950 p-6 shadow-2xl shadow-black/30">
          <button
            type="button"
            onClick={() => handleOAuthLogin("apple")}
            disabled={loading || Boolean(oauthLoading)}
            className="mb-3 w-full rounded-full bg-white px-6 py-3 text-sm font-medium text-black transition hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {oauthLoading === "apple" ? "Opening Apple..." : "Continue with Apple"}
          </button>

          <button
            type="button"
            onClick={() => handleOAuthLogin("google")}
            disabled={loading || Boolean(oauthLoading)}
            className="w-full rounded-full bg-white px-6 py-3 text-sm font-medium text-black transition hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-60"
          >
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
            <label className="mb-2 block text-sm text-zinc-400">Email</label>
            <input
                type="email"
              value={email}
              autoComplete="email"
              required
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-xl border border-zinc-800 bg-black px-4 py-3 text-white outline-none focus:border-zinc-500"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm text-zinc-400">Password</label>
            <input
              type="password"
              value={password}
              autoComplete="current-password"
              required
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-xl border border-zinc-800 bg-black px-4 py-3 text-white outline-none focus:border-zinc-500"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-full bg-white px-6 py-3 text-black transition hover:bg-zinc-200 disabled:opacity-50"
          >
            {loading ? "Logging in..." : "Log In"}
          </button>

          {message && <p className="text-sm text-zinc-400">{message}</p>}

          <p className="text-xs leading-relaxed text-zinc-500">
            By logging in or continuing with Apple, Google, or email, you agree to the{" "}
            <Link href="/terms" className="text-zinc-400 underline-offset-4 hover:underline">
              Terms
            </Link>
            ,{" "}
            <Link href="/privacy" className="text-zinc-400 underline-offset-4 hover:underline">
              Privacy Policy
            </Link>
            ,{" "}
            <Link href="/cookies" className="text-zinc-400 underline-offset-4 hover:underline">
              Cookie Use
            </Link>
            ,{" "}
            <Link href="/guidelines" className="text-zinc-400 underline-offset-4 hover:underline">
              Community Guidelines
            </Link>
            ,{" "}
            <Link href="/safety" className="text-zinc-400 underline-offset-4 hover:underline">
              Safety
            </Link>
            , and{" "}
            <Link href="/contact" className="text-zinc-400 underline-offset-4 hover:underline">
              Contact
            </Link>
            .
          </p>

          <p className="pt-1 text-center text-sm text-zinc-500">
            Don’t have an account?{" "}
            <Link
              href="/signup"
              className="text-zinc-300 underline decoration-zinc-700 underline-offset-4 transition hover:text-white hover:decoration-white"
            >
              Create one
            </Link>
          </p>
        </form>
      </div>
    </main>
  );
}
