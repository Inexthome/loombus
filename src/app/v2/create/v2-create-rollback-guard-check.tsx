"use client";

import { useState } from "react";
import { CheckCircle2, Loader2, ShieldAlert, ShieldCheck } from "lucide-react";
import { usePathname } from "next/navigation";
import { supabase } from "@/lib/supabase/client";

type RollbackGuardResult = {
  ok?: boolean;
  blocked?: boolean;
  locked?: boolean;
  status?: string;
  reason?: string;
  flag?: {
    key: string;
    enabled: boolean;
    rolloutPercentage: number;
    userAllowlisted: boolean;
  };
};

export function V2CreateRollbackGuardCheck() {
  const pathname = usePathname() ?? "";
  const normalizedPathname = pathname.endsWith("/") ? pathname.slice(0, -1) : pathname;
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<RollbackGuardResult | null>(null);
  const [message, setMessage] = useState("");

  if (normalizedPathname !== "/v2/create/readiness") {
    return null;
  }

  async function checkRollbackGuard() {
    setLoading(true);
    setMessage("");
    setResult(null);

    try {
      const { data } = await supabase.auth.getSession();
      const accessToken = data.session?.access_token;

      if (!accessToken) {
        setMessage("Sign in is required before checking the rollback guard.");
        return;
      }

      const response = await fetch("/api/v2/create/rollback-guard", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });
      const nextResult = (await response.json().catch(() => null)) as RollbackGuardResult | null;

      if (!nextResult) {
        setMessage("The rollback guard endpoint did not return a readable result.");
        return;
      }

      setResult(nextResult);
      setMessage(nextResult.reason ?? "Rollback guard check complete.");
    } catch {
      setMessage("Rollback guard check failed safely.");
    } finally {
      setLoading(false);
    }
  }

  const guardActive = result?.blocked === true;

  return (
    <section
      className="fixed bottom-24 right-4 z-[9997] w-[calc(100vw-2rem)] max-w-sm rounded-[1.5rem] border border-amber-300/30 bg-slate-950/95 p-4 text-white shadow-2xl shadow-black/50 backdrop-blur-xl sm:bottom-6 sm:right-6"
      style={{ colorScheme: "dark" }}
    >
      <div className="flex items-center gap-3">
        <ShieldAlert className="size-5 text-amber-200" />
        <div>
          <p className="text-sm font-bold text-white">Rollback guard</p>
          <p className="text-xs text-slate-400">Verifies V2 final action can be stopped instantly.</p>
        </div>
      </div>

      <button
        type="button"
        onClick={checkRollbackGuard}
        disabled={loading}
        className="mt-4 inline-flex w-full appearance-none items-center justify-center gap-2 rounded-2xl border border-amber-300/40 bg-amber-500 px-4 py-2 text-sm font-bold text-slate-950 transition hover:bg-amber-400 disabled:cursor-wait disabled:bg-amber-500/60"
      >
        {loading ? <Loader2 className="size-4 animate-spin" /> : <ShieldCheck className="size-4" />}
        {loading ? "Checking..." : "Check rollback guard"}
      </button>

      {message && <p className="mt-3 text-xs leading-5 text-slate-300">{message}</p>}

      {result && (
        <div className="mt-3 rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-2 text-xs text-slate-300">
          <p className="inline-flex items-center gap-2 font-bold text-white">
            <CheckCircle2 className="size-4" />
            {guardActive ? "Guard is active" : "Guard is open"}
          </p>
          <p className="mt-2 text-slate-400">Status: {result.status ?? "checked"}</p>
          {result.flag && (
            <p className="mt-1 text-slate-500">
              {result.flag.key}: {result.flag.enabled ? "enabled" : "disabled"}, rollout {result.flag.rolloutPercentage}%
            </p>
          )}
        </div>
      )}
    </section>
  );
}
