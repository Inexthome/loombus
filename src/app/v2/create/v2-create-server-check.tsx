"use client";

import { useState } from "react";
import { CheckCircle2, Loader2, ServerCog, XCircle } from "lucide-react";
import { usePathname } from "next/navigation";
import { supabase } from "@/lib/supabase/client";

type ServerCheck = {
  ok?: boolean;
  status?: string;
  locked?: boolean;
  reason?: string;
  checks?: Array<{
    key: string;
    label: string;
    passed: boolean;
  }>;
  preview?: {
    title: string;
    topic: string;
    body: string;
    mode: string;
    tags: string[];
  } | null;
};

export function V2CreateServerCheck() {
  const pathname = usePathname() ?? "";
  const normalizedPathname = pathname.endsWith("/") ? pathname.slice(0, -1) : pathname;
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ServerCheck | null>(null);
  const [message, setMessage] = useState("");

  if (normalizedPathname !== "/v2/create/review") {
    return null;
  }

  async function runServerCheck() {
    setLoading(true);
    setMessage("");

    try {
      const { data } = await supabase.auth.getSession();
      const accessToken = data.session?.access_token;

      if (!accessToken) {
        setMessage("Sign in is required before running the server check.");
        setResult(null);
        return;
      }

      const response = await fetch("/api/v2/create/prepare", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });
      const nextResult = (await response.json().catch(() => null)) as ServerCheck | null;

      if (!nextResult) {
        setMessage("Server check did not return a readable result.");
        setResult(null);
        return;
      }

      setResult(nextResult);
      setMessage(nextResult.reason ?? "Server check complete.");
    } catch {
      setMessage("Server check failed safely. No draft action was taken.");
      setResult(null);
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
        <ServerCog className="size-5 text-blue-200" />
        <div>
          <p className="text-sm font-bold text-white">Server check</p>
          <p className="text-xs text-slate-400">Validation preview only. Final action stays locked.</p>
        </div>
      </div>

      <button
        type="button"
        onClick={runServerCheck}
        disabled={loading}
        className="mt-4 inline-flex w-full appearance-none items-center justify-center gap-2 rounded-2xl border border-blue-300/40 bg-blue-500 px-4 py-2 text-sm font-bold text-white transition hover:bg-blue-400 disabled:cursor-wait disabled:bg-blue-500/60"
      >
        {loading ? <Loader2 className="size-4 animate-spin" /> : <ServerCog className="size-4" />}
        {loading ? "Checking..." : "Run server check"}
      </button>

      {message && <p className="mt-3 text-xs leading-5 text-slate-300">{message}</p>}

      {result?.checks && (
        <div className="mt-3 space-y-2">
          {result.checks.map((check) => (
            <div key={check.key} className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-2 text-xs">
              <span className="text-slate-300">{check.label}</span>
              <span className={check.passed ? "text-emerald-200" : "text-amber-200"}>
                {check.passed ? <CheckCircle2 className="size-4" /> : <XCircle className="size-4" />}
              </span>
            </div>
          ))}
        </div>
      )}

      {result?.preview && (
        <p className="mt-3 rounded-2xl border border-emerald-400/20 bg-emerald-400/10 px-3 py-2 text-xs font-semibold text-emerald-100">
          Preview ready: {result.preview.title || "Untitled signal"}
        </p>
      )}
    </section>
  );
}
