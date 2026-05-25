"use client";

import Link from "next/link";
import { type MouseEvent, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { ProfileAvatar } from "@/components/profile-avatar";

type Profile = {
  id: string;
  full_name: string | null;
  username: string | null;
  avatar_url: string | null;
  bio: string | null;
};

type FollowCounts = Record<
  string,
  {
    followers: number;
    following: number;
  }
>;


type BlockRow = {
  blocker_id: string;
  blocked_id: string;
};

type ProfileBadge = {
  key: "premium" | "premium_plus" | "admin";
  label: string;
};

function getBadgeClassName(badge: ProfileBadge) {
  if (badge.key === "admin") {
    return "border-sky-800 bg-sky-950/40 text-sky-300";
  }

  if (badge.key === "premium_plus") {
    return "border-violet-800 bg-violet-950/40 text-violet-300";
  }

  return "border-emerald-800 bg-emerald-950/40 text-emerald-300";
}

export default function PeoplePage() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [followingIds, setFollowingIds] = useState<Set<string>>(new Set());
  const [followCounts, setFollowCounts] = useState<FollowCounts>({});
  const [blockedProfileIds, setBlockedProfileIds] = useState<Set<string>>(new Set());
  const [profileBadges, setProfileBadges] = useState<Record<string, ProfileBadge>>({});
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [workingFollowId, setWorkingFollowId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const loadingRef = useRef(true);

  useEffect(() => {
    loadingRef.current = loading;
  }, [loading]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      if (!loadingRef.current) {
        return;
      }

      setMessage((current) =>
        current || "People took too long to load. Please refresh if the list looks incomplete."
      );
      setAuthChecked(true);
      setLoading(false);
    }, 10000);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, []);

  useEffect(() => {
    let isMounted = true;

    async function loadProfileBadges(profileIds: string[]) {
      if (profileIds.length === 0) {
        return;
      }

      try {
        const badgeResponse = await fetch("/api/profiles/badges", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ profileIds }),
        });

        if (!badgeResponse.ok || !isMounted) {
          return;
        }

        const badgeResult = (await badgeResponse.json()) as {
          badges?: Record<string, ProfileBadge>;
        };

        if (isMounted) {
          setProfileBadges(badgeResult.badges ?? {});
        }
      } catch (error) {
        console.error("Unable to load profile badges.", error);
      }
    }

    async function loadProfiles() {
      try {
        const { data: userData } = await supabase.auth.getUser();
        const viewerId = userData.user?.id ?? null;

        if (!isMounted) {
          return;
        }

        setCurrentUserId(viewerId);
        setAuthChecked(true);

        if (!viewerId) {
          setLoading(false);
          return;
        }

        const [profilesResult, followsResult, blocksResult] = await Promise.all([
          supabase
            .from("profiles")
            .select("id, full_name, username, avatar_url, bio")
            .order("full_name", { ascending: true }),
          supabase
            .from("follows")
            .select("following_id")
            .eq("follower_id", viewerId),
          supabase
            .from("user_blocks")
            .select("blocker_id, blocked_id")
            .or(`blocker_id.eq.${viewerId},blocked_id.eq.${viewerId}`),
        ]);

        const firstError =
          profilesResult.error || followsResult.error || blocksResult.error;

        if (firstError) {
          throw firstError;
        }

        if (!isMounted) {
          return;
        }

        const loadedProfiles = (profilesResult.data ?? []) as Profile[];
        setProfiles(loadedProfiles);

        setFollowingIds(
          new Set(
            (followsResult.data ?? []).map((follow) => follow.following_id)
          )
        );

        const hiddenIds = new Set<string>();

        for (const block of (blocksResult.data ?? []) as BlockRow[]) {
          hiddenIds.add(
            block.blocker_id === viewerId ? block.blocked_id : block.blocker_id
          );
        }

        setBlockedProfileIds(hiddenIds);

        const visibleProfileIds = loadedProfiles.map((profile) => profile.id);
        const nextFollowCounts: FollowCounts = Object.fromEntries(
          visibleProfileIds.map((profileId) => [
            profileId,
            { followers: 0, following: 0 },
          ])
        );

        if (visibleProfileIds.length > 0) {
          const [followersResult, followingResult] = await Promise.all([
            supabase
              .from("follows")
              .select("following_id")
              .in("following_id", visibleProfileIds),
            supabase
              .from("follows")
              .select("follower_id")
              .in("follower_id", visibleProfileIds),
          ]);

          if (followersResult.error || followingResult.error) {
            console.error(
              "Unable to load People follow counts.",
              followersResult.error ?? followingResult.error
            );
          } else {
            (followersResult.data ?? []).forEach((row) => {
              const profileId = (row as { following_id: string | null }).following_id;

              if (profileId && nextFollowCounts[profileId]) {
                nextFollowCounts[profileId].followers += 1;
              }
            });

            (followingResult.data ?? []).forEach((row) => {
              const profileId = (row as { follower_id: string | null }).follower_id;

              if (profileId && nextFollowCounts[profileId]) {
                nextFollowCounts[profileId].following += 1;
              }
            });
          }
        }

        setFollowCounts(nextFollowCounts);
        setLoading(false);
        void loadProfileBadges(visibleProfileIds);
      } catch (error) {
        console.error("Unable to load people.", error);

        if (isMounted) {
          setMessage("People could not load. Please refresh and try again.");
          setAuthChecked(true);
          setLoading(false);
        }
      }
    }

    loadProfiles();

    return () => {
      isMounted = false;
    };
  }, []);

  const filteredProfiles = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    const visibleProfiles = profiles.filter(
      (profile) => !blockedProfileIds.has(profile.id)
    );

    if (!query) {
      return visibleProfiles;
    }

    return visibleProfiles.filter((profile) => {
      return (
        (profile.username ?? "").toLowerCase().includes(query) ||
        (profile.full_name ?? "").toLowerCase().includes(query) ||
        (profile.bio ?? "").toLowerCase().includes(query)
      );
    });
  }, [profiles, searchQuery, blockedProfileIds]);

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

  const activePeopleSearch = searchQuery.trim();
  const hasActivePeopleSearch = activePeopleSearch.length > 0;

  function resetPeopleSearch() {
    setSearchQuery("");
  }

  if (!authChecked || loading) {
    return (
      <main className="min-h-screen bg-black px-6 py-16 text-white">
        <div className="mx-auto max-w-6xl">
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

          <div className="rounded-3xl border border-zinc-800 bg-zinc-950 p-7 shadow-2xl shadow-black/30">
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
      <div className="mx-auto max-w-6xl">
        <div className="mb-10">
          <h1 className="text-5xl font-semibold tracking-tight md:text-6xl">
            People
          </h1>

          <p className="mt-3 text-zinc-500">
            Discover thoughtful contributors across Loombus.
          </p>
        </div>

        <section className="mb-8 rounded-2xl border border-zinc-800 bg-zinc-950 p-6">
          <p className="mb-2 text-sm uppercase tracking-[0.25em] text-zinc-500">
            Finding people
          </p>

          <h2 className="mb-4 text-2xl font-medium">
            Follow contributors for signal, not noise.
          </h2>

          <p className="mb-5 max-w-3xl text-sm leading-relaxed text-zinc-500">
            Loombus works best when you follow people whose discussions, replies,
            and areas of interest help you think more clearly. Start small and
            build a network around useful contribution.
          </p>

          <div className="grid gap-4 md:grid-cols-3">
            <div className="rounded-2xl border border-zinc-900 bg-black p-4">
              <p className="mb-2 text-sm font-medium text-zinc-300">
                Read the bio
              </p>

              <p className="text-sm leading-relaxed text-zinc-600">
                Look for interests, experience, projects, or discussion themes that match what you care about.
              </p>
            </div>

            <div className="rounded-2xl border border-zinc-900 bg-black p-4">
              <p className="mb-2 text-sm font-medium text-zinc-300">
                Check contribution style
              </p>

              <p className="text-sm leading-relaxed text-zinc-600">
                Follow people who add context, questions, examples, or better framing.
              </p>
            </div>

            <div className="rounded-2xl border border-zinc-900 bg-black p-4">
              <p className="mb-2 text-sm font-medium text-zinc-300">
                Keep the feed useful
              </p>

              <p className="text-sm leading-relaxed text-zinc-600">
                Your following feed should help you revisit thoughtful contributors, not chase popularity.
              </p>
            </div>
          </div>
        </section>

        <section className="mb-8 rounded-2xl border border-zinc-800 bg-zinc-950 p-5">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="flex-1">
              <label htmlFor="people-search" className="mb-3 block text-sm font-medium text-zinc-300">
                Search members
              </label>

              <input
                id="people-search"
                type="text"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Search by username, name, bio, interests, or projects..."
                className="w-full rounded-xl border border-zinc-800 bg-black px-4 py-3 text-white outline-none transition placeholder:text-zinc-700 focus:border-zinc-500"
              />
            </div>

            {hasActivePeopleSearch && (
              <button
                type="button"
                onClick={resetPeopleSearch}
                className="w-fit rounded-full border border-zinc-700 px-5 py-3 text-sm text-zinc-300 transition hover:border-zinc-500 hover:text-white"
              >
                Clear search
              </button>
            )}
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            {hasActivePeopleSearch ? (
              <span className="rounded-full border border-zinc-800 bg-black px-3 py-1.5 text-xs font-medium text-zinc-400">
                Search: “{activePeopleSearch}”
              </span>
            ) : (
              <p className="text-sm text-zinc-600">
                Search scans usernames, names, and bios so you can find contributors by interest or context.
              </p>
            )}
          </div>

          {!loading && (
            <p className="mt-3 text-sm text-zinc-600">
              Showing {filteredProfiles.length} of {profiles.length} members
            </p>
          )}
        </section>

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
          <div className="rounded-3xl border border-zinc-800 bg-zinc-950 p-7 shadow-2xl shadow-black/30">
            <h2 className="mb-3 text-2xl font-medium">
              No members found.
            </h2>

            <p className="max-w-2xl text-zinc-400">
              No visible members match the current search. Try a broader term, browse public discussions first, or return to onboarding for suggested topic lanes.
            </p>

            <div className="mt-6 flex flex-wrap gap-3">
              {hasActivePeopleSearch && (
                <button
                  type="button"
                  onClick={resetPeopleSearch}
                  className="rounded-full bg-white px-5 py-3 text-sm text-black transition hover:bg-zinc-200"
                >
                  Clear search
                </button>
              )}

              <Link
                href="/discussions"
                className="rounded-full border border-zinc-700 px-5 py-3 text-sm text-zinc-300 transition hover:border-zinc-500 hover:text-white"
              >
                Browse discussions
              </Link>

              <Link
                href="/onboarding"
                className="rounded-full border border-zinc-700 px-5 py-3 text-sm text-zinc-300 transition hover:border-zinc-500 hover:text-white"
              >
                Open setup guide
              </Link>
            </div>
          </div>
        )}

        <div className="grid gap-5 lg:grid-cols-2">
          {filteredProfiles.map((profile) => {
            const isSelf = currentUserId === profile.id;
            const isFollowing = followingIds.has(profile.id);
            const isWorking = workingFollowId === profile.id;
            const badge = profileBadges[profile.id];

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

                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <p className="text-sm text-zinc-500">
                          {profile.username ? `@${profile.username}` : "No username yet"}
                        </p>

                        {badge && (
                          <span
                            className={`rounded-full border px-2.5 py-1 text-[0.7rem] font-medium ${getBadgeClassName(badge)}`}
                          >
                            {badge.label}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <p className="mt-4 text-xs text-zinc-500">
                    {(followCounts[profile.id]?.followers ?? 0).toLocaleString()} followers ·{" "}
                    {(followCounts[profile.id]?.following ?? 0).toLocaleString()} following
                  </p>

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
