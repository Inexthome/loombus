"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Bell, Home, Loader2, Lock, MessageCircle, Plus, Reply, Search, Settings, Users } from "lucide-react";
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

type ReplyRow = {
  id: string;
  user_id: string;
  body: string;
  created_at: string;
  quoted_excerpt?: string | null;
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
  { label: "Settings", href: "/settings", icon: Settings },
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

function formatCount(value: number | null | undefined) {
  return Math.max(0, value ?? 0).toLocaleString();
}

function getName(profile: Profile | null | undefined) {
  return profile?.full_name?.trim() || profile?.username?.trim() || "Loombus member";
}

function getModeLabel(value: string | null | undefined) {
  if (value === "debate") return "Debate";
  if (value === "research_question") return "Research Question";
  if (value === "problem_solving") return "Problem Solving";
  return "Open Discussion";
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
                    ? "bg-white/10 text-white ring-1 ring-white/20"
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
        <Link href="/search" aria-label="Search" className="grid size-10 place-items-center rounded-full text-blue-100 transition hover:bg-white/10 hover:text-white">
          <Search className="size-5" />
        </Link>
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

export default function V2DiscussionDetailPage() {
  const [payload, setPayload] = useState<ShellPayload | null>(null);
  const [discussion, setDiscussion] = useState<Discussion | null>(null);
  const [authorProfile, setAuthorProfile] = useState<Profile | null>(null);
  const [replies, setReplies] = useState<ReplyRow[]>([]);
  const [replyProfiles, setReplyProfiles] = useState<Record<string, Profile>>({});
  const [viewCount, setViewCount] = useState(0);
  const [savedCount, setSavedCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  const discussionId = useMemo(() => {
    if (typeof window === "undefined") return "";
    const segments = window.location.pathname.split("/").filter(Boolean);
    return segments[segments.length - 1] ?? "";
  }, []);

  async function loadDiscussionDetail() {
    setLoading(true);
    setMessage("");

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;

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

      const { data: discussionData, error: discussionError } = await supabase
        .from("discussions")
        .select("id, user_id, title, topic, body, created_at, discussion_type, purpose_lane")
        .eq("id", discussionId)
        .is("deleted_at", null)
        .maybeSingle();

      if (discussionError || !discussionData) {
        setDiscussion(null);
        setMessage("This discussion could not be loaded in V2.");
        return;
      }

      const nextDiscussion = discussionData as Discussion;
      setDiscussion(nextDiscussion);

      const [profileResult, replyResult, viewResult, saveResult] = await Promise.all([
        supabase.from("profiles").select("id, full_name, username, avatar_url").eq("id", nextDiscussion.user_id).maybeSingle(),
        supabase.from("replies").select("id, user_id, body, created_at, quoted_excerpt").eq("discussion_id", discussionId).is("deleted_at", null).order("created_at", { ascending: true }),
        supabase.from("discussion_views").select("id", { count: "exact", head: true }).eq("discussion_id", discussionId),
        supabase.from("bookmarks").select("id", { count: "exact", head: true }).eq("discussion_id", discussionId),
      ]);

      setAuthorProfile((profileResult.data as Profile | null) ?? null);
      setReplies((replyResult.data ?? []) as ReplyRow[]);
      setViewCount(viewResult.count ?? 0);
      setSavedCount(saveResult.count ?? 0);

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
    } catch {
      setPayload(getDefaultShellPayload());
      setMessage("Unable to load this discussion in V2.");
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
  }, []);

  if (loading) {
    return <GateCard title="Loading V2 discussion" message="Loombus is loading this discussion inside the V2 shell." loading />;
  }

  if (!payload?.authenticated) {
    return <GateCard title="Sign in required" message="The V2 discussion shell is internal-only right now. Sign in first so Loombus can verify access." payload={payload} />;
  }

  if (!payload.configured || !payload.flags.v2_shell || payload.version !== "v2") {
    return <GateCard title="V2 shell is not enabled" message="This account is not currently allowed through the v2_shell flag. Current users remain on the existing experience." payload={payload} />;
  }

  return (
    <main className="fixed inset-0 z-[80] min-h-screen overflow-y-auto bg-[#f7fbff] text-slate-950">
      <V2TopNav />
      <section className="mx-auto grid max-w-7xl gap-6 px-4 pb-28 pt-6 sm:px-6 lg:grid-cols-[minmax(0,1fr)_320px] lg:px-8">
        <div className="min-w-0 space-y-5">
          <Link href="/v2/discussions" className="inline-flex items-center gap-2 text-sm font-bold text-blue-700 transition hover:text-blue-900">
            <ArrowLeft className="size-4" />
            Back to V2 Discussions
          </Link>

          {message && <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">{message}</div>}

          {!discussion ? (
            <section className="rounded-[2rem] border border-slate-200 bg-white p-6 text-slate-600 shadow-sm">No discussion is available for this route.</section>
          ) : (
            <>
              <article className="overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-sm">
                <div className="bg-[#061942] px-5 py-5 text-white sm:px-6">
                  <div className="mb-4 flex flex-wrap gap-2">
                    <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-bold text-blue-100 ring-1 ring-white/15">{discussion.topic || "Discussion"}</span>
                    <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-bold text-blue-100 ring-1 ring-white/15">{getModeLabel(discussion.discussion_type)}</span>
                    {discussion.purpose_lane && <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-bold text-blue-100 ring-1 ring-white/15">{discussion.purpose_lane}</span>}
                  </div>
                  <h1 className="max-w-4xl text-3xl font-black tracking-tight sm:text-5xl">{discussion.title}</h1>
                  <div className="mt-5 flex flex-wrap items-center gap-3 text-sm text-blue-100">
                    {authorProfile?.avatar_url ? (
                      <img src={authorProfile.avatar_url} alt="" className="size-10 rounded-full object-cover ring-2 ring-white/20" />
                    ) : (
                      <span className="grid size-10 place-items-center rounded-full bg-white/10 font-black text-white">{getName(authorProfile).slice(0, 1)}</span>
                    )}
                    <span className="font-bold text-white">{getName(authorProfile)}</span>
                    <span>·</span>
                    <span>{formatDate(discussion.created_at)}</span>
                  </div>
                </div>
                <div className="whitespace-pre-wrap p-5 text-base leading-8 text-slate-800 sm:p-6">{discussion.body || "No discussion body available."}</div>
              </article>

              <section className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
                <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.18em] text-blue-600">Replies</p>
                    <h2 className="mt-1 text-2xl font-black text-slate-950">Conversation thread</h2>
                  </div>
                  <Link href={`/discussions/${discussion.id}`} className="rounded-full bg-blue-600 px-4 py-2 text-sm font-bold text-white transition hover:bg-blue-700">
                    Use current reply tools
                  </Link>
                </div>

                <div className="space-y-3">
                  {replies.length === 0 ? (
                    <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5 text-sm text-slate-600">No replies yet.</div>
                  ) : (
                    replies.map((reply) => {
                      const replyProfile = replyProfiles[reply.user_id] ?? null;
                      return (
                        <article key={reply.id} className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                          <div className="mb-3 flex items-center gap-3 text-sm">
                            {replyProfile?.avatar_url ? (
                              <img src={replyProfile.avatar_url} alt="" className="size-9 rounded-full object-cover" />
                            ) : (
                              <span className="grid size-9 place-items-center rounded-full bg-white font-black text-slate-600">{getName(replyProfile).slice(0, 1)}</span>
                            )}
                            <div>
                              <p className="font-bold text-slate-800">{getName(replyProfile)}</p>
                              <p className="text-xs text-slate-500">{formatDate(reply.created_at)}</p>
                            </div>
                          </div>
                          {reply.quoted_excerpt && <div className="mb-3 rounded-2xl border-l-4 border-blue-300 bg-white px-4 py-3 text-sm text-slate-500">{reply.quoted_excerpt}</div>}
                          <p className="whitespace-pre-wrap text-sm leading-7 text-slate-700">{reply.body}</p>
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
          <section className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-sm font-black uppercase tracking-[0.16em] text-slate-500">Signal stats</h2>
            <div className="mt-4 grid grid-cols-3 gap-3 text-center">
              <div className="rounded-2xl bg-blue-50 p-3"><p className="text-2xl font-black text-blue-700">{formatCount(replies.length)}</p><p className="text-xs font-bold text-slate-500">Replies</p></div>
              <div className="rounded-2xl bg-blue-50 p-3"><p className="text-2xl font-black text-blue-700">{formatCount(viewCount)}</p><p className="text-xs font-bold text-slate-500">Views</p></div>
              <div className="rounded-2xl bg-blue-50 p-3"><p className="text-2xl font-black text-blue-700">{formatCount(savedCount)}</p><p className="text-xs font-bold text-slate-500">Saves</p></div>
            </div>
          </section>

          <section className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-sm font-black uppercase tracking-[0.16em] text-slate-500">Actions</h2>
            <div className="mt-4 flex flex-col gap-3">
              <Link href="/v2/discussions" className="rounded-2xl border border-slate-200 px-4 py-2 text-center text-sm font-bold text-slate-700 transition hover:border-blue-200 hover:text-blue-700">Back to V2 feed</Link>
              {discussion && <Link href={`/discussions/${discussion.id}`} className="rounded-2xl bg-blue-600 px-4 py-2 text-center text-sm font-bold text-white transition hover:bg-blue-700">Open current detail</Link>}
            </div>
          </section>
        </aside>
      </section>
      <MobileBottomNav />
    </main>
  );
}
