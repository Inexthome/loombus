"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  BadgeCheck,
  Bell,
  Bookmark,
  BriefcaseBusiness,
  Building2,
  ChevronRight,
  Eye,
  FileText,
  FlaskConical,
  FolderOpen,
  Home,
  Landmark,
  Loader2,
  Lock,
  MapPin,
  MessageCircle,
  Plus,
  Search,
  SlidersHorizontal,
  Sparkles,
  TrendingUp,
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
  purpose_lane?: string | null;
};

type Profile = {
  id: string;
  full_name: string | null;
  username: string | null;
  avatar_url: string | null;
};

type AttachmentRow = {
  discussion_id: string;
  public_url: string | null;
  file_name: string | null;
  mime_type: string | null;
  attachment_kind: string | null;
  sort_order?: number | null;
};

type V2DiscussionCard = Discussion & {
  authorName?: string | null;
  authorUsername?: string | null;
  authorAvatarUrl?: string | null;
  replyCount?: number;
  viewCount?: number;
  savedCount?: number;
  isStickied?: boolean;
  attachmentUrl?: string | null;
  attachmentName?: string | null;
  attachmentMimeType?: string | null;
  attachmentKind?: string | null;
};

const DEFAULT_FLAGS: FeatureFlags = {
  v2_shell: false,
  v2_signal_brief: false,
  v2_rooms: false,
};

const V2_NAV_ITEMS = [
  { label: "Home", href: "/v2", icon: Home },
  { label: "Discussions", href: "/v2/discussions", icon: MessageCircle, active: true },
  { label: "Create", href: "/v2/create", icon: Plus, primary: true },
  { label: "Rooms", href: "/v2/rooms", icon: Users },
  { label: "Messages", href: "/v2/messages", icon: Bell },
];

const TOPIC_FILTERS = ["All", "Following", "Research Questions", "Debates", "Problem Solving", "Saved", "Trending"];
const BROWSE_TOPICS = ["Technology", "Society", "Governance", "Science", "Local", "Business"];

function getDefaultShellPayload(): ShellPayload {
  return {
    version: "v1",
    configured: false,
    authenticated: false,
    flags: DEFAULT_FLAGS,
  };
}

function getDiscussionAge(value: string) {
  const createdAt = new Date(value).getTime();
  if (!Number.isFinite(createdAt)) return "Recently";

  const diffMinutes = Math.floor((Date.now() - createdAt) / 60000);
  if (diffMinutes < 1) return "Just now";
  if (diffMinutes < 60) return `${diffMinutes}m ago`;

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;

  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric" }).format(new Date(value));
}

function getAuthorLabel(discussion: V2DiscussionCard) {
  return discussion.authorName?.trim() || discussion.authorUsername?.trim() || "Loombus member";
}

function getAuthorSubLabel(discussion: V2DiscussionCard) {
  return discussion.authorUsername?.trim() ? `@${discussion.authorUsername}` : "Loombus Lab";
}

function getDiscussionPreview(body: string | null) {
  const cleanBody = (body ?? "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  if (!cleanBody) return "Open this discussion to review the full signal.";
  return cleanBody.length > 150 ? `${cleanBody.slice(0, 150)}...` : cleanBody;
}

function formatCompactCount(value: number | undefined) {
  const count = Math.max(0, value ?? 0);
  if (count >= 1000) return `${(count / 1000).toFixed(count >= 10000 ? 0 : 1)}k`;
  return count.toLocaleString();
}

function getSignalScore(discussion: V2DiscussionCard) {
  return (discussion.replyCount ?? 0) * 3 + (discussion.savedCount ?? 0) * 5 + (discussion.viewCount ?? 0);
}

function getModeLabel(value: string | null | undefined) {
  if (value === "debate") return "Debate";
  if (value === "research_question") return "Research Question";
  if (value === "problem_solving") return "Problem Solving";
  return "Discussion";
}

function getModeClass(value: string | null | undefined) {
  if (value === "debate") return "bg-rose-50 text-rose-700";
  if (value === "research_question") return "bg-violet-50 text-violet-700";
  if (value === "problem_solving") return "bg-orange-50 text-orange-700";
  return "bg-emerald-50 text-emerald-700";
}

function isImageAttachment(value: string | null | undefined) {
  return value?.startsWith("image/") ?? false;
}

function isVideoAttachment(value: string | null | undefined) {
  return value?.startsWith("video/") ?? false;
}

function getAttachmentLabel(discussion: V2DiscussionCard) {
  if (isVideoAttachment(discussion.attachmentMimeType)) return "Video context";
  if (isImageAttachment(discussion.attachmentMimeType)) return "Image context";
  return discussion.attachmentKind || "Supporting file";
}

function getTopicIcon(topic: string) {
  if (topic === "Society") return Users;
  if (topic === "Governance") return Landmark;
  if (topic === "Science") return FlaskConical;
  if (topic === "Local") return MapPin;
  if (topic === "Business") return BriefcaseBusiness;
  return Sparkles;
}

function getPreviewGradient(discussion: V2DiscussionCard) {
  const topic = (discussion.topic || "").toLowerCase();
  if (topic.includes("science") || topic.includes("climate")) return "from-emerald-500 via-lime-400 to-sky-400";
  if (topic.includes("society") || topic.includes("ai")) return "from-purple-700 via-fuchsia-500 to-blue-500";
  if (topic.includes("governance")) return "from-amber-500 via-orange-400 to-blue-500";
  if (topic.includes("local")) return "from-sky-600 via-cyan-400 to-emerald-400";
  return "from-blue-950 via-blue-700 to-cyan-400";
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
            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">v2_rooms: {payload.flags.v2_rooms ? "on" : "off"}</span>
          </div>
        )}
        <div className="mt-7 flex flex-wrap gap-3">
          <Link href="/discussions" className="rounded-2xl bg-white px-4 py-2 text-sm font-bold text-slate-950 transition hover:bg-slate-200">
            Open V1 Discussions
          </Link>
          <Link href="/v2" className="rounded-2xl border border-white/10 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:border-white/30 hover:text-white">
            Back to V2 Home
          </Link>
        </div>
      </section>
    </main>
  );
}

function V2TopNav() {
  return (
    <header className="sticky top-0 z-30 border-b border-slate-200 bg-[#061942] text-white shadow-sm">
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
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 px-3 pb-3 pt-2 shadow-2xl backdrop-blur md:hidden">
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

function DiscussionVisual({ discussion }: { discussion: V2DiscussionCard }) {
  if (discussion.attachmentUrl && isImageAttachment(discussion.attachmentMimeType)) {
    return (
      <Link href={`/v2/discussions/${discussion.id}`} className="block overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 transition hover:border-blue-200">
        <img src={discussion.attachmentUrl} alt="" className="aspect-square w-full object-cover" />
      </Link>
    );
  }

  if (discussion.attachmentUrl) {
    return (
      <Link href={`/v2/discussions/${discussion.id}`} className="grid aspect-square place-items-center rounded-2xl border border-slate-200 bg-slate-50 p-4 text-center text-slate-700 transition hover:border-blue-200 hover:bg-blue-50">
        <div>
          <FileText className="mx-auto size-8 text-blue-600" />
          <p className="mt-3 text-sm font-black">{getAttachmentLabel(discussion)}</p>
          <p className="mt-1 line-clamp-2 text-xs text-slate-500">{discussion.attachmentName || "Attached context"}</p>
        </div>
      </Link>
    );
  }

  return (
    <Link href={`/v2/discussions/${discussion.id}`} className={`grid aspect-square place-items-center overflow-hidden rounded-2xl bg-gradient-to-br ${getPreviewGradient(discussion)} p-4 text-white shadow-inner transition hover:scale-[1.01]`}>
      <div className="relative grid size-full place-items-center rounded-xl border border-white/20 bg-white/10">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.35),transparent_42%)]" />
        <Sparkles className="relative size-10 drop-shadow" />
      </div>
    </Link>
  );
}

function DiscussionCard({
  discussion,
  onAddSticky,
  addingSticky,
}: {
  discussion: V2DiscussionCard;
  onAddSticky: (discussionId: string) => void;
  addingSticky: boolean;
}) {
  const signalScore = getSignalScore(discussion);

  return (
    <article className="grid gap-4 rounded-[1.5rem] border border-slate-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-md sm:grid-cols-[150px_minmax(0,1fr)]">
      <DiscussionVisual discussion={discussion} />
      <div className="min-w-0">
        <Link href={`/v2/discussions/${discussion.id}`} className="block rounded-2xl transition hover:text-blue-700">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700">{discussion.topic || "Discussion"}</span>
            <span className={`rounded-full px-3 py-1 text-xs font-bold ${getModeClass(discussion.discussion_type)}`}>{getModeLabel(discussion.discussion_type)}</span>
            {discussion.purpose_lane && <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">{discussion.purpose_lane}</span>}
          </div>
          <h2 className="line-clamp-2 text-xl font-black tracking-tight text-slate-950 sm:text-2xl">{discussion.title}</h2>
          <p className="mt-2 line-clamp-2 text-sm leading-6 text-slate-600">{getDiscussionPreview(discussion.body)}</p>
        </Link>

        <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-slate-500">
          {discussion.authorAvatarUrl ? (
            <img src={discussion.authorAvatarUrl} alt="" className="size-8 rounded-full object-cover" />
          ) : (
            <span className="grid size-8 place-items-center rounded-full bg-slate-100 font-bold text-slate-600">{getAuthorLabel(discussion).slice(0, 1)}</span>
          )}
          <span className="min-w-0">
            <span className="flex items-center gap-1 font-black text-slate-800">
              {getAuthorLabel(discussion)}
              <BadgeCheck className="size-3.5 text-blue-600" />
            </span>
            <span className="block truncate font-semibold text-slate-500">{getAuthorSubLabel(discussion)} · {getDiscussionAge(discussion.created_at)}</span>
          </span>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-4 border-t border-slate-100 pt-3 text-sm font-bold text-slate-500">
          <span aria-label={`${discussion.replyCount ?? 0} replies`} title={`${discussion.replyCount ?? 0} replies`} className="inline-flex items-center gap-1.5">
            <MessageCircle className="size-4 text-slate-500" />
            <span>{formatCompactCount(discussion.replyCount)}</span>
          </span>
          <span aria-label={`${discussion.viewCount ?? 0} views`} title={`${discussion.viewCount ?? 0} views`} className="inline-flex items-center gap-1.5">
            <Eye className="size-4 text-slate-500" />
            <span>{formatCompactCount(discussion.viewCount)}</span>
          </span>
          <span aria-label={`${discussion.savedCount ?? 0} saves`} title={`${discussion.savedCount ?? 0} saves`} className="inline-flex items-center gap-1.5">
            <Bookmark className="size-4 text-slate-500" />
            <span>{formatCompactCount(discussion.savedCount)}</span>
          </span>
          <button
            type="button"
            onClick={() => onAddSticky(discussion.id)}
            disabled={addingSticky || discussion.isStickied}
            className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-black transition ${
              discussion.isStickied
                ? "border-blue-200 bg-blue-50 text-blue-700"
                : "border-slate-200 bg-white text-slate-600 hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"
            } disabled:cursor-default disabled:opacity-80`}
            aria-label={discussion.isStickied ? "Discussion added to Stickies" : "Add discussion to Stickies"}
            title={discussion.isStickied ? "Added to Stickies" : "Add to Stickies"}
          >
            <span aria-hidden="true">📌</span>
            <span>{addingSticky ? "Adding" : discussion.isStickied ? "Added" : "Add"}</span>
          </button>
          <span className="ml-auto rounded-full border border-orange-200 bg-orange-50 px-3 py-1.5 text-xs font-black text-orange-800" aria-label={`Signal score ${signalScore}`} title={`Signal score ${signalScore}`}>
            Signal {signalScore}
          </span>
        </div>
      </div>
    </article>
  );
}

export default function V2DiscussionsPage() {
  const [payload, setPayload] = useState<ShellPayload | null>(null);
  const [discussions, setDiscussions] = useState<V2DiscussionCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [discussionLoading, setDiscussionLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [query, setQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState("All");
  const [addingStickyId, setAddingStickyId] = useState<string | null>(null);

  const filteredDiscussions = useMemo(() => {
    const cleanQuery = query.trim().toLowerCase();
    return discussions.filter((discussion) => {
      const matchesQuery = !cleanQuery || [discussion.title, discussion.topic, discussion.body, discussion.authorName, discussion.authorUsername]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(cleanQuery);

      const matchesFilter =
        activeFilter === "All" ||
        (activeFilter === "Research Questions" && discussion.discussion_type === "research_question") ||
        (activeFilter === "Debates" && discussion.discussion_type === "debate") ||
        (activeFilter === "Problem Solving" && discussion.discussion_type === "problem_solving") ||
        activeFilter === "Trending" ||
        activeFilter === "Following" ||
        (activeFilter === "Saved" && (discussion.savedCount ?? 0) > 0);

      return matchesQuery && matchesFilter;
    });
  }, [activeFilter, discussions, query]);

  const trendingTopics = useMemo(() => {
    const counts = new Map<string, number>();
    for (const discussion of discussions) {
      const topic = discussion.topic || "Discussion";
      counts.set(topic, (counts.get(topic) ?? 0) + Math.max(1, getSignalScore(discussion)));
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
  }, [discussions]);

  const topContributors = useMemo(() => {
    const counts = new Map<string, { count: number; avatarUrl: string | null; username: string | null }>();
    for (const discussion of discussions) {
      const author = getAuthorLabel(discussion);
      const current = counts.get(author) ?? { count: 0, avatarUrl: discussion.authorAvatarUrl ?? null, username: discussion.authorUsername ?? null };
      counts.set(author, { ...current, count: current.count + Math.max(1, getSignalScore(discussion)) });
    }
    return [...counts.entries()].sort((a, b) => b[1].count - a[1].count).slice(0, 5);
  }, [discussions]);

  async function loadDiscussions() {
    setDiscussionLoading(true);
    setMessage("");

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const currentUserId = sessionData.session?.user.id ?? null;
      const { data: discussionRows, error } = await supabase
        .from("discussions")
        .select("id, title, topic, body, created_at, user_id, discussion_type, purpose_lane")
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .limit(30);

      if (error) {
        setMessage("Unable to load the V2 discussion shell from live discussions. V1 remains available.");
        setDiscussions([]);
        return;
      }

      const baseRows = (discussionRows ?? []) as Discussion[];
      const discussionIds = baseRows.map((discussion) => discussion.id);
      const authorIds = [...new Set(baseRows.map((discussion) => discussion.user_id).filter(Boolean))];

      let authorMap: Record<string, Profile> = {};
      let replyCounts: Record<string, number> = {};
      let viewCounts: Record<string, number> = {};
      let savedCounts: Record<string, number> = {};
      let attachmentMap: Record<string, AttachmentRow> = {};
      let stickiedDiscussionIds = new Set<string>();

      if (authorIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, full_name, username, avatar_url")
          .in("id", authorIds);

        authorMap = Object.fromEntries(((profiles ?? []) as Profile[]).map((profile) => [profile.id, profile]));
      }

      if (discussionIds.length > 0) {
        const [{ data: replies }, { data: views }, { data: bookmarks }, { data: attachments }] = await Promise.all([
          supabase.from("replies").select("discussion_id").in("discussion_id", discussionIds).is("deleted_at", null),
          supabase.from("discussion_views").select("discussion_id").in("discussion_id", discussionIds),
          supabase.from("bookmarks").select("discussion_id").in("discussion_id", discussionIds),
          supabase.from("discussion_attachments").select("discussion_id, public_url, file_name, mime_type, attachment_kind, sort_order").in("discussion_id", discussionIds).order("sort_order", { ascending: true }),
        ]);

        for (const reply of replies ?? []) replyCounts[reply.discussion_id] = (replyCounts[reply.discussion_id] ?? 0) + 1;
        for (const view of views ?? []) viewCounts[view.discussion_id] = (viewCounts[view.discussion_id] ?? 0) + 1;
        for (const bookmark of bookmarks ?? []) savedCounts[bookmark.discussion_id] = (savedCounts[bookmark.discussion_id] ?? 0) + 1;
        for (const attachment of (attachments ?? []) as AttachmentRow[]) {
          if (attachment.discussion_id && attachment.public_url && !attachmentMap[attachment.discussion_id]) {
            attachmentMap[attachment.discussion_id] = attachment;
          }
        }
      }

      if (currentUserId) {
        const { data: stickySessionData } = await supabase.auth.getSession();
        const accessToken = stickySessionData.session?.access_token;
        if (accessToken) {
          const response = await fetch("/api/stickies", {
            headers: { Authorization: `Bearer ${accessToken}` },
            cache: "no-store",
          });
          const result = await response.json().catch(() => ({}));
          if (response.ok) {
            stickiedDiscussionIds = new Set(
              (result.stickies ?? [])
                .map((sticky: { source_key?: string }) => sticky.source_key)
                .filter((sourceKey: unknown): sourceKey is string => typeof sourceKey === "string")
            );
          }
        }
      }

      setDiscussions(
        baseRows.map((discussion) => ({
          ...discussion,
          authorName: authorMap[discussion.user_id]?.full_name ?? null,
          authorUsername: authorMap[discussion.user_id]?.username ?? null,
          authorAvatarUrl: authorMap[discussion.user_id]?.avatar_url ?? null,
          replyCount: replyCounts[discussion.id] ?? 0,
          viewCount: viewCounts[discussion.id] ?? 0,
          savedCount: savedCounts[discussion.id] ?? 0,
          isStickied: stickiedDiscussionIds.has(discussion.id),
          attachmentUrl: attachmentMap[discussion.id]?.public_url ?? null,
          attachmentName: attachmentMap[discussion.id]?.file_name ?? null,
          attachmentMimeType: attachmentMap[discussion.id]?.mime_type ?? null,
          attachmentKind: attachmentMap[discussion.id]?.attachment_kind ?? null,
        }))
      );
    } catch {
      setMessage("Unable to load the V2 discussion shell safely. V1 remains available.");
      setDiscussions([]);
    } finally {
      setDiscussionLoading(false);
    }
  }

  async function addDiscussionToStickies(discussionId: string) {
    if (addingStickyId) return;
    setAddingStickyId(discussionId);
    setMessage("");

    try {
      const { data } = await supabase.auth.getSession();
      const accessToken = data.session?.access_token;
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
        body: JSON.stringify({ discussionId }),
      });
      const result = await response.json().catch(() => ({}));

      if (!response.ok) {
        setMessage(result.error ?? "Unable to add this discussion to Stickies.");
        return;
      }

      setDiscussions((current) => current.map((discussion) => discussion.id === discussionId ? { ...discussion, isStickied: true } : discussion));
      setMessage("Discussion added to Stickies.");
    } finally {
      setAddingStickyId(null);
    }
  }

  async function loadShell() {
    setLoading(true);
    setMessage("");

    try {
      const { data } = await supabase.auth.getSession();
      const accessToken = data.session?.access_token;
      const response = await fetch("/api/v2/shell", {
        headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
      });
      const nextPayload = (await response.json().catch(() => getDefaultShellPayload())) as ShellPayload;

      setPayload(nextPayload);

      if (accessToken && nextPayload.configured && nextPayload.flags.v2_shell && nextPayload.version === "v2") {
        await loadDiscussions();
      }
    } catch {
      setPayload(getDefaultShellPayload());
      setMessage("Unable to verify V2 shell access. Current Loombus remains on V1.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadShell();
    const { data } = supabase.auth.onAuthStateChange(() => {
      loadShell();
    });
    return () => data.subscription.unsubscribe();
  }, []);

  if (loading) return <GateCard title="Checking V2 access" message="Loombus is verifying access before loading the screenshot-style discussion shell." loading />;
  if (!payload?.authenticated) return <GateCard title="Sign in required" message="The V2 shell is internal-only right now. Sign in first so Loombus can check your v2_shell access." payload={payload} />;
  if (!payload.configured || !payload.flags.v2_shell || payload.version !== "v2") {
    return <GateCard title="V2 shell is not enabled" message="This account is not currently allowed through the v2_shell flag. Public users remain on V1." payload={payload} />;
  }

  const fallbackTrendingTopics = trendingTopics.length > 0 ? trendingTopics : [["Discussions", 0] as [string, number]];
  const fallbackTopContributors = topContributors.length > 0 ? topContributors : [["Loombus member", { count: 0, avatarUrl: null, username: null }] as [string, { count: number; avatarUrl: string | null; username: string | null }]];

  return (
    <main className="fixed inset-0 z-[80] min-h-screen overflow-y-auto bg-[#f7fbff] text-slate-950">
      <V2TopNav />
      <section className="mx-auto grid max-w-7xl gap-6 px-4 pb-28 pt-6 sm:px-6 lg:grid-cols-[210px_minmax(0,1fr)_300px] lg:px-8">
        <aside className="hidden lg:block">
          <div className="sticky top-24 rounded-[1.5rem] border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-500">Browse topics</p>
            <div className="mt-4 space-y-2">
              {BROWSE_TOPICS.map((topic, index) => {
                const Icon = getTopicIcon(topic);
                return (
                  <button
                    key={topic}
                    type="button"
                    onClick={() => setQuery(topic)}
                    className={`flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left text-sm font-bold transition ${index === 0 ? "bg-blue-50 text-blue-700" : "text-slate-600 hover:bg-blue-50 hover:text-blue-700"}`}
                  >
                    <span className="grid size-8 place-items-center rounded-xl bg-slate-100 text-slate-500"><Icon className="size-4" /></span>
                    {topic}
                  </button>
                );
              })}
            </div>
            <Link href="/v2/discussions" className="mt-4 flex items-center justify-between border-t border-slate-100 pt-4 text-sm font-black text-blue-700">
              View all topics
              <ChevronRight className="size-4" />
            </Link>
          </div>
        </aside>

        <section className="min-w-0">
          <div className="mb-6">
            <h1 className="text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">Discussions</h1>
            <p className="mt-2 text-sm text-slate-600">Explore signal-rich conversations. Browse by topic, mode, and relevance.</p>
          </div>

          <div className="mb-4 flex gap-3">
            <div className="flex min-w-0 flex-1 items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
              <Search className="size-5 text-slate-400" />
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search discussions, topics, and contributors" className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-slate-400" />
            </div>
            <button type="button" className="grid size-12 place-items-center rounded-2xl border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700">
              <SlidersHorizontal className="size-5" />
            </button>
          </div>

          <div className="mb-6 flex gap-2 overflow-x-auto pb-1">
            {TOPIC_FILTERS.map((filter) => (
              <button key={filter} type="button" onClick={() => setActiveFilter(filter)} className={`shrink-0 rounded-full px-4 py-2 text-sm font-bold transition ${activeFilter === filter ? "bg-blue-600 text-white shadow-sm" : "bg-white text-slate-600 ring-1 ring-slate-200 hover:text-blue-700"}`}>
                {filter}
              </button>
            ))}
          </div>

          {message && <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">{message}</div>}

          <div className="space-y-4">
            {discussionLoading && <div className="rounded-3xl border border-slate-200 bg-white p-5 text-sm text-slate-500 shadow-sm">Loading V2 discussion shell...</div>}
            {!discussionLoading && filteredDiscussions.length === 0 && <div className="rounded-3xl border border-slate-200 bg-white p-6 text-slate-600 shadow-sm">No discussions match this V2 shell filter.</div>}
            {!discussionLoading && filteredDiscussions.map((discussion) => (
              <DiscussionCard key={discussion.id} discussion={discussion} onAddSticky={addDiscussionToStickies} addingSticky={addingStickyId === discussion.id} />
            ))}
          </div>
        </section>

        <aside className="hidden space-y-4 lg:block">
          <section className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-black uppercase tracking-[0.16em] text-slate-600">Trending topics</h2>
              <TrendingUp className="size-5 text-blue-600" />
            </div>
            <div className="mt-4 space-y-3">
              {fallbackTrendingTopics.map(([topic, count], index) => (
                <button key={topic} type="button" onClick={() => setQuery(topic)} className="flex w-full items-center justify-between text-left text-sm">
                  <span className="flex items-center gap-2 font-bold text-slate-700"><span className="grid size-6 place-items-center rounded-full bg-blue-100 text-xs font-black text-blue-700">{index + 1}</span>{topic}</span>
                  <span className="text-xs font-semibold text-slate-400">{formatCompactCount(count)} signals</span>
                </button>
              ))}
            </div>
            <Link href="/v2/discussions" className="mt-4 flex items-center justify-between border-t border-slate-100 pt-4 text-sm font-black text-blue-700">
              View all topics
              <ChevronRight className="size-4" />
            </Link>
          </section>

          <section className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-black uppercase tracking-[0.16em] text-slate-600">Top contributors</h2>
              <Link href="/v2/people" className="text-sm font-black text-blue-700">View all</Link>
            </div>
            <div className="mt-4 space-y-4">
              {fallbackTopContributors.map(([author, contributor]) => (
                <div key={author} className="flex items-center justify-between gap-3 text-sm">
                  <span className="flex min-w-0 items-center gap-3">
                    {contributor.avatarUrl ? <img src={contributor.avatarUrl} alt="" className="size-9 rounded-full object-cover" /> : <span className="grid size-9 place-items-center rounded-full bg-slate-100 font-black text-slate-600">{author.slice(0, 1)}</span>}
                    <span className="min-w-0">
                      <span className="block truncate font-black text-slate-800">{author}</span>
                      <span className="block truncate text-xs font-semibold text-slate-400">{contributor.username ? `@${contributor.username}` : "Contributor"} · {formatCompactCount(contributor.count)} signals</span>
                    </span>
                  </span>
                  <Link href="/v2/people" className="rounded-xl bg-blue-50 px-3 py-1.5 text-xs font-black text-blue-700 transition hover:bg-blue-100">Follow</Link>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-sm font-black uppercase tracking-[0.16em] text-slate-600">Saved folders</h2>
            <div className="mt-4 space-y-3 text-sm text-slate-600">
              {[
                ["Decentralized Identity", "12 discussions"],
                ["AI Safety", "8 discussions"],
                ["Climate & Energy", "15 discussions"],
              ].map(([folder, meta]) => (
                <Link key={folder} href="/v2/saved" className="flex items-center gap-3 rounded-2xl px-1 py-2 transition hover:bg-blue-50">
                  <FolderOpen className="size-5 text-blue-600" />
                  <span><span className="block font-black text-slate-700">{folder}</span><span className="block text-xs font-semibold text-slate-400">{meta}</span></span>
                </Link>
              ))}
            </div>
            <Link href="/v2/saved" className="mt-4 flex items-center justify-between border-t border-slate-100 pt-4 text-sm font-black text-blue-700">
              View all folders
              <ChevronRight className="size-4" />
            </Link>
          </section>
        </aside>
      </section>
      <MobileBottomNav />
    </main>
  );
}
