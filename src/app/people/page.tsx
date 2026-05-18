"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";

type Profile = {
  id: string;
  full_name: string | null;
  username: string | null;
  bio: string | null;
};

export default function PeoplePage() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
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

  return (
    <main className="min-h-screen bg-black px-6 py-16 text-white">
      <div className="mx-auto max-w-5xl">
        <div className="mb-12">
          <h1 className="text-5xl font-semibold tracking-tight">
            People
          </h1>

          <p className="mt-3 text-zinc-500">
            Discover thoughtful contributors across Loombus.
          </p>
        </div>

        {loading && (
          <p className="text-zinc-500">
            Loading people...
          </p>
        )}

        <div className="grid gap-6 md:grid-cols-2">
          {profiles.map((profile) => (
            <a
              key={profile.id}
              href={`/u/${profile.username}`}
              className="rounded-2xl border border-zinc-800 bg-zinc-950 p-6 transition hover:border-zinc-700"
            >
              <p className="mb-3 text-sm text-zinc-500">
                @{profile.username}
              </p>

              <h2 className="mb-3 text-2xl font-medium">
                {profile.full_name}
              </h2>

              <p className="line-clamp-3 leading-relaxed text-zinc-400">
                {profile.bio || "No bio yet."}
              </p>
            </a>
          ))}
        </div>
      </div>
    </main>
  );
}
