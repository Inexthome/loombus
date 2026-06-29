"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import {
  Activity,
  ArrowLeft,
  BarChart3,
  Bell,
  Bookmark,
  CheckCircle2,
  ChevronDown,
  CircleHelp,
  FileText,
  Heart,
  Home,
  ListChecks,
  Loader2,
  Lock,
  MessageCircle,
  MoreHorizontal,
  Network,
  Plus,
  Reply,
  Search,
  Share2,
  Sparkles,
  Users,
} from "lucide-react";
import { supabase } from "@/lib/supabase/client";

type FeatureFlags = {
  v2_shell: boolean;
  v2_signal_brief: boolean;
  v2_rooms: boolean;
};

type ShellPayload = {
  version: "v1" | "v2";
  configured: boolean;
  authenticated: boolean;
  flags: FeatureFlags;
};

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

const DEFAULT_FLAGS: FeatureFlags = {
  v2_shell: false,
  v2_signal_brief: false,
  v2_rooms: false,
};

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const V2_NAV_ITEMS = [
  { label: "Home", href: "/v2", icon: Home },
  { label: "Discussions", href: "/v2/discussions", icon: MessageCircle, active: true },
  { label: "Create", href: "/v2/create", icon: Plus, primary: true },
  { label: "Rooms", href: "/v2/rooms", icon: Users },
  { label: "Messages", href: "/v2/messages", icon: Bell },
];

const AI_TOOL_CARDS = [
  { label: "Summary", icon: FileText },
  { label: "Key Takeaways", icon: ListChecks },
  { label: "What Changed", icon: Activity },
  { label: "Conversation Map", icon: Network },
];

function getDefaultShellPayload(): ShellPayload {
  return {
    version: "v1",
    configured: false,
    authenticated: false,
    flags: DEFAULT_FLAGS,
  };
}

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
  return profile?.username?.trim() ? `@${profile.username}` : "Loombus Lab";
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

function V2TopNav() {
  return (
    <header className="sticky top-0 z-30 border-b border-slate-200 bg-[#061942] loombus-v2-top-nav shadow-sm">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link href="/v2" className="flex items-center gap-3 font-bold">
          <img src="/assets/brand/loombus-mark-transparent.png" alt="" className="size-9 object-contain" />
          <span className="text-xl">Loombus</span>
        </Link>
        <nav className="hidden items-center gap-1 md:flex">
          {V2_NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.label}
                href={item.href}
                className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition ${
                  item.active
                    ? "border-b border-white text-white"
                    : item.primary
                      ? "border border-white/40 text-white hover:bg-white/10"
                      : "text-blue-100 hover:bg-white/10 hover:text-white"
                }`}
              >
                <Icon className="size-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="flex items-center gap-2">
          <Link href="/v2/search" aria-label="Search" className="grid size-10 place-items-center rounded-full text-blue-100 transition hover:bg-white/10 hover:text-white">
            <Search className="size-5" />
          </Link>
          <Link href="/v2/notifications" aria-label="Notifications" className="relative grid size-10 place-items-center rounded-full text-blue-100 transition hover:bg-white/10 hover:text-white">
            <Bell className="size-5" />
            <span className="absolute right-1 top-1 grid size-5 place-items-center rounded-full bg-blue-500 text-[10px] font-bold text-white">3</span>
          </Link>
        </div>
      </div>
    </header>
  );
}

function MobileBottomNav() {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 loombus-v2-bottom-nav px-3 pb-3 pt-2 shadow-2xl backdrop-blur md:hidden">
      <div className="mx-auto grid max-w-md grid-cols-5 gap-1 text-xs font-semibold text-slate-500">
        {V2_NAV_ITEMS.slice(0, 5).map((item) => {
          const Icon = item.icon;
          return (
            <Link key={item.label} href={item.href} className={`flex flex-col items-center gap-1 rounded-2xl py-2 ${item.active ? "text-blue-600" : "text-slate-500"}`}>
              <Icon className={`size-5 ${item.primary ? "rounded-full bg-blue-600 p-1 text-white" : ""}`} />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

function GateCard({ title, message, loading = false, payload }: { title: string; message: string; loading?: boolean; payload?: ShellPayload | null }) {
  return (
    <main className="fixed inset-0 z-[80] flex min-h-screen items-center justify-center bg-slate-950 px-4 py-10 text-white">
      <section className="w-full max-w-2xl rounded-[2rem] border border-white/10 bg-white/[0.04] p-6 shadow-2xl shadow-black/40 backdrop-blur-xl sm:p-8">
        <div className="mb-6 flex items-center gap-3">
          <div className="grid size-12 place-items-center rounded-2xl bg-blue-500/15 text-blue-200 ring-1 ring-blue-300/20">
            {loading ? <Loader2 className="size-5 animate-spin" /> : <Lock className="size-5" />}
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.24em] text-blue-200">Loombus V2</p>
            <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">{title}</h1>
          </div>
        </div>
        <p className="text-sm leading-6 text-slate-300 sm:text-base">{message}</p>
        {payload && (
          <div className="mt-5 flex flex-wrap gap-2 text-xs text-slate-300">
            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">v2_shell: {payload.flags.v2_shell ? "on" : "off"}</span>
          </div>
        )}
        <div className="mt-7 flex flex-wrap gap-3">
          <Link href="/v2/discussions" className="rounded-2xl bg-white px-4 py-2 text-sm font-bold text-slate-950 transition hover:bg-slate-200">
            Back to V2 Discussions
          </Link>
          <Link href="/discussions" className="rounded-2xl border border-white/10 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:border-white/30 hover:text-white">
            Open current discussions
          </Link>
        </div>
      </section>
    </main>
  );
}

function Avatar({ profile, size = "md" }: { profile: Profile | null | undefined; size?: "sm" | "md" | "lg" }) {
  const sizeClass = size === "lg" ? "size-12" : size === "sm" ? "size-9" : "size-10";
  if (profile?.avatar_url) return <img src={profile.avatar_url} alt="" className={`${sizeClass} rounded-full object-cover`} />;
  return <span className={`grid ${sizeClass} place-items-center rounded-full bg-slate-100 font-black text-slate-600`}>{getInitial(profile)}</span>;
}

function ActionButton({ children, href, primary = false }: { children: React.ReactNode; href: string; primary?: boolean }) {
  return (
    <Link
      href={href}
      className={`inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-black transition ${
        primary ? "bg-blue-600 text-white shadow-lg shadow-blue-600/20 hover:bg-blue-700" : "border border-slate-200 bg-white text-slate-700 hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"
      }`}
    >
      {children}
    </Link>
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
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

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
    loadDiscussionDetail();

    const { data } = supabase.auth.onAuthStateChange(() => {
      loadDiscussionDetail();
    });

    return () => {
      data.subscription.unsubscribe();
    };
  }, [discussionId]);

  if (loading) {
    return <GateCard title="Loading V2 discussion" message="Loombus is loading this discussion inside the V2 shell." loading />;
  }

  if (!payload?.authenticated) {
    return <GateCard title="Sign in required" message="The V2 discussion shell is internal-only right now. Sign in first so Loombus can verify access." payload={payload} />;
  }

  if (!payload.configured || !payload.flags.v2_shell || payload.version !== "v2") {
    return <GateCard title="V2 shell is not enabled" message="This account is not currently allowed through the v2_shell flag. Current users remain on the existing experience." payload={payload} />;
  }

  const bodySignals = getBodySignals(discussion?.body);
  const signalTotal = replies.length * 3 + savedCount * 5 + viewCount;
  const firstReplyAge = replies[0]?.created_at ? formatRelative(replies[0].created_at) : "No replies yet";
  const latestReplyAge = replies[replies.length - 1]?.created_at ? formatRelative(replies[replies.length - 1].created_at) : "No replies yet";

  return (
    <main className="fixed inset-0 z-[80] min-h-screen overflow-y-auto bg-[#f7fbff] loombus-v2-page-bg text-slate-950">
      <V2TopNav />
      <section className="mx-auto grid max-w-7xl gap-6 px-4 pb-28 pt-6 sm:px-6 lg:grid-cols-[minmax(0,1fr)_340px] lg:px-8">
        <div className="min-w-0 space-y-5">
          <Link href="/v2/discussions" className="inline-flex items-center gap-2 text-sm font-bold text-slate-500 transition hover:text-blue-700">
            <ArrowLeft className="size-4" />
            Back to Discussions
          </Link>

          {message && <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">{message}</div>}

          {!discussion ? (
            <section className="rounded-[2rem] border border-slate-200 bg-white p-6 text-slate-600 shadow-sm">No discussion is available for this route.</section>
          ) : (
            <>
              <article className="rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <div className="mb-3 flex flex-wrap gap-2">
                      <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700">{discussion.topic || "Discussion"}</span>
                      <span className="rounded-full bg-violet-50 px-3 py-1 text-xs font-bold text-violet-700">{getModeLabel(getDiscussionMode(discussion))}</span>
                      {discussion.purpose_lane && <span className="rounded-full bg-slate-50 px-3 py-1 text-xs font-bold text-slate-600">{discussion.purpose_lane}</span>}
                    </div>
                    <h1 className="text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">{discussion.title}</h1>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <button type="button" className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-black text-slate-700 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700">
                      <Sparkles className="size-4" />
                      Follow
                    </button>
                    <button type="button" aria-label="More actions" className="grid size-10 place-items-center rounded-xl border border-slate-200 text-slate-600 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700">
                      <MoreHorizontal className="size-5" />
                    </button>
                  </div>
                </div>

                <div className="mt-5 flex flex-wrap items-center gap-3 border-b border-slate-100 pb-5 text-sm text-slate-500">
                  <Avatar profile={authorProfile} size="lg" />
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-black text-slate-950">{getName(authorProfile)}</span>
                      <CheckCircle2 className="size-4 text-blue-600" />
                    </div>
                    <p className="text-xs font-semibold text-slate-500">{getUsername(authorProfile)} · {formatDate(discussion.created_at)}</p>
                  </div>
                  <span className="ml-auto text-sm font-semibold text-slate-500">{formatCount(viewCount)} views</span>
                </div>

                <div className="mt-5 whitespace-pre-wrap text-base leading-8 text-slate-800">{discussion.body || "No discussion body available."}</div>

                {tags.length > 0 && (
                  <div className="mt-5 flex flex-wrap gap-2">
                    {tags.map((tag) => (
                      <span key={tag} className="rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700">#{tag}</span>
                    ))}
                  </div>
                )}

                {attachments.length > 0 && (
                  <section className="mt-5 rounded-3xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">Supporting context</p>
                    <div className="mt-3 grid gap-3 sm:grid-cols-2">
                      {attachments.map((attachment) => (
                        <a key={attachment.id} href={attachment.public_url} target="_blank" rel="noreferrer" className="rounded-2xl border border-slate-200 bg-white p-3 text-sm font-semibold text-slate-700 transition hover:border-blue-200 hover:bg-blue-50">
                          <span className="block text-xs font-black uppercase tracking-[0.16em] text-blue-600">{attachment.attachment_kind || "Attachment"}</span>
                          <span className="mt-1 block truncate">{attachment.file_name}</span>
                          <span className="mt-1 block text-xs text-slate-400">{formatFileSize(attachment.file_size_bytes)}</span>
                        </a>
                      ))}
                    </div>
                  </section>
                )}

                <div className="mt-6 flex flex-wrap gap-3">
                  <ActionButton href={`/discussions/${discussion.id}`} primary><Reply className="size-4" /> Reply</ActionButton>
                  <ActionButton href={`/discussions/${discussion.id}`}><Bookmark className="size-4" /> {isSaved ? "Saved" : "Save"}</ActionButton>
                  <ActionButton href={`/discussions/${discussion.id}`}><Share2 className="size-4" /> Share</ActionButton>
                </div>
              </article>

              <section className="overflow-hidden rounded-[1.75rem] border border-slate-200 bg-white shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-4 sm:px-6">
                  <h2 className="font-black text-slate-950">{formatCount(replies.length)} Replies</h2>
                  <button type="button" className="inline-flex items-center gap-2 text-sm font-black text-slate-600 transition hover:text-blue-700">
                    Newest
                    <ChevronDown className="size-4" />
                  </button>
                </div>

                <div className="divide-y divide-slate-100 px-5 sm:px-6">
                  {replies.length === 0 ? (
                    <div className="py-6 text-sm text-slate-600">No replies yet.</div>
                  ) : (
                    replies.slice(0, 6).map((reply, index) => {
                      const replyProfile = replyProfiles[reply.user_id] ?? null;
                      return (
                        <article key={reply.id} className={`py-5 ${index === 2 ? "rounded-2xl bg-blue-50/70 px-4" : ""}`}>
                          <div className="flex items-start gap-4">
                            <Avatar profile={replyProfile} size="md" />
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-2 text-sm">
                                <span className="font-black text-slate-950">{getName(replyProfile)}</span>
                                <span className="font-semibold text-slate-500">{formatRelative(reply.created_at)}</span>
                                {index === 0 && <span className="rounded-full bg-violet-50 px-2 py-1 text-[11px] font-black text-violet-700">Top Contributor</span>}
                                {index === 2 && <span className="ml-auto rounded-full bg-blue-100 px-2 py-1 text-[11px] font-black text-blue-700">Highlighted Reply</span>}
                              </div>
                              {reply.quoted_excerpt && <div className="mt-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-500">{reply.quoted_excerpt}</div>}
                              <p className="mt-2 whitespace-pre-wrap text-sm leading-7 text-slate-700">{reply.body}</p>
                              <div className="mt-3 flex flex-wrap items-center gap-5 text-sm font-semibold text-slate-500">
                                <span className="inline-flex items-center gap-1.5"><Heart className="size-4" /> {Math.max(1, 56 - index * 9)}</span>
                                <Link href={`/discussions/${discussion.id}`} className="inline-flex items-center gap-1.5 transition hover:text-blue-700"><Reply className="size-4" /> Reply</Link>
                                <button type="button" className="transition hover:text-blue-700"><MoreHorizontal className="size-4" /></button>
                              </div>
                            </div>
                            <CheckCircle2 className="mt-1 size-5 shrink-0 text-blue-600" />
                          </div>
                        </article>
                      );
                    })
                  )}
                </div>
                {replies.length > 6 && (
                  <div className="border-t border-slate-100 px-5 py-4 text-center sm:px-6">
                    <Link href={`/discussions/${discussion.id}`} className="inline-flex items-center gap-2 text-sm font-black text-blue-700 transition hover:text-blue-900">
                      Load {formatCount(replies.length - 6)} more replies
                      <ChevronDown className="size-4" />
                    </Link>
                  </div>
                )}
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
                    <li key={signal} className="flex gap-2"><span className="mt-2 size-2 shrink-0 rounded-full bg-blue-600" />{signal}</li>
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
              <div className="border-t border-slate-100 pt-4">
                <h3 className="text-sm font-black text-slate-950">Areas of Agreement</h3>
                <ul className="mt-3 space-y-2 text-sm leading-6 text-slate-600">
                  <li className="flex gap-2"><CheckCircle2 className="mt-1 size-4 shrink-0 text-emerald-600" />Context improves discussion quality.</li>
                  <li className="flex gap-2"><CheckCircle2 className="mt-1 size-4 shrink-0 text-emerald-600" />Thoughtful replies add signal.</li>
                  <li className="flex gap-2"><CheckCircle2 className="mt-1 size-4 shrink-0 text-emerald-600" />Open questions should stay visible.</li>
                </ul>
              </div>
            </div>
          </section>

          <section className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-sm font-black uppercase tracking-[0.16em] text-slate-500">Signal Activity</h2>
              <BarChart3 className="size-5 text-blue-600" />
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
              {AI_TOOL_CARDS.map((tool) => {
                const Icon = tool.icon;
                return (
                  <Link key={tool.label} href={discussion ? `/discussions/${discussion.id}` : "/discussions"} className="grid min-h-20 place-items-center rounded-2xl border border-slate-200 bg-white px-3 py-4 text-center text-sm font-black text-slate-700 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700">
                    <Icon className="mb-2 size-5 text-blue-600" />
                    {tool.label}
                  </Link>
                );
              })}
            </div>
          </section>
        </aside>
      </section>
      <MobileBottomNav />
    </main>
  );
}
