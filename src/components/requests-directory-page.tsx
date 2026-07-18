"use client";

import Link from "next/link";
import { Bookmark, Filter, HandHeart, MapPin, Search, SlidersHorizontal } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import {
  SERVICE_REQUEST_CATEGORIES,
  SERVICE_REQUEST_TYPES,
  formatRequestBudget,
  requestLocationLabel,
  requestTypeLabel,
  requestUrgencyLabel,
  type PublicServiceRequest,
  type ServiceRequestsDirectoryResponse,
} from "@/lib/service-requests";

export default function RequestsDirectoryPage() {
  const [requests, setRequests] = useState<PublicServiceRequest[]>([]);
  const [total, setTotal] = useState(0);
  const [query, setQuery] = useState("");
  const [type, setType] = useState("all");
  const [category, setCategory] = useState("all");
  const [urgency, setUrgency] = useState("all");
  const [location, setLocation] = useState("");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setNotice("");
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: "24" });
      if (query.trim()) params.set("q", query.trim());
      if (type !== "all") params.set("type", type);
      if (category !== "all") params.set("category", category);
      if (urgency !== "all") params.set("urgency", urgency);
      if (location.trim()) params.set("location", location.trim());
      const response = await fetch(`/api/requests?${params.toString()}`, { cache: "no-store" });
      const payload = (await response.json().catch(() => ({}))) as Partial<ServiceRequestsDirectoryResponse> & { error?: string };
      if (!response.ok) throw new Error(payload.error ?? "Unable to load Requests.");
      setRequests(Array.isArray(payload.requests) ? payload.requests : []);
      setTotal(Number(payload.total ?? 0));
    } catch (error) {
      setRequests([]);
      setTotal(0);
      setNotice(error instanceof Error ? error.message : "Unable to load Requests.");
    } finally {
      setLoading(false);
    }
  }, [category, location, page, query, type, urgency]);

  useEffect(() => {
    const timeout = window.setTimeout(() => void load(), 180);
    return () => window.clearTimeout(timeout);
  }, [load]);

  useEffect(() => setPage(1), [category, location, query, type, urgency]);

  const pageCount = Math.max(Math.ceil(total / 24), 1);

  return (
    <main className="min-h-screen bg-[var(--loombus-page-bg)] px-4 py-8 text-[var(--loombus-text)] sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="rounded-[2rem] border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-6 sm:p-8">
          <div className="grid gap-7 lg:grid-cols-[1fr_auto] lg:items-end">
            <div className="max-w-3xl">
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-[var(--loombus-text-subtle)]">Loombus Requests</p>
              <h1 className="mt-3 text-4xl font-semibold tracking-tight sm:text-5xl">State the need. Reach the right person.</h1>
              <p className="mt-4 text-base leading-7 text-[var(--loombus-text-muted)]">Ask for a service, quote, recommendation, consultation, community help, or a solution to a local problem. Responses remain attributable, and private conversation begins only after the requester selects a response.</p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link href="/requests/saved" className="inline-flex items-center gap-2 rounded-full border border-[var(--loombus-border)] px-5 py-3 text-sm font-semibold"><Bookmark size={16} /> Saved</Link>
              <Link href="/requests/manage" className="inline-flex items-center gap-2 rounded-full bg-[var(--loombus-primary-bg)] px-5 py-3 text-sm font-semibold text-[var(--loombus-primary-text)]"><SlidersHorizontal size={16} /> Create or manage</Link>
            </div>
          </div>
          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            <article className="rounded-2xl bg-[var(--loombus-page-bg)] p-4"><span className="text-xs text-[var(--loombus-text-muted)]">Open Requests</span><strong className="mt-1 block text-2xl">{total}</strong></article>
            <article className="rounded-2xl bg-[var(--loombus-page-bg)] p-4"><span className="text-xs text-[var(--loombus-text-muted)]">Ranking</span><strong className="mt-1 block text-sm">Urgency, then recency</strong></article>
            <article className="rounded-2xl bg-[var(--loombus-page-bg)] p-4"><span className="text-xs text-[var(--loombus-text-muted)]">Private needs</span><Link href="/rooms" className="mt-1 block font-semibold underline">Use a Room Request Center</Link></article>
          </div>
        </header>

        <section className="rounded-[1.6rem] border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-5">
          <div className="grid gap-3 lg:grid-cols-[1fr_200px_220px_170px]">
            <label className="relative">
              <Search className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[var(--loombus-text-subtle)]" size={18} />
              <input value={query} onChange={(event: any) => setQuery(event.target.value)} placeholder="Search need, skill, category, or place" className="w-full rounded-2xl border border-[var(--loombus-border)] bg-[var(--loombus-page-bg)] py-3 pl-11 pr-4" />
            </label>
            <select value={type} onChange={(event: any) => setType(event.target.value)} className="rounded-2xl border border-[var(--loombus-border)] bg-[var(--loombus-page-bg)] px-4 py-3" aria-label="Request type">
              <option value="all">All request types</option>
              {SERVICE_REQUEST_TYPES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
            </select>
            <select value={category} onChange={(event: any) => setCategory(event.target.value)} className="rounded-2xl border border-[var(--loombus-border)] bg-[var(--loombus-page-bg)] px-4 py-3" aria-label="Request category">
              <option value="all">All categories</option>
              {SERVICE_REQUEST_CATEGORIES.map((item) => <option key={item}>{item}</option>)}
            </select>
            <select value={urgency} onChange={(event: any) => setUrgency(event.target.value)} className="rounded-2xl border border-[var(--loombus-border)] bg-[var(--loombus-page-bg)] px-4 py-3" aria-label="Urgency">
              <option value="all">All urgency</option><option value="normal">Normal</option><option value="soon">Needed soon</option><option value="urgent">Urgent</option>
            </select>
          </div>
          <div className="mt-3 flex flex-wrap gap-3">
            <label className="relative min-w-[240px] flex-1"><MapPin className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[var(--loombus-text-subtle)]" size={17} /><input value={location} onChange={(event: any) => setLocation(event.target.value)} placeholder="City, region, or postal code" className="w-full rounded-2xl border border-[var(--loombus-border)] bg-[var(--loombus-page-bg)] py-3 pl-11 pr-4" /></label>
            <button type="button" onClick={() => { setQuery(""); setType("all"); setCategory("all"); setUrgency("all"); setLocation(""); }} className="inline-flex items-center gap-2 rounded-full border border-[var(--loombus-border)] px-4 py-2 text-sm font-semibold"><Filter size={15} /> Clear</button>
          </div>
        </section>

        {notice ? <section className="rounded-2xl border border-red-500/30 bg-red-500/10 p-5 text-sm" role="alert">{notice}</section> : null}
        {loading ? (
          <section className="rounded-[1.6rem] border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-10 text-center text-[var(--loombus-text-muted)]">Gathering open Requests…</section>
        ) : requests.length === 0 ? (
          <section className="rounded-[1.6rem] border border-dashed border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-10 text-center"><HandHeart className="mx-auto text-[var(--loombus-text-subtle)]" size={42} /><h2 className="mt-4 text-2xl font-semibold">No Requests match this view.</h2></section>
        ) : (
          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {requests.map((item) => (
              <Link key={item.id} href={`/requests/${item.slug}`} className="group flex min-h-[340px] flex-col rounded-[1.6rem] border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-5 transition hover:-translate-y-0.5 hover:shadow-lg">
                <div className="flex flex-wrap gap-2 text-[11px] font-semibold"><span className="rounded-full border border-[var(--loombus-border)] px-3 py-1">{requestTypeLabel(item.requestType)}</span><span className="rounded-full border border-[var(--loombus-border)] px-3 py-1">{requestUrgencyLabel(item.urgency)}</span></div>
                <h2 className="mt-5 text-2xl font-semibold leading-tight group-hover:underline">{item.title}</h2>
                <p className="mt-3 line-clamp-4 text-sm leading-6 text-[var(--loombus-text-muted)]">{item.description}</p>
                <div className="mt-auto space-y-2 pt-6 text-sm text-[var(--loombus-text-muted)]"><span className="flex items-center gap-2"><MapPin size={16} /> {requestLocationLabel(item)}</span><span>{formatRequestBudget(item)}</span><span>{item.businessName || item.requesterName}</span></div>
                <div className="mt-4 border-t border-[var(--loombus-border)] pt-4 text-xs text-[var(--loombus-text-muted)]">{item.responseCount} response{item.responseCount === 1 ? "" : "s"}</div>
              </Link>
            ))}
          </section>
        )}

        {pageCount > 1 ? <nav className="flex justify-center gap-3"><button type="button" disabled={page <= 1} onClick={() => setPage((current) => Math.max(current - 1, 1))} className="rounded-full border border-[var(--loombus-border)] px-5 py-2 text-sm font-semibold disabled:opacity-40">Previous</button><span className="py-2 text-sm text-[var(--loombus-text-muted)]">Page {page} of {pageCount}</span><button type="button" disabled={page >= pageCount} onClick={() => setPage((current) => Math.min(current + 1, pageCount))} className="rounded-full border border-[var(--loombus-border)] px-5 py-2 text-sm font-semibold disabled:opacity-40">Next</button></nav> : null}
        <section className="rounded-[1.6rem] border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-5 text-sm leading-6 text-[var(--loombus-text-muted)]">Loombus does not process payment, verify professional licensing, guarantee credentials, or promise that a response will solve the Request. Confirm identity, qualifications, scope, pricing, and safety before meeting or paying anyone. <Link href="/requests/safety" className="font-semibold underline">Read Requests safety</Link>.</section>
      </div>
    </main>
  );
}
