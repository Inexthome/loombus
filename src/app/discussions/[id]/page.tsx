"use client";

import { normalizePublicText } from "@/lib/public-text";
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

type DiscussionMode = "open_discussion" | "debate" | "research_question" | "problem_solving";

type DiscussionMetadata = Record<string, string>;

type Discussion = {
  id: string;
  user_id: string;
  title: string;
  topic: string;
  reality_lens: string | null;
  purpose_lane: string | null;
  discussion_type?: DiscussionMode | null;
  discussion_metadata?: DiscussionMetadata | null;
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

type ReplyReactionType =
  | "helpful"
  | "insightful"
  | "well_reasoned"
  | "changed_my_view"
  | "needs_evidence";

type ReplyReactionCounts = Partial<Record<ReplyReactionType, number>>;

type ReplyReactionRow = {
  reply_id: string;
  user_id: string;
  reaction_type: ReplyReactionType;
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

type BookmarkCollection = {
  id: string;
  name: string;
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

const REPLY_REACTIONS: Array<{
  type: ReplyReactionType;
  label: string;
  icon: string;
}> = [
  { type: "helpful", label: "Helpful", icon: "✓" },
  { type: "insightful", label: "Insightful", icon: "💡" },
  { type: "well_reasoned", label: "Well-Reasoned", icon: "🧠" },
  { type: "changed_my_view", label: "Changed My View", icon: "↺" },
  { type: "needs_evidence", label: "Needs Evidence", icon: "📚" },
];

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

function escapeLimitedHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function hasLimitedFormattingHtml(value: string) {
  return /<\/?(strong|b|em|i|br|p|div)\b/i.test(value);
}

function sanitizeLimitedDiscussionHtml(value: string) {
  const pattern = /<\/?(strong|b|em|i|br|p|div)\b[^>]*>/gi;
  let safe = "";
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(value)) !== null) {
    safe += escapeLimitedHtml(value.slice(lastIndex, match.index));

    const rawTag = match[0].toLowerCase();
    const tagName = match[1].toLowerCase();
    const normalizedTag =
      tagName === "b" ? "strong" : tagName === "i" ? "em" : tagName;

    if (normalizedTag === "br") {
      safe += "<br>";
    } else if (rawTag.startsWith("</")) {
      safe += `</${normalizedTag}>`;
    } else {
      safe += `<${normalizedTag}>`;
    }

    lastIndex = pattern.lastIndex;
  }

  safe += escapeLimitedHtml(value.slice(lastIndex));

  return safe
    .replace(/<div><br><\/div>/gi, "<br>")
    .replace(/<p><br><\/p>/gi, "<br>");
}

function legacyMarkdownBodyToSafeHtml(value: string) {
  const escaped = escapeLimitedHtml(value)
    .replace(/\*\*([^*\n]+)\*\*/g, "<strong>$1</strong>")
    .replace(/\*([^*\n]+)\*/g, "<em>$1</em>");

  return escaped
    .split(/\n{2,}/)
    .map((paragraph) => `<p>${paragraph.replace(/\n/g, "<br>")}</p>`)
    .join("");
}

function discussionBodyToSafeHtml(content: string) {
  if (hasLimitedFormattingHtml(content)) {
    return sanitizeLimitedDiscussionHtml(content);
  }

  return sanitizeLimitedDiscussionHtml(legacyMarkdownBodyToSafeHtml(content));
}

function renderDiscussionBody(content: string) {
  return (
    <div
      className="space-y-4"
      dangerouslySetInnerHTML={{ __html: discussionBodyToSafeHtml(content) }}
    />
  );
}

function getDiscussionModeLabel(mode?: DiscussionMode | null) {
  if (mode === "debate") {
    return "Debate";
  }

  if (mode === "research_question") {
    return "Research Question";
  }

  if (mode === "problem_solving") {
    return "Problem Solving";
  }

  return "Open Discussion";
}

function getStructuredDiscussionSections(discussion: Discussion) {
  const metadata = discussion.discussion_metadata ?? {};

  if (discussion.discussion_type === "debate") {
    return [
      ["Claim", metadata.claim],
      ["Supporting Argument", metadata.supportingArgument],
      ["Evidence", metadata.evidence],
      ["Question for Opposing View", metadata.opposingQuestion],
    ];
  }

  if (discussion.discussion_type === "research_question") {
    return [
      ["Research Question", metadata.researchQuestion],
      ["Background", metadata.background],
      ["Sources", metadata.sources],
      ["Open Questions", metadata.openQuestions],
    ];
  }

  if (discussion.discussion_type === "problem_solving") {
    return [
      ["Problem", metadata.problem],
      ["What Has Been Tried", metadata.tried],
      ["Constraints", metadata.constraints],
      ["Desired Outcome", metadata.desiredOutcome],
    ];
  }

  return [];
}

function StructuredDiscussionCard({ discussion }: { discussion: Discussion }) {
  const sections = getStructuredDiscussionSections(discussion).filter(([, value]) =>
    String(value ?? "").trim()
  );

  return (
    <section className="rounded-3xl border border-[color:var(--loombus-border)] bg-[color:var(--loombus-surface)] p-5 text-[color:var(--loombus-text)]">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <span className="rounded-full border border-[color:var(--loombus-border)] bg-[color:var(--loombus-muted-surface)] px-3 py-1 text-xs font-semibold text-[color:var(--loombus-text)]">
          {getDiscussionModeLabel(discussion.discussion_type)}
        </span>
        <span className="text-xs text-[color:var(--loombus-muted-text)]">
          Structured discussion mode
        </span>
      </div>

      {sections.length > 0 && (
        <div className="grid gap-3">
          {sections.map(([label, value]) => (
            <div key={label} className="rounded-2xl border border-[color:var(--loombus-border)] bg-[color:var(--loombus-muted-surface)] p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[color:var(--loombus-muted-text)]">
                {label}
              </p>
              <div className="mt-2 text-sm leading-6 text-[color:var(--loombus-text)]">
                <MentionText text={String(value)} />
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
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
  const [replyReactionCounts, setReplyReactionCounts] = useState<Record<string, ReplyReactionCounts>>({});
  const [myReplyReactions, setMyReplyReactions] = useState<Record<string, ReplyReactionType[]>>({});
  const [reactionWorkingKey, setReactionWorkingKey] = useState("");
  const [openReplyActionMenuId, setOpenReplyActionMenuId] = useState<string | null>(null);
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
  const [stickiesMessage, setStickiesMessage] = useState("");
  const [isStickied, setIsStickied] = useState(false);
  const [addingSticky, setAddingSticky] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [savedBookmarkId, setSavedBookmarkId] = useState<string | null>(null);
  const [savingBookmark, setSavingBookmark] = useState(false);
  const [bookmarkCollections, setBookmarkCollections] = useState<BookmarkCollection[]>([]);
  const [selectedSaveCollectionId, setSelectedSaveCollectionId] = useState("unfiled");
  const [showSaveFolderPanel, setShowSaveFolderPanel] = useState(false);
  const [reportMessage, setReportMessage] = useState("");
  const [reportReason, setReportReason] = useState(DEFAULT_REPORT_REASON);
  const [rightRailReportOpen, setRightRailReportOpen] = useState(false);
  const [showMobileThreadActions, setShowMobileThreadActions] = useState(false);
  const [showAiToolsPanel, setShowAiToolsPanel] = useState(false);
  const [showReplyHelpersPanel, setShowReplyHelpersPanel] = useState(false);
  const [activeDetailTool, setActiveDetailTool] =
    useState<"none" | "ai" | "helpers" | "related" | "more">("none");
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

      if (!viewerData.user) {
        setMyReplyReactions({});
      }

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
          const { data: reactionRows } = await supabase
            .from("reply_reactions")
            .select("reply_id, user_id, reaction_type")
            .in("reply_id", replyIds);

          const reactionCounts: Record<string, ReplyReactionCounts> = {};
          const viewerReactions: Record<string, ReplyReactionType[]> = {};

          for (const row of (reactionRows ?? []) as ReplyReactionRow[]) {
            const counts = reactionCounts[row.reply_id] ?? {};
            counts[row.reaction_type] = (counts[row.reaction_type] ?? 0) + 1;
            reactionCounts[row.reply_id] = counts;

            if (row.user_id === viewerData.user.id) {
              viewerReactions[row.reply_id] = [
                ...(viewerReactions[row.reply_id] ?? []),
                row.reaction_type,
              ];
            }
          }

          setReplyReactionCounts(reactionCounts);
          setMyReplyReactions(viewerReactions);

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

  useEffect(() => {
    if (!openReplyActionMenuId) {
      return;
    }

    function handleReplyActionMenuOutsideClick(event: MouseEvent) {
      const target = event.target as HTMLElement | null;

      if (target?.closest("[data-reply-action-menu]")) {
        return;
      }

      setOpenReplyActionMenuId(null);
    }

    function handleReplyActionMenuKeyDown(event: globalThis.KeyboardEvent) {
      if (event.key === "Escape") {
        setOpenReplyActionMenuId(null);
      }
    }

    document.addEventListener("mousedown", handleReplyActionMenuOutsideClick);
    document.addEventListener("keydown", handleReplyActionMenuKeyDown);

    return () => {
      document.removeEventListener("mousedown", handleReplyActionMenuOutsideClick);
      document.removeEventListener("keydown", handleReplyActionMenuKeyDown);
    };
  }, [openReplyActionMenuId]);

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

  function scrollToDetailSection(sectionId: string) {
    window.setTimeout(() => {
      document.getElementById(sectionId)?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }, 0);
  }

  function toggleDetailPanel(panel: "ai" | "helpers" | "related" | "more") {
    setActiveDetailTool((current) => {
      const next = current === panel ? "none" : panel;

      setShowAiToolsPanel(next === "ai");
      setShowReplyHelpersPanel(next === "helpers");
      setShowMobileThreadActions(next === "more");

      if (next === "ai") {
        setOpenPremiumAiTool((currentTool) => currentTool || "summary");
        scrollToDetailSection("intelligence-layer");
      }

      if (next === "helpers") {
        scrollToDetailSection("replies");
      }

      if (next === "related") {
        scrollToDetailSection("related-discussions");
      }

      return next;
    });
  }

  function openDetailAiTools() {
    toggleDetailPanel("ai");
  }

  function openDetailReplyHelpers() {
    toggleDetailPanel("helpers");
  }

  function openDetailRelated() {
    toggleDetailPanel("related");
  }

  function openDetailMore() {
    toggleDetailPanel("more");
  }

  function openDetailReplyForm() {
    scrollToDetailSection("reply-form");
  }

  function openDetailReplies() {
    scrollToDetailSection("replies");
  }

  function toggleDetailSave() {
    if (isSaved) {
      handleRemoveBookmark();
      return;
    }

    openSaveFolderPanel();
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
          body: normalizePublicText(replyBody),
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
    closeReplyActionMenu();
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
          body: normalizePublicText(editingReplyBody),
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

  async function loadBookmarkCollectionsForSave() {
    if (!currentUserId || !canUseSavedFolders) {
      return;
    }

    const { data, error } = await supabase
      .from("bookmark_collections")
      .select("id, name")
      .order("created_at", { ascending: false });

    if (error) {
      setBookmarkMessage("Unable to load saved folders.");
      return;
    }

    setBookmarkCollections((data ?? []) as BookmarkCollection[]);
  }

  async function openSaveFolderPanel() {
    setBookmarkMessage("");

    if (!currentUserId || !canUseSavedFolders) {
      await handleBookmark();
      return;
    }

    await loadBookmarkCollectionsForSave();
    setSelectedSaveCollectionId("unfiled");
    setShowSaveFolderPanel(true);
  }

  async function handleSaveWithSelectedFolder() {
    const collectionId =
      selectedSaveCollectionId === "unfiled" ? null : selectedSaveCollectionId;

    const saved = await handleBookmark(collectionId);

    if (saved) {
      setShowSaveFolderPanel(false);
    }
  }

  async function handleBookmark(collectionId: string | null = null) {
    setBookmarkMessage("");

    if (savingBookmark) {
      return false;
    }

    setSavingBookmark(true);

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;

      if (!accessToken) {
        window.location.href = "/login";
        return false;
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
        return false;
      }

      const nextBookmarkId = result.bookmark?.id ?? null;

      setIsSaved(true);
      setSavedBookmarkId(nextBookmarkId);

      if (nextBookmarkId && collectionId) {
        const moveResponse = await fetch("/api/bookmarks/move", {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({
            bookmarkId: nextBookmarkId,
            collectionId,
          }),
        });

        const moveResult = await moveResponse.json().catch(() => ({}));

        if (!moveResponse.ok) {
          setBookmarkMessage(
            moveResult.error ??
              "Discussion saved, but it could not be moved into the selected folder."
          );
          return false;
        }

        setBookmarkMessage("Discussion saved to folder.");
        return true;
      }

      setBookmarkMessage(
        canUseSavedFolders
          ? "Discussion saved to Unfiled."
          : "Discussion saved. Premium users can organize saved discussions into folders."
      );
      return true;
    } finally {
      setSavingBookmark(false);
    }
  }

  async function handleAddToStickies() {
    setStickiesMessage("");

    if (addingSticky) {
      return;
    }

    setAddingSticky(true);

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;

      if (!accessToken) {
        window.location.href = "/login";
        return;
      }

      const response = await fetch("/api/stickies", {
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
        setStickiesMessage(result.error ?? "Unable to add to Stickies.");
        return;
      }

      setIsStickied(true);
      setStickiesMessage("Added to Stickies.");
    } finally {
      setAddingSticky(false);
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
      setShowSaveFolderPanel(false);
      setSelectedSaveCollectionId("unfiled");
      setBookmarkMessage("Saved discussion removed.");
    } finally {
      setSavingBookmark(false);
    }
  }

  async function handleToggleReplyReaction(
    replyId: string,
    reactionType: ReplyReactionType
  ) {
    if (reactionWorkingKey) {
      return;
    }

    if (!currentUserId) {
      window.location.href = "/login";
      return;
    }

    const workingKey = `${replyId}:${reactionType}`;
    setReactionWorkingKey(workingKey);

    const { data: sessionData } = await supabase.auth.getSession();
    const accessToken = sessionData.session?.access_token;

    if (!accessToken) {
      setReactionWorkingKey("");
      window.location.href = "/login";
      return;
    }

    const response = await fetch("/api/replies/react", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        replyId,
        reactionType,
      }),
    });

    const result = await response.json().catch(() => ({}));

    setReactionWorkingKey("");

    if (!response.ok) {
      setReportMessage(result.error ?? "Unable to update reaction.");
      return;
    }

    const counts = result.counts ?? {};
    setReplyReactionCounts((current) => ({
      ...current,
      [replyId]: counts,
    }));

    setMyReplyReactions((current) => {
      const currentTypes = new Set(current[replyId] ?? []);

      if (result.reacted) {
        currentTypes.add(reactionType);
      } else {
        currentTypes.delete(reactionType);
      }

      return {
        ...current,
        [replyId]: Array.from(currentTypes),
      };
    });
  }

  function ReplyReactionChips({ reply }: { reply: Reply }) {
    const counts = replyReactionCounts[reply.id] ?? {};
    const myTypes = new Set(myReplyReactions[reply.id] ?? []);
    const isOwnReply = currentUserId === reply.user_id;

    return (
      <div className="mt-4 flex flex-wrap gap-2">
        {REPLY_REACTIONS.map((reaction) => {
          const count = counts[reaction.type] ?? 0;
          const selected = myTypes.has(reaction.type);
          const working = reactionWorkingKey === `${reply.id}:${reaction.type}`;

          return (
            <button
              key={reaction.type}
              type="button"
              onClick={() => handleToggleReplyReaction(reply.id, reaction.type)}
              disabled={working || isOwnReply}
              title={isOwnReply ? "You cannot react to your own reply." : reaction.label}
              className={`rounded-full border px-3 py-1.5 text-xs transition disabled:cursor-not-allowed disabled:opacity-50 ${
                selected
                  ? "border-zinc-400 bg-white text-black"
                  : "border-[color:var(--loombus-border)] bg-[color:var(--loombus-muted-surface)] text-[color:var(--loombus-muted-text)] hover:border-zinc-500 hover:text-[color:var(--loombus-text)]"
              }`}
            >
              <span className="mr-1">{reaction.icon}</span>
              {reaction.label}
              {count > 0 && <span className="ml-1">{count}</span>}
            </button>
          );
        })}
      </div>
    );
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
    setRightRailReportOpen(false);
    setReportMessage("Discussion reported.");
  }

  function toggleReplyActionMenu(replyId: string) {
    setOpenReplyActionMenuId((current) => current === replyId ? null : replyId);
  }

  function closeReplyActionMenu() {
    setOpenReplyActionMenuId(null);
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
  const canUseSavedFolders = canUseAiSummary;
  const canUseStickies = canUseAiSummary;
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
          {normalizePublicText(discussion.title)}
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

        <section className="mb-5 rounded-3xl border border-[color:var(--loombus-border)] bg-[color:var(--loombus-surface)] p-4 text-[color:var(--loombus-text)] sm:mb-8 sm:p-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-[0.25em] text-[color:var(--loombus-muted-text)]">
                State of the Discussion
              </p>

              <h2 className="text-lg font-semibold tracking-tight">
                Understand this thread faster.
              </h2>

              <p className="mt-2 max-w-2xl text-sm leading-relaxed text-[color:var(--loombus-muted-text)]">
                Generate an overview, key takeaways, disagreement map, conversation structure, or related ideas without losing the original discussion.
              </p>
            </div>

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
              className="rounded-full border border-[color:var(--loombus-border)] bg-[color:var(--loombus-muted-surface)] px-4 py-2 text-sm font-medium text-[color:var(--loombus-text)] transition hover:border-zinc-500"
            >
              Open State
            </button>
          </div>

          <div className="mt-4 grid gap-2 sm:grid-cols-5">
            {[
              ["summary", "Overview"],
              ["keyTakeaways", "Key Takeaways"],
              ["disagreementMap", "Disagreement"],
              ["conversationMap", "Structure"],
              ["relatedIdeas", "Related Ideas"],
            ].map(([toolKey, label]) => (
              <button
                key={toolKey}
                type="button"
                onClick={() => {
                  setShowAiToolsPanel(true);
                  setOpenPremiumAiTool(toolKey);

                  window.setTimeout(() => {
                    document.getElementById("intelligence-layer")?.scrollIntoView({
                      behavior: "smooth",
                      block: "start",
                    });
                  }, 0);
                }}
                className="rounded-2xl border border-[color:var(--loombus-border)] bg-[color:var(--loombus-muted-surface)] px-3 py-2 text-left text-xs text-[color:var(--loombus-muted-text)] transition hover:border-zinc-500 hover:text-[color:var(--loombus-text)]"
              >
                {label}
              </button>
            ))}
          </div>
        </section>

        <div className="mb-5 space-y-5 sm:mb-10">
          <StructuredDiscussionCard discussion={discussion} />

          <div className="text-base leading-7 text-zinc-300 sm:text-xl sm:leading-relaxed">
            {renderDiscussionBody(normalizePublicText(discussion.body))}
          </div>
        </div>

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

        <div className="mb-3 -mx-1 flex gap-2 overflow-x-auto px-1 pb-1 md:hidden" aria-label="Discussion detail tools rail">
          <button
            type="button"
            onClick={openDetailReplyForm}
            className="shrink-0 rounded-full bg-white px-3.5 py-2 text-sm font-medium text-black transition hover:bg-zinc-200"
          >
            Reply
          </button>

          <button
            type="button"
            onClick={openDetailReplies}
            className="shrink-0 rounded-full border border-zinc-800 bg-black/40 px-3.5 py-2 text-sm text-zinc-400 transition hover:border-zinc-600 hover:text-white"
          >
            Replies
          </button>

          <button
            type="button"
            onClick={toggleDetailSave}
            disabled={savingBookmark}
            className={`shrink-0 rounded-full px-3.5 py-2 text-sm transition disabled:cursor-not-allowed disabled:opacity-60 ${
              isSaved
                ? "bg-white text-black"
                : "border border-zinc-800 bg-black/40 text-zinc-400 hover:border-zinc-600 hover:text-white"
            }`}
          >
            {isSaved ? "Saved" : "Save"}
          </button>

          <button
            type="button"
            onClick={openDetailAiTools}
            className={`shrink-0 rounded-full px-3.5 py-2 text-sm transition ${
              activeDetailTool === "ai"
                ? "bg-white text-black"
                : "border border-zinc-800 bg-black/40 text-zinc-400 hover:border-zinc-600 hover:text-white"
            }`}
          >
            AI
          </button>


          {currentUserId && (
            <button
              type="button"
              onClick={openDetailReplyHelpers}
              className={`shrink-0 rounded-full px-3.5 py-2 text-sm transition ${
                activeDetailTool === "helpers"
                  ? "bg-white text-black"
                  : "border border-zinc-800 bg-black/40 text-zinc-400 hover:border-zinc-600 hover:text-white"
              }`}
            >
              Prompts
            </button>
          )}

          <button
            type="button"
            onClick={openDetailMore}
            className={`shrink-0 rounded-full px-3.5 py-2 text-sm transition ${
              activeDetailTool === "more"
                ? "bg-white text-black"
                : "border border-zinc-800 bg-black/40 text-zinc-400 hover:border-zinc-600 hover:text-white"
            }`}
          >
            More
          </button>
        </div>

        <div className="discussion-detail-legacy-mobile-actions-hidden mb-3 md:hidden">
          {showMobileThreadActions && (
            <section
              id="mobile-thread-actions"
              className="mt-2 rounded-2xl border border-zinc-800 bg-zinc-950 p-3.5 shadow-2xl shadow-black/30"
            >
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-zinc-600">
                    More tools
                  </p>
                  <h2 className="mt-1 text-lg font-medium">
                    Secondary actions.
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
                {relatedDiscussions.length > 0 && (
                  <button
                    type="button"
                    onClick={openDetailRelated}
                    className="w-full rounded-full border border-zinc-800 px-5 py-3 text-sm text-zinc-300 transition hover:border-zinc-600 hover:text-white"
                  >
                    View related discussions
                  </button>
                )}

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
                    onClick={openSaveFolderPanel}
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

                {(pinMessage || statusMessage || bookmarkMessage || stickiesMessage || reportMessage) && (
                  <p className="text-sm text-zinc-500">
                    {pinMessage || statusMessage || bookmarkMessage || stickiesMessage || reportMessage}
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
              onClick={openSaveFolderPanel}
              disabled={savingBookmark}
              className="inline-flex justify-center rounded-full border border-zinc-700 px-5 py-3 text-sm text-zinc-300 transition hover:border-zinc-500 hover:text-white disabled:cursor-not-allowed disabled:border-zinc-900 disabled:text-zinc-700"
            >
              {savingBookmark ? "Saving..." : "Save Discussion"}
            </button>
          )}

          {canUseStickies ? (
            <button
              type="button"
              onClick={handleAddToStickies}
              disabled={addingSticky || isStickied}
              className={`rounded-full border px-5 py-3 text-sm transition disabled:cursor-not-allowed disabled:opacity-60 ${
                isStickied
                  ? "border-zinc-700 bg-zinc-950 text-zinc-400"
                  : "border-zinc-700 text-zinc-300 hover:border-zinc-500 hover:text-white"
              }`}
            >
              {addingSticky ? "Adding..." : isStickied ? "Added to Stickies" : "Add to Stickies"}
            </button>
          ) : currentUserId ? (
            <Link
              href="/premium"
              className="rounded-full border border-zinc-800 px-5 py-3 text-sm text-zinc-500 transition hover:border-zinc-600 hover:text-white"
            >
              Stickies
            </Link>
          ) : null}

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

          {(pinMessage || statusMessage || bookmarkMessage || stickiesMessage || reportMessage) && (
            <p className="text-sm text-zinc-500">
              {pinMessage || statusMessage || bookmarkMessage || stickiesMessage || reportMessage}
            </p>
          )}
        </div>

        {showSaveFolderPanel && currentUserId && canUseSavedFolders && !isSaved && (
          <section className="mb-5 rounded-2xl border border-zinc-800 bg-zinc-950 p-4 shadow-2xl shadow-black/30 sm:mb-8 sm:rounded-3xl sm:p-6">
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="mb-2 text-xs uppercase tracking-[0.25em] text-zinc-600">
                  Save to folder
                </p>

                <h2 className="text-xl font-medium sm:text-2xl">
                  Choose where to save this discussion.
                </h2>

                <p className="mt-2 max-w-2xl text-sm leading-relaxed text-zinc-500">
                  Save it as Unfiled or place it into one of your existing saved folders.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setShowSaveFolderPanel(false)}
                className="w-fit rounded-full border border-zinc-800 px-4 py-2 text-sm text-zinc-500 transition hover:border-zinc-600 hover:text-white"
              >
                Close
              </button>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <label className="min-w-0 flex-1 text-sm text-zinc-500">
                <span className="mb-2 block">Folder</span>

                <select
                  value={selectedSaveCollectionId}
                  onChange={(event) => setSelectedSaveCollectionId(event.target.value)}
                  className="w-full rounded-2xl border border-zinc-800 bg-black px-4 py-3 text-sm text-zinc-300 outline-none transition focus:border-zinc-600"
                >
                  <option value="unfiled">Unfiled</option>
                  {bookmarkCollections.map((collection) => (
                    <option key={collection.id} value={collection.id}>
                      {collection.name}
                    </option>
                  ))}
                </select>
              </label>

              <button
                type="button"
                onClick={handleSaveWithSelectedFolder}
                disabled={savingBookmark}
                className="w-full rounded-full border border-zinc-700 px-5 py-3 text-center text-sm text-zinc-300 transition hover:border-zinc-500 hover:text-white disabled:cursor-not-allowed disabled:border-zinc-900 disabled:text-zinc-700 sm:mt-7 sm:w-fit"
              >
                {savingBookmark ? "Saving..." : "Save"}
              </button>
            </div>

            {bookmarkCollections.length === 0 && (
              <p className="mt-4 text-sm leading-relaxed text-zinc-500">
                No folders yet. Save this discussion as Unfiled now, then create folders from{" "}
                <Link
                  href="/saved"
                  className="text-zinc-300 underline-offset-4 hover:text-white hover:underline"
                >
                  Saved
                </Link>
                .
              </p>
            )}
          </section>
        )}

        <div id="intelligence-layer" className="scroll-mt-24" />

        {showAiToolsPanel && (
          <div className="discussion-detail-center-ai-panel mb-6 lg:hidden">
            <section className="rounded-2xl border border-zinc-800 bg-zinc-950 p-3.5 shadow-2xl shadow-black/30 sm:rounded-[1.5rem] sm:p-6">
              <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="mb-2 text-xs uppercase tracking-[0.25em] text-zinc-600">
                      State of the Discussion
                    </p>

                    <h2 className="text-lg font-medium sm:text-2xl">
                      {openPremiumAiTool === "keyTakeaways"
                        ? "Key Takeaways"
                        : openPremiumAiTool === "whatChanged"
                          ? "What Changed"
                          : openPremiumAiTool === "disagreementMap"
                            ? "Disagreement Map"
                            : openPremiumAiTool === "conversationMap"
                              ? "Conversation Map"
                              : openPremiumAiTool === "relatedIdeas"
                                ? "Related Ideas"
                                : "Discussion Summary"}
                    </h2>

                    <p className="mt-2 text-sm leading-relaxed text-zinc-500">
                      {!currentUserId
                        ? "Log in to generate a State of the Discussion for this thread."
                        : canUseAiSummary
                          ? "Use Loombus intelligence tools to understand the thread without reading every reply."
                          : (
                            <>
                              State of the Discussion tools are available with Premium or Premium Plus.{" "}
                              <Link
                                href="/premium"
                                className="text-zinc-300 underline-offset-4 hover:text-white hover:underline"
                              >
                                View Premium
                              </Link>
                            </>
                          )}
                    </p>
                  </div>

                  <div className="flex shrink-0">
                    {openPremiumAiTool === "summary" && !discussionSummary && currentUserId && canUseAiSummary && (
                      <button
                        type="button"
                        onClick={handleGenerateSummary}
                        disabled={generatingSummary}
                        className="w-full rounded-full border border-zinc-700 px-4 py-2 text-center text-sm text-zinc-300 transition hover:border-zinc-500 hover:text-white disabled:cursor-not-allowed disabled:border-zinc-900 disabled:text-zinc-700 sm:w-fit"
                      >
                        {generatingSummary ? "Generating..." : "Generate Summary"}
                      </button>
                    )}

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
                </div>

                <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-3">
                  {[
                    ["summary", "Overview"],
                    ["keyTakeaways", "Key Takeaways"],
                    ["whatChanged", "What Changed"],
                    ["disagreementMap", "Disagreement"],
                    ["conversationMap", "Structure"],
                    ["relatedIdeas", "Related Ideas"],
                  ].map(([toolKey, label]) => (
                    <button
                      key={toolKey}
                      type="button"
                      onClick={() => setOpenPremiumAiTool(toolKey)}
                      className={`rounded-2xl border px-3 py-2 text-left transition ${
                        openPremiumAiTool === toolKey
                          ? "border-zinc-500 bg-black text-white"
                          : "border-zinc-900 bg-black/40 text-zinc-500 hover:border-zinc-700 hover:text-white"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>

                {currentUserId && (
                  <div className="rounded-2xl border border-zinc-900 bg-black p-4 text-sm leading-relaxed text-zinc-500">
                    Current plan: {subscriptionDisplay.label}. Included AI usage: {aiUsageLabel}.
                  </div>
                )}

                <div className="rounded-2xl border border-zinc-900 bg-black p-4">
                  {!openPremiumAiTool && (
                    <p className="text-sm leading-relaxed text-zinc-500">
                      Choose an AI tool above.
                    </p>
                  )}

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
                              : "Upgrade to use AI-assisted summaries."}
                        </p>
                      )}

                      {summaryMessage && (
                        <p className="mt-4 text-sm text-zinc-500">
                          {summaryMessage}
                        </p>
                      )}
                    </>
                  )}

                  {openPremiumAiTool === "keyTakeaways" && (
                    <>
                      {keyTakeaways ? (
                        <div className="whitespace-pre-wrap text-sm leading-relaxed text-zinc-300 sm:text-base">
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
                              : "Upgrade to use AI-assisted key takeaways."}
                        </p>
                      )}

                      {takeawaysMessage && (
                        <p className="mt-4 text-sm text-zinc-500">
                          {takeawaysMessage}
                        </p>
                      )}
                    </>
                  )}

                  {openPremiumAiTool === "whatChanged" && (
                    <>
                      {whatChanged ? (
                        <div className="whitespace-pre-wrap text-sm leading-relaxed text-zinc-300 sm:text-base">
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
                              : "Upgrade to use what-changed analysis."}
                        </p>
                      )}

                      {whatChangedMessage && (
                        <p className="mt-4 text-sm text-zinc-500">
                          {whatChangedMessage}
                        </p>
                      )}
                    </>
                  )}

                  {openPremiumAiTool === "disagreementMap" && (
                    <>
                      {disagreementMap ? (
                        <div className="whitespace-pre-wrap text-sm leading-relaxed text-zinc-300 sm:text-base">
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
                              : "Upgrade to use disagreement mapping."}
                        </p>
                      )}

                      {disagreementMessage && (
                        <p className="mt-4 text-sm text-zinc-500">
                          {disagreementMessage}
                        </p>
                      )}
                    </>
                  )}

                  {openPremiumAiTool === "conversationMap" && (
                    <>
                      {conversationMap ? (
                        <div className="whitespace-pre-wrap text-sm leading-relaxed text-zinc-300 sm:text-base">
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
                              : "Upgrade to use conversation mapping."}
                        </p>
                      )}

                      {conversationMapMessage && (
                        <p className="mt-4 text-sm text-zinc-500">
                          {conversationMapMessage}
                        </p>
                      )}
                    </>
                  )}

                  {openPremiumAiTool === "relatedIdeas" && (
                    <>
                      {relatedIdeas ? (
                        <div className="whitespace-pre-wrap text-sm leading-relaxed text-zinc-300 sm:text-base">
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
                              : "Upgrade to use related ideas."}
                        </p>
                      )}

                      {relatedIdeasMessage && (
                        <p className="mt-4 text-sm text-zinc-500">
                          {relatedIdeasMessage}
                        </p>
                      )}
                    </>
                  )}
                </div>
              </div>
            </section>
          </div>
        )}

        {relatedDiscussions.length > 0 && activeDetailTool === "related" && (
          <div id="related-discussions" className="discussion-detail-center-related mb-6 scroll-mt-24 rounded-2xl border border-zinc-800 bg-zinc-950 p-4 shadow-2xl shadow-black/30 sm:mb-12 sm:rounded-3xl sm:p-7 xl:hidden">
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


          </div>

          {showReplyHelpersPanel && currentUserId && (
            <div className="mb-5 rounded-2xl border border-zinc-800 bg-zinc-950 p-3 shadow-2xl shadow-black/20 sm:mb-8 sm:rounded-[1.5rem] sm:p-4">
              <p className="mb-3 text-xs uppercase tracking-[0.22em] text-zinc-600">
                Reply prompts
              </p>

              <div className="space-y-3">
            <section className="rounded-2xl border border-zinc-900 bg-black/40 p-4 sm:p-5">
              <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="mb-2 text-xs font-bold uppercase tracking-[0.22em] text-zinc-500">
                    Community angles
                  </p>

                  <h3 className="text-lg font-medium text-white sm:text-xl">
                    Connect the idea to a real-world problem carefully.
                  </h3>
                </div>

                <span className="w-fit rounded-full border border-zinc-800 px-3 py-1.5 text-xs text-zinc-500">
                  Prompt set
                </span>
              </div>

              <p className="mb-4 max-w-3xl text-sm leading-relaxed text-zinc-500">
                Use these prompts to explore a local or community angle. They prefill the reply box and never post automatically.
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
                  Prompt set
                </span>
              </div>

              <p className="mb-4 max-w-3xl text-sm leading-relaxed text-zinc-500">
                Use these prompts to add learning, practical detail, skills, or community direction. They prefill the reply box only.
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
                  Structured prompts
                </span>
              </div>

              <p className="mb-4 max-w-3xl text-sm leading-relaxed text-zinc-500">
                Use these prompts when a point needs more detail, context, evidence, or practical explanation. They do not create scores or labels.
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
              <div className="mb-4 flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.24em] text-amber-300">
                    Pinned reply
                  </p>

                  <p className="mt-2 text-sm text-zinc-500">
                    Highlighted by the discussion author or Loombus.
                    {discussion.pinned_at
                      ? ` Pinned ${new Date(discussion.pinned_at).toLocaleString()}.`
                      : ""}
                  </p>
                </div>

                <div className="relative shrink-0" data-reply-action-menu>
                  <button
                    type="button"
                    onClick={() => toggleReplyActionMenu(`pinned-${pinnedReply.id}`)}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-zinc-800 bg-black text-xl leading-none text-zinc-400 transition hover:border-zinc-600 hover:text-white"
                    aria-expanded={openReplyActionMenuId === `pinned-${pinnedReply.id}`}
                    aria-label="Open pinned reply actions"
                  >
                    ⋮
                  </button>

                  {openReplyActionMenuId === `pinned-${pinnedReply.id}` && (
                    <div className="absolute right-0 z-20 mt-2 w-52 rounded-2xl border border-zinc-800 bg-black p-2 shadow-2xl shadow-black/40">
                      {currentUserId && pinnedReply.user_id !== currentUserId && (
                        <button
                          type="button"
                          onClick={() => {
                            closeReplyActionMenu();
                            startRespondToPoint(pinnedReply);
                          }}
                          className="w-full rounded-xl px-3 py-2 text-left text-sm text-zinc-300 transition hover:bg-zinc-900 hover:text-white"
                        >
                          Respond to point
                        </button>
                      )}

                      {canManageDiscussionStatus && (
                        <button
                          type="button"
                          onClick={() => {
                            closeReplyActionMenu();
                            updatePinnedReply(pinnedReply.id, true);
                          }}
                          disabled={pinWorkingReplyId === pinnedReply.id || pinWorkingReplyId === "unpin"}
                          className="w-full rounded-xl px-3 py-2 text-left text-sm text-amber-300 transition hover:bg-zinc-900 disabled:cursor-not-allowed disabled:text-zinc-700"
                        >
                          {pinWorkingReplyId === pinnedReply.id || pinWorkingReplyId === "unpin"
                            ? "Updating..."
                            : "Unpin"}
                        </button>
                      )}
                    </div>
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
                  <MentionText text={normalizePublicText(pinnedReply.body)} />
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
                  <div className="mb-4 flex items-start justify-between gap-3">
                    <p className="min-w-0 text-sm text-zinc-500">
                      <span className="inline-flex min-w-0 items-center gap-3">
                        <ProfileAvatar
                          profile={replyProfiles[reply.user_id]}
                          size="sm"
                        />
                        <ProfileName profile={replyProfiles[reply.user_id]} />
                      </span>
                    </p>

                    <div className="relative shrink-0" data-reply-action-menu>
                      <button
                        type="button"
                        onClick={() => toggleReplyActionMenu(reply.id)}
                        className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-zinc-800 bg-black text-xl leading-none text-zinc-400 transition hover:border-zinc-600 hover:text-white"
                        aria-expanded={openReplyActionMenuId === reply.id}
                        aria-label="Open reply actions"
                      >
                        ⋮
                      </button>

                      {openReplyActionMenuId === reply.id && (
                        <div className="absolute right-0 z-20 mt-2 w-52 rounded-2xl border border-zinc-800 bg-black p-2 shadow-2xl shadow-black/40">
                          {canRespondToPoint && !isEditingReply && (
                            <button
                              type="button"
                              onClick={() => {
                                closeReplyActionMenu();
                                startRespondToPoint(reply);
                              }}
                              disabled={Boolean(editingReplyId)}
                              className="w-full rounded-xl px-3 py-2 text-left text-sm text-zinc-300 transition hover:bg-zinc-900 hover:text-white disabled:cursor-not-allowed disabled:text-zinc-700"
                            >
                              Respond to point
                            </button>
                          )}

                          {canReportReply && (
                            <button
                              type="button"
                              onClick={() => {
                                closeReplyActionMenu();
                                handleReportReply(reply.id);
                              }}
                              disabled={reportingReplyId === reply.id || hasReportedReply}
                              className="w-full rounded-xl px-3 py-2 text-left text-sm text-zinc-300 transition hover:bg-zinc-900 hover:text-white disabled:cursor-not-allowed disabled:text-zinc-700"
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
                              onClick={() => {
                                closeReplyActionMenu();
                                updatePinnedReply(
                                  reply.id,
                                  discussion?.pinned_reply_id === reply.id
                                );
                              }}
                              disabled={Boolean(pinWorkingReplyId)}
                              className="w-full rounded-xl px-3 py-2 text-left text-sm text-amber-300 transition hover:bg-zinc-900 disabled:cursor-not-allowed disabled:text-zinc-700"
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
                              className="w-full rounded-xl px-3 py-2 text-left text-sm text-zinc-300 transition hover:bg-zinc-900 hover:text-white disabled:cursor-not-allowed disabled:text-zinc-700"
                            >
                              Edit
                            </button>
                          )}

                          {canDeleteReply && (
                            <button
                              type="button"
                              onClick={() => {
                                closeReplyActionMenu();
                                handleDeleteReply(reply.id);
                              }}
                              disabled={deletingReplyId === reply.id || isEditingReply}
                              className="w-full rounded-xl px-3 py-2 text-left text-sm text-red-300 transition hover:bg-zinc-900 disabled:cursor-not-allowed disabled:text-zinc-700"
                            >
                              {deletingReplyId === reply.id ? "Deleting..." : "Delete"}
                            </button>
                          )}
                        </div>
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
                        <MentionText text={normalizePublicText(reply.body)} />
                      </p>

                      <ReplyReactionChips reply={reply} />

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

      <aside className="discussion-detail-right-rail loombus-right-rail fixed inset-y-0 right-0 z-30 hidden overflow-y-auto border-l border-[var(--loombus-border)] px-4 py-6 text-[var(--loombus-text)] backdrop-blur-xl lg:block"
        style={{
          backgroundColor:
            "color-mix(in srgb, var(--loombus-page-bg) 94%, transparent 6%)",
        }}>
        <div className="space-y-4">
          <section className="rounded-3xl border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-5 shadow-2xl shadow-black/10">
            <p className="mb-2 text-xs uppercase tracking-[0.25em] text-[var(--loombus-text-subtle)]">
              Thread panel
            </p>

            <h2 className="text-xl font-semibold tracking-tight">
              Discussion tools.
            </h2>

            <p className="mt-3 text-sm leading-relaxed text-[var(--loombus-text-muted)]">
              Jump to replies, open the State of the Discussion, save this discussion, or continue reading related threads.
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
                  className={`w-full rounded-2xl border px-4 py-3 text-left text-sm transition disabled:cursor-not-allowed disabled:border-[var(--loombus-border)] disabled:text-[var(--loombus-text-subtle)] ${
                    discussionStatus === "resolved"
                      ? "border-[var(--loombus-border)] text-[var(--loombus-text)] hover:border-[var(--loombus-text-subtle)] hover:text-[var(--loombus-text)]"
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
                  className="w-full rounded-2xl border border-[var(--loombus-border)] bg-[var(--loombus-surface-muted)] px-4 py-3 text-left text-sm text-[var(--loombus-text-muted)] transition hover:border-[var(--loombus-text-subtle)] hover:text-[var(--loombus-text)] disabled:cursor-not-allowed disabled:border-[var(--loombus-border)] disabled:text-[var(--loombus-text-subtle)]"
                >
                  {savingBookmark ? "Removing..." : "Unsave Discussion"}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={openSaveFolderPanel}
                  disabled={savingBookmark}
                  className="w-full rounded-2xl border border-[var(--loombus-border)] bg-[var(--loombus-surface-muted)] px-4 py-3 text-left text-sm text-[var(--loombus-text)] transition hover:border-[var(--loombus-text-subtle)] hover:text-[var(--loombus-text)] disabled:cursor-not-allowed disabled:border-[var(--loombus-border)] disabled:text-[var(--loombus-text-subtle)]"
                >
                  {savingBookmark ? "Saving..." : "Save Discussion"}
                </button>
              )}

              {canUseStickies ? (
                <button
                  type="button"
                  onClick={handleAddToStickies}
                  disabled={addingSticky || isStickied}
                  className={`w-full rounded-2xl border bg-[var(--loombus-surface-muted)] px-4 py-3 text-left text-sm transition disabled:cursor-not-allowed disabled:opacity-60 ${
                    isStickied
                      ? "border-[var(--loombus-border)] text-[var(--loombus-text-muted)]"
                      : "border-[var(--loombus-border)] text-[var(--loombus-text)] hover:border-[var(--loombus-text-subtle)] hover:text-[var(--loombus-text)]"
                  }`}
                >
                  {addingSticky ? "Adding..." : isStickied ? "Added to Stickies" : "Add to Stickies"}
                </button>
              ) : currentUserId ? (
                <Link
                  href="/premium"
                  className="w-full rounded-2xl border border-[var(--loombus-border)] bg-[var(--loombus-surface-muted)] px-4 py-3 text-left text-sm text-[var(--loombus-text-muted)] transition hover:border-[var(--loombus-text-subtle)] hover:text-[var(--loombus-text)]"
                >
                  Unlock Stickies
                </Link>
              ) : null}

              <button
                type="button"
                onClick={() => {
                  if (!rightRailReportOpen && !reportedDiscussion) {
                    setRightRailReportOpen(true);
                    return;
                  }

                  handleReport();
                }}
                disabled={reportedDiscussion}
                className="w-full rounded-2xl border border-red-950 bg-[var(--loombus-surface-muted)] px-4 py-3 text-left text-sm text-red-400 transition hover:border-red-800 hover:text-red-300 disabled:cursor-not-allowed disabled:border-[var(--loombus-border)] disabled:text-[var(--loombus-text-subtle)]"
              >
                {reportedDiscussion
                  ? "Reported"
                  : rightRailReportOpen
                    ? "Submit Report"
                    : "Report Discussion"}
              </button>
            </div>

            <div className="mt-4 border-t border-[var(--loombus-border)] pt-4">
              <p className="mb-2 text-xs font-medium uppercase tracking-[0.18em] text-[var(--loombus-text-subtle)]">
                Reader shortcuts
              </p>

              <div className="grid grid-cols-3 gap-2">
                <a
                  href="#reply-form"
                  className="rounded-full border border-[var(--loombus-border)] px-3 py-2 text-center text-xs text-[var(--loombus-text-muted)] transition hover:border-[var(--loombus-text-subtle)] hover:text-[var(--loombus-text)]"
                >
                  Reply
                </a>

                <a
                  href="#replies"
                  className="rounded-full border border-[var(--loombus-border)] px-3 py-2 text-center text-xs text-[var(--loombus-text-muted)] transition hover:border-[var(--loombus-text-subtle)] hover:text-[var(--loombus-text)]"
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
                  className="rounded-full border border-[var(--loombus-border)] px-3 py-2 text-center text-xs text-[var(--loombus-text-muted)] transition hover:border-[var(--loombus-text-subtle)] hover:text-[var(--loombus-text)]"
                >
                  State
                </button>
              </div>
            </div>

            {currentUserId && rightRailReportOpen && !reportedDiscussion && (
              <div className="mt-4 rounded-2xl border border-[var(--loombus-border)] bg-[var(--loombus-surface-muted)] p-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs font-medium text-[var(--loombus-text-muted)]">
                    Report reason
                  </p>

                  <button
                    type="button"
                    onClick={() => setRightRailReportOpen(false)}
                    className="rounded-full border border-[var(--loombus-border)] px-3 py-1.5 text-xs text-[var(--loombus-text-muted)] transition hover:border-[var(--loombus-text-subtle)] hover:text-[var(--loombus-text)]"
                  >
                    Cancel
                  </button>
                </div>

                <div className="mt-3 grid gap-2">
                  {REPORT_REASONS.map((reason) => {
                    const selected = reportReason === reason;

                    return (
                      <button
                        key={reason}
                        type="button"
                        onClick={() => setReportReason(reason)}
                        className={`rounded-xl border px-3 py-2 text-left text-xs leading-snug transition ${
                          selected
                            ? "border-red-800 bg-red-950/20 text-red-300"
                            : "border-[var(--loombus-border)] text-[var(--loombus-text-muted)] hover:border-[var(--loombus-text-subtle)] hover:text-[var(--loombus-text)]"
                        }`}
                      >
                        <span className="flex items-start gap-2">
                          <span className="mt-0.5 w-4 shrink-0 text-center">
                            {selected ? "✓" : ""}
                          </span>
                          <span>{reason}</span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {(pinMessage || statusMessage || bookmarkMessage || reportMessage) && (
              <p className="mt-4 text-sm leading-relaxed text-[var(--loombus-text-muted)]">
                {pinMessage || statusMessage || bookmarkMessage || reportMessage}
              </p>
            )}
          </section>

          <section className="rounded-3xl border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-5 shadow-2xl shadow-black/10">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <p className="mb-2 text-xs uppercase tracking-[0.25em] text-[var(--loombus-text-subtle)]">
                  State of the Discussion
                </p>

                <h2 className="text-lg font-semibold tracking-tight">
                  Understand this thread.
                </h2>
              </div>

            </div>

            {currentUserId ? (
              <p className="text-sm leading-relaxed text-[var(--loombus-text-muted)]">
                Current plan: {subscriptionDisplay.label}. Included AI usage: {aiUsageLabel}.
              </p>
            ) : (
              <p className="text-sm leading-relaxed text-[var(--loombus-text-muted)]">
                Log in to generate a State of the Discussion for this thread.
              </p>
            )}

            <div className="mt-4 grid gap-2 text-sm">
              {[
                ["summary", "Overview"],
                ["keyTakeaways", "Key Takeaways"],
                ["whatChanged", "What Changed"],
                ["disagreementMap", "Disagreement Map"],
                ["conversationMap", "Conversation Structure"],
                ["relatedIdeas", "Related Ideas"],
              ].map(([toolKey, label]) => (
                <button
                  key={toolKey}
                  type="button"
                  onClick={() => {
                    setShowAiToolsPanel(true);
                    setOpenPremiumAiTool(toolKey);

                    window.setTimeout(() => {
                      document.getElementById("intelligence-layer")?.scrollIntoView({
                        behavior: "smooth",
                        block: "start",
                      });
                    }, 0);
                  }}
                  className="rounded-2xl border border-[var(--loombus-border)] bg-[var(--loombus-surface-muted)] px-4 py-3 text-left text-[var(--loombus-text-muted)] transition hover:border-[var(--loombus-text-subtle)] hover:text-[var(--loombus-text)]"
                >
                  {label}
                </button>
              ))}
            </div>
          </section>

          {relatedDiscussions.length > 0 && (
            <section className="rounded-3xl border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-5 shadow-2xl shadow-black/10">
              <div className="mb-4">
                <p className="mb-2 text-xs uppercase tracking-[0.25em] text-[var(--loombus-text-subtle)]">
                  Related discussions
                </p>

                <h2 className="text-lg font-semibold tracking-tight">
                  Keep reading in {discussion.topic}
                </h2>

                <Link
                  href={`/discussions?topic=${encodeURIComponent(discussion.topic)}`}
                  className="mt-3 inline-flex rounded-full border border-[var(--loombus-border)] px-3 py-1.5 text-xs text-[var(--loombus-text-muted)] transition hover:border-[var(--loombus-text-subtle)] hover:text-[var(--loombus-text)]"
                >
                  View topic
                </Link>
              </div>

              <div className="space-y-2">
                {relatedDiscussions.map((item) => (
                  <Link
                    key={item.id}
                    href={`/discussions/${item.id}`}
                    className="block rounded-2xl border border-[var(--loombus-border)] bg-[var(--loombus-surface-muted)] p-3 transition hover:border-[var(--loombus-border)]"
                  >
                    <p className="text-xs uppercase tracking-[0.18em] text-zinc-700">
                      {item.topic}
                    </p>

                    <h3 className="mt-2 text-sm font-medium leading-snug text-[var(--loombus-text)]">
                      {item.title}
                    </h3>

                    <p className="mt-2 text-xs text-[var(--loombus-text-subtle)]">
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
