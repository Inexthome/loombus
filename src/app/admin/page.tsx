"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";

type AdminCounts = {
  totalReports: number;
  openReports: number;
  dismissedReports: number;
  actionedReports: number;
  profileReports: number;
  deletedDiscussions: number;
  deletedReplies: number;
  labsRequests: number;
};

type AdminCardProps = {
  href: string;
  title: string;
  description: string;
  action: string;
  count?: number;
};

function AdminCard({
  href,
  title,
  description,
  action,
  count,
}: AdminCardProps) {
  return (
    <Link
      href={href}
      className="group flex min-h-[230px] flex-col rounded-3xl border border-zinc-800 bg-zinc-950 p-6 transition hover:border-zinc-600"
    >
      <div>
        <div className="mb-5 flex items-start justify-between gap-4">
          <h2 className="text-2xl font-medium tracking-tight">
            {title}
          </h2>

          {typeof count === "number" && (
            <span className="shrink-0 rounded-full border border-zinc-800 px-3 py-1 text-sm text-zinc-400">
              {count}
            </span>
          )}
        </div>

        <p className="max-w-md text-sm leading-6 text-zinc-500">
          {description}
        </p>
      </div>

      <span className="mt-auto inline-flex w-fit items-center rounded-full border border-zinc-700 px-5 py-3 text-sm text-zinc-300 transition group-hover:border-zinc-500 group-hover:text-white">
        {action} →
      </span>
    </Link>
  );
}

export default function AdminDashboardPage() {
  const [isAdmin, setIsAdmin] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);
  const [counts, setCounts] = useState<AdminCounts>({
    totalReports: 0,
    openReports: 0,
    dismissedReports: 0,
    actionedReports: 0,
    profileReports: 0,
    deletedDiscussions: 0,
    deletedReplies: 0,
    labsRequests: 0,
  });

  useEffect(() => {
    async function loadAdminDashboard() {
      const { data: userData } = await supabase.auth.getUser();

      if (!userData.user) {
        window.location.href = "/login";
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("is_admin")
        .eq("id", userData.user.id)
        .maybeSingle();

      if (!profile?.is_admin) {
        setAuthChecked(true);
        return;
      }

      setIsAdmin(true);

      const [
        totalReports,
        openReports,
        dismissedReports,
          actionedReports,
        profileReports,
        deletedDiscussions,
        deletedReplies,
        labsRequests,
      ] = await Promise.all([
        supabase
          .from("reports")
          .select("*", { count: "exact", head: true }),
        supabase
          .from("reports")
          .select("*", { count: "exact", head: true })
          .eq("status", "new"),
        supabase
          .from("reports")
          .select("*", { count: "exact", head: true })
          .eq("status", "dismissed"),
        supabase
          .from("reports")
          .select("*", { count: "exact", head: true })
          .eq("status", "actioned"),
        supabase
          .from("reports")
          .select("*", { count: "exact", head: true })
          .not("reported_profile_id", "is", null),
        supabase
          .from("discussions")
          .select("*", { count: "exact", head: true })
          .not("deleted_at", "is", null),
        supabase
          .from("replies")
          .select("*", { count: "exact", head: true })
          .not("deleted_at", "is", null),
        supabase
          .from("labs_feature_requests")
          .select("*", { count: "exact", head: true }),
      ]);

      setCounts({
        totalReports: totalReports.count ?? 0,
        openReports: openReports.count ?? 0,
        dismissedReports: dismissedReports.count ?? 0,
        actionedReports: actionedReports.count ?? 0,
        profileReports: profileReports.count ?? 0,
        deletedDiscussions: deletedDiscussions.count ?? 0,
        deletedReplies: deletedReplies.count ?? 0,
        labsRequests: labsRequests.count ?? 0,
      });

      setAuthChecked(true);
    }

    loadAdminDashboard();
  }, []);

  if (!authChecked) {
    return (
      <main className="min-h-screen bg-black px-6 py-16 text-white">
        <div className="mx-auto max-w-6xl text-zinc-500">
          Loading admin dashboard...
        </div>
      </main>
    );
  }

  if (!isAdmin) {
    return (
      <main className="min-h-screen bg-black px-6 py-16 text-white">
        <div className="mx-auto max-w-3xl rounded-3xl border border-zinc-800 bg-zinc-950 p-8">
          <p className="mb-3 text-sm uppercase tracking-[0.3em] text-zinc-500">
            Admin
          </p>

          <h1 className="mb-4 text-4xl font-semibold tracking-tight">
            Access denied.
          </h1>

          <p className="leading-relaxed text-zinc-400">
            This area is available only to Loombus admin accounts.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-black px-6 py-16 text-white">
      <div className="mx-auto max-w-6xl">
        <div className="mb-10">
          <p className="mb-4 text-sm uppercase tracking-[0.3em] text-zinc-500">
            Admin
          </p>

          <h1 className="mb-5 text-5xl font-semibold tracking-tight">
            Admin dashboard.
          </h1>

          <p className="max-w-3xl leading-relaxed text-zinc-400">
            Platform moderation and operational overview.
          </p>
        </div>

        <section className="mb-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-3xl border border-zinc-800 bg-zinc-950 p-6">
            <p className="mb-2 text-sm text-zinc-500">
              Total Reports
            </p>
            <p className="text-4xl font-semibold">
              {counts.totalReports}
            </p>
          </div>

          <div className="rounded-3xl border border-zinc-800 bg-zinc-950 p-6">
            <p className="mb-2 text-sm text-zinc-500">
              Open Reports
            </p>
            <p className="text-4xl font-semibold">
              {counts.openReports}
            </p>
          </div>

          <div className="rounded-3xl border border-zinc-800 bg-zinc-950 p-6">
            <p className="mb-2 text-sm text-zinc-500">
              Reviewed Reports
            </p>
            <p className="text-4xl font-semibold">
              {counts.dismissedReports}
            </p>
          </div>

          <div className="rounded-3xl border border-zinc-800 bg-zinc-950 p-6">
            <p className="mb-2 text-sm text-zinc-500">
              Labs Requests
            </p>
            <p className="text-4xl font-semibold">
              {counts.labsRequests}
            </p>
          </div>
        </section>

        <section className="grid items-stretch gap-6 md:grid-cols-2 xl:grid-cols-3">
          <AdminCard
            href="/admin/reports"
            title="Reports"
            description="Review community-submitted moderation reports for discussions, replies, and profiles."
            action="Open Reports"
            count={counts.openReports}
          />

          <AdminCard
            href="/admin/deleted"
            title="Deleted Discussions"
            description="Review and restore soft-deleted discussions when needed."
            action="Open Deleted Discussions"
            count={counts.deletedDiscussions}
          />

          <AdminCard
            href="/admin/deleted-replies"
            title="Deleted Replies"
            description="Review and restore soft-deleted replies when needed."
            action="Open Deleted Replies"
            count={counts.deletedReplies}
          />

          <AdminCard
            href="/admin/ai-access"
            title="AI Access"
            description="Manage Premium AI-Assisted Layer access and review AI usage."
            action="Open AI Access"
          />

          <AdminCard
            href="/admin/labs"
            title="Loombus Labs"
            description="Review Premium Plus feature requests and update Labs status."
            action="Open Labs"
            count={counts.labsRequests}
          />

          <AdminCard
            href="/admin/audit"
            title="Audit Log"
            description="Review platform activity, moderation actions, actors, targets, and system events."
            action="Open Audit Log"
          />
        </section>
      </div>
    </main>
  );
}
