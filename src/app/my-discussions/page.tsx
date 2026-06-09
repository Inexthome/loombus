"use client";

import { normalizePublicText } from "@/lib/public-text";
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
  edited_at: string | null;
  edit_count: number | null;
};

type DiscussionDraft = {
  id: string;
  title: string;
  topic: string;
  body: string;
  created_at: string;
  updated_at: string;
};

type Profile = {
  full_name: string | null;
  username: string | null;
  avatar_url: string | null;
  is_admin?: boolean | null;
};

type AiEntitlement = {
  tier: string | null;
  ai_assisted_enabled: boolean | null;
  monthly_summary_limit: number | null;
} | null;

function hasDraftAccess(entitlement: AiEntitlement, isAdmin: boolean) {
  if (isAdmin) {
    return true;
  }

  return (
    entitlement?.ai_assisted_enabled === true &&
    entitlement.tier === "premium"
  );
}

export default function MyDiscussionsPage() {
  const [discussions, setDiscussions] = useState<Discussion[]>([]);
  const [drafts, setDrafts] = useState<DiscussionDraft[]>([]);
  const [replyCounts, setReplyCounts] = useState<Record<string, number>>({});
  const [searchQuery, setSearchQuery] = useState("");
  const [currentProfile, setCurrentProfile] = useState<Profile | null>(null);
  const [entitlement, setEntitlement] = useState<AiEntitlement>(null);
  const [deletingDraftId, setDeletingDraftId] = useState<string | null>(null);
  const [deletingDiscussionId, setDeletingDiscussionId] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);

  const isAdmin = Boolean(currentProfile?.is_admin);
  const canUseDrafts = hasDraftAccess(entitlement, isAdmin);

  useEffect(() => {
    async function loadMyDiscussions() {
      const { data: userData } = await supabase.auth.getUser();

      if (!userData.user) {
        window.location.href = "/login";
        return;
      }

      setCurrentUserId(userData.user.id);

      const [{ data: profileData }, { data: entitlementData }] = await Promise.all([
        supabase
          .from("profiles")
          .select("full_name, username, avatar_url, is_admin")
          .eq("id", userData.user.id)
          .maybeSingle(),
        supabase
          .from("user_ai_entitlements")
          .select("tier, ai_assisted_enabled, monthly_summary_limit")
          .eq("user_id", userData.user.id)
          .maybeSingle(),
      ]);

      const resolvedProfile = profileData ?? null;
      const resolvedEntitlement = (entitlementData ?? null) as AiEntitlement;
      const resolvedCanUseDrafts = hasDraftAccess(
        resolvedEntitlement,
        Boolean(resolvedProfile?.is_admin)
      );

      setCurrentProfile(resolvedProfile);
      setEntitlement(resolvedEntitlement);

      const [{ data }, { data: draftData }] = await Promise.all([
        supabase
          .from("discussions")
          .select("id, title, topic, body, created_at, edited_at, edit_count")
          .eq("user_id", userData.user.id)
          .is("deleted_at", null)
          .order("created_at", { ascending: false }),
        resolvedCanUseDrafts
          ? supabase
              .from("discussion_drafts")
              .select("id, title, topic, body, created_at, updated_at")
              .eq("user_id", userData.user.id)
              .order("updated_at", { ascending: false })
          : Promise.resolve({ data: [] }),
      ]);

      const loadedDiscussions = (data ?? []) as Discussion[];
      setDiscussions(loadedDiscussions);
      setDrafts((draftData ?? []) as DiscussionDraft[]);

      const discussionIds = loadedDiscussions.map((discussion) => discussion.id);

      if (discussionIds.length > 0) {
        const { data: replies } = await supabase
          .from("replies")
          .select("discussion_id")
          .in("discussion_id", discussionIds)
          .is("deleted_at", null);

        const counts: Record<string, number> = {};

        for (const reply of replies ?? []) {
          counts[reply.discussion_id] =
            (counts[reply.discussion_id] ?? 0) + 1;
        }

        setReplyCounts(counts);
      }

      setLoading(false);
    }

    loadMyDiscussions();
  }, []);

  const filteredDiscussions = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    if (!query) {
      return discussions;
    }

    return discussions.filter((discussion) => {
      return (
        discussion.title.toLowerCase().includes(query) ||
        discussion.topic.toLowerCase().includes(query) ||
        discussion.body.toLowerCase().includes(query)
      );
    });
  }, [discussions, searchQuery]);

  const activeMyDiscussionsSearch = searchQuery.trim();
  const hasActiveMyDiscussionsSearch = activeMyDiscussionsSearch.length > 0;

  function resetMyDiscussionsSearch() {
    setSearchQuery("");
  }

  async function deleteDraft(draftId: string) {
    setMessage("");

    if (!currentUserId || deletingDraftId) {
      return;
    }

    setDeletingDraftId(draftId);

    const { data: sessionData } = await supabase.auth.getSession();
    const accessToken = sessionData.session?.access_token;

    if (!accessToken) {
      setDeletingDraftId(null);
      window.location.href = "/login";
      return;
    }

    const response = await fetch("/api/discussion-drafts", {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        draftId,
      }),
    });

    const result = await response.json().catch(() => ({}));

    setDeletingDraftId(null);

    if (!response.ok) {
      setMessage(result.error ?? "Unable to delete draft.");
      return;
    }

    setDrafts((current) => current.filter((draft) => draft.id !== draftId));
    setMessage("Draft deleted.");
  }

  async function deleteDiscussion(discussionId: string) {
    setMessage("");

    if (!currentUserId || deletingDiscussionId) {
      return;
    }

    const confirmed = window.confirm(
      "Delete this discussion? It will leave public view, but moderation and audit records will be preserved."
    );

    if (!confirmed) {
      return;
    }

    setDeletingDiscussionId(discussionId);

    const { data: sessionData } = await supabase.auth.getSession();
    const accessToken = sessionData.session?.access_token;

    if (!accessToken) {
      setDeletingDiscussionId(null);
      window.location.href = "/login";
      return;
    }

    const response = await fetch("/api/discussions/delete", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        discussionId,
      }),
    });

    const result = await response.json().catch(() => ({}));

    setDeletingDiscussionId(null);

    if (!response.ok) {
      setMessage(result.error ?? "Unable to delete discussion.");
      return;
    }

    setDiscussions((current) =>
      current.filter((discussion) => discussion.id !== discussionId)
    );
    setMessage("Discussion deleted.");
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-black px-4 pb-24 pt-4 text-white sm:px-6 sm:py-12 lg:py-16">
        <div className="mx-auto max-w-6xl text-zinc-400">
          Loading your discussions...
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-black px-4 pb-24 pt-4 text-white sm:px-6 sm:py-12 lg:py-16">
      <div className="mx-auto max-w-6xl">
        <Link
          href="/dashboard"
          className="mb-5 inline-block text-sm text-zinc-500 hover:text-white sm:mb-10"
        >
          ← Back to dashboard
        </Link>

        <div className="mb-5 flex flex-col gap-3 sm:mb-10 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="mb-2 text-xs uppercase tracking-[0.22em] text-zinc-500 sm:mb-4 sm:text-sm sm:tracking-[0.3em]">
              My Activity
            </p>

            <h1 className="text-2xl font-semibold tracking-tight sm:text-5xl md:text-6xl">
              My Discussions
            </h1>

            <p className="mt-2 text-sm leading-relaxed text-zinc-500 sm:mt-4 sm:text-base">
              Review the discussions you have started on Loombus.
            </p>
          </div>

          <div className="flex items-center gap-3 rounded-2xl border border-zinc-800 bg-zinc-950 p-3 sm:p-4">
            <ProfileAvatar profile={currentProfile} size="xl" />

            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-zinc-600">
                Author
              </p>

              <p className="mt-1 text-sm text-zinc-300">
                {getProfileDisplayName(currentProfile)}
              </p>
            </div>
          </div>
        </div>

        {message && (
          <p className="mb-6 rounded-2xl border border-zinc-800 bg-zinc-950 p-4 text-sm text-zinc-400">
            {message}
          </p>
        )}

        {!canUseDrafts && (
          <section className="mb-5 rounded-2xl border border-zinc-800 bg-zinc-950 p-5 sm:mb-8 sm:rounded-3xl sm:p-6">
            <h2 className="mb-2 text-2xl font-medium">
              Draft mode is a Premium feature.
            </h2>

            <p className="mb-5 max-w-3xl leading-relaxed text-zinc-500">
              You can still publish discussions normally. Premium accounts can save drafts and return to them before publishing.
            </p>

            <Link
              href="/premium"
              className="inline-flex rounded-full border border-zinc-700 px-5 py-3 text-sm text-zinc-300 transition hover:border-zinc-500 hover:text-white"
            >
              View Premium options
            </Link>
          </section>
        )}

        {canUseDrafts && (
          <section className="mb-6 rounded-2xl border border-zinc-800 bg-zinc-950 p-5 sm:mb-10 sm:rounded-3xl sm:p-6">
            <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="mb-2 text-sm uppercase tracking-wide text-zinc-500">
                  Drafts
                </p>

                <h2 className="text-2xl font-medium">
                  Saved discussion drafts
                </h2>
              </div>

              <Link
                href="/create"
                className="w-fit rounded-full border border-zinc-700 px-5 py-3 text-sm text-zinc-300 transition hover:border-zinc-500 hover:text-white"
              >
                New draft
              </Link>
            </div>

            {drafts.length === 0 && (
              <div className="rounded-2xl border border-zinc-900 bg-black p-5">
                <p className="mb-2 text-sm font-medium text-zinc-300">
                  No saved drafts yet.
                </p>

                <p className="mb-4 text-sm leading-relaxed text-zinc-600">
                  Use drafts when an idea needs more structure before publishing.
                </p>

                <Link
                  href="/create"
                  className="text-sm text-zinc-300 underline decoration-zinc-700 underline-offset-4 transition hover:text-white hover:decoration-white"
                >
                  Start a new draft →
                </Link>
              </div>
            )}

            {drafts.length > 0 && (
              <div className="space-y-4">
                {drafts.map((draft) => (
                  <div
                    key={draft.id}
                    className="rounded-2xl border border-zinc-800 bg-black p-5"
                  >
                    <p className="mb-2 text-sm text-zinc-500">
                      {draft.topic}
                    </p>

                    <h3 className="mb-2 text-xl font-medium">
                      {draft.title.trim() || "Untitled draft"}
                    </h3>

                    <p className="mb-4 line-clamp-2 text-sm leading-relaxed text-zinc-500">
                      {draft.body.trim() || "No draft body yet."}
                    </p>

                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <p className="text-xs text-zinc-600">
                        Updated {new Date(draft.updated_at).toLocaleString()}
                      </p>

                      <div className="flex flex-wrap gap-3">
                        <Link
                          href={`/create?draft=${draft.id}`}
                          className="rounded-full border border-zinc-700 px-4 py-2 text-sm text-zinc-300 transition hover:border-zinc-500 hover:text-white"
                        >
                          Continue editing
                        </Link>

                        <button
                          type="button"
                          onClick={() => deleteDraft(draft.id)}
                          disabled={deletingDraftId === draft.id}
                          className="rounded-full border border-zinc-800 px-4 py-2 text-sm text-zinc-500 transition hover:border-red-900 hover:text-red-300 disabled:cursor-not-allowed disabled:border-zinc-900 disabled:text-zinc-700"
                        >
                          {deletingDraftId === draft.id ? "Deleting..." : "Delete draft"}
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        <section className="hidden md:block mb-8 rounded-3xl border border-zinc-800 bg-zinc-950 p-5">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="flex-1">
              <label htmlFor="my-discussions-search" className="mb-2 block text-sm font-medium text-zinc-300">
                Search your published discussions
              </label>

              <input
                id="my-discussions-search"
                type="text"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Search your titles, topics, or discussion bodies..."
                className="w-full rounded-2xl border border-zinc-800 bg-black px-5 py-4 text-white outline-none transition placeholder:text-zinc-600 focus:border-zinc-600"
              />
            </div>

            {hasActiveMyDiscussionsSearch && (
              <button
                type="button"
                onClick={resetMyDiscussionsSearch}
                className="w-fit rounded-full border border-zinc-700 px-5 py-3 text-sm text-zinc-300 transition hover:border-zinc-500 hover:text-white"
              >
                Clear search
              </button>
            )}
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            {hasActiveMyDiscussionsSearch ? (
              <span className="rounded-full border border-zinc-800 bg-black px-3 py-1.5 text-xs font-medium text-zinc-400">
                Search: “{activeMyDiscussionsSearch}”
              </span>
            ) : (
              <p className="text-sm text-zinc-600">
                Search scans the discussions you published by title, topic, and body.
              </p>
            )}
          </div>
        </section>

        <div className="mb-5 flex flex-col gap-2 md:mb-10 md:flex-row md:items-center md:justify-between">
          <p className="text-sm text-zinc-600">
            Showing {filteredDiscussions.length} of {discussions.length} published discussions
          </p>

          {hasActiveMyDiscussionsSearch && (
            <button
              type="button"
              onClick={resetMyDiscussionsSearch}
              className="w-fit text-sm text-zinc-500 underline decoration-zinc-800 underline-offset-4 transition hover:text-white hover:decoration-white"
            >
              Reset view
            </button>
          )}
        </div>

        {discussions.length === 0 && (
          <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-5 sm:rounded-3xl sm:p-8">
            <h2 className="mb-3 text-xl font-medium sm:text-2xl">
              You have not started any discussions yet.
            </h2>

            <p className="mb-5 max-w-3xl text-sm leading-relaxed text-zinc-400 sm:mb-6 sm:text-base">
              Start with one clear question, claim, or useful observation. A good first discussion gives people a specific idea to respond to.
            </p>

            <div className="mb-6 hidden gap-4 md:grid md:grid-cols-3">
              <div className="rounded-2xl border border-zinc-900 bg-black p-4">
                <p className="mb-2 text-sm font-medium text-zinc-300">
                  Choose one idea
                </p>

                <p className="text-sm leading-relaxed text-zinc-600">
                  Keep the topic focused so replies can go deeper instead of wider.
                </p>
              </div>

              <div className="rounded-2xl border border-zinc-900 bg-black p-4">
                <p className="mb-2 text-sm font-medium text-zinc-300">
                  Add useful context
                </p>

                <p className="text-sm leading-relaxed text-zinc-600">
                  Explain what prompted the thought, what you have noticed, or why it matters.
                </p>
              </div>

              <div className="rounded-2xl border border-zinc-900 bg-black p-4">
                <p className="mb-2 text-sm font-medium text-zinc-300">
                  Invite better replies
                </p>

                <p className="text-sm leading-relaxed text-zinc-600">
                  Ask for examples, counterpoints, experience, or a sharper framing.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              <Link
                href="/create"
                className="inline-flex rounded-full bg-white px-5 py-3 text-sm text-black transition hover:bg-zinc-200"
              >
                Create your first discussion
              </Link>

              <Link
                href="/discussions"
                className="inline-flex rounded-full border border-zinc-700 px-5 py-3 text-sm text-zinc-300 transition hover:border-zinc-500 hover:text-white"
              >
                Browse examples
              </Link>

              <Link
                href="/onboarding"
                className="inline-flex rounded-full border border-zinc-700 px-5 py-3 text-sm text-zinc-300 transition hover:border-zinc-500 hover:text-white"
              >
                Open setup guide
              </Link>
            </div>
          </div>
        )}

        {discussions.length > 0 && filteredDiscussions.length === 0 && (
          <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-5 sm:p-8">
            <h2 className="mb-3 text-xl font-medium sm:text-2xl">
              No discussions found.
            </h2>

            <p className="max-w-2xl text-sm leading-relaxed text-zinc-400 sm:text-base">
              No published discussions match your current search. Try a broader term,
              clear the search, or start a new discussion if the idea is not published yet.
            </p>

            <div className="mt-6 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={resetMyDiscussionsSearch}
                className="rounded-full bg-white px-5 py-3 text-sm text-black transition hover:bg-zinc-200"
              >
                Clear search
              </button>

              <Link
                href="/create"
                className="rounded-full border border-zinc-700 px-5 py-3 text-sm text-zinc-300 transition hover:border-zinc-500 hover:text-white"
              >
                Start another discussion
              </Link>
            </div>
          </div>
        )}

        <div className="space-y-3 sm:space-y-5">
          {filteredDiscussions.map((discussion) => (
            <div
              key={discussion.id}
              className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4 transition hover:border-zinc-700 sm:p-6"
            >
              <Link href={`/discussions/${discussion.id}`} className="block">
                <p className="mb-2 text-xs uppercase tracking-[0.16em] text-zinc-600 sm:mb-3 sm:text-sm sm:normal-case sm:tracking-normal sm:text-zinc-500">
                  {discussion.topic}
                </p>

                <h2 className="mb-3 text-xl font-medium sm:text-2xl">
                  {normalizePublicText(discussion.title)}
                </h2>

                <p className="mb-4 line-clamp-2 text-sm leading-relaxed text-zinc-400 sm:mb-5 sm:line-clamp-3 sm:text-base">
                  {normalizePublicText(discussion.body)}
                </p>
              </Link>

              <div className="flex flex-wrap items-center justify-between gap-4 text-sm text-zinc-500">
                <span>
                  {new Date(discussion.created_at).toLocaleDateString()}
                </span>

                <div className="flex flex-wrap items-center gap-3">
                  {discussion.edited_at && (
                    <span>
                      Edited {new Date(discussion.edited_at).toLocaleDateString()}
                    </span>
                  )}

                  <span>
                    {replyCounts[discussion.id] ?? 0} replies
                  </span>

                  <Link
                    href={`/create?edit=${discussion.id}`}
                    className="rounded-full border border-zinc-800 px-4 py-2 text-zinc-400 transition hover:border-zinc-600 hover:text-white"
                  >
                    Edit
                  </Link>

                  <button
                    type="button"
                    onClick={() => deleteDiscussion(discussion.id)}
                    disabled={deletingDiscussionId === discussion.id}
                    className="rounded-full border border-zinc-800 px-4 py-2 text-zinc-500 transition hover:border-red-900 hover:text-red-300 disabled:cursor-not-allowed disabled:border-zinc-900 disabled:text-zinc-700"
                  >
                    {deletingDiscussionId === discussion.id ? "Deleting..." : "Delete"}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
