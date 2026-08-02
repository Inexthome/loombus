"use client";

import { supabase } from "@/lib/supabase/client";
import { normalizePublicText } from "@/lib/public-text";
import { floorHorizonLabel, floorStanceLabel, type FloorHorizon, type FloorStance } from "@/lib/floor-shared";
import Link from "next/link";
import { ArrowLeft, Ban, Clock3, FileClock, Loader2, Pencil, RotateCcw, Search, Trash2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

type Status = "active" | "withdrawn" | "deleted";
type Thesis = {
  id: string;
  ticker: string;
  stance: FloorStance;
  conviction: number;
  horizon: FloorHorizon;
  thesis: string;
  exit_plan: string;
  catalysts: string;
  risks: string;
  lifecycle_status: Status;
  created_at: string;
  updated_at: string;
  floor_calls: Array<{ id: string; status: string; outcome: string | null }> | null;
};
type Revision = {
  id: string;
  thesis_id: string;
  change_type: "edit" | "withdraw" | "restore" | "delete";
  snapshot: Record<string, unknown>;
  created_at: string;
};

const tabs: Array<{ id: Status | "all"; label: string }> = [
  { id: "all", label: "All" },
  { id: "active", label: "Active" },
  { id: "withdrawn", label: "Withdrawn" },
  { id: "deleted", label: "Deleted" },
];

const statusStyle: Record<Status, string> = {
  active: "bg-emerald-500/10 text-emerald-400",
  withdrawn: "bg-amber-500/10 text-amber-400",
  deleted: "bg-rose-500/10 text-rose-400",
};

export default function TheFloorMyTheses() {
  const [theses, setTheses] = useState<Thesis[]>([]);
  const [revisions, setRevisions] = useState<Revision[]>([]);
  const [tab, setTab] = useState<Status | "all">("all");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Revision | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) {
      window.location.replace("/login?next=%2Fthe-floor%2Fmy-theses");
      return;
    }
    const [thesisResult, revisionResult] = await Promise.all([
      supabase
        .from("floor_theses")
        .select("id, ticker, stance, conviction, horizon, thesis, exit_plan, catalysts, risks, lifecycle_status, created_at, updated_at, floor_calls(id, status, outcome)")
        .eq("author_id", auth.user.id)
        .order("updated_at", { ascending: false }),
      supabase
        .from("floor_thesis_revisions")
        .select("id, thesis_id, change_type, snapshot, created_at")
        .eq("author_id", auth.user.id)
        .order("created_at", { ascending: false }),
    ]);
    if (thesisResult.error) setMessage(thesisResult.error.message);
    else setTheses((thesisResult.data ?? []) as unknown as Thesis[]);
    if (!revisionResult.error) setRevisions((revisionResult.data ?? []) as unknown as Revision[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("created") === "1") {
      setMessage("Your thesis was published and is now available in My Theses.");
    }
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return theses.filter((item) => {
      if (tab !== "all" && item.lifecycle_status !== tab) return false;
      return !needle || item.ticker.toLowerCase().includes(needle) || item.thesis.toLowerCase().includes(needle);
    });
  }, [query, tab, theses]);

  const counts = useMemo(() => ({
    all: theses.length,
    active: theses.filter((item) => item.lifecycle_status === "active").length,
    withdrawn: theses.filter((item) => item.lifecycle_status === "withdrawn").length,
    deleted: theses.filter((item) => item.lifecycle_status === "deleted").length,
  }), [theses]);

  async function changeStatus(thesis: Thesis, action: "withdraw" | "restore" | "delete") {
    const wording = action === "delete"
      ? "Remove this thesis from public Floor views? You can restore it from the Deleted tab."
      : action === "withdraw"
        ? "Withdraw this thesis while preserving its accountability record?"
        : "Restore this thesis to active public research?";
    if (!window.confirm(wording)) return;
    setBusyId(thesis.id);
    setMessage("");
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) throw new Error("Sign in again before continuing.");
      const response = await fetch(`/api/floor/theses/${thesis.id}`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const result = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) throw new Error(result.error ?? "Unable to update this thesis.");
      setMessage(action === "restore" ? "Thesis restored." : action === "withdraw" ? "Thesis withdrawn." : "Thesis moved to Deleted.");
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to update this thesis.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <main className="min-h-screen bg-[var(--loombus-page-bg)] px-4 pb-24 pt-6 text-[var(--loombus-text)] sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <Link href="/the-floor" className="inline-flex items-center gap-2 text-sm font-black text-[var(--loombus-text-muted)] hover:text-[var(--loombus-gold)]">
          <ArrowLeft className="size-4" /> Back to The Floor
        </Link>

        <header className="mt-4 rounded-[2rem] border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-5 shadow-xl shadow-black/10 sm:p-7">
          <p className="text-xs font-black uppercase tracking-[0.15em] text-[var(--loombus-gold)]">Research ownership</p>
          <h1 className="mt-2 text-3xl font-black sm:text-4xl">My Theses</h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-[var(--loombus-text-muted)]">
            Manage every thesis you have published. Withdrawals and deletions preserve the audit trail so your research history cannot be silently rewritten.
          </p>
          <div className="mt-5 grid gap-3 sm:grid-cols-4">
            {(["all", "active", "withdrawn", "deleted"] as const).map((status) => (
              <div key={status} className="rounded-2xl border border-[var(--loombus-border)] bg-[var(--loombus-page-bg)] p-4">
                <p className="text-xs font-black uppercase tracking-wide text-[var(--loombus-text-subtle)]">{status}</p>
                <p className="mt-1 text-2xl font-black">{counts[status]}</p>
              </div>
            ))}
          </div>
        </header>

        <div className="mt-5 flex flex-col gap-3 rounded-3xl border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-4 sm:flex-row sm:items-center">
          <div className="flex gap-2 overflow-x-auto">
            {tabs.map((item) => (
              <button key={item.id} type="button" onClick={() => setTab(item.id)} className={`shrink-0 rounded-full border px-4 py-2 text-sm font-black ${tab === item.id ? "border-[var(--loombus-gold)] bg-[var(--loombus-gold-surface)] text-[var(--loombus-gold)]" : "border-[var(--loombus-border)] text-[var(--loombus-text-muted)]"}`}>
                {item.label} <span className="ml-1 opacity-70">{counts[item.id]}</span>
              </button>
            ))}
          </div>
          <label className="relative sm:ml-auto sm:w-72">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--loombus-text-subtle)]" />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search ticker or thesis" className="min-h-11 w-full rounded-full border border-[var(--loombus-border)] bg-[var(--loombus-page-bg)] pl-10 pr-4 text-sm outline-none focus:border-[var(--loombus-gold)]" />
          </label>
        </div>

        {message ? <div className="mt-4 rounded-2xl border border-[var(--loombus-border)] bg-[var(--loombus-surface)] px-4 py-3 text-sm font-bold" role="status">{message}</div> : null}

        {loading ? (
          <div className="mt-5 flex justify-center rounded-3xl border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-10"><Loader2 className="size-6 animate-spin text-[var(--loombus-gold)]" /></div>
        ) : (
          <section className="mt-5 space-y-4">
            {filtered.map((item) => {
              const history = revisions.filter((revision) => revision.thesis_id === item.id);
              return (
                <article key={item.id} className="rounded-3xl border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-5 shadow-sm">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-[var(--loombus-gold-surface)] px-3 py-1 text-xs font-black text-[var(--loombus-gold)]">{item.ticker}</span>
                    <span className="rounded-full bg-[var(--loombus-surface-muted)] px-3 py-1 text-xs font-black">{floorStanceLabel(item.stance)}</span>
                    <span className="rounded-full bg-[var(--loombus-surface-muted)] px-3 py-1 text-xs font-bold text-[var(--loombus-text-muted)]">{floorHorizonLabel(item.horizon)}</span>
                    <span className={`rounded-full px-3 py-1 text-xs font-black capitalize ${statusStyle[item.lifecycle_status]}`}>{item.lifecycle_status}</span>
                    <span className="ml-auto text-xs font-black text-[var(--loombus-text-subtle)]">Conviction {item.conviction}/5</span>
                  </div>
                  <p className="mt-4 line-clamp-3 whitespace-pre-line text-sm leading-6">{normalizePublicText(item.thesis)}</p>
                  <div className="mt-4 flex flex-wrap gap-4 text-xs font-bold text-[var(--loombus-text-muted)]">
                    <span>{item.floor_calls?.length ?? 0} attached calls</span>
                    <span>Published {new Date(item.created_at).toLocaleDateString()}</span>
                    <span>Updated {new Date(item.updated_at).toLocaleDateString()}</span>
                    <span>{history.length} saved revisions</span>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2 border-t border-[var(--loombus-border-muted)] pt-4">
                    {item.lifecycle_status !== "deleted" ? (
                      <Link href={`/the-floor#thesis-${item.id}`} className="inline-flex min-h-10 items-center gap-2 rounded-full border border-[var(--loombus-border)] px-4 text-xs font-black"><Pencil className="size-4" />Open and edit</Link>
                    ) : null}
                    {item.lifecycle_status === "active" ? (
                      <button type="button" disabled={busyId === item.id} onClick={() => void changeStatus(item, "withdraw")} className="inline-flex min-h-10 items-center gap-2 rounded-full border border-[var(--loombus-border)] px-4 text-xs font-black"><Ban className="size-4" />Withdraw</button>
                    ) : (
                      <button type="button" disabled={busyId === item.id} onClick={() => void changeStatus(item, "restore")} className="inline-flex min-h-10 items-center gap-2 rounded-full border border-[var(--loombus-border)] px-4 text-xs font-black"><RotateCcw className="size-4" />Restore</button>
                    )}
                    {item.lifecycle_status !== "deleted" ? (
                      <button type="button" disabled={busyId === item.id} onClick={() => void changeStatus(item, "delete")} className="inline-flex min-h-10 items-center gap-2 rounded-full border border-rose-500/30 px-4 text-xs font-black text-rose-400"><Trash2 className="size-4" />Move to Deleted</button>
                    ) : null}
                    {history.length ? (
                      <button type="button" onClick={() => setSelected(history[0])} className="inline-flex min-h-10 items-center gap-2 rounded-full border border-[var(--loombus-border)] px-4 text-xs font-black"><FileClock className="size-4" />View history</button>
                    ) : null}
                    {busyId === item.id ? <Loader2 className="size-4 animate-spin self-center text-[var(--loombus-gold)]" /> : null}
                  </div>
                  {history.length ? (
                    <div className="mt-3 flex gap-2 overflow-x-auto">
                      {history.map((revision) => (
                        <button key={revision.id} type="button" onClick={() => setSelected(revision)} className="shrink-0 rounded-full bg-[var(--loombus-surface-muted)] px-3 py-1.5 text-xs font-bold capitalize text-[var(--loombus-text-muted)]">
                          {revision.change_type} · {new Date(revision.created_at).toLocaleDateString()}
                        </button>
                      ))}
                    </div>
                  ) : null}
                </article>
              );
            })}
            {!filtered.length ? <div className="rounded-3xl border border-dashed border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-10 text-center text-sm font-bold text-[var(--loombus-text-muted)]">No theses match this view.</div> : null}
          </section>
        )}
      </div>

      {selected ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4" role="dialog" aria-modal="true" aria-labelledby="revision-title" onClick={() => setSelected(null)}>
          <div className="max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-3xl border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-5 shadow-2xl" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-start justify-between gap-4">
              <div><p className="text-xs font-black uppercase tracking-wide text-[var(--loombus-gold)]">Saved snapshot</p><h2 id="revision-title" className="mt-1 text-xl font-black capitalize">{selected.change_type} revision</h2></div>
              <button type="button" onClick={() => setSelected(null)} className="rounded-full border border-[var(--loombus-border)] px-3 py-1 text-sm font-black">Close</button>
            </div>
            <p className="mt-2 flex items-center gap-2 text-xs font-bold text-[var(--loombus-text-muted)]"><Clock3 className="size-4" />{new Date(selected.created_at).toLocaleString()}</p>
            <div className="mt-5 space-y-4">
              {["thesis", "exit_plan", "catalysts", "risks"].map((field) => {
                const value = selected.snapshot[field];
                return value ? <div key={field}><p className="text-xs font-black uppercase tracking-wide text-[var(--loombus-text-subtle)]">{field.replace("_", " ")}</p><p className="mt-1 whitespace-pre-line text-sm leading-6">{normalizePublicText(String(value))}</p></div> : null;
              })}
              <p className="text-xs font-bold text-[var(--loombus-text-muted)]">Snapshot conviction: {String(selected.snapshot.conviction ?? "Not recorded")}</p>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
