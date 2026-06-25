"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  ClipboardCheck,
  FileText,
  Loader2,
  Lock,
  RotateCcw,
  ShieldCheck,
} from "lucide-react";
import { supabase } from "@/lib/supabase/client";

type FeatureFlags = {
  v2_shell: boolean;
  v2_signal_brief: boolean;
  v2_rooms: boolean;
};

type ShellPayload = {
  version: "v1" | "v2";
  configured: boolean;
  authenticated: boolean;
  flags: FeatureFlags;
};

type PrepareCheck = {
  key: string;
  label: string;
  passed: boolean;
};

type PrepareResult = {
  ok?: boolean;
  locked?: boolean;
  reason?: string;
  checks?: PrepareCheck[];
  preview?: {
    title: string;
    topic: string;
    body: string;
    mode: string;
    tags: string[];
  } | null;
};

type FinalGuardResult = {
  ok?: boolean;
  locked?: boolean;
  status?: string;
  reason?: string;
};

type ReadinessItem = {
  key: string;
  label: string;
  detail: string;
  ready: boolean;
  required: boolean;
};

const DEFAULT_FLAGS: FeatureFlags = {
  v2_shell: false,
  v2_signal_brief: false,
  v2_rooms: false,
};

function getDefaultShellPayload(): ShellPayload {
  return {
    version: "v1",
    configured: false,
    authenticated: false,
    flags: DEFAULT_FLAGS,
  };
}

function StatusBadge({ ready, required }: { ready: boolean; required: boolean }) {
  if (ready) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-emerald-300/25 bg-emerald-400/10 px-3 py-1 text-xs font-bold text-emerald-100">
        <CheckCircle2 className="size-3.5" />
        Ready
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-amber-300/25 bg-amber-300/10 px-3 py-1 text-xs font-bold text-amber-100">
      <AlertTriangle className="size-3.5" />
      {required ? "Needed" : "Optional"}
    </span>
  );
}

function FlagPill({ label, enabled }: { label: string; enabled: boolean }) {
  return (
    <span
      className={`rounded-full border px-3 py-1 text-xs font-semibold ${
        enabled
          ? "border-emerald-400/40 bg-emerald-400/10 text-emerald-200"
          : "border-white/10 bg-white/5 text-slate-300"
      }`}
    >
      {label}: {enabled ? "on" : "off"}
    </span>
  );
}

export default function V2CreateReadinessPage() {
  const [shell, setShell] = useState<ShellPayload | null>(null);
  const [prepareResult, setPrepareResult] = useState<PrepareResult | null>(null);
  const [guardResult, setGuardResult] = useState<FinalGuardResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  async function loadReadiness() {
    setLoading(true);
    setMessage("");

    try {
      const { data } = await supabase.auth.getSession();
      const accessToken = data.session?.access_token;

      const shellResponse = await fetch("/api/v2/shell", {
        headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
      });
      const nextShell = (await shellResponse.json().catch(() => getDefaultShellPayload())) as ShellPayload;

      setShell(nextShell);

      if (!accessToken) {
        setMessage("Sign in is required before the internal checklist can run server checks.");
        return;
      }

      if (!nextShell.configured || !nextShell.flags.v2_shell || nextShell.version !== "v2") {
        setMessage("V2 shell access is required before the internal checklist can run.");
        return;
      }

      const prepareResponse = await fetch("/api/v2/create/prepare", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });
      const nextPrepareResult = (await prepareResponse.json().catch(() => null)) as PrepareResult | null;
      setPrepareResult(nextPrepareResult);

      const guardResponse = await fetch("/api/v2/create/finalize", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });
      const nextGuardResult = (await guardResponse.json().catch(() => null)) as FinalGuardResult | null;
      setGuardResult(nextGuardResult);
    } catch {
      setShell(getDefaultShellPayload());
      setMessage("Unable to load the internal readiness checklist safely.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadReadiness();
  }, []);

  const checklist = useMemo<ReadinessItem[]>(() => {
    const checks = prepareResult?.checks ?? [];
    const allDraftChecksPassed = checks.length > 0 && checks.every((check) => check.passed);
    const guardLocked = Boolean(guardResult?.locked);

    return [
      {
        key: "auth",
        label: "Authenticated internal user",
        detail: "The checklist should only run for a signed-in account.",
        ready: Boolean(shell?.authenticated),
        required: true,
      },
      {
        key: "v2-shell",
        label: "v2_shell access confirmed",
        detail: "The V2 shell must remain allowlist-gated before any broader release.",
        ready: Boolean(shell?.configured && shell.flags.v2_shell && shell.version === "v2"),
        required: true,
      },
      {
        key: "draft-validation",
        label: "Draft validation passes",
        detail: "Title, topic, body, mode, and tag checks must pass server validation.",
        ready: Boolean(prepareResult?.ok && allDraftChecksPassed),
        required: true,
      },
      {
        key: "preview",
        label: "Validated preview available",
        detail: "The confirmation preview must show the server-validated draft before any future activation.",
        ready: Boolean(prepareResult?.preview),
        required: true,
      },
      {
        key: "guard",
        label: "Server hard lock remains active",
        detail: "The final server guard must be verified before a later PR changes it.",
        ready: guardLocked,
        required: true,
      },
      {
        key: "v1-fallback",
        label: "V1 fallback preserved",
        detail: "/create, /discussions, and existing V1 flows remain the live production path.",
        ready: true,
        required: true,
      },
      {
        key: "rollout",
        label: "Public rollout unchanged",
        detail: "rollout_percentage should remain 0 while this checklist is internal-only.",
        ready: true,
        required: true,
      },
      {
        key: "moderation",
        label: "Moderation handoff reviewed",
        detail: "Future activation should confirm safety checks, reports, and admin review expectations.",
        ready: false,
        required: false,
      },
      {
        key: "notifications",
        label: "Notification behavior reviewed",
        detail: "Future activation should confirm no unexpected alerts fire from a V2-created item.",
        ready: false,
        required: false,
      },
      {
        key: "rollback",
        label: "Rollback plan documented",
        detail: "Future activation should include a direct way to return to V1-only behavior.",
        ready: false,
        required: false,
      },
    ];
  }, [guardResult?.locked, prepareResult, shell]);

  const requiredItems = checklist.filter((item) => item.required);
  const readyRequiredItems = requiredItems.filter((item) => item.ready);
  const requiredProgress = `${readyRequiredItems.length}/${requiredItems.length}`;
  const allRequiredReady = requiredItems.length > 0 && readyRequiredItems.length === requiredItems.length;

  return (
    <main
      className="fixed inset-0 z-[80] min-h-screen overflow-y-auto bg-[#07111f] text-white"
      style={{ colorScheme: "dark", backgroundColor: "#07111f" }}
    >
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(37,99,235,0.26),_transparent_34%),radial-gradient(circle_at_top_right,_rgba(212,175,55,0.18),_transparent_32%)]" />

      <div className="relative z-10 mx-auto max-w-6xl px-4 py-6 text-white sm:px-6 lg:px-8">
        <header className="mb-6 rounded-[2rem] border border-white/10 bg-slate-950/75 p-5 text-white shadow-2xl shadow-black/30 backdrop-blur-xl sm:p-6">
          <Link href="/v2/create/confirm" className="mb-4 inline-flex items-center gap-2 text-sm font-semibold text-blue-200 transition hover:text-white">
            <ArrowLeft className="size-4" />
            Back to Confirmation
          </Link>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.24em] text-blue-200">Loombus V2 Internal Checklist</p>
              <h1 className="mt-2 text-4xl font-bold tracking-tight text-white sm:text-5xl">Final unlock readiness.</h1>
              <p className="mt-4 max-w-3xl text-sm leading-6 text-slate-300 sm:text-base">
                This is an internal checklist only. It confirms readiness signals while the final server guard remains locked.
              </p>
            </div>
            <div className="rounded-[1.5rem] border border-white/10 bg-white/[0.04] p-4 text-center">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">Required ready</p>
              <p className="mt-1 text-3xl font-black text-white">{loading ? "..." : requiredProgress}</p>
            </div>
          </div>
          <div className="mt-5 flex flex-wrap gap-2">
            <FlagPill label="v2_shell" enabled={Boolean(shell?.flags.v2_shell)} />
            <FlagPill label="v2_signal_brief" enabled={Boolean(shell?.flags.v2_signal_brief)} />
            <FlagPill label="v2_rooms" enabled={Boolean(shell?.flags.v2_rooms)} />
          </div>
        </header>

        {message && (
          <div className="mb-5 rounded-2xl border border-amber-300/30 bg-amber-300/10 px-4 py-3 text-sm font-medium text-amber-100">
            {message}
          </div>
        )}

        <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
          <article className="rounded-[2rem] border border-white/10 bg-slate-950/75 p-5 text-white shadow-xl shadow-black/20 backdrop-blur-xl sm:p-6">
            <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-2xl font-bold tracking-tight text-white">Readiness checklist</h2>
                <p className="mt-1 text-sm text-slate-400">Required items must pass before a future change removes the hard lock.</p>
              </div>
              <button
                type="button"
                onClick={loadReadiness}
                disabled={loading}
                className="inline-flex items-center justify-center gap-2 rounded-2xl border border-blue-300/40 bg-blue-500 px-4 py-2 text-sm font-bold text-white transition hover:bg-blue-400 disabled:cursor-wait disabled:bg-blue-500/60"
              >
                {loading ? <Loader2 className="size-4 animate-spin" /> : <RotateCcw className="size-4" />}
                {loading ? "Checking..." : "Refresh checklist"}
              </button>
            </div>

            <div className="space-y-3">
              {checklist.map((item) => (
                <div key={item.key} className="rounded-3xl border border-white/10 bg-white/[0.04] p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <h3 className="font-bold text-white">{item.label}</h3>
                      <p className="mt-1 text-sm leading-6 text-slate-400">{item.detail}</p>
                    </div>
                    <StatusBadge ready={item.ready} required={item.required} />
                  </div>
                </div>
              ))}
            </div>
          </article>

          <aside className="space-y-4">
            <section className="rounded-[2rem] border border-emerald-400/25 bg-emerald-400/10 p-5 text-white shadow-xl shadow-black/20 backdrop-blur-xl">
              <div className="flex items-center gap-3">
                <ShieldCheck className="size-5 text-emerald-200" />
                <h2 className="font-bold text-emerald-100">Guard status</h2>
              </div>
              <p className="mt-4 text-sm leading-6 text-emerald-50/80">
                {guardResult?.reason ?? "The final server guard has not been checked yet."}
              </p>
              {guardResult?.locked && (
                <p className="mt-3 inline-flex items-center gap-2 rounded-full border border-emerald-300/25 bg-emerald-400/10 px-3 py-1 text-xs font-bold text-emerald-100">
                  <CheckCircle2 className="size-4" />
                  Hard lock active
                </p>
              )}
            </section>

            <section className="rounded-[2rem] border border-blue-300/25 bg-blue-400/10 p-5 text-white shadow-xl shadow-black/20 backdrop-blur-xl">
              <div className="flex items-center gap-3">
                <ClipboardCheck className="size-5 text-blue-200" />
                <h2 className="font-bold text-blue-100">Decision rule</h2>
              </div>
              <p className="mt-4 text-sm leading-6 text-blue-50/80">
                {allRequiredReady
                  ? "Required technical checks are ready, but optional operational items should be reviewed before any later activation."
                  : "Do not change the hard lock until all required checklist items are ready."}
              </p>
            </section>

            <section className="rounded-[2rem] border border-amber-300/25 bg-amber-300/10 p-5 text-white shadow-xl shadow-black/20 backdrop-blur-xl">
              <div className="flex items-center gap-3">
                <Lock className="size-5 text-amber-200" />
                <h2 className="font-bold text-amber-100">Still locked</h2>
              </div>
              <p className="mt-4 text-sm leading-6 text-amber-50/80">
                This page does not unlock the V2 final action. It only shows readiness status.
              </p>
            </section>

            <section className="rounded-[2rem] border border-white/10 bg-slate-950/75 p-5 text-white shadow-xl shadow-black/20 backdrop-blur-xl">
              <div className="flex items-center gap-3">
                <FileText className="size-5 text-blue-200" />
                <h2 className="font-bold text-white">Links</h2>
              </div>
              <div className="mt-4 flex flex-col gap-3">
                <Link
                  href="/v2/create/confirm"
                  className="rounded-2xl border border-white/10 px-4 py-2 text-center text-sm font-semibold text-slate-200 transition hover:border-white/30 hover:text-white"
                >
                  Back to Confirmation
                </Link>
                <Link
                  href="/v2/create/review"
                  className="rounded-2xl border border-white/10 px-4 py-2 text-center text-sm font-semibold text-slate-200 transition hover:border-white/30 hover:text-white"
                >
                  Back to Review
                </Link>
                <Link
                  href="/create"
                  className="rounded-2xl border border-white/10 px-4 py-2 text-center text-sm font-semibold text-slate-200 transition hover:border-white/30 hover:text-white"
                >
                  Open V1 Create
                </Link>
              </div>
            </section>
          </aside>
        </section>
      </div>
    </main>
  );
}
