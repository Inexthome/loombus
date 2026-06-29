"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, CheckCircle2, ClipboardCopy, FileText, Loader2, Lock, Send } from "lucide-react";
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
  checks?: Array<{ key: string; label: string; passed: boolean }>;
  preview?: { title: string; topic: string; body: string; mode: string; tags: string[] } | null;
  draftUpdatedAt?: string | null;
};

type FinalizeResult = {
  ok?: boolean;
  locked?: boolean;
  status?: string;
  reason?: string;
  v2Discussion?: { id?: string; status?: string } | null;
  code?: string;
  category?: string;
  provider?: string;
};

const DEFAULT_FLAGS: FeatureFlags = { v2_shell: false, v2_signal_brief: false, v2_rooms: false };
const LOOMBUS_GOLD = "#d6a84f";

const MODE_LABELS: Record<string, string> = {
  open_discussion: "Open discussion",
  debate: "Debate",
  research_question: "Research question",
  problem_solving: "Problem solving",
};

function getDefaultShellPayload(): ShellPayload {
  return { version: "v1", configured: false, authenticated: false, flags: DEFAULT_FLAGS };
}

function formatDraftTime(value: string | null | undefined) {
  if (!value) return "Not saved yet";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Saved recently";
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(date);
}

function getModeLabel(mode: string | null | undefined) {
  return MODE_LABELS[mode ?? ""] ?? "Open discussion";
}

function GateCard({ title, message, loading = false }: { title: string; message: string; loading?: boolean }) {
  return (
    <main className="fixed inset-0 z-[80] flex min-h-screen items-center justify-center bg-slate-950 px-4 py-10 text-white">
      <section className="w-full max-w-2xl rounded-[2rem] border border-white/10 bg-slate-900/90 p-6 shadow-2xl shadow-black/40 backdrop-blur-xl sm:p-8">
        <div className="mb-6 flex items-center gap-3">
          <div className="grid size-12 place-items-center rounded-2xl bg-amber-500/15 text-amber-200 ring-1 ring-amber-300/20">
            {loading ? <Loader2 className="size-5 animate-spin" /> : <Lock className="size-5" />}
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.24em] text-amber-200">Loombus</p>
            <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">{title}</h1>
          </div>
        </div>
        <p className="text-sm leading-6 text-slate-300 sm:text-base">{message}</p>
        <div className="mt-7 flex flex-wrap gap-3">
          <Link href="/v2/create/review" className="rounded-2xl bg-white px-4 py-2 text-sm font-bold text-slate-950 transition hover:bg-slate-200">
            Back to Review
          </Link>
        </div>
      </section>
    </main>
  );
}

export default function CreateConfirmPage() {
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
    ].filter(Boolean).join("\n");
  }, [preview]);

  async function copyConfirmationPreview() {
    if (!previewText) return;
    try {
      await navigator.clipboard.writeText(previewText);
      setCopyMessage("Confirmation preview copied.");
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
      const response = await fetch("/api/v2/shell", { headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined });
      const nextPayload = (await response.json().catch(() => getDefaultShellPayload())) as ShellPayload;
      setPayload(nextPayload);
      if (!accessToken) return;
      if (!nextPayload.configured || !nextPayload.flags.v2_shell || nextPayload.version !== "v2") return;

      const prepareResponse = await fetch("/api/v2/create/prepare", { method: "POST", headers: { Authorization: `Bearer ${accessToken}` } });
      const preparePayload = (await prepareResponse.json().catch(() => null)) as ServerCheck | null;
      if (!preparePayload) {
        setMessage("Confirmation check did not return a readable result.");
        return;
      }
      setServerCheck(preparePayload);
      if (!preparePayload.ok) setMessage(preparePayload.reason ?? "Draft is not ready for confirmation yet.");
    } catch {
      setPayload(getDefaultShellPayload());
      setMessage("Unable to load confirmation safely.");
    } finally {
      setLoading(false);
    }
  }

  async function finalizeDraft() {
    if (!canFinalize) return;
    setFinalizing(true);
    setMessage("");
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      if (!accessToken) {
        setMessage("Sign in again before running the final check.");
        return;
      }
      const finalizeResponse = await fetch("/api/v2/create/finalize", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ finalizeAcknowledged: true }),
      });
      const finalizePayload = (await finalizeResponse.json().catch(() => null)) as FinalizeResult | null;
      if (!finalizeResponse.ok || !finalizePayload?.ok) {
        setMessage(finalizePayload?.reason ?? "The final check could not complete.");
        return;
      }
      setMessage(finalizePayload.reason ?? "Final check completed.");
    } catch {
      setMessage("Unexpected final check failure. Nothing else changed.");
    } finally {
      setFinalizing(false);
    }
  }

  useEffect(() => {
    loadConfirmation();
    const { data } = supabase.auth.onAuthStateChange(() => loadConfirmation());
    return () => data.subscription.unsubscribe();
  }, []);

  if (loading) return <GateCard title="Checking confirmation" message="Loombus is validating your draft before showing the confirmation preview." loading />;
  if (!payload?.authenticated) return <GateCard title="Sign in required" message="Sign in to confirm this draft." />;
  if (!payload.configured || !payload.flags.v2_shell || payload.version !== "v2") return <GateCard title="Confirmation is unavailable" message="This account cannot access confirmation yet." />;

  return (
    <main className="fixed inset-0 z-[80] min-h-screen overflow-y-auto bg-[#07111f] text-white">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(37,99,235,0.2),_transparent_34%),radial-gradient(circle_at_top_right,_rgba(212,175,55,0.2),_transparent_32%)]" />
      <div className="relative z-10 mx-auto max-w-6xl px-4 py-6 text-white sm:px-6 lg:px-8">
        <header className="mb-6 rounded-[2rem] border border-white/10 bg-slate-950/75 p-5 text-white shadow-2xl shadow-black/30 backdrop-blur-xl sm:p-6">
          <Link href="/v2/create/review" className="mb-4 inline-flex items-center gap-2 text-sm font-semibold transition hover:text-white" style={{ color: LOOMBUS_GOLD }}>
            <ArrowLeft className="size-4" />
            Back to Review
          </Link>
          <p className="text-xs font-bold uppercase tracking-[0.24em]" style={{ color: LOOMBUS_GOLD }}>Loombus Confirmation</p>
          <h1 className="mt-2 text-4xl font-bold tracking-tight text-white sm:text-5xl">Final check.</h1>
          <p className="mt-4 max-w-3xl text-sm leading-6 text-slate-300 sm:text-base">Review the prepared discussion and run the final check before continuing.</p>
        </header>

        {message && <div className="mb-5 rounded-2xl border border-amber-300/30 bg-amber-300/10 px-4 py-3 text-sm font-medium text-amber-100">{message}</div>}

        <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
          <article className="rounded-[2rem] border border-white/10 bg-slate-950/75 p-5 text-white shadow-xl shadow-black/20 backdrop-blur-xl sm:p-6">
            {!ready || !preview ? (
              <div className="rounded-3xl border border-white/10 bg-slate-950/80 p-6 text-slate-300">The draft is not ready for confirmation yet. Return to Review and complete any needed fields.</div>
            ) : (
              <>
                <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                  <span className="rounded-full border border-emerald-300/25 bg-emerald-400/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] text-emerald-100">Server validated</span>
                  <span className="text-xs text-slate-400">Saved {formatDraftTime(serverCheck?.draftUpdatedAt)}</span>
                </div>
                <h2 className="text-3xl font-bold tracking-tight text-white">{preview.title || "Untitled signal"}</h2>
                <div className="mt-3 flex flex-wrap gap-2 text-xs font-semibold text-slate-300">
                  <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">{preview.topic || "No topic"}</span>
                  <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">{getModeLabel(preview.mode)}</span>
                  {preview.tags.map((tag) => <span key={tag} className="rounded-full border border-white/10 bg-white/5 px-3 py-1">#{tag}</span>)}
                </div>
                <div className="mt-6 whitespace-pre-wrap rounded-3xl border border-white/10 bg-slate-950/80 p-5 text-base leading-8 text-slate-200">{preview.body || "No body text yet."}</div>
              </>
            )}
          </article>

          <aside className="space-y-4">
            <section className="rounded-[2rem] border border-amber-300/25 bg-amber-400/10 p-5 text-white shadow-xl shadow-black/20 backdrop-blur-xl">
              <div className="flex items-center gap-3"><Send className="size-5 text-amber-200" /><h2 className="font-bold text-amber-100">Final check</h2></div>
              <div className="mt-4 space-y-2">
                {(serverCheck?.checks ?? []).map((check) => <div key={check.key} className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-slate-950/70 px-3 py-2 text-sm"><span className="text-slate-300">{check.label}</span><span className={check.passed ? "text-emerald-200" : "text-amber-200"}>{check.passed ? "Ready" : "Needed"}</span></div>)}
              </div>
              <label className="mt-4 flex items-start gap-3 rounded-2xl border border-white/10 bg-slate-950/70 p-3 text-sm text-slate-200"><input type="checkbox" checked={acknowledged} onChange={(event) => setAcknowledged(event.target.checked)} className="mt-1 size-4 accent-amber-500" /><span>I reviewed this draft and understand the final check will confirm the prepared discussion.</span></label>
              <button type="button" disabled={!canFinalize} onClick={finalizeDraft} className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-amber-300/40 bg-amber-500 px-4 py-3 text-sm font-bold text-slate-950 shadow-lg shadow-black/30 transition hover:bg-amber-400 disabled:cursor-not-allowed disabled:border-white/10 disabled:bg-slate-700 disabled:text-slate-300 disabled:opacity-80">
                {finalizing ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />}
                {finalizing ? "Running check..." : "Run final check"}
              </button>
            </section>

            <section className="rounded-[2rem] border border-white/10 bg-slate-950/75 p-5 text-white shadow-xl shadow-black/20 backdrop-blur-xl">
              <div className="flex items-center gap-3"><FileText className="size-5 text-amber-200" /><h2 className="font-bold text-white">Actions</h2></div>
              <div className="mt-4 flex flex-col gap-3">
                <button type="button" onClick={copyConfirmationPreview} disabled={!ready} className="inline-flex appearance-none items-center justify-center gap-2 rounded-2xl border border-amber-300/40 bg-amber-500 px-4 py-2 text-sm font-bold text-slate-950 shadow-lg shadow-black/30 transition hover:bg-amber-400 disabled:cursor-not-allowed disabled:border-amber-300/20 disabled:bg-amber-500/50 disabled:text-white/70"><ClipboardCopy className="size-4" />Copy confirmation preview</button>
                <Link href="/v2/create/review" className="rounded-2xl border border-white/10 px-4 py-2 text-center text-sm font-semibold text-slate-200 transition hover:border-white/30 hover:text-white">Back to Review</Link>
              </div>
              {copyMessage && <p className="mt-3 text-xs leading-5 text-slate-300">{copyMessage}</p>}
            </section>
          </aside>
        </section>
      </div>
    </main>
  );
}
