"use client";

import Link from "next/link";
import { type FormEvent, type KeyboardEvent, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { DEFAULT_DISCUSSION_TOPIC, DISCUSSION_TOPICS } from "@/lib/discussion-topics";

type Profile = {
  full_name: string | null;
  username: string | null;
  bio: string | null;
  avatar_url: string | null;
  is_admin?: boolean | null;
};

type AiEntitlement = {
  tier: string | null;
  ai_assisted_enabled: boolean | null;
  monthly_summary_limit: number | null;
} | null;

type DiscussionDraft = {
  id: string;
  title: string;
  topic: string;
  body: string;
  created_at: string;
  updated_at: string;
};

type EditableDiscussion = {
  id: string;
  user_id: string;
  title: string;
  topic: string;
  body: string;
  created_at: string;
  updated_at: string | null;
  edited_at: string | null;
  edit_count: number | null;
};

const STANDARD_DISCUSSION_MAX_LENGTH = 5000;
const LONG_DISCUSSION_MAX_LENGTH = 12000;

function getMissingProfileFields(profile: Profile | null) {
  const missing = [];

  if (!profile?.username?.trim()) {
    missing.push("username");
  }

  if (!profile?.full_name?.trim()) {
    missing.push("full name");
  }

  if (!profile?.bio?.trim()) {
    missing.push("bio");
  }

  if (!profile?.avatar_url?.trim()) {
    missing.push("profile image");
  }

  return missing;
}

function hasPremiumAccess(entitlement: AiEntitlement, isAdmin: boolean) {
  if (isAdmin) {
    return true;
  }

  return (
    entitlement?.ai_assisted_enabled === true &&
    entitlement.tier === "premium"
  );
}

function hasLongPostAccess(entitlement: AiEntitlement, isAdmin: boolean) {
  if (isAdmin) {
    return true;
  }

  return (
    entitlement?.ai_assisted_enabled === true &&
    entitlement.tier === "premium" &&
    (entitlement.monthly_summary_limit ?? 0) > 50
  );
}

function getEditWindowLabel(entitlement: AiEntitlement, isAdmin: boolean) {
  if (isAdmin) {
    return "Admin access: no normal edit-window limit";
  }

  if (hasPremiumAccess(entitlement, false)) {
    return "Premium edit window: 7 days after publishing";
  }

  return "Free edit window: 15 minutes after publishing";
}

function getQueryParam(name: string) {
  if (typeof window === "undefined") {
    return null;
  }

  return new URLSearchParams(window.location.search).get(name);
}

export default function CreatePage() {
  const [title, setTitle] = useState("");
  const [topic, setTopic] = useState<string>(DEFAULT_DISCUSSION_TOPIC);
  const [body, setBody] = useState("");
  const [profile, setProfile] = useState<Profile | null>(null);
  const [entitlement, setEntitlement] = useState<AiEntitlement>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [draftId, setDraftId] = useState<string | null>(null);
  const [draftUpdatedAt, setDraftUpdatedAt] = useState<string | null>(null);
  const [editingDiscussionId, setEditingDiscussionId] = useState<string | null>(null);
  const [editingDiscussionMeta, setEditingDiscussionMeta] =
    useState<EditableDiscussion | null>(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);
  const [message, setMessage] = useState("");
  const [qualityCheck, setQualityCheck] = useState("");
  const [qualityCheckMessage, setQualityCheckMessage] = useState("");
  const [generatingQualityCheck, setGeneratingQualityCheck] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);

  const isAdmin = Boolean(profile?.is_admin);
  const canUseDrafts = hasPremiumAccess(entitlement, isAdmin);
  const canUseLongPosts = hasLongPostAccess(entitlement, isAdmin);
  const canUseQualityCheck = canUseLongPosts;
  const maxDiscussionLength = canUseLongPosts
    ? LONG_DISCUSSION_MAX_LENGTH
    : STANDARD_DISCUSSION_MAX_LENGTH;
  const bodyCharacterCount = body.length;
  const isBodyOverLimit = bodyCharacterCount > maxDiscussionLength;
  const isEditMode = Boolean(editingDiscussionId);

  useEffect(() => {
    async function loadProfileStatus() {
      const { data: userData } = await supabase.auth.getUser();

      if (!userData.user) {
        setIsLoggedIn(false);
        setAuthChecked(true);
        return;
      }

      setIsLoggedIn(true);
      setCurrentUserId(userData.user.id);

      const requestedDraftId = getQueryParam("draft");
      const requestedEditId = getQueryParam("edit");

      const [{ data: profileData }, { data: entitlementData }] = await Promise.all([
        supabase
          .from("profiles")
          .select("full_name, username, bio, avatar_url, is_admin")
          .eq("id", userData.user.id)
          .maybeSingle(),
        supabase
          .from("user_ai_entitlements")
          .select("tier, ai_assisted_enabled, monthly_summary_limit")
          .eq("user_id", userData.user.id)
          .maybeSingle(),
      ]);

      const resolvedProfile = profileData ?? null;

      setProfile(resolvedProfile);
      setEntitlement((entitlementData ?? null) as AiEntitlement);

      if (requestedEditId) {
        const { data: discussionData, error: discussionError } = await supabase
          .from("discussions")
          .select("id, user_id, title, topic, body, created_at, updated_at, edited_at, edit_count")
          .eq("id", requestedEditId)
          .is("deleted_at", null)
          .maybeSingle();

        if (discussionError) {
          setMessage(`Unable to load discussion for editing: ${discussionError.message}`);
        }

        if (discussionData) {
          const discussion = discussionData as EditableDiscussion;
          const viewerIsAdmin = Boolean(resolvedProfile?.is_admin);

          if (discussion.user_id !== userData.user.id && !viewerIsAdmin) {
            setMessage("You do not have permission to edit this discussion.");
          } else {
            setEditingDiscussionId(discussion.id);
            setEditingDiscussionMeta(discussion);
            setTitle(discussion.title ?? "");

            setTopic(
              DISCUSSION_TOPICS.includes(discussion.topic as typeof DISCUSSION_TOPICS[number])
                ? discussion.topic
                : DEFAULT_DISCUSSION_TOPIC
            );

            setBody(discussion.body ?? "");
            setMessage("Discussion loaded for editing.");
          }
        }

        setAuthChecked(true);
        return;
      }

      if (requestedDraftId) {
        const { data: draftData, error: draftError } = await supabase
          .from("discussion_drafts")
          .select("id, title, topic, body, created_at, updated_at")
          .eq("id", requestedDraftId)
          .eq("user_id", userData.user.id)
          .maybeSingle();

        if (draftError) {
          setMessage(`Unable to load draft: ${draftError.message}`);
        }

        if (draftData) {
          const draft = draftData as DiscussionDraft;
          setDraftId(draft.id);
          setTitle(draft.title ?? "");

          setTopic(
            DISCUSSION_TOPICS.includes(draft.topic as typeof DISCUSSION_TOPICS[number])
              ? draft.topic
              : DEFAULT_DISCUSSION_TOPIC
          );

          setBody(draft.body ?? "");
          setDraftUpdatedAt(draft.updated_at);
          setMessage("Draft loaded.");
        }
      }

      setAuthChecked(true);
    }

    loadProfileStatus();
  }, []);

  const missingProfileFields = useMemo(
    () => getMissingProfileFields(profile),
    [profile]
  );

  const profileComplete = missingProfileFields.length === 0;

  async function saveDraft() {
    setMessage("");

    if (isEditMode) {
      setMessage("Published edits cannot be saved as drafts from this screen.");
      return;
    }

    if (!currentUserId || savingDraft) {
      return;
    }

    if (!canUseDrafts) {
      setMessage("Draft mode requires Premium or Admin access.");
      return;
    }

    if (!title.trim() && !body.trim()) {
      setMessage("Add a title or body before saving a draft.");
      return;
    }

    setSavingDraft(true);

    const payload = {
      user_id: currentUserId,
      title: title.trim(),
      topic,
      body: body.trim(),
    };

    const request = draftId
      ? supabase
          .from("discussion_drafts")
          .update(payload)
          .eq("id", draftId)
          .eq("user_id", currentUserId)
          .select("id, updated_at")
          .single()
      : supabase
          .from("discussion_drafts")
          .insert(payload)
          .select("id, updated_at")
          .single();

    const { data, error } = await request;

    setSavingDraft(false);

    if (error) {
      setMessage(`Unable to save draft: ${error.message}`);
      return;
    }

    const savedDraft = data as { id: string; updated_at: string };
    setDraftId(savedDraft.id);
    setDraftUpdatedAt(savedDraft.updated_at);

    if (!draftId && typeof window !== "undefined") {
      window.history.replaceState(null, "", `/create?draft=${savedDraft.id}`);
    }

    setMessage("Draft saved.");
  }

  async function runQualityCheck() {
    setQualityCheckMessage("");
    setQualityCheck("");

    if (generatingQualityCheck) {
      return;
    }

    if (!canUseQualityCheck) {
      setQualityCheckMessage("AI discussion quality check requires Premium Plus or Admin access.");
      return;
    }

    if (!title.trim()) {
      setQualityCheckMessage("Enter a title before running the quality check.");
      return;
    }

    if (!body.trim() || body.trim().length < 8) {
      setQualityCheckMessage("Add more discussion content before running the quality check.");
      return;
    }

    const { data: sessionData } = await supabase.auth.getSession();

    if (!sessionData.session) {
      window.location.href = "/login";
      return;
    }

    setGeneratingQualityCheck(true);

    try {
      const response = await fetch("/api/discussions/quality-check", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${sessionData.session.access_token}`,
        },
        body: JSON.stringify({
          title,
          topic,
          body,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        setQualityCheckMessage(result.error ?? "Unable to run quality check.");
        return;
      }

      setQualityCheck(result.qualityCheck ?? "");
      setQualityCheckMessage("Quality check complete.");
    } finally {
      setGeneratingQualityCheck(false);
    }
  }

  async function handleCreate(
    event?: FormEvent<HTMLFormElement> | KeyboardEvent<HTMLFormElement>
  ) {
    event?.preventDefault();

    if (publishing) {
      return;
    }

    setPublishing(true);
    setMessage("");

    if (!title.trim()) {
      setMessage("Please enter a discussion title.");
      setPublishing(false);
      return;
    }

    if (!body.trim()) {
      setMessage("Please enter discussion content.");
      setPublishing(false);
      return;
    }

    if (body.trim().length > maxDiscussionLength) {
      setMessage(`Discussion content is too long. Your current limit is ${maxDiscussionLength.toLocaleString()} characters.`);
      setPublishing(false);
      return;
    }

    const { data: sessionData } = await supabase.auth.getSession();

    if (!sessionData.session) {
      window.location.href = "/login";
      return;
    }

    const endpoint = isEditMode
      ? "/api/discussions/update"
      : "/api/discussions/create";

    const payload = isEditMode
      ? {
          discussionId: editingDiscussionId,
          title,
          topic,
          body,
        }
      : {
          title,
          topic,
          body,
        };

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${sessionData.session.access_token}`,
      },
      body: JSON.stringify(payload),
    });

    const result = await response.json();

    if (!response.ok) {
      setMessage(result.error ?? (isEditMode ? "Unable to save changes." : "Unable to publish discussion."));
      setPublishing(false);
      return;
    }

    if (!isEditMode && draftId && currentUserId) {
      await supabase
        .from("discussion_drafts")
        .delete()
        .eq("id", draftId)
        .eq("user_id", currentUserId);
    }

    const discussionId = result.discussion?.id ?? editingDiscussionId;
    window.location.href = `/discussions/${discussionId}`;
  }

  function handleFormKeyDown(event: KeyboardEvent<HTMLFormElement>) {
    if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
      handleCreate(event);
    }
  }

  return (
    <main className="min-h-screen bg-black px-6 py-16 text-white">
      <div className="mx-auto max-w-3xl">
        <Link
          href={isEditMode && editingDiscussionId ? `/discussions/${editingDiscussionId}` : "/discussions"}
          className="mb-10 inline-block text-sm text-zinc-500 hover:text-white"
        >
          ← Back to {isEditMode ? "discussion" : "discussions"}
        </Link>

        <p className="mb-4 text-sm uppercase tracking-[0.3em] text-zinc-500">
          {isEditMode ? "Edit Discussion" : "New Discussion"}
        </p>

        <h1 className="mb-6 text-5xl font-semibold tracking-tight">
          {isEditMode
            ? "Edit discussion."
            : draftId
              ? "Edit draft."
              : "Create a discussion."}
        </h1>

        <p className="mb-8 max-w-2xl leading-relaxed text-zinc-400">
          {isEditMode
            ? "Make a clear, accountable update to your published discussion."
            : "Start a thoughtful discussion designed around signal, clarity, and meaningful contribution."}
        </p>

        {!authChecked && (
          <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-6">
            <p className="text-zinc-400">
              Checking your account status...
            </p>
          </div>
        )}

        {authChecked && !isLoggedIn && (
          <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-6">
            <p className="mb-2 text-sm uppercase tracking-[0.25em] text-zinc-500">
              Login Required
            </p>

            <h2 className="mb-4 text-2xl font-medium">
              Log in to create or edit a discussion.
            </h2>

            <p className="mb-6 leading-relaxed text-zinc-400">
              You can browse discussions without an account, but you need to log in before starting or editing a conversation.
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
        )}

        {authChecked && isLoggedIn && !profileComplete && (
          <div className="mb-8 rounded-2xl border border-zinc-800 bg-zinc-950 p-5">
            <p className="mb-2 text-sm font-medium text-zinc-300">
              Your profile is not complete yet.
            </p>

            <p className="mb-4 text-sm leading-relaxed text-zinc-500">
              You can still publish, but adding your {missingProfileFields.join(", ")}
              helps other members recognize your contributions.
            </p>

            <Link
              href="/profile"
              className="text-sm text-zinc-300 underline decoration-zinc-700 underline-offset-4 transition hover:text-white hover:decoration-white"
            >
              Complete your profile →
            </Link>
          </div>
        )}

        {authChecked && isLoggedIn && !isEditMode && !canUseDrafts && (
          <div className="mb-8 rounded-2xl border border-zinc-800 bg-zinc-950 p-5">
            <p className="mb-2 text-sm font-medium text-zinc-300">
              Draft mode is a Premium feature.
            </p>

            <p className="mb-4 text-sm leading-relaxed text-zinc-500">
              You can still publish discussions normally. Premium and Admin accounts
              can save drafts before publishing.
            </p>

            <Link
              href="/premium"
              className="text-sm text-zinc-300 underline decoration-zinc-700 underline-offset-4 transition hover:text-white hover:decoration-white"
            >
              View Premium options →
            </Link>
          </div>
        )}

        {authChecked && isLoggedIn && isEditMode && (
          <div className="mb-8 rounded-2xl border border-zinc-800 bg-zinc-950 p-5">
            <p className="mb-2 text-sm font-medium text-zinc-300">
              Edit window
            </p>

            <p className="text-sm leading-relaxed text-zinc-500">
              {getEditWindowLabel(entitlement, isAdmin)}
              {editingDiscussionMeta?.edited_at
                ? ` · Last edited ${new Date(editingDiscussionMeta.edited_at).toLocaleString()}`
                : ""}
            </p>
          </div>
        )}

        {authChecked && isLoggedIn && (
          <form
            onSubmit={handleCreate}
            onKeyDown={handleFormKeyDown}
            className="space-y-6 rounded-2xl border border-zinc-800 bg-zinc-950 p-8"
          >
            {draftId && !isEditMode && (
              <div className="rounded-2xl border border-zinc-800 bg-black p-4 text-sm text-zinc-500">
                Editing saved draft
                {draftUpdatedAt ? ` · Updated ${new Date(draftUpdatedAt).toLocaleString()}` : ""}
              </div>
            )}

            {isEditMode && (
              <div className="rounded-2xl border border-zinc-800 bg-black p-4 text-sm text-zinc-500">
                Editing published discussion
                {editingDiscussionMeta?.edit_count
                  ? ` · ${editingDiscussionMeta.edit_count} previous edits`
                  : ""}
              </div>
            )}

            <div>
              <label className="mb-2 block text-sm text-zinc-400">
                Discussion Title
              </label>

              <input
                type="text"
                value={title}
                required
                onChange={(e) => setTitle(e.target.value)}
                placeholder="How AI changes trust online"
                className="w-full rounded-xl border border-zinc-800 bg-black px-4 py-3 text-white outline-none focus:border-zinc-500"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm text-zinc-400">
                Topic
              </label>

              <select
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                className="w-full rounded-xl border border-zinc-800 bg-black px-4 py-3 text-white outline-none focus:border-zinc-500"
              >
                {DISCUSSION_TOPICS.map((topicOption) => (
                  <option key={topicOption} value={topicOption}>
                    {topicOption}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-2 block text-sm text-zinc-400">
                Discussion Body
              </label>

              <textarea
                rows={10}
                value={body}
                required
                maxLength={maxDiscussionLength}
                onChange={(e) => setBody(e.target.value)}
                placeholder="Write your discussion..."
                className="w-full rounded-xl border border-zinc-800 bg-black px-4 py-3 text-white outline-none focus:border-zinc-500"
              />

              <div className="mt-3 flex flex-col gap-2 text-xs text-zinc-600 sm:flex-row sm:items-center sm:justify-between">
                <p className={isBodyOverLimit ? "text-red-400" : ""}>
                  {bodyCharacterCount.toLocaleString()}/{maxDiscussionLength.toLocaleString()} characters
                </p>

                <p>
                  {canUseLongPosts
                    ? "Premium Plus/Admin long-post limit active."
                    : "Upgrade to Premium Plus for longer discussion posts."}
                </p>
              </div>
            </div>

            <section className="rounded-2xl border border-zinc-800 bg-black p-5">
              <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="mb-2 text-sm uppercase tracking-wide text-zinc-500">
                    Premium Plus AI
                  </p>

                  <h2 className="text-xl font-medium">
                    Discussion quality check
                  </h2>

                  <p className="mt-2 text-sm leading-relaxed text-zinc-500">
                    Get concise feedback before posting. This does not rewrite
                    or publish anything.
                  </p>
                </div>

                {canUseQualityCheck ? (
                  <button
                    type="button"
                    onClick={runQualityCheck}
                    disabled={generatingQualityCheck || publishing}
                    className="w-fit rounded-full border border-zinc-700 px-5 py-3 text-sm text-zinc-300 transition hover:border-zinc-500 hover:text-white disabled:cursor-not-allowed disabled:border-zinc-900 disabled:text-zinc-700"
                  >
                    {generatingQualityCheck ? "Checking..." : "Run quality check"}
                  </button>
                ) : (
                  <Link
                    href="/premium"
                    className="w-fit rounded-full border border-zinc-800 px-5 py-3 text-sm text-zinc-500 transition hover:border-zinc-600 hover:text-white"
                  >
                    Unlock with Premium Plus
                  </Link>
                )}
              </div>

              {qualityCheckMessage && (
                <p className="mb-4 text-sm text-zinc-500">
                  {qualityCheckMessage}
                </p>
              )}

              {qualityCheck && (
                <div className="whitespace-pre-wrap rounded-2xl border border-zinc-800 bg-zinc-950 p-4 text-sm leading-relaxed text-zinc-300">
                  {qualityCheck}
                </div>
              )}
            </section>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-wrap gap-3">
                <button
                  type="submit"
                  disabled={publishing || isBodyOverLimit}
                  className="rounded-full bg-white px-6 py-3 text-black transition hover:bg-zinc-200 disabled:opacity-50"
                >
                  {publishing
                    ? isEditMode ? "Saving..." : "Publishing..."
                    : isEditMode ? "Save Changes" : "Publish Discussion"}
                </button>

                {canUseDrafts && !isEditMode && (
                  <button
                    type="button"
                    onClick={saveDraft}
                    disabled={savingDraft || publishing}
                    className="rounded-full border border-zinc-700 px-6 py-3 text-zinc-300 transition hover:border-zinc-500 hover:text-white disabled:cursor-not-allowed disabled:border-zinc-900 disabled:text-zinc-700"
                  >
                    {savingDraft ? "Saving..." : "Save Draft"}
                  </button>
                )}
              </div>

              <p className="text-sm text-zinc-600">
                Press Cmd+Enter or Ctrl+Enter to {isEditMode ? "save changes" : "publish"}.
              </p>
            </div>

            {message && <p className="text-sm text-zinc-400">{message}</p>}
          </form>
        )}
      </div>
    </main>
  );
}
