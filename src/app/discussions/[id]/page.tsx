"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabase/client";

type Discussion = {
  id: string;
  user_id: string;
  title: string;
  topic: string;
  body: string;
  created_at: string;
};

type Profile = {
  id: string;
  full_name: string | null;
  username: string | null;
};

type Reply = {
  id: string;
  user_id: string;
  body: string;
  created_at: string;
};

function MentionText({ text }: { text: string }) {
  const parts = text.split(/(@[a-zA-Z0-9_]{2,30})/g);

  return (
    <>
      {parts.map((part, index) => {
        const match = part.match(/^@([a-zA-Z0-9_]{2,30})$/);

        if (!match) {
          return <span key={`${part}-${index}`}>{part}</span>;
        }

        const username = match[1].toLowerCase();

        return (
          <Link
            key={`${part}-${index}`}
            href={`/u/${username}`}
            className="font-medium text-white underline decoration-zinc-600 underline-offset-4 transition hover:decoration-white"
          >
            @{username}
          </Link>
        );
      })}
    </>
  );
}

function ProfileName({
  profile,
  fallback = "Loombus member",
}: {
  profile?: Profile | null;
  fallback?: string;
}) {
  const label =
    profile?.full_name || (profile?.username ? `@${profile.username}` : fallback);

  if (!profile?.username) {
    return <>{label}</>;
  }

  return (
    <Link
      href={`/u/${profile.username}`}
      className="text-zinc-400 transition hover:text-white"
    >
      {label}
    </Link>
  );
}

export default function DiscussionPage() {
  const params = useParams();
  const id = params.id as string;

  const [discussion, setDiscussion] = useState<Discussion | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [replies, setReplies] = useState<Reply[]>([]);
  const [replyProfiles, setReplyProfiles] = useState<Record<string, Profile>>({});
  const [replyBody, setReplyBody] = useState("");
  const [postingReply, setPostingReply] = useState(false);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [bookmarkMessage, setBookmarkMessage] = useState("");
  const [isSaved, setIsSaved] = useState(false);
  const [reportMessage, setReportMessage] = useState("");

  useEffect(() => {
    async function loadDiscussion() {
      const { data: discussionData, error: discussionError } = await supabase
        .from("discussions")
        .select("*")
        .eq("id", id)
        .is("deleted_at", null)
        .is("deleted_at", null)
        .single();

      if (discussionError || !discussionData) {
        setDiscussion(null);
        setLoading(false);
        return;
      }

      const { data: profileData } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", discussionData.user_id)
        .single();

      const { data: repliesData } = await supabase
        .from("replies")
        .select("*")
        .eq("discussion_id", id)
        .is("deleted_at", null)
        .is("deleted_at", null)
        .order("created_at", { ascending: true });

      const replyUserIds = [...new Set((repliesData ?? []).map((reply) => reply.user_id))];

      const replyProfileMap: Record<string, Profile> = {};

      if (replyUserIds.length > 0) {
        const { data: replyProfileData } = await supabase
          .from("profiles")
          .select("*")
          .in("id", replyUserIds);

        for (const replyProfile of replyProfileData ?? []) {
          replyProfileMap[replyProfile.id] = replyProfile;
        }
      }

      const { data: viewerData } = await supabase.auth.getUser();

      await supabase.from("discussion_views").insert({
        discussion_id: id,
        viewer_id: viewerData.user?.id ?? null,
      });

      if (viewerData.user) {
        const { data: savedData } = await supabase
          .from("bookmarks")
          .select("id")
          .eq("user_id", viewerData.user.id)
          .eq("discussion_id", id)
          .maybeSingle();

        setIsSaved(Boolean(savedData));
      }

      setDiscussion(discussionData);
      setProfile(profileData ?? null);
      setReplies(repliesData ?? []);
      setReplyProfiles(replyProfileMap);
      setLoading(false);
    }

    loadDiscussion();
  }, [id]);

  async function handleReply() {
    setMessage("");

    if (postingReply) {
      return;
    }

    if (!replyBody.trim()) {
      setMessage("Reply cannot be empty.");
      return;
    }

    setPostingReply(true);

    try {
      const { data: sessionData } = await supabase.auth.getSession();

      if (!sessionData.session) {
        window.location.href = "/login";
        return;
      }

      const response = await fetch("/api/replies/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${sessionData.session.access_token}`,
        },
        body: JSON.stringify({
          discussionId: id,
          body: replyBody,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        setMessage(result.error ?? "Unable to post reply.");
        return;
      }

      const newReply = result.reply as Reply | undefined;

      if (newReply) {
        setReplies((current) => [...current, newReply]);

        const { data: profileData } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", newReply.user_id)
          .single();

        if (profileData) {
          setReplyProfiles((current) => ({
            ...current,
            [newReply.user_id]: profileData,
          }));
        }
      }

      setReplyBody("");
      setMessage("Reply posted.");
    } finally {
      setPostingReply(false);
    }
  }

  async function handleBookmark() {
    setBookmarkMessage("");

    const { data: userData } = await supabase.auth.getUser();

    if (!userData.user) {
      window.location.href = "/login";
      return;
    }

    const { error } = await supabase.from("bookmarks").insert({
      user_id: userData.user.id,
      discussion_id: id,
    });

    if (error) {
      setBookmarkMessage("Already saved or unable to save.");
      return;
    }

    setIsSaved(true);
    setBookmarkMessage("Discussion saved.");
  }

  async function handleReport() {
    setReportMessage("");

    const { data: userData } = await supabase.auth.getUser();

    if (!userData.user) {
      window.location.href = "/login";
      return;
    }

    const { error } = await supabase.from("reports").insert({
      reporter_id: userData.user.id,
      discussion_id: id,
      reason: "User submitted report",
    });

    if (error) {
      setReportMessage("Unable to submit report.");
      return;
    }

    setReportMessage("Discussion reported.");
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-black px-6 py-16 text-white">
        <div className="mx-auto max-w-3xl text-zinc-400">
          Loading discussion...
        </div>
      </main>
    );
  }

  if (!discussion) {
    return (
      <main className="min-h-screen bg-black px-6 py-16 text-white">
        <div className="mx-auto max-w-3xl">
          <h1 className="mb-6 text-4xl font-semibold">
            Discussion not found.
          </h1>

          <Link href="/discussions" className="text-zinc-400 hover:text-white">
            ← Back to discussions
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-black px-6 py-16 text-white">
      <div className="mx-auto max-w-3xl">
        <Link
          href="/discussions"
          className="mb-10 inline-block text-sm text-zinc-500 hover:text-white"
        >
          ← Back to discussions
        </Link>

        <p className="mb-4 text-sm text-zinc-500">
          {discussion.topic}
        </p>

        <h1 className="mb-6 text-5xl font-semibold tracking-tight">
          {discussion.title}
        </h1>

        <p className="mb-3 text-sm text-zinc-600">
          by <ProfileName profile={profile} />
        </p>

        <p className="mb-10 text-xl leading-relaxed text-zinc-300">
          {discussion.body}
        </p>

        <div className="mb-12 flex flex-wrap items-center gap-4">
          <button
            onClick={handleBookmark}
            disabled={isSaved}
            className={`rounded-full border px-5 py-3 text-sm transition ${
              isSaved
                ? "border-zinc-800 bg-zinc-900 text-zinc-500"
                : "border-zinc-700 text-zinc-300 hover:border-zinc-500 hover:text-white"
            }`}
          >
            {isSaved ? "Saved" : "Save Discussion"}
          </button>

          <button
            onClick={handleReport}
            className="rounded-full border border-red-900 px-5 py-3 text-sm text-red-400 transition hover:border-red-700 hover:text-red-300"
          >
            Report Discussion
          </button>

          {(bookmarkMessage || reportMessage) && (
            <p className="text-sm text-zinc-500">
              {bookmarkMessage || reportMessage}
            </p>
          )}
        </div>

        <div className="mb-16 rounded-2xl border border-zinc-800 bg-zinc-950 p-6">
          <h2 className="mb-6 text-xl font-medium">
            AI Summary
          </h2>

          <p className="leading-relaxed text-zinc-400">
            AI summaries will be generated here later. For now, this section
            reserves space for the platform intelligence layer.
          </p>
        </div>

        <div>
          <h2 className="mb-8 text-2xl font-medium">
            Replies
          </h2>

          <form className="mb-10 rounded-2xl border border-zinc-800 bg-zinc-950 p-6">
            <label className="mb-3 block text-sm text-zinc-400">
              Add a thoughtful reply
            </label>

            <textarea
              rows={5}
              value={replyBody}
              onChange={(e) => setReplyBody(e.target.value)}
              disabled={postingReply}
              placeholder="Contribute with clarity, context, and signal... Use @username to mention someone."
              className="mb-4 w-full rounded-xl border border-zinc-800 bg-black px-4 py-3 text-white outline-none focus:border-zinc-500 disabled:cursor-not-allowed disabled:text-zinc-600"
            />

            <button
              type="button"
              onClick={handleReply}
              disabled={postingReply}
              className="rounded-full bg-white px-5 py-3 text-sm text-black transition hover:bg-zinc-200 disabled:cursor-not-allowed disabled:bg-zinc-700 disabled:text-zinc-400"
            >
              {postingReply ? "Posting..." : "Post Reply"}
            </button>

            {message && <p className="mt-4 text-sm text-zinc-400">{message}</p>}
          </form>

          <div className="space-y-6">
            {replies.map((reply) => (
              <div
                key={reply.id}
                className="rounded-2xl border border-zinc-800 bg-zinc-950 p-6"
              >
                <p className="mb-4 text-sm text-zinc-500">
                  <ProfileName profile={replyProfiles[reply.user_id]} />
                </p>

                <p className="whitespace-pre-wrap leading-relaxed text-zinc-300">
                  <MentionText text={reply.body} />
                </p>
              </div>
            ))}

            {replies.length === 0 && (
              <p className="text-zinc-500">
                No replies yet. Be the first to contribute.
              </p>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
