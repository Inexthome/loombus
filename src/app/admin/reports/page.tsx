"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";

type Report = {
  id: string;
  reason: string;
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

              <p className="mb-4 text-zinc-400">
                Reason: {report.reason}
              </p>

              {report.discussions && (
                <a
                  href={`/discussions/${report.discussions.id}`}
                  className="text-sm text-zinc-300 hover:text-white"
                >
                  View discussion →
                </a>
              )}
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
