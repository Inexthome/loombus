"use client";

import Link from "next/link";
import { type FormEvent, useCallback, useEffect, useState } from "react";
import { AppleLogoMark, GoogleLogoMark } from "@/components/auth-provider-icons";
import { DateOfBirthSelect } from "@/components/date-of-birth-select";
import { getAgeBandFromDateOfBirth } from "@/lib/age-safety";
import { isIosNativeApp } from "@/lib/native-app";
import { supabase } from "@/lib/supabase/client";

type V2EntryMode = "login" | "signup" | "reset";

const V2_HOME_PATH = "/v2";

function getOAuthRedirectTo() {
  const encodedHomePath = encodeURIComponent(V2_HOME_PATH);

  if (isIosNativeApp()) {
    return `loombus://auth/callback?next=${encodedHomePath}`;
  }

  return `${window.location.origin}/auth/callback?next=${encodedHomePath}`;
}

function getModeCopy(mode: V2EntryMode) {
  if (mode === "signup") {
    return {
      title: "Create your account",
      subtitle: "Join Loombus in one simple step.",
      submit: "Create account",
      loading: "Creating account...",
    };
  }

  if (mode === "reset") {
    return {
      title: "Reset your password",
      subtitle: "Enter your email and Loombus will send a reset link.",
      submit: "Send reset link",
      loading: "Sending reset link...",
    };
  }

  return {
    title: "Welcome back",
    subtitle: "Log in to continue to Loombus.",
    submit: "Log in",
    loading: "Logging in...",
  };
}

function BrandHeader() {
  return (
    <div className="mb-8 text-center">
      <Link href="/" className="inline-flex flex-col items-center gap-3">
        <img src="/assets/brand/loombus-mark-transparent.png" alt="Loombus" className="size-20 object-contain drop-shadow-sm" />
        <span className="text-5xl font-black tracking-tight text-[#07133d]">Loombus</span>
        <span className="text-base font-black text-blue-700">Signal over Noise</span>
      </Link>
    </div>
  );
}

function Divider({ label }: { label: string }) {
  return (
    <div className="my-6 flex items-center gap-4 text-sm font-semibold text-slate-500">
      <span className="h-px flex-1 bg-slate-200" />
      <span>{label}</span>
      <span className="h-px flex-1 bg-slate-200" />
    </div>
  );
}

function V2EntryShell({ children, footer }: { children: React.ReactNode; footer: React.ReactNode }) {
  return (
    <main className="relative min-h-screen overflow-hidden bg-[#f7fbff] px-4 py-10 text-slate-950 sm:px-6">
      <div className="pointer-events-none absolute -left-24 top-1/3 size-72 rounded-full border-[42px] border-blue-100/70" />
      <div className="pointer-events-none absolute -right-24 bottom-10 size-72 rounded-full border-[42px] border-blue-100/70" />
      <div className="relative mx-auto flex min-h-[calc(100vh-5rem)] max-w-xl flex-col justify-center">
        <BrandHeader />
        <section className="rounded-[2rem] border border-slate-200 bg-white/95 p-6 shadow-[0_24px_70px_rgba(15,23,42,0.13)] backdrop-blur sm:p-8">
          {children}
        </section>
        <div className="mt-7 text-center text-sm text-slate-500">{footer}</div>
      </div>
    </main>
  );
}

export function V2EntryPage({ mode }: { mode: V2EntryMode }) {
  const copy = getModeCopy(mode);
  const [fullName, setFullName] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [message, setMessage] = useState("");
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState<"google" | "apple" | null>(null);
  const [hasRecoverySession, setHasRecoverySession] = useState(false);

  const checkRecoverySession = useCallback(async () => {
    if (mode !== "reset") return;
    const { data } = await supabase.auth.getSession();
    setHasRecoverySession(Boolean(data.session));
  }, [mode]);

  useEffect(() => {
    async function redirectIfAlreadySignedIn() {
      const { data } = await supabase.auth.getSession();

      if (mode !== "reset" && data.session) {
        window.location.replace(V2_HOME_PATH);
        return;
      }

      if (mode === "reset") {
        setHasRecoverySession(Boolean(data.session));
      }
    }

    void redirectIfAlreadySignedIn();
    void checkRecoverySession();
  }, [checkRecoverySession, mode]);

  async function handleOAuth(provider: "google" | "apple") {
    if (loading || oauthLoading) return;

    if (mode === "signup" && isIosNativeApp()) {
      setMessage("Use email and password to create an account inside the Loombus iOS app. Apple and Google signup remain available on the web.");
      return;
    }

    setMessage("");
    setOauthLoading(provider);

    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: getOAuthRedirectTo(),
        },
      });

      if (error) {
        setMessage(`${provider === "apple" ? "Apple" : "Google"} error: ${error.message}`);
        setOauthLoading(null);
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to start sign-in.");
      setOauthLoading(null);
    }
  }

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading) return;

    setLoading(true);
    setMessage("");

    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      setMessage(`Error: ${error.message}`);
      setLoading(false);
      return;
    }

    window.location.replace(V2_HOME_PATH);
  }

  async function handleSignup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading) return;

    setMessage("");
    setSuccess(false);

    if (password !== confirmPassword) {
      setMessage("Passwords do not match.");
      return;
    }

    const ageBand = getAgeBandFromDateOfBirth(dateOfBirth);

    if (!ageBand) {
      setMessage("Enter a valid date of birth.");
      return;
    }

    if (ageBand === "under_13") {
      setMessage("Loombus is not available to members under 13.");
      return;
    }

    setLoading(true);

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(V2_HOME_PATH)}`,
        data: {
          full_name: fullName.trim(),
          date_of_birth: dateOfBirth,
        },
      },
    });

    if (error) {
      const publicMessage = error.message.toLowerCase().includes("sending confirmation email")
        ? "Loombus could not send the confirmation email. Please try Google signup or contact support if this continues."
        : error.message;

      setMessage(`Error: ${publicMessage}`);
      setLoading(false);
      return;
    }

    setSuccess(true);
    setPassword("");
    setConfirmPassword("");
    setMessage("Account created. Check your email to confirm your account.");
    setLoading(false);
  }

  async function handleReset(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading) return;

    setLoading(true);
    setMessage("");
    setSuccess(false);

    if (hasRecoverySession) {
      const { error } = await supabase.auth.updateUser({ password: newPassword });

      if (error) {
        setMessage(`Error: ${error.message}`);
        setLoading(false);
        return;
      }

      setSuccess(true);
      setNewPassword("");
      setMessage("Password updated. You can continue to Loombus.");
      setLoading(false);
      return;
    }

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/v2/reset-password`,
    });

    if (error) {
      setMessage(`Error: ${error.message}`);
      setLoading(false);
      return;
    }

    setSuccess(true);
    setMessage("Reset link sent. Check your email.");
    setLoading(false);
  }

  if (mode === "reset") {
    return (
      <V2EntryShell
        footer={
          <>
            <Link href="/privacy" className="font-bold text-blue-700 hover:text-blue-900">Privacy Policy</Link>
            <span className="mx-2">•</span>
            <Link href="/terms" className="font-bold text-blue-700 hover:text-blue-900">Terms of Service</Link>
          </>
        }
      >
        <div className="text-center">
          <h1 className="text-3xl font-black tracking-tight text-slate-950">{hasRecoverySession ? "Choose a new password" : copy.title}</h1>
          <p className="mt-3 text-base text-slate-600">{hasRecoverySession ? "Enter your new password below." : copy.subtitle}</p>
        </div>
        <form onSubmit={handleReset} className="mt-8 space-y-5">
          {hasRecoverySession ? (
            <div>
              <label className="mb-2 block text-sm font-black text-slate-800">New password</label>
              <input
                type="password"
                value={newPassword}
                minLength={6}
                autoComplete="new-password"
                required
                onChange={(event) => setNewPassword(event.target.value)}
                placeholder="Enter your new password"
                className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-4 text-base outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
              />
            </div>
          ) : (
            <div>
              <label className="mb-2 block text-sm font-black text-slate-800">Email</label>
              <input
                type="email"
                value={email}
                autoComplete="email"
                required
                onChange={(event) => setEmail(event.target.value)}
                placeholder="Enter your email"
                className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-4 text-base outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
              />
            </div>
          )}
          <button type="submit" disabled={loading} className="w-full rounded-2xl bg-blue-600 px-6 py-4 text-base font-black text-white shadow-lg shadow-blue-600/20 transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60">
            {loading ? copy.loading : hasRecoverySession ? "Update password" : copy.submit}
          </button>
          {message && <p className={`text-center text-sm font-semibold ${success ? "text-emerald-700" : "text-red-600"}`}>{message}</p>}
        </form>
        <p className="mt-6 text-center text-sm text-slate-600">
          <Link href="/v2/login" className="font-black text-blue-700 hover:text-blue-900">Back to login</Link>
        </p>
      </V2EntryShell>
    );
  }

  return (
    <V2EntryShell
      footer={
        <>
          <p className="mb-2 font-semibold text-slate-500">Your data is private and secure</p>
          <Link href="/privacy" className="font-bold text-blue-700 hover:text-blue-900">Privacy Policy</Link>
          <span className="mx-2">•</span>
          <Link href="/terms" className="font-bold text-blue-700 hover:text-blue-900">Terms of Service</Link>
        </>
      }
    >
      <div className="text-center">
        <h1 className="text-3xl font-black tracking-tight text-slate-950">{copy.title}</h1>
        <p className="mt-3 text-base text-slate-600">{copy.subtitle}</p>
      </div>

      {!success && (
        <div className="mt-8 space-y-3">
          <button
            type="button"
            onClick={() => void handleOAuth("apple")}
            disabled={loading || Boolean(oauthLoading)}
            className="inline-flex w-full items-center justify-center gap-3 rounded-2xl border border-slate-300 bg-white px-5 py-4 text-base font-black text-slate-950 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <AppleLogoMark className="size-5" />
            <span>{oauthLoading === "apple" ? "Opening Apple..." : "Continue with Apple"}</span>
          </button>
          <button
            type="button"
            onClick={() => void handleOAuth("google")}
            disabled={loading || Boolean(oauthLoading)}
            className="inline-flex w-full items-center justify-center gap-3 rounded-2xl border border-slate-300 bg-white px-5 py-4 text-base font-black text-slate-950 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <GoogleLogoMark className="size-5" />
            <span>{oauthLoading === "google" ? "Opening Google..." : "Continue with Google"}</span>
          </button>
          <Divider label="or" />
        </div>
      )}

      {mode === "login" ? (
        <form onSubmit={handleLogin} className="space-y-5">
          <div>
            <label className="mb-2 block text-sm font-black text-slate-800">Email</label>
            <input type="email" value={email} autoComplete="email" required onChange={(event) => setEmail(event.target.value)} placeholder="Enter your email" className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-4 text-base outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100" />
          </div>
          <div>
            <label className="mb-2 block text-sm font-black text-slate-800">Password</label>
            <input type="password" value={password} autoComplete="current-password" required onChange={(event) => setPassword(event.target.value)} placeholder="Enter your password" className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-4 text-base outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100" />
          </div>
          <div className="flex items-center justify-end text-sm">
            <Link href="/v2/reset-password" className="font-black text-blue-700 hover:text-blue-900">Forgot password?</Link>
          </div>
          <button type="submit" disabled={loading} className="w-full rounded-2xl bg-blue-600 px-6 py-4 text-base font-black text-white shadow-lg shadow-blue-600/20 transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60">
            {loading ? copy.loading : copy.submit}
          </button>
          {message && <p className="text-center text-sm font-semibold text-red-600">{message}</p>}
          <div className="border-t border-slate-200 pt-6 text-center text-sm text-slate-600">
            New to Loombus? <Link href="/v2/signup" className="font-black text-blue-700 hover:text-blue-900">Create account</Link>
          </div>
        </form>
      ) : success ? (
        <div className="mt-8 rounded-3xl border border-emerald-200 bg-emerald-50 p-5 text-center">
          <h2 className="text-lg font-black text-emerald-900">Check your email</h2>
          <p className="mt-2 text-sm leading-6 text-emerald-800">{message}</p>
          <Link href="/v2/login" className="mt-5 inline-flex rounded-2xl bg-emerald-700 px-5 py-3 text-sm font-black text-white transition hover:bg-emerald-800">Go to login</Link>
        </div>
      ) : (
        <form onSubmit={handleSignup} className="space-y-5">
          <div>
            <label className="mb-2 block text-sm font-black text-slate-800">Name</label>
            <input type="text" value={fullName} autoComplete="name" required onChange={(event) => setFullName(event.target.value)} placeholder="Enter your name" className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-4 text-base outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100" />
          </div>
          <div>
            <label className="mb-2 block text-sm font-black text-slate-800">Email</label>
            <input type="email" value={email} autoComplete="email" required onChange={(event) => setEmail(event.target.value)} placeholder="Enter your email" className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-4 text-base outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100" />
          </div>
          <div>
            <label className="mb-2 block text-sm font-black text-slate-800">Date of birth</label>
            <DateOfBirthSelect value={dateOfBirth} onChange={setDateOfBirth} idPrefix="v2-signup-date-of-birth" />
            <p className="mt-2 text-xs leading-5 text-slate-500">Members under 13 cannot create Loombus accounts.</p>
          </div>
          <div>
            <label className="mb-2 block text-sm font-black text-slate-800">Password</label>
            <input type="password" value={password} autoComplete="new-password" required minLength={6} onChange={(event) => setPassword(event.target.value)} placeholder="Create a password" className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-4 text-base outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100" />
          </div>
          <div>
            <label className="mb-2 block text-sm font-black text-slate-800">Confirm password</label>
            <input type="password" value={confirmPassword} autoComplete="new-password" required minLength={6} onChange={(event) => setConfirmPassword(event.target.value)} placeholder="Confirm your password" className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-4 text-base outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100" />
          </div>
          <button type="submit" disabled={loading} className="w-full rounded-2xl bg-blue-600 px-6 py-4 text-base font-black text-white shadow-lg shadow-blue-600/20 transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60">
            {loading ? copy.loading : copy.submit}
          </button>
          {message && <p className="text-center text-sm font-semibold text-red-600">{message}</p>}
          <p className="text-center text-xs leading-5 text-slate-500">
            By creating an account, you agree to the <Link href="/terms" className="font-bold text-blue-700">Terms</Link> and <Link href="/privacy" className="font-bold text-blue-700">Privacy Policy</Link>.
          </p>
          <div className="border-t border-slate-200 pt-6 text-center text-sm text-slate-600">
            Already have an account? <Link href="/v2/login" className="font-black text-blue-700 hover:text-blue-900">Log in</Link>
          </div>
        </form>
      )}
    </V2EntryShell>
  );
}
