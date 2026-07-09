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

  const panelClass =
    "rounded-[2rem] border border-[color:var(--loombus-border)] bg-[color:var(--loombus-surface)] p-6 shadow-2xl shadow-black/10 md:p-7";
  const compactPanelClass =
    "rounded-3xl border border-[color:var(--loombus-border)] bg-[color:var(--loombus-surface)] p-6 shadow-2xl shadow-black/10";
  const eyebrowClass =
    "mb-2 text-xs font-semibold uppercase tracking-[0.24em] text-[color:var(--loombus-text-subtle)]";
  const mutedTextClass = "text-[color:var(--loombus-text-muted)]";
  const primaryButtonClass =
    "w-full rounded-full bg-[color:var(--loombus-primary-bg)] px-6 py-3 text-sm font-semibold text-[color:var(--loombus-primary-text)] transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60";
  const secondaryButtonClass =
    "w-full rounded-full border border-[color:var(--loombus-border)] px-6 py-3 text-sm font-semibold text-[color:var(--loombus-text)] transition hover:border-[color:var(--loombus-text-subtle)] disabled:cursor-not-allowed disabled:opacity-50";
  const labelClass =
    "mb-2 block text-sm font-medium text-[color:var(--loombus-text-muted)]";
  const inputClass =
    "w-full rounded-2xl border border-[color:var(--loombus-border)] bg-[color:var(--loombus-page-bg)] px-4 py-3 text-[color:var(--loombus-text)] outline-none transition focus:border-[color:var(--loombus-text-subtle)] focus:ring-4 focus:ring-black/5";
  const legalLinkClass =
    "text-[color:var(--loombus-text)] underline-offset-4 hover:underline";

  return (
    <main className="relative min-h-screen overflow-hidden bg-[color:var(--loombus-page-bg)] px-5 py-6 text-[color:var(--loombus-text)] sm:px-8 lg:px-12">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_12%_8%,rgba(214,166,94,0.14),transparent_32%),radial-gradient(circle_at_88%_10%,rgba(148,163,184,0.18),transparent_34%)]"
      />

      <div className="relative mx-auto flex min-h-[calc(100vh-3rem)] max-w-7xl flex-col">
        <header className="flex items-center justify-between gap-6 py-2">
          <Link href="/" className="flex items-center gap-3 font-semibold tracking-tight">
            <span className="flex h-8 w-8 items-center justify-center rounded-2xl border border-[color:var(--loombus-border)] text-sm text-[#c17a2b]">
              L
            </span>
            <span>Loombus</span>
          </Link>

          <Link
            href="/signup"
            className="rounded-full border border-[color:var(--loombus-border)] px-5 py-2.5 text-sm font-semibold text-[color:var(--loombus-text)] transition hover:border-[color:var(--loombus-text-subtle)]"
          >
            Join Loombus
          </Link>
        </header>

        <section className="grid flex-1 items-center gap-12 py-12 lg:grid-cols-[minmax(0,0.92fr)_minmax(420px,520px)] lg:py-16">
          <div className="max-w-2xl">
            <p className="mb-4 text-xs font-semibold uppercase tracking-[0.32em] text-[color:var(--loombus-text-subtle)]">
              Loombus
            </p>

            <h1 className="max-w-3xl text-5xl font-semibold tracking-[-0.06em] text-[color:var(--loombus-text)] sm:text-6xl lg:text-7xl">
              Log in.
            </h1>

            <p className="mt-6 max-w-xl text-lg leading-8 text-[color:var(--loombus-text-muted)]">
              Return to your high-signal discussion environment with a cleaner,
              quieter way back into the conversations that matter.
            </p>

            <div className="mt-10 grid gap-4 sm:grid-cols-3">
              <div className="rounded-3xl border border-[color:var(--loombus-border)] bg-[color:var(--loombus-surface)] p-5 shadow-xl shadow-black/5">
                <p className={eyebrowClass}>Signal</p>
                <p className="text-sm leading-6 text-[color:var(--loombus-text-muted)]">
                  Pick up where focused discussions left off.
                </p>
              </div>
              <div className="rounded-3xl border border-[color:var(--loombus-border)] bg-[color:var(--loombus-surface)] p-5 shadow-xl shadow-black/5">
                <p className={eyebrowClass}>Context</p>
                <p className="text-sm leading-6 text-[color:var(--loombus-text-muted)]">
                  Return to saved ideas, replies, and topics.
                </p>
              </div>
              <div className="rounded-3xl border border-[color:var(--loombus-border)] bg-[color:var(--loombus-surface)] p-5 shadow-xl shadow-black/5">
                <p className={eyebrowClass}>Clarity</p>
                <p className="text-sm leading-6 text-[color:var(--loombus-text-muted)]">
                  Fewer distractions, stronger navigation.
                </p>
              </div>
            </div>
          </div>

          <div className="w-full">
            {checkingBiometricLogin ? (
              <p className="mb-5 rounded-full border border-[color:var(--loombus-border)] bg-[color:var(--loombus-surface)] px-5 py-3 text-sm text-[color:var(--loombus-text-muted)] shadow-xl shadow-black/5">
                Checking this device for saved biometric sign-in...
              </p>
            ) : null}

            {biometricLoginReady ? (
              <div className={`mb-5 ${panelClass}`}>
                <p className={eyebrowClass}>Saved biometric sign-in</p>

                <h2 className="mb-3 text-2xl font-semibold tracking-tight text-[color:var(--loombus-text)]">
                  Sign in with Face ID.
                </h2>

                <p className="mb-5 text-sm leading-6 text-[color:var(--loombus-text-muted)]">
                  Continue as{" "}
                  <span className="font-medium text-[color:var(--loombus-text)]">
                    {rememberedBiometricEmail || "the saved account"}
                  </span>
                  .
                </p>

                <button
                  type="button"
                  onClick={() => void signInWithSavedBiometricLogin()}
                  disabled={loading || biometricSigningIn}
                  className={`mb-3 ${primaryButtonClass}`}
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
                  className={`mb-3 ${secondaryButtonClass}`}
                >
                  Use password instead
                </button>

                <button
                  type="button"
                  onClick={() => void handleForgetBiometricLogin()}
                  disabled={loading || biometricSigningIn}
                  className={secondaryButtonClass}
                >
                  Forget saved biometric sign-in
                </button>

                {message ? (
                  <p className="mt-4 text-sm leading-6 text-[color:var(--loombus-text-muted)]">
                    {message}
                  </p>
                ) : null}
              </div>
            ) : null}

            {shouldShowManualLogin ? (
              <>
                <div className="space-y-4 md:hidden">
                  <div className={compactPanelClass}>
                    <p className={eyebrowClass}>New to Loombus</p>
                    <h2 className="mb-3 text-2xl font-semibold tracking-tight text-[color:var(--loombus-text)]">
                      Join the conversation.
                    </h2>
                    <p className="mb-5 text-sm leading-6 text-[color:var(--loombus-text-muted)]">
                      Join a calmer, higher-signal environment for thoughtful discussion.
                    </p>
                    <button
                      type="button"
                      onClick={() => setMobileAuthSheet("join")}
                      className={primaryButtonClass}
                    >
                      Join the conversation
                    </button>
                  </div>

                  <div className={compactPanelClass}>
                    <p className={eyebrowClass}>Already a member</p>
                    <h2 className="mb-3 text-2xl font-semibold tracking-tight text-[color:var(--loombus-text)]">
                      Return to Loombus.
                    </h2>
                    <p className="mb-5 text-sm leading-6 text-[color:var(--loombus-text-muted)]">
                      Return to your high-signal discussion environment.
                    </p>
                    <button
                      type="button"
                      onClick={() => setMobileAuthSheet("return")}
                      className={primaryButtonClass}
                    >
                      Return to Loombus
                    </button>
                  </div>

                  {mobileEmailLoginVisible ? (
                    <form onSubmit={handleLogin} className={`space-y-5 ${compactPanelClass}`}>
                      <div>
                        <label className={labelClass}>Email</label>
                        <input
                          type="email"
                          value={email}
                          autoComplete="email"
                          required
                          onChange={(e) => setEmail(e.target.value)}
                          className={inputClass}
                        />
                      </div>

                      <div>
                        <label className={labelClass}>Password</label>
                        <input
                          type="password"
                          value={password}
                          autoComplete="current-password"
                          required
                          onChange={(e) => setPassword(e.target.value)}
                          className={inputClass}
                        />
                      </div>

                      <button type="submit" disabled={loading} className={primaryButtonClass}>
                        {loading ? "Logging in..." : "Sign in with email"}
                      </button>

                      {message ? (
                        <p className="text-sm leading-6 text-[color:var(--loombus-text-muted)]">
                          {message}
                        </p>
                      ) : null}
                    </form>
                  ) : null}
                </div>

                {mobileAuthSheet ? (
                  <div className="fixed inset-0 z-50 flex items-end bg-black/70 px-4 pb-4 md:hidden">
                    <div className={`w-full ${panelClass}`}>
                      <div className="mb-5 flex items-start justify-between gap-4">
                        <div>
                          <p className={eyebrowClass}>
                            {mobileAuthSheet === "join" ? "Join Loombus" : "Return to Loombus"}
                          </p>
                          <h2 className="text-2xl font-semibold tracking-tight text-[color:var(--loombus-text)]">
                            {mobileAuthSheet === "join"
                              ? "Join the conversation."
                              : "Welcome back."}
                          </h2>
                          <p className="mt-3 text-sm leading-6 text-[color:var(--loombus-text-muted)]">
                            {mobileAuthSheet === "join"
                              ? "Join a calmer, higher-signal environment for thoughtful discussion."
                              : "Return to your high-signal discussion environment."}
                          </p>
                        </div>

                        <button
                          type="button"
                          onClick={() => setMobileAuthSheet(null)}
                          className="rounded-full border border-[color:var(--loombus-border)] px-3 py-1 text-sm text-[color:var(--loombus-text-muted)]"
                        >
                          Close
                        </button>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleOAuthLogin("google")}
                        disabled={loading || Boolean(oauthLoading)}
                        className={`mb-3 ${primaryButtonClass}`}
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
                        className={`mb-3 ${primaryButtonClass}`}
                      >
                        {oauthLoading === "apple"
                          ? "Opening Apple..."
                          : mobileAuthSheet === "join"
                            ? "Sign up with Apple"
                            : "Continue with Apple"}
                      </button>

                      {mobileAuthSheet === "join" ? (
                        <Link href="/signup" className={`block text-center ${secondaryButtonClass}`}>
                          Sign up with email
                        </Link>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            setMobileAuthSheet(null);
                            setMobileEmailLoginVisible(true);
                          }}
                          className={secondaryButtonClass}
                        >
                          Sign in with email
                        </button>
                      )}

                      {message ? (
                        <p className="mt-4 text-sm leading-6 text-[color:var(--loombus-text-muted)]">
                          {message}
                        </p>
                      ) : null}
                    </div>
                  </div>
                ) : null}

                <div className="hidden md:block">
                  <div className={`mb-5 ${panelClass}`}>
                    <button
                      type="button"
                      onClick={() => handleOAuthLogin("apple")}
                      disabled={loading || Boolean(oauthLoading)}
                      className={`mb-3 ${primaryButtonClass}`}
                    >
                      {oauthLoading === "apple" ? "Opening Apple..." : "Continue with Apple"}
                    </button>

                    <button
                      type="button"
                      onClick={() => handleOAuthLogin("google")}
                      disabled={loading || Boolean(oauthLoading)}
                      className={primaryButtonClass}
                    >
                      {oauthLoading === "google" ? "Opening Google..." : "Continue with Google"}
                    </button>

                    <div className="mt-5 flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.22em] text-[color:var(--loombus-text-subtle)]">
                      <span className="h-px flex-1 bg-[color:var(--loombus-border-muted)]" />
                      Or log in with email
                      <span className="h-px flex-1 bg-[color:var(--loombus-border-muted)]" />
                    </div>
                  </div>

                  <form onSubmit={handleLogin} className={`space-y-5 ${panelClass}`}>
                    <div>
                      <label className={labelClass}>Email</label>
                      <input
                        type="email"
                        value={email}
                        autoComplete="email"
                        required
                        onChange={(e) => setEmail(e.target.value)}
                        className={inputClass}
                      />
                    </div>

                    <div>
                      <label className={labelClass}>Password</label>
                      <input
                        type="password"
                        value={password}
                        autoComplete="current-password"
                        required
                        onChange={(e) => setPassword(e.target.value)}
                        className={inputClass}
                      />
                    </div>

                    {nativeApp === true ? (
                      <p className="rounded-2xl border border-[color:var(--loombus-border-muted)] bg-[color:var(--loombus-page-bg)] p-4 text-xs leading-6 text-[color:var(--loombus-text-muted)]">
                        After a successful email login, Loombus can ask whether you
                        want to save this login with Face ID or device biometrics on
                        this device.
                      </p>
                    ) : null}

                    <button type="submit" disabled={loading} className={primaryButtonClass}>
                      {loading ? "Logging in..." : "Log In"}
                    </button>

                    {message ? (
                      <p className="text-sm leading-6 text-[color:var(--loombus-text-muted)]">
                        {message}
                      </p>
                    ) : null}

                    <p className="text-xs leading-6 text-[color:var(--loombus-text-muted)]">
                      By logging in or continuing with Apple, Google, or email, you
                      agree to the{" "}
                      <Link href="/terms" className={legalLinkClass}>
                        Terms
                      </Link>
                      ,{" "}
                      <Link href="/privacy" className={legalLinkClass}>
                        Privacy Policy
                      </Link>
                      ,{" "}
                      <Link href="/cookies" className={legalLinkClass}>
                        Cookie Use
                      </Link>
                      ,{" "}
                      <Link href="/guidelines" className={legalLinkClass}>
                        Community Guidelines
                      </Link>
                      ,{" "}
                      <Link href="/safety" className={legalLinkClass}>
                        Safety
                      </Link>
                      , and{" "}
                      <Link href="/contact" className={legalLinkClass}>
                        Contact
                      </Link>
                      .
                    </p>

                    <p className={`text-center text-sm ${mutedTextClass}`}>
                      Don’t have an account?{" "}
                      <Link
                        href="/signup"
                        className="font-medium text-[color:var(--loombus-text)] underline underline-offset-4"
                      >
                        Create one
                      </Link>
                    </p>
                  </form>
                </div>
              </>
            ) : null}
          </div>
        </section>
      </div>
    </main>
  );
}
