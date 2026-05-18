"use client";

import Link from "next/link";
import { useState } from "react";
import { supabase } from "@/lib/supabase/client";

export default function CreatePage() {
  const [title, setTitle] = useState("");
  const [topic, setTopic] = useState("AI & Society");
  const [body, setBody] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleCreate() {
    setLoading(true);
    setMessage("");

    if (!title.trim()) {
      setMessage("Please enter a discussion title.");
      setLoading(false);
      return;
    }

    if (!body.trim()) {
      setMessage("Please enter discussion content.");
      setLoading(false);
      return;
    }

    const { data: userData } = await supabase.auth.getUser();

    if (!userData.user) {
      window.location.href = "/login";
      return;
    }

    const { data, error } = await supabase
      .from("discussions")
      .insert({
        user_id: userData.user.id,
        title,
        topic,
        body,
      })
      .select()
      .single();

    if (error) {
      setMessage(`Error: ${error.message}`);
      setLoading(false);
      return;
    }

    window.location.href = `/discussions/${data.id}`;
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

        <p className="mb-4 text-sm uppercase tracking-[0.3em] text-zinc-500">
          New Discussion
        </p>

        <h1 className="mb-6 text-5xl font-semibold tracking-tight">
          Create a discussion.
        </h1>

        <p className="mb-12 max-w-2xl leading-relaxed text-zinc-400">
          Start a thoughtful discussion designed around signal,
          clarity, and meaningful contribution.
        </p>

        <form className="space-y-6 rounded-2xl border border-zinc-800 bg-zinc-950 p-8">
          <div>
            <label className="mb-2 block text-sm text-zinc-400">
              Discussion Title
            </label>

            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="How AI changes trust online"
              className="w-full rounded-xl border border-zinc-800 bg-black px-4 py-3 text-white outline-none focus:border-zinc-500"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm text-zinc-400">
              Topic
            </label>

            <select
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              className="w-full rounded-xl border border-zinc-800 bg-black px-4 py-3 text-white outline-none focus:border-zinc-500"
            >
              <option>AI & Society</option>
              <option>Systems</option>
              <option>Future of Work</option>
              <option>Psychology</option>
              <option>Economics</option>
              <option>Technology</option>
              <option>Healthcare</option>
              <option>Education</option>
              <option>Business</option>
            </select>
          </div>

          <div>
            <label className="mb-2 block text-sm text-zinc-400">
              Discussion Body
            </label>

            <textarea
              rows={10}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Write your discussion..."
              className="w-full rounded-xl border border-zinc-800 bg-black px-4 py-3 text-white outline-none focus:border-zinc-500"
            />
          </div>

          <button
            type="button"
            onClick={handleCreate}
            disabled={loading}
            className="rounded-full bg-white px-6 py-3 text-black transition hover:bg-zinc-200 disabled:opacity-50"
          >
            {loading ? "Publishing..." : "Publish Discussion"}
          </button>

          {message && <p className="text-sm text-zinc-400">{message}</p>}
        </form>
      </div>
    </main>
  );
}
