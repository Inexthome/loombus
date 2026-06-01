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
    <main className="min-h-screen bg-black px-4 pb-24 pt-4 text-white sm:px-6 sm:py-10 lg:py-12 loombus-shell-with-right-rail">
      <div className="mx-auto max-w-[42rem]">
        <div className="search-shell-grid">
          <div className="min-w-0">
        <Link
          href="/"
          className="mb-5 inline-block text-sm text-zinc-500 hover:text-white sm:mb-10"
        >
          ← Back home
        </Link>

        <section className="mb-5 rounded-3xl border border-zinc-800 bg-zinc-950 p-4 shadow-2xl shadow-black/20 sm:mb-8 sm:p-6">
          <p className="mb-2 text-sm uppercase tracking-[0.25em] text-zinc-500">
            Search
          </p>

          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl md:text-5xl">
            Search across Loombus
          </h1>

          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-zinc-500 sm:text-base">
            Find discussions, topics, contributors, and useful signals faster.
          </p>

          <label htmlFor="global-search" className="mt-5 block">
            <span className="mb-2 block text-sm font-medium text-zinc-300">
              What are you looking for?
            </span>

            <input
              id="global-search"
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search discussions, topics, people, or ideas..."
              autoFocus
              className="w-full rounded-2xl border border-zinc-800 bg-black px-5 py-4 text-base text-white outline-none transition placeholder:text-zinc-700 focus:border-zinc-500 sm:text-lg"
            />
          </label>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            {query.trim() ? (
              <button
                type="button"
                onClick={() => setQuery("")}
                className="rounded-full border border-zinc-800 px-3 py-1.5 text-xs text-zinc-500 transition hover:border-zinc-600 hover:text-white"
              >
                Clear search
              </button>
            ) : (
              <span className="rounded-full border border-zinc-900 bg-black px-3 py-1.5 text-xs text-zinc-600">
                Showing recent signal
              </span>
            )}

            <span className="rounded-full border border-zinc-900 bg-black px-3 py-1.5 text-xs text-zinc-600">
              {loading ? "Loading..." : `${discussionResults.length} discussions`}
            </span>

            {currentUserId && (
              <span className="rounded-full border border-zinc-900 bg-black px-3 py-1.5 text-xs text-zinc-600">
                {peopleResults.length} people
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
              <p>No discussions match this search.</p>

              <div className="mt-4 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => setQuery("")}
                  className="rounded-full bg-white px-4 py-2 text-sm text-black transition hover:bg-zinc-200"
                >
                  Clear search
                </button>

                <Link
                  href="/discussions"
                  className="rounded-full border border-zinc-700 px-4 py-2 text-sm text-zinc-300 transition hover:border-zinc-500 hover:text-white"
                >
                  Browse discussions
                </Link>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {discussionResults.map((discussion) => {
                const author = profileMap[discussion.user_id];

                return (
                  <article
                    key={discussion.id}
                    className="group rounded-2xl border border-zinc-800 bg-zinc-950 shadow-2xl shadow-black/20 transition hover:border-zinc-700"
                  >
                    <Link
                      href={`/discussions/${discussion.id}`}
                      className="block p-4"
                    >
                      <div className="mb-3 flex min-w-0 items-center gap-3">
                        <ProfileAvatar profile={author} size="md" />

                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm text-zinc-300">
                            {author ? getProfileDisplayName(author) : "Loombus member"}
                          </p>

                          <p className="mt-1 truncate text-xs text-zinc-700">
                            {new Date(discussion.created_at).toLocaleDateString()}
                          </p>
                        </div>

                        <span className="shrink-0 rounded-full border border-zinc-800 bg-black px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.16em] text-zinc-500">
                          {discussion.topic}
                        </span>
                      </div>

                      <h3 className="mb-2 line-clamp-2 text-base font-semibold leading-snug text-zinc-100 transition group-hover:text-white">
                        {discussion.title}
                      </h3>

                      <p className="mb-3 line-clamp-2 text-sm leading-relaxed text-zinc-500">
                        {discussion.body}
                      </p>

                      <p className="border-t border-zinc-900 pt-3 text-xs text-zinc-500">
                        Open discussion →
                      </p>
                    </Link>
                  </article>
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
              <p>No people match this search.</p>

              <div className="mt-4 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => setQuery("")}
                  className="rounded-full bg-white px-4 py-2 text-sm text-black transition hover:bg-zinc-200"
                >
                  Clear search
                </button>

                <Link
                  href="/people"
                  className="rounded-full border border-zinc-700 px-4 py-2 text-sm text-zinc-300 transition hover:border-zinc-500 hover:text-white"
                >
                  Browse people
                </Link>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {peopleResults.map((profile) => (
                <Link
                  key={profile.id}
                  href={profile.username ? `/u/${profile.username}` : "/people"}
                  className="group flex items-start gap-3 rounded-2xl border border-zinc-800 bg-zinc-950 p-4 shadow-2xl shadow-black/20 transition hover:border-zinc-700"
                >
                  <ProfileAvatar profile={profile} size="md" />

                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-zinc-100 transition group-hover:text-white">
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

                    <p className="mt-3 text-xs text-zinc-500">
                      View profile →
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>
          </div>

          <aside className="loombus-right-rail fixed inset-y-0 right-0 z-30 hidden overflow-y-auto border-l border-zinc-900 bg-black/95 px-4 py-6 backdrop-blur-xl xl:block">
            <div className="space-y-4">
              <section className="overflow-hidden rounded-3xl border border-zinc-800 bg-zinc-950 shadow-2xl shadow-black/20">
                <div className="border-b border-zinc-900 p-5">
                  <p className="mb-2 text-xs uppercase tracking-[0.25em] text-zinc-600">
                    Discovery Panel
                  </p>

                  <h2 className="text-xl font-semibold tracking-tight">
                    Search with signal.
                  </h2>

                  <p className="mt-3 text-sm leading-relaxed text-zinc-500">
                    Use search to find ideas, topics, contributors, and discussions worth returning to.
                  </p>
                </div>

                <div className="grid grid-cols-2 border-b border-zinc-900">
                  <div className="border-r border-zinc-900 p-4">
                    <p className="text-xs uppercase tracking-[0.18em] text-zinc-700">
                      Threads
                    </p>
                    <p className="mt-2 text-lg font-semibold text-zinc-200">
                      {discussionResults.length}
                    </p>
                  </div>

                  <div className="p-4">
                    <p className="text-xs uppercase tracking-[0.18em] text-zinc-700">
                      People
                    </p>
                    <p className="mt-2 text-lg font-semibold text-zinc-200">
                      {peopleResults.length}
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
                  Search paths
                </p>

                <div className="space-y-3 text-sm leading-relaxed text-zinc-500">
                  <p className="rounded-2xl border border-zinc-900 bg-black p-3">
                    Search a topic when you want a subject lane.
                  </p>

                  <p className="rounded-2xl border border-zinc-900 bg-black p-3">
                    Search a reality or purpose phrase when you want human context.
                  </p>

                  <p className="rounded-2xl border border-zinc-900 bg-black p-3">
                    Search a contributor when you want a voice or perspective.
                  </p>
                </div>
              </section>

              <section className="rounded-3xl border border-zinc-800 bg-zinc-950 p-5 shadow-2xl shadow-black/20">
                <p className="mb-3 text-xs uppercase tracking-[0.22em] text-zinc-600">
                  Discovery standard
                </p>

                <p className="text-sm leading-relaxed text-zinc-500">
                  The best search result is not always the most popular one. Look for clear framing, useful context, and contributors who help you think better.
                </p>

                <div className="mt-4 grid gap-2">
                  <Link
                    href="/people"
                    className="inline-flex justify-center rounded-full border border-zinc-800 px-4 py-2 text-sm text-zinc-400 transition hover:border-zinc-600 hover:text-white"
                  >
                    Find contributors
                  </Link>

                  <Link
                    href="/saved"
                    className="inline-flex justify-center rounded-full border border-zinc-800 px-4 py-2 text-sm text-zinc-400 transition hover:border-zinc-600 hover:text-white"
                  >
                    Open saved
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
