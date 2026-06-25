"use client";

import { useState } from "react";
import { CheckCircle2, FileClock, Loader2, ShieldCheck } from "lucide-react";
import { usePathname } from "next/navigation";
import { supabase } from "@/lib/supabase/client";

type ShadowRecordResult = {
  ok?: boolean;
  locked?: boolean;
  status?: string;
  reason?: string;
  shadowRecord?: {
    id: string;
    status: string;
    created_at: string;
    title: string;
    topic: string;
    mode: string;
    tags: string[];
  } | null;
};

function formatCreatedAt(value: string | null | undefined) {
  if (!value) return "Created recently";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Created recently";
  }

  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

export function V2CreateShadowRecordCheck() {
  const pathname = usePathname() ?? "";
  const normalizedPathname = pathname.endsWith("/") ? pathname.slice(0, -1) : pathname;
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ShadowRecordResult | null>(null);
  const [message, setMessage] = useState("");

  if (normalizedPathname !== "/v2/create/readiness") {
    return null;
  }

  async function createShadowRecord() {
    setLoading(true);
    setMessage("");
    setResult(null);

    try {
      const { data } = await supabase.auth.getSession();
      const accessToken = data.session?.access_token;

      if (!accessToken) {
        setMessage("Sign in is required before creating a shadow record.");
        return;
      }

      const response = await fetch("/api/v2/create/shadow", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });
      const nextResult = (await response.json().catch(() => null)) as ShadowRecordResult | null;

      if (!nextResult) {
        setMessage("The shadow record endpoint did not return a readable result.");
        return;
      }

      setResult(nextResult);
      setMessage(nextResult.reason ?? "Shadow record check complete.");
    } catch {
      setMessage("Shadow record check failed safely.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section
      className="fixed bottom-24 left-4 z-[9999] w-[calc(100vw-2rem)] max-w-sm rounded-[1.5rem] border border-blue-300/30 bg-slate-950/95 p-4 text-white shadow-2xl shadow-black/50 backdrop-blur-xl sm:bottom-6 sm:left-6"
      style={{ colorScheme: "dark" }}
    >
      <div className="flex items-center gap-3">
        <FileClock className="size-5 text-blue-200" />
        <div>
          <p className="text-sm font-bold text-white">Shadow record</p>
          <p className="text-xs text-slate-400">Creates a non-public audit record only.</p>
        </div>
      </div>

      <button
        type="button"
        onClick={createShadowRecord}
        disabled={loading}
        className="mt-4 inline-flex w-full appearance-none items-center justify-center gap-2 rounded-2xl border border-blue-300/40 bg-blue-500 px-4 py-2 text-sm font-bold text-white transition hover:bg-blue-400 disabled:cursor-wait disabled:bg-blue-500/60"
      >
        {loading ? <Loader2 className="size-4 animate-spin" /> : <ShieldCheck className="size-4" />}
        {loading ? "Creating..." : "Create shadow record"}
      </button>

      {message && <p className="mt-3 text-xs leading-5 text-slate-300">{message}</p>}

      {result?.shadowRecord && (
        <div className="mt-3 rounded-2xl border border-emerald-300/25 bg-emerald-400/10 px-3 py-2 text-xs text-emerald-50">
          <p className="inline-flex items-center gap-2 font-bold">
            <CheckCircle2 className="size-4" />
            Shadow record created
          </p>
          <p className="mt-2 text-emerald-50/80">{result.shadowRecord.title || "Untitled signal"}</p>
          <p className="mt-1 text-emerald-50/60">{formatCreatedAt(result.shadowRecord.created_at)}</p>
        </div>
      )}
    </section>
  );
}
