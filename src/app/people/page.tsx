"use client";

import Link from "next/link";
import { type MouseEvent, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { ProfileAvatar } from "@/components/profile-avatar";

type Profile = {
  id: string;
  full_name: string | null;
  username: string | null;
  avatar_url: string | null;
  bio: string | null;
};

export default function PeoplePage() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [followingIds, setFollowingIds] = useState<Set<string>>(new Set());
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [workingFollowId, setWorkingFollowId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadProfiles() {
      const { data: userData } = await supabase.auth.getUser();
      const viewerId = userData.user?.id ?? null;

      setCurrentUserId(viewerId);
      setAuthChecked(true);

      if (!viewerId) {
        setLoading(false);
        return;
      }

      const { data } = await supabase
        .from("profiles")
        .select("*")
        .order("full_name", { ascending: true });

      setProfiles(data ?? []);

      if (viewerId) {
        const { data: follows } = await supabase
          .from("follows")
          .select("following_id")
          .eq("follower_id", viewerId);

        setFollowingIds(
          new Set((follows ?? []).map((follow) => follow.following_id))
        );
      }

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

  async function toggleFollow(
    event: MouseEvent<HTMLButtonElement>,
    profile: Profile
  ) {
    event.preventDefault();
    event.stopPropagation();

    setMessage("");

    if (!currentUserId) {
      window.location.href = "/login";
      return;
    }

    if (profile.id === currentUserId || workingFollowId) {
      return;
    }

    setWorkingFollowId(profile.id);

    try {
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
        setMessage(result.error ?? "Unable to update follow status.");
        return;
      }

      setFollowingIds((current) => {
        const next = new Set(current);

        if (result.following) {
          next.add(profile.id);
        } else {
          next.delete(profile.id);
        }

        return next;
      });

      setMessage(
        result.following
          ? `Following @${profile.username}.`
          : `Unfollowed @${profile.username}.`
      );
    } finally {
      setWorkingFollowId(null);
    }
  }

  if (!authChecked || loading) {
    return (
      <main className="min-h-screen bg-black px-6 py-16 text-white">
        <div className="mx-auto max-w-5xl">
          <p className="text-zinc-500">
            Loading people...
          </p>
        </div>
      </main>
    );
  }

  if (!currentUserId) {
    return (
      <main className="min-h-screen bg-black px-6 py-16 text-white">
        <div className="mx-auto max-w-3xl">
          <Link
            href="/discussions"
            className="mb-10 inline-block text-sm text-zinc-500 hover:text-white"
          >
            ← Back to discussions
          </Link>

          <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-6">
            <p className="mb-2 text-sm uppercase tracking-[0.25em] text-zinc-500">
              Login Required
            </p>

            <h1 className="mb-4 text-3xl font-medium">
              Log in to view People.
            </h1>

            <p className="mb-6 leading-relaxed text-zinc-400">
              The People directory is available to Loombus members only.
            </p>

            <div className="flex flex-wrap gap-3">
              <Link
                href="/login"
                className="rounded-full bg-white px-6 py-3 text-sm text-black transition hover:bg-zinc-200"
              >
                Log In
              </Link>

              <Link
                href="/signup"
                className="rounded-full border border-zinc-700 px-6 py-3 text-sm text-zinc-300 transition hover:border-zinc-500 hover:text-white"
              >
                Create Account
              </Link>
            </div>
          </div>
        </div>
      </main>
    );
  }

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

        {message && (
          <div className="mb-6 rounded-2xl border border-zinc-800 bg-zinc-950 p-4 text-sm text-zinc-400">
            {message}
          </div>
        )}

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
          {filteredProfiles.map((profile) => {
            const isSelf = currentUserId === profile.id;
            const isFollowing = followingIds.has(profile.id);
            const isWorking = workingFollowId === profile.id;

            return (
              <Link
                key={profile.id}
                href={profile.username ? `/u/${profile.username}` : "/people"}
                className="rounded-2xl border border-zinc-800 bg-zinc-950 p-6 transition hover:border-zinc-700"
              >
                <div className="mb-5 flex items-start justify-between gap-4">
                  <div className="flex min-w-0 items-center gap-4">
                    <ProfileAvatar profile={profile} size="xl" />

                    <div className="min-w-0">
                      <h2 className="truncate text-2xl font-medium">
                        {profile.full_name || profile.username || "Loombus member"}
                      </h2>

                      <p className="mt-1 text-sm text-zinc-500">
                        {profile.username ? `@${profile.username}` : "No username yet"}
                      </p>
                    </div>
                  </div>

                  {isSelf ? (
                    <span className="shrink-0 rounded-full border border-zinc-800 px-4 py-2 text-sm text-zinc-500">
                      You
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={(event) => toggleFollow(event, profile)}
                      disabled={isWorking}
                      className={`shrink-0 rounded-full px-4 py-2 text-sm transition disabled:cursor-not-allowed ${
                        isFollowing
                          ? "border border-zinc-700 text-zinc-300 hover:border-zinc-500 hover:text-white"
                          : "bg-white text-black hover:bg-zinc-200"
                      }`}
                    >
                      {isWorking ? "Updating..." : isFollowing ? "Following" : "Follow"}
                    </button>
                  )}
                </div>

                <p className="line-clamp-3 leading-relaxed text-zinc-400">
                  {profile.bio || "No bio yet."}
                </p>
              </Link>
            );
          })}
        </div>
      </div>
    </main>
  );
}
