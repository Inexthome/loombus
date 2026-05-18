"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";

type AuditLog = {
  id: string;
  action: string;
  target_type: string;
  target_id: string | null;
  metadata: any;
  created_at: string;
  actor_id: string | null;
};

export default function AdminAuditPage() {
  const [authorized, setAuthorized] = useState(false);
  const [loading, setLoading] = useState(true);
  const [logs, setLogs] = useState<AuditLog[]>([]);

  useEffect(() => {
    async function loadLogs() {
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
        .from("audit_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);

      setLogs(data ?? []);
      setLoading(false);
    }

    loadLogs();
  }, []);

  if (loading) {
    return (
      <main className="min-h-screen bg-black px-6 py-16 text-white">
        <div className="mx-auto max-w-6xl text-zinc-400">
          Loading audit logs...
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
            Admin access required.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-black px-6 py-16 text-white">
      <div className="mx-auto max-w-6xl">

        <div className="mb-10 flex items-center justify-between">
          <div>
            <p className="mb-3 text-sm uppercase tracking-[0.3em] text-zinc-500">
              Administration
            </p>

            <h1 className="text-5xl font-semibold tracking-tight">
              Audit Logs
            </h1>
          </div>

          <Link
            href="/admin"
            className="rounded-full border border-zinc-700 px-5 py-3 text-sm text-zinc-300 transition hover:border-zinc-500 hover:text-white"
          >
            Back to Admin
          </Link>
        </div>

        <div className="space-y-4">
          {logs.map((log) => (
            <div
              key={log.id}
              className="rounded-2xl border border-zinc-800 bg-zinc-950 p-6"
            >
              <div className="mb-4 flex flex-wrap items-center gap-3">
                <span className="rounded-full border border-zinc-700 px-3 py-1 text-xs text-zinc-300">
                  {log.action}
                </span>

                <span className="text-xs text-zinc-500">
                  {new Date(log.created_at).toLocaleString()}
                </span>
              </div>

              <div className="space-y-2 text-sm text-zinc-400">
                <p>
                  <span className="text-zinc-500">Target:</span>{" "}
                  {log.target_type}
                </p>

                {log.target_id && (
                  <p>
                    <span className="text-zinc-500">Target ID:</span>{" "}
                    {log.target_id}
                  </p>
                )}

                {log.actor_id && (
                  <p>
                    <span className="text-zinc-500">Actor:</span>{" "}
                    {log.actor_id}
                  </p>
                )}

                {log.metadata && (
                  <pre className="overflow-x-auto rounded-xl border border-zinc-800 bg-black p-4 text-xs text-zinc-400">
{JSON.stringify(log.metadata, null, 2)}
                  </pre>
                )}
              </div>
            </div>
          ))}

          {!logs.length && (
            <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-8 text-zinc-500">
              No audit logs yet.
            </div>
          )}
        </div>

      </div>
    </main>
  );
}
