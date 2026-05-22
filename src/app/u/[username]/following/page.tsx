"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import { ProfileAvatar, getProfileDisplayName } from "@/components/profile-avatar";

type Profile = {
  id: string;
  full_name: string | null;
  username: string | null;
  bio: string | null;
  avatar_url: string | null;
};

type FollowRow = {
  follower_id?: string;
  following_id?: string;
};

type FollowListMode = "followers" | "following";

const MODE = "following" as FollowListMode;

export default function FollowListPage() {
  const params = useParams();
  const username = params.username as string;

  const [ownerProfile, setOwnerProfile] = useState<Profile | null>(null);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadFollowList() {
      const { data: userData } = await supabase.auth.getUser();

      if (!userData.user) {
        setIsLoggedIn(false);
        setAuthChecked(true);
        setLoading(false);
        return;
      }

      setIsLoggedIn(true);
      setAuthChecked(true);

      const { data: owner } = await supabase
        .from("profiles")
        .select("id, full_name, username, bio, avatar_url")
        .eq("username", username)
        .maybeSingle();

      if (!owner) {
        setOwnerProfile(null);
        setLoading(false);
        return;
      }

      setOwnerProfile(owner);

      const { data: follows } = await supabase
        .from("follows")
        .select(MODE === "followers" ? "follower_id" : "following_id")
        .eq(MODE === "followers" ? "following_id" : "follower_id", owner.id);

      const ids = [
        ...new Set(
          ((follows ?? []) as FollowRow[])
            .map((follow) =>
              MODE === "followers" ? follow.follower_id : follow.following_id
            )
            .filter((id): id is string => Boolean(id))
        ),
      ];

      if (ids.length === 0) {
        setProfiles([]);
        setLoading(false);
        return;
      }

      const { data: profileData } = await supabase
        .from("profiles")
        .select("id, full_name, username, bio, avatar_url")
        .in("id", ids)
        .order("full_name", { ascending: true });

      setProfiles((profileData ?? []) as Profile[]);
      setLoading(false);
    }

    loadFollowList();
  }, [username]);

  const title = MODE === "followers" ? "Followers" : "Following";
  const emptyText =
    MODE === "followers"
      ? "No followers yet."
      : "This member is not following anyone yet.";

  const filteredProfiles = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    if (!query) {
      return profiles;
    }

    return profiles.filter((profile) => {
      return (
        (profile.full_name ?? "").toLowerCase().includes(query) ||
        (profile.username ?? "").toLowerCase().includes(query) ||
        (profile.bio ?? "").toLowerCase().includes(query)
      );
    });
  }, [profiles, searchQuery]);

  if (!authChecked || loading) {
    return (
      <main className="min-h-screen bg-black px-6 py-16 text-white">
        <div className="mx-auto max-w-6xl text-zinc-400">
          Loading {title.toLowerCase()}...
        </div>
      </main>
    );
  }

  if (!isLoggedIn) {
    return (
      <main className="min-h-screen bg-black px-6 py-16 text-white">
        <div className="mx-auto max-w-3xl">
          <Link
            href={`/u/${username}`}
            className="mb-10 inline-block text-sm text-zinc-500 hover:text-white"
          >
            ← Back to profile
          </Link>

          <div className="rounded-3xl border border-zinc-800 bg-zinc-950 p-7 shadow-2xl shadow-black/30">
            <p className="mb-2 text-sm uppercase tracking-[0.25em] text-zinc-500">
              Login Required
            </p>

            <h1 className="mb-4 text-3xl font-medium">
              Log in to view {title.toLowerCase()}.
            </h1>

            <p className="mb-6 leading-relaxed text-zinc-400">
              Follow lists are available to Loombus members only.
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

  if (!ownerProfile) {
    return (
      <main className="min-h-screen bg-black px-6 py-16 text-white">
        <div className="mx-auto max-w-6xl">
          <h1 className="text-5xl font-semibold tracking-tight md:text-6xl">
            User not found.
          </h1>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-black px-6 py-16 text-white">
      <div className="mx-auto max-w-6xl">
        <Link
          href={`/u/${ownerProfile.username}`}
          className="mb-10 inline-block text-sm text-zinc-500 hover:text-white"
        >
          ← Back to profile
        </Link>

        <div className="mb-10 flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="mb-4 text-sm uppercase tracking-[0.3em] text-zinc-500">
              @{ownerProfile.username}
            </p>

            <h1 className="text-5xl font-semibold tracking-tight md:text-6xl">
              {title}
            </h1>

            <p className="mt-4 text-zinc-500">
              {profiles.length} {profiles.length === 1 ? "member" : "members"}
            </p>
          </div>

          <div className="flex items-center gap-3 rounded-3xl border border-zinc-800 bg-zinc-950 p-5">
            <ProfileAvatar profile={ownerProfile} size="xl" />

            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-zinc-600">
                Profile
              </p>

              <p className="mt-1 text-sm text-zinc-300">
                {getProfileDisplayName(ownerProfile)}
              </p>
            </div>
          </div>
        </div>

        {profiles.length > 0 && (
          <div className="mb-8">
            <input
              type="text"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder={`Search ${title.toLowerCase()} by name, username, or bio...`}
              className="w-full rounded-2xl border border-zinc-800 bg-zinc-950 px-5 py-4 text-white outline-none transition placeholder:text-zinc-600 focus:border-zinc-600"
            />

            <p className="mt-3 text-sm text-zinc-600">
              Showing {filteredProfiles.length} of {profiles.length} {profiles.length === 1 ? "member" : "members"}
            </p>
          </div>
        )}

        {profiles.length === 0 ? (
          <div className="rounded-3xl border border-zinc-800 bg-zinc-950 p-8 shadow-2xl shadow-black/30">
            <h2 className="mb-3 text-2xl font-medium">
              {emptyText}
            </h2>

            <p className="text-zinc-400">
              Follow connections will appear here.
            </p>
          </div>
        ) : filteredProfiles.length === 0 ? (
          <div className="rounded-3xl border border-zinc-800 bg-zinc-950 p-8 shadow-2xl shadow-black/30">
            <h2 className="mb-3 text-2xl font-medium">
              No members found.
            </h2>

            <p className="text-zinc-400">
              No profiles match your current search.
            </p>
          </div>
        ) : (
          <div className="grid gap-5 lg:grid-cols-2">
            {filteredProfiles.map((profile) => (
              <Link
                key={profile.id}
                href={profile.username ? `/u/${profile.username}` : "#"}
                className="rounded-3xl border border-zinc-800 bg-zinc-950 p-7 shadow-2xl shadow-black/30 transition hover:-translate-y-0.5 hover:border-zinc-700"
              >
                <div className="mb-5 flex items-center gap-4">
                  <ProfileAvatar profile={profile} size="xl" />

                  <div className="min-w-0">
                    <h2 className="truncate text-2xl font-medium">
                      {getProfileDisplayName(profile)}
                    </h2>

                    {profile.username && (
                      <p className="mt-1 text-sm text-zinc-500">
                        @{profile.username}
                      </p>
                    )}
                  </div>
                </div>

                <p className="line-clamp-3 leading-relaxed text-zinc-400">
                  {profile.bio || "No bio yet."}
                </p>
              </Link>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
