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
      <main className="min-h-screen bg-black px-4 pb-24 pt-4 text-white sm:px-6 sm:py-12 lg:py-16">
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
      <main className="min-h-screen bg-black px-4 py-6 text-white sm:px-6 sm:py-12 lg:py-16">
        <div className="mx-auto max-w-3xl">
          <Link
            href="/discussions"
            className="mb-6 inline-block text-sm text-zinc-500 hover:text-white sm:mb-10"
          >
            ← Back to discussions
          </Link>

          <div className="rounded-3xl border border-zinc-800 bg-zinc-950 p-5 shadow-2xl shadow-black/30 sm:p-7">
            <p className="mb-2 text-sm uppercase tracking-[0.25em] text-zinc-500">
              Login Required
            </p>

            <h1 className="mb-3 text-2xl font-medium sm:text-3xl">
              Log in to view People.
            </h1>

            <p className="mb-5 text-sm leading-relaxed text-zinc-400 sm:mb-6 sm:text-base">
              The People directory is available to Loombus members only.
            </p>

            <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              <Link
                href="/login"
                className="rounded-full bg-white px-6 py-3 text-center text-sm text-black transition hover:bg-zinc-200"
              >
                Log In
              </Link>

              <Link
                href="/signup"
                className="rounded-full border border-zinc-700 px-6 py-3 text-center text-sm text-zinc-300 transition hover:border-zinc-500 hover:text-white"
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
    <main className="min-h-screen bg-black px-4 pb-24 pt-4 text-white sm:px-6 sm:py-10 lg:py-12 xl:pr-80">
      <div className="mx-auto max-w-[52rem]">
        <div className="people-shell-grid">
          <div className="min-w-0">
        <section className="mb-5 rounded-3xl border border-zinc-800 bg-zinc-950 p-4 shadow-2xl shadow-black/20 sm:mb-8 sm:p-6">
          <p className="mb-2 text-sm uppercase tracking-[0.25em] text-zinc-500">
            People
          </p>

          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl md:text-5xl">
            Find contributors
          </h1>

          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-zinc-500 sm:text-base">
            Discover people whose discussions, replies, and interests can make your feed more useful.
          </p>

          <label htmlFor="people-search" className="mt-5 block">
            <span className="mb-2 block text-sm font-medium text-zinc-300">
              Search people
            </span>

            <input
              id="people-search"
              type="text"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search by username, name, bio, interests, or projects..."
              className="w-full rounded-2xl border border-zinc-800 bg-black px-5 py-4 text-base text-white outline-none transition placeholder:text-zinc-700 focus:border-zinc-500 sm:text-lg"
            />
          </label>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            {hasActivePeopleSearch ? (
              <button
                type="button"
                onClick={resetPeopleSearch}
                className="rounded-full border border-zinc-800 px-3 py-1.5 text-xs text-zinc-500 transition hover:border-zinc-600 hover:text-white"
              >
                Clear search
              </button>
            ) : (
              <span className="rounded-full border border-zinc-900 bg-black px-3 py-1.5 text-xs text-zinc-600">
                Browse members
              </span>
            )}

            {!loading && (
              <span className="rounded-full border border-zinc-900 bg-black px-3 py-1.5 text-xs text-zinc-600">
                {filteredProfiles.length} of {profiles.length} members
              </span>
            )}
          </div>
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
          <div className="rounded-3xl border border-zinc-800 bg-zinc-950 p-5 shadow-2xl shadow-black/30 sm:p-7">
            <h2 className="mb-3 text-xl font-medium sm:text-2xl">
              No members found.
            </h2>

            <p className="max-w-2xl text-sm leading-relaxed text-zinc-400 sm:text-base">
              No visible members match the current search. Try a broader term or browse public discussions first.
            </p>

            <div className="mt-5 flex flex-col gap-3 sm:mt-6 sm:flex-row sm:flex-wrap">
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
            </div>
          </div>
        )}

        <div className="grid gap-3 pb-4 sm:gap-4 sm:pb-0 lg:grid-cols-2">
          {filteredProfiles.map((profile) => {
            const isSelf = currentUserId === profile.id;
            const isFollowing = followingIds.has(profile.id);
            const isWorking = workingFollowId === profile.id;
            const badge = profileBadges[profile.id];

            return (
              <Link
                key={profile.id}
                href={profile.username ? `/u/${profile.username}` : "/people"}
                className="group rounded-2xl border border-zinc-800 bg-zinc-950 p-4 shadow-xl shadow-black/15 transition hover:border-zinc-700 sm:p-5"
              >
                <div className="mb-3 flex items-start gap-3">
                  <ProfileAvatar profile={profile} size="xl" />

                  <div className="min-w-0 flex-1">
                    <h2 className="truncate text-lg font-semibold tracking-tight transition group-hover:text-white sm:text-xl">
                      {profile.full_name || profile.username || "Loombus member"}
                    </h2>

                    <div className="mt-1.5 flex flex-wrap items-center gap-2">
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

                <p className="line-clamp-2 text-sm leading-relaxed text-zinc-400 sm:text-base">
                  {profile.bio || "No bio yet."}
                </p>

                <div className="mt-4 flex flex-col gap-3 border-t border-zinc-900 pt-4 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-xs text-zinc-600 sm:text-sm">
                    {(followCounts[profile.id]?.followers ?? 0).toLocaleString()} followers ·{" "}
                    {(followCounts[profile.id]?.following ?? 0).toLocaleString()} following
                  </p>

                  {isSelf ? (
                    <span className="rounded-full border border-zinc-800 px-4 py-2 text-center text-sm text-zinc-500">
                      You
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={(event) => toggleFollow(event, profile)}
                      disabled={isWorking}
                      className={`rounded-full px-4 py-2 text-center text-sm transition disabled:cursor-not-allowed ${
                        isFollowing
                          ? "border border-zinc-700 text-zinc-300 hover:border-zinc-500 hover:text-white"
                          : "bg-white text-black hover:bg-zinc-200"
                      }`}
                    >
                      {isWorking ? "Updating..." : isFollowing ? "Following" : "Follow"}
                    </button>
                  )}
                </div>

                <p className="mt-3 text-xs text-zinc-500">
                  View profile →
                </p>
              </Link>
            );
          })}
        </div>
          </div>

          <aside className="fixed inset-y-0 right-0 z-30 hidden w-80 overflow-y-auto border-l border-zinc-900 bg-black/95 px-4 py-6 backdrop-blur-xl xl:block">
            <div className="space-y-4">
              <section className="overflow-hidden rounded-3xl border border-zinc-800 bg-zinc-950 shadow-2xl shadow-black/20">
                <div className="border-b border-zinc-900 p-5">
                  <p className="mb-2 text-xs uppercase tracking-[0.25em] text-zinc-600">
                    Contributor Panel
                  </p>

                  <h2 className="text-xl font-semibold tracking-tight">
                    Follow for signal.
                  </h2>

                  <p className="mt-3 text-sm leading-relaxed text-zinc-500">
                    Build a feed around people who add context, experience, evidence, questions, or better framing.
                  </p>
                </div>

                <div className="grid grid-cols-2 border-b border-zinc-900">
                  <div className="border-r border-zinc-900 p-4">
                    <p className="text-xs uppercase tracking-[0.18em] text-zinc-700">
                      Showing
                    </p>
                    <p className="mt-2 text-lg font-semibold text-zinc-200">
                      {filteredProfiles.length}
                    </p>
                  </div>

                  <div className="p-4">
                    <p className="text-xs uppercase tracking-[0.18em] text-zinc-700">
                      Total
                    </p>
                    <p className="mt-2 text-lg font-semibold text-zinc-200">
                      {profiles.length}
                    </p>
                  </div>
                </div>

                <div className="p-5">
                  <Link
                    href="/discussions"
                    className="inline-flex w-full justify-center rounded-full bg-white px-5 py-3 text-sm font-medium text-black transition hover:bg-zinc-200"
                  >
                    Browse discussions
                  </Link>
                </div>
              </section>

              <section className="rounded-3xl border border-zinc-800 bg-zinc-950 p-5 shadow-2xl shadow-black/20">
                <p className="mb-3 text-xs uppercase tracking-[0.22em] text-zinc-600">
                  Contributor standard
                </p>

                <div className="space-y-3 text-sm leading-relaxed text-zinc-500">
                  <p className="rounded-2xl border border-zinc-900 bg-black p-3">
                    Look for people whose replies make discussions clearer.
                  </p>

                  <p className="rounded-2xl border border-zinc-900 bg-black p-3">
                    Follow contributors with useful context, not just frequent activity.
                  </p>

                  <p className="rounded-2xl border border-zinc-900 bg-black p-3">
                    A good network should make your feed slower, deeper, and more useful.
                  </p>
                </div>
              </section>

              <section className="rounded-3xl border border-zinc-800 bg-zinc-950 p-5 shadow-2xl shadow-black/20">
                <p className="mb-3 text-xs uppercase tracking-[0.22em] text-zinc-600">
                  Discovery lens
                </p>

                <div className="space-y-2">
                  <div className="rounded-2xl border border-zinc-900 bg-black p-3">
                    <p className="text-xs uppercase tracking-[0.18em] text-zinc-700">
                      View
                    </p>
                    <p className="mt-1 text-sm text-zinc-300">
                      {hasActivePeopleSearch ? `Search: “${activePeopleSearch}”` : "Browse members"}
                    </p>
                  </div>

                  <div className="rounded-2xl border border-zinc-900 bg-black p-3">
                    <p className="text-xs uppercase tracking-[0.18em] text-zinc-700">
                      Following
                    </p>
                    <p className="mt-1 text-sm text-zinc-300">
                      {followingIds.size}
                    </p>
                  </div>
                </div>

                {hasActivePeopleSearch && (
                  <button
                    type="button"
                    onClick={resetPeopleSearch}
                    className="mt-4 w-full rounded-full border border-zinc-800 px-4 py-2 text-sm text-zinc-500 transition hover:border-zinc-600 hover:text-white"
                  >
                    Reset discovery
                  </button>
                )}
              </section>

              <section className="rounded-3xl border border-zinc-800 bg-zinc-950 p-5 shadow-2xl shadow-black/20">
                <p className="mb-3 text-xs uppercase tracking-[0.22em] text-zinc-600">
                  Profile signal
                </p>

                <p className="text-sm leading-relaxed text-zinc-500">
                  A useful profile gives enough context to understand someone’s lens: what they care about, what they have lived, and what they can contribute.
                </p>

                <div className="mt-4 grid gap-2">
                  <Link
                    href="/profile"
                    className="inline-flex justify-center rounded-full border border-zinc-800 px-4 py-2 text-sm text-zinc-400 transition hover:border-zinc-600 hover:text-white"
                  >
                    Improve profile
                  </Link>

                  <Link
                    href="/search"
                    className="inline-flex justify-center rounded-full border border-zinc-800 px-4 py-2 text-sm text-zinc-400 transition hover:border-zinc-600 hover:text-white"
                  >
                    Search Loombus
                  </Link>
                </div>
              </section>
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}
