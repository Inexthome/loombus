"use client";

import Link from "next/link";
import { type FormEvent, useEffect, useState } from "react";
import { getAgeBandFromDateOfBirth, getDateYearsAgo } from "@/lib/age-safety";
import { supabase } from "@/lib/supabase/client";
import { isIosNativeApp } from "@/lib/native-app";

function GoogleAuthLogo() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5">
      <path fill="#4285F4" d="M21.6 12.23c0-.74-.07-1.45-.19-2.13H12v4.03h5.38a4.6 4.6 0 0 1-1.99 3.02v2.51h3.23c1.89-1.74 2.98-4.3 2.98-7.43Z" />
      <path fill="#34A853" d="M12 22c2.7 0 4.97-.89 6.62-2.34l-3.23-2.51c-.9.6-2.04.95-3.39.95-2.61 0-4.82-1.76-5.61-4.13H3.05v2.59A9.99 9.99 0 0 0 12 22Z" />
      <path fill="#FBBC05" d="M6.39 13.97A6.01 6.01 0 0 1 6.07 12c0-.68.12-1.34.32-1.97V7.44H3.05A9.99 9.99 0 0 0 2 12c0 1.61.38 3.13 1.05 4.56l3.34-2.59Z" />
      <path fill="#EA4335" d="M12 5.9c1.47 0 2.79.51 3.83 1.5l2.86-2.86C16.96 2.93 14.69 2 12 2a9.99 9.99 0 0 0-8.95 5.44l3.34 2.59C7.18 7.66 9.39 5.9 12 5.9Z" />
    </svg>
  );
}

function AppleAuthLogo() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5 fill-current">
      <path d="M16.7 13.05c-.02-2.21 1.8-3.27 1.88-3.32-1.03-1.51-2.64-1.72-3.21-1.74-1.37-.14-2.67.8-3.36.8-.7 0-1.78-.78-2.92-.76-1.5.02-2.88.87-3.65 2.21-1.56 2.7-.4 6.7 1.12 8.89.74 1.07 1.63 2.28 2.79 2.23 1.12-.04 1.54-.72 2.9-.72 1.35 0 1.73.72 2.91.7 1.2-.02 1.96-1.09 2.7-2.16.85-1.24 1.2-2.45 1.22-2.51-.03-.01-2.34-.9-2.38-3.62ZM14.47 6.55c.62-.75 1.04-1.8.93-2.84-.9.04-1.98.6-2.62 1.35-.58.67-1.08 1.74-.94 2.77 1 .08 2.02-.51 2.63-1.28Z" />
    </svg>
  );
}

export default function SignupPage() {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [message, setMessage] = useState("");
  const [signupComplete, setSignupComplete] = useState(false);
  const [loading, setLoading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState<"google" | "apple" | null>(null);
  const [nativeIosApp, setNativeIosApp] = useState(false);

  useEffect(() => {
    setNativeIosApp(isIosNativeApp());
  }, []);

  async function handleSignup(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();

    if (loading) {
      return;
    }

    setMessage("");
    setSignupComplete(false);

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
      setMessage("Loombus is not available to children under 13.");
      return;
    }

    setLoading(true);

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback?next=/discussions`,
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

    setSignupComplete(true);
    setPassword("");
    setConfirmPassword("");
    setMessage("Signup successful. Check your email to confirm your account.");
    setLoading(false);
  }

  async function handleOAuthSignup(provider: "google" | "apple") {
    if (nativeIosApp || isIosNativeApp()) {
      setMessage("Use email and password to create an account inside the Loombus iOS app. Apple and Google signup remain available on the web.");
      return;
    }
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
        setMessage(`${provider === "apple" ? "Apple" : "Google"} signup error: ${error.message}`);
        setOauthLoading(null);
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unable to start OAuth signup.";
      setMessage(`${provider === "apple" ? "Apple" : "Google"} signup error: ${message}`);
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
          Join Loombus
        </p>

        <h1 className="mb-6 text-5xl font-semibold tracking-tight">
          Create your account.
        </h1>

        <p className="mb-10 leading-relaxed text-zinc-400">
          Join a calmer, higher-signal environment for thoughtful discussion.
        </p>

        <div className="mb-6 rounded-3xl border border-zinc-800 bg-zinc-950 p-6 shadow-2xl shadow-black/30">
          <p className="mb-2 text-xs uppercase tracking-[0.22em] text-zinc-500">
            Returning to Loombus?
          </p>

          <h2 className="mb-3 text-xl font-medium">
            Sign in to your account.
          </h2>

          <p className="mb-5 text-sm leading-relaxed text-zinc-500">
            Already have a Loombus account? Continue here.
          </p>

          <Link
            href="/login"
            className="block w-full rounded-full bg-white px-6 py-3 text-center text-sm font-medium text-black transition hover:bg-zinc-200"
          >
            Sign in
          </Link>
        </div>

        {!signupComplete && (
          <div className="mb-6 rounded-3xl border border-zinc-800 bg-zinc-950 p-6 shadow-2xl shadow-black/30 loombus-mobile-visitor-auth-card">
            <p className="mb-2 text-xs uppercase tracking-[0.22em] text-zinc-500">
              New to Loombus?
            </p>

            <h2 className="mb-5 text-xl font-medium">
              Create a new account.
            </h2>

            {nativeIosApp ? (
              <div>
                <a
                  href="#email-signup"
                  className="block w-full rounded-full bg-white px-6 py-3 text-center text-sm font-medium text-black transition hover:bg-zinc-200"
                >
                  Sign up with email
                </a>

                <p className="mt-4 text-sm leading-relaxed text-zinc-400">
                  Use email and password to create an account inside the Loombus iOS app.
                </p>

                <p className="mt-2 text-xs leading-relaxed text-zinc-600">
                  Apple and Google signup remain available on the web.
                </p>
              </div>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => handleOAuthSignup("apple")}
                  disabled={loading || Boolean(oauthLoading)}
                  className="mb-3 w-full rounded-full bg-white px-6 py-3 text-sm font-medium text-black transition hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <span className="inline-flex items-center justify-center gap-2">
                    <AppleAuthLogo />
                    {oauthLoading === "apple" ? "Opening Apple..." : "Sign up with Apple"}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => handleOAuthSignup("google")}
                  disabled={loading || Boolean(oauthLoading)}
                  className="w-full rounded-full bg-white px-6 py-3 text-sm font-medium text-black transition hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <span className="inline-flex items-center justify-center gap-2">
                    <GoogleAuthLogo />
                    {oauthLoading === "google" ? "Opening Google..." : "Sign up with Google"}
                  </span>
                </button>

                <div className="mt-5 flex items-center gap-3 text-xs uppercase tracking-[0.2em] text-zinc-700">
                  <span className="h-px flex-1 bg-zinc-900" />
                  Or create with email
                  <span className="h-px flex-1 bg-zinc-900" />
                </div>
              </>
            )}
          </div>
        )}

        {signupComplete ? (
          <div className="space-y-5 rounded-3xl border border-zinc-800 bg-zinc-950 p-6 shadow-2xl shadow-black/30">
            <div>
              <p className="mb-2 text-sm uppercase tracking-[0.25em] text-zinc-500">
                Account Created
              </p>

              <h2 className="text-2xl font-medium">
                Check your email to confirm your account.
              </h2>

              <p className="mt-4 leading-relaxed text-zinc-400">
                After confirming your email, log in and complete your profile so other Loombus members know who they are reading and interacting with.
              </p>
            </div>

            <div className="rounded-2xl border border-zinc-800 bg-black p-5">
              <p className="text-sm text-zinc-500">
                Next step
              </p>

              <p className="mt-2 text-zinc-300">
                Confirm your email, then log in and finish your profile setup.
              </p>
            </div>

            <Link
              href="/login"
              className="inline-flex rounded-full bg-white px-6 py-3 text-black transition hover:bg-zinc-200"
            >
              Go to Log In
            </Link>
          </div>
        ) : (
          <form
          id="email-signup"
            onSubmit={handleSignup}
            className="space-y-5 rounded-3xl border border-zinc-800 bg-zinc-950 p-6 shadow-2xl shadow-black/30"
          >
          <div>
            <label className="mb-2 block text-sm text-zinc-400">
              Full name
            </label>

            <input
              type="text"
              value={fullName}
              autoComplete="name"
              required
              onChange={(e) => setFullName(e.target.value)}
              className="w-full rounded-xl border border-zinc-800 bg-black px-4 py-3 text-white outline-none focus:border-zinc-500"
            />
          </div>

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
              Date of birth
            </label>

            <input
              type="date"
              value={dateOfBirth}
              required
              max={getDateYearsAgo(13)}
              onChange={(e) => setDateOfBirth(e.target.value)}
              className="w-full rounded-xl border border-zinc-800 bg-black px-4 py-3 text-white outline-none focus:border-zinc-500"
            />

            <p className="mt-2 text-xs leading-relaxed text-zinc-600">
              Members under 13 cannot create Loombus accounts. Ages 13–17 receive Teen Safety Mode protections.
            </p>
          </div>

          <div>
            <label className="mb-2 block text-sm text-zinc-400">
              Password
            </label>

            <input
              type="password"
              value={password}
              autoComplete="new-password"
              required
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-xl border border-zinc-800 bg-black px-4 py-3 text-white outline-none focus:border-zinc-500"
            />
          </div>

              <div>
                <label className="mb-2 block text-sm text-zinc-400">Confirm Password</label>
                <input
                  type="password"
                  value={confirmPassword}
                  autoComplete="new-password"
                  required
                  minLength={6}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full rounded-2xl border border-zinc-800 bg-black px-4 py-3 text-white outline-none focus:border-zinc-500"
                />
              </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-full bg-white px-6 py-3 text-black transition hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-50 loombus-mobile-visitor-create"
          >
            {loading ? "Creating account..." : "Create Account"}
          </button>

          {message && (
            <p className="text-sm text-zinc-400">
              {message}
            </p>
          )}

          <p className="text-xs leading-relaxed text-zinc-500 loombus-mobile-visitor-legal">
            By creating an account or continuing with Apple, Google, or email, you confirm that your date of birth is accurate, that you are at least 13 years old, and agree to the{" "}
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

          <p className="pt-1 text-center text-sm text-zinc-500 loombus-mobile-visitor-existing">
            Already have an account?{" "}
            <Link
              href="/login"
              className="text-zinc-300 underline decoration-zinc-700 underline-offset-4 transition hover:text-white hover:decoration-white loombus-mobile-visitor-signin"
            >
              Log in
            </Link>
          </p>
          </form>
        )}
      </div>
    </main>
  );
}
