"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase/client";

type Profile = {
  full_name: string | null;
  username: string | null;
  bio: string | null;
};

function getMissingProfileFields(profile: Profile | null) {
  const missing = [];

  if (!profile?.username?.trim()) {
    missing.push("username");
  }

  if (!profile?.full_name?.trim()) {
    missing.push("full name");
  }

  if (!profile?.bio?.trim()) {
    missing.push("bio");
  }

  return missing;
}

export default function DashboardPage() {
  const [email, setEmail] = useState<string | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadUser() {
      const { data } = await supabase.auth.getUser();

      if (!data.user) {
        window.location.href = "/login";
        return;
      }

      setEmail(data.user.email ?? null);

      const { data: profileData } = await supabase
        .from("profiles")
        .select("full_name, username, bio")
        .eq("id", data.user.id)
        .maybeSingle();

      setProfile(profileData ?? null);
      setLoading(false);
    }

    loadUser();
  }, []);

  const missingProfileFields = useMemo(
    () => getMissingProfileFields(profile),
    [profile]
  );

  const profileCompletionPercent =
    Math.round(((3 - missingProfileFields.length) / 3) * 100);

  const profileComplete = missingProfileFields.length === 0;

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

        <p className="mb-8 text-zinc-400">
          Signed in as {email}
        </p>

        <div className="mb-8 rounded-2xl border border-zinc-800 bg-zinc-950 p-6">
          <div className="mb-4 flex items-center justify-between gap-4">
            <div>
              <p className="mb-2 text-sm uppercase tracking-[0.25em] text-zinc-500">
                Profile setup
              </p>

              <h2 className="text-2xl font-medium">
                {profileComplete ? "Your public profile is complete." : "Complete your public profile."}
              </h2>
            </div>

            <span className="rounded-full border border-zinc-800 px-4 py-2 text-sm text-zinc-400">
              {profileCompletionPercent}%
            </span>
          </div>

          <div className="mb-4 h-2 overflow-hidden rounded-full bg-zinc-900">
            <div
              className="h-full rounded-full bg-white transition-all"
              style={{ width: `${profileCompletionPercent}%` }}
            />
          </div>

          {!profileComplete ? (
            <>
              <p className="mb-5 leading-relaxed text-zinc-400">
                Add your {missingProfileFields.join(", ")} so other members know
                who they are reading and interacting with.
              </p>

              <Link
                href="/profile"
                className="inline-flex rounded-full bg-white px-5 py-3 text-sm text-black transition hover:bg-zinc-200"
              >
                Complete Profile
              </Link>
            </>
          ) : (
            <p className="text-sm text-zinc-400">
              Your profile is ready for people, mentions, follows, and discussion attribution.
            </p>
          )}
        </div>

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
