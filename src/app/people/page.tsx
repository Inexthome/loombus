"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase/client";

type Profile = {
  id: string;
  full_name: string | null;
  username: string | null;
  bio: string | null;
};

function getProfileInitials(profile: Profile | undefined) {
  const label = profile?.full_name?.trim() || profile?.username?.trim() || "L";

  const parts = label
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2);

  return parts
    .map((part) => part[0]?.toUpperCase())
    .join("") || "L";
}

export default function PeoplePage() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadProfiles() {
      const { data } = await supabase
        .from("profiles")
        .select("*")
        .order("full_name", { ascending: true });

      setProfiles(data ?? []);
      setLoading(false);
    }

    loadProfiles();
  }, []);

  const filteredProfiles = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    if (!query) {
      return profiles;
    }

    return profiles.filter((profile) => {
      return (
        (profile.username ?? "").toLowerCase().includes(query) ||
        (profile.full_name ?? "").toLowerCase().includes(query) ||
        (profile.bio ?? "").toLowerCase().includes(query)
      );
    });
  }, [profiles, searchQuery]);

  return (
    <main className="min-h-screen bg-black px-6 py-16 text-white">
      <div className="mx-auto max-w-5xl">
        <div className="mb-10">
          <h1 className="text-5xl font-semibold tracking-tight">
            People
          </h1>

          <p className="mt-3 text-zinc-500">
            Discover thoughtful contributors across Loombus.
          </p>
        </div>

        <div className="mb-8 rounded-2xl border border-zinc-800 bg-zinc-950 p-5">
          <label className="mb-3 block text-sm text-zinc-400">
            Search members
          </label>

          <input
            type="text"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Search by username, name, or bio..."
            className="w-full rounded-xl border border-zinc-800 bg-black px-4 py-3 text-white outline-none transition placeholder:text-zinc-700 focus:border-zinc-500"
          />

          {!loading && (
            <p className="mt-3 text-sm text-zinc-600">
              Showing {filteredProfiles.length} of {profiles.length} members
            </p>
          )}
        </div>

        {loading && (
          <p className="text-zinc-500">
            Loading people...
          </p>
        )}

        {!loading && filteredProfiles.length === 0 && (
          <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-6">
            <h2 className="mb-3 text-2xl font-medium">
              No members found.
            </h2>

            <p className="text-zinc-400">
              Try searching by a different name, username, or keyword.
            </p>
          </div>
        )}

        <div className="grid gap-6 md:grid-cols-2">
          {filteredProfiles.map((profile) => (
            <Link
              key={profile.id}
              href={profile.username ? `/u/${profile.username}` : "/people"}
              className="rounded-2xl border border-zinc-800 bg-zinc-950 p-6 transition hover:border-zinc-700"
            >
              <div className="mb-5 flex items-center gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-zinc-800 bg-black text-base font-medium text-zinc-300">
                  {getProfileInitials(profile)}
                </div>

                <div className="min-w-0">
                  <h2 className="truncate text-2xl font-medium">
                    {profile.full_name || profile.username || "Loombus member"}
                  </h2>

                  <p className="mt-1 text-sm text-zinc-500">
                    {profile.username ? `@${profile.username}` : "No username yet"}
                  </p>
                </div>
              </div>

              <p className="line-clamp-3 leading-relaxed text-zinc-400">
                {profile.bio || "No bio yet."}
              </p>
            </Link>
          ))}
        </div>
      </div>
    </main>
  );
}
