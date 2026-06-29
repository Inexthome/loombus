"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { BadgeCheck, MessageCircle, Search, SlidersHorizontal, Users } from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import {
  getDefaultShellPayload,
  V2ShellGateCard,
  V2ShellMobileNav,
  V2ShellTopNav,
  type ShellPayload,
} from "../v2-shell-components";

type DiscussionResult = {
  id: string;
  title: string;
  topic: string | null;
  body: string | null;
  created_at: string;
  user_id: string;
  discussion_type: string | null;
  authorName: string | null;
  authorUsername: string | null;
  authorAvatarUrl: string | null;
};

type PeopleResult = {
  id: string;
  full_name: string | null;
  username: string | null;
  avatar_url: string | null;
  bio: string | null;
};

type SearchTab = "All" | "Discussions" | "People";

const TABS: SearchTab[] = ["All", "Discussions", "People"];

function getDiscussionAge(value: string) {
  const diffMinutes = Math.floor((Date.now() - new Date(value).getTime()) / 60000);
  if (diffMinutes < 1) return "Just now";
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric" }).format(new Date(value));
}

function stripHtml(value: string | null | undefined) {
  return (value ?? "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function truncate(value: string, max = 140) {
  return value.length > max ? `${value.slice(0, max - 1)}…` : value;
}

function getModeClass(value: string | null | undefined) {
  if (value === "debate") return "bg-rose-50 text-rose-700";
  if (value === "research_question") return "bg-violet-50 text-violet-700";
  if (value === "problem_solving") return "bg-orange-50 text-orange-700";
  return "bg-emerald-50 text-emerald-700";
}

function getModeLabel(value: string | null | undefined) {
  if (value === "debate") return "Debate";
  if (value === "research_question") return "Research Question";
  if (value === "problem_solving") return "Problem Solving";
  return "Discussion";
}

function DiscussionResultCard({ result }: { result: DiscussionResult }) {
  const authorName = result.authorName?.trim() || result.authorUsername?.trim() || "Loombus member";
  return (
    <article className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-md">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        {result.topic && <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700">{result.topic}</span>}
        <span className={`rounded-full px-3 py-1 text-xs font-bold ${getModeClass(result.discussion_type)}`}>{getModeLabel(result.discussion_type)}</span>
      </div>
      <Link href={`/v2/discussions/${result.id}`} className="block">
        <h2 className="line-clamp-2 text-lg font-black tracking-tight text-slate-950 transition hover:text-blue-700">{result.title}</h2>
        <p className="mt-1 line-clamp-2 text-sm leading-6 text-slate-600">{truncate(stripHtml(result.body))}</p>
      </Link>
      <div className="mt-3 flex items-center gap-2 text-xs text-slate-500">
        {result.authorAvatarUrl ? (
          <img src={result.authorAvatarUrl} alt="" className="size-6 rounded-full object-cover" />
        ) : (
          <span className="grid size-6 place-items-center rounded-full bg-slate-100 text-xs font-bold text-slate-600">{authorName.slice(0, 1)}</span>
        )}
        <span className="font-bold text-slate-700">{authorName}</span>
        <span>·</span>
        <span>{getDiscussionAge(result.created_at)}</span>
      </div>
    </article>
  );
}

function PeopleResultCard({ result }: { result: PeopleResult }) {
  const displayName = result.full_name?.trim() || result.username?.trim() || "Loombus member";
  const bioPreview = truncate(stripHtml(result.bio) || "Loombus contributor.");
  return (
    <article className="flex items-center gap-4 rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-md">
      {result.avatar_url ? (
        <img src={result.avatar_url} alt="" className="size-14 shrink-0 rounded-full object-cover" />
      ) : (
        <span className="grid size-14 shrink-0 place-items-center rounded-full bg-gradient-to-br from-slate-200 to-blue-100 text-lg font-black text-slate-700">{displayName.slice(0, 1)}</span>
      )}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="font-black text-slate-950">{displayName}</span>
          <BadgeCheck className="size-4 shrink-0 text-blue-600" />
        </div>
        {result.username && <p className="text-xs font-semibold text-slate-500">@{result.username}</p>}
        <p className="mt-1 text-sm text-slate-600">{bioPreview}</p>
      </div>
      <button type="button" className="shrink-0 rounded-xl bg-blue-50 px-4 py-2 text-sm font-black text-blue-700 transition hover:bg-blue-100">Follow</button>
    </article>
  );
}

export default function V2SearchPage() {
  const [payload, setPayload] = useState<ShellPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [query, setQuery] = useState("");
  const [activeTab, setActiveTab] = useState<SearchTab>("All");
  const [discussions, setDiscussions] = useState<DiscussionResult[]>([]);
  const [people, setPeople] = useState<PeopleResult[]>([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [message, setMessage] = useState("");

  async function runSearch(searchQuery: string) {
    if (!searchQuery.trim()) {
      setDiscussions([]);
      setPeople([]);
      setHasSearched(false);
      return;
    }

    setSearching(true);
    setHasSearched(true);

    try {
      const cleanQuery = searchQuery.trim();

      const [
        { data: discussionRows },
        { data: profileRows },
      ] = await Promise.all([
        supabase
          .from("discussions")
          .select("id, title, topic, body, created_at, user_id, discussion_type")
          .is("deleted_at", null)
          .or(`title.ilike.%${cleanQuery}%,topic.ilike.%${cleanQuery}%,body.ilike.%${cleanQuery}%`)
          .order("created_at", { ascending: false })
          .limit(20),
        supabase
          .from("profiles")
          .select("id, full_name, username, avatar_url, bio")
          .or(`full_name.ilike.%${cleanQuery}%,username.ilike.%${cleanQuery}%,bio.ilike.%${cleanQuery}%`)
          .limit(10),
      ]);

      const discussionList = discussionRows ?? [];
      const authorIds = [...new Set(discussionList.map((d) => d.user_id).filter(Boolean))];
      let authorMap: Record<string, { full_name: string | null; username: string | null; avatar_url: string | null }> = {};

      if (authorIds.length > 0) {
        const { data: authors } = await supabase
          .from("profiles")
          .select("id, full_name, username, avatar_url")
          .in("id", authorIds);

        for (const author of authors ?? []) {
          authorMap[author.id] = author;
        }
      }

      setDiscussions(
        discussionList.map((d) => ({
          ...d,
          authorName: authorMap[d.user_id]?.full_name ?? null,
          authorUsername: authorMap[d.user_id]?.username ?? null,
          authorAvatarUrl: authorMap[d.user_id]?.avatar_url ?? null,
        }))
      );
      setPeople((profileRows ?? []) as PeopleResult[]);
    } catch {
      setMessage("Search encountered an error. Please try again.");
    } finally {
      setSearching(false);
    }
  }

  useEffect(() => {
    const timer = setTimeout(() => {
      void runSearch(query);
    }, 350);
    return () => clearTimeout(timer);
  }, [query]);

  async function loadShell() {
    setLoading(true);
    try {
      const { data } = await supabase.auth.getSession();
      const accessToken = data.session?.access_token;
      const response = await fetch("/api/v2/shell", {
        headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
      });
      const nextPayload = (await response.json().catch(() => getDefaultShellPayload())) as ShellPayload;
      setPayload(nextPayload);
    } catch {
      setPayload(getDefaultShellPayload());
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadShell();
    const { data } = supabase.auth.onAuthStateChange(() => loadShell());
    return () => data.subscription.unsubscribe();
  }, []);

  const visibleDiscussions = useMemo(() => activeTab === "People" ? [] : discussions, [activeTab, discussions]);
  const visiblePeople = useMemo(() => activeTab === "Discussions" ? [] : people, [activeTab, people]);
  const totalResults = visibleDiscussions.length + visiblePeople.length;

  if (loading) return <V2ShellGateCard title="Loading Search" message="Loombus is verifying access before loading V2 Search." loading />;
  if (!payload?.authenticated) return <V2ShellGateCard title="Sign in required" message="Sign in so Loombus can verify V2 access." payload={payload} />;
  if (!payload.configured || !payload.flags.v2_shell || payload.version !== "v2") {
    return <V2ShellGateCard title="V2 shell is not enabled" message="This account is not currently allowed through the v2_shell flag." payload={payload} />;
  }

  return (
    <main className="fixed inset-0 z-[80] min-h-screen overflow-y-auto bg-[#f7fbff] loombus-v2-page-bg text-slate-950">
      <V2ShellTopNav />
      <section className="mx-auto max-w-3xl px-4 pb-28 pt-6 sm:px-6 lg:px-8">
        <header className="mb-6">
          <h1 className="text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">Search</h1>
          <p className="mt-2 text-sm text-slate-600">Search discussions, people, and topics across Loombus.</p>
        </header>

        <div className="mb-4 flex gap-3">
          <div className="flex min-w-0 flex-1 items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
            <Search className="size-5 shrink-0 text-slate-400" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search discussions, people, topics..."
              className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-slate-400"
              autoFocus
            />
          </div>
          <button type="button" className="grid size-12 place-items-center rounded-2xl border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700">
            <SlidersHorizontal className="size-5" />
          </button>
        </div>

        <div className="mb-6 flex gap-2">
          {TABS.map((tab) => (
            <button key={tab} type="button" onClick={() => setActiveTab(tab)} className={`rounded-full px-4 py-2 text-sm font-bold transition ${activeTab === tab ? "bg-blue-600 text-white shadow-sm" : "bg-white text-slate-600 ring-1 ring-slate-200 hover:text-blue-700"}`}>
              {tab}
              {tab === "Discussions" && discussions.length > 0 && <span className="ml-1.5 rounded-full bg-blue-100 px-1.5 text-xs text-blue-700">{discussions.length}</span>}
              {tab === "People" && people.length > 0 && <span className="ml-1.5 rounded-full bg-blue-100 px-1.5 text-xs text-blue-700">{people.length}</span>}
            </button>
          ))}
        </div>

        {message && <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">{message}</div>}

        {!hasSearched && (
          <div className="rounded-[2rem] border border-slate-200 bg-white p-10 text-center shadow-sm">
            <Search className="mx-auto size-10 text-slate-300" />
            <h2 className="mt-4 text-lg font-black text-slate-700">Start searching</h2>
            <p className="mt-2 text-sm text-slate-500">Type to search discussions, people, and topics across Loombus.</p>
            <div className="mt-6 flex flex-wrap justify-center gap-2">
              {["AI & Society", "Research", "Climate", "Philosophy", "Technology"].map((suggestion) => (
                <button key={suggestion} type="button" onClick={() => setQuery(suggestion)} className="rounded-full bg-blue-50 px-4 py-2 text-sm font-bold text-blue-700 transition hover:bg-blue-100">
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        )}

        {hasSearched && searching && (
          <div className="rounded-[2rem] border border-slate-200 bg-white p-8 text-center text-sm text-slate-500 shadow-sm">
            Searching...
          </div>
        )}

        {hasSearched && !searching && totalResults === 0 && (
          <div className="rounded-[2rem] border border-slate-200 bg-white p-10 text-center shadow-sm">
            <h2 className="text-lg font-black text-slate-700">No results for "{query}"</h2>
            <p className="mt-2 text-sm text-slate-500">Try a different search term or browse discussions directly.</p>
            <Link href="/v2/discussions" className="mt-5 inline-flex items-center gap-2 rounded-2xl bg-blue-600 px-5 py-3 text-sm font-black text-white transition hover:bg-blue-700">
              <MessageCircle className="size-4" />
              Browse discussions
            </Link>
          </div>
        )}

        {hasSearched && !searching && totalResults > 0 && (
          <div className="space-y-6">
            {visibleDiscussions.length > 0 && (
              <section>
                <div className="mb-3 flex items-center gap-2">
                  <MessageCircle className="size-4 text-blue-600" />
                  <h2 className="text-sm font-black uppercase tracking-[0.16em] text-slate-600">Discussions</h2>
                  <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs font-bold text-blue-700">{visibleDiscussions.length}</span>
                </div>
                <div className="space-y-3">
                  {visibleDiscussions.map((result) => <DiscussionResultCard key={result.id} result={result} />)}
                </div>
              </section>
            )}

            {visiblePeople.length > 0 && (
              <section>
                <div className="mb-3 flex items-center gap-2">
                  <Users className="size-4 text-blue-600" />
                  <h2 className="text-sm font-black uppercase tracking-[0.16em] text-slate-600">People</h2>
                  <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs font-bold text-blue-700">{visiblePeople.length}</span>
                </div>
                <div className="space-y-3">
                  {visiblePeople.map((result) => <PeopleResultCard key={result.id} result={result} />)}
                </div>
              </section>
            )}
          </div>
        )}
      </section>
      <V2ShellMobileNav />
    </main>
  );
}
