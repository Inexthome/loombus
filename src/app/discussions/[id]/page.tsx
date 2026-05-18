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
};

type Reply = {
  id: string;
  user_id: string;
  body: string;
  created_at: string;
};

export default function DiscussionPage() {
  const params = useParams();
  const id = params.id as string;

  const [discussion, setDiscussion] = useState<Discussion | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [replies, setReplies] = useState<Reply[]>([]);
  const [replyProfiles, setReplyProfiles] = useState<Record<string, Profile>>({});
  const [replyBody, setReplyBody] = useState("");
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  useEffect(() => {
    async function loadDiscussion() {
      const { data: discussionData, error: discussionError } = await supabase
        .from("discussions")
        .select("*")
        .eq("id", id)
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

    const { data: userData } = await supabase.auth.getUser();

    if (!userData.user) {
      window.location.href = "/login";
      return;
    }

    const { error } = await supabase.from("replies").insert({
      discussion_id: id,
      user_id: userData.user.id,
      body: replyBody,
    });

    if (error) {
      setMessage(`Error: ${error.message}`);
      return;
    }

    setReplyBody("");
    window.location.reload();
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
          by {profile?.full_name ?? "Loombus member"}
        </p>

        <p className="mb-10 text-xl leading-relaxed text-zinc-300">
          {discussion.body}
        </p>

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
              placeholder="Contribute with clarity, context, and signal..."
              className="mb-4 w-full rounded-xl border border-zinc-800 bg-black px-4 py-3 text-white outline-none focus:border-zinc-500"
            />

            <button
              type="button"
              onClick={handleReply}
              className="rounded-full bg-white px-5 py-3 text-sm text-black transition hover:bg-zinc-200"
            >
              Post Reply
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
                  {replyProfiles[reply.user_id]?.full_name ?? "Loombus member"}
                </p>

                <p className="leading-relaxed text-zinc-300">
                  {reply.body}
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
