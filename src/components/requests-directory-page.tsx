"use client";

import Link from "next/link";
import {
  ArrowUpRight,
  Bookmark,
  BriefcaseBusiness,
  ChevronRight,
  Clock3,
  HandHeart,
  Loader2,
  MapPin,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  SERVICE_REQUEST_CATEGORIES,
  SERVICE_REQUEST_TYPES,
  formatRequestBudget,
  formatRequestDate,
  requestLocationLabel,
  requestTypeLabel,
  requestUrgencyLabel,
  type PublicServiceRequest,
  type ServiceRequestsDirectoryResponse,
} from "@/lib/service-requests";

const controlClass =
  "h-12 w-full rounded-2xl border border-[color:var(--loombus-border)] bg-[color:var(--loombus-page-bg)] px-4 text-sm text-[color:var(--loombus-text)] outline-none transition placeholder:text-[color:var(--loombus-text-subtle)] focus:border-[color:var(--loombus-gold)] focus:ring-4 focus:ring-[color:var(--loombus-gold-soft)]";

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
      const response = await fetch(`/api/requests?${params.toString()}`, {
        cache: "no-store",
      });
      const payload = (await response.json().catch(() => ({}))) as Partial<ServiceRequestsDirectoryResponse> & {
        error?: string;
      };
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

  useEffect(() => {
    setPage(1);
  }, [category, location, query, type, urgency]);

  const pageCount = Math.max(Math.ceil(total / 24), 1);
  const urgentCount = useMemo(
    () => requests.filter((request) => request.urgency === "urgent").length,
    [requests],
  );
  const responseCount = useMemo(
    () => requests.reduce((sum, request) => sum + request.responseCount, 0),
    [requests],
  );
  const activeFilterCount = [
    query.trim(),
    type !== "all",
    category !== "all",
    urgency !== "all",
    location.trim(),
  ].filter(Boolean).length;

  function clearFilters() {
    setQuery("");
    setType("all");
    setCategory("all");
    setUrgency("all");
    setLocation("");
  }

  return (
    <main className="min-h-screen bg-[color:var(--loombus-page-bg)] px-4 pb-24 pt-5 text-[color:var(--loombus-text)] sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[86rem]">
        <header className="mb-6 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <h1 className="text-4xl font-semibold tracking-[-0.055em] sm:text-5xl">Requests</h1>
            <p className="mt-3 text-base leading-7 text-[color:var(--loombus-text-muted)]">
              Find accountable public needs for services, quotes, recommendations, consultations, community help, volunteer support, and local problem solving.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href="/requests/saved"
              className="inline-flex h-12 items-center gap-2 rounded-2xl border border-[color:var(--loombus-border)] bg-[color:var(--loombus-surface)] px-4 text-sm font-semibold shadow-sm transition hover:border-[color:var(--loombus-gold)]"
            >
              <Bookmark size={16} className="text-[color:var(--loombus-gold)]" /> Saved Requests
            </Link>
            <Link
              href="/requests/manage"
              className="inline-flex h-12 items-center gap-2 rounded-2xl bg-[color:var(--loombus-gold)] px-4 text-sm font-semibold text-[color:var(--loombus-gold-contrast)] transition hover:opacity-90"
            >
              <SlidersHorizontal size={16} /> Create or manage
            </Link>
          </div>
        </header>

        <section className="mb-6 grid gap-3 sm:grid-cols-3">
          <article className="rounded-[1.4rem] border border-[color:var(--loombus-gold)] bg-[color:var(--loombus-cream)] p-4 text-[color:var(--loombus-cream-contrast)] shadow-sm dark:bg-[color:var(--loombus-gold-soft)] dark:text-[color:var(--loombus-text)]">
            <span className="text-xs font-bold uppercase tracking-[0.18em] text-[color:var(--loombus-gold)]">Open Requests</span>
            <strong className="mt-2 block text-3xl tracking-[-0.04em]">{total}</strong>
          </article>
          <article className="rounded-[1.4rem] border border-[color:var(--loombus-border)] bg-[color:var(--loombus-surface)] p-4 shadow-sm">
            <span className="text-xs font-bold uppercase tracking-[0.18em] text-[color:var(--loombus-text-muted)]">Urgent in view</span>
            <strong className="mt-2 block text-3xl tracking-[-0.04em]">{urgentCount}</strong>
          </article>
          <article className="rounded-[1.4rem] border border-[color:var(--loombus-border)] bg-[color:var(--loombus-surface)] p-4 shadow-sm">
            <span className="text-xs font-bold uppercase tracking-[0.18em] text-[color:var(--loombus-text-muted)]">Responses in view</span>
            <strong className="mt-2 block text-3xl tracking-[-0.04em]">{responseCount}</strong>
          </article>
        </section>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_21rem]">
          <section className="min-w-0">
            <div className="mb-4 flex gap-3">
              <label className="relative flex-1">
                <span className="sr-only">Search Requests</span>
                <Search className="pointer-events-none absolute left-5 top-1/2 h-5 w-5 -translate-y-1/2 text-[color:var(--loombus-text-subtle)]" />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search need, skill, category, or place"
                  className="h-14 w-full rounded-2xl border border-[color:var(--loombus-border)] bg-[color:var(--loombus-surface)] pl-14 pr-5 text-base outline-none shadow-sm transition placeholder:text-[color:var(--loombus-text-subtle)] focus:border-[color:var(--loombus-gold)] focus:ring-4 focus:ring-[color:var(--loombus-gold-soft)]"
                />
              </label>
              <button
                type="button"
                onClick={clearFilters}
                className="relative flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-[color:var(--loombus-border)] bg-[color:var(--loombus-surface)] shadow-sm transition hover:border-[color:var(--loombus-gold)]"
                aria-label="Clear Request filters"
              >
                <SlidersHorizontal className="h-5 w-5" />
                {activeFilterCount > 0 ? (
                  <span className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-[color:var(--loombus-gold)] px-1 text-[10px] font-bold text-[color:var(--loombus-gold-contrast)]">{activeFilterCount}</span>
                ) : null}
              </button>
            </div>

            <nav className="mb-6 flex gap-2 overflow-x-auto pb-1" aria-label="Request types">
              <button
                type="button"
                onClick={() => setType("all")}
                className={`shrink-0 rounded-full border px-4 py-2.5 text-sm font-semibold shadow-sm transition ${
                  type === "all"
                    ? "border-[color:var(--loombus-gold)] bg-[color:var(--loombus-cream)] text-[color:var(--loombus-cream-contrast)] dark:bg-[color:var(--loombus-gold-soft)] dark:text-[color:var(--loombus-gold)]"
                    : "border-[color:var(--loombus-border)] bg-[color:var(--loombus-surface)] hover:border-[color:var(--loombus-gold)]"
                }`}
              >
                All Requests
              </button>
              {SERVICE_REQUEST_TYPES.map((item) => (
                <button
                  key={item.value}
                  type="button"
                  onClick={() => setType(item.value)}
                  className={`shrink-0 rounded-full border px-4 py-2.5 text-sm font-semibold shadow-sm transition ${
                    type === item.value
                      ? "border-[color:var(--loombus-gold)] bg-[color:var(--loombus-cream)] text-[color:var(--loombus-cream-contrast)] dark:bg-[color:var(--loombus-gold-soft)] dark:text-[color:var(--loombus-gold)]"
                      : "border-[color:var(--loombus-border)] bg-[color:var(--loombus-surface)] hover:border-[color:var(--loombus-gold)]"
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </nav>

            {notice ? (
              <section className="mb-5 rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm" role="alert">{notice}</section>
            ) : null}

            {loading ? (
              <section className="rounded-[1.75rem] border border-[color:var(--loombus-border)] bg-[color:var(--loombus-surface)] p-10 text-center text-[color:var(--loombus-text-muted)] shadow-xl shadow-black/10">
                <Loader2 className="mx-auto animate-spin text-[color:var(--loombus-gold)]" size={28} />
                <p className="mt-3">Gathering open Requests…</p>
              </section>
            ) : requests.length === 0 ? (
              <section className="rounded-[1.75rem] border border-dashed border-[color:var(--loombus-border)] bg-[color:var(--loombus-surface)] p-10 text-center shadow-xl shadow-black/10">
                <HandHeart className="mx-auto text-[color:var(--loombus-gold)]" size={42} />
                <h2 className="mt-4 text-2xl font-semibold tracking-[-0.035em]">No Requests match this view.</h2>
                <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-[color:var(--loombus-text-muted)]">Clear a filter or create the first Request for this need.</p>
                <Link href="/requests/manage" className="mt-5 inline-flex rounded-full bg-[color:var(--loombus-gold)] px-5 py-3 text-sm font-semibold text-[color:var(--loombus-gold-contrast)]">Create Request</Link>
              </section>
            ) : (
              <section>
                <div className="mb-4">
                  <p className="text-xs font-bold uppercase tracking-[0.28em] text-[color:var(--loombus-gold)]">Public needs</p>
                  <h2 className="mt-1 text-2xl font-semibold tracking-[-0.035em]">{total} open Request{total === 1 ? "" : "s"}</h2>
                </div>

                <div className="grid gap-4 md:grid-cols-2" aria-label="Public Requests">
                  {requests.map((item) => {
                    const deadline = formatRequestDate(item.deadline);
                    return (
                      <Link
                        key={item.id}
                        href={`/requests/${item.slug}`}
                        className="group flex min-h-[350px] flex-col rounded-[1.75rem] border border-[color:var(--loombus-border)] bg-[color:var(--loombus-surface)] p-5 shadow-lg shadow-black/5 transition hover:-translate-y-0.5 hover:border-[color:var(--loombus-gold)] hover:shadow-xl"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <span className="grid h-11 w-11 place-items-center rounded-2xl bg-[color:var(--loombus-cream)] text-[color:var(--loombus-gold)] dark:bg-[color:var(--loombus-gold-soft)]"><HandHeart size={20} /></span>
                          <div className="flex flex-wrap justify-end gap-2 text-[11px] font-semibold text-[color:var(--loombus-text-muted)]">
                            <span className="rounded-full border border-[color:var(--loombus-border)] px-3 py-1">{requestTypeLabel(item.requestType)}</span>
                            <span className={`rounded-full px-3 py-1 ${item.urgency === "urgent" ? "bg-red-500/10 text-red-500" : "border border-[color:var(--loombus-border)]"}`}>{requestUrgencyLabel(item.urgency)}</span>
                          </div>
                        </div>

                        <h3 className="mt-5 text-2xl font-semibold leading-tight tracking-[-0.035em] group-hover:underline">{item.title}</h3>
                        <p className="mt-3 line-clamp-4 text-sm leading-6 text-[color:var(--loombus-text-muted)]">{item.description}</p>

                        <div className="mt-auto space-y-3 pt-6 text-sm text-[color:var(--loombus-text-muted)]">
                          <span className="flex items-start gap-3"><MapPin className="mt-0.5 shrink-0 text-[color:var(--loombus-gold)]" size={16} />{requestLocationLabel(item)}</span>
                          <span className="flex items-start gap-3"><BriefcaseBusiness className="mt-0.5 shrink-0 text-[color:var(--loombus-gold)]" size={16} />{formatRequestBudget(item)}</span>
                          {item.deadline ? <span className="flex items-start gap-3"><Clock3 className="mt-0.5 shrink-0 text-[color:var(--loombus-gold)]" size={16} />Deadline {deadline}</span> : null}
                        </div>

                        <div className="mt-5 flex items-center justify-between gap-3 border-t border-[color:var(--loombus-border-muted)] pt-4 text-xs text-[color:var(--loombus-text-muted)]">
                          <span>{item.businessName || item.requesterName}</span>
                          <span>{item.responseCount} response{item.responseCount === 1 ? "" : "s"}</span>
                          <span className="inline-flex items-center gap-1 font-semibold text-[color:var(--loombus-gold)]">Open Request <ArrowUpRight size={13} /></span>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </section>
            )}

            {pageCount > 1 ? (
              <nav className="mt-6 flex justify-center gap-3" aria-label="Requests pages">
                <button type="button" disabled={page <= 1} onClick={() => setPage((current) => Math.max(current - 1, 1))} className="rounded-full border border-[color:var(--loombus-border)] bg-[color:var(--loombus-surface)] px-5 py-2 text-sm font-semibold transition hover:border-[color:var(--loombus-gold)] disabled:opacity-40">Previous</button>
                <span className="py-2 text-sm text-[color:var(--loombus-text-muted)]">Page {page} of {pageCount}</span>
                <button type="button" disabled={page >= pageCount} onClick={() => setPage((current) => Math.min(current + 1, pageCount))} className="rounded-full border border-[color:var(--loombus-border)] bg-[color:var(--loombus-surface)] px-5 py-2 text-sm font-semibold transition hover:border-[color:var(--loombus-gold)] disabled:opacity-40">Next</button>
              </nav>
            ) : null}
          </section>

          <aside className="space-y-5 xl:sticky xl:top-28 xl:self-start">
            <section className="rounded-[1.75rem] border border-[color:var(--loombus-border)] bg-[color:var(--loombus-surface)] p-5 shadow-2xl shadow-black/10">
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs font-bold uppercase tracking-[0.3em]">Request filters</p>
                <SlidersHorizontal className="h-5 w-5 text-[color:var(--loombus-gold)]" />
              </div>
              <div className="mt-4 space-y-3">
                <select value={category} onChange={(event) => setCategory(event.target.value)} className={controlClass} aria-label="Request category">
                  <option value="all">All categories</option>
                  {SERVICE_REQUEST_CATEGORIES.map((item) => <option key={item}>{item}</option>)}
                </select>
                <select value={urgency} onChange={(event) => setUrgency(event.target.value)} className={controlClass} aria-label="Request urgency">
                  <option value="all">All urgency</option>
                  <option value="normal">Normal</option>
                  <option value="soon">Needed soon</option>
                  <option value="urgent">Urgent</option>
                </select>
                <label className="relative block">
                  <span className="sr-only">Request location</span>
                  <MapPin className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[color:var(--loombus-text-subtle)]" />
                  <input value={location} onChange={(event) => setLocation(event.target.value)} placeholder="City, region, or postal code" className={`${controlClass} pl-11`} />
                </label>
                <button type="button" onClick={clearFilters} className="w-full rounded-full border border-[color:var(--loombus-border)] px-4 py-2 text-sm font-semibold transition hover:border-[color:var(--loombus-gold)]">Clear filters</button>
              </div>
            </section>

            <section className="rounded-[1.75rem] border border-[color:var(--loombus-border)] bg-[color:var(--loombus-surface)] p-5 shadow-2xl shadow-black/10">
              <p className="text-xs font-bold uppercase tracking-[0.3em]">Request tools</p>
              <div className="mt-4 space-y-2">
                <Link href="/requests/manage" className="flex items-center justify-between rounded-2xl bg-[color:var(--loombus-page-bg)] px-4 py-3 text-sm font-semibold transition hover:bg-[color:var(--loombus-surface-muted)]">Create or manage <ChevronRight className="h-4 w-4 text-[color:var(--loombus-gold)]" /></Link>
                <Link href="/requests/saved" className="flex items-center justify-between rounded-2xl bg-[color:var(--loombus-page-bg)] px-4 py-3 text-sm font-semibold transition hover:bg-[color:var(--loombus-surface-muted)]">Saved Requests <ChevronRight className="h-4 w-4 text-[color:var(--loombus-gold)]" /></Link>
                <Link href="/services" className="flex items-center justify-between rounded-2xl bg-[color:var(--loombus-page-bg)] px-4 py-3 text-sm font-semibold transition hover:bg-[color:var(--loombus-surface-muted)]">Browse Services <ChevronRight className="h-4 w-4 text-[color:var(--loombus-gold)]" /></Link>
                <Link href="/rooms" className="flex items-center justify-between rounded-2xl bg-[color:var(--loombus-page-bg)] px-4 py-3 text-sm font-semibold transition hover:bg-[color:var(--loombus-surface-muted)]">Private Room Requests <ChevronRight className="h-4 w-4 text-[color:var(--loombus-gold)]" /></Link>
              </div>
            </section>

            <section className="rounded-[1.75rem] border border-[color:var(--loombus-border)] bg-[color:var(--loombus-surface)] p-5 shadow-2xl shadow-black/10">
              <div className="flex gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[color:var(--loombus-cream)] text-[color:var(--loombus-gold)] dark:bg-[color:var(--loombus-gold-soft)]"><ShieldCheck className="h-5 w-5" /></span>
                <div>
                  <h3 className="font-semibold">Requester stays in control</h3>
                  <p className="mt-1 text-sm leading-6 text-[color:var(--loombus-text-muted)]">Private conversation begins only after the requester selects a response. Responses remain attributable to a member or business.</p>
                </div>
              </div>
            </section>

            <section className="rounded-[1.75rem] border border-[color:var(--loombus-border)] bg-[color:var(--loombus-surface)] p-5 shadow-2xl shadow-black/10">
              <div className="flex gap-3"><Sparkles className="mt-0.5 h-5 w-5 shrink-0 text-[color:var(--loombus-gold)]" /><p className="text-sm leading-6 text-[color:var(--loombus-text-muted)]">Loombus does not process payment or guarantee qualifications, pricing, licensing, or outcomes. <Link href="/requests/safety" className="font-semibold text-[color:var(--loombus-gold)] hover:underline">Read Requests safety</Link>.</p></div>
            </section>
          </aside>
        </div>
      </div>
    </main>
  );
}
