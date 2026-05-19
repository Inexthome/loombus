"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import { ProfileAvatar } from "@/components/profile-avatar";

type Profile = {
  id: string;
  full_name: string;
  username: string;
  bio: string | null;
  avatar_url: string | null;
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

    if (!profile) {
      return;
    }

    const { data: sessionData } = await supabase.auth.getSession();

    if (!sessionData.session) {
      window.location.href = "/login";
      return;
    }

    const response = await fetch("/api/follows/toggle", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${sessionData.session.access_token}`,
      },
      body: JSON.stringify({
        targetUserId: profile.id,
      }),
    });

    const result = await response.json();

    if (!response.ok) {
      setFollowMessage(result.error ?? "Unable to update follow status.");
      return;
    }

    setIsFollowing(result.following);
    setFollowerCount((count) =>
      result.following ? count + 1 : Math.max(0, count - 1)
    );
    setFollowMessage(result.following ? "Following." : "Unfollowed.");
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
          <div className="mb-6 flex items-center gap-5">
            <ProfileAvatar profile={profile} size="xl" />

            <div>
              <p className="mb-2 text-sm text-zinc-500">
                @{profile.username}
              </p>

              <h1 className="text-5xl font-semibold tracking-tight">
                {profile.full_name}
              </h1>
            </div>
          </div>

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
            <Link
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
            </Link>
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
