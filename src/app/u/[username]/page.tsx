"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabase/client";

type Profile = {
  id: string;
  full_name: string;
  username: string;
  bio: string | null;
};

type Discussion = {
  id: string;
  title: string;
  topic: string;
  body: string;
  created_at: string;
};

export default function UserProfilePage() {
  const params = useParams();
  const username = params.username as string;

  const [profile, setProfile] = useState<Profile | null>(null);
  const [discussions, setDiscussions] = useState<Discussion[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [isFollowing, setIsFollowing] = useState(false);
  const [followMessage, setFollowMessage] = useState("");
  const [followerCount, setFollowerCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);

  useEffect(() => {
    async function loadProfile() {
      const { data: profileData } = await supabase
        .from("profiles")
        .select("*")
        .eq("username", username)
        .single();

      if (!profileData) {
        setLoading(false);
        return;
      }

      setProfile(profileData);

      const { data: userData } = await supabase.auth.getUser();
      const viewerId = userData.user?.id ?? null;

      setCurrentUserId(viewerId);

      if (viewerId && viewerId !== profileData.id) {
        const { data: followData } = await supabase
          .from("follows")
          .select("*")
          .eq("follower_id", viewerId)
          .eq("following_id", profileData.id)
          .maybeSingle();

        setIsFollowing(Boolean(followData));
      }

      const { count: followerTotal } = await supabase
        .from("follows")
        .select("*", { count: "exact", head: true })
        .eq("following_id", profileData.id);

      const { count: followingTotal } = await supabase
        .from("follows")
        .select("*", { count: "exact", head: true })
        .eq("follower_id", profileData.id);

      setFollowerCount(followerTotal ?? 0);
      setFollowingCount(followingTotal ?? 0);

      const { data: discussionData } = await supabase
        .from("discussions")
        .select("*")
        .is("deleted_at", null)
        .is("deleted_at", null)
        .eq("user_id", profileData.id)
        .order("created_at", { ascending: false });

      setDiscussions(discussionData ?? []);
      setLoading(false);
    }

    loadProfile();
  }, [username]);

  async function toggleFollow() {
    setFollowMessage("");

    const { data: userData } = await supabase.auth.getUser();

    if (!userData.user) {
      window.location.href = "/login";
      return;
    }

    if (!profile) {
      return;
    }

    if (userData.user.id === profile.id) {
      setFollowMessage("You cannot follow yourself.");
      return;
    }

    if (isFollowing) {
      const { error } = await supabase
        .from("follows")
        .delete()
        .eq("follower_id", userData.user.id)
        .eq("following_id", profile.id);

      if (error) {
        setFollowMessage("Unable to unfollow.");
        return;
      }

      setIsFollowing(false);
      setFollowerCount((count) => Math.max(0, count - 1));
      setFollowMessage("Unfollowed.");
      return;
    }

    const { error } = await supabase.from("follows").insert({
      follower_id: userData.user.id,
      following_id: profile.id,
    });

    if (error) {
      setFollowMessage("Unable to follow.");
      return;
    }

    setIsFollowing(true);
    setFollowerCount((count) => count + 1);
    setFollowMessage("Following.");
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-black px-6 py-16 text-white">
        <div className="mx-auto max-w-4xl text-zinc-400">
          Loading profile...
        </div>
      </main>
    );
  }

  if (!profile) {
    return (
      <main className="min-h-screen bg-black px-6 py-16 text-white">
        <div className="mx-auto max-w-4xl">
          <h1 className="text-5xl font-semibold tracking-tight">
            User not found.
          </h1>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-black px-6 py-16 text-white">
      <div className="mx-auto max-w-4xl">
        <div className="mb-16 rounded-3xl border border-zinc-800 bg-zinc-950 p-8">
          <p className="mb-3 text-sm text-zinc-500">
            @{profile.username}
          </p>

          <h1 className="mb-4 text-5xl font-semibold tracking-tight">
            {profile.full_name}
          </h1>

          <p className="max-w-2xl leading-relaxed text-zinc-400">
            {profile.bio || "No bio added yet."}
          </p>

          <div className="mt-6 flex gap-8 text-sm text-zinc-500">
            <p>
              <span className="text-white">{followerCount}</span> followers
            </p>

            <p>
              <span className="text-white">{followingCount}</span> following
            </p>
          </div>

          {currentUserId && currentUserId !== profile.id && (
            <div className="mt-8">
              <button
                onClick={toggleFollow}
                className="rounded-full bg-white px-6 py-3 text-sm text-black transition hover:bg-zinc-200"
              >
                {isFollowing ? "Following" : "Follow"}
              </button>

              {followMessage && (
                <p className="mt-4 text-sm text-zinc-500">
                  {followMessage}
                </p>
              )}
            </div>
          )}
        </div>

        <h2 className="mb-8 text-3xl font-semibold tracking-tight">
          Discussions
        </h2>

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

              <h3 className="mb-3 text-2xl font-medium">
                {discussion.title}
              </h3>

              <p className="line-clamp-2 leading-relaxed text-zinc-400">
                {discussion.body}
              </p>
            </a>
          ))}

          {discussions.length === 0 && (
            <p className="text-zinc-500">
              No discussions yet.
            </p>
          )}
        </div>
      </div>
    </main>
  );
}
