"use client";

import Link from "next/link";
import { type FormEvent, useState } from "react";
import { AppleLogoMark, GoogleLogoMark } from "@/components/auth-provider-icons";
import { DateOfBirthSelect } from "@/components/date-of-birth-select";
import { getAgeBandFromDateOfBirth } from "@/lib/age-safety";
import { getAuthErrorMessage } from "@/lib/auth-error-message";
import { supabase } from "@/lib/supabase/client";

const fieldClassName =
  "mt-2 min-h-12 w-full border-0 border-b border-[color:var(--loombus-border)] bg-transparent px-0 py-3 text-[color:var(--loombus-text)] outline-none transition focus:border-[color:var(--loombus-gold)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[color:var(--loombus-gold)]";

const dobSelectClassName =
  "min-h-12 w-full border-0 border-b border-[color:var(--loombus-border)] bg-transparent px-0 py-3 text-[color:var(--loombus-text)] outline-none transition focus:border-[color:var(--loombus-gold)] disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[color:var(--loombus-gold)]";

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
      setMessage("This account is not eligible to use Loombus.");
      return;
    }

    setLoading(true);

    const { error } = await supabase.auth.signUp({
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
      setMessage(`Error: ${getAuthErrorMessage(error, "signup")}`);
      setLoading(false);
      return;
    }

    setSignupComplete(true);
    setPassword("");
    setConfirmPassword("");
    setMessage(
      "Signup successful. Check your email. The verification link expires after 60 minutes."
    );
    setLoading(false);
  }

  async function handleOAuthSignup(provider: "google" | "apple") {
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
      const publicMessage = error instanceof Error ? error.message : "Unable to start OAuth signup.";
      setMessage(`${provider === "apple" ? "Apple" : "Google"} signup error: ${publicMessage}`);
      setOauthLoading(null);
    }
  }

  return (
    <main
      data-loombus-auth-shell
      data-loombus-signup-editorial
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
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[color:var(--loombus-gold)]">Join Loombus</p>
          <h1 className="mt-3 max-w-3xl text-4xl font-semibold tracking-[-0.04em] sm:text-5xl">Create your account</h1>
          <p className="mt-4 max-w-2xl text-sm leading-7 text-[color:var(--loombus-text-muted)] sm:text-base">
            Join a signal-first platform where ideas move through discussion, evidence, understanding, and action.
          </p>
        </header>

        <div className="grid gap-0 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
          <section className="border-b border-[color:var(--loombus-border)] py-8 lg:border-b-0 lg:border-r lg:pr-10 sm:py-10">
            <div className="border-b border-[color:var(--loombus-border)] pb-7">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[color:var(--loombus-text-muted)]">Returning to Loombus?</p>
              <h2 className="mt-2 text-xl font-semibold tracking-tight">Sign in to your account</h2>
              <p className="mt-3 text-sm leading-6 text-[color:var(--loombus-text-muted)]">Already have a Loombus account? Continue with your existing access.</p>
              <Link
                href="/login"
                className="mt-5 inline-flex min-h-11 items-center border-b border-[color:var(--loombus-gold)] text-sm font-semibold text-[color:var(--loombus-text)] transition hover:text-[color:var(--loombus-gold)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[color:var(--loombus-gold)]"
              >
                Sign in →
              </Link>
            </div>

            {!signupComplete ? (
              <div className="pt-7">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[color:var(--loombus-gold)]">Account options</p>
                <div className="mt-5 divide-y divide-[color:var(--loombus-border)] border-y border-[color:var(--loombus-border)]">
                  <button
                    type="button"
                    onClick={() => void handleOAuthSignup("apple")}
                    disabled={loading || Boolean(oauthLoading)}
                    className="flex min-h-14 w-full items-center justify-between gap-4 px-1 py-3 text-left text-sm font-medium transition hover:text-[color:var(--loombus-gold)] disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--loombus-gold)]"
                  >
                    <span className="flex items-center gap-3"><AppleLogoMark className="h-5 w-5" />Sign up with Apple</span>
                    <span className="text-xs text-[color:var(--loombus-text-muted)]">{oauthLoading === "apple" ? "Opening…" : "→"}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleOAuthSignup("google")}
                    disabled={loading || Boolean(oauthLoading)}
                    className="flex min-h-14 w-full items-center justify-between gap-4 px-1 py-3 text-left text-sm font-medium transition hover:text-[color:var(--loombus-gold)] disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--loombus-gold)]"
                  >
                    <span className="flex items-center gap-3"><GoogleLogoMark className="h-5 w-5" />Sign up with Google</span>
                    <span className="text-xs text-[color:var(--loombus-text-muted)]">{oauthLoading === "google" ? "Opening…" : "→"}</span>
                  </button>
                </div>
                <p className="mt-5 text-xs leading-6 text-[color:var(--loombus-text-muted)]">Prefer email? Create your account with the form.</p>
              </div>
            ) : null}
          </section>

          <section className="py-8 lg:pl-10 sm:py-10">
            {signupComplete ? (
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[color:var(--loombus-gold)]">Account created</p>
                <h2 className="mt-2 text-2xl font-semibold tracking-tight">Check your email to confirm your account</h2>
                <p className="mt-4 text-sm leading-7 text-[color:var(--loombus-text-muted)]">Use the newest verification link within 60 minutes. After confirming your email, log in and complete your profile so other Loombus members know who they are reading and interacting with.</p>
                <div className="mt-6 border-y border-[color:var(--loombus-border)] py-5">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[color:var(--loombus-text-muted)]">Verification lifecycle</p>
                  <p className="mt-2 text-sm leading-6 text-[color:var(--loombus-text-muted)]">An expired link can be replaced from the Login page. Accounts that remain unverified for seven days are removed.</p>
                </div>
                <Link
                  href="/login"
                  className="mt-6 inline-flex min-h-12 items-center border border-[color:var(--loombus-gold)] bg-[color:var(--loombus-gold)] px-6 py-3 text-sm font-semibold text-[#17140B] transition hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[color:var(--loombus-gold)]"
                >
                  Go to Log In
                </Link>
              </div>
            ) : (
              <form id="email-signup" onSubmit={handleSignup} className="space-y-6">
                <div className="border-b border-[color:var(--loombus-border)] pb-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[color:var(--loombus-gold)]">Email signup</p>
                  <h2 className="mt-2 text-xl font-semibold tracking-tight">Create a new account</h2>
                </div>

                <div>
                  <label htmlFor="signup-full-name" className="block text-sm font-medium">Full name</label>
                  <input id="signup-full-name" type="text" value={fullName} autoComplete="name" required onChange={(event) => setFullName(event.target.value)} className={fieldClassName} />
                </div>

                <div>
                  <label htmlFor="signup-email" className="block text-sm font-medium">Email</label>
                  <input id="signup-email" type="email" value={email} autoComplete="email" required onChange={(event) => setEmail(event.target.value)} className={fieldClassName} />
                </div>

                <div>
                  <p className="block text-sm font-medium">Date of birth</p>
                  <DateOfBirthSelect value={dateOfBirth} onChange={setDateOfBirth} idPrefix="signup-date-of-birth" selectClassName={dobSelectClassName} />
                  <p className="mt-2 text-xs leading-6 text-[color:var(--loombus-text-muted)]">Enter your actual date of birth.</p>
                </div>

                <div>
                  <label htmlFor="signup-password" className="block text-sm font-medium">Password</label>
                  <input id="signup-password" type="password" value={password} autoComplete="new-password" required minLength={6} onChange={(event) => setPassword(event.target.value)} className={fieldClassName} />
                </div>

                <div>
                  <label htmlFor="signup-confirm-password" className="block text-sm font-medium">Confirm Password</label>
                  <input id="signup-confirm-password" type="password" value={confirmPassword} autoComplete="new-password" required minLength={6} onChange={(event) => setConfirmPassword(event.target.value)} className={fieldClassName} />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="min-h-12 w-full border border-[color:var(--loombus-gold)] bg-[color:var(--loombus-gold)] px-6 py-3 text-sm font-semibold text-[#17140B] transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[color:var(--loombus-gold)]"
                >
                  {loading ? "Creating account..." : "Create Account"}
                </button>

                {message ? <p role="status" className="border-t border-[color:var(--loombus-border)] pt-4 text-sm leading-6 text-[color:var(--loombus-text-muted)]">{message}</p> : null}

                <p className="border-t border-[color:var(--loombus-border)] pt-5 text-xs leading-6 text-[color:var(--loombus-text-muted)]">
                  By creating an account or continuing with Apple, Google, or email, you confirm that you meet Loombus eligibility requirements and agree to the{" "}
                  <Link href="/terms" className="font-semibold underline underline-offset-4 hover:text-[color:var(--loombus-gold)]">Terms</Link>,{" "}
                  <Link href="/privacy" className="font-semibold underline underline-offset-4 hover:text-[color:var(--loombus-gold)]">Privacy Policy</Link>,{" "}
                  <Link href="/cookies" className="font-semibold underline underline-offset-4 hover:text-[color:var(--loombus-gold)]">Cookie Policy</Link>,{" "}
                  <Link href="/guidelines" className="font-semibold underline underline-offset-4 hover:text-[color:var(--loombus-gold)]">Community Guidelines</Link>, and{" "}
                  <Link href="/safety" className="font-semibold underline underline-offset-4 hover:text-[color:var(--loombus-gold)]">Safety</Link>.
                </p>

                <p className="text-sm text-[color:var(--loombus-text-muted)]">
                  Already have an account?{" "}
                  <Link href="/login" className="font-semibold underline underline-offset-4 transition hover:text-[color:var(--loombus-gold)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[color:var(--loombus-gold)]">Sign in</Link>
                </p>
              </form>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}