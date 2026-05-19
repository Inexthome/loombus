"use client";

import Link from "next/link";
import { type FormEvent, useState } from "react";
import { supabase } from "@/lib/supabase/client";

export default function SignupPage() {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [signupComplete, setSignupComplete] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSignup(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();

    if (loading) {
      return;
    }

    setLoading(true);
    setMessage("");
    setSignupComplete(false);

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
        },
      },
    });

    if (error) {
      setMessage(`Error: ${error.message}`);
      setLoading(false);
      return;
    }

    if (data.user) {
      await supabase.from("profiles").insert({
        id: data.user.id,
        full_name: fullName,
      });
    }

    setSignupComplete(true);
    setPassword("");
    setMessage("Signup successful. Check your email to confirm your account.");
    setLoading(false);
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

        {signupComplete ? (
          <div className="space-y-5 rounded-2xl border border-zinc-800 bg-zinc-950 p-6">
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
            className="space-y-5 rounded-2xl border border-zinc-800 bg-zinc-950 p-6"
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

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-full bg-white px-6 py-3 text-black transition hover:bg-zinc-200 disabled:opacity-50"
          >
            {loading ? "Creating account..." : "Create Account"}
          </button>

          {message && (
            <p className="text-sm text-zinc-400">
              {message}
            </p>
          )}
          </form>
        )}
      </div>
    </main>
  );
}
