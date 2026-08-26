"use client";

import { ChevronDown, Eye, LockKeyhole } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { ProfileAvatar } from "@/components/profile-avatar";
import { supabase } from "@/lib/supabase/client";

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

export function ProfileViewersPanel() {
  const [viewers, setViewers] = useState<Viewer[]>([]);
  const [totalViews, setTotalViews] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) {
        setLoading(false);
        return;
      }
      const response = await fetch("/api/profiles/viewers", {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      const payload = await response.json().catch(() => ({}));
      if (cancelled) return;
      if (response.ok) {
        setViewers(payload.viewers ?? []);
        setTotalViews(Number(payload.totalViews ?? 0));
      }
      setLoading(false);
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <section className="py-7 text-[var(--loombus-text)]">
      <details className="group" open>
        <summary className="flex cursor-pointer list-none items-center gap-4 [&::-webkit-details-marker]:hidden">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold uppercase tracking-[.2em] text-[var(--loombus-gold)]">
              Profile viewers
            </p>
            <h2 className="mt-2 text-2xl font-black">Who viewed your profile.</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--loombus-text-muted)]">
              Authenticated visits are deduplicated for 24 hours. Hidden identities appear as Private viewer.
            </p>
          </div>
          <span className="inline-flex shrink-0 items-center gap-1.5 text-sm font-bold text-[var(--loombus-text-muted)]">
            <Eye className="size-4" aria-hidden="true" />
            {totalViews}
          </span>
          <ChevronDown className="size-4 shrink-0 text-[var(--loombus-text-muted)] transition group-open:rotate-180" aria-hidden="true" />
        </summary>

        {loading ? (
          <p className="mt-5 text-sm text-[var(--loombus-text-muted)]">Loading recent viewers…</p>
        ) : viewers.length ? (
          <div className="mt-5 divide-y divide-[var(--loombus-border)] border-y border-[var(--loombus-border)]">
            {viewers.map((viewer, index) => {
              if (viewer.privateViewer || !viewer.profile) {
                return (
                  <div key={`private-${viewer.viewedAt}-${index}`} className="flex items-center gap-3 py-3">
                    <span className="grid size-9 shrink-0 place-items-center rounded-full bg-[var(--loombus-surface-muted)] text-[var(--loombus-text-muted)]">
                      <LockKeyhole className="size-4" aria-hidden="true" />
                    </span>
                    <div>
                      <strong className="block text-sm">Private viewer</strong>
                      <span className="mt-0.5 block text-xs text-[var(--loombus-text-muted)]">
                        {formatViewedAt(viewer.viewedAt)}
                      </span>
                    </div>
                  </div>
                );
              }

              const profile = viewer.profile;
              const name = profile.full_name?.trim() || profile.username?.trim() || "Loombus member";
              const href = profile.username ? `/u/${encodeURIComponent(profile.username)}` : "/people";
              return (
                <Link
                  key={profile.id}
                  href={href}
                  className="flex items-center gap-3 py-3 transition hover:text-[var(--loombus-gold)]"
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
          <p className="mt-5 border-y border-[var(--loombus-border)] py-5 text-sm text-[var(--loombus-text-muted)]">
            No authenticated profile views have been recorded yet.
          </p>
        )}
      </details>
    </section>
  );
}
