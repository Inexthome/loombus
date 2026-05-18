"use client";

import Link from "next/link";
import { useState } from "react";
import { supabase } from "@/lib/supabase/client";

export default function SignupPage() {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSignup() {
    setLoading(true);
    setMessage("");

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

        <form className="space-y-5 rounded-2xl border border-zinc-800 bg-zinc-950 p-6">
          <div>
            <label className="mb-2 block text-sm text-zinc-400">
              Full name
            </label>

            <input
              type="text"
              value={fullName}
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
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-xl border border-zinc-800 bg-black px-4 py-3 text-white outline-none focus:border-zinc-500"
            />
          </div>

          <button
            type="button"
            onClick={handleSignup}
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
      </div>
    </main>
  );
}
