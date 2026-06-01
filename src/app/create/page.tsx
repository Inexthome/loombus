"use client";

import { ProgressiveGuide } from "@/components/progressive-guide";
import { SafetyWarningModal, getSafetyWarningFromResult, type SafetyWarningState } from "@/components/safety-warning-modal";

import Link from "next/link";
import { type FormEvent, type KeyboardEvent, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { DEFAULT_DISCUSSION_TOPIC, DISCUSSION_TOPICS } from "@/lib/discussion-topics";
import { REALITY_LENSES, normalizeRealityLens } from "@/lib/reality-lenses";
import { PURPOSE_LANES, normalizePurposeLane } from "@/lib/purpose-lanes";

type Profile = {
  full_name: string | null;
  username: string | null;
  bio: string | null;
  avatar_url: string | null;
  is_admin?: boolean | null;
  identity_verification_status?: string | null;
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
  reality_lens: string | null;
  purpose_lane: string | null;
  body: string;
  created_at: string;
  updated_at: string;
};

type EditableDiscussion = {
  id: string;
  user_id: string;
  title: string;
  topic: string;
  reality_lens: string | null;
  purpose_lane: string | null;
  body: string;
  created_at: string;
  updated_at: string | null;
  edited_at: string | null;
  edit_count: number | null;
};

const STANDARD_DISCUSSION_MAX_LENGTH = 5000;
const LONG_DISCUSSION_MAX_LENGTH = 12000;
const ATTACHMENT_BUCKET = "discussion-attachments";
const MAX_ATTACHMENT_FILES = 3;
const MAX_ATTACHMENT_SIZE_BYTES = 10 * 1024 * 1024;
const ALLOWED_ATTACHMENT_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "application/pdf",
]);

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

function getTagInputItems(value: string) {
  return [
    ...new Set(
      value
        .split(",")
        .map((tag) => tag.trim().replace(/^#+/, "").replace(/\s+/g, " "))
        .filter(Boolean)
        .map((tag) => tag.slice(0, 40))
    ),
  ].slice(0, 5);
}

function getTagInputHelper(value: string) {
  const tags = getTagInputItems(value);

  if (tags.length === 0) {
    return "Optional. Add up to 5 tags separated by commas.";
  }

  return `${tags.length}/5 tags: ${tags.join(", ")}`;
}

function formatAttachmentFileSize(bytes: number) {
  if (bytes >= 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

function getAttachmentKind(mimeType: string) {
  if (mimeType.startsWith("image/")) {
    return "image";
  }

  if (mimeType === "application/pdf") {
    return "pdf";
  }

  return null;
}

function getSafeAttachmentFileName(fileName: string) {
  return fileName.trim().replace(/[\\/]/g, "-").slice(0, 120);
}

export default function CreatePage() {
  const [title, setTitle] = useState("");
  const [topic, setTopic] = useState<string>(DEFAULT_DISCUSSION_TOPIC);
  const [realityLens, setRealityLens] = useState<string>("");
  const [purposeLane, setPurposeLane] = useState<string>("");
  const [body, setBody] = useState("");
  const [tagsInput, setTagsInput] = useState("");
  const [attachmentFiles, setAttachmentFiles] = useState<File[]>([]);
  const [attachmentMessage, setAttachmentMessage] = useState("");
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
  const [safetyWarning, setSafetyWarning] = useState<SafetyWarningState>(null);
  const [qualityCheck, setQualityCheck] = useState("");
  const [qualityCheckMessage, setQualityCheckMessage] = useState("");
  const [generatingQualityCheck, setGeneratingQualityCheck] = useState(false);
  const [clarityRewrite, setClarityRewrite] = useState("");
  const [rewriteMessage, setRewriteMessage] = useState("");
  const [generatingRewrite, setGeneratingRewrite] = useState(false);
  const [showOptionalDetails, setShowOptionalDetails] = useState(false);
  const [showAttachmentsPanel, setShowAttachmentsPanel] = useState(false);
  const [showWritingTools, setShowWritingTools] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);

  const isAdmin = Boolean(profile?.is_admin);
  const identityVerificationStatus = profile?.identity_verification_status ?? "unverified";
  const canCreateOrEditDiscussion = isAdmin || identityVerificationStatus === "verified";
  const canUseDrafts = hasPremiumAccess(entitlement, isAdmin);
  const canUseLongPosts = hasLongPostAccess(entitlement, isAdmin);
  const canUseQualityCheck = canUseLongPosts;
  const maxDiscussionLength = canUseLongPosts
    ? LONG_DISCUSSION_MAX_LENGTH
    : STANDARD_DISCUSSION_MAX_LENGTH;
  const bodyCharacterCount = body.length;
  const isBodyOverLimit = bodyCharacterCount > maxDiscussionLength;
  const tagInputHelper = getTagInputHelper(tagsInput);
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
          .select("full_name, username, bio, avatar_url, is_admin, identity_verification_status")
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
          .select("id, user_id, title, topic, reality_lens, purpose_lane, body, created_at, updated_at, edited_at, edit_count")
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

            setRealityLens(normalizeRealityLens(discussion.reality_lens) ?? "");
            setPurposeLane(normalizePurposeLane(discussion.purpose_lane) ?? "");
            setBody(discussion.body ?? "");

            const { data: tagRows, error: tagError } = await supabase
              .from("discussion_tags")
              .select("tag")
              .eq("discussion_id", discussion.id)
              .order("tag", { ascending: true });

            if (tagError) {
              setMessage(`Discussion loaded, but tags could not load: ${tagError.message}`);
            } else {
              setTagsInput((tagRows ?? []).map((row: { tag: string }) => row.tag).join(", "));
              setMessage("Discussion loaded for editing.");
            }
          }
        }

        setAuthChecked(true);
        return;
      }

      if (requestedDraftId) {
        const { data: draftData, error: draftError } = await supabase
          .from("discussion_drafts")
          .select("id, title, topic, reality_lens, purpose_lane, body, created_at, updated_at")
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

          setRealityLens(normalizeRealityLens(draft.reality_lens) ?? "");
          setPurposeLane(normalizePurposeLane(draft.purpose_lane) ?? "");
          setBody(draft.body ?? "");
          setTagsInput("");
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

    const { data: sessionData } = await supabase.auth.getSession();
    const accessToken = sessionData.session?.access_token;

    if (!accessToken) {
      setSavingDraft(false);
      window.location.href = "/login";
      return;
    }

    const response = await fetch("/api/discussion-drafts", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        draftId,
        title,
        topic,
        realityLens,
        purposeLane,
        body,
      }),
    });

    const result = await response.json().catch(() => ({}));

    setSavingDraft(false);

    if (!response.ok) {
      setMessage(result.error ?? "Unable to save draft.");
      return;
    }

    const savedDraft = result.draft as { id: string; updated_at: string };
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

  async function runClarityRewrite() {
    setRewriteMessage("");
    setClarityRewrite("");

    if (generatingRewrite) {
      return;
    }

    if (!canUseQualityCheck) {
      setRewriteMessage("AI rewrite for clarity requires Premium Plus or Admin access.");
      return;
    }

    if (!title.trim()) {
      setRewriteMessage("Enter a title before running the rewrite.");
      return;
    }

    if (!body.trim() || body.trim().length < 8) {
      setRewriteMessage("Add more discussion content before running the rewrite.");
      return;
    }

    const { data: sessionData } = await supabase.auth.getSession();

    if (!sessionData.session) {
      window.location.href = "/login";
      return;
    }

    setGeneratingRewrite(true);

    try {
      const response = await fetch("/api/discussions/rewrite", {
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
        setRewriteMessage(result.error ?? "Unable to run clarity rewrite.");
        return;
      }

      setClarityRewrite(result.rewrite ?? "");
      setRewriteMessage("Rewrite generated. Review it before applying.");
    } finally {
      setGeneratingRewrite(false);
    }
  }

  function applyClarityRewrite() {
    if (!clarityRewrite.trim()) {
      return;
    }

    setBody(clarityRewrite);
    setRewriteMessage("Rewrite applied to editor. Review before publishing.");
  }

  function handleAttachmentSelection(event: React.ChangeEvent<HTMLInputElement>) {
    const selectedFiles = Array.from(event.target.files ?? []);

    setAttachmentMessage("");

    if (selectedFiles.length === 0) {
      setAttachmentFiles([]);
      return;
    }

    if (selectedFiles.length > MAX_ATTACHMENT_FILES) {
      setAttachmentFiles([]);
      setAttachmentMessage("You can attach up to 3 files.");
      event.target.value = "";
      return;
    }

    const invalidFile = selectedFiles.find(
      (file) =>
        !ALLOWED_ATTACHMENT_MIME_TYPES.has(file.type) ||
        file.size <= 0 ||
        file.size > MAX_ATTACHMENT_SIZE_BYTES
    );

    if (invalidFile) {
      setAttachmentFiles([]);
      setAttachmentMessage("Attachments must be JPG, PNG, WebP, GIF, or PDF files up to 10 MB each.");
      event.target.value = "";
      return;
    }

    setAttachmentFiles(selectedFiles);
    setAttachmentMessage(`${selectedFiles.length} attachment${selectedFiles.length === 1 ? "" : "s"} ready.`);
  }

  function clearAttachments() {
    setAttachmentFiles([]);
    setAttachmentMessage("");
  }

  async function uploadDiscussionAttachments({
    discussionId,
    accessToken,
  }: {
    discussionId: string;
    accessToken: string;
  }) {
    if (!currentUserId || attachmentFiles.length === 0) {
      return true;
    }

    for (const [index, file] of attachmentFiles.entries()) {
      const extension = getSafeAttachmentFileName(file.name).split(".").pop() || "file";
      const storagePath = `${currentUserId}/${discussionId}/${crypto.randomUUID()}.${extension}`;
      const attachmentKind = getAttachmentKind(file.type);

      if (!attachmentKind) {
        setAttachmentMessage("Attachment type is not allowed.");
        return false;
      }

      const { error: uploadError } = await supabase.storage
        .from(ATTACHMENT_BUCKET)
        .upload(storagePath, file, {
          contentType: file.type,
          upsert: false,
        });

      if (uploadError) {
        setAttachmentMessage(`Discussion was saved, but ${file.name} could not upload.`);
        return false;
      }

      const { data: publicUrlData } = supabase.storage
        .from(ATTACHMENT_BUCKET)
        .getPublicUrl(storagePath);

      const response = await fetch("/api/discussions/attachments", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          discussionId,
          storagePath,
          publicUrl: publicUrlData.publicUrl,
          fileName: file.name,
          mimeType: file.type,
          fileSizeBytes: file.size,
          sortOrder: index,
        }),
      });

      const result = await response.json().catch(() => ({}));

      if (!response.ok) {
        await supabase.storage.from(ATTACHMENT_BUCKET).remove([storagePath]);
        setAttachmentMessage(result.error ?? `Discussion was saved, but ${file.name} could not be attached.`);
        return false;
      }
    }

    return true;
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
    setSafetyWarning(null);

    if (!canCreateOrEditDiscussion) {
      setPublishing(false);
      setMessage("Verify your identity before publishing discussions.");
      return;
    }

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
          realityLens,
          purposeLane,
          body,
          tags: tagsInput,
        }
      : {
          title,
          topic,
          realityLens,
          purposeLane,
          body,
          tags: tagsInput,
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
      const safetyWarningResult = getSafetyWarningFromResult(result);

      if (safetyWarningResult) {
        setSafetyWarning(safetyWarningResult);
        setMessage("");
      } else {
        setMessage(result.error ?? (isEditMode ? "Unable to save changes." : "Unable to publish discussion."));
      }

      setPublishing(false);
      return;
    }

    if (!isEditMode && draftId) {
      await fetch("/api/discussion-drafts", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${sessionData.session.access_token}`,
        },
        body: JSON.stringify({
          draftId,
        }),
      });
    }

    const discussionId = result.discussion?.id ?? editingDiscussionId;

    if (!isEditMode && discussionId && attachmentFiles.length > 0) {
      const attachmentsUploaded = await uploadDiscussionAttachments({
        discussionId,
        accessToken: sessionData.session.access_token,
      });

      if (!attachmentsUploaded) {
        setPublishing(false);
        setMessage("Discussion was published, but one or more attachments could not be saved. You can open the discussion now or try again later.");
        return;
      }
    }

    window.location.href = `/discussions/${discussionId}`;
  }

  function handleFormKeyDown(event: KeyboardEvent<HTMLFormElement>) {
    if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
      handleCreate(event);
    }
  }

  return (
    <main className="min-h-screen bg-black px-4 pb-24 pt-4 text-white sm:px-6 sm:py-12 lg:py-16 loombus-shell-with-right-rail">
      <SafetyWarningModal
        warning={safetyWarning}
        onClose={() => setSafetyWarning(null)}
      />

      <div className="mx-auto max-w-[46rem]">
        <Link
          href={isEditMode && editingDiscussionId ? `/discussions/${editingDiscussionId}` : "/discussions"}
          className="mb-3 inline-block text-sm text-zinc-500 hover:text-white sm:mb-10"
        >
          ← Back to {isEditMode ? "discussion" : "discussions"}
        </Link>

        <p className="mb-1.5 text-xs uppercase tracking-[0.22em] text-zinc-500 sm:mb-3 sm:text-sm sm:tracking-[0.3em]">
          {isEditMode ? "Edit Discussion" : "New Discussion"}
        </p>

        <h1 className="mb-2 text-2xl font-semibold tracking-tight sm:mb-4 sm:text-4xl md:text-5xl">
          {isEditMode
            ? "Edit discussion."
            : draftId
              ? "Edit draft."
              : "Create a discussion."}
        </h1>

        <p className="mb-4 max-w-2xl text-sm leading-relaxed text-zinc-400 sm:mb-8 sm:text-base">
          {isEditMode
            ? "Make a clear, accountable update to your published discussion."
            : "Start a thoughtful discussion designed around signal, clarity, and meaningful contribution."}
        </p>

        {!authChecked && (
          <div className="rounded-3xl border border-zinc-800 bg-zinc-950 p-5 shadow-2xl shadow-black/30 sm:p-7">
            <p className="text-zinc-400">
              Checking your account status...
            </p>
          </div>
        )}

        {authChecked && !isLoggedIn && (
          <div className="rounded-3xl border border-zinc-800 bg-zinc-950 p-5 shadow-2xl shadow-black/30 sm:p-7">
            <p className="mb-2 text-sm uppercase tracking-[0.25em] text-zinc-500">
              Login Required
            </p>

            <h2 className="mb-3 text-xl font-medium sm:text-2xl">
              Log in to create or edit a discussion.
            </h2>

            <p className="mb-6 leading-relaxed text-zinc-400">
              You can browse discussions without an account, but you need to log in before starting or editing a conversation.
            </p>

            <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:flex-wrap">
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

        {authChecked && isLoggedIn && !canCreateOrEditDiscussion && (
          <div className="mb-5 rounded-2xl border border-amber-900 bg-amber-950/20 p-4 sm:mb-8 sm:p-5">
            <p className="mb-2 text-sm font-medium text-amber-200">
              Verify identity before posting.
            </p>

            <p className="mb-4 text-sm leading-relaxed text-amber-100/80">
              Loombus now requires identity verification before members can publish discussions or replies. You can still save drafts and update your profile while verification is pending.
            </p>

            <Link
              href="/profile"
              className="text-sm text-amber-100 underline decoration-amber-700 underline-offset-4 transition hover:text-white hover:decoration-white"
            >
              Open identity verification →
            </Link>
          </div>
        )}

        {authChecked && isLoggedIn && !profileComplete && (
          <div className="mb-5 rounded-2xl border border-zinc-800 bg-zinc-950 p-4 sm:mb-8 sm:p-5">
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
          <div className="mb-5 rounded-2xl border border-zinc-800 bg-zinc-950 p-4 sm:mb-8 sm:p-5">
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

        {authChecked && isLoggedIn && !isEditMode && (
          <div className="hidden md:block xl:hidden">
            <ProgressiveGuide
          storageKey="loombus-guide-create-first-discussion-v1"
          eyebrow="Guide"
          title="First discussion guide"
          description="Reopen this when you want help shaping a high-signal post."
          collapsedClassName="mb-6 rounded-2xl border border-zinc-800 bg-zinc-950 p-4 sm:mb-8 sm:p-5"
        >
        <section className="mb-6 rounded-2xl border border-zinc-800 bg-zinc-950 p-4 sm:mb-8 sm:p-6">
            <p className="mb-2 text-sm uppercase tracking-[0.25em] text-zinc-500">
              First discussion guide
            </p>

            <h2 className="mb-3 text-xl font-medium sm:text-2xl">
              Start with signal.
            </h2>

            <p className="mb-4 text-sm leading-relaxed text-zinc-500">
              A strong Loombus discussion usually gives people something specific
              to respond to: a question, a claim, a useful observation, or a
              problem worth thinking through.
            </p>

            <div className="grid gap-3 md:grid-cols-3">
              <div className="rounded-2xl border border-zinc-900 bg-black p-4">
                <p className="mb-2 text-sm font-medium text-zinc-300">
                  1. Make the title clear
                </p>

                <p className="text-sm leading-relaxed text-zinc-600">
                  Let readers know the exact idea or question before they open it.
                </p>
              </div>

              <div className="rounded-2xl border border-zinc-900 bg-black p-4">
                <p className="mb-2 text-sm font-medium text-zinc-300">
                  2. Add context
                </p>

                <p className="text-sm leading-relaxed text-zinc-600">
                  Explain what prompted the thought and why it matters.
                </p>
              </div>

              <div className="rounded-2xl border border-zinc-900 bg-black p-4">
                <p className="mb-2 text-sm font-medium text-zinc-300">
                  3. Invite useful replies
                </p>

                <p className="text-sm leading-relaxed text-zinc-600">
                  Ask for examples, counterpoints, experience, or a better framing.
                </p>
              </div>
            </div>
          </section>
            </ProgressiveGuide>
          </div>
        )}

        {authChecked && isLoggedIn && isEditMode && (
          <div className="mb-5 rounded-2xl border border-zinc-800 bg-zinc-950 p-4 sm:mb-8 sm:p-5">
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
            className="space-y-3 rounded-2xl border border-zinc-800 bg-zinc-950 p-3.5 sm:space-y-6 sm:p-8"
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
                className="w-full rounded-xl border border-zinc-800 bg-black px-4 py-3 text-base text-white outline-none focus:border-zinc-500"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm text-zinc-400">
                Discussion Body
              </label>

              <textarea
                rows={7}
                value={body}
                required
                maxLength={maxDiscussionLength}
                onChange={(e) => setBody(e.target.value)}
                placeholder="Write your discussion..."
                className="w-full rounded-xl border border-zinc-800 bg-black px-4 py-3 text-base text-white outline-none focus:border-zinc-500"
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

            <section className="rounded-2xl border border-zinc-800 bg-black/40 p-3 sm:p-5 xl:hidden">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="mb-1 text-xs uppercase tracking-[0.2em] text-zinc-600">
                    Optional details
                  </p>

                  <p className="text-sm text-zinc-400">
                    Topic, life context, direction, and tags.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setShowOptionalDetails((current) => !current)}
                  className="w-full rounded-full border border-zinc-700 px-5 py-3 text-sm text-zinc-300 transition hover:border-zinc-500 hover:text-white sm:w-fit"
                  aria-expanded={showOptionalDetails}
                >
                  {showOptionalDetails ? "Hide details" : "Show details"}
                </button>
              </div>

              {showOptionalDetails && (
                <div className="mt-5 space-y-4">
                  <div className="grid gap-4 md:grid-cols-3">
                    <div>
                      <label className="mb-2 block text-sm text-zinc-400">
                        Topic
                      </label>

                      <select
                        value={topic}
                        onChange={(e) => setTopic(e.target.value)}
                        className="w-full rounded-xl border border-zinc-800 bg-black px-4 py-3 text-base text-white outline-none focus:border-zinc-500"
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
                        Reality Lens optional
                      </label>

                      <select
                        value={realityLens}
                        onChange={(e) => setRealityLens(e.target.value)}
                        className="w-full rounded-xl border border-zinc-800 bg-black px-4 py-3 text-base text-white outline-none focus:border-zinc-500"
                      >
                        <option value="">No reality lens</option>
                        {REALITY_LENSES.map((lens) => (
                          <option key={lens} value={lens}>
                            {lens}
                          </option>
                        ))}
                      </select>

                      <p className="mt-2 text-xs text-zinc-600">
                        Add a human-reality lens if this discussion touches a deeper life experience.
                      </p>
                    </div>

                    <div>
                      <label className="mb-2 block text-sm text-zinc-400">
                        Purpose Lane optional
                      </label>

                      <select
                        value={purposeLane}
                        onChange={(e) => setPurposeLane(e.target.value)}
                        className="w-full rounded-xl border border-zinc-800 bg-black px-4 py-3 text-base text-white outline-none focus:border-zinc-500"
                      >
                        <option value="">No purpose lane</option>
                        {PURPOSE_LANES.map((lane) => (
                          <option key={lane} value={lane}>
                            {lane}
                          </option>
                        ))}
                      </select>

                      <p className="mt-2 text-xs text-zinc-600">
                        Add a direction if this discussion points toward learning, contribution, mastery, or community.
                      </p>
                    </div>
                  </div>

                  <div>
                    <label className="mb-2 block text-sm text-zinc-400">
                      Optional Tags
                    </label>

                    <input
                      type="text"
                      value={tagsInput}
                      onChange={(event) => setTagsInput(event.target.value)}
                      placeholder="AI ethics, publishing, startups"
                      className="w-full rounded-xl border border-zinc-800 bg-black px-4 py-3 text-base text-white outline-none transition placeholder:text-zinc-700 focus:border-zinc-500"
                    />

                    <div className="mt-3 flex flex-col gap-2 text-xs text-zinc-600 sm:flex-row sm:items-center sm:justify-between">
                      <p>
                        {tagInputHelper}
                      </p>

                      {!isEditMode && draftId && (
                        <p>
                          Tags are saved when publishing, not while saving drafts.
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </section>

            {!isEditMode && (
              <section className="rounded-2xl border border-zinc-800 bg-black/40 p-3 sm:p-5 xl:hidden">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="mb-1 text-xs uppercase tracking-[0.2em] text-zinc-600">
                      Optional attachments
                    </p>

                    <p className="text-sm text-zinc-400">
                      Add up to 3 images or PDFs.
                      {attachmentFiles.length > 0 ? ` ${attachmentFiles.length} selected.` : ""}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => setShowAttachmentsPanel((current) => !current)}
                    className="w-full rounded-full border border-zinc-700 px-5 py-3 text-sm text-zinc-300 transition hover:border-zinc-500 hover:text-white sm:w-fit"
                    aria-expanded={showAttachmentsPanel}
                  >
                    {showAttachmentsPanel ? "Hide attachments" : "Add attachments"}
                  </button>
                </div>

                {showAttachmentsPanel && (
                  <div className="mt-5">
                    <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                      <p className="text-sm leading-relaxed text-zinc-500">
                        Optional. Attach files that support the discussion. Max 10 MB each.
                      </p>

                      {attachmentFiles.length > 0 && (
                        <button
                          type="button"
                          onClick={clearAttachments}
                          disabled={publishing}
                          className="w-full rounded-full border border-zinc-800 px-4 py-2 text-sm text-zinc-500 transition hover:border-zinc-600 hover:text-white disabled:cursor-not-allowed disabled:text-zinc-700 sm:w-fit"
                        >
                          Clear
                        </button>
                      )}
                    </div>

                    <input
                      type="file"
                      multiple
                      accept="image/jpeg,image/png,image/webp,image/gif,application/pdf"
                      onChange={handleAttachmentSelection}
                      disabled={publishing}
                      className="block w-full rounded-xl border border-zinc-800 bg-black px-4 py-3 text-sm text-zinc-400 file:mr-4 file:rounded-full file:border-0 file:bg-white file:px-4 file:py-2 file:text-sm file:font-medium file:text-black disabled:cursor-not-allowed disabled:text-zinc-700"
                    />

                    {attachmentFiles.length > 0 && (
                      <div className="mt-4 space-y-2">
                        {attachmentFiles.map((file) => (
                          <div
                            key={`${file.name}-${file.size}-${file.lastModified}`}
                            className="flex flex-col gap-1 rounded-xl border border-zinc-900 bg-zinc-950 p-3 text-sm text-zinc-400 sm:flex-row sm:items-center sm:justify-between"
                          >
                            <span className="truncate">
                              {file.name}
                            </span>

                            <span className="text-xs text-zinc-600">
                              {file.type === "application/pdf" ? "PDF" : "Image"} · {formatAttachmentFileSize(file.size)}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}

                    {attachmentMessage && (
                      <p className="mt-3 text-sm text-zinc-500">
                        {attachmentMessage}
                      </p>
                    )}
                  </div>
                )}
              </section>
            )}

            <section className="rounded-2xl border border-zinc-800 bg-black/40 p-3 sm:p-5 xl:hidden">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="mb-1 text-xs uppercase tracking-[0.2em] text-zinc-600">
                    Optional writing tools
                  </p>

                  <p className="text-sm text-zinc-400">
                    Quality check and clarity rewrite.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setShowWritingTools((current) => !current)}
                  className="w-full rounded-full border border-zinc-700 px-5 py-3 text-sm text-zinc-300 transition hover:border-zinc-500 hover:text-white sm:w-fit"
                  aria-expanded={showWritingTools}
                >
                  {showWritingTools ? "Hide writing tools" : "Writing tools"}
                </button>
              </div>

              {showWritingTools && (
                <div className="mt-5 space-y-4">
                  <section className="rounded-2xl border border-zinc-800 bg-black p-3 sm:p-5">
              <div className="mb-3 flex flex-col gap-3 sm:mb-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="mb-2 text-sm uppercase tracking-wide text-zinc-500">
                    Premium Plus AI
                  </p>

                  <h2 className="text-lg font-medium sm:text-xl">
                    Discussion quality check
                  </h2>

                  <p className="mt-2 hidden text-sm leading-relaxed text-zinc-500 sm:block">
                    Get concise feedback before posting. This does not rewrite
                    or publish anything.
                  </p>
                </div>

                {canUseQualityCheck ? (
                  <button
                    type="button"
                    onClick={runQualityCheck}
                    disabled={generatingQualityCheck || publishing}
                    className="w-full rounded-full border border-zinc-700 px-5 py-3 text-sm text-zinc-300 transition hover:border-zinc-500 hover:text-white disabled:cursor-not-allowed disabled:border-zinc-900 disabled:text-zinc-700 sm:w-fit"
                  >
                    {generatingQualityCheck ? "Checking..." : "Run quality check"}
                  </button>
                ) : (
                  <Link
                    href="/premium"
                    className="w-full rounded-full border border-zinc-800 px-5 py-3 text-center text-sm text-zinc-500 transition hover:border-zinc-600 hover:text-white sm:w-fit"
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

            <section className="rounded-2xl border border-zinc-800 bg-black p-3 sm:p-5">
              <div className="mb-3 flex flex-col gap-3 sm:mb-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="mb-2 text-sm uppercase tracking-wide text-zinc-500">
                    Premium Plus AI
                  </p>

                  <h2 className="text-lg font-medium sm:text-xl">
                    Rewrite for clarity
                  </h2>

                  <p className="mt-2 hidden text-sm leading-relaxed text-zinc-500 sm:block">
                    Generate a clearer version of your discussion body. It will
                    not replace your text unless you apply it.
                  </p>
                </div>

                {canUseQualityCheck ? (
                  <button
                    type="button"
                    onClick={runClarityRewrite}
                    disabled={generatingRewrite || publishing}
                    className="w-full rounded-full border border-zinc-700 px-5 py-3 text-sm text-zinc-300 transition hover:border-zinc-500 hover:text-white disabled:cursor-not-allowed disabled:border-zinc-900 disabled:text-zinc-700 sm:w-fit"
                  >
                    {generatingRewrite ? "Rewriting..." : "Generate rewrite"}
                  </button>
                ) : (
                  <Link
                    href="/premium"
                    className="w-full rounded-full border border-zinc-800 px-5 py-3 text-center text-sm text-zinc-500 transition hover:border-zinc-600 hover:text-white sm:w-fit"
                  >
                    Unlock with Premium Plus
                  </Link>
                )}
              </div>

              {rewriteMessage && (
                <p className="mb-4 text-sm text-zinc-500">
                  {rewriteMessage}
                </p>
              )}

              {clarityRewrite && (
                <div className="space-y-4">
                  <div className="whitespace-pre-wrap rounded-2xl border border-zinc-800 bg-zinc-950 p-4 text-sm leading-relaxed text-zinc-300">
                    {clarityRewrite}
                  </div>

                  <button
                    type="button"
                    onClick={applyClarityRewrite}
                    className="inline-flex w-full justify-center rounded-full border border-zinc-700 px-5 py-3 text-sm text-zinc-300 transition hover:border-zinc-500 hover:text-white sm:w-fit"
                  >
                    Use rewrite
                  </button>
                </div>
              )}
            </section>
                </div>
              )}
            </section>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:flex-wrap">
                <button
                  type="submit"
                  disabled={publishing || isBodyOverLimit || !canCreateOrEditDiscussion}
                  className="w-full rounded-full bg-white px-6 py-3 text-black transition hover:bg-zinc-200 disabled:opacity-50 sm:w-fit"
                >
                  {publishing
                    ? isEditMode ? "Saving..." : "Publishing..."
                    : !canCreateOrEditDiscussion
                      ? "Verify Identity First"
                      : isEditMode ? "Save Changes" : "Publish Discussion"}
                </button>

                {canUseDrafts && !isEditMode && (
                  <button
                    type="button"
                    onClick={saveDraft}
                    disabled={savingDraft || publishing}
                    className="w-full rounded-full border border-zinc-700 px-6 py-3 text-zinc-300 transition hover:border-zinc-500 hover:text-white disabled:cursor-not-allowed disabled:border-zinc-900 disabled:text-zinc-700 sm:w-fit"
                  >
                    {savingDraft ? "Saving..." : "Save Draft"}
                  </button>
                )}
              </div>

              <p className="hidden text-sm text-zinc-600 sm:block">
                Press Cmd+Enter or Ctrl+Enter to {isEditMode ? "save changes" : "publish"}.
              </p>
            </div>

            {message && <p className="text-sm text-zinc-400">{message}</p>}
          </form>
        )}
      <aside className="loombus-right-rail fixed inset-y-0 right-0 z-30 hidden overflow-y-auto border-l border-zinc-900 bg-black/95 px-4 py-6 backdrop-blur-xl xl:block">
        <div className="space-y-4">
          {authChecked && isLoggedIn && !isEditMode && (
            <ProgressiveGuide
              storageKey="loombus-guide-create-first-discussion-v1"
              eyebrow="Guide"
              title="First discussion guide"
              description="Reopen this when you want help shaping a high-signal post."
              collapsedClassName="rounded-3xl border border-zinc-800 bg-zinc-950 p-5 shadow-2xl shadow-black/20"
            >
              <section className="rounded-3xl border border-zinc-800 bg-zinc-950 p-5 shadow-2xl shadow-black/20">
                <p className="mb-2 text-xs uppercase tracking-[0.25em] text-zinc-600">
                  First discussion guide
                </p>

                <h2 className="mb-3 text-xl font-semibold tracking-tight">
                  Start with signal.
                </h2>

                <div className="space-y-3 text-sm leading-relaxed text-zinc-500">
                  <p className="rounded-2xl border border-zinc-900 bg-black p-3">
                    Make the title clear before readers open it.
                  </p>

                  <p className="rounded-2xl border border-zinc-900 bg-black p-3">
                    Add context: what prompted the thought and why it matters.
                  </p>

                  <p className="rounded-2xl border border-zinc-900 bg-black p-3">
                    Invite useful replies: examples, counterpoints, experience, or better framing.
                  </p>
                </div>
              </section>
            </ProgressiveGuide>
          )}

          {authChecked && isLoggedIn && (
            <section className="rounded-3xl border border-zinc-800 bg-zinc-950 p-5 shadow-2xl shadow-black/20">
              <div className="mb-5 flex items-start justify-between gap-3">
                <div>
                  <p className="mb-2 text-xs uppercase tracking-[0.25em] text-zinc-600">
                    Create tools
                  </p>

                  <h2 className="text-xl font-semibold tracking-tight">
                    Shape the post.
                  </h2>

                  <p className="mt-3 text-sm leading-relaxed text-zinc-500">
                    Details, attachments, and writing tools live here. The center stays focused on writing.
                  </p>
                </div>
              </div>

              <div className="grid gap-2">
                <button
                  type="button"
                  onClick={() => setShowOptionalDetails((current) => !current)}
                  className="flex items-center justify-between rounded-2xl border border-zinc-800 bg-black px-4 py-3 text-left text-sm text-zinc-300 transition hover:border-zinc-600 hover:text-white"
                  aria-expanded={showOptionalDetails}
                >
                  <span>Optional details</span>
                  <span className="text-xs text-zinc-600">
                    {showOptionalDetails ? "Hide" : "Show"}
                  </span>
                </button>

                {!isEditMode && (
                  <button
                    type="button"
                    onClick={() => setShowAttachmentsPanel((current) => !current)}
                    className="flex items-center justify-between rounded-2xl border border-zinc-800 bg-black px-4 py-3 text-left text-sm text-zinc-300 transition hover:border-zinc-600 hover:text-white"
                    aria-expanded={showAttachmentsPanel}
                  >
                    <span>Optional attachments</span>
                    <span className="text-xs text-zinc-600">
                      {attachmentFiles.length > 0 ? `${attachmentFiles.length} selected` : showAttachmentsPanel ? "Hide" : "Add"}
                    </span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => setShowWritingTools((current) => !current)}
                  className="flex items-center justify-between rounded-2xl border border-zinc-800 bg-black px-4 py-3 text-left text-sm text-zinc-300 transition hover:border-zinc-600 hover:text-white"
                  aria-expanded={showWritingTools}
                >
                  <span>Optional writing tools</span>
                  <span className="text-xs text-zinc-600">
                    {showWritingTools ? "Hide" : "Open"}
                  </span>
                </button>
              </div>
            </section>
          )}

          {authChecked && isLoggedIn && showOptionalDetails && (
            <section className="rounded-3xl border border-zinc-800 bg-zinc-950 p-5 shadow-2xl shadow-black/20">
              <p className="mb-3 text-xs uppercase tracking-[0.22em] text-zinc-600">
                Optional details
              </p>

              <div className="space-y-4">
                <div>
                  <label className="mb-2 block text-sm text-zinc-400">
                    Topic
                  </label>

                  <select
                    value={topic}
                    onChange={(event) => setTopic(event.target.value)}
                    className="w-full rounded-xl border border-zinc-800 bg-black px-4 py-3 text-base text-white outline-none focus:border-zinc-500"
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
                    Reality Lens optional
                  </label>

                  <select
                    value={realityLens}
                    onChange={(event) => setRealityLens(event.target.value)}
                    className="w-full rounded-xl border border-zinc-800 bg-black px-4 py-3 text-base text-white outline-none focus:border-zinc-500"
                  >
                    <option value="">No reality lens</option>
                    {REALITY_LENSES.map((lens) => (
                      <option key={lens} value={lens}>
                        {lens}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-2 block text-sm text-zinc-400">
                    Purpose Lane optional
                  </label>

                  <select
                    value={purposeLane}
                    onChange={(event) => setPurposeLane(event.target.value)}
                    className="w-full rounded-xl border border-zinc-800 bg-black px-4 py-3 text-base text-white outline-none focus:border-zinc-500"
                  >
                    <option value="">No purpose lane</option>
                    {PURPOSE_LANES.map((lane) => (
                      <option key={lane} value={lane}>
                        {lane}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-2 block text-sm text-zinc-400">
                    Optional Tags
                  </label>

                  <input
                    type="text"
                    value={tagsInput}
                    onChange={(event) => setTagsInput(event.target.value)}
                    placeholder="AI ethics, publishing, startups"
                    className="w-full rounded-xl border border-zinc-800 bg-black px-4 py-3 text-base text-white outline-none transition placeholder:text-zinc-700 focus:border-zinc-500"
                  />

                  <p className="mt-2 text-xs text-zinc-600">
                    {tagInputHelper}
                  </p>
                </div>
              </div>
            </section>
          )}

          {authChecked && isLoggedIn && !isEditMode && showAttachmentsPanel && (
            <section className="rounded-3xl border border-zinc-800 bg-zinc-950 p-5 shadow-2xl shadow-black/20">
              <div className="mb-4 flex items-start justify-between gap-3">
                <div>
                  <p className="mb-2 text-xs uppercase tracking-[0.22em] text-zinc-600">
                    Optional attachments
                  </p>

                  <p className="text-sm leading-relaxed text-zinc-500">
                    Add up to 3 images or PDFs. Max 10 MB each.
                  </p>
                </div>

                {attachmentFiles.length > 0 && (
                  <button
                    type="button"
                    onClick={clearAttachments}
                    disabled={publishing}
                    className="rounded-full border border-zinc-800 px-3 py-1.5 text-xs text-zinc-500 transition hover:border-zinc-600 hover:text-white disabled:cursor-not-allowed disabled:text-zinc-700"
                  >
                    Clear
                  </button>
                )}
              </div>

              <input
                type="file"
                multiple
                accept="image/jpeg,image/png,image/webp,image/gif,application/pdf"
                onChange={handleAttachmentSelection}
                disabled={publishing}
                className="block w-full rounded-xl border border-zinc-800 bg-black px-4 py-3 text-sm text-zinc-400 file:mb-3 file:mr-4 file:rounded-full file:border-0 file:bg-white file:px-4 file:py-2 file:text-sm file:font-medium file:text-black disabled:cursor-not-allowed disabled:text-zinc-700"
              />

              {attachmentFiles.length > 0 && (
                <div className="mt-4 space-y-2">
                  {attachmentFiles.map((file) => (
                    <div
                      key={`${file.name}-${file.size}-${file.lastModified}`}
                      className="rounded-xl border border-zinc-900 bg-black p-3 text-sm text-zinc-400"
                    >
                      <p className="truncate">{file.name}</p>
                      <p className="mt-1 text-xs text-zinc-600">
                        {file.type === "application/pdf" ? "PDF" : "Image"} · {formatAttachmentFileSize(file.size)}
                      </p>
                    </div>
                  ))}
                </div>
              )}

              {attachmentMessage && (
                <p className="mt-3 text-sm text-zinc-500">
                  {attachmentMessage}
                </p>
              )}
            </section>
          )}

          {authChecked && isLoggedIn && showWritingTools && (
            <section className="rounded-3xl border border-zinc-800 bg-zinc-950 p-5 shadow-2xl shadow-black/20">
              <p className="mb-3 text-xs uppercase tracking-[0.22em] text-zinc-600">
                Optional writing tools
              </p>

              <div className="space-y-4">
                <section className="rounded-2xl border border-zinc-800 bg-black p-4">
                  <div className="mb-3 flex flex-col gap-3">
                    <div>
                      <p className="mb-2 text-xs uppercase tracking-[0.18em] text-zinc-600">
                        Premium Plus AI
                      </p>

                      <h2 className="text-base font-medium">
                        Discussion quality check
                      </h2>
                    </div>

                    {canUseQualityCheck ? (
                      <button
                        type="button"
                        onClick={runQualityCheck}
                        disabled={generatingQualityCheck || publishing}
                        className="w-full rounded-full border border-zinc-700 px-4 py-2.5 text-sm text-zinc-300 transition hover:border-zinc-500 hover:text-white disabled:cursor-not-allowed disabled:border-zinc-900 disabled:text-zinc-700"
                      >
                        {generatingQualityCheck ? "Checking..." : "Run quality check"}
                      </button>
                    ) : (
                      <Link
                        href="/premium"
                        className="w-full rounded-full border border-zinc-800 px-4 py-2.5 text-center text-sm text-zinc-500 transition hover:border-zinc-600 hover:text-white"
                      >
                        Unlock with Premium Plus
                      </Link>
                    )}
                  </div>

                  {qualityCheckMessage && (
                    <p className="mb-3 text-sm text-zinc-500">
                      {qualityCheckMessage}
                    </p>
                  )}

                  {qualityCheck && (
                    <div className="whitespace-pre-wrap rounded-2xl border border-zinc-800 bg-zinc-950 p-4 text-sm leading-relaxed text-zinc-300">
                      {qualityCheck}
                    </div>
                  )}
                </section>

                <section className="rounded-2xl border border-zinc-800 bg-black p-4">
                  <div className="mb-3 flex flex-col gap-3">
                    <div>
                      <p className="mb-2 text-xs uppercase tracking-[0.18em] text-zinc-600">
                        Premium Plus AI
                      </p>

                      <h2 className="text-base font-medium">
                        Rewrite for clarity
                      </h2>
                    </div>

                    {canUseQualityCheck ? (
                      <button
                        type="button"
                        onClick={runClarityRewrite}
                        disabled={generatingRewrite || publishing}
                        className="w-full rounded-full border border-zinc-700 px-4 py-2.5 text-sm text-zinc-300 transition hover:border-zinc-500 hover:text-white disabled:cursor-not-allowed disabled:border-zinc-900 disabled:text-zinc-700"
                      >
                        {generatingRewrite ? "Rewriting..." : "Generate rewrite"}
                      </button>
                    ) : (
                      <Link
                        href="/premium"
                        className="w-full rounded-full border border-zinc-800 px-4 py-2.5 text-center text-sm text-zinc-500 transition hover:border-zinc-600 hover:text-white"
                      >
                        Unlock with Premium Plus
                      </Link>
                    )}
                  </div>

                  {rewriteMessage && (
                    <p className="mb-3 text-sm text-zinc-500">
                      {rewriteMessage}
                    </p>
                  )}

                  {clarityRewrite && (
                    <div className="space-y-4">
                      <div className="whitespace-pre-wrap rounded-2xl border border-zinc-800 bg-zinc-950 p-4 text-sm leading-relaxed text-zinc-300">
                        {clarityRewrite}
                      </div>

                      <button
                        type="button"
                        onClick={applyClarityRewrite}
                        className="inline-flex w-full justify-center rounded-full border border-zinc-700 px-4 py-2.5 text-sm text-zinc-300 transition hover:border-zinc-500 hover:text-white"
                      >
                        Use rewrite
                      </button>
                    </div>
                  )}
                </section>
              </div>
            </section>
          )}
        </div>
      </aside>

      </div>
    </main>
  );
}
