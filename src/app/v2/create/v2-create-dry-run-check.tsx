"use client";

import { useState } from "react";
import { CheckCircle2, ClipboardList, Loader2, ShieldCheck } from "lucide-react";
import { usePathname } from "next/navigation";
import { supabase } from "@/lib/supabase/client";

type DryRunCheck = {
  key: string;
  label: string;
  passed: boolean;
  detail: string;
};

type DryRunResult = {
  ok?: boolean;
  locked?: boolean;
  status?: string;
  reason?: string;
  checks?: DryRunCheck[];
  wouldPublishPayload?: {
    title: string;
    topic: string;
    discussionType: string;
    tags: string;
  } | null;
};

export function V2CreateDryRunCheck() {
  const pathname = usePathname() ?? "";
  const normalizedPathname = pathname.endsWith("/") ? pathname.slice(0, -1) : pathname;
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<DryRunResult | null>(null);
  const [message, setMessage] = useState("");

  if (normalizedPathname !== "/v2/create/readiness") {
    return null;
  }

  async function runDryRunComparison() {
    setLoading(true);
    setMessage("");
    setResult(null);

    try {
      const { data } = await supabase.auth.getSession();
      const accessToken = data.session?.access_token;

      if (!accessToken) {
        setMessage("Sign in is required before running the dry-run comparison.");
        return;
      }

      const response = await fetch("/api/v2/create/dry-run", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });
      const nextResult = (await response.json().catch(() => null)) as DryRunResult | null;

      if (!nextResult) {
        setMessage("The dry-run endpoint did not return a readable result.");
        return;
      }

      setResult(nextResult);
      setMessage(nextResult.reason ?? "Dry-run comparison complete.");
    } catch {
      setMessage("Dry-run comparison failed safely.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section
      className="fixed bottom-24 left-4 z-[9998] w-[calc(100vw-2rem)] max-w-sm rounded-[1.5rem] border border-purple-300/30 bg-slate-950/95 p-4 text-white shadow-2xl shadow-black/50 backdrop-blur-xl sm:bottom-6 sm:left-[27rem]"
      style={{ colorScheme: "dark" }}
    >
      <div className="flex items-center gap-3">
        <ClipboardList className="size-5 text-purple-200" />
        <div>
          <p className="text-sm font-bold text-white">Dry-run comparison</p>
          <p className="text-xs text-slate-400">Compares the latest shadow record to the V1 payload shape.</p>
        </div>
      </div>

      <button
        type="button"
        onClick={runDryRunComparison}
        disabled={loading}
        className="mt-4 inline-flex w-full appearance-none items-center justify-center gap-2 rounded-2xl border border-purple-300/40 bg-purple-500 px-4 py-2 text-sm font-bold text-white transition hover:bg-purple-400 disabled:cursor-wait disabled:bg-purple-500/60"
      >
        {loading ? <Loader2 className="size-4 animate-spin" /> : <ShieldCheck className="size-4" />}
        {loading ? "Comparing..." : "Run dry-run comparison"}
      </button>

      {message && <p className="mt-3 text-xs leading-5 text-slate-300">{message}</p>}

      {result?.ok && (
        <p className="mt-3 inline-flex items-center gap-2 rounded-full border border-emerald-300/25 bg-emerald-400/10 px-3 py-1 text-xs font-bold text-emerald-100">
          <CheckCircle2 className="size-4" />
          Dry-run passed
        </p>
      )}

      {result?.checks && result.checks.length > 0 && (
        <div className="mt-3 max-h-44 space-y-2 overflow-y-auto pr-1">
          {result.checks.map((check) => (
            <div key={check.key} className="rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-2 text-xs">
              <div className="flex items-center justify-between gap-3">
                <span className="font-bold text-white">{check.label}</span>
                <span className={check.passed ? "text-emerald-200" : "text-amber-200"}>{check.passed ? "Pass" : "Needs work"}</span>
              </div>
              <p className="mt-1 text-slate-400">{check.detail}</p>
            </div>
          ))}
        </div>
      )}

      {result?.wouldPublishPayload && (
        <div className="mt-3 rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-2 text-xs text-slate-300">
          <p className="font-bold text-white">Would-publish preview</p>
          <p className="mt-1">{result.wouldPublishPayload.title}</p>
          <p className="mt-1 text-slate-500">
            {result.wouldPublishPayload.topic} · {result.wouldPublishPayload.discussionType}
          </p>
        </div>
      )}
    </section>
  );
}
