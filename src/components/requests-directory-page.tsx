"use client";

import Link from "next/link";
import {
  ArrowUpRight,
  Bookmark,
  BriefcaseBusiness,
  Clock3,
  HandHeart,
  Loader2,
  MapPin,
  Search,
  ShieldCheck,
  SlidersHorizontal,
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
  "h-11 w-full border-0 border-b border-[color:var(--loombus-border)] bg-transparent px-0 text-sm text-[color:var(--loombus-text)] outline-none transition placeholder:text-[color:var(--loombus-text-subtle)] focus:border-[color:var(--loombus-gold)] focus:ring-0";
const quietAction =
  "inline-flex items-center gap-2 border-b border-transparent py-2 text-sm font-semibold text-[color:var(--loombus-text-muted)] transition hover:border-[color:var(--loombus-gold)] hover:text-[color:var(--loombus-text)]";

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
    <main
      data-requests-editorial="directory"
      className="min-h-screen bg-[color:var(--loombus-page-bg)] px-4 pb-24 pt-6 text-[color:var(--loombus-text)] sm:px-6 lg:px-8"
    >
      <div className="mx-auto max-w-[78rem]">
        <header className="border-b border-[color:var(--loombus-border)] pb-7">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <p className="text-xs font-bold uppercase tracking-[0.28em] text-[color:var(--loombus-gold)]">
                Public needs
              </p>
              <h1 className="mt-2 text-4xl font-semibold tracking-[-0.055em] sm:text-5xl">Requests</h1>
              <p className="mt-3 text-base leading-7 text-[color:var(--loombus-text-muted)]">
                Find accountable public needs for services, quotes, recommendations, consultations, community help, volunteer support, and local problem solving.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-x-5 gap-y-1">
              <Link href="/requests/saved" className={quietAction}>
                <Bookmark size={15} className="text-[color:var(--loombus-gold)]" /> Saved Requests
              </Link>
              <Link
                href="/requests/manage"
                className="inline-flex items-center gap-2 border-b-2 border-[color:var(--loombus-gold)] py-2 text-sm font-semibold"
              >
                <SlidersHorizontal size={15} /> Create or manage
              </Link>
            </div>
          </div>
        </header>

        <section className="grid border-b border-[color:var(--loombus-border)] sm:grid-cols-3" aria-label="Request signals">
          {[
            ["Open Requests", total],
            ["Urgent in view", urgentCount],
            ["Responses in view", responseCount],
          ].map(([label, value], index) => (
            <div
              key={String(label)}
              className={`py-4 sm:px-5 ${index > 0 ? "border-t border-[color:var(--loombus-border-muted)] sm:border-l sm:border-t-0" : ""}`}
            >
              <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-[color:var(--loombus-text-muted)]">{label}</span>
              <strong className="ml-3 text-lg font-semibold tracking-[-0.03em] text-[color:var(--loombus-text)]">{value}</strong>
            </div>
          ))}
        </section>

        <section className="border-b border-[color:var(--loombus-border)] py-6" aria-label="Request discovery controls">
          <label className="relative block border-b border-[color:var(--loombus-border)] pb-3">
            <span className="sr-only">Search Requests</span>
            <Search className="pointer-events-none absolute left-0 top-1/2 h-5 w-5 -translate-y-1/2 text-[color:var(--loombus-gold)]" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search need, skill, category, or place"
              className="h-12 w-full bg-transparent pl-8 pr-4 text-base outline-none placeholder:text-[color:var(--loombus-text-subtle)]"
            />
          </label>

          <nav className="mt-5 flex gap-6 overflow-x-auto border-b border-[color:var(--loombus-border-muted)]" aria-label="Request types">
            <button
              type="button"
              onClick={() => setType("all")}
              className={`shrink-0 border-b-2 pb-3 text-sm font-semibold transition ${
                type === "all"
                  ? "border-[color:var(--loombus-gold)] text-[color:var(--loombus-text)]"
                  : "border-transparent text-[color:var(--loombus-text-muted)] hover:text-[color:var(--loombus-text)]"
              }`}
            >
              All Requests
            </button>
            {SERVICE_REQUEST_TYPES.map((item) => (
              <button
                key={item.value}
                type="button"
                onClick={() => setType(item.value)}
                className={`shrink-0 border-b-2 pb-3 text-sm font-semibold transition ${
                  type === item.value
                    ? "border-[color:var(--loombus-gold)] text-[color:var(--loombus-text)]"
                    : "border-transparent text-[color:var(--loombus-text-muted)] hover:text-[color:var(--loombus-text)]"
                }`}
              >
                {item.label}
              </button>
            ))}
          </nav>

          <div className="mt-5 grid gap-x-6 gap-y-3 sm:grid-cols-2 lg:grid-cols-4">
            <label>
              <span className="text-[11px] font-bold uppercase tracking-[0.16em] text-[color:var(--loombus-text-muted)]">Category</span>
              <select value={category} onChange={(event) => setCategory(event.target.value)} className={controlClass} aria-label="Request category">
                <option value="all">All categories</option>
                {SERVICE_REQUEST_CATEGORIES.map((item) => <option key={item}>{item}</option>)}
              </select>
            </label>
            <label>
              <span className="text-[11px] font-bold uppercase tracking-[0.16em] text-[color:var(--loombus-text-muted)]">Urgency</span>
              <select value={urgency} onChange={(event) => setUrgency(event.target.value)} className={controlClass} aria-label="Request urgency">
                <option value="all">All urgency</option>
                <option value="normal">Normal</option>
                <option value="soon">Needed soon</option>
                <option value="urgent">Urgent</option>
              </select>
            </label>
            <label>
              <span className="text-[11px] font-bold uppercase tracking-[0.16em] text-[color:var(--loombus-text-muted)]">Location</span>
              <span className="relative block">
                <MapPin className="pointer-events-none absolute left-0 top-1/2 h-4 w-4 -translate-y-1/2 text-[color:var(--loombus-gold)]" />
                <input
                  value={location}
                  onChange={(event) => setLocation(event.target.value)}
                  placeholder="City, region, or postal code"
                  className={`${controlClass} pl-6`}
                />
              </span>
            </label>
            <div className="flex items-end justify-between gap-4 border-b border-[color:var(--loombus-border)] pb-2">
              <span className="text-sm text-[color:var(--loombus-text-muted)]">
                {activeFilterCount} active filter{activeFilterCount === 1 ? "" : "s"}
              </span>
              <button type="button" onClick={clearFilters} className="text-sm font-semibold text-[color:var(--loombus-gold)] hover:underline">
                Clear
              </button>
            </div>
          </div>
        </section>

        {notice ? (
          <section className="border-b border-red-500/30 py-4 text-sm text-red-500" role="alert">{notice}</section>
        ) : null}

        <section className="py-7">
          <div className="mb-3 flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.28em] text-[color:var(--loombus-gold)]">Discovery</p>
              <h2 className="mt-1 text-2xl font-semibold tracking-[-0.035em]">{total} open Request{total === 1 ? "" : "s"}</h2>
            </div>
            <div className="flex flex-wrap gap-x-5">
              <Link href="/services" className={quietAction}>Browse Services <ArrowUpRight size={13} /></Link>
              <Link href="/rooms" className={quietAction}>Private Room Requests <ArrowUpRight size={13} /></Link>
            </div>
          </div>

          {loading ? (
            <div className="border-y border-[color:var(--loombus-border)] py-12 text-center text-[color:var(--loombus-text-muted)]">
              <Loader2 className="mx-auto animate-spin text-[color:var(--loombus-gold)]" size={26} />
              <p className="mt-3">Gathering open Requests…</p>
            </div>
          ) : requests.length === 0 ? (
            <div className="border-y border-[color:var(--loombus-border)] py-12 text-center">
              <HandHeart className="mx-auto text-[color:var(--loombus-gold)]" size={34} />
              <h3 className="mt-4 text-xl font-semibold tracking-[-0.03em]">No Requests match this view.</h3>
              <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-[color:var(--loombus-text-muted)]">Clear a filter or create the first Request for this need.</p>
              <Link href="/requests/manage" className="mt-4 inline-flex border-b-2 border-[color:var(--loombus-gold)] py-2 text-sm font-semibold">Create Request</Link>
            </div>
          ) : (
            <div className="border-t border-[color:var(--loombus-border)]" aria-label="Public Requests">
              {requests.map((item) => {
                const deadline = formatRequestDate(item.deadline);
                return (
                  <Link
                    key={item.id}
                    href={`/requests/${item.slug}`}
                    className="group grid gap-4 border-b border-[color:var(--loombus-border)] py-6 transition hover:border-b-[color:var(--loombus-gold)] md:grid-cols-[minmax(0,1fr)_15rem]"
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs font-semibold text-[color:var(--loombus-text-muted)]">
                        <span className="text-[color:var(--loombus-gold)]">{requestTypeLabel(item.requestType)}</span>
                        <span>{requestUrgencyLabel(item.urgency)}</span>
                        <span>{item.category}</span>
                      </div>
                      <h3 className="mt-2 text-2xl font-semibold leading-tight tracking-[-0.035em] group-hover:underline">{item.title}</h3>
                      <p className="mt-2 line-clamp-3 max-w-3xl text-sm leading-6 text-[color:var(--loombus-text-muted)]">{item.description}</p>
                      <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-sm text-[color:var(--loombus-text-muted)]">
                        <span className="inline-flex items-center gap-2"><MapPin size={15} className="text-[color:var(--loombus-gold)]" />{requestLocationLabel(item)}</span>
                        <span className="inline-flex items-center gap-2"><BriefcaseBusiness size={15} className="text-[color:var(--loombus-gold)]" />{formatRequestBudget(item)}</span>
                        {item.deadline ? <span className="inline-flex items-center gap-2"><Clock3 size={15} className="text-[color:var(--loombus-gold)]" />Deadline {deadline}</span> : null}
                      </div>
                    </div>
                    <div className="flex flex-col justify-between border-l-0 border-[color:var(--loombus-border-muted)] text-sm md:border-l md:pl-5">
                      <div>
                        <p className="font-semibold">{item.businessName || item.requesterName}</p>
                        <p className="mt-1 text-[color:var(--loombus-text-muted)]">{item.responseCount} response{item.responseCount === 1 ? "" : "s"}</p>
                      </div>
                      <span className="mt-4 inline-flex items-center gap-1 font-semibold text-[color:var(--loombus-gold)] md:mt-0">Open Request <ArrowUpRight size={13} /></span>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}

          {pageCount > 1 ? (
            <nav className="mt-6 flex items-center justify-center gap-4 border-t border-[color:var(--loombus-border)] pt-5" aria-label="Requests pages">
              <button type="button" disabled={page <= 1} onClick={() => setPage((current) => Math.max(current - 1, 1))} className="border-b border-transparent py-2 text-sm font-semibold transition hover:border-[color:var(--loombus-gold)] disabled:opacity-40">Previous</button>
              <span className="text-sm text-[color:var(--loombus-text-muted)]">Page {page} of {pageCount}</span>
              <button type="button" disabled={page >= pageCount} onClick={() => setPage((current) => Math.min(current + 1, pageCount))} className="border-b border-transparent py-2 text-sm font-semibold transition hover:border-[color:var(--loombus-gold)] disabled:opacity-40">Next</button>
            </nav>
          ) : null}
        </section>

        <footer className="grid gap-6 border-t border-[color:var(--loombus-border)] py-7 md:grid-cols-2">
          <div className="flex gap-3">
            <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-[color:var(--loombus-gold)]" />
            <div>
              <h3 className="font-semibold">Requester stays in control</h3>
              <p className="mt-1 text-sm leading-6 text-[color:var(--loombus-text-muted)]">Private conversation begins only after the requester selects a response. Responses remain attributable to a member or business.</p>
            </div>
          </div>
          <p className="text-sm leading-6 text-[color:var(--loombus-text-muted)]">
            Loombus does not process payment or guarantee qualifications, pricing, licensing, or outcomes. <Link href="/requests/safety" className="font-semibold text-[color:var(--loombus-gold)] hover:underline">Read Requests safety</Link>.
          </p>
        </footer>
      </div>
    </main>
  );
}
