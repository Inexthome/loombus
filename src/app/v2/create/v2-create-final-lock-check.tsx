"use client";

import Link from "next/link";
import { useState } from "react";
import { CheckCircle2, ClipboardCheck, Loader2, Lock, ServerCog } from "lucide-react";
import { usePathname } from "next/navigation";
import { supabase } from "@/lib/supabase/client";

type LockResult = {
  ok?: boolean;
  locked?: boolean;
  status?: string;
  reason?: string;
};

export function V2CreateFinalLockCheck() {
  const pathname = usePathname() ?? "";
  const normalizedPathname = pathname.endsWith("/") ? pathname.slice(0, -1) : pathname;
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<LockResult | null>(null);
  const [message, setMessage] = useState("");

  if (normalizedPathname !== "/v2/create/confirm") {
    return null;
  }

  async function verifyLock() {
    setLoading(true);
    setMessage("");
    setResult(null);

    try {
      const { data } = await supabase.auth.getSession();
      const accessToken = data.session?.access_token;

      if (!accessToken) {
        setMessage("Sign in is required before verifying the server lock.");
        return;
      }

      const response = await fetch("/api/v2/create/finalize", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });
      const nextResult = (await response.json().catch(() => null)) as LockResult | null;

      if (!nextResult) {
        setMessage("The server lock check did not return a readable result.");
        return;
      }

      setResult(nextResult);
      setMessage(nextResult.reason ?? "Server lock check complete.");
    } catch {
      setMessage("Server lock check failed safely.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section
      className="fixed bottom-24 right-4 z-[9999] w-[calc(100vw-2rem)] max-w-sm rounded-[1.5rem] border border-amber-300/30 bg-slate-950/95 p-4 text-white shadow-2xl shadow-black/50 backdrop-blur-xl sm:bottom-6 sm:right-6"
      style={{ colorScheme: "dark" }}
    >
      <div className="flex items-center gap-3">
        <Lock className="size-5 text-amber-200" />
        <div>
          <p className="text-sm font-bold text-white">Server lock</p>
          <p className="text-xs text-slate-400">Checks the final server guard. It should remain locked.</p>
        </div>
      </div>

      <button
        type="button"
        onClick={verifyLock}
        disabled={loading}
        className="mt-4 inline-flex w-full appearance-none items-center justify-center gap-2 rounded-2xl border border-amber-200/30 bg-amber-300/15 px-4 py-2 text-sm font-bold text-amber-50 transition hover:bg-amber-300/25 disabled:cursor-wait disabled:opacity-60"
      >
        {loading ? <Loader2 className="size-4 animate-spin" /> : <ServerCog className="size-4" />}
        {loading ? "Checking..." : "Verify server lock"}
      </button>

      <Link
        href="/v2/create/readiness"
        className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-blue-300/30 bg-blue-500/15 px-4 py-2 text-sm font-bold text-blue-50 transition hover:bg-blue-500/25"
      >
        <ClipboardCheck className="size-4" />
        Open readiness checklist
      </Link>

      {message && <p className="mt-3 text-xs leading-5 text-slate-300">{message}</p>}

      {result?.locked && (
        <p className="mt-3 inline-flex items-center gap-2 rounded-full border border-emerald-300/25 bg-emerald-400/10 px-3 py-1 text-xs font-bold text-emerald-100">
          <CheckCircle2 className="size-4" />
          Lock verified
        </p>
      )}
    </section>
  );
}
