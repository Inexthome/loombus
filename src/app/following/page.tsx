"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { ProfileAvatar, getProfileDisplayName } from "@/components/profile-avatar";

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
  avatar_url: string | null;
  full_name: string | null;
};

type BlockRow = {
  blocker_id: string;
  blocked_id: string;
};

export default function FollowingPage() {
  const [discussions, setDiscussions] = useState<Discussion[]>([]);
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [replyCounts, setReplyCounts] = useState<Record<string, number>>({});
  const [viewCounts, setViewCounts] = useState<Record<string, number>>({});
  const [bookmarkCounts, setBookmarkCounts] = useState<Record<string, number>>({});
  const [selectedTopic, setSelectedTopic] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortMode, setSortMode] = useState("Newest");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadFollowingFeed() {
      const { data: userData } = await supabase.auth.getUser();

      if (!userData.user) {
        window.location.href = "/login";
        return;
      }

      const { data: blockRows } = await supabase
        .from("user_blocks")
        .select("blocker_id, blocked_id")
        .or(`blocker_id.eq.${userData.user.id},blocked_id.eq.${userData.user.id}`);

      const hiddenProfileIds = new Set<string>();

      for (const block of (blockRows ?? []) as BlockRow[]) {
        hiddenProfileIds.add(
          block.blocker_id === userData.user.id ? block.blocked_id : block.blocker_id
        );
      }

      const { data: follows } = await supabase
        .from("follows")
        .select("following_id")
        .eq("follower_id", userData.user.id);

      const followingIds =
        follows
          ?.map((item) => item.following_id)
          .filter((id) => !hiddenProfileIds.has(id)) ?? [];

      if (followingIds.length === 0) {
        setLoading(false);
        return;
      }

      const { data: discussionData } = await supabase
        .from("discussions")
        .select("*")
        .is("deleted_at", null)
        .in("user_id", followingIds)
        .order("created_at", { ascending: false });

      const discussions = discussionData ?? [];

      setDiscussions(discussions);

      const uniqueUserIds = [
        ...new Set(discussions.map((d) => d.user_id)),
      ];

      const profileMap: Record<string, Profile> = {};

      if (uniqueUserIds.length > 0) {
        const { data: profileData } = await supabase
          .from("profiles")
          .select("*")
          .in("id", uniqueUserIds);

        for (const profile of profileData ?? []) {
          profileMap[profile.id] = profile;
        }
      }

      const discussionIds = discussions.map((d) => d.id);

      if (discussionIds.length > 0) {
        const { data: replyData } = await supabase
          .from("replies")
          .select("discussion_id, user_id")
          .in("discussion_id", discussionIds);

        const counts: Record<string, number> = {};

        for (const reply of replyData ?? []) {
          if (hiddenProfileIds.has(reply.user_id)) {
            continue;
          }

          counts[reply.discussion_id] =
            (counts[reply.discussion_id] ?? 0) + 1;
        }

        setReplyCounts(counts);

        const { data: viewData } = await supabase
          .from("discussion_views")
          .select("discussion_id")
          .in("discussion_id", discussionIds);

        const views: Record<string, number> = {};

        for (const view of viewData ?? []) {
          views[view.discussion_id] =
            (views[view.discussion_id] ?? 0) + 1;
        }

        setViewCounts(views);

        const { data: bookmarkData } = await supabase
          .from("bookmarks")
          .select("discussion_id")
          .in("discussion_id", discussionIds);

        const bookmarks: Record<string, number> = {};

        for (const bookmark of bookmarkData ?? []) {
          bookmarks[bookmark.discussion_id] =
            (bookmarks[bookmark.discussion_id] ?? 0) + 1;
        }

        setBookmarkCounts(bookmarks);
      }

      setProfiles(profileMap);
      setLoading(false);
    }

    loadFollowingFeed();
  }, []);

  const topics = useMemo(() => {
    const uniqueTopics = [...new Set(discussions.map((discussion) => discussion.topic))];
    return ["All", ...uniqueTopics];
  }, [discussions]);

  const filteredDiscussions = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    const filtered = discussions.filter((discussion) => {
      const profile = profiles[discussion.user_id];

      const matchesTopic =
        selectedTopic === "All" || discussion.topic === selectedTopic;

      const matchesSearch =
        !query ||
        discussion.title.toLowerCase().includes(query) ||
        discussion.body.toLowerCase().includes(query) ||
        discussion.topic.toLowerCase().includes(query) ||
        (profile?.username ?? "").toLowerCase().includes(query) ||
        (profile?.full_name ?? "").toLowerCase().includes(query);

      return matchesTopic && matchesSearch;
    });

    if (sortMode === "Most replied") {
      return [...filtered].sort((a, b) => {
        const replyDifference =
          (replyCounts[b.id] ?? 0) - (replyCounts[a.id] ?? 0);

        if (replyDifference !== 0) {
          return replyDifference;
        }

        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });
    }

    if (sortMode === "Signal") {
      return [...filtered].sort((a, b) => {
        const scoreA =
          (replyCounts[a.id] ?? 0) * 3 +
          (bookmarkCounts[a.id] ?? 0) * 5 +
          (viewCounts[a.id] ?? 0);

        const scoreB =
          (replyCounts[b.id] ?? 0) * 3 +
          (bookmarkCounts[b.id] ?? 0) * 5 +
          (viewCounts[b.id] ?? 0);

        const scoreDifference = scoreB - scoreA;

        if (scoreDifference !== 0) {
          return scoreDifference;
        }

        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });
    }

    return filtered;
  }, [
    discussions,
    profiles,
    selectedTopic,
    searchQuery,
    sortMode,
    replyCounts,
    bookmarkCounts,
    viewCounts,
  ]);

  return (
    <main className="min-h-screen bg-black px-6 py-16 text-white">
      <div className="mx-auto max-w-5xl">

        <div className="mb-12">
          <h1 className="text-5xl font-semibold tracking-tight">
            Following
          </h1>

          <p className="mt-3 text-zinc-500">
            A feed of discussions from the people you follow.
          </p>
        </div>

        <div className="mb-8">
          <input
            type="text"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Search followed discussions, topics, or contributors..."
            className="w-full rounded-2xl border border-zinc-800 bg-zinc-950 px-5 py-4 text-white outline-none transition placeholder:text-zinc-600 focus:border-zinc-600"
          />
        </div>

        <div className="mb-8 flex flex-wrap items-center gap-3">
          <button
            onClick={() => setSortMode("Newest")}
            className={`rounded-full px-4 py-2 text-sm transition ${
              sortMode === "Newest"
                ? "bg-white text-black"
                : "border border-zinc-800 bg-zinc-950 text-zinc-400 hover:border-zinc-700 hover:text-white"
            }`}
          >
            Newest
          </button>

          <button
            onClick={() => setSortMode("Most replied")}
            className={`rounded-full px-4 py-2 text-sm transition ${
              sortMode === "Most replied"
                ? "bg-white text-black"
                : "border border-zinc-800 bg-zinc-950 text-zinc-400 hover:border-zinc-700 hover:text-white"
            }`}
          >
            Most replied
          </button>

          <button
            onClick={() => setSortMode("Signal")}
            className={`rounded-full px-4 py-2 text-sm transition ${
              sortMode === "Signal"
                ? "bg-white text-black"
                : "border border-zinc-800 bg-zinc-950 text-zinc-400 hover:border-zinc-700 hover:text-white"
            }`}
          >
            Signal
          </button>
        </div>

        <div className="mb-6 flex flex-wrap gap-3">
          {topics.map((topic) => (
            <button
              key={topic}
              onClick={() => setSelectedTopic(topic)}
              className={`rounded-full px-4 py-2 text-sm transition ${
                selectedTopic === topic
                  ? "bg-white text-black"
                  : "border border-zinc-800 bg-zinc-950 text-zinc-400 hover:border-zinc-700 hover:text-white"
              }`}
            >
              {topic}
            </button>
          ))}
        </div>

        {!loading && (
          <p className="mb-10 text-sm text-zinc-600">
            Showing {filteredDiscussions.length} of {discussions.length} followed discussions
          </p>
        )}

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

        {!loading && discussions.length > 0 && filteredDiscussions.length === 0 && (
          <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-6">
            <h2 className="mb-3 text-2xl font-medium">
              No followed discussions found.
            </h2>

            <p className="text-zinc-400">
              No followed discussions match the current search or topic filter.
            </p>
          </div>
        )}

        <div className="space-y-6">
          {filteredDiscussions.map((discussion) => {
            const profile = profiles[discussion.user_id];

            return (
              <div
                key={discussion.id}
                className="rounded-2xl border border-zinc-800 bg-zinc-950 p-6 transition hover:border-zinc-700"
              >
                <Link
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
                </Link>

                <div className="flex items-center justify-between gap-4">
                  <div className="flex min-w-0 items-center gap-3">
                    <ProfileAvatar profile={profile} size="md" />

                    <p className="min-w-0 text-sm text-zinc-600">
                      by{" "}
                      {profile?.username ? (
                        <Link
                          href={`/u/${profile.username}`}
                          className="text-zinc-400 transition hover:text-white"
                        >
                          {getProfileDisplayName(profile)}
                        </Link>
                      ) : (
                        "Loombus member"
                      )}{" "}
                      · {new Date(discussion.created_at).toLocaleDateString()}
                    </p>
                  </div>

                  <div className="shrink-0 text-right">
                    <p className="text-sm text-zinc-500">
                      {replyCounts[discussion.id] ?? 0} replies ·{" "}
                      {viewCounts[discussion.id] ?? 0} views
                    </p>

                    <p className="mt-1 text-xs uppercase tracking-wide text-zinc-600">
                      Signal Score{" "}
                      {(
                        (replyCounts[discussion.id] ?? 0) * 3 +
                        (bookmarkCounts[discussion.id] ?? 0) * 5 +
                        (viewCounts[discussion.id] ?? 0)
                      )}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

      </div>
    </main>
  );
}
