"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";

export default function DashboardPage() {
  const [email, setEmail] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadUser() {
      const { data } = await supabase.auth.getUser();

      if (!data.user) {
        window.location.href = "/login";
        return;
      }

      setEmail(data.user.email ?? null);
      setLoading(false);
    }

    loadUser();
  }, []);

  async function handleLogout() {
    await supabase.auth.signOut();
    window.location.href = "/";
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-black px-6 py-16 text-white">
        <div className="mx-auto max-w-3xl text-zinc-400">
          Loading dashboard...
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-black px-6 py-16 text-white">
      <div className="mx-auto max-w-3xl">
        <p className="mb-4 text-sm uppercase tracking-[0.3em] text-zinc-500">
          Dashboard
        </p>

        <h1 className="mb-6 text-5xl font-semibold tracking-tight">
          Welcome to Loombus.
        </h1>

        <p className="mb-10 text-zinc-400">
          Signed in as {email}
        </p>

        <div className="grid gap-4 md:grid-cols-2">
          <Link
            href="/discussions"
            className="rounded-2xl border border-zinc-800 bg-zinc-950 p-6 transition hover:border-zinc-700"
          >
            <h2 className="mb-3 text-xl font-medium">Explore discussions</h2>
            <p className="text-sm leading-relaxed text-zinc-400">
              Browse high-signal conversations and thoughtful contributions.
            </p>
          </Link>

          <Link
            href="/create"
            className="rounded-2xl border border-zinc-800 bg-zinc-950 p-6 transition hover:border-zinc-700"
          >
            <h2 className="mb-3 text-xl font-medium">Create discussion</h2>
            <p className="text-sm leading-relaxed text-zinc-400">
              Start a structured conversation around a meaningful idea.
            </p>
          </Link>
        </div>

        <button
          onClick={handleLogout}
          className="mt-10 rounded-full border border-zinc-700 px-6 py-3 text-zinc-300 transition hover:border-zinc-500 hover:text-white"
        >
          Log out
        </button>
      </div>
    </main>
  );
}
