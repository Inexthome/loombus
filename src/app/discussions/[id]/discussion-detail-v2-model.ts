import { normalizePublicText } from "@/lib/public-text";

export type DiscussionMode =
  | "open_discussion"
  | "debate"
  | "research_question"
  | "problem_solving";

export type DiscussionMetadata = Record<string, string>;

export type Discussion = {
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

export type Profile = {
  id: string;
  full_name: string | null;
  username: string | null;
  avatar_url: string | null;
  identity_verification_status?: string | null;
  is_admin?: boolean | null;
};

export type ReplyReactionType =
  | "helpful"
  | "insightful"
  | "well_reasoned"
  | "changed_my_view"
  | "needs_evidence";

export type ReplyReactionCounts = Partial<Record<ReplyReactionType, number>>;

export type ReplyReactionRow = {
  reply_id: string;
  user_id: string;
  reaction_type: ReplyReactionType;
};

export type Reply = {
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

export type RelatedDiscussion = {
  id: string;
  user_id: string;
  title: string;
  topic: string;
  created_at: string;
};

export type BookmarkCollection = {
  id: string;
  name: string;
};

export type DiscussionSummary = {
  id: string;
  discussion_id: string;
  summary: string;
  model_name: string | null;
  source_reply_count: number;
  generated_at: string;
};

export type DiscussionAttachment = {
  id: string;
  public_url: string;
  file_name: string;
  mime_type: string;
  file_size_bytes: number;
  attachment_kind: "image" | "pdf" | "video";
  video_duration_seconds?: number | null;
  sort_order: number;
};

export type AiEntitlement = {
  tier: string;
  ai_assisted_enabled: boolean;
  monthly_summary_limit: number;
};

export type BlockRow = {
  blocker_id: string;
  blocked_id: string;
};

export type AiOutputRatingValue = "helpful" | "not_helpful";
export type AiOutputRatings = Partial<Record<string, AiOutputRatingValue>>;

export type AiToolKey =
  | "summary"
  | "keyTakeaways"
  | "whatChanged"
  | "disagreementMap"
  | "conversationMap"
  | "relatedIdeas";

export const AI_TOOLS: Array<{
  key: AiToolKey;
  label: string;
  eyebrow: string;
  description: string;
}> = [
  {
    key: "summary",
    label: "Overview",
    eyebrow: "Thread summary",
    description: "Compress the discussion without flattening the important context.",
  },
  {
    key: "keyTakeaways",
    label: "Key takeaways",
    eyebrow: "Useful signal",
    description: "Surface the strongest conclusions, evidence, and unresolved questions.",
  },
  {
    key: "whatChanged",
    label: "What changed",
    eyebrow: "Movement",
    description: "See how the conversation evolved from the opening post to the latest replies.",
  },
  {
    key: "disagreementMap",
    label: "Disagreement",
    eyebrow: "Points of tension",
    description: "Separate genuine disagreement from different assumptions or definitions.",
  },
  {
    key: "conversationMap",
    label: "Structure",
    eyebrow: "Conversation map",
    description: "Trace the major claims, supporting points, counterpoints, and branches.",
  },
  {
    key: "relatedIdeas",
    label: "Related ideas",
    eyebrow: "Next directions",
    description: "Find adjacent questions and concepts worth carrying into another discussion.",
  },
];

export const REPLY_REACTIONS: Array<{
  type: ReplyReactionType;
  label: string;
  shortLabel: string;
}> = [
  { type: "helpful", label: "Helpful", shortLabel: "Helpful" },
  { type: "insightful", label: "Insightful", shortLabel: "Insight" },
  { type: "well_reasoned", label: "Well reasoned", shortLabel: "Reasoned" },
  { type: "changed_my_view", label: "Changed my view", shortLabel: "Changed view" },
  { type: "needs_evidence", label: "Needs evidence", shortLabel: "Evidence?" },
];

export const REPLY_HELPERS = [
  {
    title: "Clarify",
    prompts: [
      "Could you clarify the main claim here? I want to make sure I understand the point before responding.",
      "Could you share a concrete example of what you mean? That would make the point easier to evaluate.",
      "Could you add the source, context, or reasoning behind this claim?",
    ],
  },
  {
    title: "Advance",
    prompts: [
      "One useful thing that can be learned from this discussion is...",
      "A useful question to explore next is...",
      "One practical next step this points to is...",
    ],
  },
  {
    title: "Connect",
    prompts: [
      "The people most affected by this issue may be...",
      "The institutions, systems, or local factors involved may include...",
      "This discussion could become more useful beyond online conversation if...",
    ],
  },
] as const;

export function getProfileName(profile?: Profile | null) {
  return profile?.full_name?.trim() || profile?.username?.trim() || "Loombus member";
}

export function getProfileHandle(profile?: Profile | null) {
  return profile?.username ? `@${profile.username}` : "@loombus";
}

export function getDiscussionModeLabel(mode?: DiscussionMode | null) {
  if (mode === "debate") return "Debate";
  if (mode === "research_question") return "Research question";
  if (mode === "problem_solving") return "Problem solving";
  return "Open discussion";
}

export function getStructuredDiscussionSections(discussion: Discussion) {
  const metadata = discussion.discussion_metadata ?? {};

  if (discussion.discussion_type === "debate") {
    return [
      ["Claim", metadata.claim],
      ["Supporting argument", metadata.supportingArgument],
      ["Evidence", metadata.evidence],
      ["Question for opposing view", metadata.opposingQuestion],
    ] as const;
  }

  if (discussion.discussion_type === "research_question") {
    return [
      ["Research question", metadata.researchQuestion],
      ["Background", metadata.background],
      ["Sources", metadata.sources],
      ["Open questions", metadata.openQuestions],
    ] as const;
  }

  if (discussion.discussion_type === "problem_solving") {
    return [
      ["Problem", metadata.problem],
      ["What has been tried", metadata.tried],
      ["Constraints", metadata.constraints],
      ["Desired outcome", metadata.desiredOutcome],
    ] as const;
  }

  return [] as const;
}

function escapeLimitedHtml(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function hasLimitedFormattingHtml(value: string) {
  return /<\/?(strong|b|em|i|br|p|div)\b/i.test(value);
}

function sanitizeLimitedHtml(value: string) {
  const pattern = /<\/?(strong|b|em|i|br|p|div)\b[^>]*>/gi;
  let safe = "";
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(value)) !== null) {
    safe += escapeLimitedHtml(value.slice(lastIndex, match.index));
    const rawTag = match[0].toLowerCase();
    const tagName = match[1].toLowerCase();
    const normalizedTag = tagName === "b" ? "strong" : tagName === "i" ? "em" : tagName;

    if (normalizedTag === "br") safe += "<br>";
    else if (rawTag.startsWith("</")) safe += `</${normalizedTag}>`;
    else safe += `<${normalizedTag}>`;

    lastIndex = pattern.lastIndex;
  }

  safe += escapeLimitedHtml(value.slice(lastIndex));
  return safe.replace(/<div><br><\/div>/gi, "<br>").replace(/<p><br><\/p>/gi, "<br>");
}

function legacyMarkdownToHtml(value: string) {
  const escaped = escapeLimitedHtml(value)
    .replace(/\*\*([^*\n]+)\*\*/g, "<strong>$1</strong>")
    .replace(/\*([^*\n]+)\*/g, "<em>$1</em>");

  return escaped
    .split(/\n{2,}/)
    .map((paragraph) => `<p>${paragraph.replace(/\n/g, "<br>")}</p>`)
    .join("");
}

export function discussionBodyToSafeHtml(content: string) {
  const normalized = normalizePublicText(content);
  return sanitizeLimitedHtml(
    hasLimitedFormattingHtml(normalized) ? normalized : legacyMarkdownToHtml(normalized)
  );
}

export function getReplyReferencePreview(reply: Reply) {
  const source = normalizePublicText(reply.quoted_excerpt || reply.body)
    .trim()
    .replace(/\s+/g, " ");
  return source.length <= 220 ? source : `${source.slice(0, 217).trim()}...`;
}

export function getEditLabel(item: {
  edited_at?: string | null;
  edit_count?: number | null;
}) {
  if (!item.edited_at && !item.edit_count) return null;
  const parts: string[] = [];
  if (item.edited_at) parts.push(`Edited ${formatDateTime(item.edited_at)}`);
  if (item.edit_count) parts.push(`${item.edit_count} ${item.edit_count === 1 ? "edit" : "edits"}`);
  return parts.join(" · ");
}

export function formatDateTime(value: string) {
  return new Date(value).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function formatShortDate(value: string) {
  return new Date(value).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: new Date(value).getFullYear() === new Date().getFullYear() ? undefined : "numeric",
  });
}

export function formatAttachmentFileSize(bytes: number) {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

export function getReactionTotal(counts?: ReplyReactionCounts) {
  return Object.values(counts ?? {}).reduce((total, count) => total + (count ?? 0), 0);
}
