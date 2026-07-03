"use client";

import { normalizePublicText } from "@/lib/public-text";
import Link from "next/link";
import { type FormEvent, type KeyboardEvent, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import {
  Activity,
  ArrowLeft,
  BarChart3,
  Bookmark,
  CheckCircle2,
  CircleHelp,
  Copy,
  FileText,
  ListChecks,
  Loader2,
  MessageCircle,
  MoreHorizontal,
  Network,
  Pin,
  Reply,
  ShieldAlert,
  Sparkles,
  Trash2,
  Wand2,
} from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import { SafetyWarningModal, getSafetyWarningFromResult, type SafetyWarningState } from "@/components/safety-warning-modal";
import { DEFAULT_REPORT_REASON, REPORT_REASONS, type ReportReason } from "@/lib/report-reasons";
import { getSubscriptionDisplayKey } from "@/lib/subscription-plans";
import { formatVideoContextDuration } from "@/lib/video-context-limits";
import {
  getDefaultShellPayload,
  V2ShellGateCard,
  V2ShellMobileNav,
  V2ShellTopNav,
  type ShellPayload,
} from "../../v2-shell-components";

type DiscussionMode = "open_discussion" | "debate" | "research_question" | "problem_solving";
type DiscussionMetadata = Record<string, string>;

type Discussion = {
  id: string;
  user_id: string;
  title: string;
  topic: string | null;
  body: string | null;
  created_at: string;
  updated_at?: string | null;
  edited_at?: string | null;
  edit_count?: number | null;
  reality_lens?: string | null;
  purpose_lane?: string | null;
  discussion_type?: DiscussionMode | null;
  mode?: string | null;
  discussion_metadata?: DiscussionMetadata | null;
  discussion_status?: "open" | "resolved" | null;
  resolved_at?: string | null;
  pinned_reply_id?: string | null;
  pinned_at?: string | null;
  pinned_by?: string | null;
};

type DiscussionSummary = {
  id: string;
  discussion_id: string;
  summary: string;
  model_name: string | null;
  source_reply_count: number;
  generated_at: string;
};

type Profile = {
  id: string;
  full_name: string | null;
  username: string | null;
  avatar_url: string | null;
  is_admin?: boolean | null;
  identity_verification_status?: string | null;
};

type ReplyReactionType = "helpful" | "insightful" | "well_reasoned" | "changed_my_view" | "needs_evidence";
type ReplyReactionCounts = Partial<Record<ReplyReactionType, number>>;
type ReplyReactionRow = { reply_id: string; user_id: string; reaction_type: ReplyReactionType };

type ReplyRow = {
  id: string;
  user_id: string;
  body: string;
  created_at: string;
  updated_at?: string | null;
  edited_at?: string | null;
  edit_count?: number | null;
  referenced_reply_id?: string | null;
  quoted_excerpt?: string | null;
};

type RelatedDiscussion = { id: string; user_id: string; title: string; topic: string | null; created_at: string };
type TagRow = { tag: string | null };

type AttachmentRow = {
  id: string;
  public_url: string;
  file_name: string;
  mime_type: string | null;
  file_size_bytes: number | null;
  attachment_kind: "image" | "pdf" | "video" | string | null;
  video_duration_seconds?: number | null;
  sort_order?: number | null;
};

type BookmarkCollection = { id: string; name: string };
type AiEntitlement = { tier: string; ai_assisted_enabled: boolean; monthly_summary_limit: number };
type AiOutputRatingValue = "helpful" | "not_helpful";
type AiOutputRatings = Partial<Record<string, AiOutputRatingValue>>;
type AiToolKey = "summary" | "keyTakeaways" | "whatChanged" | "disagreementMap" | "conversationMap" | "relatedIdeas";
type AiTool = { key: AiToolKey; label: string; endpoint: string; resultKey: string; featureKey: string; Icon: typeof FileText };
type BlockRow = { blocker_id: string; blocked_id: string };
type HelpPanelKey = "state" | "ai" | null;
type ReplyHelperPrompt = { label: string; body: string; group: "Clarify" | "Build" | "Community" };

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const AI_TOOLS: AiTool[] = [
  { key: "summary", label: "Summary", endpoint: "/api/discussions/summary", resultKey: "summary", featureKey: "thread_summary", Icon: FileText },
  { key: "keyTakeaways", label: "Key Takeaways", endpoint: "/api/discussions/key-takeaways", resultKey: "takeaways", featureKey: "key_takeaways", Icon: ListChecks },
  { key: "whatChanged", label: "What Changed", endpoint: "/api/discussions/what-changed", resultKey: "whatChanged", featureKey: "what_changed", Icon: Activity },
  { key: "disagreementMap", label: "Disagreement Map", endpoint: "/api/discussions/disagreement-map", resultKey: "disagreementMap", featureKey: "disagreement_map", Icon: MessageCircle },
  { key: "conversationMap", label: "Conversation Map", endpoint: "/api/discussions/conversation-map", resultKey: "conversationMap", featureKey: "conversation_map", Icon: Network },
  { key: "relatedIdeas", label: "Related Ideas", endpoint: "/api/discussions/related-ideas", resultKey: "relatedIdeas", featureKey: "related_ideas", Icon: Sparkles },
];

const REPLY_REACTIONS: Array<{ type: ReplyReactionType; label: string; icon: string }> = [
  { type: "helpful", label: "Helpful", icon: "✓" },
  { type: "insightful", label: "Insightful", icon: "💡" },
  { type: "well_reasoned", label: "Well-Reasoned", icon: "🧠" },
  { type: "changed_my_view", label: "Changed My View", icon: "↺" },
  { type: "needs_evidence", label: "Needs Evidence", icon: "📚" },
];

const REPLY_HELPER_PROMPTS: ReplyHelperPrompt[] = [
  { group: "Clarify", label: "Clarify claim", body: "Could you clarify the main claim here? I want to make sure I understand the point before responding." },
  { group: "Clarify", label: "Ask example", body: "Could you share a concrete example of what you mean? That would make the point easier to evaluate." },
  { group: "Clarify", label: "Ask source", body: "Could you add the source, context, or reasoning behind this claim? I want to understand what it is based on." },
  { group: "Clarify", label: "Practical detail", body: "Could you explain how this would work in practice? The idea is interesting, but I need more detail." },
  { group: "Clarify", label: "Change my view", body: "What kind of evidence or example would make you reconsider this view?" },
  { group: "Clarify", label: "Lived context", body: "Is this coming from lived experience, professional experience, research, or a question you are exploring?" },
  { group: "Build", label: "What can be learned?", body: "One useful thing that can be learned from this discussion is..." },
  { group: "Build", label: "Next question", body: "A useful question to explore next is..." },
  { group: "Build", label: "Connect to skill", body: "The skill or area of mastery this connects to is..." },
  { group: "Build", label: "Practical step", body: "One practical next step this points to is..." },
  { group: "Build", label: "Community angle", body: "A local or community angle worth considering is..." },
  { group: "Build", label: "Make useful", body: "This discussion would become more useful if..." },
  { group: "Community", label: "Name issue", body: "The local or community issue this connects to is..." },
  { group: "Community", label: "Who is affected?", body: "The people most affected by this problem may be..." },
  { group: "Community", label: "Learn first", body: "Before anyone acts on this, it would help to learn..." },
  { group: "Community", label: "Clarifying step", body: "One small step that could clarify this issue is..." },
  { group: "Community", label: "Systems involved", body: "The institutions, systems, or local factors involved may include..." },
  { group: "Community", label: "Offline usefulness", body: "This discussion could become more useful beyond online conversation if..." },
];

function formatDate(value: string | null | undefined) {
  if (!value) return "Recently";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Recently";
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" }).format(date);
}

function formatRelative(value: string | null | undefined) {
  if (!value) return "Recently";
  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp)) return "Recently";
  const diffMinutes = Math.floor((Date.now() - timestamp) / 60000);
  if (diffMinutes < 1) return "Just now";
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric" }).format(new Date(value));
}

function formatCount(value: number | null | undefined) { return Math.max(0, value ?? 0).toLocaleString(); }
function formatCompactCount(value: number | null | undefined) {
  const count = Math.max(0, value ?? 0);
  if (count >= 1000) return `${(count / 1000).toFixed(count >= 10000 ? 0 : 1)}k`;
  return formatCount(count);
}
function formatFileSize(value: number | null | undefined) {
  const bytes = Math.max(0, value ?? 0);
  if (!bytes) return "File";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
function getName(profile: Profile | null | undefined) { return profile?.full_name?.trim() || profile?.username?.trim() || "Loombus member"; }
function getUsername(profile: Profile | null | undefined) { return profile?.username?.trim() ? `@${profile.username}` : "Loombus member"; }
function getInitial(profile: Profile | null | undefined) { return getName(profile).slice(0, 1).toUpperCase(); }
function getDiscussionMode(discussion: Discussion | null) { return discussion?.discussion_type ?? discussion?.mode ?? null; }
function getModeLabel(value: string | null | undefined) {
  if (value === "debate") return "Debate";
  if (value === "research_question") return "Research Question";
  if (value === "problem_solving") return "Problem Solving";
  return "Open Discussion";
}
function getRouteParamId(param: string | string[] | undefined) {
  const rawValue = Array.isArray(param) ? param[0] : param;
  return decodeURIComponent(rawValue ?? "").trim();
}
function getExcerpt(value: string | null | undefined, length = 220) {
  const clean = (value ?? "").replace(/\s+/g, " ").trim();
  return clean.length > length ? `${clean.slice(0, length - 3)}...` : clean;
}
function getDiscussionEditLabel(discussion: Discussion) {
  if (!discussion.edited_at && !discussion.edit_count) return null;
  const parts: string[] = [];
  if (discussion.edited_at) parts.push(`Last edited ${formatDate(discussion.edited_at)}`);
  if (discussion.edit_count) parts.push(`${discussion.edit_count} ${discussion.edit_count === 1 ? "edit" : "edits"}`);
  return parts.join(" · ");
}
function escapeLimitedHtml(value: string) { return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }
function hasLimitedFormattingHtml(value: string) { return /<\/?(strong|b|em|i|br|p|div)\b/i.test(value); }
function sanitizeLimitedDiscussionHtml(value: string) {
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
function legacyMarkdownBodyToSafeHtml(value: string) {
  const escaped = escapeLimitedHtml(value).replace(/\*\*([^*\n]+)\*\*/g, "<strong>$1</strong>").replace(/\*([^*\n]+)\*/g, "<em>$1</em>");
  return escaped.split(/\n{2,}/).map((paragraph) => `<p>${paragraph.replace(/\n/g, "<br>")}</p>`).join("");
}
function discussionBodyToSafeHtml(content: string) {
  if (hasLimitedFormattingHtml(content)) return sanitizeLimitedDiscussionHtml(content);
  return sanitizeLimitedDiscussionHtml(legacyMarkdownBodyToSafeHtml(content));
}
function getAiText(value: unknown, resultKey: string) {
  if (!value) return "No AI output was returned.";
  if (typeof value === "string") return value;
  if (typeof value === "object" && value && resultKey in value) {
    const output = (value as Record<string, unknown>)[resultKey];
    return typeof output === "string" ? output : JSON.stringify(value, null, 2);
  }
  return JSON.stringify(value, null, 2);
}
function Avatar({ profile, size = "md" }: { profile: Profile | null | undefined; size?: "sm" | "md" | "lg" }) {
  const sizeClass = size === "lg" ? "size-12" : size === "sm" ? "size-9" : "size-10";
  if (profile?.avatar_url) return <img src={profile.avatar_url} alt="" className={`${sizeClass} rounded-full object-cover`} />;
  return <span className={`grid ${sizeClass} place-items-center rounded-full bg-slate-100 font-black text-slate-600`}>{getInitial(profile)}</span>;
}
function ProfileName({ profile }: { profile: Profile | null | undefined }) {
  const label = getName(profile);
  if (!profile?.username) return <>{label}</>;
  return <Link href={`/u/${profile.username}`} className="font-black text-slate-950 transition hover:text-amber-800">{label}</Link>;
}
function MentionText({ text }: { text: string }) {
  const parts = text.split(/(@[a-zA-Z0-9_]{2,30})/g);
  return <>{parts.map((part, index) => { const match = part.match(/^@([a-zA-Z0-9_]{2,30})$/); if (!match) return <span key={`${part}-${index}`}>{part}</span>; const username = match[1].toLowerCase(); return <Link key={`${part}-${index}`} href={`/u/${username}`} className="font-black text-amber-800 underline decoration-amber-200 underline-offset-4 hover:decoration-amber-700">@{username}</Link>; })}</>;
}
function StructuredDiscussionCard({ discussion }: { discussion: Discussion }) {
  const metadata = discussion.discussion_metadata ?? {};
  const mode = getDiscussionMode(discussion);
  const rows = mode === "debate"
    ? [["Claim", metadata.claim], ["Supporting Argument", metadata.supportingArgument], ["Evidence", metadata.evidence], ["Question for Opposing View", metadata.opposingQuestion]]
    : mode === "research_question"
      ? [["Research Question", metadata.researchQuestion], ["Background", metadata.background], ["Sources", metadata.sources], ["Open Questions", metadata.openQuestions]]
      : mode === "problem_solving"
        ? [["Problem", metadata.problem], ["What Has Been Tried", metadata.tried], ["Constraints", metadata.constraints], ["Desired Outcome", metadata.desiredOutcome]]
        : [];
  const visibleRows = rows.filter(([, value]) => String(value ?? "").trim());
  if (visibleRows.length === 0) return null;
  return <section className="rounded-[1.5rem] border border-slate-200 bg-slate-50 p-5"><p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">Structured discussion mode</p><div className="mt-4 grid gap-3 sm:grid-cols-2">{visibleRows.map(([label, value]) => <div key={label} className="rounded-2xl border border-slate-200 bg-white p-4"><p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">{label}</p><p className="mt-2 text-sm leading-6 text-slate-700"><MentionText text={String(value)} /></p></div>)}</div></section>;
}

export default function V2DiscussionDetailPage() {
  const params = useParams<{ id?: string | string[] }>();
  const discussionId = getRouteParamId(params?.id);
  const [payload, setPayload] = useState<ShellPayload | null>(null);
  const [discussion, setDiscussion] = useState<Discussion | null>(null);
  const [discussionSummary, setDiscussionSummary] = useState<DiscussionSummary | null>(null);
  const [authorProfile, setAuthorProfile] = useState<Profile | null>(null);
  const [replies, setReplies] = useState<ReplyRow[]>([]);
  const [replyProfiles, setReplyProfiles] = useState<Record<string, Profile>>({});
  const [tags, setTags] = useState<string[]>([]);
  const [attachments, setAttachments] = useState<AttachmentRow[]>([]);
  const [relatedDiscussions, setRelatedDiscussions] = useState<RelatedDiscussion[]>([]);
  const [viewCount, setViewCount] = useState(0);
  const [savedCount, setSavedCount] = useState(0);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [savedBookmarkId, setSavedBookmarkId] = useState<string | null>(null);
  const [bookmarkCollections, setBookmarkCollections] = useState<BookmarkCollection[]>([]);
  const [selectedSaveCollectionId, setSelectedSaveCollectionId] = useState("unfiled");
  const [showSavePanel, setShowSavePanel] = useState(false);
  const [isStickied, setIsStickied] = useState(false);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [replyBody, setReplyBody] = useState("");
  const [referencedReply, setReferencedReply] = useState<ReplyRow | null>(null);
  const [postingReply, setPostingReply] = useState(false);
  const [savingBookmark, setSavingBookmark] = useState(false);
  const [addingSticky, setAddingSticky] = useState(false);
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);
  const [replyMenuId, setReplyMenuId] = useState<string | null>(null);
  const [reportPanelOpen, setReportPanelOpen] = useState(false);
  const [reportTarget, setReportTarget] = useState<{ type: "discussion" | "reply"; replyId?: string } | null>(null);
  const [reportReason, setReportReason] = useState<ReportReason>(DEFAULT_REPORT_REASON);
  const [reportedDiscussion, setReportedDiscussion] = useState(false);
  const [reportedReplyIds, setReportedReplyIds] = useState<string[]>([]);
  const [reporting, setReporting] = useState(false);
  const [editingReplyId, setEditingReplyId] = useState<string | null>(null);
  const [editingReplyBody, setEditingReplyBody] = useState("");
  const [updatingReplyId, setUpdatingReplyId] = useState<string | null>(null);
  const [deletingReplyId, setDeletingReplyId] = useState<string | null>(null);
  const [pinWorkingReplyId, setPinWorkingReplyId] = useState<string | null>(null);
  const [statusWorking, setStatusWorking] = useState(false);
  const [replyReactionCounts, setReplyReactionCounts] = useState<Record<string, ReplyReactionCounts>>({});
  const [myReplyReactions, setMyReplyReactions] = useState<Record<string, ReplyReactionType[]>>({});
  const [reactionWorkingKey, setReactionWorkingKey] = useState("");
  const [activeAiTool, setActiveAiTool] = useState<AiToolKey | null>(null);
  const [aiWorkingTool, setAiWorkingTool] = useState<AiToolKey | null>(null);
  const [aiOutputs, setAiOutputs] = useState<Partial<Record<AiToolKey, string>>>({});
  const [aiMessage, setAiMessage] = useState("");
  const [aiEntitlement, setAiEntitlement] = useState<AiEntitlement | null>(null);
  const [aiOutputRatings, setAiOutputRatings] = useState<AiOutputRatings>({});
  const [ratingFeatureKey, setRatingFeatureKey] = useState("");
  const [safetyWarning, setSafetyWarning] = useState<SafetyWarningState>(null);
  const [activeHelpPanel, setActiveHelpPanel] = useState<HelpPanelKey>(null);

  async function getSessionState() { const { data } = await supabase.auth.getSession(); return { accessToken: data.session?.access_token ?? "", userId: data.session?.user.id ?? null }; }
  async function trackDiscussionView(targetDiscussionId: string, accessToken: string) { try { await fetch("/api/discussions/view", { method: "POST", headers: { "Content-Type": "application/json", ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}) }, body: JSON.stringify({ discussionId: targetDiscussionId }), cache: "no-store" }); } catch {} }

  async function loadDiscussionDetail() {
    setLoading(true); setMessage("");
    try {
      const { accessToken, userId } = await getSessionState(); setCurrentUserId(userId);
      const shellResponse = await fetch("/api/v2/shell", { headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined });
      const nextPayload = (await shellResponse.json().catch(() => getDefaultShellPayload())) as ShellPayload; setPayload(nextPayload);
      if (!discussionId) { setMessage("Discussion id is missing."); return; }
      if (!UUID_PATTERN.test(discussionId)) { setDiscussion(null); setMessage(`Invalid V2 discussion route id: "${discussionId}". Open a real discussion card from /v2/discussions.`); return; }
      const { data: discussionData, error: discussionError } = await supabase.from("discussions").select("*").eq("id", discussionId).is("deleted_at", null).maybeSingle();
      if (discussionError || !discussionData) { setDiscussion(null); setMessage(discussionError ? `This discussion could not be loaded in V2: ${discussionError.message}` : "This discussion was not found."); return; }
      const nextDiscussion = discussionData as Discussion; setDiscussion(nextDiscussion); void trackDiscussionView(nextDiscussion.id, accessToken);
      const hiddenProfileIds = new Set<string>();
      if (userId) { const { data: blockRows } = await supabase.from("user_blocks").select("blocker_id, blocked_id").or(`blocker_id.eq.${userId},blocked_id.eq.${userId}`); for (const block of (blockRows ?? []) as BlockRow[]) hiddenProfileIds.add(block.blocker_id === userId ? block.blocked_id : block.blocker_id); }
      const savedStateQuery = userId ? supabase.from("bookmarks").select("id").eq("user_id", userId).eq("discussion_id", discussionId).maybeSingle() : Promise.resolve({ data: null });
      const [profileResult, replyResult, summaryResult, tagResult, attachmentResult, viewResult, saveResult, savedStateResult, relatedResult] = await Promise.all([
        supabase.from("profiles").select("id, full_name, username, avatar_url").eq("id", nextDiscussion.user_id).maybeSingle(),
        supabase.from("replies").select("*").eq("discussion_id", discussionId).is("deleted_at", null).order("created_at", { ascending: true }),
        supabase.from("discussion_summaries").select("id, discussion_id, summary, model_name, source_reply_count, generated_at").eq("discussion_id", discussionId).maybeSingle(),
        supabase.from("discussion_tags").select("tag").eq("discussion_id", discussionId).order("tag", { ascending: true }),
        supabase.from("discussion_attachments").select("id, public_url, file_name, mime_type, file_size_bytes, attachment_kind, video_duration_seconds, sort_order").eq("discussion_id", discussionId).order("sort_order", { ascending: true }).order("created_at", { ascending: true }),
        supabase.from("discussion_views").select("id", { count: "exact", head: true }).eq("discussion_id", discussionId),
        supabase.from("bookmarks").select("id", { count: "exact", head: true }).eq("discussion_id", discussionId),
        savedStateQuery,
        nextDiscussion.topic ? supabase.from("discussions").select("id, user_id, title, topic, created_at").eq("topic", nextDiscussion.topic).neq("id", discussionId).is("deleted_at", null).order("created_at", { ascending: false }).limit(3) : Promise.resolve({ data: [] }),
      ]);
      const visibleReplies = ((replyResult.data ?? []) as ReplyRow[]).filter((reply) => !hiddenProfileIds.has(reply.user_id));
      const visibleRelated = ((relatedResult.data ?? []) as RelatedDiscussion[]).filter((item) => !hiddenProfileIds.has(item.user_id));
      setAuthorProfile((profileResult.data as Profile | null) ?? null); setReplies(visibleReplies); setDiscussionSummary((summaryResult.data as DiscussionSummary | null) ?? null); if (summaryResult.data) setAiOutputs((current) => ({ ...current, summary: (summaryResult.data as DiscussionSummary).summary })); setTags(((tagResult.data ?? []) as TagRow[]).map((row) => row.tag).filter((tag): tag is string => Boolean(tag))); setAttachments((attachmentResult.data ?? []) as AttachmentRow[]); setRelatedDiscussions(visibleRelated); setViewCount(viewResult.count ?? 0); setSavedCount(saveResult.count ?? 0); setIsSaved(Boolean(savedStateResult.data)); setSavedBookmarkId((savedStateResult.data as { id?: string } | null)?.id ?? null);
      const replyUserIds = [...new Set(visibleReplies.map((reply) => reply.user_id).filter(Boolean))];
      if (replyUserIds.length > 0) { const { data: replyProfileRows } = await supabase.from("profiles").select("id, full_name, username, avatar_url").in("id", replyUserIds); setReplyProfiles(Object.fromEntries(((replyProfileRows ?? []) as Profile[]).map((profile) => [profile.id, profile]))); } else setReplyProfiles({});
      if (!userId) { setIsAdmin(false); setAiEntitlement(null); setReplyReactionCounts({}); setMyReplyReactions({}); setReportedDiscussion(false); setReportedReplyIds([]); return; }
      const replyIds = visibleReplies.map((reply) => reply.id);
      const [viewerProfileResult, entitlementResult, discussionReportResult, reactionRowsResult, replyReportsResult, bookmarkCollectionsResult, aiRatingsResult] = await Promise.all([
        supabase.from("profiles").select("is_admin, identity_verification_status").eq("id", userId).maybeSingle(),
        supabase.from("user_ai_entitlements").select("tier, ai_assisted_enabled, monthly_summary_limit").eq("user_id", userId).maybeSingle(),
        supabase.from("reports").select("id").eq("reporter_id", userId).eq("discussion_id", discussionId).is("reply_id", null).maybeSingle(),
        replyIds.length > 0 ? supabase.from("reply_reactions").select("reply_id, user_id, reaction_type").in("reply_id", replyIds) : Promise.resolve({ data: [] }),
        replyIds.length > 0 ? supabase.from("reports").select("reply_id").eq("reporter_id", userId).in("reply_id", replyIds) : Promise.resolve({ data: [] }),
        supabase.from("bookmark_collections").select("id, name").order("created_at", { ascending: false }),
        fetch(`/api/ai/output-ratings?discussionId=${encodeURIComponent(discussionId)}`, { headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined, cache: "no-store" }).catch(() => null),
      ]);
      const viewerIsAdmin = Boolean((viewerProfileResult.data as Profile | null)?.is_admin); setIsAdmin(viewerIsAdmin);
      setAiEntitlement(viewerIsAdmin ? { tier: "admin", ai_assisted_enabled: true, monthly_summary_limit: 999999 } : ((entitlementResult.data as AiEntitlement | null) ?? { tier: "free", ai_assisted_enabled: false, monthly_summary_limit: 0 }));
      setReportedDiscussion(Boolean(discussionReportResult.data)); setReportedReplyIds(((replyReportsResult.data ?? []) as Array<{ reply_id?: string | null }>).map((row) => row.reply_id).filter((replyId): replyId is string => Boolean(replyId))); setBookmarkCollections((bookmarkCollectionsResult.data ?? []) as BookmarkCollection[]);
      const reactionCounts: Record<string, ReplyReactionCounts> = {}; const viewerReactions: Record<string, ReplyReactionType[]> = {};
      for (const row of (reactionRowsResult.data ?? []) as ReplyReactionRow[]) { const counts = reactionCounts[row.reply_id] ?? {}; counts[row.reaction_type] = (counts[row.reaction_type] ?? 0) + 1; reactionCounts[row.reply_id] = counts; if (row.user_id === userId) viewerReactions[row.reply_id] = [...(viewerReactions[row.reply_id] ?? []), row.reaction_type]; }
      setReplyReactionCounts(reactionCounts); setMyReplyReactions(viewerReactions);
      if (aiRatingsResult?.ok) { const result = await aiRatingsResult.json().catch(() => ({})); if (result?.ratings && typeof result.ratings === "object") setAiOutputRatings(result.ratings as AiOutputRatings); }
      const canLoadStickies = ["premium", "premium_plus", "admin"].includes(getSubscriptionDisplayKey(viewerIsAdmin ? { tier: "admin", ai_assisted_enabled: true, monthly_summary_limit: 999999 } : entitlementResult.data));
      if (canLoadStickies && accessToken) { const stickyResponse = await fetch("/api/stickies", { headers: { Authorization: `Bearer ${accessToken}` }, cache: "no-store" }).catch(() => null); const stickyResult = await stickyResponse?.json().catch(() => ({})); setIsStickied(Boolean(stickyResponse?.ok && (stickyResult?.stickies ?? []).some((sticky: { source_key?: string }) => sticky.source_key === discussionId))); }
    } catch (error) { setPayload(getDefaultShellPayload()); setMessage(error instanceof Error ? `Unable to load this discussion in V2: ${error.message}` : "Unable to load this discussion in V2."); }
    finally { setLoading(false); }
  }

  useEffect(() => { void loadDiscussionDetail(); const { data } = supabase.auth.onAuthStateChange(() => void loadDiscussionDetail()); return () => data.subscription.unsubscribe(); }, [discussionId]);
  useEffect(() => { if (!moreMenuOpen && !replyMenuId) return; function handleOutsideClick(event: MouseEvent) { const target = event.target as HTMLElement | null; if (target?.closest("[data-v2-action-menu]")) return; setMoreMenuOpen(false); setReplyMenuId(null); } function handleEscape(event: globalThis.KeyboardEvent) { if (event.key === "Escape") { setMoreMenuOpen(false); setReplyMenuId(null); } } document.addEventListener("mousedown", handleOutsideClick); document.addEventListener("keydown", handleEscape); return () => { document.removeEventListener("mousedown", handleOutsideClick); document.removeEventListener("keydown", handleEscape); }; }, [moreMenuOpen, replyMenuId]);

  const subscriptionKey = getSubscriptionDisplayKey(aiEntitlement);
  const canUseAi = ["premium", "premium_plus", "admin"].includes(subscriptionKey);
  const canManageDiscussion = Boolean(currentUserId && discussion && (discussion.user_id === currentUserId || isAdmin));
  const discussionStatus = discussion?.discussion_status === "resolved" ? "resolved" : "open";
  const pinnedReply = discussion?.pinned_reply_id ? replies.find((reply) => reply.id === discussion.pinned_reply_id) ?? null : null;
  const visibleReplies = pinnedReply ? replies.filter((reply) => reply.id !== pinnedReply.id) : replies;
  const signalTotal = replies.length * 3 + savedCount * 5 + viewCount;
  const activeTool = AI_TOOLS.find((tool) => tool.key === activeAiTool);
  const discussionEditLabel = discussion ? getDiscussionEditLabel(discussion) : null;

  function requireLogin() { if (!discussion) window.location.href = "/login"; else window.location.href = `/login?next=${encodeURIComponent(`/v2/discussions/${discussion.id}`)}`; }
  function scrollToReplyForm() { window.setTimeout(() => document.getElementById("v2-reply-form")?.scrollIntoView({ behavior: "smooth", block: "center" }), 0); }
  function startReply(reply?: ReplyRow) { setReferencedReply(reply ?? null); setMessage(""); setSafetyWarning(null); setReplyMenuId(null); scrollToReplyForm(); }
  function startHelperPrompt(prompt: ReplyHelperPrompt) { setReferencedReply(null); setReplyBody(prompt.body); setMessage(""); setSafetyWarning(null); scrollToReplyForm(); }
  function handleReplyFormKeyDown(event: KeyboardEvent<HTMLFormElement>) { if ((event.metaKey || event.ctrlKey) && event.key === "Enter") void handleReplySubmit(event); }

  async function handleReplySubmit(event: FormEvent<HTMLFormElement> | KeyboardEvent<HTMLFormElement>) { event.preventDefault(); if (postingReply || !discussion) return; if (!replyBody.trim()) { setMessage("Reply cannot be empty."); return; } setPostingReply(true); setMessage(""); setSafetyWarning(null); try { const { accessToken } = await getSessionState(); if (!accessToken) { requireLogin(); return; } const response = await fetch("/api/replies/create", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` }, body: JSON.stringify({ discussionId: discussion.id, body: normalizePublicText(replyBody), referencedReplyId: referencedReply?.id ?? undefined, pastedCharacterCount: 0 }) }); const result = await response.json().catch(() => ({})); if (!response.ok) { const safetyWarningResult = getSafetyWarningFromResult(result); if (safetyWarningResult) { setSafetyWarning(safetyWarningResult); setMessage(""); } else setMessage(result.error ?? "Unable to post reply."); return; } const newReply = result.reply as ReplyRow | undefined; if (newReply) { setReplies((current) => [...current, newReply]); const { data: profileData } = await supabase.from("profiles").select("id, full_name, username, avatar_url").eq("id", newReply.user_id).maybeSingle(); if (profileData) setReplyProfiles((current) => ({ ...current, [newReply.user_id]: profileData as Profile })); } setReplyBody(""); setReferencedReply(null); setMessage("Reply posted."); } catch { setMessage("Unable to post reply."); } finally { setPostingReply(false); } }
  async function handleToggleSave(collectionId: string | null = null) { if (!discussion || savingBookmark) return; setSavingBookmark(true); setMessage(""); setMoreMenuOpen(false); try { const { accessToken } = await getSessionState(); if (!accessToken) { requireLogin(); return; } if (isSaved && savedBookmarkId) { const response = await fetch("/api/bookmarks", { method: "DELETE", headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` }, body: JSON.stringify({ bookmarkId: savedBookmarkId }) }); const result = await response.json().catch(() => ({})); if (!response.ok) { setMessage(result.error ?? "Unable to remove saved discussion."); return; } setIsSaved(false); setSavedBookmarkId(null); setSavedCount((count) => Math.max(0, count - 1)); setShowSavePanel(false); setMessage("Saved discussion removed."); return; } const response = await fetch("/api/bookmarks", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` }, body: JSON.stringify({ discussionId: discussion.id }) }); const result = await response.json().catch(() => ({})); if (!response.ok) { setMessage(result.error ?? "Already saved or unable to save."); return; } const nextBookmarkId = result.bookmark?.id ?? null; setIsSaved(true); setSavedBookmarkId(nextBookmarkId); setSavedCount((count) => count + 1); if (nextBookmarkId && collectionId) { const moveResponse = await fetch("/api/bookmarks/move", { method: "PATCH", headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` }, body: JSON.stringify({ bookmarkId: nextBookmarkId, collectionId }) }); const moveResult = await moveResponse.json().catch(() => ({})); if (!moveResponse.ok) { setMessage(moveResult.error ?? "Discussion saved, but it could not be moved into the selected folder."); return; } setMessage("Discussion saved to folder."); } else setMessage("Discussion saved."); setShowSavePanel(false); } catch { setMessage("Unable to update saved discussion."); } finally { setSavingBookmark(false); } }
  async function handleAddToStickies() { if (!discussion || addingSticky) return; setAddingSticky(true); setMessage(""); try { const { accessToken } = await getSessionState(); if (!accessToken) { requireLogin(); return; } const response = await fetch("/api/stickies", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` }, body: JSON.stringify({ discussionId: discussion.id }) }); const result = await response.json().catch(() => ({})); if (!response.ok) { setMessage(result.error ?? "Unable to add to Stickies."); return; } setIsStickied(true); setMessage("Added to Stickies."); } finally { setAddingSticky(false); } }
  async function handleCopyLink() { if (!discussion) return; await navigator.clipboard.writeText(`${window.location.origin}/v2/discussions/${discussion.id}`).catch(() => undefined); setMoreMenuOpen(false); setReplyMenuId(null); setMessage("Link copied."); }
  function openReportPanel(target: { type: "discussion" | "reply"; replyId?: string }) { if (!currentUserId) { requireLogin(); return; } setReportTarget(target); setReportReason(DEFAULT_REPORT_REASON); setReportPanelOpen(true); setMoreMenuOpen(false); setReplyMenuId(null); window.setTimeout(() => document.getElementById("v2-report-panel")?.scrollIntoView({ behavior: "smooth", block: "center" }), 0); }
  async function handleSubmitReport() { if (!discussion || !reportTarget || reporting) return; setReporting(true); setMessage(""); try { const { accessToken } = await getSessionState(); if (!accessToken) { requireLogin(); return; } const response = await fetch("/api/reports", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` }, body: JSON.stringify({ targetType: reportTarget.type, discussionId: discussion.id, replyId: reportTarget.replyId, reason: reportReason }) }); const result = await response.json().catch(() => ({})); if (!response.ok) { setMessage(result.error ?? "Unable to submit report."); return; } if (reportTarget.type === "discussion") setReportedDiscussion(true); if (reportTarget.replyId) setReportedReplyIds((current) => current.includes(reportTarget.replyId!) ? current : [...current, reportTarget.replyId!]); setReportPanelOpen(false); setReportTarget(null); setMessage(reportTarget.type === "reply" ? "Reply reported." : "Discussion reported."); } catch { setMessage("Unable to submit report."); } finally { setReporting(false); } }
  function startReplyEdit(reply: ReplyRow) { setReplyMenuId(null); setEditingReplyId(reply.id); setEditingReplyBody(reply.body); setMessage(""); }
  async function handleUpdateReply(replyId: string) { if (!editingReplyBody.trim() || updatingReplyId) return; setUpdatingReplyId(replyId); setSafetyWarning(null); setMessage(""); try { const { accessToken } = await getSessionState(); if (!accessToken) { requireLogin(); return; } const response = await fetch("/api/replies/update", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` }, body: JSON.stringify({ replyId, body: normalizePublicText(editingReplyBody) }) }); const result = await response.json().catch(() => ({})); if (!response.ok) { const safetyWarningResult = getSafetyWarningFromResult(result); if (safetyWarningResult) setSafetyWarning(safetyWarningResult); else setMessage(result.error ?? "Unable to update reply."); return; } const updatedReply = result.reply as ReplyRow; setReplies((current) => current.map((reply) => reply.id === replyId ? { ...reply, body: updatedReply.body, updated_at: updatedReply.updated_at ?? null, edited_at: updatedReply.edited_at ?? null, edit_count: updatedReply.edit_count ?? reply.edit_count ?? 0 } : reply)); setEditingReplyId(null); setEditingReplyBody(""); setMessage("Reply updated."); } finally { setUpdatingReplyId(null); } }
  async function handleDeleteReply(replyId: string) { if (deletingReplyId) return; setDeletingReplyId(replyId); setMessage(""); try { const { accessToken } = await getSessionState(); if (!accessToken) { requireLogin(); return; } const response = await fetch("/api/replies/delete", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` }, body: JSON.stringify({ replyId }) }); const result = await response.json().catch(() => ({})); if (!response.ok) { setMessage(result.error ?? "Unable to delete reply."); return; } setReplies((current) => current.filter((reply) => reply.id !== replyId)); setMessage("Reply deleted."); } finally { setDeletingReplyId(null); } }
  async function updatePinnedReply(replyId: string, unpin = false) { if (!discussion || !canManageDiscussion || pinWorkingReplyId) return; setPinWorkingReplyId(replyId || "unpin"); setMessage(""); try { const { accessToken } = await getSessionState(); if (!accessToken) { requireLogin(); return; } const response = await fetch("/api/discussions/pin-reply", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` }, body: JSON.stringify({ discussionId: discussion.id, replyId, unpin }) }); const result = await response.json().catch(() => ({})); if (!response.ok) { setMessage(result.error ?? "Unable to update pinned reply."); return; } setDiscussion((current) => current ? { ...current, pinned_reply_id: result.discussion?.pinned_reply_id ?? null, pinned_at: result.discussion?.pinned_at ?? null, pinned_by: result.discussion?.pinned_by ?? null } : current); setReplyMenuId(null); setMessage(unpin ? "Reply unpinned." : "Reply pinned."); } finally { setPinWorkingReplyId(null); } }
  async function updateDiscussionStatus(nextStatus: "open" | "resolved") { if (!discussion || !canManageDiscussion || statusWorking) return; setStatusWorking(true); setMessage(""); try { const { accessToken } = await getSessionState(); if (!accessToken) { requireLogin(); return; } const response = await fetch("/api/discussions/status", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` }, body: JSON.stringify({ discussionId: discussion.id, status: nextStatus }) }); const result = await response.json().catch(() => ({})); if (!response.ok) { setMessage(result.error ?? "Unable to update discussion status."); return; } setDiscussion((current) => current ? { ...current, discussion_status: result.discussion?.discussion_status ?? nextStatus, resolved_at: result.discussion?.resolved_at ?? null } : current); setMessage(nextStatus === "resolved" ? "Discussion marked resolved." : "Discussion reopened."); } finally { setStatusWorking(false); } }
  async function handleToggleReplyReaction(replyId: string, reactionType: ReplyReactionType) { if (reactionWorkingKey) return; if (!currentUserId) { requireLogin(); return; } const workingKey = `${replyId}:${reactionType}`; setReactionWorkingKey(workingKey); try { const { accessToken } = await getSessionState(); if (!accessToken) { requireLogin(); return; } const response = await fetch("/api/replies/react", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` }, body: JSON.stringify({ replyId, reactionType }) }); const result = await response.json().catch(() => ({})); if (!response.ok) { setMessage(result.error ?? "Unable to update reaction."); return; } setReplyReactionCounts((current) => ({ ...current, [replyId]: result.counts ?? {} })); setMyReplyReactions((current) => { const currentTypes = new Set(current[replyId] ?? []); if (result.reacted) currentTypes.add(reactionType); else currentTypes.delete(reactionType); return { ...current, [replyId]: Array.from(currentTypes) }; }); } finally { setReactionWorkingKey(""); } }
  async function handleGenerateAiTool(tool: AiTool) { if (!discussion || aiWorkingTool) return; if (!canUseAi) { setAiMessage("This tool requires Premium or Premium Plus access."); setActiveAiTool(tool.key); return; } setActiveAiTool(tool.key); setAiWorkingTool(tool.key); setAiMessage(""); try { const { accessToken } = await getSessionState(); if (!accessToken) { requireLogin(); return; } const response = await fetch(tool.endpoint, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` }, body: JSON.stringify({ discussionId: discussion.id }) }); const result = await response.json().catch(() => ({})); if (!response.ok) { setAiMessage(result.error ?? `Unable to generate ${tool.label}.`); return; } setAiOutputs((current) => ({ ...current, [tool.key]: getAiText(result[tool.resultKey], tool.resultKey) })); if (tool.key === "summary") setDiscussionSummary(null); setAiMessage(result.cached ? `Showing cached ${tool.label}.` : `${tool.label} generated.`); } catch { setAiMessage(`Unable to generate ${tool.label}.`); } finally { setAiWorkingTool(null); } }
  async function handleRateAiOutput(featureKey: string, rating: AiOutputRatingValue | null) { if (!discussion) return; setRatingFeatureKey(featureKey); try { const { accessToken } = await getSessionState(); if (!accessToken) return; const response = await fetch("/api/ai/output-ratings", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` }, body: JSON.stringify({ discussionId: discussion.id, featureKey, rating }) }); const result = await response.json().catch(() => ({})); if (!response.ok) return; setAiOutputRatings((current) => { const next = { ...current }; if (result.rating) next[featureKey] = result.rating; else delete next[featureKey]; return next; }); } finally { setRatingFeatureKey(""); } }

  function ReactionChips({ reply }: { reply: ReplyRow }) { const counts = replyReactionCounts[reply.id] ?? {}; const selectedTypes = new Set(myReplyReactions[reply.id] ?? []); const isOwnReply = currentUserId === reply.user_id; return <div className="mt-4 flex flex-wrap gap-2">{REPLY_REACTIONS.map((reaction) => { const count = counts[reaction.type] ?? 0; const selected = selectedTypes.has(reaction.type); const working = reactionWorkingKey === `${reply.id}:${reaction.type}`; return <button key={reaction.type} type="button" onClick={() => void handleToggleReplyReaction(reply.id, reaction.type)} disabled={working || isOwnReply} className={`rounded-full border px-3 py-1.5 text-xs font-bold transition disabled:cursor-not-allowed disabled:opacity-50 ${selected ? "border-amber-300 bg-amber-100 text-amber-900" : "border-slate-200 bg-white text-slate-600 hover:border-amber-200 hover:bg-amber-50 hover:text-amber-800"}`}><span className="mr-1">{reaction.icon}</span>{reaction.label}{count > 0 ? <span className="ml-1">{count}</span> : null}</button>; })}</div>; }
  function AiRatingControls({ featureKey }: { featureKey: string }) { const currentRating = aiOutputRatings[featureKey]; return <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-slate-200 pt-4 text-xs font-bold text-slate-500"><span>Was this useful?</span><button type="button" disabled={ratingFeatureKey === featureKey} onClick={() => void handleRateAiOutput(featureKey, currentRating === "helpful" ? null : "helpful")} className={`rounded-full border px-3 py-1.5 ${currentRating === "helpful" ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-slate-200 bg-white text-slate-600"}`}>Helpful</button><button type="button" disabled={ratingFeatureKey === featureKey} onClick={() => void handleRateAiOutput(featureKey, currentRating === "not_helpful" ? null : "not_helpful")} className={`rounded-full border px-3 py-1.5 ${currentRating === "not_helpful" ? "border-amber-200 bg-amber-50 text-amber-800" : "border-slate-200 bg-white text-slate-600"}`}>Not helpful</button></div>; }
  function HelpButton({ panel, label }: { panel: Exclude<HelpPanelKey, null>; label: string }) { return <button type="button" onClick={() => setActiveHelpPanel((current) => current === panel ? null : panel)} aria-label={label} aria-expanded={activeHelpPanel === panel} className="rounded-full p-1 text-slate-400 transition hover:bg-slate-50 hover:text-amber-800"><CircleHelp className="size-4" /></button>; }
  function HelperPromptGroup({ group }: { group: ReplyHelperPrompt["group"] }) { const prompts = REPLY_HELPER_PROMPTS.filter((prompt) => prompt.group === group); return <div><p className="mb-2 text-xs font-black uppercase tracking-[0.16em] text-slate-500">{group}</p><div className="flex flex-wrap gap-2">{prompts.map((prompt) => <button key={`${group}-${prompt.label}`} type="button" onClick={() => startHelperPrompt(prompt)} className="rounded-full border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-600 hover:border-amber-200 hover:bg-amber-50 hover:text-amber-800">{prompt.label}</button>)}</div></div>; }

  if (loading) return <V2ShellGateCard title="Loading V2 discussion" message="Loombus is loading this discussion inside the V2 shell." loading />;
  if (payload?.authenticated && (!payload.configured || !payload.flags.v2_shell || payload.version !== "v2")) return <V2ShellGateCard title="V2 shell is not enabled" message="This account is not currently allowed through the v2_shell flag. Current users remain on the existing experience." payload={payload} />;

  return <main className="fixed inset-0 z-[80] min-h-screen overflow-y-auto bg-[#f7f7f8] loombus-v2-page-bg text-slate-950"><SafetyWarningModal warning={safetyWarning} onClose={() => setSafetyWarning(null)} /><V2ShellTopNav /><section className="mx-auto grid max-w-7xl gap-6 px-4 pb-28 pt-6 sm:px-6 lg:grid-cols-[minmax(0,1fr)_340px] lg:px-8"><div className="min-w-0 space-y-5"><Link href="/v2/discussions" className="inline-flex items-center gap-2 text-sm font-bold text-slate-500 transition hover:text-amber-800"><ArrowLeft className="size-4" />Back to Discussions</Link>{message && <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-bold text-amber-900">{message}</div>}{!discussion ? <section className="rounded-[2rem] border border-slate-200 bg-white p-6 text-slate-600 shadow-sm">No discussion is available for this route.</section> : <><article className="rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-sm sm:p-6"><div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between"><div className="min-w-0"><div className="mb-3 flex flex-wrap gap-2"><span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-bold text-amber-800 ring-1 ring-amber-200">{discussion.topic || "Discussion"}</span><span className="rounded-full bg-violet-50 px-3 py-1 text-xs font-bold text-violet-700">{getModeLabel(getDiscussionMode(discussion))}</span>{discussion.purpose_lane && <span className="rounded-full bg-slate-50 px-3 py-1 text-xs font-bold text-slate-600">{discussion.purpose_lane}</span>}<span className={`rounded-full px-3 py-1 text-xs font-bold ${discussionStatus === "resolved" ? "bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200" : "bg-slate-50 text-slate-600 ring-1 ring-slate-200"}`}>{discussionStatus === "resolved" ? "Resolved" : "Open for replies"}</span></div><h1 className="text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">{normalizePublicText(discussion.title)}</h1>{discussionEditLabel ? <p className="mt-2 text-xs font-bold text-slate-500">{discussionEditLabel}</p> : null}</div><div className="relative flex shrink-0 items-center gap-2" data-v2-action-menu><button type="button" onClick={() => currentUserId ? setMessage("Follow is coming to the V2 discussion shell.") : requireLogin()} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-black text-slate-700 transition hover:border-amber-200 hover:bg-amber-50 hover:text-amber-800"><Wand2 className="size-4" />Follow</button><button type="button" onClick={() => setMoreMenuOpen((open) => !open)} aria-label="More actions" aria-expanded={moreMenuOpen} className="grid size-10 place-items-center rounded-xl border border-slate-200 text-slate-600 transition hover:border-amber-200 hover:bg-amber-50 hover:text-amber-800"><MoreHorizontal className="size-5" /></button>{moreMenuOpen ? <div className="absolute right-0 top-12 z-20 w-64 rounded-2xl border border-slate-200 bg-white p-2 shadow-2xl shadow-slate-900/15"><button type="button" onClick={() => setShowSavePanel(true)} className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm font-black text-slate-700 transition hover:bg-slate-50"><Bookmark className="size-4" /> {isSaved ? "Remove from Saved" : "Save discussion"}</button><button type="button" onClick={() => void handleCopyLink()} className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm font-black text-slate-700 transition hover:bg-slate-50"><Copy className="size-4" /> Copy link</button>{canManageDiscussion && <button type="button" onClick={() => void updateDiscussionStatus(discussionStatus === "resolved" ? "open" : "resolved")} className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm font-black text-slate-700 transition hover:bg-slate-50"><CheckCircle2 className="size-4" /> {discussionStatus === "resolved" ? "Reopen" : "Mark resolved"}</button>}{canUseAi && <button type="button" onClick={() => void handleAddToStickies()} disabled={addingSticky || isStickied} className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm font-black text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"><Pin className="size-4" /> {isStickied ? "Added to Stickies" : "Add to Stickies"}</button>}<button type="button" onClick={() => openReportPanel({ type: "discussion" })} disabled={reportedDiscussion} className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm font-black text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"><ShieldAlert className="size-4" /> {reportedDiscussion ? "Reported" : "Report discussion"}</button></div> : null}</div></div><div className="mt-5 flex flex-wrap items-center gap-3 border-b border-slate-100 pb-5 text-sm text-slate-500"><Avatar profile={authorProfile} size="lg" /><div><p className="font-black text-slate-950"><ProfileName profile={authorProfile} /></p><p className="font-semibold text-slate-500">{getUsername(authorProfile)} · {formatDate(discussion.created_at)}</p></div></div><div className="mt-5 space-y-5"><StructuredDiscussionCard discussion={discussion} /><div className="prose prose-slate max-w-none text-base leading-8 text-slate-700" dangerouslySetInnerHTML={{ __html: discussionBodyToSafeHtml(normalizePublicText(discussion.body || "No body provided.")) }} />{tags.length > 0 && <div className="flex flex-wrap gap-2">{tags.map((tag) => <span key={tag} className="rounded-full bg-slate-50 px-3 py-1 text-xs font-bold text-slate-600 ring-1 ring-slate-200">#{tag}</span>)}</div>}</div>{attachments.length > 0 && <section className="mt-6 rounded-[1.5rem] border border-slate-200 bg-slate-50 p-4"><h2 className="text-sm font-black uppercase tracking-[0.16em] text-slate-500">Attachments</h2><div className="mt-4 grid gap-4">{attachments.map((attachment) => <div key={attachment.id} className="rounded-2xl border border-slate-200 bg-white p-4">{attachment.attachment_kind === "image" ? <a href={attachment.public_url} target="_blank" rel="noreferrer"><img src={attachment.public_url} alt={attachment.file_name} className="max-h-[520px] w-full rounded-xl object-contain" /></a> : attachment.attachment_kind === "video" ? <video controls playsInline preload="metadata" className="aspect-video w-full rounded-xl bg-black" src={attachment.public_url} /> : <a href={attachment.public_url} target="_blank" rel="noreferrer" className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 font-black text-slate-700 hover:border-amber-200 hover:bg-amber-50"><span className="truncate">{attachment.file_name}</span><span className="text-sm text-slate-500">Open PDF →</span></a>}<p className="mt-3 text-xs font-semibold text-slate-500">{attachment.file_name} · {attachment.attachment_kind || attachment.mime_type || "Attachment"}{attachment.video_duration_seconds ? ` · ${formatVideoContextDuration(attachment.video_duration_seconds)}` : ""} · {formatFileSize(attachment.file_size_bytes)}</p></div>)}</div></section>}<div className="mt-6 flex flex-wrap gap-3"><button type="button" onClick={() => startReply()} className="inline-flex items-center gap-2 rounded-xl bg-amber-300 px-4 py-2 text-sm font-black text-slate-950 hover:bg-amber-400"><Reply className="size-4" /> Reply</button><button type="button" onClick={() => setShowSavePanel(true)} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-black text-slate-700 hover:border-amber-200 hover:bg-amber-50"><Bookmark className="size-4" /> {isSaved ? "Saved" : "Save"}</button></div></article>{showSavePanel ? <section className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-start justify-between gap-3"><div><h2 className="text-lg font-black text-slate-950">{isSaved ? "Saved discussion" : "Save discussion"}</h2><p className="mt-1 text-sm font-semibold text-slate-500">Save to Unfiled or one of your folders.</p></div><button type="button" onClick={() => setShowSavePanel(false)} className="rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-black text-slate-500">Close</button></div>{!isSaved ? <div className="mt-4 flex flex-col gap-3 sm:flex-row"><select value={selectedSaveCollectionId} onChange={(event) => setSelectedSaveCollectionId(event.target.value)} className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-700"><option value="unfiled">Unfiled</option>{bookmarkCollections.map((collection) => <option key={collection.id} value={collection.id}>{collection.name}</option>)}</select><button type="button" onClick={() => void handleToggleSave(selectedSaveCollectionId === "unfiled" ? null : selectedSaveCollectionId)} disabled={savingBookmark} className="rounded-xl bg-amber-300 px-4 py-2 text-sm font-black text-slate-950 disabled:opacity-60">{savingBookmark ? "Saving..." : "Save"}</button></div> : <button type="button" onClick={() => void handleToggleSave()} disabled={savingBookmark} className="mt-4 rounded-xl border border-slate-200 px-4 py-2 text-sm font-black text-slate-600 disabled:opacity-60">{savingBookmark ? "Removing..." : "Remove from Saved"}</button>}</section> : null}{reportPanelOpen ? <section id="v2-report-panel" className="rounded-[1.5rem] border border-amber-200 bg-amber-50 p-5 shadow-sm"><h2 className="text-lg font-black text-slate-950">Report {reportTarget?.type === "reply" ? "reply" : "discussion"}</h2><p className="mt-1 text-sm font-semibold text-slate-600">Choose a reason so moderation can review the right issue.</p><select value={reportReason} onChange={(event) => setReportReason(event.target.value as ReportReason)} className="mt-4 w-full rounded-xl border border-amber-200 bg-white px-3 py-2 text-sm font-bold text-slate-700 outline-none focus:border-amber-400">{REPORT_REASONS.map((reason) => <option key={reason} value={reason}>{reason}</option>)}</select><div className="mt-4 flex gap-2"><button type="button" onClick={() => void handleSubmitReport()} disabled={reporting} className="rounded-xl bg-amber-300 px-4 py-2 text-sm font-black text-slate-950 transition hover:bg-amber-400 disabled:opacity-60">{reporting ? "Reporting..." : "Submit report"}</button><button type="button" onClick={() => setReportPanelOpen(false)} disabled={reporting} className="rounded-xl border border-amber-200 bg-white px-4 py-2 text-sm font-black text-slate-600 transition hover:text-slate-950 disabled:opacity-60">Cancel</button></div></section> : null}<section id="v2-reply-form" className="rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-sm sm:p-6"><h2 className="text-xl font-black text-slate-950">Add a reply</h2><p className="mt-1 text-sm font-semibold text-slate-500">Keep it clear, useful, and directly connected to the discussion.</p>{referencedReply ? <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4"><div className="flex items-start justify-between gap-3"><p className="text-sm font-bold text-slate-600">Replying to: {getExcerpt(referencedReply.quoted_excerpt || referencedReply.body)}</p><button type="button" onClick={() => setReferencedReply(null)} className="text-xs font-black text-slate-500 hover:text-slate-950">Clear</button></div></div> : null}<form onSubmit={handleReplySubmit} onKeyDown={handleReplyFormKeyDown} className="mt-4 space-y-4"><textarea value={replyBody} onChange={(event) => setReplyBody(event.target.value)} rows={5} placeholder="Write your reply... Use @username to mention someone. Press Cmd/Ctrl + Enter to post." className="w-full resize-none rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm leading-6 text-slate-800 outline-none placeholder:text-slate-400 focus:border-amber-300 focus:ring-2 focus:ring-amber-100" /><div className="space-y-4"><HelperPromptGroup group="Clarify" /><HelperPromptGroup group="Build" /><HelperPromptGroup group="Community" /></div><div className="flex justify-end"><button type="submit" disabled={postingReply || !replyBody.trim()} className="inline-flex items-center gap-2 rounded-xl bg-amber-300 px-5 py-2.5 text-sm font-black text-slate-950 transition hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-60">{postingReply ? <Loader2 className="size-4 animate-spin" /> : <Reply className="size-4" />}{postingReply ? "Posting..." : "Post reply"}</button></div></form></section>{pinnedReply ? <ReplyCard reply={pinnedReply} pinned /> : null}<section className="overflow-visible rounded-[1.75rem] border border-slate-200 bg-white shadow-sm"><div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-4 sm:px-6"><h2 className="font-black text-slate-950">{formatCount(replies.length)} Replies</h2></div><div className="divide-y divide-slate-100 px-5 sm:px-6">{replies.length === 0 ? <div className="py-6 text-sm text-slate-600">No replies yet.</div> : visibleReplies.map((reply) => <ReplyCard key={reply.id} reply={reply} />)}{replies.length > 0 && visibleReplies.length === 0 && pinnedReply ? <div className="py-6 text-sm text-slate-600">The only reply is pinned above.</div> : null}</div></section></>}</div><aside className="space-y-4"><section className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-center gap-2"><h2 className="text-sm font-black uppercase tracking-[0.16em] text-slate-500">State of the discussion</h2><HelpButton panel="state" label="Explain state of the discussion" /></div>{activeHelpPanel === "state" ? <div className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-xs font-semibold leading-5 text-amber-900">This panel shows the thread status, replies, saves, views, and reader activity so you can understand the discussion before replying.</div> : null}<div className="mt-4 space-y-3 text-sm font-semibold text-slate-600"><div className="flex items-center justify-between gap-3"><span>Status</span><span className="font-black text-slate-950">{discussionStatus === "resolved" ? "Resolved" : "Open"}</span></div><div className="flex items-center justify-between gap-3"><span>Replies</span><span className="font-black text-slate-950">{formatCount(replies.length)}</span></div><div className="flex items-center justify-between gap-3"><span>Saved</span><span className="font-black text-slate-950">{formatCount(savedCount)}</span></div><div className="flex items-center justify-between gap-3"><span>Views</span><span className="font-black text-slate-950">{formatCompactCount(viewCount)}</span></div></div>{canManageDiscussion ? <button type="button" onClick={() => void updateDiscussionStatus(discussionStatus === "resolved" ? "open" : "resolved")} disabled={statusWorking} className="mt-4 w-full rounded-xl border border-slate-200 px-4 py-2 text-sm font-black text-slate-700 hover:border-amber-200 hover:bg-amber-50 disabled:opacity-60">{statusWorking ? "Updating..." : discussionStatus === "resolved" ? "Reopen" : "Mark resolved"}</button> : null}</section><section className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-center justify-between gap-3"><h2 className="text-sm font-black uppercase tracking-[0.16em] text-slate-500">Signal Activity</h2><BarChart3 className="size-5 text-slate-500" /></div><div className="mt-4 space-y-3 text-sm font-semibold text-slate-600"><div className="flex items-center justify-between gap-3"><span>Total Signals</span><span className="font-black text-slate-950">{formatCompactCount(signalTotal)}</span></div><div className="flex items-center justify-between gap-3"><span>Unique Contributors</span><span className="font-black text-slate-950">{formatCount(new Set(replies.map((reply) => reply.user_id)).size)}</span></div><div className="flex items-center justify-between gap-3"><span>Latest Reply</span><span className="font-black text-slate-950">{formatRelative(replies[replies.length - 1]?.created_at)}</span></div></div></section><section className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-center gap-2"><h2 className="text-sm font-black uppercase tracking-[0.16em] text-slate-500">AI Tools</h2><HelpButton panel="ai" label="Explain AI tools" /></div>{activeHelpPanel === "ai" ? <div className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-xs font-semibold leading-5 text-amber-900">AI tools help Premium users summarize the thread, extract key takeaways, map disagreements, understand conversation structure, and find related ideas. They do not replace the original discussion.</div> : null}{discussionSummary ? <p className="mt-3 rounded-2xl border border-slate-200 bg-slate-50 p-3 text-xs font-bold text-slate-600">Cached summary available from {formatDate(discussionSummary.generated_at)}.</p> : null}<div className="mt-4 grid grid-cols-2 gap-3">{AI_TOOLS.map((tool) => { const Icon = tool.Icon; const working = aiWorkingTool === tool.key; return <button key={tool.key} type="button" onClick={() => void handleGenerateAiTool(tool)} disabled={Boolean(aiWorkingTool)} className={`grid min-h-20 place-items-center rounded-2xl border px-3 py-4 text-center text-sm font-black transition disabled:cursor-not-allowed disabled:opacity-60 ${activeAiTool === tool.key ? "border-amber-300 bg-amber-50 text-amber-900" : "border-slate-200 bg-white text-slate-700 hover:border-amber-200 hover:bg-amber-50 hover:text-amber-800"}`}>{working ? <Loader2 className="mb-2 size-5 animate-spin text-amber-700" /> : <Icon className="mb-2 size-5 text-amber-700" />}{tool.label}</button>; })}</div>{aiMessage ? <p className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-bold text-amber-900">{aiMessage}</p> : null}{activeTool ? <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4"><h3 className="text-sm font-black text-slate-950">{activeTool.label}</h3><p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">{aiOutputs[activeTool.key] || "Select the tool to generate analysis for this discussion."}</p>{aiOutputs[activeTool.key] ? <AiRatingControls featureKey={activeTool.featureKey} /> : null}</div> : null}</section>{relatedDiscussions.length > 0 && <section className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm"><h2 className="text-sm font-black uppercase tracking-[0.16em] text-slate-500">Related discussions</h2><div className="mt-4 space-y-3">{relatedDiscussions.map((item) => <Link key={item.id} href={`/v2/discussions/${item.id}`} className="block rounded-2xl border border-slate-200 bg-slate-50 p-3 text-sm font-bold text-slate-700 transition hover:border-amber-200 hover:bg-amber-50"><span className="line-clamp-2">{item.title}</span><span className="mt-1 block text-xs text-slate-500">{formatRelative(item.created_at)}</span></Link>)}</div></section>}</aside></section><V2ShellMobileNav /></main>;

  function ReplyCard({ reply, pinned = false }: { reply: ReplyRow; pinned?: boolean }) {
    const replyProfile = replyProfiles[reply.user_id] ?? null; const menuOpen = replyMenuId === reply.id; const isEditing = editingReplyId === reply.id; const canEdit = Boolean(currentUserId && (reply.user_id === currentUserId || isAdmin)); const canDelete = canEdit; const canRespond = Boolean(currentUserId && reply.user_id !== currentUserId); const hasReported = reportedReplyIds.includes(reply.id); const replyEditLabel = reply.edited_at || reply.edit_count ? `${reply.edited_at ? `Edited ${formatDate(reply.edited_at)}` : "Edited"}${reply.edit_count ? ` · ${reply.edit_count} ${reply.edit_count === 1 ? "edit" : "edits"}` : ""}` : null;
    return <article className={pinned ? "rounded-[1.5rem] border border-amber-200 bg-amber-50 p-5 shadow-sm" : "py-5"}>{pinned ? <p className="mb-4 text-xs font-black uppercase tracking-[0.16em] text-amber-800">Pinned reply</p> : null}<div className="flex items-start gap-4"><Avatar profile={replyProfile} size="md" /><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2 text-sm"><ProfileName profile={replyProfile} /><span className="font-semibold text-slate-500">{formatRelative(reply.created_at)}</span>{pinned ? <span className="rounded-full bg-amber-100 px-2 py-1 text-[11px] font-black text-amber-800">Pinned</span> : null}</div>{isEditing ? <div className="mt-3 space-y-3"><textarea value={editingReplyBody} onChange={(event) => setEditingReplyBody(event.target.value)} rows={5} maxLength={5000} className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm leading-6 text-slate-800 outline-none focus:border-amber-300" /><div className="flex flex-wrap items-center justify-between gap-3"><p className="text-xs font-semibold text-slate-500">{editingReplyBody.length}/5000 characters</p><div className="flex gap-2"><button type="button" onClick={() => { setEditingReplyId(null); setEditingReplyBody(""); }} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-black text-slate-600">Cancel</button><button type="button" onClick={() => void handleUpdateReply(reply.id)} disabled={updatingReplyId === reply.id} className="rounded-xl bg-amber-300 px-4 py-2 text-sm font-black text-slate-950 disabled:opacity-60">{updatingReplyId === reply.id ? "Saving..." : "Save edit"}</button></div></div></div> : <>{reply.quoted_excerpt ? <div className="mt-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-500">{reply.quoted_excerpt}</div> : null}<p className="mt-2 whitespace-pre-wrap text-sm leading-7 text-slate-700"><MentionText text={normalizePublicText(reply.body)} /></p><ReactionChips reply={reply} />{replyEditLabel ? <p className="mt-3 text-xs font-semibold text-slate-500">{replyEditLabel}</p> : null}</>}</div><div className="relative" data-v2-action-menu><button type="button" onClick={() => setReplyMenuId((current) => current === reply.id ? null : reply.id)} className="rounded-xl p-2 text-slate-500 transition hover:bg-slate-50 hover:text-amber-800" aria-label="Reply actions" aria-expanded={menuOpen}><MoreHorizontal className="size-4" /></button>{menuOpen ? <div className="absolute right-0 top-9 z-20 w-52 rounded-2xl border border-slate-200 bg-white p-2 shadow-2xl shadow-slate-900/15"><button type="button" onClick={() => startReply(reply)} className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-xs font-black text-slate-700 hover:bg-slate-50"><Reply className="size-4" /> Respond to point</button>{canManageDiscussion ? <button type="button" onClick={() => void updatePinnedReply(reply.id, discussion?.pinned_reply_id === reply.id)} disabled={Boolean(pinWorkingReplyId)} className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-xs font-black text-amber-800 hover:bg-amber-50 disabled:opacity-50"><Pin className="size-4" /> {pinWorkingReplyId === reply.id ? "Updating..." : discussion?.pinned_reply_id === reply.id ? "Unpin" : "Pin reply"}</button> : null}{canEdit && !isEditing ? <button type="button" onClick={() => startReplyEdit(reply)} className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-xs font-black text-slate-700 hover:bg-slate-50"><FileText className="size-4" /> Edit</button> : null}{canDelete ? <button type="button" onClick={() => void handleDeleteReply(reply.id)} disabled={deletingReplyId === reply.id || isEditing} className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-xs font-black text-red-700 hover:bg-red-50 disabled:opacity-50"><Trash2 className="size-4" /> {deletingReplyId === reply.id ? "Deleting..." : "Delete"}</button> : null}{canRespond ? <button type="button" onClick={() => openReportPanel({ type: "reply", replyId: reply.id })} disabled={hasReported} className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-xs font-black text-slate-700 hover:bg-slate-50 disabled:opacity-50"><ShieldAlert className="size-4" /> {hasReported ? "Reported" : "Report"}</button> : null}</div> : null}</div></div></article>;
  }
}
