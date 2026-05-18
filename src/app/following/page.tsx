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
  username: string | null;
  full_name: string | null;
};

export default function FollowingPage() {
  const [discussions, setDiscussions] = useState<Discussion[]>([]);
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [replyCounts, setReplyCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadFollowingFeed() {
      const { data: userData } = await supabase.auth.getUser();

      if (!userData.user) {
        window.location.href = "/login";
        return;
      }

      const { data: follows } = await supabase
        .from("follows")
        .select("following_id")
        .eq("follower_id", userData.user.id);

      const followingIds =
        follows?.map((item) => item.following_id) ?? [];

      if (followingIds.length === 0) {
        setLoading(false);
        return;
      }

      const { data: discussionData } = await supabase
        .from("discussions")
        .select("*")
        .is("deleted_at", null)
        .is("deleted_at", null)
        .in("user_id", followingIds)
        .order("created_at", { ascending: false });

      const discussions = discussionData ?? [];

      setDiscussions(discussions);

      const uniqueUserIds = [
        ...new Set(discussions.map((d) => d.user_id)),
      ];

      const { data: profileData } = await supabase
        .from("profiles")
        .select("*")
        .in("id", uniqueUserIds);

      const profileMap: Record<string, Profile> = {};

      for (const profile of profileData ?? []) {
        profileMap[profile.id] = profile;
      }

      const discussionIds = discussions.map((d) => d.id);

      if (discussionIds.length > 0) {
        const { data: replyData } = await supabase
          .from("replies")
          .select("discussion_id")
          .in("discussion_id", discussionIds);

        const counts: Record<string, number> = {};

        for (const reply of replyData ?? []) {
          counts[reply.discussion_id] =
            (counts[reply.discussion_id] ?? 0) + 1;
        }

        setReplyCounts(counts);
      }

      setProfiles(profileMap);
      setLoading(false);
    }

    loadFollowingFeed();
  }, []);

  return (
    <main className="min-h-screen bg-black px-6 py-16 text-white">
      <div className="mx-auto max-w-5xl">

        <div className="mb-12">
          <h1 className="text-5xl font-semibold tracking-tight">
            Following
          </h1>

          <p className="mt-3 text-zinc-500">
            Discussions from people you follow.
          </p>
        </div>

        {loading && (
          <p className="text-zinc-500">
            Loading following feed...
          </p>
        )}

        {!loading && discussions.length === 0 && (
          <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-6">
            <h2 className="mb-3 text-2xl font-medium">
              No followed discussions yet.
            </h2>

            <p className="text-zinc-400">
              Follow contributors to build a more personalized signal feed.
            </p>
          </div>
        )}

        <div className="space-y-6">
          {discussions.map((discussion) => {
            const profile = profiles[discussion.user_id];

            return (
              <div
                key={discussion.id}
                className="rounded-2xl border border-zinc-800 bg-zinc-950 p-6 transition hover:border-zinc-700"
              >
                <a
                  href={`/discussions/${discussion.id}`}
                  className="block"
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
                </a>

                <div className="flex items-center justify-between gap-4">
                  <p className="text-sm text-zinc-600">
                    by{" "}
                  {profile?.username ? (
                    <a
                      href={`/u/${profile.username}`}
                      className="text-zinc-400 transition hover:text-white"
                    >
                      @{profile.username}
                    </a>
                  ) : (
                    "Loombus member"
                  )}{" "}
                    · {new Date(discussion.created_at).toLocaleDateString()}
                  </p>

                  <p className="text-sm text-zinc-500">
                    {replyCounts[discussion.id] ?? 0} replies
                  </p>
                </div>
              </div>
            );
          })}
        </div>

      </div>
    </main>
  );
}
