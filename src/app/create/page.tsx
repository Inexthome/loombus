"use client";

import Link from "next/link";
import { type FormEvent, type KeyboardEvent, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { DEFAULT_DISCUSSION_TOPIC, DISCUSSION_TOPICS } from "@/lib/discussion-topics";

type Profile = {
  full_name: string | null;
  username: string | null;
  bio: string | null;
  avatar_url: string | null;
};

function getMissingProfileFields(profile: Profile | null) {
  const missing = [];

  if (!profile?.username?.trim()) {
    missing.push("username");
  }

  if (!profile?.full_name?.trim()) {
    missing.push("full name");
  }

  if (!profile?.bio?.trim()) {
    missing.push("bio");
  }

  if (!profile?.avatar_url?.trim()) {
    missing.push("profile image");
  }

  return missing;
}

export default function CreatePage() {
  const [title, setTitle] = useState("");
  const [topic, setTopic] = useState<string>(DEFAULT_DISCUSSION_TOPIC);
  const [body, setBody] = useState("");
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);
  const [message, setMessage] = useState("");
  const [publishing, setPublishing] = useState(false);

  useEffect(() => {
    async function loadProfileStatus() {
      const { data: userData } = await supabase.auth.getUser();

      if (!userData.user) {
        setIsLoggedIn(false);
        setAuthChecked(true);
        return;
      }

      setIsLoggedIn(true);

      const { data: profileData } = await supabase
        .from("profiles")
        .select("full_name, username, bio, avatar_url")
        .eq("id", userData.user.id)
        .maybeSingle();

      setProfile(profileData ?? null);
      setAuthChecked(true);
    }

    loadProfileStatus();
  }, []);

  const missingProfileFields = useMemo(
    () => getMissingProfileFields(profile),
    [profile]
  );

  const profileComplete = missingProfileFields.length === 0;

  async function handleCreate(
    event?: FormEvent<HTMLFormElement> | KeyboardEvent<HTMLFormElement>
  ) {
    event?.preventDefault();

    if (publishing) {
      return;
    }

    setPublishing(true);
    setMessage("");

    if (!title.trim()) {
      setMessage("Please enter a discussion title.");
      setPublishing(false);
      return;
    }

    if (!body.trim()) {
      setMessage("Please enter discussion content.");
      setPublishing(false);
      return;
    }

    const { data: sessionData } = await supabase.auth.getSession();

    if (!sessionData.session) {
      window.location.href = "/login";
      return;
    }

    const response = await fetch("/api/discussions/create", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${sessionData.session.access_token}`,
      },
      body: JSON.stringify({
        title,
        topic,
        body,
      }),
    });

    const result = await response.json();

    if (!response.ok) {
      setMessage(result.error ?? "Unable to publish discussion.");
      setPublishing(false);
      return;
    }

    window.location.href = `/discussions/${result.discussion.id}`;
  }

  function handleFormKeyDown(event: KeyboardEvent<HTMLFormElement>) {
    if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
      handleCreate(event);
    }
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

        <p className="mb-8 max-w-2xl leading-relaxed text-zinc-400">
          Start a thoughtful discussion designed around signal,
          clarity, and meaningful contribution.
        </p>

        {!authChecked && (
          <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-6">
            <p className="text-zinc-400">
              Checking your account status...
            </p>
          </div>
        )}

        {authChecked && !isLoggedIn && (
          <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-6">
            <p className="mb-2 text-sm uppercase tracking-[0.25em] text-zinc-500">
              Login Required
            </p>

            <h2 className="mb-4 text-2xl font-medium">
              Log in to create a discussion.
            </h2>

            <p className="mb-6 leading-relaxed text-zinc-400">
              You can browse discussions without an account, but you need to log in before starting a new conversation.
            </p>

            <div className="flex flex-wrap gap-3">
              <Link
                href="/login"
                className="rounded-full bg-white px-6 py-3 text-sm text-black transition hover:bg-zinc-200"
              >
                Log In
              </Link>

              <Link
                href="/signup"
                className="rounded-full border border-zinc-700 px-6 py-3 text-sm text-zinc-300 transition hover:border-zinc-500 hover:text-white"
              >
                Create Account
              </Link>
            </div>
          </div>
        )}


        {authChecked && isLoggedIn && !profileComplete && (
          <div className="mb-8 rounded-2xl border border-zinc-800 bg-zinc-950 p-5">
            <p className="mb-2 text-sm font-medium text-zinc-300">
              Your profile is not complete yet.
            </p>

            <p className="mb-4 text-sm leading-relaxed text-zinc-500">
              You can still publish, but adding your {missingProfileFields.join(", ")}
              helps other members recognize your contributions.
            </p>

            <Link
              href="/profile"
              className="text-sm text-zinc-300 underline decoration-zinc-700 underline-offset-4 transition hover:text-white hover:decoration-white"
            >
              Complete your profile →
            </Link>
          </div>
        )}

        {authChecked && isLoggedIn && (
          <form
          onSubmit={handleCreate}
          onKeyDown={handleFormKeyDown}
          className="space-y-6 rounded-2xl border border-zinc-800 bg-zinc-950 p-8"
        >
          <div>
            <label className="mb-2 block text-sm text-zinc-400">
              Discussion Title
            </label>

            <input
              type="text"
              value={title}
              required
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
              {DISCUSSION_TOPICS.map((topicOption) => (
                <option key={topicOption} value={topicOption}>
                  {topicOption}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-2 block text-sm text-zinc-400">
              Discussion Body
            </label>

            <textarea
              rows={10}
              value={body}
              required
              onChange={(e) => setBody(e.target.value)}
              placeholder="Write your discussion..."
              className="w-full rounded-xl border border-zinc-800 bg-black px-4 py-3 text-white outline-none focus:border-zinc-500"
            />
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <button
              type="submit"
              disabled={publishing}
            className="rounded-full bg-white px-6 py-3 text-black transition hover:bg-zinc-200 disabled:opacity-50"
          >
              {publishing ? "Publishing..." : "Publish Discussion"}
            </button>

            <p className="text-sm text-zinc-600">
              Press Cmd+Enter or Ctrl+Enter to publish.
            </p>
          </div>

          {message && <p className="text-sm text-zinc-400">{message}</p>}
          </form>
        )}
      </div>
    </main>
  );
}
