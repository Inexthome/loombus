"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { DISCUSSION_TOPICS } from "@/lib/discussion-topics";
import { supabase } from "@/lib/supabase/client";

type Profile = {
  full_name: string | null;
  username: string | null;
  bio: string | null;
  avatar_url: string | null;
};

type StepStatus = "complete" | "active" | "next";

function isFilled(value: string | null | undefined) {
  return Boolean(value?.trim());
}

function StepCard({
  eyebrow,
  title,
  description,
  href,
  action,
  status,
}: {
  eyebrow: string;
  title: string;
  description: string;
  href: string;
  action: string;
  status: StepStatus;
}) {
  const statusLabel =
    status === "complete" ? "Complete" : status === "active" ? "Recommended" : "Next";

  return (
    <div className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm">
      <div className="mb-4 flex items-center justify-between gap-3">
        <p className="text-xs font-bold uppercase tracking-[0.24em] text-zinc-500">{eyebrow}</p>
        <span
          className={
            status === "complete"
              ? "rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700"
              : status === "active"
                ? "rounded-full bg-zinc-900 px-3 py-1 text-xs font-bold text-white"
                : "rounded-full bg-zinc-100 px-3 py-1 text-xs font-bold text-zinc-600"
          }
        >
          {statusLabel}
        </span>
      </div>

      <h2 className="text-xl font-black tracking-tight text-zinc-950">{title}</h2>
      <p className="mt-3 text-sm leading-6 text-zinc-600">{description}</p>

      <Link
        href={href}
        className="mt-6 inline-flex rounded-full bg-zinc-950 px-5 py-3 text-sm font-bold text-white transition hover:bg-zinc-800"
      >
        {action}
      </Link>
    </div>
  );
}

export default function OnboardingPage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [discussionCount, setDiscussionCount] = useState<number>(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function loadOnboardingState() {
      const { data: userData } = await supabase.auth.getUser();

      if (!userData.user) {
        window.location.replace("/login");
        return;
      }

      const [{ data: profileData }, { count }] = await Promise.all([
        supabase
          .from("profiles")
          .select("full_name, username, bio, avatar_url")
          .eq("id", userData.user.id)
          .maybeSingle(),
        supabase
          .from("discussions")
          .select("id", { count: "exact", head: true })
          .eq("user_id", userData.user.id)
          .is("deleted_at", null),
      ]);

      if (!mounted) {
        return;
      }

      setProfile((profileData as Profile | null) ?? null);
      setDiscussionCount(count ?? 0);
      setLoading(false);
    }

    loadOnboardingState();

    return () => {
      mounted = false;
    };
  }, []);

  const completedFields = [
    isFilled(profile?.full_name),
    isFilled(profile?.username),
    isFilled(profile?.bio),
    isFilled(profile?.avatar_url),
  ].filter(Boolean).length;

  const profileComplete = completedFields >= 3 && isFilled(profile?.username);
  const hasStartedDiscussion = discussionCount > 0;

  const suggestedTopics = DISCUSSION_TOPICS.slice(0, 8);

  return (
    <main data-loombus-onboarding className="min-h-screen bg-zinc-50 px-6 py-10">
      <div className="mx-auto max-w-6xl">
        <div className="rounded-[2rem] border border-zinc-200 bg-white p-8 shadow-sm md:p-10">
          <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-sm font-bold uppercase tracking-[0.28em] text-zinc-500">
                New member setup
              </p>
              <h1 className="mt-4 max-w-3xl text-4xl font-black tracking-tight text-zinc-950 md:text-5xl">
                Build your Loombus signal before the platform gets deep.
              </h1>
              <p className="mt-5 max-w-2xl text-base leading-7 text-zinc-600">
                Start with a clear profile, choose a topic lane, understand Reality Lenses,
                and post your first thoughtful discussion. From there, Loombus helps you save,
                revisit, organize, and understand discussions without turning the platform into noise.
              </p>
            </div>

            <Link
              href="/dashboard"
              className="inline-flex rounded-full border border-zinc-300 px-5 py-3 text-sm font-bold text-zinc-800 transition hover:border-zinc-950 hover:text-zinc-950"
            >
              Continue to dashboard
            </Link>
          </div>

          {loading ? (
            <div className="mt-8 rounded-2xl bg-zinc-100 p-5 text-sm font-semibold text-zinc-600">
              Loading your setup progress...
            </div>
          ) : (
            <div className="mt-8 grid gap-4 md:grid-cols-4">
              <div className="rounded-2xl bg-zinc-950 p-5 text-white">
                <p className="text-xs font-bold uppercase tracking-[0.24em] text-zinc-400">
                  Profile
                </p>
                <p className="mt-3 text-3xl font-black">{completedFields}/4</p>
                <p className="mt-2 text-sm text-zinc-300">basic fields completed</p>
              </div>

              <div className="rounded-2xl bg-zinc-100 p-5">
                <p className="text-xs font-bold uppercase tracking-[0.24em] text-zinc-500">
                  Username
                </p>
                <p className="mt-3 text-lg font-black text-zinc-950">
                  {profile?.username ? `@${profile.username}` : "Not set"}
                </p>
                <p className="mt-2 text-sm text-zinc-600">how others recognize you</p>
              </div>

              <div className="rounded-2xl bg-zinc-100 p-5">
                <p className="text-xs font-bold uppercase tracking-[0.24em] text-zinc-500">
                  Discussions
                </p>
                <p className="mt-3 text-3xl font-black text-zinc-950">{discussionCount}</p>
                <p className="mt-2 text-sm text-zinc-600">started by you</p>
              </div>

              <div className="rounded-2xl bg-zinc-100 p-5">
                <p className="text-xs font-bold uppercase tracking-[0.24em] text-zinc-500">
                  Focus
                </p>
                <p className="mt-3 text-lg font-black text-zinc-950">Signal over noise</p>
                <p className="mt-2 text-sm text-zinc-600">depth before attention, tools after context</p>
              </div>
            </div>
          )}
        </div>

        <section className="mt-8 grid gap-5 lg:grid-cols-3">
          <StepCard
            eyebrow="Step 1"
            title="Complete your public profile"
            description="A clear name, username, image, and short bio make your discussions easier to trust and easier to follow."
            href="/profile"
            action={profileComplete ? "Review profile" : "Complete profile"}
            status={profileComplete ? "complete" : "active"}
          />

          <StepCard
            eyebrow="Step 2"
            title="Start your first discussion"
            description="Ask a serious question, share an observation, or frame a problem where thoughtful replies can add value."
            href="/create"
            action={hasStartedDiscussion ? "Start another discussion" : "Start first discussion"}
            status={hasStartedDiscussion ? "complete" : profileComplete ? "active" : "next"}
          />

          <StepCard
            eyebrow="Step 3"
            title="Find people and conversations"
            description="Browse members and active discussions so your first follows are based on substance, not noise."
            href="/people"
            action="Browse people"
            status="next"
          />
        </section>

        <section className="mt-8 rounded-[2rem] border border-zinc-200 bg-white p-8 shadow-sm">
          <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-sm font-bold uppercase tracking-[0.28em] text-zinc-500">
                Suggested topic lanes
              </p>
              <h2 className="mt-3 text-2xl font-black tracking-tight text-zinc-950">
                Pick a lane before you post.
              </h2>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-600">
                Topics help Loombus organize higher-signal discussions. Start with one that matches
                what you want to think through deeply, then use Reality Lenses when the human context
                behind a topic matters.
              </p>
            </div>

            <Link
              href="/discussions"
              className="inline-flex rounded-full bg-zinc-950 px-5 py-3 text-sm font-bold text-white transition hover:bg-zinc-800"
            >
              Browse discussions
            </Link>
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            {suggestedTopics.map((topic) => (
              <Link
                key={topic}
                href={`/discussions?topic=${encodeURIComponent(topic)}`}
                className="rounded-full border border-zinc-200 bg-zinc-50 px-4 py-2 text-sm font-bold text-zinc-700 transition hover:border-zinc-950 hover:bg-white hover:text-zinc-950"
              >
                {topic}
              </Link>
            ))}
          </div>
        </section>

        <section className="mt-8 rounded-[2rem] border border-zinc-200 bg-zinc-950 p-8 text-white shadow-sm">
          <p className="text-sm font-bold uppercase tracking-[0.28em] text-zinc-400">
            First discussion guidance
          </p>
          <h2 className="mt-3 text-2xl font-black tracking-tight">A strong first post is specific.</h2>
          <div className="mt-6 grid gap-4 md:grid-cols-3">
            <div className="rounded-2xl bg-white/10 p-5">
              <p className="font-black">Frame the problem</p>
              <p className="mt-2 text-sm leading-6 text-zinc-300">
                Explain what you are trying to understand, not just what you think.
              </p>
            </div>
            <div className="rounded-2xl bg-white/10 p-5">
              <p className="font-black">Add context</p>
              <p className="mt-2 text-sm leading-6 text-zinc-300">
                Give enough background so people can respond with substance.
              </p>
            </div>
            <div className="rounded-2xl bg-white/10 p-5">
              <p className="font-black">Ask for depth</p>
              <p className="mt-2 text-sm leading-6 text-zinc-300">
                Invite evidence, tradeoffs, lived experience, or serious counterpoints.
              </p>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
