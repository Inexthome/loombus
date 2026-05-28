"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { ProfileAvatar, getProfileDisplayName } from "@/components/profile-avatar";

type Discussion = {
  id: string;
  title: string;
  topic: string;
  body: string;
  created_at: string;
  user_id: string;
};

type Profile = {
  id: string;
  username: string | null;
  full_name: string | null;
  avatar_url: string | null;
  bio: string | null;
};

type BlockRow = {
  blocker_id: string;
  blocked_id: string;
};

export default function SearchPage() {
  const [query, setQuery] = useState("");
  const [discussions, setDiscussions] = useState<Discussion[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [profileMap, setProfileMap] = useState<Record<string, Profile>>({});
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [blockedProfileIds, setBlockedProfileIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let isMounted = true;

    async function loadSearchData() {
      try {
        const { data: userData } = await supabase.auth.getUser();
        const viewerId = userData.user?.id ?? null;

        if (!isMounted) {
          return;
        }

        setCurrentUserId(viewerId);

        const hiddenProfileIds = new Set<string>();

        if (viewerId) {
          const { data: blockRows } = await supabase
            .from("user_blocks")
            .select("blocker_id, blocked_id")
            .or(`blocker_id.eq.${viewerId},blocked_id.eq.${viewerId}`);

          for (const block of (blockRows ?? []) as BlockRow[]) {
            hiddenProfileIds.add(
              block.blocker_id === viewerId ? block.blocked_id : block.blocker_id
            );
          }
        }

        setBlockedProfileIds(hiddenProfileIds);

        const { data: discussionData, error: discussionError } = await supabase
          .from("discussions")
          .select("id, title, topic, body, created_at, user_id")
          .is("deleted_at", null)
          .order("created_at", { ascending: false })
          .limit(100);

        if (discussionError) {
          throw discussionError;
        }

        const visibleDiscussions = ((discussionData ?? []) as Discussion[]).filter(
          (discussion) => !hiddenProfileIds.has(discussion.user_id)
        );

        if (!isMounted) {
          return;
        }

        setDiscussions(visibleDiscussions);

        const discussionUserIds = [
          ...new Set(visibleDiscussions.map((discussion) => discussion.user_id)),
        ];

        const profileIdsToLoad = new Set<string>(discussionUserIds);

        if (viewerId) {
          const { data: peopleData, error: peopleError } = await supabase
            .from("profiles")
            .select("id, username, full_name, avatar_url, bio")
            .order("full_name", { ascending: true })
            .limit(100);

          if (peopleError) {
            throw peopleError;
          }

          const visibleProfiles = ((peopleData ?? []) as Profile[]).filter(
            (profile) => !hiddenProfileIds.has(profile.id)
          );

          setProfiles(visibleProfiles);

          for (const profile of visibleProfiles) {
            profileIdsToLoad.add(profile.id);
          }
        }

        if (profileIdsToLoad.size > 0) {
          const { data: profileRows } = await supabase
            .from("profiles")
            .select("id, username, full_name, avatar_url, bio")
            .in("id", [...profileIdsToLoad]);

          const nextProfileMap: Record<string, Profile> = {};

          for (const profile of (profileRows ?? []) as Profile[]) {
            nextProfileMap[profile.id] = profile;
          }

          if (isMounted) {
            setProfileMap(nextProfileMap);
          }
        }

        if (isMounted) {
          setLoading(false);
        }
      } catch (error) {
        console.error("Unable to load search data.", error);

        if (isMounted) {
          setMessage("Search could not load. Please refresh and try again.");
          setLoading(false);
        }
      }
    }

    loadSearchData();

    return () => {
      isMounted = false;
    };
  }, []);

  const cleanQuery = query.trim().toLowerCase();

  const discussionResults = useMemo(() => {
    if (!cleanQuery) {
      return discussions.slice(0, 8);
    }

    return discussions
      .filter((discussion) => {
        const author = profileMap[discussion.user_id];

        return (
          discussion.title.toLowerCase().includes(cleanQuery) ||
          discussion.body.toLowerCase().includes(cleanQuery) ||
          discussion.topic.toLowerCase().includes(cleanQuery) ||
          (author?.username ?? "").toLowerCase().includes(cleanQuery) ||
          (author?.full_name ?? "").toLowerCase().includes(cleanQuery)
        );
      })
      .slice(0, 12);
  }, [cleanQuery, discussions, profileMap]);

  const peopleResults = useMemo(() => {
    if (!currentUserId) {
      return [];
    }

    const visibleProfiles = profiles.filter(
      (profile) => !blockedProfileIds.has(profile.id)
    );

    if (!cleanQuery) {
      return visibleProfiles.slice(0, 8);
    }

    return visibleProfiles
      .filter((profile) => {
        return (
          (profile.username ?? "").toLowerCase().includes(cleanQuery) ||
          (profile.full_name ?? "").toLowerCase().includes(cleanQuery) ||
          (profile.bio ?? "").toLowerCase().includes(cleanQuery)
        );
      })
      .slice(0, 12);
  }, [blockedProfileIds, cleanQuery, currentUserId, profiles]);

  return (
    <main className="min-h-screen bg-black px-4 pb-24 pt-4 text-white sm:px-6 sm:py-12 lg:py-16">
      <div className="mx-auto max-w-3xl">
        <Link
          href="/"
          className="mb-5 inline-block text-sm text-zinc-500 hover:text-white sm:mb-10"
        >
          ← Back home
        </Link>

        <p className="mb-2 text-xs uppercase tracking-[0.22em] text-zinc-500 sm:mb-3 sm:text-sm sm:tracking-[0.3em]">
          Search Loombus
        </p>

        <h1 className="mb-3 text-2xl font-semibold tracking-tight sm:mb-4 sm:text-4xl md:text-5xl">
          Find signal faster.
        </h1>

        <p className="mb-5 text-sm leading-relaxed text-zinc-500 sm:mb-8 sm:text-base">
          Search discussions first. Members can also search people.
        </p>

        <section className="mb-5 rounded-2xl border border-zinc-800 bg-zinc-950 p-4 sm:mb-8 sm:rounded-3xl sm:p-6">
          <label htmlFor="global-search" className="mb-2 block text-sm font-medium text-zinc-300">
            Search
          </label>

          <input
            id="global-search"
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search discussions, topics, or people..."
            autoFocus
            className="w-full rounded-2xl border border-zinc-800 bg-black px-4 py-3 text-base text-white outline-none transition placeholder:text-zinc-700 focus:border-zinc-500"
          />

          <div className="mt-3 flex flex-wrap gap-2">
            {query.trim() && (
              <button
                type="button"
                onClick={() => setQuery("")}
                className="rounded-full border border-zinc-800 px-3 py-1.5 text-xs text-zinc-500 transition hover:border-zinc-600 hover:text-white"
              >
                Clear
              </button>
            )}

            <span className="rounded-full border border-zinc-900 bg-black px-3 py-1.5 text-xs text-zinc-600">
              {loading ? "Loading..." : `${discussionResults.length} discussion results`}
            </span>

            {currentUserId && (
              <span className="rounded-full border border-zinc-900 bg-black px-3 py-1.5 text-xs text-zinc-600">
                {peopleResults.length} people results
              </span>
            )}
          </div>
        </section>

        {message && (
          <p className="mb-5 rounded-2xl border border-zinc-800 bg-zinc-950 p-4 text-sm text-zinc-400">
            {message}
          </p>
        )}

        <section className="mb-6">
          <div className="mb-3 flex items-end justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-zinc-600">
                Discussions
              </p>
              <h2 className="mt-1 text-xl font-medium">Signal threads</h2>
            </div>

            <Link
              href="/discussions"
              className="text-sm text-zinc-500 transition hover:text-white"
            >
              View all
            </Link>
          </div>

          {loading ? (
            <p className="text-sm text-zinc-500">Loading discussions...</p>
          ) : discussionResults.length === 0 ? (
            <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-5 text-sm text-zinc-500">
              No discussions match this search.
            </div>
          ) : (
            <div className="space-y-3">
              {discussionResults.map((discussion) => {
                const author = profileMap[discussion.user_id];

                return (
                  <Link
                    key={discussion.id}
                    href={`/discussions/${discussion.id}`}
                    className="block rounded-2xl border border-zinc-800 bg-zinc-950 p-4 shadow-2xl shadow-black/20 transition hover:border-zinc-700"
                  >
                    <div className="mb-2 flex items-center justify-between gap-3">
                      <span className="shrink-0 rounded-full border border-zinc-800 bg-black px-3 py-1 text-[10px] font-medium uppercase tracking-[0.16em] text-zinc-500">
                        {discussion.topic}
                      </span>

                      <span className="text-xs text-zinc-700">
                        {new Date(discussion.created_at).toLocaleDateString()}
                      </span>
                    </div>

                    <h3 className="mb-2 line-clamp-2 text-base font-semibold leading-snug text-zinc-100">
                      {discussion.title}
                    </h3>

                    <p className="mb-3 line-clamp-2 text-sm leading-relaxed text-zinc-500">
                      {discussion.body}
                    </p>

                    <p className="text-xs text-zinc-700">
                      by {author ? getProfileDisplayName(author) : "Loombus member"}
                    </p>
                  </Link>
                );
              })}
            </div>
          )}
        </section>

        <section>
          <div className="mb-3 flex items-end justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-zinc-600">
                People
              </p>
              <h2 className="mt-1 text-xl font-medium">Contributors</h2>
            </div>

            <Link
              href={currentUserId ? "/people" : "/login"}
              className="text-sm text-zinc-500 transition hover:text-white"
            >
              {currentUserId ? "View all" : "Log in"}
            </Link>
          </div>

          {!currentUserId ? (
            <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-5 text-sm leading-relaxed text-zinc-500">
              Log in to search people and build your Loombus network.
            </div>
          ) : loading ? (
            <p className="text-sm text-zinc-500">Loading people...</p>
          ) : peopleResults.length === 0 ? (
            <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-5 text-sm text-zinc-500">
              No people match this search.
            </div>
          ) : (
            <div className="space-y-3">
              {peopleResults.map((profile) => (
                <Link
                  key={profile.id}
                  href={profile.username ? `/u/${profile.username}` : "/people"}
                  className="flex items-center gap-3 rounded-2xl border border-zinc-800 bg-zinc-950 p-4 shadow-2xl shadow-black/20 transition hover:border-zinc-700"
                >
                  <ProfileAvatar profile={profile} size="md" />

                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-zinc-100">
                      {getProfileDisplayName(profile)}
                    </p>
                    <p className="mt-1 truncate text-xs text-zinc-600">
                      {profile.username ? `@${profile.username}` : "No username yet"}
                    </p>
                    {profile.bio && (
                      <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-zinc-500">
                        {profile.bio}
                      </p>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
