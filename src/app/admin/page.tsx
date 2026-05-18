"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";

export default function AdminDashboardPage() {
  const [authorized, setAuthorized] = useState(false);
  const [loading, setLoading] = useState(true);

  const [openReports, setOpenReports] = useState(0);
  const [reviewedReports, setReviewedReports] = useState(0);
  const [discussionCount, setDiscussionCount] = useState(0);
  const [userCount, setUserCount] = useState(0);

  useEffect(() => {
    async function loadDashboard() {
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

      const [{ count: open }, { count: reviewed }] = await Promise.all([
        supabase
          .from("reports")
          .select("*", { count: "exact", head: true })
          .eq("status", "open"),

        supabase
          .from("reports")
          .select("*", { count: "exact", head: true })
          .eq("status", "reviewed"),
      ]);

      const [{ count: discussions }, { count: users }] = await Promise.all([
        supabase
          .from("discussions")
          .select("*", { count: "exact", head: true }),

        supabase
          .from("profiles")
          .select("*", { count: "exact", head: true }),
      ]);

      setOpenReports(open ?? 0);
      setReviewedReports(reviewed ?? 0);
      setDiscussionCount(discussions ?? 0);
      setUserCount(users ?? 0);

      setLoading(false);
    }

    loadDashboard();
  }, []);

  if (loading) {
    return (
      <main className="min-h-screen bg-black px-6 py-16 text-white">
        <div className="mx-auto max-w-6xl text-zinc-400">
          Loading admin dashboard...
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
            Admin access is required.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-black px-6 py-16 text-white">
      <div className="mx-auto max-w-6xl">

        <div className="mb-14">
          <h1 className="text-5xl font-semibold tracking-tight">
            Admin Dashboard
          </h1>

          <p className="mt-4 text-zinc-500">
            Platform moderation and operational overview.
          </p>
        </div>

        <div className="mb-14 grid gap-6 md:grid-cols-2 xl:grid-cols-4">

          <div className="rounded-3xl border border-zinc-800 bg-zinc-950 p-8">
            <p className="mb-3 text-sm uppercase tracking-wide text-zinc-500">
              Open Reports
            </p>

            <h2 className="text-5xl font-semibold">
              {openReports}
            </h2>
          </div>

          <div className="rounded-3xl border border-zinc-800 bg-zinc-950 p-8">
            <p className="mb-3 text-sm uppercase tracking-wide text-zinc-500">
              Reviewed Reports
            </p>

            <h2 className="text-5xl font-semibold">
              {reviewedReports}
            </h2>
          </div>

          <div className="rounded-3xl border border-zinc-800 bg-zinc-950 p-8">
            <p className="mb-3 text-sm uppercase tracking-wide text-zinc-500">
              Discussions
            </p>

            <h2 className="text-5xl font-semibold">
              {discussionCount}
            </h2>
          </div>

          <div className="rounded-3xl border border-zinc-800 bg-zinc-950 p-8">
            <p className="mb-3 text-sm uppercase tracking-wide text-zinc-500">
              Users
            </p>

            <h2 className="text-5xl font-semibold">
              {userCount}
            </h2>
          </div>

        </div>

        <div className="grid gap-6 lg:grid-cols-3">

          <div className="rounded-3xl border border-zinc-800 bg-zinc-950 p-8">
            <h2 className="mb-4 text-3xl font-semibold">
              Reports
            </h2>

            <p className="mb-6 leading-relaxed text-zinc-400">
              Review community-submitted moderation reports.
            </p>

            <Link
              href="/admin/reports"
              className="inline-flex rounded-full border border-zinc-700 px-5 py-3 text-sm text-zinc-300 transition hover:border-zinc-500 hover:text-white"
            >
              Open Reports →
            </Link>
          </div>

          <div className="rounded-3xl border border-zinc-800 bg-zinc-950 p-8">
            <h2 className="mb-4 text-3xl font-semibold">
              Deleted Content
            </h2>

            <p className="mb-6 leading-relaxed text-zinc-400">
              Review and restore soft-deleted discussions.
            </p>

            <Link
              href="/admin/deleted"
              className="inline-flex rounded-full border border-zinc-700 px-5 py-3 text-sm text-zinc-300 transition hover:border-zinc-500 hover:text-white"
            >
              Open Deleted →
            </Link>
          </div>

          <div className="rounded-3xl border border-zinc-800 bg-zinc-950 p-8">
            <h2 className="mb-4 text-3xl font-semibold">
              Audit Logs
            </h2>

            <p className="mb-6 leading-relaxed text-zinc-400">
              Inspect platform activity and moderation events.
            </p>

            <Link
              href="/admin/audit"
              className="inline-flex rounded-full border border-zinc-700 px-5 py-3 text-sm text-zinc-300 transition hover:border-zinc-500 hover:text-white"
            >
              Open Audit →
            </Link>
          </div>

        </div>

      </div>
    </main>
  );
}
