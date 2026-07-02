"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";

type Discussion = {
  id: string;
  title: string;
  topic: string;
  body: string;
  deleted_at: string | null;
  deletion_reason: string | null;
};

export default function DeletedContentPage() {
  const [authorized, setAuthorized] = useState(false);
  const [loading, setLoading] = useState(true);
  const [discussions, setDiscussions] = useState<Discussion[]>([]);
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  useEffect(() => {
    async function loadDeleted() {
      const { data: userData } = await supabase.auth.getUser();

      if (!userData.user) {
        window.location.href = "/login";
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("is_admin")
        .eq("id", userData.user.id)
        .single();

      if (!profile?.is_admin) {
        setAuthorized(false);
        setLoading(false);
        return;
      }

      setAuthorized(true);

      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;

      if (!accessToken) {
        window.location.href = "/login";
        return;
      }

      const response = await fetch("/api/admin/deleted", {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      const result = await response.json().catch(() => ({}));

      if (!response.ok) {
        setMessage(`Unable to load deleted discussions: ${result.error ?? "Unknown error."}`);
        setLoading(false);
        return;
      }

      setDiscussions(result.discussions ?? []);
      setLoading(false);
    }

    loadDeleted();
  }, []);

  async function restoreDiscussion(id: string) {
    setMessage("");
    setRestoringId(id);

    const { data: sessionData } = await supabase.auth.getSession();
    const accessToken = sessionData.session?.access_token;

    if (!accessToken) {
      setRestoringId(null);
      window.location.href = "/login";
      return;
    }

    const response = await fetch("/api/admin/moderation/actions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        action: "restore_discussion",
        discussionId: id,
      }),
    });

    const result = await response.json().catch(() => ({}));

    if (!response.ok) {
      setMessage(result.error ?? "Unable to restore discussion.");
      setRestoringId(null);
      return;
    }

    setDiscussions((current) =>
      current.filter((discussion) => discussion.id !== id)
    );
    setMessage("Discussion restored.");
    setRestoringId(null);
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-black px-6 py-16 text-white">
        <div className="mx-auto max-w-6xl text-zinc-400">
          Loading deleted discussions...
        </div>
      </main>
    );
  }

  if (!authorized) {
    return (
      <main className="min-h-screen bg-black px-6 py-16 text-white">
        <div className="mx-auto max-w-6xl">
          <h1 className="mb-4 text-5xl font-semibold tracking-tight">
            Access denied.
          </h1>

          <p className="text-zinc-400">
            Admin access required.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-black px-6 py-16 text-white">
      <div className="mx-auto max-w-6xl">

        <div className="mb-10 flex items-center justify-between">
          <div>
            <p className="mb-3 text-sm uppercase tracking-[0.3em] text-zinc-500">
              Administration
            </p>

            <h1 className="text-5xl font-semibold tracking-tight">
              Deleted Content
            </h1>
          </div>

          <Link
            href="/admin"
            className="rounded-full border border-zinc-700 px-5 py-3 text-sm text-zinc-300 transition hover:border-zinc-500 hover:text-white"
          >
            Back to Admin
          </Link>
        </div>

        <section className="mb-8 rounded-3xl border border-zinc-800 bg-zinc-950 p-6">
          <p className="mb-2 text-sm uppercase tracking-[0.25em] text-zinc-500">
            Restore review
          </p>

          <h2 className="mb-4 text-2xl font-medium">
            Restore discussions only after context review.
          </h2>

          <p className="mb-5 max-w-3xl text-sm leading-relaxed text-zinc-500">
            Restoring a deleted discussion returns it to public visibility. Review
            the title, topic, body, deletion time, and deletion reason before
            reversing a moderation action.
          </p>

          <div className="grid gap-4 md:grid-cols-3">
            <div className="rounded-2xl border border-zinc-900 bg-black p-4">
              <p className="mb-2 text-sm font-medium text-zinc-300">
                Check the reason
              </p>

              <p className="text-sm leading-relaxed text-zinc-600">
                Use the deletion reason and audit context to understand why it was removed.
              </p>
            </div>

            <div className="rounded-2xl border border-zinc-900 bg-black p-4">
              <p className="mb-2 text-sm font-medium text-zinc-300">
                Re-read the content
              </p>

              <p className="text-sm leading-relaxed text-zinc-600">
                Confirm the discussion is safe and appropriate before it returns to public view.
              </p>
            </div>

            <div className="rounded-2xl border border-zinc-900 bg-black p-4">
              <p className="mb-2 text-sm font-medium text-zinc-300">
                Restore deliberately
              </p>

              <p className="text-sm leading-relaxed text-zinc-600">
                Restore only when the original removal was mistaken or no longer necessary.
              </p>
            </div>
          </div>
        </section>

        {message && (
          <div className="mb-6 rounded-2xl border border-zinc-800 bg-zinc-950 p-4 text-sm text-zinc-400">
            {message}
          </div>
        )}

        <div className="space-y-6">
          {discussions.map((discussion) => (
            <div
              key={discussion.id}
              className="rounded-2xl border border-zinc-800 bg-zinc-950 p-6"
            >
              <div className="mb-4 flex items-center justify-between gap-4">
                <div>
                  <p className="mb-2 text-xs uppercase tracking-[0.25em] text-zinc-500">
                    {discussion.topic}
                  </p>

                  <h2 className="text-2xl font-semibold">
                    {discussion.title}
                  </h2>
                </div>

                <button
                  onClick={() => restoreDiscussion(discussion.id)}
                  disabled={restoringId === discussion.id}
                  className="rounded-full border border-emerald-800 px-4 py-2 text-sm text-emerald-400 transition hover:border-emerald-600 hover:text-emerald-300 disabled:cursor-not-allowed disabled:border-zinc-900 disabled:text-zinc-700"
                >
                  {restoringId === discussion.id ? "Restoring..." : "Restore"}
                </button>
              </div>

              <p className="mb-4 whitespace-pre-wrap leading-relaxed text-zinc-400">
                {discussion.body}
              </p>

              <div className="flex flex-wrap gap-4 text-xs text-zinc-500">
                <span>
                  Deleted:{" "}
                  {discussion.deleted_at
                    ? new Date(discussion.deleted_at).toLocaleString()
                    : "Unknown"}
                </span>

                {discussion.deletion_reason && (
                  <span>
                    Reason: {discussion.deletion_reason}
                  </span>
                )}
              </div>
            </div>
          ))}

          {!discussions.length && (
            <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-8">
              <h2 className="mb-3 text-2xl font-medium">
                No deleted discussions.
              </h2>

              <p className="max-w-2xl text-zinc-500">
                Soft-deleted discussions will appear here when an admin removes
                them from public view. Restored discussions leave this queue.
              </p>
            </div>
          )}
        </div>

      </div>
    </main>
  );
}
