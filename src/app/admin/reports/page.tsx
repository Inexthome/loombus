"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";

type Report = {
  id: string;
  reason: string;
  status: string;
  created_at: string;
  discussion_id: string;
  discussions: {
    id: string;
    title: string;
    topic: string;
  } | null;
};

export default function AdminReportsPage() {
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);

  useEffect(() => {
    async function loadReports() {
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

      const { data } = await supabase
        .from("reports")
        .select(`
          id,
          reason,
          status,
          created_at,
          discussion_id,
          discussions (
            id,
            title,
            topic
          )
        `)
        .order("created_at", { ascending: false });

      const normalized = (data ?? []).map((item) => ({
        ...item,
        discussions: Array.isArray(item.discussions)
          ? item.discussions[0] ?? null
          : item.discussions,
      })) as Report[];

      setReports(normalized);
      setLoading(false);
    }

    loadReports();
  }, []);

  async function softDeleteDiscussion(discussionId: string | undefined) {
    if (!discussionId) {
      return;
    }

    const { data: userData } = await supabase.auth.getUser();

    if (!userData.user) {
      window.location.href = "/login";
      return;
    }

    await supabase
      .from("discussions")
      .update({
        deleted_at: new Date().toISOString(),
        deleted_by: userData.user.id,
        deletion_reason: "Admin moderation action",
      })
      .eq("id", discussionId);

    await supabase.from("audit_logs").insert({
      actor_id: userData.user.id,
      action: "discussion.soft_deleted",
      target_type: "discussion",
      target_id: discussionId,
      metadata: {
        reason: "Admin moderation action",
      },
    });

    setReports((current) =>
      current.filter((report) => report.discussion_id !== discussionId)
    );
  }

  async function markReviewed(reportId: string) {
    const { error } = await supabase
      .from("reports")
      .update({ status: "reviewed" })
      .eq("id", reportId);

    if (error) {
      return;
    }

    setReports((current) =>
      current.map((report) =>
        report.id === reportId
          ? { ...report, status: "reviewed" }
          : report
      )
    );
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-black px-6 py-16 text-white">
        <div className="mx-auto max-w-5xl text-zinc-400">
          Loading reports...
        </div>
      </main>
    );
  }

  if (!authorized) {
    return (
      <main className="min-h-screen bg-black px-6 py-16 text-white">
        <div className="mx-auto max-w-5xl">
          <h1 className="mb-4 text-5xl font-semibold tracking-tight">
            Access denied.
          </h1>

          <p className="text-zinc-400">
            This moderation area is restricted to admins.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-black px-6 py-16 text-white">
      <div className="mx-auto max-w-5xl">
        <h1 className="mb-6 text-5xl font-semibold tracking-tight">
          Reports
        </h1>

        <p className="mb-12 text-zinc-500">
          Review discussions submitted for moderation.
        </p>

        {reports.length === 0 && (
          <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-6">
            <h2 className="mb-3 text-2xl font-medium">
              No reports yet.
            </h2>

            <p className="text-zinc-400">
              Reported discussions will appear here.
            </p>
          </div>
        )}

        <div className="space-y-6">
          {reports.map((report) => (
            <div
              key={report.id}
              className="rounded-2xl border border-zinc-800 bg-zinc-950 p-6"
            >
              <p className="mb-3 text-sm text-zinc-500">
                {new Date(report.created_at).toLocaleString()}
              </p>

              <h2 className="mb-3 text-2xl font-medium">
                {report.discussions?.title ?? "Discussion unavailable"}
              </h2>

              <p className="mb-3 text-zinc-400">
                Reason: {report.reason}
              </p>

              <p className="mb-4 text-sm text-zinc-500">
                Status: {report.status}
              </p>

              <div className="flex flex-wrap items-center gap-4">
                {report.discussions && (
                <Link
                  href={`/discussions/${report.discussions.id}`}
                  className="text-sm text-zinc-300 hover:text-white"
                >
                  View discussion →
                </Link>
                )}

                {report.status !== "reviewed" && (
                  <button
                    onClick={() => markReviewed(report.id)}
                    className="rounded-full border border-zinc-700 px-4 py-2 text-sm text-zinc-400 transition hover:border-zinc-500 hover:text-white"
                  >
                    Mark reviewed
                  </button>
                )}

                {report.discussions && (
                  <button
                    onClick={() => softDeleteDiscussion(report.discussions?.id)}
                    className="rounded-full border border-red-900 px-4 py-2 text-sm text-red-400 transition hover:border-red-700 hover:text-red-300"
                  >
                    Soft delete discussion
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
