"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";

type Discussion = {
  id: string;
  user_id: string;
  title: string;
  topic: string;
  body: string;
  created_at: string;
};

type Profile = {
  id: string;
  full_name: string | null;
};

export default function DiscussionsPage() {
  const [discussions, setDiscussions] = useState<Discussion[]>([]);
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadDiscussions() {
      const { data, error } = await supabase
        .from("discussions")
        .select("*")
        .order("created_at", { ascending: false });

      if (!error && data) {
        setDiscussions(data);

        const userIds = [...new Set(data.map((item) => item.user_id))];

        if (userIds.length > 0) {
          const { data: profileData } = await supabase
            .from("profiles")
            .select("*")
            .in("id", userIds);

          const profileMap: Record<string, Profile> = {};

          for (const profile of profileData ?? []) {
            profileMap[profile.id] = profile;
          }

          setProfiles(profileMap);
        }
      }

      setLoading(false);
    }

    loadDiscussions();
  }, []);

  return (
    <main className="min-h-screen bg-black px-6 py-16 text-white">
      <div className="mx-auto max-w-4xl">
        <div className="mb-12 flex items-center justify-between gap-6">
          <h1 className="text-5xl font-semibold tracking-tight">
            Discussions
          </h1>

          <a
            href="/create"
            className="rounded-full bg-white px-5 py-3 text-sm text-black transition hover:bg-zinc-200"
          >
            Create Discussion
          </a>
        </div>

        {loading && <p className="text-zinc-500">Loading discussions...</p>}

        {!loading && discussions.length === 0 && (
          <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-6">
            <h2 className="mb-3 text-2xl font-medium">No discussions yet.</h2>
            <p className="text-zinc-400">
              Start the first high-signal conversation on Loombus.
            </p>
          </div>
        )}

        <div className="space-y-6">
          {discussions.map((discussion) => (
            <a
              key={discussion.id}
              href={`/discussions/${discussion.id}`}
              className="block rounded-2xl border border-zinc-800 bg-zinc-950 p-6 transition hover:border-zinc-700"
            >
              <p className="mb-3 text-sm text-zinc-500">
                {discussion.topic}
              </p>

              <h2 className="mb-3 text-2xl font-medium">
                {discussion.title}
              </h2>

              <p className="mb-4 line-clamp-2 leading-relaxed text-zinc-400">
                {discussion.body}
              </p>

              <p className="text-sm text-zinc-600">
                by {profiles[discussion.user_id]?.full_name ?? "Loombus member"} ·{" "}
                {new Date(discussion.created_at).toLocaleDateString()}
              </p>
            </a>
          ))}
        </div>
      </div>
    </main>
  );
}
