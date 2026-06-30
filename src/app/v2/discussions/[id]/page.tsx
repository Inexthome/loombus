"use client";

import Link from "next/link";
import { type FormEvent, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import {
  Activity,
  ArrowLeft,
  BarChart3,
  Bookmark,
  CheckCircle2,
  ChevronDown,
  CircleHelp,
  Copy,
  ExternalLink,
  FileText,
  Heart,
  ListChecks,
  Loader2,
  MessageCircle,
  MoreHorizontal,
  Network,
  Reply,
  Share2,
  ShieldAlert,
  Sparkles,
} from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import {
  getDefaultShellPayload,
  V2ShellGateCard,
  V2ShellMobileNav,
  V2ShellTopNav,
  type ShellPayload,
} from "../../v2-shell-components";

type Discussion = {
  id: string;
  user_id: string;
  title: string;
  topic: string | null;
  body: string | null;
  created_at: string;
  discussion_type?: string | null;
  mode?: string | null;
  purpose_lane?: string | null;
};

type Profile = {
  id: string;
  full_name: string | null;
  username: string | null;
  avatar_url: string | null;
};

type ReplyRow = {
  id: string;
  user_id: string;
  body: string;
  created_at: string;
  quoted_excerpt?: string | null;
};

type TagRow = {
  tag: string | null;
};

type AttachmentRow = {
  id: string;
  public_url: string;
  file_name: string;
  mime_type: string | null;
  file_size_bytes: number | null;
  attachment_kind: string | null;
  sort_order?: number | null;
};

type AiToolKey = "summary" | "keyTakeaways" | "whatChanged" | "conversationMap";

type AiTool = {
  key: AiToolKey;
  label: string;
  endpoint: string;
  resultKey: string;
  Icon: typeof FileText;
};

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const AI_TOOLS: AiTool[] = [
  { key: "summary", label: "Summary", endpoint: "/api/discussions/summary", resultKey: "summary", Icon: FileText },
  { key: "keyTakeaways", label: "Key Takeaways", endpoint: "/api/discussions/key-takeaways", resultKey: "takeaways", Icon: ListChecks },
  { key: "whatChanged", label: "What Changed", endpoint: "/api/discussions/what-changed", resultKey: "whatChanged", Icon: Activity },
  { key: "conversationMap", label: "Conversation Map", endpoint: "/api/discussions/conversation-map", resultKey: "conversationMap", Icon: Network },
];

const REPORT_REASONS = [
  { value: "harassment", label: "Harassment or bullying" },
  { value: "hate", label: "Hate or abusive content" },
  { value: "threats", label: "Threats or safety concern" },
  { value: "spam", label: "Spam or scam" },
  { value: "sexual_content", label: "Sexual or inappropriate content" },
  { value: "other", label: "Something else" },
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

function formatCount(value: number | null | undefined) {
  return Math.max(0, value ?? 0).toLocaleString();
}

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

function getName(profile: Profile | null | undefined) {
  return profile?.full_name?.trim() || profile?.username?.trim() || "Loombus member";
}

function getUsername(profile: Profile | null | undefined) {
  return profile?.username?.trim() ? `@${profile.username}` : "Loombus member";
}

function getModeLabel(value: string | null | undefined) {
  if (value === "debate") return "Debate";
  if (value === "research_question") return "Research Question";
  if (value === "problem_solving") return "Problem Solving";
  return "Open Discussion";
}

function getDiscussionMode(discussion: Discussion | null) {
  return discussion?.discussion_type ?? discussion?.mode ?? null;
}

function getRouteParamId(param: string | string[] | undefined) {
  const rawValue = Array.isArray(param) ? param[0] : param;
  return decodeURIComponent(rawValue ?? "").trim();
}

function getBodySignals(body: string | null | undefined) {
  const sentences = (body ?? "")
    .split(/[.!?]\s+/)
    .map((sentence) => sentence.replace(/\s+/g, " ").trim())
    .filter(Boolean);

  return sentences.slice(0, 3);
}

function getInitial(profile: Profile | null | undefined) {
  return getName(profile).slice(0, 1).toUpperCase();
}

function getExcerpt(value: string) {
  const clean = value.replace(/\s+/g, " ").trim();
  return clean.length > 220 ? `${clean.slice(0, 217)}...` : clean;
}

function getAiText(value: unknown) {
  if (!value) return "No AI output was returned.";
  if (typeof value === "string") return value;
  if (typeof value === "object" && value && "summary" in value) {
    const summary = (value as { summary?: unknown }).summary;
    return typeof summary === "string" ? summary : JSON.stringify(value, null, 2);
  }
  return JSON.stringify(value, null, 2);
}

function Avatar({ profile, size = "md" }: { profile: Profile | null | undefined; size?: "sm" | "md" | "lg" }) {
  const sizeClass = size === "lg" ? "size-12" : size === "sm" ? "size-9" : "size-10";
  if (profile?.avatar_url) return <img src={profile.avatar_url} alt="" className={`${sizeClass} rounded-full object-cover`} />;
  return <span className={`grid ${sizeClass} place-items-center rounded-full bg-slate-100 font-black text-slate-600`}>{getInitial(profile)}</span>;
}

function ActionButton({ children, onClick, primary = false, disabled = false }: { children: React.ReactNode; onClick: () => void; primary?: boolean; disabled?: boolean }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-black transition disabled:cursor-not-allowed disabled:opacity-60 ${
        primary ? "bg-amber-300 text-slate-950 shadow-lg shadow-amber-900/10 hover:bg-amber-400" : "border border-slate-200 bg-white text-slate-700 hover:border-amber-200 hover:bg-amber-50 hover:text-amber-800"
      }`}
    >
      {children}
    </button>
  );
}

export default function V2DiscussionDetailPage() {
  const params = useParams<{ id?: string | string[] }>();
  const discussionId = getRouteParamId(params?.id);
  const [payload, setPayload] = useState<ShellPayload | null>(null);
  const [discussion, setDiscussion] = useState<Discussion | null>(null);
  const [authorProfile, setAuthorProfile] = useState<Profile | null>(null);
  const [replies, setReplies] = useState<ReplyRow[]>([]);
  const [replyProfiles, setReplyProfiles] = useState<Record<string, Profile>>({});
  const [tags, setTags] = useState<string[]>([]);
  const [attachments, setAttachments] = useState<AttachmentRow[]>([]);
  const [viewCount, setViewCount] = useState(0);
  const [savedCount, setSavedCount] = useState(0);
  const [isSaved, setIsSaved] = useState(false);
  const [savedBookmarkId, setSavedBookmarkId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [replyBody, setReplyBody] = useState("");
  const [referencedReply, setReferencedReply] = useState<ReplyRow | null>(null);
  const [postingReply, setPostingReply] = useState(false);
  const [savingBookmark, setSavingBookmark] = useState(false);
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);
  const [replyMenuId, setReplyMenuId] = useState<string | null>(null);
  const [reportPanelOpen, setReportPanelOpen] = useState(false);
  const [reportTarget, setReportTarget] = useState<{ type: "discussion" | "reply"; replyId?: string } | null>(null);
  const [reportReason, setReportReason] = useState("harassment");
  const [reporting, setReporting] = useState(false);
  const [activeAiTool, setActiveAiTool] = useState<AiToolKey | null>(null);
  const [aiWorkingTool, setAiWorkingTool] = useState<AiToolKey | null>(null);
  const [aiOutputs, setAiOutputs] = useState<Partial<Record<AiToolKey, string>>>({});
  const [aiMessage, setAiMessage] = useState("");

  async function getAccessToken() {
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token ?? "";
  }

  async function loadDiscussionDetail() {
    setLoading(true);
    setMessage("");

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      const currentUserId = sessionData.session?.user.id ?? null;

      const shellResponse = await fetch("/api/v2/shell", {
        headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
      });
      const nextPayload = (await shellResponse.json().catch(() => getDefaultShellPayload())) as ShellPayload;
      setPayload(nextPayload);

      if (!accessToken) return;
      if (!nextPayload.configured || !nextPayload.flags.v2_shell || nextPayload.version !== "v2") return;
      if (!discussionId) {
        setMessage("Discussion id is missing.");
        return;
      }
      if (!UUID_PATTERN.test(discussionId)) {
        setDiscussion(null);
        setMessage(`Invalid V2 discussion route id: "${discussionId}". Open a real discussion card from /v2/discussions.`);
        return;
      }

      const { data: discussionData, error: discussionError } = await supabase
        .from("discussions")
        .select("*")
        .eq("id", discussionId)
        .is("deleted_at", null)
        .maybeSingle();

      if (discussionError) {
        setDiscussion(null);
        setMessage(`This discussion could not be loaded in V2: ${discussionError.message}`);
        return;
      }

      if (!discussionData) {
        setDiscussion(null);
        setMessage("This discussion was not found. Use a real discussion id from the current /discussions route.");
        return;
      }

      const nextDiscussion = discussionData as Discussion;
      setDiscussion(nextDiscussion);

      const savedStateQuery = currentUserId
        ? supabase.from("bookmarks").select("id").eq("user_id", currentUserId).eq("discussion_id", discussionId).maybeSingle()
        : Promise.resolve({ data: null });

      const [profileResult, replyResult, tagResult, attachmentResult, viewResult, saveResult, savedStateResult] = await Promise.all([
        supabase.from("profiles").select("id, full_name, username, avatar_url").eq("id", nextDiscussion.user_id).maybeSingle(),
        supabase.from("replies").select("id, user_id, body, created_at, quoted_excerpt").eq("discussion_id", discussionId).is("deleted_at", null).order("created_at", { ascending: true }),
        supabase.from("discussion_tags").select("tag").eq("discussion_id", discussionId).order("tag", { ascending: true }),
        supabase.from("discussion_attachments").select("id, public_url, file_name, mime_type, file_size_bytes, attachment_kind, sort_order").eq("discussion_id", discussionId).order("sort_order", { ascending: true }).order("created_at", { ascending: true }),
        supabase.from("discussion_views").select("id", { count: "exact", head: true }).eq("discussion_id", discussionId),
        supabase.from("bookmarks").select("id", { count: "exact", head: true }).eq("discussion_id", discussionId),
        savedStateQuery,
      ]);

      setAuthorProfile((profileResult.data as Profile | null) ?? null);
      setReplies((replyResult.data ?? []) as ReplyRow[]);
      setTags(((tagResult.data ?? []) as TagRow[]).map((row) => row.tag).filter((tag): tag is string => Boolean(tag)));
      setAttachments((attachmentResult.data ?? []) as AttachmentRow[]);
      setViewCount(viewResult.count ?? 0);
      setSavedCount(saveResult.count ?? 0);
      setIsSaved(Boolean(savedStateResult.data));
      setSavedBookmarkId((savedStateResult.data as { id?: string } | null)?.id ?? null);

      const replyUserIds = [...new Set(((replyResult.data ?? []) as ReplyRow[]).map((reply) => reply.user_id).filter(Boolean))];
      if (replyUserIds.length > 0) {
        const { data: replyProfileRows } = await supabase
          .from("profiles")
          .select("id, full_name, username, avatar_url")
          .in("id", replyUserIds);

        setReplyProfiles(Object.fromEntries(((replyProfileRows ?? []) as Profile[]).map((profile) => [profile.id, profile])));
      } else {
        setReplyProfiles({});
      }
    } catch (error) {
      setPayload(getDefaultShellPayload());
      setMessage(error instanceof Error ? `Unable to load this discussion in V2: ${error.message}` : "Unable to load this discussion in V2.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadDiscussionDetail();

    const { data } = supabase.auth.onAuthStateChange(() => {
      void loadDiscussionDetail();
    });

    return () => {
      data.subscription.unsubscribe();
    };
  }, [discussionId]);

  useEffect(() => {
    if (!moreMenuOpen && !replyMenuId) return;

    function handleOutsideClick(event: MouseEvent) {
      const target = event.target as HTMLElement | null;
      if (target?.closest("[data-v2-action-menu]")) return;
      setMoreMenuOpen(false);
      setReplyMenuId(null);
    }

    function handleEscape(event: globalThis.KeyboardEvent) {
      if (event.key === "Escape") {
        setMoreMenuOpen(false);
        setReplyMenuId(null);
      }
    }

    document.addEventListener("mousedown", handleOutsideClick);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [moreMenuOpen, replyMenuId]);

  function scrollToReplyForm() {
    window.setTimeout(() => {
      document.getElementById("v2-reply-form")?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 0);
  }

  function startReply(reply?: ReplyRow) {
    setReferencedReply(reply ?? null);
    setMessage("");
    scrollToReplyForm();
  }

  async function handleReplySubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (postingReply || !discussion) return;

    const body = replyBody.trim();
    if (!body) {
      setMessage("Reply cannot be empty.");
      return;
    }

    setPostingReply(true);
    setMessage("");

    try {
      const accessToken = await getAccessToken();
      if (!accessToken) {
        window.location.href = `/login?next=${encodeURIComponent(`/v2/discussions/${discussion.id}`)}`;
        return;
      }

      const response = await fetch("/api/replies/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          discussionId: discussion.id,
          body,
          referencedReplyId: referencedReply?.id ?? undefined,
          pastedCharacterCount: 0,
        }),
      });
      const result = await response.json().catch(() => ({}));

      if (!response.ok) {
        setMessage(result.error ?? "Unable to post reply.");
        return;
      }

      const newReply = result.reply as ReplyRow | undefined;
      if (newReply) {
        setReplies((current) => [...current, newReply]);
        const { data: profileData } = await supabase
          .from("profiles")
          .select("id, full_name, username, avatar_url")
          .eq("id", newReply.user_id)
          .maybeSingle();

        if (profileData) {
          setReplyProfiles((current) => ({ ...current, [newReply.user_id]: profileData as Profile }));
        }
      }

      setReplyBody("");
      setReferencedReply(null);
      setMessage("Reply posted.");
    } catch {
      setMessage("Unable to post reply.");
    } finally {
      setPostingReply(false);
    }
  }

  async function handleToggleSave() {
    if (!discussion || savingBookmark) return;

    setSavingBookmark(true);
    setMessage("");
    setMoreMenuOpen(false);

    try {
      const accessToken = await getAccessToken();
      if (!accessToken) {
        window.location.href = `/login?next=${encodeURIComponent(`/v2/discussions/${discussion.id}`)}`;
        return;
      }

      if (isSaved && savedBookmarkId) {
        const response = await fetch("/api/bookmarks", {
          method: "DELETE",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({ bookmarkId: savedBookmarkId }),
        });
        const result = await response.json().catch(() => ({}));

        if (!response.ok) {
          setMessage(result.error ?? "Unable to remove saved discussion.");
          return;
        }

        setIsSaved(false);
        setSavedBookmarkId(null);
        setSavedCount((count) => Math.max(0, count - 1));
        setMessage("Saved discussion removed.");
        return;
      }

      const response = await fetch("/api/bookmarks", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ discussionId: discussion.id }),
      });
      const result = await response.json().catch(() => ({}));

      if (!response.ok) {
        setMessage(result.error ?? "Already saved or unable to save.");
        return;
      }

      setIsSaved(true);
      setSavedBookmarkId(result.bookmark?.id ?? null);
      setSavedCount((count) => count + 1);
      setMessage("Discussion saved.");
    } catch {
      setMessage("Unable to update saved discussion.");
    } finally {
      setSavingBookmark(false);
    }
  }

  async function handleCopyLink() {
    if (!discussion) return;
    const url = `${window.location.origin}/v2/discussions/${discussion.id}`;
    await navigator.clipboard.writeText(url).catch(() => undefined);
    setMoreMenuOpen(false);
    setReplyMenuId(null);
    setMessage("Link copied.");
  }

  function openReportPanel(target: { type: "discussion" | "reply"; replyId?: string }) {
    setReportTarget(target);
    setReportReason("harassment");
    setReportPanelOpen(true);
    setMoreMenuOpen(false);
    setReplyMenuId(null);
    window.setTimeout(() => {
      document.getElementById("v2-report-panel")?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 0);
  }

  async function handleSubmitReport() {
    if (!discussion || !reportTarget || reporting) return;

    setReporting(true);
    setMessage("");

    try {
      const accessToken = await getAccessToken();
      if (!accessToken) {
        window.location.href = `/login?next=${encodeURIComponent(`/v2/discussions/${discussion.id}`)}`;
        return;
      }

      const response = await fetch("/api/reports", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          targetType: reportTarget.type,
          discussionId: discussion.id,
          replyId: reportTarget.replyId,
          reason: reportReason,
        }),
      });
      const result = await response.json().catch(() => ({}));

      if (!response.ok) {
        setMessage(result.error ?? "Unable to submit report.");
        return;
      }

      setReportPanelOpen(false);
      setReportTarget(null);
      setMessage(reportTarget.type === "reply" ? "Reply reported." : "Discussion reported.");
    } catch {
      setMessage("Unable to submit report.");
    } finally {
      setReporting(false);
    }
  }

  async function handleGenerateAiTool(tool: AiTool) {
    if (!discussion || aiWorkingTool) return;

    setActiveAiTool(tool.key);
    setAiWorkingTool(tool.key);
    setAiMessage("");

    try {
      const accessToken = await getAccessToken();
      if (!accessToken) {
        window.location.href = `/login?next=${encodeURIComponent(`/v2/discussions/${discussion.id}`)}`;
        return;
      }

      const response = await fetch(tool.endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ discussionId: discussion.id }),
      });
      const result = await response.json().catch(() => ({}));

      if (!response.ok) {
        setAiMessage(result.error ?? `Unable to generate ${tool.label}.`);
        return;
      }

      setAiOutputs((current) => ({ ...current, [tool.key]: getAiText(result[tool.resultKey]) }));
      setAiMessage(result.cached ? `Showing cached ${tool.label}.` : `${tool.label} generated.`);
    } catch {
      setAiMessage(`Unable to generate ${tool.label}.`);
    } finally {
      setAiWorkingTool(null);
    }
  }

  if (loading) {
    return <V2ShellGateCard title="Loading V2 discussion" message="Loombus is loading this discussion inside the V2 shell." loading />;
  }

  if (!payload?.authenticated) {
    return <V2ShellGateCard title="Sign in required" message="Sign in first so Loombus can open the full discussion, replies, and AI tools." payload={payload} />;
  }

  if (!payload.configured || !payload.flags.v2_shell || payload.version !== "v2") {
    return <V2ShellGateCard title="V2 shell is not enabled" message="This account is not currently allowed through the v2_shell flag. Current users remain on the existing experience." payload={payload} />;
  }

  const bodySignals = getBodySignals(discussion?.body);
  const signalTotal = replies.length * 3 + savedCount * 5 + viewCount;
  const firstReplyAge = replies[0]?.created_at ? formatRelative(replies[0].created_at) : "No replies yet";
  const latestReplyAge = replies[replies.length - 1]?.created_at ? formatRelative(replies[replies.length - 1].created_at) : "No replies yet";
  const activeTool = AI_TOOLS.find((tool) => tool.key === activeAiTool);

  return (
    <main className="fixed inset-0 z-[80] min-h-screen overflow-y-auto bg-[#f7fbff] loombus-v2-page-bg text-slate-950">
      <V2ShellTopNav />
      <section className="mx-auto grid max-w-7xl gap-6 px-4 pb-28 pt-6 sm:px-6 lg:grid-cols-[minmax(0,1fr)_340px] lg:px-8">
        <div className="min-w-0 space-y-5">
          <Link href="/v2/discussions" className="inline-flex items-center gap-2 text-sm font-bold text-slate-500 transition hover:text-amber-800">
            <ArrowLeft className="size-4" />
            Back to Discussions
          </Link>

          {message && <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-bold text-amber-900">{message}</div>}

          {!discussion ? (
            <section className="rounded-[2rem] border border-slate-200 bg-white p-6 text-slate-600 shadow-sm">No discussion is available for this route.</section>
          ) : (
            <>
              <article className="rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <div className="mb-3 flex flex-wrap gap-2">
                      <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-bold text-amber-800 ring-1 ring-amber-200">{discussion.topic || "Discussion"}</span>
                      <span className="rounded-full bg-violet-50 px-3 py-1 text-xs font-bold text-violet-700">{getModeLabel(getDiscussionMode(discussion))}</span>
                      {discussion.purpose_lane && <span className="rounded-full bg-slate-50 px-3 py-1 text-xs font-bold text-slate-600">{discussion.purpose_lane}</span>}
                    </div>
                    <h1 className="text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">{discussion.title}</h1>
                  </div>
                  <div className="relative flex shrink-0 items-center gap-2" data-v2-action-menu>
                    <button type="button" onClick={() => setMessage("Follow is coming to the V2 discussion shell.")} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-black text-slate-700 transition hover:border-amber-200 hover:bg-amber-50 hover:text-amber-800">
                      <Sparkles className="size-4" />
                      Follow
                    </button>
                    <button type="button" onClick={() => setMoreMenuOpen((open) => !open)} aria-label="More actions" aria-expanded={moreMenuOpen} className="grid size-10 place-items-center rounded-xl border border-slate-200 text-slate-600 transition hover:border-amber-200 hover:bg-amber-50 hover:text-amber-800">
                      <MoreHorizontal className="size-5" />
                    </button>
                    {moreMenuOpen ? (
                      <div className="absolute right-0 top-12 z-20 w-64 rounded-2xl border border-slate-200 bg-white p-2 shadow-2xl shadow-slate-900/15">
                        <button type="button" onClick={() => void handleToggleSave()} className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm font-black text-slate-700 transition hover:bg-slate-50">
                          <Bookmark className="size-4" /> {isSaved ? "Remove from Saved" : "Save discussion"}
                        </button>
                        <button type="button" onClick={() => void handleCopyLink()} className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm font-black text-slate-700 transition hover:bg-slate-50">
                          <Copy className="size-4" /> Copy link
                        </button>
                        <button type="button" onClick={() => openReportPanel({ type: "discussion" })} className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm font-black text-slate-700 transition hover:bg-slate-50">
                          <ShieldAlert className="size-4" /> Report discussion
                        </button>
                        <Link href={`/discussions/${discussion.id}`} className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm font-black text-slate-700 transition hover:bg-slate-50">
                          <ExternalLink className="size-4" /> Open current page
                        </Link>
                      </div>
                    ) : null}
                  </div>
                </div>

                <div className="mt-5 flex flex-wrap items-center gap-3 border-b border-slate-100 pb-5 text-sm text-slate-500">
                  <Avatar profile={authorProfile} size="lg" />
                  <div>
                    <p className="font-black text-slate-950">{getName(authorProfile)}</p>
                    <p className="font-semibold text-slate-500">{getUsername(authorProfile)} · {formatDate(discussion.created_at)}</p>
                  </div>
                </div>

                <div className="mt-5 whitespace-pre-wrap text-base leading-8 text-slate-700">{discussion.body || "No body provided."}</div>

                {tags.length > 0 && (
                  <div className="mt-5 flex flex-wrap gap-2">
                    {tags.map((tag) => <span key={tag} className="rounded-full bg-slate-50 px-3 py-1 text-xs font-bold text-slate-600 ring-1 ring-slate-200">#{tag}</span>)}
                  </div>
                )}

                {attachments.length > 0 && (
                  <div className="mt-5 grid gap-3 sm:grid-cols-2">
                    {attachments.map((attachment) => (
                      <a key={attachment.id} href={attachment.public_url} target="_blank" rel="noreferrer" className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm font-bold text-slate-700 transition hover:border-amber-200 hover:bg-amber-50">
                        <span className="block truncate">{attachment.file_name}</span>
                        <span className="mt-1 block text-xs font-semibold text-slate-500">{attachment.attachment_kind || attachment.mime_type || "Attachment"} · {formatFileSize(attachment.file_size_bytes)}</span>
                      </a>
                    ))}
                  </div>
                )}

                <div className="mt-6 flex flex-wrap gap-3">
                  <ActionButton onClick={() => startReply()} primary><Reply className="size-4" /> Reply</ActionButton>
                  <ActionButton onClick={() => void handleToggleSave()} disabled={savingBookmark}><Bookmark className="size-4" /> {isSaved ? "Saved" : "Save"}</ActionButton>
                  <ActionButton onClick={() => void handleCopyLink()}><Share2 className="size-4" /> Share</ActionButton>
                </div>
              </article>

              {reportPanelOpen ? (
                <section id="v2-report-panel" className="rounded-[1.5rem] border border-amber-200 bg-amber-50 p-5 shadow-sm">
                  <h2 className="text-lg font-black text-slate-950">Report {reportTarget?.type === "reply" ? "reply" : "discussion"}</h2>
                  <p className="mt-1 text-sm font-semibold text-slate-600">Choose a reason so moderation can review the right issue.</p>
                  <select value={reportReason} onChange={(event) => setReportReason(event.target.value)} className="mt-4 w-full rounded-xl border border-amber-200 bg-white px-3 py-2 text-sm font-bold text-slate-700 outline-none focus:border-amber-400">
                    {REPORT_REASONS.map((reason) => <option key={reason.value} value={reason.value}>{reason.label}</option>)}
                  </select>
                  <div className="mt-4 flex gap-2">
                    <button type="button" onClick={() => void handleSubmitReport()} disabled={reporting} className="rounded-xl bg-amber-300 px-4 py-2 text-sm font-black text-slate-950 transition hover:bg-amber-400 disabled:opacity-60">
                      {reporting ? "Reporting..." : "Submit report"}
                    </button>
                    <button type="button" onClick={() => setReportPanelOpen(false)} disabled={reporting} className="rounded-xl border border-amber-200 bg-white px-4 py-2 text-sm font-black text-slate-600 transition hover:text-slate-950 disabled:opacity-60">
                      Cancel
                    </button>
                  </div>
                </section>
              ) : null}

              <section id="v2-reply-form" className="rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
                <h2 className="text-xl font-black text-slate-950">Add a reply</h2>
                <p className="mt-1 text-sm font-semibold text-slate-500">Keep it clear, useful, and directly connected to the discussion.</p>
                {referencedReply ? (
                  <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <p className="text-sm font-bold text-slate-600">Replying to: {getExcerpt(referencedReply.body)}</p>
                      <button type="button" onClick={() => setReferencedReply(null)} className="text-xs font-black text-slate-500 hover:text-slate-950">Clear</button>
                    </div>
                  </div>
                ) : null}
                <form onSubmit={handleReplySubmit} className="mt-4 space-y-3">
                  <textarea value={replyBody} onChange={(event) => setReplyBody(event.target.value)} rows={5} placeholder="Write your reply..." className="w-full resize-none rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm leading-6 text-slate-800 outline-none placeholder:text-slate-400 focus:border-amber-300 focus:ring-2 focus:ring-amber-100" />
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="text-xs font-semibold text-slate-500">Press the button to post. Moderation checks may apply.</p>
                    <button type="submit" disabled={postingReply || !replyBody.trim()} className="inline-flex items-center gap-2 rounded-xl bg-amber-300 px-5 py-2.5 text-sm font-black text-slate-950 transition hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-60">
                      {postingReply ? <Loader2 className="size-4 animate-spin" /> : <Reply className="size-4" />}
                      {postingReply ? "Posting..." : "Post reply"}
                    </button>
                  </div>
                </form>
              </section>

              <section className="overflow-hidden rounded-[1.75rem] border border-slate-200 bg-white shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-4 sm:px-6">
                  <h2 className="font-black text-slate-950">{formatCount(replies.length)} Replies</h2>
                  <button type="button" className="inline-flex items-center gap-2 text-sm font-black text-slate-600 transition hover:text-amber-800">
                    Newest
                    <ChevronDown className="size-4" />
                  </button>
                </div>

                <div className="divide-y divide-slate-100 px-5 sm:px-6">
                  {replies.length === 0 ? (
                    <div className="py-6 text-sm text-slate-600">No replies yet.</div>
                  ) : (
                    replies.map((reply, index) => {
                      const replyProfile = replyProfiles[reply.user_id] ?? null;
                      const menuOpen = replyMenuId === reply.id;
                      return (
                        <article key={reply.id} className="py-5">
                          <div className="flex items-start gap-4">
                            <Avatar profile={replyProfile} size="md" />
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-2 text-sm">
                                <span className="font-black text-slate-950">{getName(replyProfile)}</span>
                                <span className="font-semibold text-slate-500">{formatRelative(reply.created_at)}</span>
                                {index === 0 && <span className="rounded-full bg-violet-50 px-2 py-1 text-[11px] font-black text-violet-700">Top Contributor</span>}
                              </div>
                              {reply.quoted_excerpt && <div className="mt-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-500">{reply.quoted_excerpt}</div>}
                              <p className="mt-2 whitespace-pre-wrap text-sm leading-7 text-slate-700">{reply.body}</p>
                              <div className="mt-3 flex flex-wrap items-center gap-5 text-sm font-semibold text-slate-500">
                                <span className="inline-flex items-center gap-1.5"><Heart className="size-4" /> {Math.max(1, 56 - index * 9)}</span>
                                <button type="button" onClick={() => startReply(reply)} className="inline-flex items-center gap-1.5 transition hover:text-amber-800"><Reply className="size-4" /> Reply</button>
                                <div className="relative" data-v2-action-menu>
                                  <button type="button" onClick={() => setReplyMenuId((current) => current === reply.id ? null : reply.id)} className="transition hover:text-amber-800" aria-label="Reply actions" aria-expanded={menuOpen}><MoreHorizontal className="size-4" /></button>
                                  {menuOpen ? (
                                    <div className="absolute left-0 top-7 z-20 w-48 rounded-2xl border border-slate-200 bg-white p-2 shadow-2xl shadow-slate-900/15">
                                      <button type="button" onClick={() => startReply(reply)} className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-xs font-black text-slate-700 hover:bg-slate-50"><Reply className="size-4" /> Quote reply</button>
                                      <button type="button" onClick={() => void handleCopyLink()} className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-xs font-black text-slate-700 hover:bg-slate-50"><Copy className="size-4" /> Copy discussion link</button>
                                      <button type="button" onClick={() => openReportPanel({ type: "reply", replyId: reply.id })} className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-xs font-black text-slate-700 hover:bg-slate-50"><ShieldAlert className="size-4" /> Report reply</button>
                                    </div>
                                  ) : null}
                                </div>
                              </div>
                            </div>
                            <CheckCircle2 className="mt-1 size-5 shrink-0 text-emerald-600" />
                          </div>
                        </article>
                      );
                    })
                  )}
                </div>
              </section>
            </>
          )}
        </div>

        <aside className="space-y-4">
          <section className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-black uppercase tracking-[0.16em] text-slate-500">State of the discussion</h2>
              <CircleHelp className="size-4 text-slate-400" />
            </div>
            <div className="mt-4 space-y-5">
              <div>
                <h3 className="text-sm font-black text-slate-950">Key Takeaways</h3>
                <ul className="mt-3 space-y-2 text-sm leading-6 text-slate-600">
                  {(bodySignals.length > 0 ? bodySignals : ["This discussion is ready for focused replies.", "The thread needs more context from contributors.", "Signal will improve as replies accumulate."]).slice(0, 3).map((signal) => (
                    <li key={signal} className="flex gap-2"><span className="mt-2 size-2 shrink-0 rounded-full bg-amber-500" />{signal}</li>
                  ))}
                </ul>
              </div>
              <div className="border-t border-slate-100 pt-4">
                <h3 className="text-sm font-black text-slate-950">Open Questions</h3>
                <ul className="mt-3 space-y-2 text-sm leading-6 text-slate-600">
                  <li className="flex gap-2"><CircleHelp className="mt-1 size-4 shrink-0 text-violet-600" />What is the strongest unresolved point?</li>
                  <li className="flex gap-2"><CircleHelp className="mt-1 size-4 shrink-0 text-violet-600" />Where does the discussion need evidence?</li>
                  <li className="flex gap-2"><CircleHelp className="mt-1 size-4 shrink-0 text-violet-600" />What would move this conversation forward?</li>
                </ul>
              </div>
            </div>
          </section>

          <section className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-sm font-black uppercase tracking-[0.16em] text-slate-500">Signal Activity</h2>
              <BarChart3 className="size-5 text-slate-500" />
            </div>
            <div className="mt-4 space-y-3 text-sm font-semibold text-slate-600">
              <div className="flex items-center justify-between gap-3"><span>Total Signals</span><span className="font-black text-slate-950">{formatCompactCount(signalTotal)}</span></div>
              <div className="flex items-center justify-between gap-3"><span>New Signals (24h)</span><span className="font-black text-slate-950">{formatCount(Math.min(signalTotal, Math.max(0, replies.length * 2)))}</span></div>
              <div className="flex items-center justify-between gap-3"><span>Unique Contributors</span><span className="font-black text-slate-950">{formatCount(new Set(replies.map((reply) => reply.user_id)).size)}</span></div>
              <div className="flex items-center justify-between gap-3"><span>First Reply</span><span className="font-black text-slate-950">{firstReplyAge}</span></div>
              <div className="flex items-center justify-between gap-3"><span>Latest Reply</span><span className="font-black text-slate-950">{latestReplyAge}</span></div>
            </div>
          </section>

          <section className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-black uppercase tracking-[0.16em] text-slate-500">AI Tools</h2>
              <CircleHelp className="size-4 text-slate-400" />
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3">
              {AI_TOOLS.map((tool) => {
                const Icon = tool.Icon;
                const working = aiWorkingTool === tool.key;
                return (
                  <button key={tool.key} type="button" onClick={() => void handleGenerateAiTool(tool)} disabled={Boolean(aiWorkingTool)} className={`grid min-h-20 place-items-center rounded-2xl border px-3 py-4 text-center text-sm font-black transition disabled:cursor-not-allowed disabled:opacity-60 ${activeAiTool === tool.key ? "border-amber-300 bg-amber-50 text-amber-900" : "border-slate-200 bg-white text-slate-700 hover:border-amber-200 hover:bg-amber-50 hover:text-amber-800"}`}>
                    {working ? <Loader2 className="mb-2 size-5 animate-spin text-amber-700" /> : <Icon className="mb-2 size-5 text-amber-700" />}
                    {tool.label}
                  </button>
                );
              })}
            </div>
            {aiMessage ? <p className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-bold text-amber-900">{aiMessage}</p> : null}
            {activeTool ? (
              <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <h3 className="text-sm font-black text-slate-950">{activeTool.label}</h3>
                <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">{aiOutputs[activeTool.key] || "Select the tool to generate analysis for this discussion."}</p>
              </div>
            ) : null}
          </section>
        </aside>
      </section>
      <V2ShellMobileNav />
    </main>
  );
}
