"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  ClipboardCopy,
  FileText,
  Loader2,
  Lock,
  Send,
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
  draftUpdatedAt?: string | null;
};

type FinalizeResult = {
  ok?: boolean;
  locked?: boolean;
  status?: string;
  reason?: string;
  v2Discussion?: {
    id?: string;
    status?: string;
  } | null;
  code?: string;
  category?: string;
  provider?: string;
};

const DEFAULT_FLAGS: FeatureFlags = {
  v2_shell: false,
  v2_signal_brief: false,
  v2_rooms: false,
};

const MODE_LABELS: Record<string, string> = {
  open_discussion: "Open discussion",
  debate: "Debate",
  research_question: "Research question",
  problem_solving: "Problem solving",
};

function getDefaultShellPayload(): ShellPayload {
  return {
    version: "v1",
    configured: false,
    authenticated: false,
    flags: DEFAULT_FLAGS,
  };
}

function formatDraftTime(value: string | null | undefined) {
  if (!value) return "Not saved yet";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Saved recently";
  }

  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function getModeLabel(mode: string | null | undefined) {
  return MODE_LABELS[mode ?? ""] ?? "Open discussion";
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

function GateCard({
  title,
  message,
  loading = false,
  payload,
}: {
  title: string;
  message: string;
  loading?: boolean;
  payload?: ShellPayload | null;
}) {
  return (
    <main className="fixed inset-0 z-[80] flex min-h-screen items-center justify-center bg-slate-950 px-4 py-10 text-white">
      <section className="w-full max-w-2xl rounded-[2rem] border border-white/10 bg-slate-900/90 p-6 shadow-2xl shadow-black/40 backdrop-blur-xl sm:p-8">
        <div className="mb-6 flex items-center gap-3">
          <div className="grid size-12 place-items-center rounded-2xl bg-blue-500/15 text-blue-200 ring-1 ring-blue-300/20">
            {loading ? <Loader2 className="size-5 animate-spin" /> : <Lock className="size-5" />}
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.24em] text-blue-200">Loombus V2</p>
            <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">{title}</h1>
          </div>
        </div>

        <p className="text-sm leading-6 text-slate-300 sm:text-base">{message}</p>

        {payload && (
          <div className="mt-5 flex flex-wrap gap-2">
            <FlagPill label="v2_shell" enabled={payload.flags.v2_shell} />
            <FlagPill label="v2_signal_brief" enabled={payload.flags.v2_signal_brief} />
            <FlagPill label="v2_rooms" enabled={payload.flags.v2_rooms} />
          </div>
        )}

        <div className="mt-7 flex flex-wrap gap-3">
          <Link href="/v2/create/review" className="rounded-2xl bg-white px-4 py-2 text-sm font-bold text-slate-950 transition hover:bg-slate-200">
            Back to Review
          </Link>
          <Link href="/create" className="rounded-2xl border border-white/10 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:border-white/30 hover:text-white">
            Open V1 Create
          </Link>
        </div>
      </section>
    </main>
  );
}

export default function V2CreateConfirmPage() {
  const [payload, setPayload] = useState<ShellPayload | null>(null);
  const [serverCheck, setServerCheck] = useState<ServerCheck | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [copyMessage, setCopyMessage] = useState("");
  const [acknowledged, setAcknowledged] = useState(false);
  const [finalizing, setFinalizing] = useState(false);

  const ready = Boolean(serverCheck?.ok && serverCheck.preview);
  const preview = serverCheck?.preview ?? null;
  const canFinalize = ready && acknowledged && !finalizing;

  const previewText = useMemo(() => {
    if (!preview) return "";

    return [
      `Title: ${preview.title || "Untitled signal"}`,
      `Topic: ${preview.topic || "Not selected"}`,
      `Mode: ${getModeLabel(preview.mode)}`,
      preview.tags?.length ? `Tags: ${preview.tags.join(", ")}` : null,
      "",
      preview.body || "No body text yet.",
    ]
      .filter(Boolean)
      .join("\n");
  }, [preview]);

  async function copyConfirmationPreview() {
    if (!previewText) return;

    try {
      await navigator.clipboard.writeText(previewText);
      setCopyMessage("Confirmation preview copied. Review it before using the guarded V2 final action.");
    } catch {
      setCopyMessage("Unable to copy from this browser. You can still manually copy the preview.");
    }
  }

  async function loadConfirmation() {
    setLoading(true);
    setMessage("");
    setCopyMessage("");
    setAcknowledged(false);

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      const response = await fetch("/api/v2/shell", {
        headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
      });
      const nextPayload = (await response.json().catch(() => getDefaultShellPayload())) as ShellPayload;

      setPayload(nextPayload);

      if (!accessToken) {
        return;
      }

      if (!nextPayload.configured || !nextPayload.flags.v2_shell || nextPayload.version !== "v2") {
        return;
      }

      const prepareResponse = await fetch("/api/v2/create/prepare", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });
      const preparePayload = (await prepareResponse.json().catch(() => null)) as ServerCheck | null;

      if (!preparePayload) {
        setMessage("Server confirmation check did not return a readable result.");
        return;
      }

      setServerCheck(preparePayload);

      if (!preparePayload.ok) {
        setMessage(preparePayload.reason ?? "Draft is not ready for confirmation yet.");
      }
    } catch {
      setPayload(getDefaultShellPayload());
      setMessage("Unable to load V2 confirmation safely. V1 Create remains available.");
    } finally {
      setLoading(false);
    }
  }

  async function finalizeV2Draft() {
    if (!canFinalize) {
      return;
    }

    setFinalizing(true);
    setMessage("");

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;

      if (!accessToken) {
        setMessage("Sign in again before running the V2 final check.");
        return;
      }

      const finalizeResponse = await fetch("/api/v2/create/finalize", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ finalizeAcknowledged: true }),
      });
      const finalizePayload = (await finalizeResponse.json().catch(() => null)) as FinalizeResult | null;

      if (!finalizeResponse.ok || !finalizePayload?.ok || !finalizePayload.v2Discussion?.id) {
        setMessage(finalizePayload?.reason ?? "The guarded V2 final check could not complete.");
        return;
      }

      setMessage(finalizePayload.reason ?? "V2 preview discussion stored without adding an item to the live V1 feed.");
    } catch {
      setMessage("Unexpected V2 finalize failure. Nothing else changed.");
    } finally {
      setFinalizing(false);
    }
  }

  useEffect(() => {
    loadConfirmation();

    const { data } = supabase.auth.onAuthStateChange(() => {
      loadConfirmation();
    });

    return () => {
      data.subscription.unsubscribe();
    };
  }, []);

  if (loading) {
    return (
      <GateCard
        title="Checking V2 confirmation access"
        message="Loombus is validating the private V2 draft before showing the guarded confirmation preview."
        loading
      />
    );
  }

  if (!payload?.authenticated) {
    return (
      <GateCard
        title="Sign in required"
        message="The V2 confirmation preview is internal-only right now. Sign in first so Loombus can verify your access."
        payload={payload}
      />
    );
  }

  if (!payload.configured || !payload.flags.v2_shell || payload.version !== "v2") {
    return (
      <GateCard
        title="V2 confirmation is not enabled"
        message="This account is not currently allowed through the v2_shell flag. Public users remain on V1."
        payload={payload}
      />
    );
  }

  return (
    <main className="fixed inset-0 z-[80] min-h-screen overflow-y-auto bg-[#07111f] text-white">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(37,99,235,0.26),_transparent_34%),radial-gradient(circle_at_top_right,_rgba(212,175,55,0.18),_transparent_32%)]" />

      <div className="relative z-10 mx-auto max-w-6xl px-4 py-6 text-white sm:px-6 lg:px-8">
        <header className="mb-6 rounded-[2rem] border border-white/10 bg-slate-950/75 p-5 text-white shadow-2xl shadow-black/30 backdrop-blur-xl sm:p-6">
          <Link href="/v2/create/review" className="mb-4 inline-flex items-center gap-2 text-sm font-semibold text-blue-200 transition hover:text-white">
            <ArrowLeft className="size-4" />
            Back to Review
          </Link>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.24em] text-blue-200">Loombus V2 Confirmation Preview</p>
              <h1 className="mt-2 text-4xl font-bold tracking-tight text-white sm:text-5xl">Final V2 preview check.</h1>
              <p className="mt-4 max-w-3xl text-sm leading-6 text-slate-300 sm:text-base">
                This screen validates one internal V2 draft. The final action is pointed at V2-only preview storage and remains blocked until the rollback guard allows it.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <FlagPill label="v2_shell" enabled={payload.flags.v2_shell} />
              <FlagPill label="v2_signal_brief" enabled={payload.flags.v2_signal_brief} />
              <FlagPill label="v2_rooms" enabled={payload.flags.v2_rooms} />
            </div>
          </div>
        </header>

        {message && (
          <div className="mb-5 rounded-2xl border border-amber-300/30 bg-amber-300/10 px-4 py-3 text-sm font-medium text-amber-100">
            {message}
          </div>
        )}

        <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
          <article className="rounded-[2rem] border border-white/10 bg-slate-950/75 p-5 text-white shadow-xl shadow-black/20 backdrop-blur-xl sm:p-6">
            {!ready || !preview ? (
              <div className="rounded-3xl border border-white/10 bg-slate-950/80 p-6 text-slate-300">
                The draft is not ready for the confirmation preview yet. Return to Review, run the server check, and complete any needed fields.
              </div>
            ) : (
              <>
                <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                  <span className="rounded-full border border-emerald-300/25 bg-emerald-400/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] text-emerald-100">
                    Server validated
                  </span>
                  <span className="text-xs text-slate-400">Saved {formatDraftTime(serverCheck?.draftUpdatedAt)}</span>
                </div>

                <h2 className="text-3xl font-bold tracking-tight text-white">{preview.title || "Untitled signal"}</h2>
                <div className="mt-3 flex flex-wrap gap-2 text-xs font-semibold text-slate-300">
                  <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">
                    {preview.topic || "No topic"}
                  </span>
                  <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">
                    {getModeLabel(preview.mode)}
                  </span>
                  {preview.tags.map((tag) => (
                    <span key={tag} className="rounded-full border border-white/10 bg-white/5 px-3 py-1">
                      #{tag}
                    </span>
                  ))}
                </div>

                <div className="mt-6 whitespace-pre-wrap rounded-3xl border border-white/10 bg-slate-950/80 p-5 text-base leading-8 text-slate-200">
                  {preview.body || "No body text yet."}
                </div>
              </>
            )}
          </article>

          <aside className="space-y-4">
            <section className="rounded-[2rem] border border-blue-300/25 bg-blue-400/10 p-5 text-white shadow-xl shadow-black/20 backdrop-blur-xl">
              <div className="flex items-center gap-3">
                <Send className="size-5 text-blue-200" />
                <h2 className="font-bold text-blue-100">Guarded V2-only final action</h2>
              </div>
              <p className="mt-4 text-sm leading-6 text-blue-50/80">
                The finalizer is no longer allowed to create a V1 discussion. When opened later, it stores into the V2 preview table only.
              </p>
              <div className="mt-4 space-y-2">
                {(serverCheck?.checks ?? []).map((check) => (
                  <div key={check.key} className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-slate-950/70 px-3 py-2 text-sm">
                    <span className="text-slate-300">{check.label}</span>
                    <span className={check.passed ? "text-emerald-200" : "text-amber-200"}>
                      {check.passed ? "Ready" : "Needed"}
                    </span>
                  </div>
                ))}
              </div>
              <label className="mt-4 flex items-start gap-3 rounded-2xl border border-white/10 bg-slate-950/70 p-3 text-sm text-slate-200">
                <input
                  type="checkbox"
                  checked={acknowledged}
                  onChange={(event) => setAcknowledged(event.target.checked)}
                  className="mt-1 size-4 accent-blue-500"
                />
                <span>I reviewed this V2 draft and understand this final action is V2-only and must not add an item to the V1 feed.</span>
              </label>
              <button
                type="button"
                disabled={!canFinalize}
                onClick={finalizeV2Draft}
                className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-blue-300/40 bg-blue-500 px-4 py-3 text-sm font-bold text-white shadow-lg shadow-blue-950/30 transition hover:bg-blue-400 disabled:cursor-not-allowed disabled:border-white/10 disabled:bg-slate-700 disabled:text-slate-300 disabled:opacity-80"
              >
                {finalizing ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />}
                {finalizing ? "Running check..." : "Run V2 final check"}
              </button>
            </section>

            <section className="rounded-[2rem] border border-emerald-400/25 bg-emerald-400/10 p-5 text-white shadow-xl shadow-black/20 backdrop-blur-xl">
              <div className="flex items-center gap-3">
                <ShieldCheck className="size-5 text-emerald-200" />
                <h2 className="font-bold text-emerald-100">V1 remains untouched</h2>
              </div>
              <p className="mt-4 text-sm leading-6 text-emerald-50/80">
                The V2 final action is separated from the existing V1 discussion create path. Public discussion pages continue to use V1.
              </p>
            </section>

            <section className="rounded-[2rem] border border-amber-300/25 bg-amber-300/10 p-5 text-white shadow-xl shadow-black/20 backdrop-blur-xl">
              <div className="flex items-center gap-3">
                <AlertTriangle className="size-5 text-amber-200" />
                <h2 className="font-bold text-amber-100">Still not public rollout</h2>
              </div>
              <p className="mt-4 text-sm leading-6 text-amber-50/80">
                This does not switch /create, /discussions, navigation, or rollout. Public users remain on V1.
              </p>
            </section>

            <section className="rounded-[2rem] border border-white/10 bg-slate-950/75 p-5 text-white shadow-xl shadow-black/20 backdrop-blur-xl">
              <div className="flex items-center gap-3">
                <FileText className="size-5 text-blue-200" />
                <h2 className="font-bold text-white">Actions</h2>
              </div>
              <div className="mt-4 flex flex-col gap-3">
                <button
                  type="button"
                  onClick={copyConfirmationPreview}
                  disabled={!ready}
                  className="inline-flex appearance-none items-center justify-center gap-2 rounded-2xl border border-blue-300/40 bg-blue-500 px-4 py-2 text-sm font-bold text-white shadow-lg shadow-blue-950/30 transition hover:bg-blue-400 disabled:cursor-not-allowed disabled:border-blue-300/20 disabled:bg-blue-500/50 disabled:text-white/70"
                >
                  <ClipboardCopy className="size-4" />
                  Copy confirmation preview
                </button>
                <Link href="/v2/create/review" className="rounded-2xl border border-white/10 px-4 py-2 text-center text-sm font-semibold text-slate-200 transition hover:border-white/30 hover:text-white">
                  Back to Review
                </Link>
                <Link href="/create" className="rounded-2xl border border-white/10 px-4 py-2 text-center text-sm font-semibold text-slate-200 transition hover:border-white/30 hover:text-white">
                  Open V1 Create
                </Link>
              </div>
              {copyMessage && <p className="mt-3 text-xs leading-5 text-slate-300">{copyMessage}</p>}
            </section>
          </aside>
        </section>
      </div>
    </main>
  );
}
