"use client";

import Link from "next/link";
import { type FormEvent, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { isIosNativeApp } from "@/lib/native-app";

export default function SignupPage() {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState("");
  const [signupComplete, setSignupComplete] = useState(false);
  const [loading, setLoading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState<"google" | "apple" | null>(null);

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

    const ageConfirmed = window.confirm(
      "Loombus is not available to children under 13. Please confirm that you are at least 13 years old to create an account."
    );

    if (!ageConfirmed) {
      setMessage("You must confirm that you are at least 13 years old to create a Loombus account.");
      return;
    }

    setLoading(true);

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback?next=/onboarding`,
        data: {
          full_name: fullName.trim(),
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
    if (isIosNativeApp()) {
      setMessage("Use email and password to create an account inside the Loombus iOS app. Apple and Google signup remain available on the web.");
      return;
    }
    if (loading || oauthLoading) {
      return;
    }

    setMessage("");

    const ageConfirmed = window.confirm(
      "Loombus is not available to children under 13. Please confirm that you are at least 13 years old to continue."
    );

    if (!ageConfirmed) {
      setMessage("You must confirm that you are at least 13 years old to create a Loombus account.");
      return;
    }

    setOauthLoading(provider);

    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
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

        {!signupComplete && (
          <div className="mb-6 rounded-3xl border border-zinc-800 bg-zinc-950 p-6 shadow-2xl shadow-black/30 loombus-mobile-visitor-auth-card">
            <button
              type="button"
              onClick={() => handleOAuthSignup("apple")}
              disabled={loading || Boolean(oauthLoading)}
              className="mb-3 w-full rounded-full bg-white px-6 py-3 text-sm font-medium text-black transition hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {oauthLoading === "apple" ? "Opening Apple..." : "Sign up with Apple"}
            </button>

            <button
              type="button"
              onClick={() => handleOAuthSignup("google")}
              disabled={loading || Boolean(oauthLoading)}
              className="w-full rounded-full bg-white px-6 py-3 text-sm font-medium text-black transition hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {oauthLoading === "google" ? "Opening Google..." : "Sign up with Google"}
            </button>

            <div className="mt-5 flex items-center gap-3 text-xs uppercase tracking-[0.2em] text-zinc-700">
              <span className="h-px flex-1 bg-zinc-900" />
              Or create with email
              <span className="h-px flex-1 bg-zinc-900" />
            </div>
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
            By creating an account or continuing with Apple, Google, or email, you confirm that you are at least 13 years old and agree to the{" "}
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
