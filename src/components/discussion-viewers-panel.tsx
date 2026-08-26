"use client";

import { Eye } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { ProfileAvatar } from "@/components/profile-avatar";
import { supabase } from "@/lib/supabase/client";

type Viewer = {
  viewedAt: string;
  profile: {
    id: string;
    full_name: string | null;
    username: string | null;
    avatar_url: string | null;
  } | null;
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

export function DiscussionViewersPanel() {
  const params = useParams();
  const discussionId = String(params.id ?? "");
  const [viewers, setViewers] = useState<Viewer[]>([]);
  const [totalViews, setTotalViews] = useState(0);
  const [loading, setLoading] = useState(true);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token || !discussionId) {
        setLoading(false);
        return;
      }

      const response = await fetch(
        `/api/discussions/viewers?discussionId=${encodeURIComponent(discussionId)}`,
        {
          headers: { Authorization: `Bearer ${token}` },
          cache: "no-store",
        }
      );
      const payload = await response.json().catch(() => ({}));
      if (cancelled) return;

      if (response.ok) {
        setVisible(true);
        setViewers(payload.viewers ?? []);
        setTotalViews(Number(payload.totalAuthenticatedViews ?? 0));
      }
      setLoading(false);
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [discussionId]);

  if (!loading && !visible) return null;
  if (!visible) return null;

  return (
    <section className="mx-auto mb-20 mt-2 max-w-[86rem] px-4 text-[var(--loombus-text)] sm:px-6 lg:px-8">
      <div className="border-y border-[var(--loombus-border)] py-5 sm:py-6">
        <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
              <p className="text-xs font-bold uppercase tracking-[.2em] text-[var(--loombus-gold)]">
                Discussion viewers
              </p>
              <span className="inline-flex items-center gap-1.5 text-sm font-bold text-[var(--loombus-text-muted)]">
                <Eye aria-hidden="true" className="size-4" />
                {totalViews}
              </span>
            </div>
            <h2 className="mt-2 text-xl font-black sm:text-2xl">Who viewed this discussion.</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--loombus-text-muted)]">
              Reader identities are visible only to the discussion owner and administrators.
              Views are deduplicated for 24 hours. Private profiles expose only the member&apos;s
              basic public identity here.
            </p>
          </div>
        </div>

        {viewers.length ? (
          <div className="mt-4 grid border-t border-[var(--loombus-border-muted)] sm:grid-cols-2 xl:grid-cols-3">
            {viewers.map((viewer, index) => {
              const profile = viewer.profile;
              const name =
                profile?.full_name?.trim() ||
                (profile?.username?.trim() ? `@${profile.username.trim()}` : "Loombus member");
              const href = profile?.username
                ? `/u/${encodeURIComponent(profile.username)}`
                : "/people";

              return (
                <Link
                  key={profile?.id ?? `${viewer.viewedAt}-${index}`}
                  href={href}
                  className="flex min-w-0 items-center gap-3 border-b border-[var(--loombus-border-muted)] py-3 pr-4 text-inherit transition hover:text-[var(--loombus-gold)] sm:odd:mr-4 xl:[&:nth-child(3n+1)]:mr-4 xl:[&:nth-child(3n+2)]:mr-4"
                >
                  <ProfileAvatar profile={profile} size="sm" />
                  <div className="min-w-0">
                    <strong className="block truncate text-sm">{name}</strong>
                    <span className="mt-0.5 block text-xs text-[var(--loombus-text-muted)]">
                      {formatViewedAt(viewer.viewedAt)}
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        ) : (
          <p className="mt-4 border-t border-[var(--loombus-border-muted)] pt-4 text-sm text-[var(--loombus-text-muted)]">
            No authenticated reader identities have been recorded yet.
          </p>
        )}
      </div>
    </section>
  );
}
