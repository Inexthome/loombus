"use client";

import Link from "next/link";
import { type FormEvent, type KeyboardEvent, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import {
  getAiUsageLabel,
  getSubscriptionDisplay,
  getSubscriptionDisplayKey,
} from "@/lib/subscription-plans";
import { DEFAULT_REPORT_REASON, REPORT_REASONS, type ReportReason } from "@/lib/report-reasons";
import { ProfileAvatar } from "@/components/profile-avatar";
import { SafetyWarningModal, getSafetyWarningFromResult, type SafetyWarningState } from "@/components/safety-warning-modal";

type Discussion = {
  id: string;
  user_id: string;
  title: string;
  topic: string;
  reality_lens: string | null;
  purpose_lane: string | null;
  body: string;
  created_at: string;
  updated_at?: string | null;
  edited_at?: string | null;
  edited_by?: string | null;
  edit_count?: number | null;
  discussion_status?: "open" | "resolved" | null;
  resolved_at?: string | null;
  resolved_by?: string | null;
  pinned_reply_id?: string | null;
  pinned_at?: string | null;
  pinned_by?: string | null;
};

type Profile = {
  id: string;
  full_name: string | null;
  username: string | null;
  avatar_url: string | null;
  identity_verification_status?: string | null;
};

type Reply = {
  id: string;
  user_id: string;
  body: string;
  created_at: string;
  updated_at?: string | null;
  edited_at?: string | null;
  edited_by?: string | null;
  edit_count?: number | null;
  referenced_reply_id?: string | null;
  quoted_excerpt?: string | null;
};

type RelatedDiscussion = {
  id: string;
  user_id: string;
  title: string;
  topic: string;
  created_at: string;
};


type DiscussionSummary = {
  id: string;
  discussion_id: string;
  summary: string;
  model_name: string | null;
  source_reply_count: number;
  generated_at: string;
};

type DiscussionAttachment = {
  id: string;
  public_url: string;
  file_name: string;
  mime_type: string;
  file_size_bytes: number;
  attachment_kind: "image" | "pdf";
  sort_order: number;
};

type AiOutputRatingValue = "helpful" | "not_helpful";

type AiOutputRatings = Partial<Record<string, AiOutputRatingValue>>;


type AiEntitlement = {
  tier: string;
  ai_assisted_enabled: boolean;
  monthly_summary_limit: number;
};

type BlockRow = {
  blocker_id: string;
  blocked_id: string;
};

type ClarificationRequest = {
  label: string;
  body: string;
};

type ActionPrompt = {
  label: string;
  body: string;
};

type CommunityPrompt = {
  label: string;
  body: string;
};

const CLARIFICATION_REQUESTS: ClarificationRequest[] = [
  {
    label: "Clarify the claim",
    body: "Could you clarify the main claim here? I want to make sure I understand the point before responding.",
  },
  {
    label: "Ask for an example",
    body: "Could you share a concrete example of what you mean? That would make the point easier to evaluate.",
  },
  {
    label: "Ask for source or context",
    body: "Could you add the source, context, or reasoning behind this claim? I want to understand what it is based on.",
  },
  {
    label: "Ask for practical detail",
    body: "Could you explain how this would work in practice? The idea is interesting, but I need more detail.",
  },
  {
    label: "Ask what would change their view",
    body: "What kind of evidence or example would make you reconsider this view?",
  },
  {
    label: "Ask for lived context",
    body: "Is this coming from lived experience, professional experience, research, or a question you are exploring?",
  },
];

const ACTION_PROMPTS: ActionPrompt[] = [
  {
    label: "What can be learned?",
    body: "One useful thing that can be learned from this discussion is...",
  },
  {
    label: "Name a next question",
    body: "A useful question to explore next is...",
  },
  {
    label: "Connect to a skill",
    body: "The skill or area of mastery this connects to is...",
  },
  {
    label: "Suggest a practical step",
    body: "One practical next step this points to is...",
  },
  {
    label: "Find the community angle",
    body: "A local or community angle worth considering is...",
  },
  {
    label: "Make it more useful",
    body: "This discussion would become more useful if...",
  },
];

const COMMUNITY_PROMPTS: CommunityPrompt[] = [
  {
    label: "Name the issue",
    body: "The local or community issue this connects to is...",
  },
  {
    label: "Who is affected?",
    body: "The people most affected by this problem may be...",
  },
  {
    label: "What should be learned first?",
    body: "Before anyone acts on this, it would help to learn...",
  },
  {
    label: "Small clarifying step",
    body: "One small step that could clarify this issue is...",
  },
  {
    label: "Systems involved",
    body: "The institutions, systems, or local factors involved may include...",
  },
  {
    label: "Make it useful offline",
    body: "This discussion could become more useful beyond online conversation if...",
  },
];

function MentionText({ text }: { text: string }) {
  const parts = text.split(/(@[a-zA-Z0-9_]{2,30})/g);

  return (
    <>
      {parts.map((part, index) => {
        const match = part.match(/^@([a-zA-Z0-9_]{2,30})$/);

        if (!match) {
          return <span key={`${part}-${index}`}>{part}</span>;
        }

        const username = match[1].toLowerCase();

        return (
          <Link
            key={`${part}-${index}`}
            href={`/u/${username}`}
            className="font-medium text-white underline decoration-zinc-600 underline-offset-4 transition hover:decoration-white"
          >
            @{username}
          </Link>
        );
      })}
    </>
  );
}

function getReplyReferencePreview(reply: Reply) {
  const source = reply.quoted_excerpt || reply.body;
  const normalized = source.trim().replace(/\s+/g, " ");

  if (normalized.length <= 280) {
    return normalized;
  }

  return `${normalized.slice(0, 277).trim()}...`;
}

function getReplyEditLabel(reply: Reply) {
  if (!reply.edited_at && !reply.edit_count) {
    return null;
  }

  const parts: string[] = [];

  if (reply.edited_at) {
    parts.push(`Edited ${new Date(reply.edited_at).toLocaleString()}`);
  }

  if (reply.edit_count) {
    parts.push(`${reply.edit_count} ${reply.edit_count === 1 ? "edit" : "edits"}`);
  }

  return parts.join(" · ");
}

function getDiscussionEditLabel(discussion: Discussion) {
  if (!discussion.edited_at && !discussion.edit_count) {
    return null;
  }

  const parts: string[] = [];

  if (discussion.edited_at) {
    parts.push(`Last edited ${new Date(discussion.edited_at).toLocaleString()}`);
  }

  if (discussion.edit_count) {
    parts.push(
      `${discussion.edit_count} ${discussion.edit_count === 1 ? "edit" : "edits"}`
    );
  }

  return parts.join(" · ");
}

function formatAttachmentFileSize(bytes: number) {
  if (bytes >= 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

function ProfileName({
  profile,
  fallback = "Loombus member",
}: {
  profile?: Profile | null;
  fallback?: string;
}) {
  const label =
    profile?.full_name || (profile?.username ? `@${profile.username}` : fallback);

  if (!profile?.username) {
    return <>{label}</>;
  }

  return (
    <Link
      href={`/u/${profile.username}`}
      className="text-zinc-400 transition hover:text-white"
    >
      {label}
    </Link>
  );
}


function AiOutputRatingControls({
  featureKey,
  currentRating,
  working,
  onRate,
}: {
  featureKey: string;
  currentRating?: AiOutputRatingValue;
  working: boolean;
  onRate: (featureKey: string, rating: AiOutputRatingValue | null) => void;
}) {
  return (
    <div className="mt-4 flex flex-col gap-3 border-t border-zinc-900 pt-4 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-xs text-zinc-600">
        Was this AI output useful?
      </p>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={working}
          onClick={() =>
            onRate(featureKey, currentRating === "helpful" ? null : "helpful")
          }
          className={`rounded-full border px-3 py-1.5 text-xs transition disabled:cursor-not-allowed disabled:opacity-50 ${
            currentRating === "helpful"
              ? "border-emerald-700 bg-emerald-950/40 text-emerald-300"
              : "border-zinc-800 text-zinc-400 hover:border-zinc-600 hover:text-white"
          }`}
        >
          Helpful
        </button>

        <button
          type="button"
          disabled={working}
          onClick={() =>
            onRate(
              featureKey,
              currentRating === "not_helpful" ? null : "not_helpful"
            )
          }
          className={`rounded-full border px-3 py-1.5 text-xs transition disabled:cursor-not-allowed disabled:opacity-50 ${
            currentRating === "not_helpful"
              ? "border-amber-700 bg-amber-950/40 text-amber-300"
              : "border-zinc-800 text-zinc-400 hover:border-zinc-600 hover:text-white"
          }`}
        >
          Not helpful
        </button>
      </div>
    </div>
  );
}

export default function DiscussionPage() {
  const params = useParams();
  const id = params.id as string;

  const [discussion, setDiscussion] = useState<Discussion | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [replies, setReplies] = useState<Reply[]>([]);
  const [relatedDiscussions, setRelatedDiscussions] = useState<RelatedDiscussion[]>([]);
  const [discussionTags, setDiscussionTags] = useState<string[]>([]);
  const [discussionAttachments, setDiscussionAttachments] = useState<DiscussionAttachment[]>([]);
  const [replyProfiles, setReplyProfiles] = useState<Record<string, Profile>>({});
  const [replyBody, setReplyBody] = useState("");
  const [replySuggestions, setReplySuggestions] = useState("");
  const [replySuggestionsMessage, setReplySuggestionsMessage] = useState("");
  const [generatingReplySuggestions, setGeneratingReplySuggestions] = useState(false);
  const [referencedReply, setReferencedReply] = useState<Reply | null>(null);
  const [postingReply, setPostingReply] = useState(false);
  const [editingReplyId, setEditingReplyId] = useState<string | null>(null);
  const [editingReplyBody, setEditingReplyBody] = useState("");
  const [updatingReplyId, setUpdatingReplyId] = useState<string | null>(null);
  const [deletingReplyId, setDeletingReplyId] = useState<string | null>(null);
  const [reportingReplyId, setReportingReplyId] = useState<string | null>(null);
  const [reportedDiscussion, setReportedDiscussion] = useState(false);
  const [reportedReplyIds, setReportedReplyIds] = useState<string[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [viewerIdentityStatus, setViewerIdentityStatus] = useState("unverified");
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [safetyWarning, setSafetyWarning] = useState<SafetyWarningState>(null);
  const [statusMessage, setStatusMessage] = useState("");
  const [statusWorking, setStatusWorking] = useState(false);
  const [pinMessage, setPinMessage] = useState("");
  const [pinWorkingReplyId, setPinWorkingReplyId] = useState<string | null>(null);
  const [bookmarkMessage, setBookmarkMessage] = useState("");
  const [isSaved, setIsSaved] = useState(false);
  const [savedBookmarkId, setSavedBookmarkId] = useState<string | null>(null);
  const [savingBookmark, setSavingBookmark] = useState(false);
  const [reportMessage, setReportMessage] = useState("");
  const [reportReason, setReportReason] = useState(DEFAULT_REPORT_REASON);
  const [showMobileThreadActions, setShowMobileThreadActions] = useState(false);
  const [showAiToolsPanel, setShowAiToolsPanel] = useState(false);
  const [showReplyHelpersPanel, setShowReplyHelpersPanel] = useState(false);
  const [discussionSummary, setDiscussionSummary] = useState<DiscussionSummary | null>(null);
  const [summaryMessage, setSummaryMessage] = useState("");
  const [generatingSummary, setGeneratingSummary] = useState(false);
  const [keyTakeaways, setKeyTakeaways] = useState("");
  const [takeawaysMessage, setTakeawaysMessage] = useState("");
  const [generatingTakeaways, setGeneratingTakeaways] = useState(false);
  const [whatChanged, setWhatChanged] = useState("");
  const [whatChangedMessage, setWhatChangedMessage] = useState("");
  const [generatingWhatChanged, setGeneratingWhatChanged] = useState(false);
  const [disagreementMap, setDisagreementMap] = useState("");
  const [disagreementMessage, setDisagreementMessage] = useState("");
  const [generatingDisagreement, setGeneratingDisagreement] = useState(false);
  const [conversationMap, setConversationMap] = useState("");
  const [conversationMapMessage, setConversationMapMessage] = useState("");
  const [generatingConversationMap, setGeneratingConversationMap] = useState(false);
  const [relatedIdeas, setRelatedIdeas] = useState("");
  const [relatedIdeasMessage, setRelatedIdeasMessage] = useState("");
  const [generatingRelatedIdeas, setGeneratingRelatedIdeas] = useState(false);
  const [aiOutputRatings, setAiOutputRatings] = useState<AiOutputRatings>({});
  const [ratingFeatureKey, setRatingFeatureKey] = useState("");
  const [aiEntitlement, setAiEntitlement] = useState<AiEntitlement | null>(null);
  const [monthlySummaryUsage, setMonthlySummaryUsage] = useState(0);
  const [monthlyTakeawaysUsage, setMonthlyTakeawaysUsage] = useState(0);
  const [monthlyWhatChangedUsage, setMonthlyWhatChangedUsage] = useState(0);
  const [monthlyDisagreementUsage, setMonthlyDisagreementUsage] = useState(0);
  const [monthlyConversationMapUsage, setMonthlyConversationMapUsage] = useState(0);
  const [monthlyRelatedIdeasUsage, setMonthlyRelatedIdeasUsage] = useState(0);
  const [openPremiumAiTool, setOpenPremiumAiTool] = useState("");

  useEffect(() => {
    async function loadDiscussion() {
      const { data: discussionData, error: discussionError } = await supabase
        .from("discussions")
        .select("*")
        .eq("id", id)
        .is("deleted_at", null)
        .single();

      if (discussionError || !discussionData) {
        setDiscussion(null);
        setRelatedDiscussions([]);
        setDiscussionTags([]);
        setDiscussionAttachments([]);
        setLoading(false);
        return;
      }

      const { data: profileData } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", discussionData.user_id)
        .single();

      const { data: repliesData } = await supabase
        .from("replies")
        .select("*")
        .eq("discussion_id", id)
        .is("deleted_at", null)
        .order("created_at", { ascending: true });

      const { data: summaryData } = await supabase
        .from("discussion_summaries")
        .select("id, discussion_id, summary, model_name, source_reply_count, generated_at")
        .eq("discussion_id", id)
        .maybeSingle();

      const { data: tagData } = await supabase
        .from("discussion_tags")
        .select("tag")
        .eq("discussion_id", id)
        .order("tag", { ascending: true });

      const { data: attachmentData } = await supabase
        .from("discussion_attachments")
        .select("id, public_url, file_name, mime_type, file_size_bytes, attachment_kind, sort_order")
        .eq("discussion_id", id)
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: true });

      const { data: relatedData } = await supabase
        .from("discussions")
        .select("id, user_id, title, topic, created_at")
        .eq("topic", discussionData.topic)
        .neq("id", id)
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .limit(3);

      const { data: viewerData } = await supabase.auth.getUser();
      const hiddenProfileIds = new Set<string>();

      if (viewerData.user) {
        const { data: blockRows } = await supabase
          .from("user_blocks")
          .select("blocker_id, blocked_id")
          .or(`blocker_id.eq.${viewerData.user.id},blocked_id.eq.${viewerData.user.id}`);

        for (const block of (blockRows ?? []) as BlockRow[]) {
          hiddenProfileIds.add(
            block.blocker_id === viewerData.user.id ? block.blocked_id : block.blocker_id
          );
        }
      }

      const visibleReplies = (repliesData ?? []).filter(
        (reply) => !hiddenProfileIds.has(reply.user_id)
      );

      const visibleRelatedDiscussions = ((relatedData ?? []) as RelatedDiscussion[]).filter(
        (item) => !hiddenProfileIds.has(item.user_id)
      );

      const replyUserIds = [...new Set(visibleReplies.map((reply) => reply.user_id))];

      const replyProfileMap: Record<string, Profile> = {};

      if (replyUserIds.length > 0) {
        const { data: replyProfileData } = await supabase
          .from("profiles")
          .select("*")
          .in("id", replyUserIds);

        for (const replyProfile of replyProfileData ?? []) {
          replyProfileMap[replyProfile.id] = replyProfile;
        }
      }

      setCurrentUserId(viewerData.user?.id ?? null);

      await supabase.from("discussion_views").insert({
        discussion_id: id,
        viewer_id: viewerData.user?.id ?? null,
      });

      if (viewerData.user) {
        const { data: savedData } = await supabase
          .from("bookmarks")
          .select("id")
          .eq("user_id", viewerData.user.id)
          .eq("discussion_id", id)
          .maybeSingle();

        setIsSaved(Boolean(savedData));
        setSavedBookmarkId(savedData?.id ?? null);

        const { data: existingDiscussionReport } = await supabase
          .from("reports")
          .select("id")
          .eq("reporter_id", viewerData.user.id)
          .eq("discussion_id", id)
          .is("reply_id", null)
          .maybeSingle();

        setReportedDiscussion(Boolean(existingDiscussionReport));

        const replyIds = visibleReplies.map((reply) => reply.id);

        if (replyIds.length > 0) {
          const { data: existingReplyReports } = await supabase
            .from("reports")
            .select("reply_id")
            .eq("reporter_id", viewerData.user.id)
            .in("reply_id", replyIds);

          setReportedReplyIds(
            (existingReplyReports ?? [])
              .map((report) => report.reply_id)
              .filter((replyId): replyId is string => Boolean(replyId))
          );
        }

        const { data: viewerProfile } = await supabase
          .from("profiles")
          .select("is_admin, identity_verification_status")
          .eq("id", viewerData.user.id)
          .single();

        const viewerIsAdmin = Boolean(viewerProfile?.is_admin);
        setIsAdmin(viewerIsAdmin);
        setViewerIdentityStatus(viewerProfile?.identity_verification_status ?? "unverified");

        const { data: entitlementData } = await supabase
          .from("user_ai_entitlements")
          .select("tier, ai_assisted_enabled, monthly_summary_limit")
          .eq("user_id", viewerData.user.id)
          .maybeSingle();

        const resolvedEntitlement = viewerIsAdmin
          ? {
              tier: "admin",
              ai_assisted_enabled: true,
              monthly_summary_limit: 999999,
            }
          : entitlementData ?? {
              tier: "free",
              ai_assisted_enabled: false,
              monthly_summary_limit: 0,
            };

        setAiEntitlement(resolvedEntitlement);

        if (!viewerIsAdmin && resolvedEntitlement.ai_assisted_enabled) {
          const now = new Date();
          const monthStart = new Date(
            Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)
          ).toISOString();

          const { count: monthlyUsageCount } = await supabase
            .from("ai_usage_events")
            .select("*", { count: "exact", head: true })
            .eq("user_id", viewerData.user.id)
            .eq("feature_key", "thread_summary")
            .eq("cached", false)
            .eq("success", true)
            .gte("created_at", monthStart);

          const { count: monthlyTakeawaysCount } = await supabase
            .from("ai_usage_events")
            .select("*", { count: "exact", head: true })
            .eq("user_id", viewerData.user.id)
            .eq("feature_key", "key_takeaways")
            .eq("cached", false)
            .eq("success", true)
            .gte("created_at", monthStart);

          const { count: monthlyWhatChangedCount } = await supabase
            .from("ai_usage_events")
            .select("*", { count: "exact", head: true })
            .eq("user_id", viewerData.user.id)
            .eq("feature_key", "what_changed")
            .eq("cached", false)
            .eq("success", true)
            .gte("created_at", monthStart);

          const { count: monthlyDisagreementCount } = await supabase
            .from("ai_usage_events")
            .select("*", { count: "exact", head: true })
            .eq("user_id", viewerData.user.id)
            .eq("feature_key", "disagreement_map")
            .eq("cached", false)
            .eq("success", true)
            .gte("created_at", monthStart);

          const { count: monthlyConversationMapCount } = await supabase
            .from("ai_usage_events")
            .select("*", { count: "exact", head: true })
            .eq("user_id", viewerData.user.id)
            .eq("feature_key", "conversation_map")
            .eq("cached", false)
            .eq("success", true)
            .gte("created_at", monthStart);

          const { count: monthlyRelatedIdeasCount } = await supabase
            .from("ai_usage_events")
            .select("*", { count: "exact", head: true })
            .eq("user_id", viewerData.user.id)
            .eq("feature_key", "related_ideas")
            .eq("cached", false)
            .eq("success", true)
            .gte("created_at", monthStart);

          setMonthlySummaryUsage(monthlyUsageCount ?? 0);
          setMonthlyTakeawaysUsage(monthlyTakeawaysCount ?? 0);
          setMonthlyWhatChangedUsage(monthlyWhatChangedCount ?? 0);
          setMonthlyDisagreementUsage(monthlyDisagreementCount ?? 0);
          setMonthlyConversationMapUsage(monthlyConversationMapCount ?? 0);
          setMonthlyRelatedIdeasUsage(monthlyRelatedIdeasCount ?? 0);
        }
      }

      setDiscussion(discussionData);
      setProfile(profileData ?? null);
      setDiscussionSummary(summaryData ?? null);
      setReplies(visibleReplies);
      setRelatedDiscussions(visibleRelatedDiscussions);
      setDiscussionTags((tagData ?? []).map((row: { tag: string }) => row.tag));
      setDiscussionAttachments((attachmentData ?? []) as DiscussionAttachment[]);
      setReplyProfiles(replyProfileMap);
      setLoading(false);
    }

    loadDiscussion();
  }, [id]);

  function startRespondToPoint(reply: Reply) {
    setMessage("");
    setReferencedReply(reply);

    window.setTimeout(() => {
      document.getElementById("reply-form")?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    }, 0);
  }

  function clearReferencedReply() {
    setReferencedReply(null);
  }

  function startClarificationRequest(request: ClarificationRequest) {
    setMessage("");
    setSafetyWarning(null);
    setReferencedReply(null);
    setReplyBody(request.body);

    window.setTimeout(() => {
      document.getElementById("reply-form")?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    }, 0);
  }

  function startActionPrompt(prompt: ActionPrompt) {
    setMessage("");
    setSafetyWarning(null);
    setReferencedReply(null);
    setReplyBody(prompt.body);

    window.setTimeout(() => {
      document.getElementById("reply-form")?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    }, 0);
  }

  function startCommunityPrompt(prompt: CommunityPrompt) {
    setMessage("");
    setSafetyWarning(null);
    setReferencedReply(null);
    setReplyBody(prompt.body);

    window.setTimeout(() => {
      document.getElementById("reply-form")?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    }, 0);
  }

  async function handleReply(
    event?: FormEvent<HTMLFormElement> | KeyboardEvent<HTMLFormElement>
  ) {
    event?.preventDefault();

    setMessage("");
    setSafetyWarning(null);

    if (postingReply) {
      return;
    }

    if (!canReplyWithIdentity) {
      setMessage("Complete your public profile before replying.");
      return;
    }

    if (!replyBody.trim()) {
      setMessage("Reply cannot be empty.");
      return;
    }

    setPostingReply(true);

    try {
      const { data: sessionData } = await supabase.auth.getSession();

      if (!sessionData.session) {
        window.location.href = "/login";
        return;
      }

      const response = await fetch("/api/replies/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${sessionData.session.access_token}`,
        },
        body: JSON.stringify({
          discussionId: id,
          body: replyBody,
          referencedReplyId: referencedReply?.id ?? undefined,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        const safetyWarningResult = getSafetyWarningFromResult(result);

        if (safetyWarningResult) {
          setSafetyWarning(safetyWarningResult);
          setMessage("");
        } else {
          setMessage(result.error ?? "Unable to post reply.");
        }

        return;
      }

      const newReply = result.reply as Reply | undefined;

      if (newReply) {
        setReplies((current) => [...current, newReply]);

        const { data: profileData } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", newReply.user_id)
          .single();

        if (profileData) {
          setReplyProfiles((current) => ({
            ...current,
            [newReply.user_id]: profileData,
          }));
        }
      }

      setReplyBody("");
      setReferencedReply(null);
      setMessage("Reply posted.");
    } finally {
      setPostingReply(false);
    }
  }

  function handleReplyFormKeyDown(event: KeyboardEvent<HTMLFormElement>) {
    if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
      handleReply(event);
    }
  }
  async function loadAiOutputRatings(discussionId: string) {
    const { data: sessionData } = await supabase.auth.getSession();
    const accessToken = sessionData.session?.access_token;

    if (!accessToken) {
      return;
    }

    const response = await fetch(
      `/api/ai/output-ratings?discussionId=${encodeURIComponent(discussionId)}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        cache: "no-store",
      }
    );

    if (!response.ok) {
      return;
    }

    const result = await response.json().catch(() => ({}));

    if (result?.ratings && typeof result.ratings === "object") {
      setAiOutputRatings(result.ratings as AiOutputRatings);
    }
  }

  async function handleRateAiOutput(
    featureKey: string,
    rating: AiOutputRatingValue | null
  ) {
    if (!discussion?.id) {
      return;
    }

    setRatingFeatureKey(featureKey);

    const { data: sessionData } = await supabase.auth.getSession();
    const accessToken = sessionData.session?.access_token;

    if (!accessToken) {
      setRatingFeatureKey("");
      return;
    }

    try {
      const response = await fetch("/api/ai/output-ratings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          discussionId: discussion.id,
          featureKey,
          rating,
        }),
      });

      const result = await response.json().catch(() => ({}));

      if (!response.ok) {
        setRatingFeatureKey("");
        return;
      }

      setAiOutputRatings((current) => {
        const next = { ...current };

        if (result.rating) {
          next[featureKey] = result.rating;
        } else {
          delete next[featureKey];
        }

        return next;
      });
    } catch {
      // Rating feedback is non-blocking. Do not interrupt the discussion view.
    } finally {
      setRatingFeatureKey("");
    }
  }

  useEffect(() => {
    if (!currentUserId || !discussion?.id) {
      return;
    }

    void loadAiOutputRatings(discussion.id);
  }, [currentUserId, discussion?.id]);
  async function handleGenerateReplySuggestions() {
    if (generatingReplySuggestions) {
      return;
    }

    if (!currentUserId) {
      window.location.href = "/login";
      return;
    }

    if (!canUseAiSummary) {
      setReplySuggestionsMessage(
        "AI reply suggestions require Premium or Premium Plus access."
      );
      return;
    }

    if (!discussion?.id) {
      setReplySuggestionsMessage("Discussion is still loading.");
      return;
    }

    setGeneratingReplySuggestions(true);
    setReplySuggestionsMessage("");

    const { data: sessionData } = await supabase.auth.getSession();
    const accessToken = sessionData.session?.access_token;

    if (!accessToken) {
      setGeneratingReplySuggestions(false);
      window.location.href = "/login";
      return;
    }

    try {
      const response = await fetch("/api/discussions/reply-suggestions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          discussionId: discussion.id,
        }),
      });

      const result = await response.json().catch(() => ({}));

      if (!response.ok) {
        setReplySuggestionsMessage(
          result.error ?? "Unable to generate reply suggestions."
        );
        setGeneratingReplySuggestions(false);
        return;
      }

      setReplySuggestions(result.replySuggestions ?? "");
      setReplySuggestionsMessage(
        "Reply targets generated. Use them as prompts for your own thinking."
      );
    } catch {
      setReplySuggestionsMessage("Unable to generate reply suggestions.");
    } finally {
      setGeneratingReplySuggestions(false);
    }
  }



  async function handleGenerateSummary() {
    setSummaryMessage("");

    if (generatingSummary) {
      return;
    }

    setGeneratingSummary(true);

    try {
      const { data: sessionData } = await supabase.auth.getSession();

      if (!sessionData.session) {
        window.location.href = "/login";
        return;
      }

      const response = await fetch("/api/discussions/summary", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${sessionData.session.access_token}`,
        },
        body: JSON.stringify({
          discussionId: id,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        setSummaryMessage(result.error ?? "Unable to generate summary.");
        return;
      }

      setDiscussionSummary(result.summary ?? null);

      if (!result.cached && typeof result.monthlySummaryUsage === "number") {
        setMonthlySummaryUsage(result.monthlySummaryUsage);
      }

      setSummaryMessage(result.cached ? "Showing cached summary." : "Summary generated.");
    } finally {
      setGeneratingSummary(false);
    }
  }

  async function handleGenerateKeyTakeaways() {
    setTakeawaysMessage("");

    if (!currentUserId) {
      window.location.href = "/login";
      return;
    }

    if (!canUseAiSummary) {
      setTakeawaysMessage("This tool requires Premium or Premium Plus access. Choose a plan to unlock it.");
      return;
    }

    setGeneratingTakeaways(true);

    try {
      const { data: sessionData } = await supabase.auth.getSession();

      if (!sessionData.session) {
        window.location.href = "/login";
        return;
      }

      if (!discussion) {
        setTakeawaysMessage("Discussion is not loaded yet.");
        return;
      }

      const response = await fetch("/api/discussions/key-takeaways", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${sessionData.session.access_token}`,
        },
        body: JSON.stringify({
          discussionId: discussion.id,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        setTakeawaysMessage(result.error ?? "Unable to generate key takeaways.");
        return;
      }

      setKeyTakeaways(result.takeaways ?? "");

      if (typeof result.monthlyTakeawaysUsage === "number") {
        setMonthlyTakeawaysUsage(result.monthlyTakeawaysUsage);
      }

      setTakeawaysMessage(
        result.cached ? "Showing cached key takeaways." : "Key takeaways generated."
      );
    } finally {
      setGeneratingTakeaways(false);
    }
  }


  async function handleGenerateWhatChanged() {
    setWhatChangedMessage("");

    if (!currentUserId) {
      window.location.href = "/login";
      return;
    }

    if (!canUseAiSummary) {
      setWhatChangedMessage("This tool requires Premium or Premium Plus access. Choose a plan to unlock it.");
      return;
    }

    setGeneratingWhatChanged(true);

    try {
      const { data: sessionData } = await supabase.auth.getSession();

      if (!sessionData.session) {
        window.location.href = "/login";
        return;
      }

      if (!discussion) {
        setWhatChangedMessage("Discussion is not loaded yet.");
        return;
      }

      const response = await fetch("/api/discussions/what-changed", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${sessionData.session.access_token}`,
        },
        body: JSON.stringify({
          discussionId: discussion.id,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        setWhatChangedMessage(result.error ?? "Unable to generate what-changed analysis.");
        return;
      }

      setWhatChanged(result.whatChanged ?? "");

      if (typeof result.monthlyWhatChangedUsage === "number") {
        setMonthlyWhatChangedUsage(result.monthlyWhatChangedUsage);
      }

      setWhatChangedMessage(
        result.cached ? "Showing cached what-changed analysis." : "What-changed analysis generated."
      );
    } finally {
      setGeneratingWhatChanged(false);
    }
  }

  async function handleGenerateDisagreementMap() {
    setDisagreementMessage("");

    if (!currentUserId) {
      window.location.href = "/login";
      return;
    }

    if (!canUseAiSummary) {
      setDisagreementMessage("This tool requires Premium or Premium Plus access. Choose a plan to unlock it.");
      return;
    }

    setGeneratingDisagreement(true);

    try {
      const { data: sessionData } = await supabase.auth.getSession();

      if (!sessionData.session) {
        window.location.href = "/login";
        return;
      }

      if (!discussion) {
        setDisagreementMessage("Discussion is not loaded yet.");
        return;
      }

      const response = await fetch("/api/discussions/disagreement-map", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${sessionData.session.access_token}`,
        },
        body: JSON.stringify({
          discussionId: discussion.id,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        setDisagreementMessage(result.error ?? "Unable to generate disagreement map.");
        return;
      }

      setDisagreementMap(result.disagreementMap ?? "");

      if (typeof result.monthlyDisagreementUsage === "number") {
        setMonthlyDisagreementUsage(result.monthlyDisagreementUsage);
      }

      setDisagreementMessage(
        result.cached ? "Showing cached disagreement map." : "Disagreement map generated."
      );
    } finally {
      setGeneratingDisagreement(false);
    }
  }

  async function handleGenerateConversationMap() {
    setConversationMapMessage("");

    if (!currentUserId) {
      window.location.href = "/login";
      return;
    }

    if (!canUseAiSummary) {
      setConversationMapMessage("This tool requires Premium or Premium Plus access. Choose a plan to unlock it.");
      return;
    }

    setGeneratingConversationMap(true);

    try {
      const { data: sessionData } = await supabase.auth.getSession();

      if (!sessionData.session) {
        window.location.href = "/login";
        return;
      }

      if (!discussion) {
        setConversationMapMessage("Discussion is not loaded yet.");
        return;
      }

      const response = await fetch("/api/discussions/conversation-map", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${sessionData.session.access_token}`,
        },
        body: JSON.stringify({
          discussionId: discussion.id,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        setConversationMapMessage(result.error ?? "Unable to generate conversation map.");
        return;
      }

      setConversationMap(result.conversationMap ?? "");

      if (typeof result.monthlyConversationMapUsage === "number") {
        setMonthlyConversationMapUsage(result.monthlyConversationMapUsage);
      }

      setConversationMapMessage(
        result.cached ? "Showing cached conversation map." : "Conversation map generated."
      );
    } finally {
      setGeneratingConversationMap(false);
    }
  }

  async function handleGenerateRelatedIdeas() {
    setRelatedIdeasMessage("");

    if (!currentUserId) {
      window.location.href = "/login";
      return;
    }

    if (!canUseAiSummary) {
      setRelatedIdeasMessage("This tool requires Premium or Premium Plus access. Choose a plan to unlock it.");
      return;
    }

    setGeneratingRelatedIdeas(true);

    try {
      const { data: sessionData } = await supabase.auth.getSession();

      if (!sessionData.session) {
        window.location.href = "/login";
        return;
      }

      if (!discussion) {
        setRelatedIdeasMessage("Discussion is not loaded yet.");
        return;
      }

      const response = await fetch("/api/discussions/related-ideas", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${sessionData.session.access_token}`,
        },
        body: JSON.stringify({
          discussionId: discussion.id,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        setRelatedIdeasMessage(result.error ?? "Unable to generate related ideas.");
        return;
      }

      setRelatedIdeas(result.relatedIdeas ?? "");

      if (typeof result.monthlyRelatedIdeasUsage === "number") {
        setMonthlyRelatedIdeasUsage(result.monthlyRelatedIdeasUsage);
      }

      setRelatedIdeasMessage(
        result.cached ? "Showing cached related ideas." : "Related ideas generated."
      );
    } finally {
      setGeneratingRelatedIdeas(false);
    }
  }

  function startReplyEdit(reply: Reply) {
    setMessage("");
    setEditingReplyId(reply.id);
    setEditingReplyBody(reply.body);
  }

  function cancelReplyEdit() {
    setEditingReplyId(null);
    setEditingReplyBody("");
  }

  async function handleUpdateReply(replyId: string) {
    setMessage("");
    setSafetyWarning(null);

    if (!editingReplyBody.trim()) {
      setMessage("Please enter a reply.");
      return;
    }

    if (updatingReplyId) {
      return;
    }

    setUpdatingReplyId(replyId);

    try {
      const { data: sessionData } = await supabase.auth.getSession();

      if (!sessionData.session) {
        window.location.href = "/login";
        return;
      }

      const response = await fetch("/api/replies/update", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${sessionData.session.access_token}`,
        },
        body: JSON.stringify({
          replyId,
          body: editingReplyBody,
        }),
      });

      const result = await response.json().catch(() => ({}));

      if (!response.ok) {
        const safetyWarningResult = getSafetyWarningFromResult(result);

        if (safetyWarningResult) {
          setSafetyWarning(safetyWarningResult);
          setMessage("");
        } else {
          setMessage(result.error ?? "Unable to update reply.");
        }

        return;
      }

      const updatedReply = result.reply as Reply;

      setReplies((current) =>
        current.map((reply) =>
          reply.id === replyId
            ? {
                ...reply,
                body: updatedReply.body,
                updated_at: updatedReply.updated_at ?? null,
                edited_at: updatedReply.edited_at ?? null,
                edited_by: updatedReply.edited_by ?? null,
                edit_count: updatedReply.edit_count ?? reply.edit_count ?? 0,
              }
            : reply
        )
      );

      setEditingReplyId(null);
      setEditingReplyBody("");
      setMessage("Reply updated.");
    } finally {
      setUpdatingReplyId(null);
    }
  }

  async function handleDeleteReply(replyId: string) {
    setMessage("");

    if (deletingReplyId) {
      return;
    }

    setDeletingReplyId(replyId);

    try {
      const { data: sessionData } = await supabase.auth.getSession();

      if (!sessionData.session) {
        window.location.href = "/login";
        return;
      }

      const response = await fetch("/api/replies/delete", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${sessionData.session.access_token}`,
        },
        body: JSON.stringify({
          replyId,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        setMessage(result.error ?? "Unable to delete reply.");
        return;
      }

      setReplies((current) =>
        current.filter((reply) => reply.id !== replyId)
      );
      setMessage("Reply deleted.");
    } finally {
      setDeletingReplyId(null);
    }
  }

  async function updatePinnedReply(replyId: string, unpin = false) {
    setPinMessage("");

    if (!discussion || !currentUserId || pinWorkingReplyId) {
      return;
    }

    setPinWorkingReplyId(replyId || "unpin");

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;

      if (!accessToken) {
        window.location.href = "/login";
        return;
      }

      const response = await fetch("/api/discussions/pin-reply", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          discussionId: discussion.id,
          replyId,
          unpin,
        }),
      });

      const result = await response.json().catch(() => ({}));

      if (!response.ok) {
        setPinMessage(result.error ?? "Unable to update pinned reply.");
        return;
      }

      setDiscussion((current) =>
        current
          ? {
              ...current,
              pinned_reply_id: result.discussion?.pinned_reply_id ?? null,
              pinned_at: result.discussion?.pinned_at ?? null,
              pinned_by: result.discussion?.pinned_by ?? null,
            }
          : current
      );

      setPinMessage(unpin ? "Reply unpinned." : "Reply pinned.");
    } finally {
      setPinWorkingReplyId(null);
    }
  }

  async function updateDiscussionStatus(nextStatus: "open" | "resolved") {
    setStatusMessage("");

    if (!discussion || !currentUserId || statusWorking) {
      return;
    }

    setStatusWorking(true);

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;

      if (!accessToken) {
        window.location.href = "/login";
        return;
      }

      const response = await fetch("/api/discussions/status", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          discussionId: discussion.id,
          status: nextStatus,
        }),
      });

      const result = await response.json().catch(() => ({}));

      if (!response.ok) {
        setStatusMessage(result.error ?? "Unable to update discussion status.");
        return;
      }

      setDiscussion((current) =>
        current
          ? {
              ...current,
              discussion_status: result.discussion?.discussion_status ?? nextStatus,
              resolved_at: result.discussion?.resolved_at ?? null,
              resolved_by: result.discussion?.resolved_by ?? null,
            }
          : current
      );

      setStatusMessage(
        nextStatus === "resolved"
          ? "Discussion marked resolved."
          : "Discussion reopened."
      );
    } finally {
      setStatusWorking(false);
    }
  }

  async function handleBookmark() {
    setBookmarkMessage("");

    if (savingBookmark) {
      return;
    }

    setSavingBookmark(true);

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;

      if (!accessToken) {
        window.location.href = "/login";
        return;
      }

      const response = await fetch("/api/bookmarks", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          discussionId: id,
        }),
      });

      const result = await response.json().catch(() => ({}));

      if (!response.ok) {
        setBookmarkMessage(result.error ?? "Already saved or unable to save.");
        return;
      }

      setIsSaved(true);
      setSavedBookmarkId(result.bookmark?.id ?? null);
      setBookmarkMessage("Discussion saved.");
    } finally {
      setSavingBookmark(false);
    }
  }

  async function handleRemoveBookmark() {
    setBookmarkMessage("");

    if (savingBookmark || !savedBookmarkId) {
      return;
    }

    setSavingBookmark(true);

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;

      if (!accessToken) {
        window.location.href = "/login";
        return;
      }

      const response = await fetch("/api/bookmarks", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          bookmarkId: savedBookmarkId,
        }),
      });

      const result = await response.json().catch(() => ({}));

      if (!response.ok) {
        setBookmarkMessage(result.error ?? "Unable to remove saved discussion.");
        return;
      }

      setIsSaved(false);
      setSavedBookmarkId(null);
      setBookmarkMessage("Saved discussion removed.");
    } finally {
      setSavingBookmark(false);
    }
  }

  async function handleReport() {
    setReportMessage("");

    const { data: sessionData } = await supabase.auth.getSession();
    const accessToken = sessionData.session?.access_token;

    if (!accessToken) {
      window.location.href = "/login";
      return;
    }

    const response = await fetch("/api/reports", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        targetType: "discussion",
        discussionId: id,
        reason: reportReason,
      }),
    });

    const result = await response.json().catch(() => ({}));

    if (!response.ok) {
      if (response.status === 409) {
        setReportedDiscussion(true);
      }

      setReportMessage(result.error ?? "Unable to submit report.");
      return;
    }

    setReportedDiscussion(true);
    setReportMessage("Discussion reported.");
  }

  async function handleReportReply(replyId: string) {
    setReportMessage("");

    if (reportingReplyId) {
      return;
    }

    setReportingReplyId(replyId);

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;

      if (!accessToken) {
        window.location.href = "/login";
        return;
      }

      const response = await fetch("/api/reports", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          targetType: "reply",
          discussionId: id,
          replyId,
          reason: reportReason,
        }),
      });

      const result = await response.json().catch(() => ({}));

      if (!response.ok) {
        if (response.status === 409) {
          setReportedReplyIds((current) =>
            current.includes(replyId) ? current : [...current, replyId]
          );
        }

        setReportMessage(result.error ?? "Unable to report reply.");
        return;
      }

      setReportedReplyIds((current) =>
        current.includes(replyId) ? current : [...current, replyId]
      );
      setReportMessage("Reply reported.");
    } finally {
      setReportingReplyId(null);
    }
  }

  const subscriptionDisplayKey = getSubscriptionDisplayKey(aiEntitlement);
  const subscriptionDisplay = getSubscriptionDisplay(aiEntitlement);
  const aiUsageLabel = getAiUsageLabel(aiEntitlement);
  const discussionEditLabel = discussion ? getDiscussionEditLabel(discussion) : null;
  const discussionStatus =
    discussion?.discussion_status === "resolved" ? "resolved" : "open";
  const canManageDiscussionStatus =
    Boolean(currentUserId) &&
    Boolean(discussion) &&
    (discussion?.user_id === currentUserId || isAdmin);
  const pinnedReply = discussion?.pinned_reply_id
    ? replies.find((reply) => reply.id === discussion.pinned_reply_id) ?? null
    : null;
  const visibleReplies = discussion?.pinned_reply_id
    ? replies.filter((reply) => reply.id !== discussion.pinned_reply_id)
    : replies;

  const canUseAiSummary = ["premium", "premium_plus", "admin"].includes(
    subscriptionDisplayKey
  );
  const canReplyWithIdentity = true;

  const monthlySummaryLimit = aiEntitlement?.monthly_summary_limit ?? 0;
  const monthlySummaryRemaining = Math.max(
    monthlySummaryLimit - monthlySummaryUsage,
    0
  );
  const monthlyTakeawaysRemaining = Math.max(
    monthlySummaryLimit - monthlyTakeawaysUsage,
    0
  );
  const monthlyWhatChangedRemaining = Math.max(
    monthlySummaryLimit - monthlyWhatChangedUsage,
    0
  );
  const monthlyDisagreementRemaining = Math.max(
    monthlySummaryLimit - monthlyDisagreementUsage,
    0
  );
  const monthlyConversationMapRemaining = Math.max(
    monthlySummaryLimit - monthlyConversationMapUsage,
    0
  );
  const monthlyRelatedIdeasRemaining = Math.max(
    monthlySummaryLimit - monthlyRelatedIdeasUsage,
    0
  );

  if (loading) {
    return (
      <main className="min-h-screen bg-black px-4 pb-24 pt-4 text-white sm:px-6 sm:py-12 lg:py-16">
      <SafetyWarningModal
        warning={safetyWarning}
        onClose={() => setSafetyWarning(null)}
      />
        <div className="mx-auto max-w-3xl text-zinc-400">
          Loading discussion...
        </div>
      </main>
    );
  }

  if (!discussion) {
    return (
      <main className="min-h-screen bg-black px-4 pb-24 pt-4 text-white sm:px-6 sm:py-12 lg:py-16">
      <SafetyWarningModal
        warning={safetyWarning}
        onClose={() => setSafetyWarning(null)}
      />
        <div className="mx-auto max-w-[48rem]">
          <h1 className="mb-6 text-4xl font-semibold">
            Discussion not found.
          </h1>

          <Link href="/discussions" className="text-zinc-400 hover:text-white">
            ← Back to discussions
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-black px-4 pb-24 pt-4 text-white sm:px-6 sm:py-12 lg:py-16 loombus-shell-with-right-rail">
      <SafetyWarningModal
        warning={safetyWarning}
        onClose={() => setSafetyWarning(null)}
      />
      <div className="mx-auto max-w-3xl">
        <Link
          href="/discussions"
          className="mb-3 inline-block text-sm text-zinc-500 hover:text-white sm:mb-10"
        >
          ← Back to discussions
        </Link>

        <div className="mb-2 flex flex-nowrap items-center gap-2 overflow-x-auto pb-1 sm:mb-4 sm:flex-wrap sm:gap-3 sm:overflow-visible sm:pb-0">
          <p className="shrink-0 rounded-full border border-zinc-800 bg-black px-3 py-1 text-[10px] font-medium uppercase tracking-[0.16em] text-zinc-500 sm:text-xs sm:tracking-[0.18em]">
            {discussion.topic}
          </p>

          {discussion.reality_lens && (
            <span className="shrink-0 rounded-full border border-zinc-800 bg-zinc-950 px-3 py-1 text-xs text-zinc-400">
              {discussion.reality_lens}
            </span>
          )}

          {discussion.purpose_lane && (
            <span className="shrink-0 rounded-full border border-zinc-800 bg-zinc-950 px-3 py-1 text-xs text-zinc-400">
              {discussion.purpose_lane}
            </span>
          )}

          {discussionTags.map((tag) => (
            <span
              key={tag}
              className="shrink-0 rounded-full border border-zinc-800 bg-zinc-950 px-3 py-1 text-xs text-zinc-500"
            >
              #{tag}
            </span>
          ))}
        </div>

        <h1 className="mb-2 text-2xl font-semibold tracking-tight sm:mb-4 sm:text-4xl md:text-6xl">
          {discussion.title}
        </h1>

        <div className="mb-4 flex flex-col gap-2 text-sm text-zinc-600 sm:mb-6 sm:gap-3">
          <span className="inline-flex items-center gap-3">
            <ProfileAvatar profile={profile} />
            <span>
              by <ProfileName profile={profile} />
            </span>
          </span>

          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <span>
              Started {new Date(discussion.created_at).toLocaleString()}
            </span>

            {discussionEditLabel && (
              <span className="rounded-full border border-zinc-800 bg-zinc-950 px-3 py-1.5 text-xs text-zinc-400">
                {discussionEditLabel}
              </span>
            )}

            <span
              className={`rounded-full border px-3 py-1.5 text-xs font-medium ${
                discussionStatus === "resolved"
                  ? "border-emerald-800 bg-emerald-950/30 text-emerald-300"
                  : "border-zinc-800 bg-zinc-950 text-zinc-400"
              }`}
            >
              {discussionStatus === "resolved" ? "Resolved" : "Open for replies"}
            </span>

            {discussion.resolved_at && (
              <span className="text-xs text-zinc-600">
                Resolved {new Date(discussion.resolved_at).toLocaleString()}
              </span>
            )}
          </div>
        </div>

        <p className="mb-5 text-base leading-7 text-zinc-300 sm:mb-10 sm:text-xl sm:leading-relaxed">
          {discussion.body}
        </p>

        {discussionAttachments.length > 0 && (
          <section className="mb-6 rounded-2xl border border-zinc-800 bg-zinc-950 p-4 sm:mb-10 sm:rounded-3xl sm:p-6">
            <p className="mb-2 text-xs uppercase tracking-[0.22em] text-zinc-500 sm:text-sm sm:tracking-[0.25em]">
              Attachments
            </p>

            <h2 className="mb-4 text-lg font-medium sm:text-2xl">
              Supporting files
            </h2>

            <div className="grid gap-4">
              {discussionAttachments.map((attachment) => (
                <div
                  key={attachment.id}
                  className="rounded-2xl border border-zinc-800 bg-black p-4"
                >
                  {attachment.attachment_kind === "image" ? (
                    <a
                      href={attachment.public_url}
                      target="_blank"
                      rel="noreferrer"
                      className="block overflow-hidden rounded-xl border border-zinc-900 bg-zinc-950"
                    >
                      <img
                        src={attachment.public_url}
                        alt={attachment.file_name}
                        className="max-h-[520px] w-full object-contain"
                      />
                    </a>
                  ) : (
                    <a
                      href={attachment.public_url}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center justify-between gap-4 rounded-xl border border-zinc-800 bg-zinc-950 p-4 transition hover:border-zinc-600"
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium text-zinc-200">
                          {attachment.file_name}
                        </span>
                        <span className="mt-1 block text-xs text-zinc-600">
                          PDF · {formatAttachmentFileSize(attachment.file_size_bytes)}
                        </span>
                      </span>

                      <span className="shrink-0 text-sm text-zinc-400">
                        Open PDF →
                      </span>
                    </a>
                  )}

                  {attachment.attachment_kind === "image" && (
                    <div className="mt-3 flex flex-col gap-1 text-xs text-zinc-600 sm:flex-row sm:items-center sm:justify-between">
                      <span className="truncate">
                        {attachment.file_name}
                      </span>

                      <span>
                        Image · {formatAttachmentFileSize(attachment.file_size_bytes)}
                      </span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        <div className="mb-3 md:hidden">
          <button
            type="button"
            onClick={() => setShowMobileThreadActions((current) => !current)}
            className="flex w-full items-center justify-between rounded-2xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm font-medium text-zinc-300 transition hover:border-zinc-600 hover:text-white"
            aria-expanded={showMobileThreadActions}
            aria-controls="mobile-thread-actions"
          >
            <span>Thread actions</span>
            <span aria-hidden="true" className="text-lg leading-none">
              ...
            </span>
          </button>

          {showMobileThreadActions && (
            <section
              id="mobile-thread-actions"
              className="mt-2 rounded-2xl border border-zinc-800 bg-zinc-950 p-3.5 shadow-2xl shadow-black/30"
            >
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-zinc-600">
                    Thread controls
                  </p>
                  <h2 className="mt-1 text-lg font-medium">
                    Manage carefully.
                  </h2>
                </div>

                <button
                  type="button"
                  onClick={() => setShowMobileThreadActions(false)}
                  className="rounded-full border border-zinc-800 px-3 py-1.5 text-xs text-zinc-500 transition hover:border-zinc-600 hover:text-white"
                >
                  Close
                </button>
              </div>

              <div className="space-y-3">
                {canManageDiscussionStatus && (
                  <button
                    type="button"
                    onClick={() =>
                      updateDiscussionStatus(
                        discussionStatus === "resolved" ? "open" : "resolved"
                      )
                    }
                    disabled={statusWorking}
                    className={`w-full rounded-full border px-5 py-3 text-sm transition disabled:cursor-not-allowed disabled:border-zinc-900 disabled:text-zinc-700 ${
                      discussionStatus === "resolved"
                        ? "border-zinc-700 text-zinc-300 hover:border-zinc-500 hover:text-white"
                        : "border-emerald-800 text-emerald-300 hover:border-emerald-600 hover:text-emerald-200"
                    }`}
                  >
                    {statusWorking
                      ? "Updating..."
                      : discussionStatus === "resolved"
                        ? "Reopen Discussion"
                        : "Mark Resolved"}
                  </button>
                )}

                {isSaved ? (
                  <button
                    type="button"
                    onClick={handleRemoveBookmark}
                    disabled={savingBookmark}
                    className="w-full rounded-full border border-zinc-800 bg-zinc-900 px-5 py-3 text-sm text-zinc-400 transition hover:border-zinc-600 hover:text-white disabled:cursor-not-allowed disabled:border-zinc-900 disabled:text-zinc-700"
                  >
                    {savingBookmark ? "Removing..." : "Unsave"}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleBookmark}
                    disabled={savingBookmark}
                    className="w-full rounded-full border border-zinc-700 px-5 py-3 text-sm text-zinc-300 transition hover:border-zinc-500 hover:text-white disabled:cursor-not-allowed disabled:border-zinc-900 disabled:text-zinc-700"
                  >
                    {savingBookmark ? "Saving..." : "Save Discussion"}
                  </button>
                )}

                <button
                  type="button"
                  onClick={handleReport}
                  disabled={reportedDiscussion}
                  className="w-full rounded-full border border-red-900 px-5 py-3 text-sm text-red-400 transition hover:border-red-700 hover:text-red-300 disabled:cursor-not-allowed disabled:border-zinc-900 disabled:text-zinc-700"
                >
                  {reportedDiscussion ? "Reported" : "Report Discussion"}
                </button>

                {currentUserId && (
                  <label className="block text-xs text-zinc-500">
                    <span className="mb-2 block">Report reason</span>

                    <select
                      value={reportReason}
                      onChange={(event) => setReportReason(event.target.value as ReportReason)}
                      className="w-full rounded-full border border-zinc-800 bg-black px-4 py-3 text-sm text-zinc-300 outline-none transition focus:border-zinc-600"
                    >
                      {REPORT_REASONS.map((reason) => (
                        <option key={reason} value={reason}>
                          {reason}
                        </option>
                      ))}
                    </select>
                  </label>
                )}

                {(pinMessage || statusMessage || bookmarkMessage || reportMessage) && (
                  <p className="text-sm text-zinc-500">
                    {pinMessage || statusMessage || bookmarkMessage || reportMessage}
                  </p>
                )}
              </div>
            </section>
          )}
        </div>

        <div className="discussion-detail-desktop-center-actions mb-5 hidden flex-col items-stretch gap-2 rounded-2xl border border-zinc-900 bg-black/30 p-3 sm:mb-10 md:flex md:flex-row md:flex-wrap md:items-center md:gap-4 md:border-0 md:bg-transparent md:p-0 xl:hidden">
          {canManageDiscussionStatus && (
            <button
              type="button"
              onClick={() =>
                updateDiscussionStatus(
                  discussionStatus === "resolved" ? "open" : "resolved"
                )
              }
              disabled={statusWorking}
              className={`rounded-full border px-5 py-3 text-sm transition disabled:cursor-not-allowed disabled:border-zinc-900 disabled:text-zinc-700 ${
                discussionStatus === "resolved"
                  ? "border-zinc-700 text-zinc-300 hover:border-zinc-500 hover:text-white"
                  : "border-emerald-800 text-emerald-300 hover:border-emerald-600 hover:text-emerald-200"
              }`}
            >
              {statusWorking
                ? "Updating..."
                : discussionStatus === "resolved"
                  ? "Reopen Discussion"
                  : "Mark Resolved"}
            </button>
          )}

          {isSaved ? (
            <button
              onClick={handleRemoveBookmark}
              disabled={savingBookmark}
              className="rounded-full border border-zinc-800 bg-zinc-900 px-5 py-3 text-sm text-zinc-400 transition hover:border-zinc-600 hover:text-white disabled:cursor-not-allowed disabled:border-zinc-900 disabled:text-zinc-700"
            >
              {savingBookmark ? "Removing..." : "Unsave"}
            </button>
          ) : (
            <button
              onClick={handleBookmark}
              disabled={savingBookmark}
              className="inline-flex justify-center rounded-full border border-zinc-700 px-5 py-3 text-sm text-zinc-300 transition hover:border-zinc-500 hover:text-white disabled:cursor-not-allowed disabled:border-zinc-900 disabled:text-zinc-700"
            >
              {savingBookmark ? "Saving..." : "Save Discussion"}
            </button>
          )}

          <button
            onClick={handleReport}
            disabled={reportedDiscussion}
            className="rounded-full border border-red-900 px-5 py-3 text-sm text-red-400 transition hover:border-red-700 hover:text-red-300 disabled:cursor-not-allowed disabled:border-zinc-900 disabled:text-zinc-700"
          >
            {reportedDiscussion ? "Reported" : "Report Discussion"}
          </button>

          {currentUserId && (
            <label className="flex min-w-0 flex-col text-xs text-zinc-500 sm:min-w-64">
              <span className="mb-2">Report reason</span>

              <select
                value={reportReason}
                onChange={(event) => setReportReason(event.target.value as ReportReason)}
                className="rounded-full border border-zinc-800 bg-black px-4 py-3 text-sm text-zinc-300 outline-none transition focus:border-zinc-600"
              >
                {REPORT_REASONS.map((reason) => (
                  <option key={reason} value={reason}>
                    {reason}
                  </option>
                ))}
              </select>
            </label>
          )}

          {(pinMessage || statusMessage || bookmarkMessage || reportMessage) && (
            <p className="text-sm text-zinc-500">
              {pinMessage || statusMessage || bookmarkMessage || reportMessage}
            </p>
          )}
        </div>

        <nav
          aria-label="Discussion reader actions"
          className="discussion-detail-center-shortcuts mb-4 grid grid-cols-3 gap-1.5 rounded-2xl border border-zinc-900 bg-black/40 p-1.5 sm:mb-10 sm:gap-2 sm:rounded-3xl sm:p-2 xl:hidden"
        >
          <a
            href="#reply-form"
            className="rounded-xl bg-white px-2.5 py-2.5 text-center text-xs font-medium text-black transition hover:bg-zinc-200 sm:rounded-2xl sm:px-3 sm:py-3 sm:text-sm"
          >
            Reply
          </a>

          <a
            href="#replies"
            className="rounded-xl border border-zinc-800 px-2.5 py-2.5 text-center text-xs text-zinc-300 transition hover:border-zinc-600 hover:text-white sm:rounded-2xl sm:px-3 sm:py-3 sm:text-sm"
          >
            Replies
          </a>

          <button
            type="button"
            onClick={() => {
              setShowAiToolsPanel(true);
              setOpenPremiumAiTool((current) => current || "summary");

              window.setTimeout(() => {
                document.getElementById("intelligence-layer")?.scrollIntoView({
                  behavior: "smooth",
                  block: "start",
                });
              }, 0);
            }}
            className="rounded-xl border border-zinc-800 px-2.5 py-2.5 text-center text-xs text-zinc-300 transition hover:border-zinc-600 hover:text-white sm:rounded-2xl sm:px-3 sm:py-3 sm:text-sm"
          >
            AI tools
          </button>
        </nav>

        <section
          id="intelligence-layer"
          className="discussion-detail-center-ai-tools mb-4 scroll-mt-24 rounded-2xl border border-zinc-800 bg-zinc-950 p-3.5 shadow-2xl shadow-black/20 sm:mb-6 sm:rounded-3xl sm:p-6 xl:hidden"
        >
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="mb-2 text-xs uppercase tracking-[0.25em] text-zinc-600">
                Optional tools
              </p>

              <h2 className="text-xl font-semibold tracking-tight sm:text-3xl">
                AI tools
              </h2>

              <p className="mt-3 max-w-2xl text-sm leading-relaxed text-zinc-500 sm:text-base">
                Use these only when you want help understanding or organizing the thread.
              </p>

              {currentUserId && (
                <p className="mt-4 text-sm text-zinc-500">
                  Current plan: {subscriptionDisplay.label}. Included AI usage: {aiUsageLabel}.
                </p>
              )}
            </div>

            <button
              type="button"
              onClick={() => setShowAiToolsPanel((current) => !current)}
              className="w-full rounded-full border border-zinc-700 px-5 py-3 text-sm text-zinc-300 transition hover:border-zinc-500 hover:text-white sm:w-fit"
              aria-expanded={showAiToolsPanel}
            >
              {showAiToolsPanel ? "Hide AI tools" : "Show AI tools"}
            </button>
          </div>
        </section>

        {showAiToolsPanel && (
          <div className="discussion-detail-center-ai-panel mb-6 xl:hidden">
        <section className="mb-2.5 rounded-2xl border border-zinc-800 bg-zinc-950 p-3 sm:mb-4 sm:rounded-3xl sm:p-6">
          <div className="mb-3 flex flex-col gap-3 sm:mb-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:gap-4">
            <div>
              <p className="mb-2 text-xs uppercase tracking-[0.25em] text-zinc-600">
                Idea Structure
              </p>

              <h2 className="text-lg font-medium sm:text-2xl">
                Conversation Map
              </h2>
            </div>

            {openPremiumAiTool === "conversationMap" && currentUserId && canUseAiSummary && (
              <button
                type="button"
                onClick={handleGenerateConversationMap}
                disabled={generatingConversationMap}
                className="w-full rounded-full border border-zinc-700 px-4 py-2 text-center text-sm text-zinc-300 transition hover:border-zinc-500 hover:text-white disabled:cursor-not-allowed disabled:border-zinc-900 disabled:text-zinc-700 sm:w-fit"
              >
                {generatingConversationMap ? "Generating..." : "Generate Conversation Map"}
              </button>
            )}
          </div>
          <button
            type="button"
            onClick={() =>
              setOpenPremiumAiTool((current) =>
                current === "conversationMap" ? "" : "conversationMap"
              )
            }
            className="mb-3 rounded-full border border-zinc-800 px-4 py-2 text-sm text-zinc-400 transition hover:border-zinc-700 hover:text-white sm:mb-4"
          >
            {openPremiumAiTool === "conversationMap" ? "Hide tool" : "Open tool"}
          </button>

          {openPremiumAiTool === "conversationMap" && (
            <>
              {conversationMap ? (
                <div className="whitespace-pre-wrap rounded-2xl border border-zinc-900 bg-black p-4 leading-relaxed text-zinc-300">
                  {conversationMap}
                  <AiOutputRatingControls
                    featureKey="conversation_map"
                    currentRating={aiOutputRatings["conversation_map"]}
                    working={ratingFeatureKey === "conversation_map"}
                    onRate={handleRateAiOutput}
                  />
                </div>
              ) : (
                <p className="text-sm leading-relaxed text-zinc-500 sm:text-base">
                  {!currentUserId
                    ? "Log in to generate an AI conversation map for this discussion."
                    : canUseAiSummary
                      ? "Map the core idea, supporting points, open questions, tensions, and related directions."
                      : (
                        <>
                          Conversation mapping is available with Premium or Premium Plus.{" "}
                          <Link
                            href="/premium"
                            className="text-zinc-300 underline-offset-4 hover:text-white hover:underline"
                          >
                            View Premium
                          </Link>
                        </>
                      )}
                </p>
              )}

              {currentUserId && canUseAiSummary && (
                <div className="mt-5 rounded-2xl border border-zinc-900 bg-black p-4 text-sm text-zinc-500">
                  {isAdmin ? (
                    <p>
                      Admin AI access: unlimited conversation maps.
                    </p>
                  ) : (
                    <p>
                      {subscriptionDisplay.label} AI conversation map usage: {monthlyConversationMapUsage} of {monthlySummaryLimit} used this month.
                      {" "}Remaining: {monthlyConversationMapRemaining}.
                    </p>
                  )}
                </div>
              )}

              {conversationMapMessage && (
                <p className="mt-4 text-sm text-zinc-500">
                  {conversationMapMessage}
                </p>
              )}
            </>
          )}
        </section>

        <section className="mb-2.5 rounded-2xl border border-zinc-800 bg-zinc-950 p-3 sm:mb-4 sm:rounded-3xl sm:p-6">
          <div className="mb-3 flex flex-col gap-3 sm:mb-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:gap-4">
            <div>
              <p className="mb-2 text-xs uppercase tracking-[0.25em] text-zinc-600">
                Idea Graph
              </p>

              <h2 className="text-lg font-medium sm:text-2xl">
                Related Ideas
              </h2>
            </div>

            {openPremiumAiTool === "relatedIdeas" && currentUserId && canUseAiSummary && (
              <button
                type="button"
                onClick={handleGenerateRelatedIdeas}
                disabled={generatingRelatedIdeas}
                className="w-full rounded-full border border-zinc-700 px-4 py-2 text-center text-sm text-zinc-300 transition hover:border-zinc-500 hover:text-white disabled:cursor-not-allowed disabled:border-zinc-900 disabled:text-zinc-700 sm:w-fit"
              >
                {generatingRelatedIdeas ? "Generating..." : "Generate Related Ideas"}
              </button>
            )}
          </div>
          <button
            type="button"
            onClick={() =>
              setOpenPremiumAiTool((current) =>
                current === "relatedIdeas" ? "" : "relatedIdeas"
              )
            }
            className="mb-3 rounded-full border border-zinc-800 px-4 py-2 text-sm text-zinc-400 transition hover:border-zinc-700 hover:text-white sm:mb-4"
          >
            {openPremiumAiTool === "relatedIdeas" ? "Hide tool" : "Open tool"}
          </button>

          {openPremiumAiTool === "relatedIdeas" && (
            <>
              {relatedIdeas ? (
                <div className="whitespace-pre-wrap rounded-2xl border border-zinc-900 bg-black p-4 leading-relaxed text-zinc-300">
                  {relatedIdeas}
                  <AiOutputRatingControls
                    featureKey="related_ideas"
                    currentRating={aiOutputRatings["related_ideas"]}
                    working={ratingFeatureKey === "related_ideas"}
                    onRate={handleRateAiOutput}
                  />
                </div>
              ) : (
                <p className="text-sm leading-relaxed text-zinc-500 sm:text-base">
                  {!currentUserId
                    ? "Log in to generate related ideas for this discussion."
                    : canUseAiSummary
                      ? "Generate adjacent ideas that can become the foundation for an idea graph."
                      : (
                        <>
                          Related ideas are available with Premium or Premium Plus.{" "}
                          <Link
                            href="/premium"
                            className="text-zinc-300 underline-offset-4 hover:text-white hover:underline"
                          >
                            View Premium
                          </Link>
                        </>
                      )}
                </p>
              )}

              {currentUserId && canUseAiSummary && (
                <div className="mt-5 rounded-2xl border border-zinc-900 bg-black p-4 text-sm text-zinc-500">
                  {isAdmin ? (
                    <p>
                      Admin AI access: unlimited related idea maps.
                    </p>
                  ) : (
                    <p>
                      {subscriptionDisplay.label} AI related ideas usage: {monthlyRelatedIdeasUsage} of {monthlySummaryLimit} used this month.
                      {" "}Remaining: {monthlyRelatedIdeasRemaining}.
                    </p>
                  )}
                </div>
              )}

              {relatedIdeasMessage && (
                <p className="mt-4 text-sm text-zinc-500">
                  {relatedIdeasMessage}
                </p>
              )}
            </>
          )}
        </section>

        <section className="mb-2.5 rounded-2xl border border-zinc-800 bg-zinc-950 p-3 sm:mb-4 sm:rounded-3xl sm:p-6">
          <div className="mb-3 flex flex-col gap-3 sm:mb-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:gap-4">
            <div>
              <p className="mb-2 text-xs uppercase tracking-[0.25em] text-zinc-600">
                Thread Evolution
              </p>

              <h2 className="text-lg font-medium sm:text-2xl">
                What Changed in This Thread
              </h2>
            </div>

            {openPremiumAiTool === "whatChanged" && currentUserId && canUseAiSummary && (
              <button
                type="button"
                onClick={handleGenerateWhatChanged}
                disabled={generatingWhatChanged}
                className="w-full rounded-full border border-zinc-700 px-4 py-2 text-center text-sm text-zinc-300 transition hover:border-zinc-500 hover:text-white disabled:cursor-not-allowed disabled:border-zinc-900 disabled:text-zinc-700 sm:w-fit"
              >
                {generatingWhatChanged ? "Generating..." : "Generate What Changed"}
              </button>
            )}
          </div>
          <button
            type="button"
            onClick={() =>
              setOpenPremiumAiTool((current) =>
                current === "whatChanged" ? "" : "whatChanged"
              )
            }
            className="mb-3 rounded-full border border-zinc-800 px-4 py-2 text-sm text-zinc-400 transition hover:border-zinc-700 hover:text-white sm:mb-4"
          >
            {openPremiumAiTool === "whatChanged" ? "Hide tool" : "Open tool"}
          </button>

          {openPremiumAiTool === "whatChanged" && (
            <>


          {whatChanged ? (
            <div className="whitespace-pre-wrap rounded-2xl border border-zinc-900 bg-black p-4 leading-relaxed text-zinc-300">
              {whatChanged}
              <AiOutputRatingControls
                featureKey="what_changed"
                currentRating={aiOutputRatings["what_changed"]}
                working={ratingFeatureKey === "what_changed"}
                onRate={handleRateAiOutput}
              />
            </div>
          ) : (
            <p className="text-sm leading-relaxed text-zinc-500 sm:text-base">
              {!currentUserId
                ? "Log in to generate what changed in this thread."
                : canUseAiSummary
                  ? "Generate a concise view of how replies changed or expanded the original discussion."
                  : (
                    <>
                      What-changed analysis is available with Premium or Premium Plus.{" "}
                      <Link
                        href="/premium"
                        className="text-zinc-300 underline-offset-4 hover:text-white hover:underline"
                      >
                        View Premium
                      </Link>
                    </>
                  )}
            </p>
          )}

          {currentUserId && canUseAiSummary && (
            <div className="mt-5 rounded-2xl border border-zinc-900 bg-black p-4 text-sm text-zinc-500">
              {isAdmin ? (
                <p>
                  Admin AI access: unlimited what-changed analyses.
                </p>
              ) : (
                <p>
                  {subscriptionDisplay.label} AI what-changed usage: {monthlyWhatChangedUsage} of {monthlySummaryLimit} used this month.
                  {" "}Remaining: {monthlyWhatChangedRemaining}.
                </p>
              )}
            </div>
          )}

          {whatChangedMessage && (
            <p className="mt-4 text-sm text-zinc-500">
              {whatChangedMessage}
            </p>
          )}
        
            </>
          )}
        </section>

        <section className="mb-2.5 rounded-2xl border border-zinc-800 bg-zinc-950 p-3 sm:mb-4 sm:rounded-3xl sm:p-6">
          <div className="mb-3 flex flex-col gap-3 sm:mb-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:gap-4">
            <div>
              <p className="mb-2 text-xs uppercase tracking-[0.25em] text-zinc-600">
                Viewpoint Map
              </p>

              <h2 className="text-lg font-medium sm:text-2xl">
                Disagreement Mapping
              </h2>
            </div>

            {openPremiumAiTool === "disagreementMap" && currentUserId && canUseAiSummary && (
              <button
                type="button"
                onClick={handleGenerateDisagreementMap}
                disabled={generatingDisagreement}
                className="w-full rounded-full border border-zinc-700 px-4 py-2 text-center text-sm text-zinc-300 transition hover:border-zinc-500 hover:text-white disabled:cursor-not-allowed disabled:border-zinc-900 disabled:text-zinc-700 sm:w-fit"
              >
                {generatingDisagreement ? "Generating..." : "Generate Disagreement Map"}
              </button>
            )}
          </div>
          <button
            type="button"
            onClick={() =>
              setOpenPremiumAiTool((current) =>
                current === "disagreementMap" ? "" : "disagreementMap"
              )
            }
            className="mb-3 rounded-full border border-zinc-800 px-4 py-2 text-sm text-zinc-400 transition hover:border-zinc-700 hover:text-white sm:mb-4"
          >
            {openPremiumAiTool === "disagreementMap" ? "Hide tool" : "Open tool"}
          </button>

          {openPremiumAiTool === "disagreementMap" && (
            <>


          {disagreementMap ? (
            <div className="whitespace-pre-wrap rounded-2xl border border-zinc-900 bg-black p-4 leading-relaxed text-zinc-300">
              {disagreementMap}
              <AiOutputRatingControls
                featureKey="disagreement_map"
                currentRating={aiOutputRatings["disagreement_map"]}
                working={ratingFeatureKey === "disagreement_map"}
                onRate={handleRateAiOutput}
              />
            </div>
          ) : (
            <p className="text-sm leading-relaxed text-zinc-500 sm:text-base">
              {!currentUserId
                ? "Log in to generate a neutral disagreement map for this discussion."
                : canUseAiSummary
                  ? "Map real disagreement, different assumptions, and unresolved questions without picking a winner."
                  : (
                    <>
                      Disagreement mapping is available with Premium or Premium Plus.{" "}
                      <Link
                        href="/premium"
                        className="text-zinc-300 underline-offset-4 hover:text-white hover:underline"
                      >
                        View Premium
                      </Link>
                    </>
                  )}
            </p>
          )}

          {currentUserId && canUseAiSummary && (
            <div className="mt-5 rounded-2xl border border-zinc-900 bg-black p-4 text-sm text-zinc-500">
              {isAdmin ? (
                <p>
                  Admin AI access: unlimited disagreement maps.
                </p>
              ) : (
                <p>
                  {subscriptionDisplay.label} AI disagreement map usage: {monthlyDisagreementUsage} of {monthlySummaryLimit} used this month.
                  {" "}Remaining: {monthlyDisagreementRemaining}.
                </p>
              )}
            </div>
          )}

          {disagreementMessage && (
            <p className="mt-4 text-sm text-zinc-500">
              {disagreementMessage}
            </p>
          )}
        
            </>
          )}
        </section>

        <section className="mb-2.5 rounded-2xl border border-zinc-800 bg-zinc-950 p-3 sm:mb-4 sm:rounded-3xl sm:p-6">
          <div className="mb-3 flex flex-col gap-3 sm:mb-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:gap-4">
            <div>
              <p className="mb-2 text-xs uppercase tracking-[0.25em] text-zinc-600">
                High-Signal Takeaways
              </p>

              <h2 className="text-lg font-medium sm:text-2xl">
                Key Takeaways
              </h2>
            </div>

            {openPremiumAiTool === "keyTakeaways" && currentUserId && canUseAiSummary && (
              <button
                type="button"
                onClick={handleGenerateKeyTakeaways}
                disabled={generatingTakeaways}
                className="w-full rounded-full border border-zinc-700 px-4 py-2 text-center text-sm text-zinc-300 transition hover:border-zinc-500 hover:text-white disabled:cursor-not-allowed disabled:border-zinc-900 disabled:text-zinc-700 sm:w-fit"
              >
                {generatingTakeaways ? "Generating..." : "Generate Key Takeaways"}
              </button>
            )}
          </div>
          <button
            type="button"
            onClick={() =>
              setOpenPremiumAiTool((current) =>
                current === "keyTakeaways" ? "" : "keyTakeaways"
              )
            }
            className="mb-3 rounded-full border border-zinc-800 px-4 py-2 text-sm text-zinc-400 transition hover:border-zinc-700 hover:text-white sm:mb-4"
          >
            {openPremiumAiTool === "keyTakeaways" ? "Hide tool" : "Open tool"}
          </button>

          {openPremiumAiTool === "keyTakeaways" && (
            <>


          {keyTakeaways ? (
            <div className="whitespace-pre-wrap rounded-2xl border border-zinc-900 bg-black p-4 leading-relaxed text-zinc-300">
              {keyTakeaways}
              <AiOutputRatingControls
                featureKey="key_takeaways"
                currentRating={aiOutputRatings["key_takeaways"]}
                working={ratingFeatureKey === "key_takeaways"}
                onRate={handleRateAiOutput}
              />
            </div>
          ) : (
            <p className="text-sm leading-relaxed text-zinc-500 sm:text-base">
              {!currentUserId
                ? "Log in to generate AI-assisted key takeaways for this discussion."
                : canUseAiSummary
                  ? "Generate concise key takeaways from the discussion and visible replies."
                  : (
                    <>
                      AI-assisted key takeaways are available with Premium or Premium Plus.{" "}
                      <Link
                        href="/premium"
                        className="text-zinc-300 underline-offset-4 hover:text-white hover:underline"
                      >
                        View Premium
                      </Link>
                    </>
                  )}
            </p>
          )}

          {currentUserId && canUseAiSummary && (
            <div className="mt-5 rounded-2xl border border-zinc-900 bg-black p-4 text-sm text-zinc-500">
              {isAdmin ? (
                <p>
                  Admin AI access: unlimited key takeaways.
                </p>
              ) : (
                <p>
                  {subscriptionDisplay.label} AI key takeaways usage: {monthlyTakeawaysUsage} of {monthlySummaryLimit} used this month.
                  {" "}Remaining: {monthlyTakeawaysRemaining}.
                </p>
              )}
            </div>
          )}

          {takeawaysMessage && (
            <p className="mt-4 text-sm text-zinc-500">
              {takeawaysMessage}
            </p>
          )}
        
            </>
          )}
        </section>

        <section className="mb-5 rounded-2xl border border-zinc-800 bg-zinc-950 p-3.5 shadow-2xl shadow-black/30 sm:mb-10 sm:rounded-[1.5rem] sm:p-7">
          <div className="mb-3 flex flex-col gap-3 sm:mb-4 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between sm:gap-4">
            <div>
              <p className="mb-2 text-sm uppercase tracking-[0.25em] text-zinc-600">
                AI-assisted
              </p>

              <h2 className="text-lg font-medium sm:text-2xl">
                Discussion Summary
              </h2>
            </div>

            {!discussionSummary && currentUserId && canUseAiSummary && (
              <button
                type="button"
                onClick={handleGenerateSummary}
                disabled={generatingSummary}
                className="w-full rounded-full border border-zinc-700 px-4 py-2 text-center text-sm text-zinc-300 transition hover:border-zinc-500 hover:text-white disabled:cursor-not-allowed disabled:border-zinc-900 disabled:text-zinc-700 sm:w-fit"
              >
                {generatingSummary ? "Generating..." : "Generate Summary"}
              </button>
            )}
          </div>
          <button
            type="button"
            onClick={() =>
              setOpenPremiumAiTool((current) =>
                current === "summary" ? "" : "summary"
              )
            }
            className="mb-3 rounded-full border border-zinc-800 px-4 py-2 text-sm text-zinc-400 transition hover:border-zinc-700 hover:text-white sm:mb-4"
          >
            {openPremiumAiTool === "summary" ? "Hide tool" : "Open tool"}
          </button>

          {openPremiumAiTool === "summary" && (
            <>


          {discussionSummary ? (
            <>
              <div className="whitespace-pre-wrap text-sm leading-relaxed text-zinc-300 sm:text-base">
                {discussionSummary.summary}
              </div>

              <p className="mt-4 text-xs text-zinc-600">
                Generated {new Date(discussionSummary.generated_at).toLocaleString()}
                {discussionSummary.model_name ? ` · ${discussionSummary.model_name}` : ""}
                {" "}· {discussionSummary.source_reply_count} replies counted
              </p>

              <AiOutputRatingControls
                featureKey="thread_summary"
                currentRating={aiOutputRatings["thread_summary"]}
                working={ratingFeatureKey === "thread_summary"}
                onRate={handleRateAiOutput}
              />
            </>
          ) : (
            <p className="text-sm leading-relaxed text-zinc-500 sm:text-base">
              {!currentUserId
                ? "Log in to generate an AI-assisted summary for this discussion."
                : canUseAiSummary
                  ? "No summary has been generated yet. Generate one to cache it for future readers."
                  : (
                    <>
                      AI-assisted summaries are available with Premium or Premium Plus.{" "}
                      <Link
                        href="/premium"
                        className="text-zinc-300 underline-offset-4 hover:text-white hover:underline"
                      >
                        View Premium
                      </Link>
                    </>
                  )}
            </p>
          )}

          {openPremiumAiTool === "summary" && currentUserId && canUseAiSummary && (
            <div className="mt-5 rounded-2xl border border-zinc-900 bg-black p-4 text-sm text-zinc-500">
              {isAdmin ? (
                <p>
                  Admin AI access: unlimited summaries.
                </p>
              ) : (
                <p>
                  {subscriptionDisplay.label} AI summary usage: {monthlySummaryUsage} of {monthlySummaryLimit} summaries used this month.
                  {" "}Remaining: {monthlySummaryRemaining}.
                </p>
              )}
            </div>
          )}

          {summaryMessage && (
            <p className="mt-4 text-sm text-zinc-500">
              {summaryMessage}
            </p>
          )}
        
            </>
          )}
        </section>
          </div>
        )}

        {relatedDiscussions.length > 0 && (
          <div className="discussion-detail-center-related mb-6 rounded-2xl border border-zinc-800 bg-zinc-950 p-4 shadow-2xl shadow-black/30 sm:mb-12 sm:rounded-3xl sm:p-7 xl:hidden">
            <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.24em] text-zinc-500">
                  Related discussions
                </p>
                <h2 className="mt-2 text-xl font-medium text-white sm:text-2xl">
                  Keep reading in {discussion.topic}
                </h2>
                <p className="mt-2 hidden max-w-2xl text-sm leading-6 text-zinc-400 sm:block">
                  Continue into nearby conversations instead of stopping at one thread.
                </p>
              </div>

              <Link
                href={`/discussions?topic=${encodeURIComponent(discussion.topic)}`}
                className="inline-flex rounded-full border border-zinc-700 px-4 py-2 text-sm text-zinc-300 transition hover:border-zinc-500 hover:text-white"
              >
                View topic
              </Link>
            </div>

            <div className="grid gap-3">
              {relatedDiscussions.map((item) => (
                <Link
                  key={item.id}
                  href={`/discussions/${item.id}`}
                  className="rounded-2xl border border-zinc-800 bg-black/30 p-4 transition hover:border-zinc-600 hover:bg-black/50"
                >
                  <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-[0.2em] text-zinc-500">
                        {item.topic}
                      </p>
                      <h3 className="mt-2 text-base font-medium text-white">{item.title}</h3>
                    </div>

                    <p className="text-xs text-zinc-500">
                      {new Date(item.created_at).toLocaleDateString()}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        <div id="replies" className="scroll-mt-24">
          <div className="mb-4 flex flex-col gap-3 sm:mb-6 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-xl font-medium sm:text-2xl">
              Replies
            </h2>

            {currentUserId && (
              <button
                type="button"
                onClick={() => setShowReplyHelpersPanel((current) => !current)}
                className="w-full rounded-full border border-zinc-700 px-5 py-3 text-sm text-zinc-300 transition hover:border-zinc-500 hover:text-white sm:w-fit"
                aria-expanded={showReplyHelpersPanel}
              >
                {showReplyHelpersPanel ? "Hide reply helpers" : "Reply helpers"}
              </button>
            )}
          </div>

          {showReplyHelpersPanel && currentUserId && (
            <div className="mb-5 rounded-2xl border border-zinc-800 bg-zinc-950 p-3 shadow-2xl shadow-black/20 sm:mb-8 sm:rounded-[1.5rem] sm:p-4">
              <p className="mb-3 text-xs uppercase tracking-[0.22em] text-zinc-600">
                Optional reply helpers
              </p>

              <div className="space-y-3">
            <section className="rounded-2xl border border-zinc-900 bg-black/40 p-4 sm:p-5">
              <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="mb-2 text-xs font-bold uppercase tracking-[0.22em] text-zinc-500">
                    Community angle prompts
                  </p>

                  <h3 className="text-lg font-medium text-white sm:text-xl">
                    Connect the idea to a real-world problem carefully.
                  </h3>
                </div>

                <span className="w-fit rounded-full border border-zinc-800 px-3 py-1.5 text-xs text-zinc-500">
                  Reply helper
                </span>
              </div>

              <p className="mb-4 max-w-3xl text-sm leading-relaxed text-zinc-500">
                Use these prompts to explore a local or community angle without collecting location data, organizing action, or pressuring anyone to participate. They prefill the reply box and never post automatically.
              </p>

              <div className="flex flex-wrap gap-2">
                {COMMUNITY_PROMPTS.map((prompt) => (
                  <button
                    key={prompt.label}
                    type="button"
                    onClick={() => startCommunityPrompt(prompt)}
                    className="rounded-full border border-zinc-800 px-3 py-2 text-xs text-zinc-400 transition hover:border-zinc-600 hover:text-white sm:text-sm"
                  >
                    {prompt.label}
                  </button>
                ))}
              </div>
            </section>

            <section className="rounded-2xl border border-zinc-900 bg-black/40 p-4 sm:p-5">
              <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="mb-2 text-xs font-bold uppercase tracking-[0.22em] text-zinc-500">
                    Action prompts
                  </p>

                  <h3 className="text-lg font-medium text-white sm:text-xl">
                    Turn the discussion into a useful next thought.
                  </h3>
                </div>

                <span className="w-fit rounded-full border border-zinc-800 px-3 py-1.5 text-xs text-zinc-500">
                  Reply helper
                </span>
              </div>

              <p className="mb-4 max-w-3xl text-sm leading-relaxed text-zinc-500">
                Use these prompts to think through learning, practical detail, skills, or community direction. They prefill the reply box and never post automatically.
              </p>

              <div className="flex flex-wrap gap-2">
                {ACTION_PROMPTS.map((prompt) => (
                  <button
                    key={prompt.label}
                    type="button"
                    onClick={() => startActionPrompt(prompt)}
                    className="rounded-full border border-zinc-800 px-3 py-2 text-xs text-zinc-400 transition hover:border-zinc-600 hover:text-white sm:text-sm"
                  >
                    {prompt.label}
                  </button>
                ))}
              </div>
            </section>

            <section className="rounded-2xl border border-zinc-900 bg-black/40 p-4 sm:p-5">
              <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="mb-2 text-xs font-bold uppercase tracking-[0.22em] text-zinc-500">
                    Request clarification
                  </p>

                  <h3 className="text-lg font-medium text-white sm:text-xl">
                    Ask for more context without turning it into a fight.
                  </h3>
                </div>

                <span className="w-fit rounded-full border border-zinc-800 px-3 py-1.5 text-xs text-zinc-500">
                  Structured reply helper
                </span>
              </div>

              <p className="mb-4 max-w-3xl text-sm leading-relaxed text-zinc-500">
                Use these prompts when a point needs more detail, context, evidence, or practical explanation. They prefill the reply box and do not create scores, penalties, or verification labels.
              </p>

              <div className="flex flex-wrap gap-2">
                {CLARIFICATION_REQUESTS.map((request) => (
                  <button
                    key={request.label}
                    type="button"
                    onClick={() => startClarificationRequest(request)}
                    className="rounded-full border border-zinc-800 px-3 py-2 text-xs text-zinc-400 transition hover:border-zinc-600 hover:text-white sm:text-sm"
                  >
                    {request.label}
                  </button>
                ))}
              </div>
            </section>

              </div>
            </div>
          )}

          {currentUserId && !canReplyWithIdentity && (
            <div className="mb-4 rounded-2xl border border-amber-900 bg-amber-950/20 p-4 text-sm leading-relaxed text-amber-100/80">
              <p className="mb-2 font-medium text-amber-200">
                Complete your public profile before replying.
              </p>

              <p className="mb-3">
                Loombus asks members to use a recognizable public name before posting replies. You can keep reading, saving, and managing your profile.
              </p>

              <Link
                href="/profile"
                className="text-amber-100 underline decoration-amber-700 underline-offset-4 transition hover:text-white hover:decoration-white"
              >
                Open profile →
              </Link>
            </div>
          )}

          <form
            id="reply-form"
            onSubmit={handleReply}
            onKeyDown={handleReplyFormKeyDown}
            className="mb-5 rounded-2xl border border-zinc-800 bg-zinc-950 p-4 shadow-2xl shadow-black/30 sm:mb-10 sm:rounded-[1.5rem] sm:p-7"
          >
            <label className="mb-3 block text-sm text-zinc-400">
              Add a thoughtful reply
            </label>

            {referencedReply && (
              <div className="mb-4 rounded-2xl border border-zinc-800 bg-black p-4">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                  <p className="text-xs font-bold uppercase tracking-[0.2em] text-zinc-500">
                    Responding to a point
                  </p>

                  <button
                    type="button"
                    onClick={clearReferencedReply}
                    className="rounded-full border border-zinc-800 px-3 py-1.5 text-xs text-zinc-500 transition hover:border-zinc-600 hover:text-zinc-300"
                  >
                    Clear
                  </button>
                </div>

                <p className="text-sm leading-relaxed text-zinc-400">
                  “{getReplyReferencePreview(referencedReply)}”
                </p>
              </div>
            )}

            <textarea
              rows={4}
              value={replyBody}
              required
              onChange={(e) => setReplyBody(e.target.value)}
              disabled={postingReply}
              placeholder="Contribute with clarity, context, and signal... Use @username to mention someone."
              className="mb-4 w-full rounded-xl border border-zinc-800 bg-black px-4 py-3 text-base text-white outline-none focus:border-zinc-500 disabled:cursor-not-allowed disabled:border-zinc-900 disabled:bg-zinc-950 disabled:text-zinc-600 disabled:placeholder:text-zinc-700"
            />

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <button
                type="submit"
                disabled={postingReply}
              className="inline-flex w-full justify-center rounded-full bg-white px-5 py-3 text-sm text-black transition hover:bg-zinc-200 disabled:cursor-not-allowed disabled:bg-zinc-700 disabled:text-zinc-400 sm:w-fit"
            >
                {postingReply ? "Posting..." : "Post Reply"}
              </button>

              <p className="hidden text-sm text-zinc-600 sm:block">
                Press Cmd+Enter or Ctrl+Enter to reply.
              </p>
            </div>

            {message && <p className="mt-4 text-sm text-zinc-400">{message}</p>}
          </form>

          {pinnedReply && (
            <section className="mb-5 rounded-2xl border border-amber-900 bg-amber-950/20 p-4 shadow-2xl shadow-black/30 sm:mb-6 sm:rounded-[1.5rem] sm:p-7">
              <div className="mb-4 flex flex-col items-start justify-between gap-3 sm:flex-row sm:flex-wrap sm:items-center">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.24em] text-amber-300">
                    Pinned reply
                  </p>

                  <p className="mt-2 text-sm text-zinc-500">
                    Highlighted by the discussion author or an admin.
                    {discussion.pinned_at
                      ? ` Pinned ${new Date(discussion.pinned_at).toLocaleString()}.`
                      : ""}
                  </p>
                </div>

                <div className="flex flex-wrap gap-2">
                  {currentUserId && pinnedReply.user_id !== currentUserId && (
                    <button
                      type="button"
                      onClick={() => startRespondToPoint(pinnedReply)}
                      className="rounded-full border border-zinc-800 px-3 py-1.5 text-xs text-zinc-500 transition hover:border-zinc-600 hover:text-zinc-300"
                    >
                      Respond to point
                    </button>
                  )}

                  {canManageDiscussionStatus && (
                    <button
                      type="button"
                      onClick={() => updatePinnedReply(pinnedReply.id, true)}
                      disabled={pinWorkingReplyId === pinnedReply.id || pinWorkingReplyId === "unpin"}
                      className="rounded-full border border-amber-800 px-3 py-1.5 text-xs text-amber-300 transition hover:border-amber-600 hover:text-amber-200 disabled:cursor-not-allowed disabled:border-zinc-900 disabled:text-zinc-700"
                    >
                      {pinWorkingReplyId === pinnedReply.id || pinWorkingReplyId === "unpin"
                        ? "Updating..."
                        : "Unpin"}
                    </button>
                  )}
                </div>
              </div>

              <div className="rounded-2xl border border-amber-900/60 bg-black/30 p-4 sm:p-5">
                <div className="mb-4 flex flex-wrap items-center gap-3 text-sm text-zinc-500">
                  <ProfileAvatar
                    profile={replyProfiles[pinnedReply.user_id]}
                    size="sm"
                  />
                  <ProfileName profile={replyProfiles[pinnedReply.user_id]} />
                </div>

                {pinnedReply.quoted_excerpt && (
                  <div className="mb-4 rounded-2xl border border-zinc-800 bg-black/40 p-4">
                    <p className="mb-2 text-xs font-bold uppercase tracking-[0.2em] text-zinc-600">
                      Responding to a point
                    </p>

                    <p className="text-sm leading-relaxed text-zinc-500">
                      “{pinnedReply.quoted_excerpt}”
                    </p>
                  </div>
                )}

                <p className="whitespace-pre-wrap text-sm leading-relaxed text-zinc-300 sm:text-base">
                  <MentionText text={pinnedReply.body} />
                </p>

                {getReplyEditLabel(pinnedReply) && (
                  <p className="mt-4 text-xs text-zinc-600">
                    {getReplyEditLabel(pinnedReply)}
                  </p>
                )}
              </div>
            </section>
          )}

          <div className="space-y-3 sm:space-y-5">
            {visibleReplies.map((reply) => {
              const canEditReply =
                Boolean(currentUserId) &&
                (reply.user_id === currentUserId || isAdmin);

              const canDeleteReply = canEditReply;

              const isEditingReply = editingReplyId === reply.id;
              const replyEditLabel = getReplyEditLabel(reply);

              const hasReportedReply = reportedReplyIds.includes(reply.id);

              const canRespondToPoint =
                Boolean(currentUserId) && reply.user_id !== currentUserId;

              const canReportReply = canRespondToPoint;

              return (
                <div
                  key={reply.id}
                  className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4 shadow-2xl shadow-black/30 sm:rounded-[1.5rem] sm:p-7"
                >
                  <div className="mb-4 flex flex-col items-start justify-between gap-3 sm:flex-row sm:flex-wrap sm:items-center">
                    <p className="text-sm text-zinc-500">
                      <span className="inline-flex items-center gap-3">
                        <ProfileAvatar
                          profile={replyProfiles[reply.user_id]}
                          size="sm"
                        />
                        <ProfileName profile={replyProfiles[reply.user_id]} />
                      </span>
                    </p>

                    <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto sm:flex-wrap sm:items-center">
                      {canRespondToPoint && !isEditingReply && (
                        <button
                          type="button"
                          onClick={() => startRespondToPoint(reply)}
                          disabled={Boolean(editingReplyId)}
                          className="rounded-full border border-zinc-800 px-3 py-2 text-center text-xs text-zinc-500 transition hover:border-zinc-600 hover:text-zinc-300 disabled:cursor-not-allowed disabled:border-zinc-900 disabled:text-zinc-700"
                        >
                          Respond to point
                        </button>
                      )}

                      {canReportReply && (
                        <button
                          type="button"
                          onClick={() => handleReportReply(reply.id)}
                          disabled={reportingReplyId === reply.id || hasReportedReply}
                          className="rounded-full border border-zinc-800 px-3 py-2 text-center text-xs text-zinc-500 transition hover:border-zinc-600 hover:text-zinc-300 disabled:cursor-not-allowed disabled:border-zinc-900 disabled:text-zinc-700"
                        >
                          {hasReportedReply
                            ? "Reported"
                            : reportingReplyId === reply.id
                              ? "Reporting..."
                              : "Report"}
                        </button>
                      )}

                      {canManageDiscussionStatus && !isEditingReply && (
                        <button
                          type="button"
                          onClick={() =>
                            updatePinnedReply(
                              reply.id,
                              discussion?.pinned_reply_id === reply.id
                            )
                          }
                          disabled={Boolean(pinWorkingReplyId)}
                          className="rounded-full border border-zinc-800 px-3 py-2 text-center text-xs text-zinc-500 transition hover:border-amber-700 hover:text-amber-300 disabled:cursor-not-allowed disabled:border-zinc-900 disabled:text-zinc-700"
                        >
                          {pinWorkingReplyId === reply.id
                            ? "Updating..."
                            : discussion?.pinned_reply_id === reply.id
                              ? "Unpin"
                              : "Pin reply"}
                        </button>
                      )}

                      {canEditReply && !isEditingReply && (
                        <button
                          type="button"
                          onClick={() => startReplyEdit(reply)}
                          disabled={Boolean(editingReplyId) || updatingReplyId === reply.id}
                          className="rounded-full border border-zinc-800 px-3 py-2 text-center text-xs text-zinc-500 transition hover:border-zinc-600 hover:text-zinc-300 disabled:cursor-not-allowed disabled:border-zinc-900 disabled:text-zinc-700"
                        >
                          Edit
                        </button>
                      )}

                      {canDeleteReply && (
                        <button
                          type="button"
                          onClick={() => handleDeleteReply(reply.id)}
                          disabled={deletingReplyId === reply.id || isEditingReply}
                          className="rounded-full border border-zinc-800 px-3 py-2 text-center text-xs text-zinc-500 transition hover:border-red-900 hover:text-red-300 disabled:cursor-not-allowed disabled:border-zinc-900 disabled:text-zinc-700"
                        >
                          {deletingReplyId === reply.id ? "Deleting..." : "Delete"}
                        </button>
                      )}
                    </div>
                  </div>

                  {isEditingReply ? (
                    <div className="space-y-3">
                      <textarea
                        value={editingReplyBody}
                        onChange={(event) => setEditingReplyBody(event.target.value)}
                        rows={5}
                        maxLength={5000}
                        className="w-full rounded-2xl border border-zinc-800 bg-black px-4 py-3 text-base leading-relaxed text-zinc-300 outline-none transition placeholder:text-zinc-700 focus:border-zinc-600"
                      />

                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <p className="text-xs text-zinc-600">
                          {editingReplyBody.length}/5000 characters
                        </p>

                        <div className="flex flex-wrap gap-3">
                          <button
                            type="button"
                            onClick={cancelReplyEdit}
                            disabled={updatingReplyId === reply.id}
                            className="rounded-full border border-zinc-800 px-4 py-2 text-sm text-zinc-500 transition hover:border-zinc-600 hover:text-zinc-300 disabled:cursor-not-allowed disabled:border-zinc-900 disabled:text-zinc-700"
                          >
                            Cancel
                          </button>

                          <button
                            type="button"
                            onClick={() => handleUpdateReply(reply.id)}
                            disabled={updatingReplyId === reply.id}
                            className="w-full rounded-full border border-zinc-700 px-4 py-2 text-center text-sm text-zinc-300 transition hover:border-zinc-500 hover:text-white disabled:cursor-not-allowed disabled:border-zinc-900 disabled:text-zinc-700 sm:w-fit"
                          >
                            {updatingReplyId === reply.id ? "Saving..." : "Save edit"}
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <>
                      <p className="whitespace-pre-wrap text-sm leading-relaxed text-zinc-300 sm:text-base">
                        <MentionText text={reply.body} />
                      </p>

                      {replyEditLabel && (
                        <p className="mt-4 text-xs text-zinc-600">
                          {replyEditLabel}
                        </p>
                      )}
                    </>
                  )}
                </div>
              );
            })}

            {replies.length === 0 && (
              <p className="text-zinc-500">
                No replies yet. Be the first to contribute.
              </p>
            )}

            {replies.length > 0 && visibleReplies.length === 0 && pinnedReply && (
              <p className="text-zinc-500">
                The only reply in this discussion is currently pinned above.
              </p>
            )}
          </div>
        </div>
      </div>

      <aside className="discussion-detail-right-rail loombus-right-rail fixed inset-y-0 right-0 z-30 hidden overflow-y-auto border-l border-zinc-900 bg-black/95 px-4 py-6 backdrop-blur-xl xl:block">
        <div className="space-y-4">
          <section className="rounded-3xl border border-zinc-800 bg-zinc-950 p-5 shadow-2xl shadow-black/20">
            <p className="mb-2 text-xs uppercase tracking-[0.25em] text-zinc-600">
              Thread panel
            </p>

            <h2 className="text-xl font-semibold tracking-tight">
              Discussion controls.
            </h2>

            <p className="mt-3 text-sm leading-relaxed text-zinc-500">
              Manage the thread, save it, report concerns, open AI tools, or continue into related discussions.
            </p>

            <div className="mt-5 space-y-2">
              {canManageDiscussionStatus && (
                <button
                  type="button"
                  onClick={() =>
                    updateDiscussionStatus(
                      discussionStatus === "resolved" ? "open" : "resolved"
                    )
                  }
                  disabled={statusWorking}
                  className={`w-full rounded-2xl border px-4 py-3 text-left text-sm transition disabled:cursor-not-allowed disabled:border-zinc-900 disabled:text-zinc-700 ${
                    discussionStatus === "resolved"
                      ? "border-zinc-700 text-zinc-300 hover:border-zinc-500 hover:text-white"
                      : "border-emerald-800 text-emerald-300 hover:border-emerald-600 hover:text-emerald-200"
                  }`}
                >
                  {statusWorking
                    ? "Updating..."
                    : discussionStatus === "resolved"
                      ? "Reopen Discussion"
                      : "Mark Resolved"}
                </button>
              )}

              {isSaved ? (
                <button
                  type="button"
                  onClick={handleRemoveBookmark}
                  disabled={savingBookmark}
                  className="w-full rounded-2xl border border-zinc-800 bg-zinc-900 px-4 py-3 text-left text-sm text-zinc-400 transition hover:border-zinc-600 hover:text-white disabled:cursor-not-allowed disabled:border-zinc-900 disabled:text-zinc-700"
                >
                  {savingBookmark ? "Removing..." : "Unsave Discussion"}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleBookmark}
                  disabled={savingBookmark}
                  className="w-full rounded-2xl border border-zinc-800 bg-black px-4 py-3 text-left text-sm text-zinc-300 transition hover:border-zinc-600 hover:text-white disabled:cursor-not-allowed disabled:border-zinc-900 disabled:text-zinc-700"
                >
                  {savingBookmark ? "Saving..." : "Save Discussion"}
                </button>
              )}

              <button
                type="button"
                onClick={handleReport}
                disabled={reportedDiscussion}
                className="w-full rounded-2xl border border-red-950 bg-black px-4 py-3 text-left text-sm text-red-400 transition hover:border-red-800 hover:text-red-300 disabled:cursor-not-allowed disabled:border-zinc-900 disabled:text-zinc-700"
              >
                {reportedDiscussion ? "Reported" : "Report Discussion"}
              </button>
            </div>

            {currentUserId && (
              <label className="mt-4 block text-xs text-zinc-500">
                <span className="mb-2 block">Report reason</span>

                <select
                  value={reportReason}
                  onChange={(event) => setReportReason(event.target.value as ReportReason)}
                  className="w-full rounded-2xl border border-zinc-800 bg-black px-4 py-3 text-sm text-zinc-300 outline-none transition focus:border-zinc-600"
                >
                  {REPORT_REASONS.map((reason) => (
                    <option key={reason} value={reason}>
                      {reason}
                    </option>
                  ))}
                </select>
              </label>
            )}

            {(pinMessage || statusMessage || bookmarkMessage || reportMessage) && (
              <p className="mt-4 text-sm leading-relaxed text-zinc-500">
                {pinMessage || statusMessage || bookmarkMessage || reportMessage}
              </p>
            )}
          </section>

          <section className="rounded-3xl border border-zinc-800 bg-zinc-950 p-5 shadow-2xl shadow-black/20">
            <p className="mb-2 text-xs uppercase tracking-[0.25em] text-zinc-600">
              Reader shortcuts
            </p>

            <div className="grid gap-2">
              <a
                href="#reply-form"
                className="rounded-2xl border border-zinc-800 bg-black px-4 py-3 text-sm text-zinc-300 transition hover:border-zinc-600 hover:text-white"
              >
                Reply
              </a>

              <a
                href="#replies"
                className="rounded-2xl border border-zinc-800 bg-black px-4 py-3 text-sm text-zinc-300 transition hover:border-zinc-600 hover:text-white"
              >
                Replies
              </a>

              <button
                type="button"
                onClick={() => {
                  setShowAiToolsPanel(true);
                  setOpenPremiumAiTool((current) => current || "summary");

                  window.setTimeout(() => {
                    document.getElementById("intelligence-layer")?.scrollIntoView({
                      behavior: "smooth",
                      block: "start",
                    });
                  }, 0);
                }}
                className="rounded-2xl border border-zinc-800 bg-black px-4 py-3 text-left text-sm text-zinc-300 transition hover:border-zinc-600 hover:text-white"
              >
                AI tools
              </button>
            </div>
          </section>

          <section className="rounded-3xl border border-zinc-800 bg-zinc-950 p-5 shadow-2xl shadow-black/20">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <p className="mb-2 text-xs uppercase tracking-[0.25em] text-zinc-600">
                  AI tools
                </p>

                <h2 className="text-lg font-semibold tracking-tight">
                  Understand the thread.
                </h2>
              </div>

              <button
                type="button"
                onClick={() => setShowAiToolsPanel((current) => !current)}
                className="shrink-0 rounded-full border border-zinc-800 px-3 py-1.5 text-xs text-zinc-500 transition hover:border-zinc-600 hover:text-white"
              >
                {showAiToolsPanel ? "Hide" : "Show"}
              </button>
            </div>

            {currentUserId ? (
              <p className="text-sm leading-relaxed text-zinc-500">
                Current plan: {subscriptionDisplay.label}. Included AI usage: {aiUsageLabel}.
              </p>
            ) : (
              <p className="text-sm leading-relaxed text-zinc-500">
                Log in to use available AI tools for this discussion.
              </p>
            )}

            <div className="mt-4 grid gap-2 text-sm">
              {[
                ["summary", "Summary"],
                ["keyTakeaways", "Key Takeaways"],
                ["whatChanged", "What Changed"],
                ["disagreementMap", "Disagreement Map"],
                ["conversationMap", "Conversation Map"],
                ["relatedIdeas", "Related Ideas"],
              ].map(([toolKey, label]) => (
                <button
                  key={toolKey}
                  type="button"
                  onClick={() => {
                    setShowAiToolsPanel(true);
                    setOpenPremiumAiTool((current) =>
                      current === toolKey ? "" : toolKey
                    );

                    window.setTimeout(() => {
                      document.getElementById("intelligence-layer")?.scrollIntoView({
                        behavior: "smooth",
                        block: "start",
                      });
                    }, 0);
                  }}
                  className="rounded-2xl border border-zinc-900 bg-black px-4 py-3 text-left text-zinc-400 transition hover:border-zinc-700 hover:text-white"
                >
                  {label}
                </button>
              ))}
            </div>
          </section>

          {relatedDiscussions.length > 0 && (
            <section className="rounded-3xl border border-zinc-800 bg-zinc-950 p-5 shadow-2xl shadow-black/20">
              <div className="mb-4">
                <p className="mb-2 text-xs uppercase tracking-[0.25em] text-zinc-600">
                  Related discussions
                </p>

                <h2 className="text-lg font-semibold tracking-tight">
                  Keep reading in {discussion.topic}
                </h2>

                <Link
                  href={`/discussions?topic=${encodeURIComponent(discussion.topic)}`}
                  className="mt-3 inline-flex rounded-full border border-zinc-800 px-3 py-1.5 text-xs text-zinc-500 transition hover:border-zinc-600 hover:text-white"
                >
                  View topic
                </Link>
              </div>

              <div className="space-y-2">
                {relatedDiscussions.map((item) => (
                  <Link
                    key={item.id}
                    href={`/discussions/${item.id}`}
                    className="block rounded-2xl border border-zinc-900 bg-black p-3 transition hover:border-zinc-700"
                  >
                    <p className="text-xs uppercase tracking-[0.18em] text-zinc-700">
                      {item.topic}
                    </p>

                    <h3 className="mt-2 text-sm font-medium leading-snug text-zinc-300">
                      {item.title}
                    </h3>

                    <p className="mt-2 text-xs text-zinc-600">
                      {new Date(item.created_at).toLocaleDateString()}
                    </p>
                  </Link>
                ))}
              </div>
            </section>
          )}
        </div>
      </aside>
    </main>
  );
}
