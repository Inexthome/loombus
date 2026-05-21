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

  async function deleteDraft(draftId: string) {
    setMessage("");

    if (!currentUserId || deletingDraftId) {
      return;
    }

    setDeletingDraftId(draftId);

    const { error } = await supabase
      .from("discussion_drafts")
      .delete()
      .eq("id", draftId)
      .eq("user_id", currentUserId);

    setDeletingDraftId(null);

    if (error) {
      setMessage(`Unable to delete draft: ${error.message}`);
      return;
    }

    setDrafts((current) => current.filter((draft) => draft.id !== draftId));
    setMessage("Draft deleted.");
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-black px-6 py-16 text-white">
        <div className="mx-auto max-w-5xl text-zinc-400">
          Loading your discussions...
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-black px-6 py-16 text-white">
      <div className="mx-auto max-w-5xl">
        <Link
          href="/dashboard"
          className="mb-10 inline-block text-sm text-zinc-500 hover:text-white"
        >
          ← Back to dashboard
        </Link>

        <div className="mb-10 flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="mb-4 text-sm uppercase tracking-[0.3em] text-zinc-500">
              My Activity
            </p>

            <h1 className="text-5xl font-semibold tracking-tight">
              My Discussions
            </h1>

            <p className="mt-4 text-zinc-500">
              Review the discussions you have started on Loombus.
            </p>
          </div>

          <div className="flex items-center gap-3 rounded-2xl border border-zinc-800 bg-zinc-950 p-4">
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
          <section className="mb-8 rounded-3xl border border-zinc-800 bg-zinc-950 p-6">
            <h2 className="mb-2 text-2xl font-medium">
              Draft mode is a Premium feature.
            </h2>

            <p className="mb-5 max-w-3xl leading-relaxed text-zinc-500">
              You can still publish discussions normally. Premium and Admin accounts
              can save drafts and return to them before publishing.
            </p>

            <Link
              href="/premium"
              className="rounded-full border border-zinc-700 px-5 py-3 text-sm text-zinc-300 transition hover:border-zinc-500 hover:text-white"
            >
              View Premium options
            </Link>
          </section>
        )}

        {canUseDrafts && (
          <section className="mb-10 rounded-3xl border border-zinc-800 bg-zinc-950 p-6">
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
              <p className="text-sm text-zinc-500">
                No saved drafts yet.
              </p>
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

        <div className="mb-6">
          <input
            type="text"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Search your discussions by title, topic, or body..."
            className="w-full rounded-2xl border border-zinc-800 bg-zinc-950 px-5 py-4 text-white outline-none transition placeholder:text-zinc-600 focus:border-zinc-600"
          />
        </div>

        <p className="mb-10 text-sm text-zinc-600">
          Showing {filteredDiscussions.length} of {discussions.length} published discussions
        </p>

        {discussions.length === 0 && (
          <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-8">
            <h2 className="mb-3 text-2xl font-medium">
              You have not started any discussions yet.
            </h2>

            <p className="mb-6 text-zinc-400">
              Start a structured conversation around a meaningful idea.
            </p>

            <Link
              href="/create"
              className="inline-flex rounded-full bg-white px-5 py-3 text-sm text-black transition hover:bg-zinc-200"
            >
              Create Discussion
            </Link>
          </div>
        )}

        {discussions.length > 0 && filteredDiscussions.length === 0 && (
          <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-8">
            <h2 className="mb-3 text-2xl font-medium">
              No discussions found.
            </h2>

            <p className="text-zinc-400">
              No discussions match your current search.
            </p>
          </div>
        )}

        <div className="space-y-6">
          {filteredDiscussions.map((discussion) => (
            <div
              key={discussion.id}
              className="rounded-2xl border border-zinc-800 bg-zinc-950 p-6 transition hover:border-zinc-700"
            >
              <Link href={`/discussions/${discussion.id}`} className="block">
                <p className="mb-3 text-sm text-zinc-500">
                  {discussion.topic}
                </p>

                <h2 className="mb-3 text-2xl font-medium">
                  {discussion.title}
                </h2>

                <p className="mb-5 line-clamp-3 leading-relaxed text-zinc-400">
                  {discussion.body}
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
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
