"use client";

import { useState } from "react";
import { CheckCircle2, ClipboardCheck, Loader2, XCircle } from "lucide-react";
import { usePathname } from "next/navigation";
import { supabase } from "@/lib/supabase/client";

type PreflightCheck = {
  key: string;
  label: string;
  passed: boolean;
  detail: string;
};

type PreflightResult = {
  ok?: boolean;
  ready?: boolean;
  locked?: boolean;
  status?: string;
  reason?: string;
  checks?: PreflightCheck[];
};

export function V2CreatePreflightStatusCheck() {
  const pathname = usePathname() ?? "";
  const normalizedPathname = pathname.endsWith("/") ? pathname.slice(0, -1) : pathname;
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<PreflightResult | null>(null);
  const [message, setMessage] = useState("");

  if (normalizedPathname !== "/v2/create/readiness") {
    return null;
  }

  async function runPreflightStatus() {
    setLoading(true);
    setMessage("");
    setResult(null);

    try {
      const { data } = await supabase.auth.getSession();
      const accessToken = data.session?.access_token;

      if (!accessToken) {
        setMessage("Sign in is required before running preflight status.");
        return;
      }

      const response = await fetch("/api/v2/create/preflight-status", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });
      const nextResult = (await response.json().catch(() => null)) as PreflightResult | null;

      if (!nextResult) {
        setMessage("Preflight status did not return a readable result.");
        return;
      }

      setResult(nextResult);
      setMessage(nextResult.reason ?? "Preflight status complete.");
    } catch {
      setMessage("Preflight status failed safely.");
    } finally {
      setLoading(false);
    }
  }

  const checks = result?.checks ?? [];
  const passedCount = checks.filter((check) => check.passed).length;
  const totalCount = checks.length;

  return (
    <section className="fixed bottom-24 right-4 z-[9997] w-[calc(100vw-2rem)] max-w-md rounded-[1.5rem] border border-blue-300/30 bg-slate-950/95 p-4 text-white shadow-2xl shadow-black/50 backdrop-blur-xl sm:bottom-6 sm:right-6">
      <div className="flex items-center gap-3">
        <ClipboardCheck className="size-5 text-blue-200" />
        <div>
          <p className="text-sm font-bold text-white">Preflight status</p>
          <p className="text-xs text-slate-400">Runs the consolidated V2 Create readiness report.</p>
        </div>
      </div>

      <button
        type="button"
        onClick={runPreflightStatus}
        disabled={loading}
        className="mt-4 inline-flex w-full appearance-none items-center justify-center gap-2 rounded-2xl border border-blue-300/40 bg-blue-500 px-4 py-2 text-sm font-bold text-white transition hover:bg-blue-400 disabled:cursor-wait disabled:bg-blue-500/60"
      >
        {loading ? <Loader2 className="size-4 animate-spin" /> : <ClipboardCheck className="size-4" />}
        {loading ? "Running..." : "Run preflight status"}
      </button>

      {message && <p className="mt-3 text-xs leading-5 text-slate-300">{message}</p>}

      {result && (
        <div className="mt-3 rounded-2xl border border-white/10 bg-white/[0.04] p-3 text-xs text-slate-300">
          <p className="font-bold text-white">
            {result.ready ? "Preflight ready" : "Preflight needs review"} · {passedCount}/{totalCount || 0}
          </p>
          <p className="mt-1 text-slate-400">Status: {result.status ?? "checked"}</p>
          <div className="mt-3 max-h-56 space-y-2 overflow-y-auto pr-1">
            {checks.map((check) => (
              <div key={check.key} className="rounded-2xl border border-white/10 bg-slate-900/70 p-2">
                <p className="flex items-center gap-2 font-semibold text-white">
                  {check.passed ? <CheckCircle2 className="size-4 text-emerald-200" /> : <XCircle className="size-4 text-amber-200" />}
                  {check.label}
                </p>
                <p className="mt-1 leading-5 text-slate-400">{check.detail}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
