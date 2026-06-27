"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Bookmark, MessageCircle, StickyNote, UserRound, type LucideIcon } from "lucide-react";
import { supabase } from "@/lib/supabase/client";

type FallbackCard = {
  title: string;
  description: string;
  meta: string;
};

type CompatCard = FallbackCard & {
  href?: string;
  avatarUrl?: string | null;
  icon?: "person" | "saved" | "sticky" | "discussion" | "reply" | "profile";
};

type ProfileRow = {
  id: string;
  full_name: string | null;
  username: string | null;
  avatar_url: string | null;
  bio: string | null;
};

type DiscussionRow = {
  id: string;
  user_id?: string | null;
  title: string;
  topic: string | null;
  body: string | null;
  created_at: string;
  discussion_status?: string | null;
};

type ReplyRow = {
  id: string;
  discussion_id: string;
  body: string | null;
  created_at: string;
};

type StickyRow = {
  id: string;
  source_key: string;
  title: string;
  subtitle: string | null;
  href: string;
  created_at: string;
  updated_at: string;
};

const LIVE_SECTIONS = new Set(["people", "saved", "stickies", "my-discussions", "my-replies", "profile"]);

function stripHtml(value: string | null | undefined) {
  return (value ?? "")
    .replace(/<br\s*\/?\s*>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function truncate(value: string, maxLength = 150) {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, maxLength - 1).trim()}…`;
}

function formatRelativeTime(value: string | null | undefined) {
  if (!value) return "Recently";
  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp)) return "Recently";
  const diffMs = Date.now() - timestamp;
  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;

  if (diffMs < hour) return `${Math.max(1, Math.round(diffMs / minute))}m ago`;
  if (diffMs < day) return `${Math.round(diffMs / hour)}h ago`;
  if (diffMs < 14 * day) return `${Math.round(diffMs / day)}d ago`;

  return new Date(value).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function getProfileName(profile: ProfileRow) {
  return profile.full_name?.trim() || profile.username?.trim() || "Loombus member";
}

function getInitial(title: string) {
  return title.trim().slice(0, 1).toUpperCase() || "L";
}

function toV2Href(href: string | undefined) {
  if (!href) return undefined;
  if (href.startsWith("/v2")) return href;
  if (href.startsWith("/discussions/")) return `/v2${href}`;
  return href;
}

function matchesQuery(card: CompatCard, query: string) {
  const cleanQuery = query.trim().toLowerCase();
  if (!cleanQuery) return true;
  return `${card.title} ${card.description} ${card.meta}`.toLowerCase().includes(cleanQuery);
}

async function getViewerId() {
  const { data } = await supabase.auth.getUser();
  return data.user?.id ?? null;
}

async function getHiddenProfileIds(viewerId: string) {
  const { data } = await supabase
    .from("user_blocks")
    .select("blocker_id, blocked_id")
    .or(`blocker_id.eq.${viewerId},blocked_id.eq.${viewerId}`);

  const hiddenIds = new Set<string>();
  for (const block of data ?? []) {
    const blockerId = (block as { blocker_id?: string }).blocker_id;
    const blockedId = (block as { blocked_id?: string }).blocked_id;
    if (blockerId && blockedId) hiddenIds.add(blockerId === viewerId ? blockedId : blockerId);
  }
  return hiddenIds;
}

async function loadPeopleCards(viewerId: string) {
  const hiddenIds = await getHiddenProfileIds(viewerId);
  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name, username, avatar_url, bio")
    .order("full_name", { ascending: true })
    .limit(30);

  if (error) throw error;

  return ((data ?? []) as ProfileRow[])
    .filter((profile) => profile.id !== viewerId && !hiddenIds.has(profile.id))
    .map((profile) => ({
      title: getProfileName(profile),
      description: truncate(stripHtml(profile.bio) || "Loombus contributor."),
      meta: profile.username ? `@${profile.username}` : "Profile",
      href: `/v2/people/${profile.id}`,
      avatarUrl: profile.avatar_url,
      icon: "person" as const,
    }));
}

async function loadSavedCards(viewerId: string) {
  const { data: bookmarkData, error } = await supabase
    .from("bookmarks")
    .select("id, discussion_id, created_at")
    .eq("user_id", viewerId)
    .order("created_at", { ascending: false })
    .limit(30);

  if (error) throw error;

  const discussionIds = (bookmarkData ?? [])
    .map((bookmark) => (bookmark as { discussion_id?: string }).discussion_id)
    .filter((id): id is string => Boolean(id));

  if (discussionIds.length === 0) return [];

  const { data: discussionData, error: discussionError } = await supabase
    .from("discussions")
    .select("id, title, topic, body, created_at")
    .in("id", discussionIds)
    .is("deleted_at", null);

  if (discussionError) throw discussionError;

  const discussionMap = new Map((discussionData ?? []).map((discussion) => [discussion.id, discussion as DiscussionRow]));

  return (bookmarkData ?? [])
    .map((bookmark) => {
      const bookmarkRow = bookmark as { discussion_id?: string; created_at?: string };
      const discussion = bookmarkRow.discussion_id ? discussionMap.get(bookmarkRow.discussion_id) : null;
      if (!discussion) return null;
      return {
        title: discussion.title,
        description: truncate(stripHtml(discussion.body) || "Saved discussion."),
        meta: `${discussion.topic || "Discussion"} · Saved ${formatRelativeTime(bookmarkRow.created_at)}`,
        href: `/v2/discussions/${discussion.id}`,
        icon: "saved" as const,
      };
    })
    .filter((card): card is CompatCard => Boolean(card));
}

async function loadStickyCards() {
  const { data } = await supabase.auth.getSession();
  const accessToken = data.session?.access_token;
  if (!accessToken) return [];

  const response = await fetch("/api/stickies", {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });

  if (!response.ok) return [];
  const result = (await response.json().catch(() => ({}))) as { stickies?: StickyRow[] };

  return (result.stickies ?? []).map((sticky) => ({
    title: sticky.title,
    description: truncate(sticky.subtitle || "Sticky discussion note."),
    meta: `Updated ${formatRelativeTime(sticky.updated_at || sticky.created_at)}`,
    href: toV2Href(sticky.href),
    icon: "sticky" as const,
  }));
}

async function loadMyDiscussionCards(viewerId: string) {
  const { data, error } = await supabase
    .from("discussions")
    .select("id, title, topic, body, created_at, discussion_status")
    .eq("user_id", viewerId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(30);

  if (error) throw error;

  return ((data ?? []) as DiscussionRow[]).map((discussion) => ({
    title: discussion.title,
    description: truncate(stripHtml(discussion.body) || "Your discussion."),
    meta: `${discussion.topic || "Discussion"} · ${discussion.discussion_status === "resolved" ? "Resolved" : "Open"} · ${formatRelativeTime(discussion.created_at)}`,
    href: `/v2/discussions/${discussion.id}`,
    icon: "discussion" as const,
  }));
}

async function loadMyReplyCards(viewerId: string) {
  const { data: replyData, error } = await supabase
    .from("replies")
    .select("id, discussion_id, body, created_at")
    .eq("user_id", viewerId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(30);

  if (error) throw error;

  const discussionIds = [...new Set(((replyData ?? []) as ReplyRow[]).map((reply) => reply.discussion_id).filter(Boolean))];
  if (discussionIds.length === 0) return [];

  const { data: discussionData, error: discussionError } = await supabase
    .from("discussions")
    .select("id, title, topic")
    .in("id", discussionIds)
    .is("deleted_at", null);

  if (discussionError) throw discussionError;

  const discussionMap = new Map((discussionData ?? []).map((discussion) => [discussion.id, discussion as DiscussionRow]));

  return ((replyData ?? []) as ReplyRow[])
    .map((reply) => {
      const discussion = discussionMap.get(reply.discussion_id);
      if (!discussion) return null;
      return {
        title: discussion.title,
        description: truncate(stripHtml(reply.body) || "Your reply."),
        meta: `${discussion.topic || "Discussion"} · Replied ${formatRelativeTime(reply.created_at)}`,
        href: `/v2/discussions/${reply.discussion_id}`,
        icon: "reply" as const,
      };
    })
    .filter((card): card is CompatCard => Boolean(card));
}

async function loadProfileCards(viewerId: string) {
  const [profileResult, discussionCountResult, replyCountResult, savedCountResult] = await Promise.all([
    supabase.from("profiles").select("id, full_name, username, avatar_url, bio").eq("id", viewerId).maybeSingle(),
    supabase.from("discussions").select("id", { count: "exact", head: true }).eq("user_id", viewerId).is("deleted_at", null),
    supabase.from("replies").select("id", { count: "exact", head: true }).eq("user_id", viewerId).is("deleted_at", null),
    supabase.from("bookmarks").select("id", { count: "exact", head: true }).eq("user_id", viewerId),
  ]);

  if (profileResult.error) throw profileResult.error;

  const profile = profileResult.data as ProfileRow | null;
  const displayName = profile ? getProfileName(profile) : "Your profile";

  return [
    {
      title: displayName,
      description: truncate(stripHtml(profile?.bio) || "Your Loombus profile and presence."),
      meta: profile?.username ? `@${profile.username}` : "Profile",
      href: "/v2/profile",
      avatarUrl: profile?.avatar_url,
      icon: "profile" as const,
    },
    {
      title: "Your Discussions",
      description: "Discussions you started across Loombus.",
      meta: `${discussionCountResult.count ?? 0} discussions`,
      href: "/v2/my-discussions",
      icon: "discussion" as const,
    },
    {
      title: "Your Replies",
      description: "Replies you posted across active threads.",
      meta: `${replyCountResult.count ?? 0} replies`,
      href: "/v2/my-replies",
      icon: "reply" as const,
    },
    {
      title: "Saved Items",
      description: "Discussions and items you saved for later.",
      meta: `${savedCountResult.count ?? 0} saved`,
      href: "/v2/saved",
      icon: "saved" as const,
    },
  ];
}

function CardVisual({ card, fallbackIcon: FallbackIcon }: { card: CompatCard; fallbackIcon: LucideIcon }) {
  const Icon = card.icon === "saved" ? Bookmark : card.icon === "sticky" ? StickyNote : card.icon === "reply" || card.icon === "discussion" ? MessageCircle : card.icon === "person" || card.icon === "profile" ? UserRound : FallbackIcon;

  if (card.avatarUrl) {
    return <img src={card.avatarUrl} alt="" className="size-16 rounded-2xl object-cover" />;
  }

  return (
    <div className="grid size-16 place-items-center rounded-2xl bg-blue-50 text-blue-600">
      {card.icon ? <Icon className="size-7" /> : <span className="text-xl font-black">{getInitial(card.title)}</span>}
    </div>
  );
}

export function V2ReadOnlyCompatCards({
  sectionSlug,
  query,
  fallbackCards,
  fallbackIcon,
}: {
  sectionSlug: string;
  query: string;
  fallbackCards: FallbackCard[];
  fallbackIcon: LucideIcon;
}) {
  const [cards, setCards] = useState<CompatCard[]>([]);
  const [loading, setLoading] = useState(false);
  const [usedLiveData, setUsedLiveData] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let mounted = true;

    async function loadCards() {
      if (!LIVE_SECTIONS.has(sectionSlug)) {
        setCards(fallbackCards);
        setUsedLiveData(false);
        return;
      }

      setLoading(true);
      setMessage("");

      try {
        const viewerId = await getViewerId();
        if (!viewerId) {
          if (mounted) {
            setCards(fallbackCards);
            setUsedLiveData(false);
            setMessage("Sign in is required for live V2 data.");
          }
          return;
        }

        let nextCards: CompatCard[] = [];

        if (sectionSlug === "people") nextCards = await loadPeopleCards(viewerId);
        if (sectionSlug === "saved") nextCards = await loadSavedCards(viewerId);
        if (sectionSlug === "stickies") nextCards = await loadStickyCards();
        if (sectionSlug === "my-discussions") nextCards = await loadMyDiscussionCards(viewerId);
        if (sectionSlug === "my-replies") nextCards = await loadMyReplyCards(viewerId);
        if (sectionSlug === "profile") nextCards = await loadProfileCards(viewerId);

        if (mounted) {
          setCards(nextCards.length > 0 ? nextCards : fallbackCards);
          setUsedLiveData(nextCards.length > 0);
          setMessage(nextCards.length > 0 ? "" : "No live V2 items found yet. Showing shell examples.");
        }
      } catch (error) {
        console.error(`Unable to load V2 ${sectionSlug} compatibility data.`, error);
        if (mounted) {
          setCards(fallbackCards);
          setUsedLiveData(false);
          setMessage("Live V1 data could not be loaded safely. Showing shell examples.");
        }
      } finally {
        if (mounted) setLoading(false);
      }
    }

    void loadCards();

    return () => {
      mounted = false;
    };
  }, [fallbackCards, sectionSlug]);

  const visibleCards = useMemo(() => cards.filter((card) => matchesQuery(card, query)), [cards, query]);

  return (
    <div className="rounded-[2rem] border border-slate-200 bg-white p-4 shadow-[0_18px_44px_rgba(15,23,42,0.12)] sm:p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-black text-blue-700">
          {usedLiveData ? "Live from V1 data" : "V2 shell examples"}
        </span>
        {loading && <span className="text-xs font-bold text-slate-500">Loading live data…</span>}
      </div>

      {message && <p className="mb-4 rounded-2xl bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-600">{message}</p>}

      <div className="space-y-3">
        {visibleCards.map((card, index) => (
          <article key={`${card.title}-${card.meta}-${index}`} className="grid gap-4 rounded-3xl border border-slate-200 bg-white p-4 transition hover:border-blue-200 hover:bg-blue-50/30 sm:grid-cols-[72px_minmax(0,1fr)_auto]">
            <CardVisual card={card} fallbackIcon={fallbackIcon} />
            <div className="min-w-0">
              <h2 className="text-lg font-black text-slate-950">{card.title}</h2>
              <p className="mt-1 text-sm leading-6 text-slate-600">{card.description}</p>
              <p className="mt-2 text-xs font-bold text-blue-700">{card.meta}</p>
            </div>
            {card.href ? (
              <Link href={card.href} className="self-start rounded-2xl border border-slate-200 px-4 py-2 text-sm font-black text-blue-700 transition hover:border-blue-200 hover:bg-blue-50">
                Open
              </Link>
            ) : (
              <Link href="/v2/discussions" className="self-start rounded-2xl border border-slate-200 px-4 py-2 text-sm font-black text-blue-700 transition hover:border-blue-200 hover:bg-blue-50">
                View
              </Link>
            )}
          </article>
        ))}
        {visibleCards.length === 0 && <div className="rounded-3xl bg-slate-50 p-6 text-sm text-slate-500">No items match this search.</div>}
      </div>
    </div>
  );
}
