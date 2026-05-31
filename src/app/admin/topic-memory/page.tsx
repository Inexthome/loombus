"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase/client";

type Discussion = {
  id: string;
  title: string;
  topic: string;
  reality_lens: string | null;
  created_at: string;
};

type DiscussionTag = {
  discussion_id: string;
  tag: string;
};

type DiscussionAiOutput = {
  discussion_id: string;
  feature_key: string;
  generated_at: string;
};

type ReplyRow = {
  discussion_id: string;
  created_at: string;
};

type ViewRow = {
  discussion_id: string;
};

type BookmarkRow = {
  discussion_id: string;
};

type MemoryGroup = {
  key: string;
  label: string;
  count: number;
  recentCount: number;
  replyCount: number;
  viewCount: number;
  saveCount: number;
  conversationMapCount: number;
  relatedIdeasCount: number;
  latestAt: string | null;
};

const RECENT_DAYS = 30;

function incrementGroup(
  groups: Record<string, MemoryGroup>,
  key: string,
  label: string,
  discussion: Discussion,
  isRecent: boolean,
  replyCount: number,
  viewCount: number,
  saveCount: number,
  hasConversationMap: boolean,
  hasRelatedIdeas: boolean
) {
  if (!key.trim()) {
    return;
  }

  groups[key] ??= {
    key,
    label,
    count: 0,
    recentCount: 0,
    replyCount: 0,
    viewCount: 0,
    saveCount: 0,
    conversationMapCount: 0,
    relatedIdeasCount: 0,
    latestAt: null,
  };

  const group = groups[key];

  group.count += 1;
  group.recentCount += isRecent ? 1 : 0;
  group.replyCount += replyCount;
  group.viewCount += viewCount;
  group.saveCount += saveCount;
  group.conversationMapCount += hasConversationMap ? 1 : 0;
  group.relatedIdeasCount += hasRelatedIdeas ? 1 : 0;

  if (
    !group.latestAt ||
    new Date(discussion.created_at).getTime() > new Date(group.latestAt).getTime()
  ) {
    group.latestAt = discussion.created_at;
  }
}

function sortMemoryGroups(groups: Record<string, MemoryGroup>) {
  return Object.values(groups).sort((a, b) => {
    const signalA =
      a.count * 3 +
      a.recentCount * 4 +
      a.replyCount * 2 +
      a.saveCount * 3 +
      a.relatedIdeasCount * 2 +
      a.conversationMapCount * 2;

    const signalB =
      b.count * 3 +
      b.recentCount * 4 +
      b.replyCount * 2 +
      b.saveCount * 3 +
      b.relatedIdeasCount * 2 +
      b.conversationMapCount * 2;

    if (signalB !== signalA) {
      return signalB - signalA;
    }

    return new Date(b.latestAt ?? 0).getTime() - new Date(a.latestAt ?? 0).getTime();
  });
}

function MemoryCard({ group }: { group: MemoryGroup }) {
  return (
    <div className="rounded-2xl border border-zinc-800 bg-black/40 p-4">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-medium text-white">
            {group.label}
          </h3>

          {group.latestAt && (
            <p className="mt-1 text-xs text-zinc-600">
              Latest: {new Date(group.latestAt).toLocaleDateString()}
            </p>
          )}
        </div>

        <span className="rounded-full border border-zinc-800 px-3 py-1 text-sm text-zinc-400">
          {group.count}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2 text-xs text-zinc-500 sm:grid-cols-3">
        <Metric label="Recent" value={group.recentCount} />
        <Metric label="Replies" value={group.replyCount} />
        <Metric label="Views" value={group.viewCount} />
        <Metric label="Saves" value={group.saveCount} />
        <Metric label="Maps" value={group.conversationMapCount} />
        <Metric label="Ideas" value={group.relatedIdeasCount} />
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-zinc-900 bg-zinc-950 p-2">
      <p className="text-zinc-600">{label}</p>
      <p className="mt-1 text-base font-semibold text-zinc-200">
        {value.toLocaleString()}
      </p>
    </div>
  );
}

export default function AdminTopicMemoryPage() {
  const [authorized, setAuthorized] = useState(false);
  const [loading, setLoading] = useState(true);
  const [discussions, setDiscussions] = useState<Discussion[]>([]);
  const [tags, setTags] = useState<DiscussionTag[]>([]);
  const [aiOutputs, setAiOutputs] = useState<DiscussionAiOutput[]>([]);
  const [replies, setReplies] = useState<ReplyRow[]>([]);
  const [views, setViews] = useState<ViewRow[]>([]);
  const [bookmarks, setBookmarks] = useState<BookmarkRow[]>([]);
  const [message, setMessage] = useState("");

  useEffect(() => {
    async function loadTopicMemory() {
      const { data: userData } = await supabase.auth.getUser();

      if (!userData.user) {
        window.location.href = "/login";
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("is_admin")
        .eq("id", userData.user.id)
        .maybeSingle();

      if (!profile?.is_admin) {
        setAuthorized(false);
        setLoading(false);
        return;
      }

      setAuthorized(true);

      const [
        discussionResult,
        tagResult,
        aiOutputResult,
        replyResult,
        viewResult,
        bookmarkResult,
      ] = await Promise.all([
        supabase
          .from("discussions")
          .select("id, title, topic, reality_lens, created_at")
          .is("deleted_at", null)
          .order("created_at", { ascending: false })
          .limit(500),
        supabase
          .from("discussion_tags")
          .select("discussion_id, tag")
          .limit(2000),
        supabase
          .from("discussion_ai_outputs")
          .select("discussion_id, feature_key, generated_at")
          .in("feature_key", ["conversation_map", "related_ideas"])
          .limit(2000),
        supabase
          .from("replies")
          .select("discussion_id, created_at")
          .is("deleted_at", null)
          .limit(5000),
        supabase
          .from("discussion_views")
          .select("discussion_id")
          .limit(5000),
        supabase
          .from("bookmarks")
          .select("discussion_id")
          .limit(5000),
      ]);

      if (discussionResult.error) {
        setMessage(`Unable to load discussions: ${discussionResult.error.message}`);
        setLoading(false);
        return;
      }

      setDiscussions((discussionResult.data ?? []) as Discussion[]);
      setTags((tagResult.data ?? []) as DiscussionTag[]);
      setAiOutputs((aiOutputResult.data ?? []) as DiscussionAiOutput[]);
      setReplies((replyResult.data ?? []) as ReplyRow[]);
      setViews((viewResult.data ?? []) as ViewRow[]);
      setBookmarks((bookmarkResult.data ?? []) as BookmarkRow[]);
      setLoading(false);
    }

    loadTopicMemory();
  }, []);

  const memory = useMemo(() => {
    const recentCutoff = Date.now() - RECENT_DAYS * 24 * 60 * 60 * 1000;

    const tagMap: Record<string, string[]> = {};
    for (const row of tags) {
      tagMap[row.discussion_id] = [...(tagMap[row.discussion_id] ?? []), row.tag];
    }

    const replyCounts: Record<string, number> = {};
    for (const row of replies) {
      replyCounts[row.discussion_id] = (replyCounts[row.discussion_id] ?? 0) + 1;
    }

    const viewCounts: Record<string, number> = {};
    for (const row of views) {
      viewCounts[row.discussion_id] = (viewCounts[row.discussion_id] ?? 0) + 1;
    }

    const saveCounts: Record<string, number> = {};
    for (const row of bookmarks) {
      saveCounts[row.discussion_id] = (saveCounts[row.discussion_id] ?? 0) + 1;
    }

    const aiOutputMap: Record<string, Set<string>> = {};
    for (const row of aiOutputs) {
      aiOutputMap[row.discussion_id] ??= new Set<string>();
      aiOutputMap[row.discussion_id].add(row.feature_key);
    }

    const topicGroups: Record<string, MemoryGroup> = {};
    const lensGroups: Record<string, MemoryGroup> = {};
    const tagGroups: Record<string, MemoryGroup> = {};

    for (const discussion of discussions) {
      const isRecent = new Date(discussion.created_at).getTime() >= recentCutoff;
      const replyCount = replyCounts[discussion.id] ?? 0;
      const viewCount = viewCounts[discussion.id] ?? 0;
      const saveCount = saveCounts[discussion.id] ?? 0;
      const outputs = aiOutputMap[discussion.id] ?? new Set<string>();
      const hasConversationMap = outputs.has("conversation_map");
      const hasRelatedIdeas = outputs.has("related_ideas");

      incrementGroup(
        topicGroups,
        discussion.topic,
        discussion.topic,
        discussion,
        isRecent,
        replyCount,
        viewCount,
        saveCount,
        hasConversationMap,
        hasRelatedIdeas
      );

      if (discussion.reality_lens) {
        incrementGroup(
          lensGroups,
          discussion.reality_lens,
          discussion.reality_lens,
          discussion,
          isRecent,
          replyCount,
          viewCount,
          saveCount,
          hasConversationMap,
          hasRelatedIdeas
        );
      }

      for (const tag of tagMap[discussion.id] ?? []) {
        incrementGroup(
          tagGroups,
          tag.toLowerCase(),
          tag,
          discussion,
          isRecent,
          replyCount,
          viewCount,
          saveCount,
          hasConversationMap,
          hasRelatedIdeas
        );
      }
    }

    return {
      topics: sortMemoryGroups(topicGroups),
      lenses: sortMemoryGroups(lensGroups),
      tags: sortMemoryGroups(tagGroups),
    };
  }, [aiOutputs, bookmarks, discussions, replies, tags, views]);

  const totalReplies = replies.length;
  const totalViews = views.length;
  const totalSaves = bookmarks.length;
  const mappedDiscussions = new Set(aiOutputs.map((row) => row.discussion_id)).size;

  if (loading) {
    return (
      <main className="min-h-screen bg-black px-6 py-16 text-white">
        <div className="mx-auto max-w-6xl text-zinc-500">
          Loading topic memory...
        </div>
      </main>
    );
  }

  if (!authorized) {
    return (
      <main className="min-h-screen bg-black px-6 py-16 text-white">
        <div className="mx-auto max-w-3xl rounded-3xl border border-zinc-800 bg-zinc-950 p-8">
          <p className="mb-3 text-sm uppercase tracking-[0.3em] text-zinc-500">
            Admin
          </p>

          <h1 className="mb-4 text-4xl font-semibold tracking-tight">
            Access denied.
          </h1>

          <p className="leading-relaxed text-zinc-400">
            This area is available only to Loombus admin accounts.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-black px-6 py-16 text-white">
      <div className="mx-auto max-w-7xl">
        <Link href="/admin" className="mb-10 inline-block text-sm text-zinc-500 hover:text-white">
          ← Back to admin
        </Link>

        <div className="mb-10 rounded-3xl border border-zinc-800 bg-zinc-950 p-8">
          <p className="mb-4 text-sm uppercase tracking-[0.3em] text-zinc-500">
            Administration
          </p>

          <h1 className="mb-5 text-5xl font-semibold tracking-tight">
            Topic memory.
          </h1>

          <p className="max-w-3xl leading-relaxed text-zinc-400">
            Admin-only snapshot of recurring topic lanes, Reality Lenses, tags, and AI idea coverage. This is platform memory, not personal user memory.
          </p>
        </div>

        {message && (
          <div className="mb-8 rounded-2xl border border-zinc-800 bg-zinc-950 p-4 text-sm text-zinc-400">
            {message}
          </div>
        )}

        <section className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Metric label="Discussions" value={discussions.length} />
          <Metric label="Replies" value={totalReplies} />
          <Metric label="Views" value={totalViews} />
          <Metric label="Saves" value={totalSaves} />
        </section>

        <section className="mb-8 rounded-3xl border border-zinc-800 bg-zinc-950 p-6">
          <div className="mb-5">
            <p className="mb-2 text-sm uppercase tracking-[0.25em] text-zinc-500">
              Memory coverage
            </p>

            <h2 className="text-2xl font-medium">
              AI idea coverage.
            </h2>

            <p className="mt-3 max-w-3xl text-sm leading-relaxed text-zinc-500">
              Tracks how many discussions already have Conversation Map or Related Ideas outputs cached.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <Metric label="Mapped discussions" value={mappedDiscussions} />
            <Metric label="Conversation maps" value={aiOutputs.filter((row) => row.feature_key === "conversation_map").length} />
            <Metric label="Related ideas" value={aiOutputs.filter((row) => row.feature_key === "related_ideas").length} />
          </div>
        </section>

        <MemorySection
          title="Recurring topics"
          description="Primary discussion lanes with the strongest accumulated activity."
          groups={memory.topics}
        />

        <MemorySection
          title="Recurring Reality Lenses"
          description="Human-reality themes that keep appearing across discussions."
          groups={memory.lenses}
        />

        <MemorySection
          title="Recurring tags"
          description="Member-supplied tags that are forming early idea clusters."
          groups={memory.tags}
        />
      </div>
    </main>
  );
}

function MemorySection({
  title,
  description,
  groups,
}: {
  title: string;
  description: string;
  groups: MemoryGroup[];
}) {
  return (
    <section className="mb-8 rounded-3xl border border-zinc-800 bg-zinc-950 p-6">
      <div className="mb-5 flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="mb-2 text-sm uppercase tracking-[0.25em] text-zinc-500">
            Long-term memory
          </p>

          <h2 className="text-2xl font-medium">
            {title}
          </h2>

          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-zinc-500">
            {description}
          </p>
        </div>

        <span className="rounded-full border border-zinc-800 px-3 py-1 text-sm text-zinc-400">
          Top {Math.min(groups.length, 12)}
        </span>
      </div>

      {groups.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {groups.slice(0, 12).map((group) => (
            <MemoryCard key={group.key} group={group} />
          ))}
        </div>
      ) : (
        <div className="rounded-2xl border border-zinc-900 bg-black p-4 text-sm text-zinc-500">
          No memory signals available yet.
        </div>
      )}
    </section>
  );
}
