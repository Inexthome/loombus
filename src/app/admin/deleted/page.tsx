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

      const { data } = await supabase
        .from("discussions")
        .select("*")
        .not("deleted_at", "is", null)
        .order("deleted_at", { ascending: false });

      setDiscussions(data ?? []);
      setLoading(false);
    }

    loadDeleted();
  }, []);

  async function restoreDiscussion(id: string) {
    await supabase
      .from("discussions")
      .update({
        deleted_at: null,
        deleted_by: null,
        deletion_reason: null,
      })
      .eq("id", id);

    const { data: userData } = await supabase.auth.getUser();

    if (userData.user) {
      await supabase.from("audit_logs").insert({
        actor_id: userData.user.id,
        action: "discussion.restored",
        target_type: "discussion",
        target_id: id,
      });
    }

    setDiscussions((current) =>
      current.filter((discussion) => discussion.id !== id)
    );
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
                  className="rounded-full border border-emerald-800 px-4 py-2 text-sm text-emerald-400 transition hover:border-emerald-600 hover:text-emerald-300"
                >
                  Restore
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
            <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-8 text-zinc-500">
              No deleted discussions.
            </div>
          )}
        </div>

      </div>
    </main>
  );
}
