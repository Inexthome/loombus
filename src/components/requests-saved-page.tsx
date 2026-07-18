"use client";

import Link from "next/link";
import { Bookmark, MapPin, RefreshCw, Trash2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { formatRequestBudget, requestLocationLabel, requestTypeLabel, type PublicServiceRequest } from "@/lib/service-requests";
import { serviceRequestsAuthorizedFetch } from "@/lib/service-requests-client";

export default function RequestsSavedPage() {
  const [requests, setRequests] = useState<PublicServiceRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    setLoading(true); setNotice("");
    try {
      const response = await serviceRequestsAuthorizedFetch("/api/requests?saved=1", { cache: "no-store" }, "/requests/saved");
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error ?? "Unable to load saved Requests.");
      setRequests(Array.isArray(payload.requests) ? payload.requests : []);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Unable to load saved Requests."); setRequests([]);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function remove(requestId: string) {
    if (working) return; setWorking(requestId); setNotice("");
    try {
      const response = await serviceRequestsAuthorizedFetch("/api/requests", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "unsave", requestId }) }, "/requests/saved");
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error ?? "Unable to remove the saved Request.");
      setRequests((current) => current.filter((item) => item.id !== requestId));
    } catch (error) { setNotice(error instanceof Error ? error.message : "Unable to remove the saved Request."); }
    finally { setWorking(""); }
  }

  return (
    <main className="min-h-screen bg-[var(--loombus-page-bg)] px-4 py-8 text-[var(--loombus-text)] sm:px-6">
      <div className="mx-auto max-w-6xl space-y-6">
        <header className="rounded-[2rem] border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-6 sm:p-8"><div className="flex flex-wrap items-end justify-between gap-5"><div><p className="text-xs font-bold uppercase tracking-[0.2em] text-[var(--loombus-text-subtle)]">Saved Requests</p><h1 className="mt-2 text-4xl font-semibold">Return to needs worth following.</h1><p className="mt-3 text-[var(--loombus-text-muted)]">Saved Requests remain private to your account.</p></div><div className="flex gap-3"><Link href="/requests" className="rounded-full border border-[var(--loombus-border)] px-5 py-3 text-sm font-semibold">Browse Requests</Link><button type="button" onClick={() => void load()} className="inline-flex items-center gap-2 rounded-full border border-[var(--loombus-border)] px-5 py-3 text-sm font-semibold"><RefreshCw size={16} className={loading ? "animate-spin" : ""} /> Refresh</button></div></div></header>
        {notice ? <div className="rounded-2xl border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-4 text-sm" role="alert">{notice}</div> : null}
        {loading ? <section className="rounded-[1.6rem] border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-10 text-center">Loading saved Requests…</section> : requests.length === 0 ? <section className="rounded-[1.6rem] border border-dashed border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-10 text-center"><Bookmark className="mx-auto text-[var(--loombus-text-subtle)]" size={42} /><h2 className="mt-4 text-2xl font-semibold">No saved Requests yet.</h2></section> : <section className="grid gap-4 md:grid-cols-2">{requests.map((item) => <article key={item.id} className="rounded-[1.6rem] border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-5"><div className="flex items-start justify-between gap-4"><div><span className="rounded-full border border-[var(--loombus-border)] px-3 py-1 text-xs font-semibold">{requestTypeLabel(item.requestType)}</span><Link href={`/requests/${item.slug}`} className="mt-3 block text-xl font-semibold hover:underline">{item.title}</Link><p className="mt-2 line-clamp-3 text-sm leading-6 text-[var(--loombus-text-muted)]">{item.description}</p></div><button type="button" onClick={() => void remove(item.id)} disabled={working === item.id} className="text-red-500" aria-label={`Remove ${item.title}`}><Trash2 size={18} /></button></div><div className="mt-5 flex flex-wrap gap-4 border-t border-[var(--loombus-border)] pt-4 text-xs text-[var(--loombus-text-muted)]"><span className="inline-flex items-center gap-1"><MapPin size={13} /> {requestLocationLabel(item)}</span><span>{formatRequestBudget(item)}</span><span className="capitalize">{item.status.replaceAll("_", " ")}</span></div></article>)}</section>}
      </div>
    </main>
  );
}
