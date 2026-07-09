"use client";

import Link from "next/link";
import { type FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { isIosNativeApp, isNativeApp } from "@/lib/native-app";
import {
  deleteNativeBiometricLoginCredentials,
  getNativeBiometricLoginCredentials,
  getRememberedBiometricLoginEmail,
  isNativeBiometricLoginSaved,
  saveNativeBiometricLoginCredentials,
} from "@/lib/native-biometric";

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

type MobileAuthSheet = "join" | "return";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState<"google" | "apple" | null>(
    null
  );

  const [biometricLoginReady, setBiometricLoginReady] = useState(false);
  const [rememberedBiometricEmail, setRememberedBiometricEmail] = useState("");
  const [checkingBiometricLogin, setCheckingBiometricLogin] = useState(true);
  const [biometricSigningIn, setBiometricSigningIn] = useState(false);
  const [showManualLogin, setShowManualLogin] = useState(false);
  const [nativeApp, setNativeApp] = useState<boolean | null>(null);
  const [mobileAuthSheet, setMobileAuthSheet] =
    useState<MobileAuthSheet | null>(null);
  const [mobileEmailLoginVisible, setMobileEmailLoginVisible] = useState(false);

  const autoBiometricStarted = useRef(false);

  useEffect(() => {
    setNativeApp(isNativeApp());
  }, []);

  const getNextPath = useCallback(() => {
    const params = new URLSearchParams(window.location.search);
    return getSafeNext(params.get("next"));
  }, []);

  const refreshBiometricLoginState = useCallback(async () => {
    if (!isNativeApp()) {
      setBiometricLoginReady(false);
      setRememberedBiometricEmail("");
      setCheckingBiometricLogin(false);
      return;
    }

    setCheckingBiometricLogin(true);
    const saved = await isNativeBiometricLoginSaved();

    setBiometricLoginReady(saved);
    setRememberedBiometricEmail(saved ? getRememberedBiometricLoginEmail() : "");
    setCheckingBiometricLogin(false);
  }, []);

  const signInWithSavedBiometricLogin = useCallback(async () => {
    if (loading || biometricSigningIn) {
      return;
    }

    setMessage("");
    setBiometricSigningIn(true);
    setLoading(true);

    const credentials = await getNativeBiometricLoginCredentials();

    if (!credentials.ok || !credentials.username || !credentials.password) {
      setMessage(
        credentials.error ??
          "Saved biometric sign-in is incomplete. Sign in manually and save it again."
      );
      setBiometricSigningIn(false);
      setLoading(false);
      setShowManualLogin(false);
      return;
    }

    const { error } = await supabase.auth.signInWithPassword({
      email: credentials.username,
      password: credentials.password,
    });

    if (error) {
      setMessage(`Saved biometric sign-in failed: ${error.message}`);
      setBiometricSigningIn(false);
      setLoading(false);
      setShowManualLogin(true);
      return;
    }

    window.location.replace(getNextPath());
  }, [biometricSigningIn, getNextPath, loading]);

  useEffect(() => {
    let mounted = true;

    async function loadLoginState() {
      const { data } = await supabase.auth.getSession();

      if (!mounted) {
        return;
      }

      if (data.session) {
        window.location.replace(getNextPath());
        return;
      }

      await refreshBiometricLoginState();
    }

    void loadLoginState();

    return () => {
      mounted = false;
    };
  }, [getNextPath, refreshBiometricLoginState]);

  useEffect(() => {
    if (
      !biometricLoginReady ||
      checkingBiometricLogin ||
      biometricSigningIn ||
      loading ||
      showManualLogin
    ) {
      return;
    }

    if (autoBiometricStarted.current) {
      return;
    }

    autoBiometricStarted.current = true;
    void signInWithSavedBiometricLogin();
  }, [
    biometricLoginReady,
    biometricSigningIn,
    checkingBiometricLogin,
    loading,
    showManualLogin,
    signInWithSavedBiometricLogin,
  ]);

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
      setMessage(
        "Login succeeded, but the browser session was not ready. Please try again."
      );
      setLoading(false);
      return;
    }

    if (isNativeApp()) {
      const savedLoginAlready = await isNativeBiometricLoginSaved();

      if (!savedLoginAlready) {
        const shouldRemember = window.confirm(
          "Remember this login with Face ID on this device?"
        );

        if (shouldRemember) {
          const saved = await saveNativeBiometricLoginCredentials(
            email,
            password
          );

          if (!saved.ok) {
            setMessage(
              `Login successful, but biometric sign-in could not be saved: ${
                saved.error ?? "Unknown error"
              }`
            );
          }
        }
      }
    }

    window.location.replace(getNextPath());
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
      const message =
        error instanceof Error ? error.message : "Unable to start OAuth login.";
      setMessage(
        `${provider === "apple" ? "Apple" : "Google"} login error: ${message}`
      );
      setOauthLoading(null);
    }
  }

  async function handleForgetBiometricLogin() {
    setMessage("");
    await deleteNativeBiometricLoginCredentials();
    setBiometricLoginReady(false);
    setRememberedBiometricEmail("");
    setShowManualLogin(true);
  }

  const shouldShowManualLogin =
    !biometricLoginReady || showManualLogin || nativeApp !== true;

  return (
    <main className="min-h-screen bg-black px-6 py-16 text-white">
      <div className="mx-auto max-w-xl">
        <Link
          href="/"
          className="mb-12 inline-block text-sm text-zinc-500 hover:text-white"
        >
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

        {checkingBiometricLogin ? (
          <p className="mb-6 text-sm text-zinc-600">
            Checking this device for saved biometric sign-in...
          </p>
        ) : null}

        {biometricLoginReady ? (
          <div className="mb-6 rounded-3xl border border-zinc-800 bg-zinc-950 p-6 shadow-2xl shadow-black/30">
            <p className="mb-2 text-xs uppercase tracking-[0.22em] text-zinc-500">
              Saved biometric sign-in
            </p>

            <h2 className="mb-3 text-xl font-medium">
              Sign in with Face ID.
            </h2>

            <p className="mb-5 text-sm leading-relaxed text-zinc-500">
              Continue as{" "}
              <span className="text-zinc-300">
                {rememberedBiometricEmail || "the saved account"}
              </span>
              .
            </p>

            <button
              type="button"
              onClick={() => void signInWithSavedBiometricLogin()}
              disabled={loading || biometricSigningIn}
              className="mb-3 w-full rounded-full bg-white px-6 py-3 text-sm font-medium text-black transition hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {biometricSigningIn ? "Signing in..." : "Sign in with Face ID"}
            </button>

            <button
              type="button"
              onClick={() => {
                autoBiometricStarted.current = true;
                setShowManualLogin(true);
              }}
              disabled={loading || biometricSigningIn}
              className="mb-3 w-full rounded-full border border-zinc-800 px-6 py-3 text-sm font-medium text-zinc-400 transition hover:border-zinc-600 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              Use password instead
            </button>

            <button
              type="button"
              onClick={() => void handleForgetBiometricLogin()}
              disabled={loading || biometricSigningIn}
              className="w-full rounded-full border border-zinc-800 px-6 py-3 text-sm font-medium text-zinc-500 transition hover:border-zinc-600 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              Forget saved biometric sign-in
            </button>

            {message ? <p className="mt-4 text-sm text-zinc-400">{message}</p> : null}
          </div>
        ) : null}

        {shouldShowManualLogin ? (
          <>
            <div className="space-y-4 md:hidden">
              <div className="rounded-3xl border border-zinc-800 bg-zinc-950 p-6 shadow-2xl shadow-black/30">
                <p className="mb-2 text-xs uppercase tracking-[0.22em] text-zinc-500">
                  New to Loombus
                </p>
                <h2 className="mb-3 text-2xl font-semibold tracking-tight">
                  Join the conversation.
                </h2>
                <p className="mb-5 text-sm leading-relaxed text-zinc-500">
                  Join a calmer, higher-signal environment for thoughtful discussion.
                </p>
                <button
                  type="button"
                  onClick={() => setMobileAuthSheet("join")}
                  className="w-full rounded-full bg-white px-6 py-3 text-sm font-medium text-black transition hover:bg-zinc-200"
                >
                  Join the conversation
                </button>
              </div>

              <div className="rounded-3xl border border-zinc-800 bg-zinc-950 p-6 shadow-2xl shadow-black/30">
                <p className="mb-2 text-xs uppercase tracking-[0.22em] text-zinc-500">
                  Already a member
                </p>
                <h2 className="mb-3 text-2xl font-semibold tracking-tight">
                  Return to Loombus.
                </h2>
                <p className="mb-5 text-sm leading-relaxed text-zinc-500">
                  Return to your high-signal discussion environment.
                </p>
                <button
                  type="button"
                  onClick={() => setMobileAuthSheet("return")}
                  className="w-full rounded-full bg-white px-6 py-3 text-sm font-medium text-black transition hover:bg-zinc-200"
                >
                  Return to Loombus
                </button>
              </div>

              {mobileEmailLoginVisible ? (
                <form
                  onSubmit={handleLogin}
                  className="space-y-5 rounded-3xl border border-zinc-800 bg-zinc-950 p-6 shadow-2xl shadow-black/30"
                >
                  <div>
                    <label className="mb-2 block text-sm text-zinc-400">
                      Email
                    </label>
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
                    <label className="mb-2 block text-sm text-zinc-400">
                      Password
                    </label>
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
                    {loading ? "Logging in..." : "Sign in with email"}
                  </button>

                  {message && <p className="text-sm text-zinc-400">{message}</p>}
                </form>
              ) : null}
            </div>

            {mobileAuthSheet ? (
              <div className="fixed inset-0 z-50 flex items-end bg-black/70 px-4 pb-4 md:hidden">
                <div className="w-full rounded-[2rem] border border-zinc-800 bg-zinc-950 p-6 shadow-2xl shadow-black/50">
                  <div className="mb-5 flex items-start justify-between gap-4">
                    <div>
                      <p className="mb-2 text-xs uppercase tracking-[0.22em] text-zinc-500">
                        {mobileAuthSheet === "join" ? "Join Loombus" : "Return to Loombus"}
                      </p>
                      <h2 className="text-2xl font-semibold tracking-tight">
                        {mobileAuthSheet === "join"
                          ? "Join the conversation."
                          : "Welcome back."}
                      </h2>
                      <p className="mt-3 text-sm leading-relaxed text-zinc-500">
                        {mobileAuthSheet === "join"
                          ? "Join a calmer, higher-signal environment for thoughtful discussion."
                          : "Return to your high-signal discussion environment."}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => setMobileAuthSheet(null)}
                      className="rounded-full border border-zinc-800 px-3 py-1 text-sm text-zinc-500"
                    >
                      Close
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleOAuthLogin("google")}
                    disabled={loading || Boolean(oauthLoading)}
                    className="mb-3 w-full rounded-full bg-white px-6 py-3 text-sm font-medium text-black transition hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {oauthLoading === "google"
                      ? "Opening Google..."
                      : mobileAuthSheet === "join"
                        ? "Sign up with Google"
                        : "Continue with Google"}
                  </button>

                  <button
                    type="button"
                    onClick={() => handleOAuthLogin("apple")}
                    disabled={loading || Boolean(oauthLoading)}
                    className="mb-3 w-full rounded-full bg-white px-6 py-3 text-sm font-medium text-black transition hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {oauthLoading === "apple"
                      ? "Opening Apple..."
                      : mobileAuthSheet === "join"
                        ? "Sign up with Apple"
                        : "Continue with Apple"}
                  </button>

                  {mobileAuthSheet === "join" ? (
                    <Link
                      href="/signup"
                      className="block w-full rounded-full border border-zinc-800 px-6 py-3 text-center text-sm font-medium text-zinc-300 transition hover:border-zinc-600 hover:text-white"
                    >
                      Sign up with email
                    </Link>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        setMobileAuthSheet(null);
                        setMobileEmailLoginVisible(true);
                      }}
                      className="w-full rounded-full border border-zinc-800 px-6 py-3 text-sm font-medium text-zinc-300 transition hover:border-zinc-600 hover:text-white"
                    >
                      Sign in with email
                    </button>
                  )}

                  {message ? <p className="mt-4 text-sm text-zinc-400">{message}</p> : null}
                </div>
              </div>
            ) : null}

            <div className="hidden md:block">
            <div className="mb-6 rounded-3xl border border-zinc-800 bg-zinc-950 p-6 shadow-2xl shadow-black/30">
              <button
                type="button"
                onClick={() => handleOAuthLogin("apple")}
                disabled={loading || Boolean(oauthLoading)}
                className="mb-3 w-full rounded-full bg-white px-6 py-3 text-sm font-medium text-black transition hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {oauthLoading === "apple"
                  ? "Opening Apple..."
                  : "Continue with Apple"}
              </button>

              <button
                type="button"
                onClick={() => handleOAuthLogin("google")}
                disabled={loading || Boolean(oauthLoading)}
                className="w-full rounded-full bg-white px-6 py-3 text-sm font-medium text-black transition hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {oauthLoading === "google"
                  ? "Opening Google..."
                  : "Continue with Google"}
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
                <label className="mb-2 block text-sm text-zinc-400">
                  Email
                </label>
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
                <label className="mb-2 block text-sm text-zinc-400">
                  Password
                </label>
                <input
                  type="password"
                  value={password}
                  autoComplete="current-password"
                  required
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-xl border border-zinc-800 bg-black px-4 py-3 text-white outline-none focus:border-zinc-500"
                />
              </div>

              {nativeApp === true ? (
                <p className="rounded-2xl border border-zinc-900 bg-black p-4 text-xs leading-relaxed text-zinc-500">
                  After a successful email login, Loombus can ask whether you
                  want to save this login with Face ID or device biometrics on
                  this device.
                </p>
              ) : null}

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-full bg-white px-6 py-3 text-black transition hover:bg-zinc-200 disabled:opacity-50"
              >
                {loading ? "Logging in..." : "Log In"}
              </button>

              {message && <p className="text-sm text-zinc-400">{message}</p>}

              <p className="text-xs leading-relaxed text-zinc-500">
                By logging in or continuing with Apple, Google, or email, you
                agree to the{" "}
                <Link
                  href="/terms"
                  className="text-zinc-400 underline-offset-4 hover:underline"
                >
                  Terms
                </Link>
                ,{" "}
                <Link
                  href="/privacy"
                  className="text-zinc-400 underline-offset-4 hover:underline"
                >
                  Privacy Policy
                </Link>
                ,{" "}
                <Link
                  href="/cookies"
                  className="text-zinc-400 underline-offset-4 hover:underline"
                >
                  Cookie Use
                </Link>
                ,{" "}
                <Link
                  href="/guidelines"
                  className="text-zinc-400 underline-offset-4 hover:underline"
                >
                  Community Guidelines
                </Link>
                ,{" "}
                <Link
                  href="/safety"
                  className="text-zinc-400 underline-offset-4 hover:underline"
                >
                  Safety
                </Link>
                , and{" "}
                <Link
                  href="/contact"
                  className="text-zinc-400 underline-offset-4 hover:underline"
                >
                  Contact
                </Link>
                .
              </p>

              <p className="text-center text-sm text-zinc-500">
                Don’t have an account?{" "}
                <Link
                  href="/signup"
                  className="text-zinc-300 underline underline-offset-4 hover:text-white"
                >
                  Create one
                </Link>
              </p>
            </form>
            </div>
          </>
        ) : null}
      </div>
    </main>
  );
}
