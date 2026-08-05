"use client";

import { Eye, ExternalLink, LockKeyhole } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { ProfileAvatar } from "@/components/profile-avatar";
import { supabase } from "@/lib/supabase/client";

type Discussion = {
  id: string;
  title: string;
  created_at: string;
};

type Viewer = {
  viewedAt: string;
  privateViewer: boolean;
  profile: {
    id: string;
    full_name: string | null;
    username: string | null;
    avatar_url: string | null;
  } | null;
};

type DiscussionInsight = Discussion & {
  totalViews: number;
  viewers: Viewer[];
};

function formatViewedAt(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Recently";
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

export function DiscussionViewerInsights() {
  const [insights, setInsights] = useState<DiscussionInsight[]>([]);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const session = sessionData.session;
        if (!session) {
          window.location.href = "/login";
          return;
        }

        const { data: discussions, error } = await supabase
          .from("discussions")
          .select("id, title, created_at")
          .eq("user_id", session.user.id)
          .is("deleted_at", null)
          .order("created_at", { ascending: false })
          .limit(12);

        if (error) throw error;

        const loaded = await Promise.all(
          ((discussions ?? []) as Discussion[]).map(async (discussion) => {
            const response = await fetch(
              `/api/discussions/viewers?discussionId=${encodeURIComponent(discussion.id)}`,
              {
                headers: { Authorization: `Bearer ${session.access_token}` },
                cache: "no-store",
              }
            );
            const payload = await response.json().catch(() => ({}));
            if (!response.ok) {
              return { ...discussion, totalViews: 0, viewers: [] };
            }
            return {
              ...discussion,
              totalViews: Number(payload.totalAuthenticatedViews ?? 0),
              viewers: (payload.viewers ?? []) as Viewer[],
            };
          })
        );

        if (!cancelled) setInsights(loaded);
      } catch (error) {
        console.error("Unable to load discussion viewer insights", error);
        if (!cancelled) setNotice("Discussion viewer insights could not be loaded. Refresh and try again.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <section className="mt-6 rounded-[2rem] border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-5 text-[var(--loombus-text)] shadow-sm sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[.2em] text-[var(--loombus-gold)]">
            Discussion views
          </p>
          <h2 className="mt-2 text-2xl font-black">Who viewed your discussions.</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--loombus-text-muted)]">
            This private workspace shows your 12 most recent discussions. Members who hide their viewer identity appear as Private viewer.
          </p>
        </div>
        <Link
          href="/my-discussions"
          className="inline-flex items-center gap-2 rounded-full border border-[var(--loombus-border)] px-4 py-2 text-sm font-bold text-[var(--loombus-text-muted)] transition hover:border-[var(--loombus-gold)] hover:text-[var(--loombus-gold)]"
        >
          All discussions
          <ExternalLink className="size-4" aria-hidden="true" />
        </Link>
      </div>

      {notice ? (
        <p className="mt-5 rounded-2xl border border-[var(--loombus-border)] bg-[var(--loombus-surface-muted)] p-4 text-sm text-[var(--loombus-text-muted)]">
          {notice}
        </p>
      ) : loading ? (
        <p className="mt-5 text-sm text-[var(--loombus-text-muted)]">Loading discussion viewers…</p>
      ) : insights.length ? (
        <div className="mt-5 grid gap-4">
          {insights.map((discussion) => (
            <article
              key={discussion.id}
              className="rounded-2xl border border-[var(--loombus-border)] bg-[var(--loombus-surface-muted)] p-4 sm:p-5"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="truncate text-base font-black sm:text-lg">{discussion.title}</h3>
                  <p className="mt-1 text-xs text-[var(--loombus-text-muted)]">
                    Recent authenticated viewers
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="inline-flex items-center gap-2 text-sm font-bold text-[var(--loombus-text-muted)]">
                    <Eye className="size-4" aria-hidden="true" />
                    {discussion.totalViews}
                  </span>
                  <Link
                    href={`/discussions/${discussion.id}`}
                    className="text-sm font-bold text-[var(--loombus-gold)]"
                  >
                    Open
                  </Link>
                </div>
              </div>

              {discussion.viewers.length ? (
                <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {discussion.viewers.slice(0, 8).map((viewer, index) => {
                    if (viewer.privateViewer || !viewer.profile) {
                      return (
                        <div
                          key={`private-${viewer.viewedAt}-${index}`}
                          className="flex items-center gap-3 rounded-xl border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-3"
                        >
                          <span className="grid size-10 shrink-0 place-items-center rounded-full bg-[var(--loombus-page-bg)] text-[var(--loombus-text-muted)]">
                            <LockKeyhole className="size-4" aria-hidden="true" />
                          </span>
                          <div className="min-w-0">
                            <strong className="block truncate text-sm">Private viewer</strong>
                            <span className="mt-1 block text-xs text-[var(--loombus-text-muted)]">
                              {formatViewedAt(viewer.viewedAt)}
                            </span>
                          </div>
                        </div>
                      );
                    }

                    const profile = viewer.profile;
                    const name =
                      profile.full_name?.trim() || profile.username?.trim() || "Loombus member";
                    const href = profile.username
                      ? `/u/${encodeURIComponent(profile.username)}`
                      : "/people";

                    return (
                      <Link
                        key={`${discussion.id}-${profile.id}`}
                        href={href}
                        className="flex items-center gap-3 rounded-xl border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-3 transition hover:border-[var(--loombus-gold)]"
                      >
                        <ProfileAvatar profile={profile} size="sm" />
                        <div className="min-w-0">
                          <strong className="block truncate text-sm">{name}</strong>
                          <span className="mt-1 block text-xs text-[var(--loombus-text-muted)]">
                            {formatViewedAt(viewer.viewedAt)}
                          </span>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              ) : (
                <p className="mt-4 rounded-xl border border-dashed border-[var(--loombus-border)] p-4 text-sm text-[var(--loombus-text-muted)]">
                  No authenticated reader identities have been recorded for this discussion yet.
                </p>
              )}
            </article>
          ))}
        </div>
      ) : (
        <div className="mt-5 rounded-2xl border border-dashed border-[var(--loombus-border)] p-5">
          <h3 className="font-black">No discussions yet.</h3>
          <p className="mt-2 text-sm text-[var(--loombus-text-muted)]">
            Create a discussion to begin collecting private viewer insights.
          </p>
          <Link href="/create" className="mt-4 inline-flex text-sm font-bold text-[var(--loombus-gold)]">
            Start a discussion
          </Link>
        </div>
      )}
    </section>
  );
}
