"use client";

import { normalizePublicText } from "@/lib/public-text";
import { supabase } from "@/lib/supabase/client";
import {
  ArrowLeft,
  Bookmark,
  Eye,
  MessageCircle,
  Search,
  Sparkles,
} from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import "./topic-signal.css";

type Discussion = {
  id: string;
  user_id: string;
  title: string;
  body: string;
  topic: string | null;
  created_at: string;
};

type Profile = {
  id: string;
  full_name: string | null;
  username: string | null;
};

type BlockRow = {
  blocker_id: string;
  blocked_id: string;
};

type DiscussionCard = Discussion & {
  profile: Profile | null;
  replies: number;
  views: number;
  saves: number;
  signal: number;
};

type SortMode = "newest" | "oldest" | "signal";

function getProfileName(profile: Profile | null) {
  return profile?.full_name?.trim() || profile?.username?.trim() || "Loombus member";
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}

export default function TopicSignalClient() {
  const params = useParams<{ topic: string }>();
  const topic = decodeURIComponent(String(params?.topic ?? "")).trim();
  const [discussions, setDiscussions] = useState<DiscussionCard[]>([]);
  const [query, setQuery] = useState("");
  const [sortMode, setSortMode] = useState<SortMode>("newest");
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let mounted = true;

    async function loadTopicSignal() {
      if (!topic) {
        setLoading(false);
        return;
      }

      setLoading(true);
      setMessage("");

      try {
        const { data: userData } = await supabase.auth.getUser();
        const viewerId = userData.user?.id ?? null;
        const hiddenUserIds = new Set<string>();

        if (viewerId) {
          const { data: blockRows } = await supabase
            .from("user_blocks")
            .select("blocker_id, blocked_id")
            .or(`blocker_id.eq.${viewerId},blocked_id.eq.${viewerId}`);

          for (const block of (blockRows ?? []) as BlockRow[]) {
            hiddenUserIds.add(
              block.blocker_id === viewerId ? block.blocked_id : block.blocker_id
            );
          }
        }

        const { data: discussionRows, error: discussionError } = await supabase
          .from("discussions")
          .select("id, user_id, title, body, topic, created_at")
          .eq("topic", topic)
          .is("deleted_at", null)
          .order("created_at", { ascending: false });

        if (discussionError) throw discussionError;

        const visibleDiscussions = ((discussionRows ?? []) as Discussion[]).filter(
          (discussion) => !hiddenUserIds.has(discussion.user_id)
        );
        const ids = visibleDiscussions.map((discussion) => discussion.id);
        const authorIds = [
          ...new Set(visibleDiscussions.map((discussion) => discussion.user_id)),
        ];

        const [profileResult, replyResult, viewResult, saveResult] = await Promise.all([
          authorIds.length
            ? supabase
                .from("profiles")
                .select("id, full_name, username")
                .in("id", authorIds)
            : Promise.resolve({ data: [], error: null }),
          ids.length
            ? supabase
                .from("replies")
                .select("discussion_id, user_id")
                .in("discussion_id", ids)
                .is("deleted_at", null)
            : Promise.resolve({ data: [], error: null }),
          ids.length
            ? supabase
                .from("discussion_views")
                .select("discussion_id")
                .in("discussion_id", ids)
            : Promise.resolve({ data: [], error: null }),
          ids.length
            ? supabase
                .from("bookmarks")
                .select("discussion_id")
                .in("discussion_id", ids)
            : Promise.resolve({ data: [], error: null }),
        ]);

        const profiles = Object.fromEntries(
          ((profileResult.data ?? []) as Profile[]).map((profile) => [
            profile.id,
            profile,
          ])
        );
        const replyCounts: Record<string, number> = {};
        const viewCounts: Record<string, number> = {};
        const saveCounts: Record<string, number> = {};

        for (const row of replyResult.data ?? []) {
          if (hiddenUserIds.has(row.user_id)) continue;
          replyCounts[row.discussion_id] =
            (replyCounts[row.discussion_id] ?? 0) + 1;
        }

        for (const row of viewResult.data ?? []) {
          viewCounts[row.discussion_id] = (viewCounts[row.discussion_id] ?? 0) + 1;
        }

        for (const row of saveResult.data ?? []) {
          saveCounts[row.discussion_id] = (saveCounts[row.discussion_id] ?? 0) + 1;
        }

        const cards = visibleDiscussions.map((discussion) => {
          const replies = replyCounts[discussion.id] ?? 0;
          const views = viewCounts[discussion.id] ?? 0;
          const saves = saveCounts[discussion.id] ?? 0;

          return {
            ...discussion,
            profile: profiles[discussion.user_id] ?? null,
            replies,
            views,
            saves,
            signal: replies * 3 + saves * 5 + views,
          };
        });

        if (mounted) setDiscussions(cards);
      } catch (error) {
        console.error("Unable to load topic Signal.", error);
        if (mounted) {
          setDiscussions([]);
          setMessage("This topic could not load. Return to Signal Topics and try again.");
        }
      } finally {
        if (mounted) setLoading(false);
      }
    }

    void loadTopicSignal();

    return () => {
      mounted = false;
    };
  }, [topic]);

  const filteredDiscussions = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const next = discussions.filter((discussion) => {
      if (!needle) return true;

      return [
        discussion.title,
        discussion.body,
        getProfileName(discussion.profile),
        discussion.profile?.username,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(needle);
    });

    return [...next].sort((a, b) => {
      if (sortMode === "signal") return b.signal - a.signal;

      const aTime = new Date(a.created_at).getTime();
      const bTime = new Date(b.created_at).getTime();
      return sortMode === "oldest" ? aTime - bTime : bTime - aTime;
    });
  }, [discussions, query, sortMode]);

  const totalReplies = discussions.reduce((total, item) => total + item.replies, 0);
  const totalViews = discussions.reduce((total, item) => total + item.views, 0);
  const totalSignal = discussions.reduce((total, item) => total + item.signal, 0);

  return (
    <main className="topic-signal-page">
      <div className="topic-signal-shell">
        <Link href="/topics" className="topic-signal-back">
          <ArrowLeft aria-hidden="true" /> Back to Signal Topics
        </Link>

        <header className="topic-signal-hero">
          <div>
            <p>Topic Signal</p>
            <h1>{topic || "Unknown topic"}</h1>
            <span>
              Every visible discussion currently filed in this topic lane, ordered by
              recency or Signal.
            </span>
          </div>
          <Link href={`/create?topic=${encodeURIComponent(topic)}`}>
            Create in this topic
          </Link>
        </header>

        <section className="topic-signal-metrics">
          <article><span>Discussions</span><strong>{discussions.length}</strong></article>
          <article><span>Replies</span><strong>{totalReplies}</strong></article>
          <article><span>Views</span><strong>{totalViews}</strong></article>
          <article className="is-accent"><span>Total Signal</span><strong>{totalSignal}</strong></article>
        </section>

        <section className="topic-signal-tools">
          <label>
            <Search aria-hidden="true" />
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search this topic"
            />
          </label>
          <select
            value={sortMode}
            onChange={(event) => setSortMode(event.target.value as SortMode)}
          >
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
            <option value="signal">Most Signal</option>
          </select>
        </section>

        {message && <div className="topic-signal-notice">{message}</div>}

        {loading ? (
          <section className="topic-signal-state">
            <Sparkles aria-hidden="true" />
            <h2>Loading topic Signal…</h2>
          </section>
        ) : filteredDiscussions.length === 0 ? (
          <section className="topic-signal-state">
            <Sparkles aria-hidden="true" />
            <h2>{discussions.length === 0 ? "No discussions in this topic yet." : "No discussions match this search."}</h2>
            <p>
              {discussions.length === 0
                ? "This topic is visible and ready for its first focused discussion."
                : "Try a broader search term."}
            </p>
            <Link href={`/create?topic=${encodeURIComponent(topic)}`}>
              Start a discussion
            </Link>
          </section>
        ) : (
          <section className="topic-signal-list">
            {filteredDiscussions.map((discussion) => (
              <article key={discussion.id}>
                <div className="topic-signal-card-topline">
                  <span>{formatDate(discussion.created_at)}</span>
                  <strong>{discussion.signal} Signal</strong>
                </div>
                <Link href={`/discussions/${discussion.id}`}>
                  <h2>{normalizePublicText(discussion.title)}</h2>
                  <p>{normalizePublicText(discussion.body)}</p>
                </Link>
                <div className="topic-signal-card-footer">
                  <span>{getProfileName(discussion.profile)}</span>
                  <div>
                    <span><MessageCircle aria-hidden="true" />{discussion.replies}</span>
                    <span><Eye aria-hidden="true" />{discussion.views}</span>
                    <span><Bookmark aria-hidden="true" />{discussion.saves}</span>
                  </div>
                </div>
              </article>
            ))}
          </section>
        )}
      </div>
    </main>
  );
}
