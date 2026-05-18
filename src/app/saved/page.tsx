"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";

type SavedDiscussion = {
  id: string;
  created_at: string;
  discussions: {
    id: string;
    title: string;
    topic: string;
    body: string;
    created_at: string;
  } | null;
};

export default function SavedPage() {
  const [saved, setSaved] = useState<SavedDiscussion[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  useEffect(() => {
    async function loadSaved() {
      const { data: userData } = await supabase.auth.getUser();

      if (!userData.user) {
        window.location.href = "/login";
        return;
      }

      const { data } = await supabase
        .from("bookmarks")
        .select(`
          id,
          created_at,
          discussions (
            id,
            title,
            topic,
            body,
            created_at
          )
        `)
        .eq("user_id", userData.user.id)
        .order("created_at", { ascending: false });

      const normalized = (data ?? []).map((item) => ({
        ...item,
        discussions: Array.isArray(item.discussions)
          ? item.discussions[0] ?? null
          : item.discussions,
      })) as SavedDiscussion[];

      setSaved(normalized);
      setLoading(false);
    }

    loadSaved();
  }, []);

  async function removeBookmark(bookmarkId: string) {
    setMessage("");

    const { error } = await supabase
      .from("bookmarks")
      .delete()
      .eq("id", bookmarkId);

    if (error) {
      setMessage("Unable to remove bookmark.");
      return;
    }

    setSaved((current) =>
      current.filter((item) => item.id !== bookmarkId)
    );

    setMessage("Bookmark removed.");
  }

  return (
    <main className="min-h-screen bg-black px-6 py-16 text-white">
      <div className="mx-auto max-w-4xl">
        <h1 className="mb-6 text-5xl font-semibold tracking-tight">
          Saved discussions
        </h1>

        <p className="mb-12 text-zinc-500">
          Discussions you saved for later reflection.
        </p>

        {loading && (
          <p className="text-zinc-500">
            Loading saved discussions...
          </p>
        )}

        {!loading && saved.length === 0 && (
          <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-6">
            <h2 className="mb-3 text-2xl font-medium">
              Nothing saved yet.
            </h2>

            <p className="text-zinc-400">
              Save discussions that are worth revisiting.
            </p>
          </div>
        )}

        {message && (
          <p className="mb-6 text-sm text-zinc-500">
            {message}
          </p>
        )}

        <div className="space-y-6">
          {saved.map((item) => {
            const discussion = item.discussions;

            if (!discussion) {
              return null;
            }

            return (
              <div
                key={item.id}
                className="rounded-2xl border border-zinc-800 bg-zinc-950 p-6"
              >
                <a
                  href={`/discussions/${discussion.id}`}
                  className="block transition hover:opacity-90"
                >
                  <p className="mb-3 text-sm text-zinc-500">
                    {discussion.topic}
                  </p>

                  <h2 className="mb-3 text-2xl font-medium">
                    {discussion.title}
                  </h2>

                  <p className="mb-4 line-clamp-2 leading-relaxed text-zinc-400">
                    {discussion.body}
                  </p>
                </a>

                <div className="flex items-center justify-between gap-4">
                  <p className="text-sm text-zinc-600">
                    Saved {new Date(item.created_at).toLocaleDateString()}
                  </p>

                  <button
                    onClick={() => removeBookmark(item.id)}
                    className="rounded-full border border-zinc-700 px-4 py-2 text-sm text-zinc-400 transition hover:border-zinc-500 hover:text-white"
                  >
                    Remove
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </main>
  );
}
