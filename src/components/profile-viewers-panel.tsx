"use client";

import { Eye, LockKeyhole } from "lucide-react";
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
    <section className="mt-6 rounded-[2rem] border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-5 text-[var(--loombus-text)] shadow-sm sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[.2em] text-[var(--loombus-gold)]">Profile viewers</p>
          <h2 className="mt-2 text-2xl font-black">Who viewed your profile.</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--loombus-text-muted)]">Authenticated visits are deduplicated for 24 hours. Members who disable viewer identity appear as Private viewer.</p>
        </div>
        <span className="inline-flex items-center gap-2 rounded-full border border-[var(--loombus-border)] px-3 py-2 text-sm font-bold text-[var(--loombus-text-muted)]"><Eye className="size-4" /> {totalViews}</span>
      </div>

      {loading ? (
        <p className="mt-5 text-sm text-[var(--loombus-text-muted)]">Loading recent viewers…</p>
      ) : viewers.length ? (
        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {viewers.map((viewer, index) => {
            if (viewer.privateViewer || !viewer.profile) {
              return (
                <article key={`private-${viewer.viewedAt}-${index}`} className="flex items-center gap-3 rounded-2xl border border-[var(--loombus-border)] bg-[var(--loombus-surface-muted)] p-3">
                  <span className="grid size-11 shrink-0 place-items-center rounded-full bg-[var(--loombus-page-bg)] text-[var(--loombus-text-muted)]"><LockKeyhole className="size-4" /></span>
                  <div><strong className="block text-sm">Private viewer</strong><span className="mt-1 block text-xs text-[var(--loombus-text-muted)]">{formatViewedAt(viewer.viewedAt)}</span></div>
                </article>
              );
            }
            const profile = viewer.profile;
            const name = profile.full_name?.trim() || profile.username?.trim() || "Loombus member";
            const href = profile.username ? `/u/${encodeURIComponent(profile.username)}` : "/people";
            return (
              <Link key={profile.id} href={href} className="flex items-center gap-3 rounded-2xl border border-[var(--loombus-border)] bg-[var(--loombus-surface-muted)] p-3 transition hover:border-[var(--loombus-gold)]">
                <ProfileAvatar profile={profile} size="sm" />
                <div className="min-w-0"><strong className="block truncate text-sm">{name}</strong><span className="mt-1 block text-xs text-[var(--loombus-text-muted)]">{formatViewedAt(viewer.viewedAt)}</span></div>
              </Link>
            );
          })}
        </div>
      ) : (
        <p className="mt-5 rounded-2xl border border-dashed border-[var(--loombus-border)] p-5 text-sm text-[var(--loombus-text-muted)]">No authenticated profile views have been recorded yet.</p>
      )}
    </section>
  );
}
