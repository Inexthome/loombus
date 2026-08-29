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
  RefreshCw,
  Search,
  Trash2,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  formatRequestBudget,
  formatRequestDate,
  requestLocationLabel,
  requestTypeLabel,
  requestUrgencyLabel,
  type PublicServiceRequest,
} from "@/lib/service-requests";
import { serviceRequestsAuthorizedFetch } from "@/lib/service-requests-client";

type SavedRequestView = "all" | "active" | "finished";

const activeStatuses = new Set<PublicServiceRequest["status"]>([
  "open",
  "reviewing",
  "in_progress",
]);

const statusLabel = (status: PublicServiceRequest["status"]) =>
  status.replaceAll("_", " ");

const secondary =
  "inline-flex items-center justify-center gap-2 border-b border-[color:var(--loombus-border)] px-0 py-2 text-sm font-semibold transition hover:border-[color:var(--loombus-gold)] hover:text-[color:var(--loombus-gold)] disabled:opacity-50";

export default function RequestsSavedPage() {
  const [requests, setRequests] = useState<PublicServiceRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState("");
  const [notice, setNotice] = useState("");
  const [query, setQuery] = useState("");
  const [view, setView] = useState<SavedRequestView>("all");

  const load = useCallback(async () => {
    setLoading(true);
    setNotice("");
    try {
      const response = await serviceRequestsAuthorizedFetch(
        "/api/requests?saved=1",
        { cache: "no-store" },
        "/requests/saved",
      );
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.error ?? "Unable to load saved Requests.");
      }
      setRequests(Array.isArray(payload.requests) ? payload.requests : []);
    } catch (error) {
      setNotice(
        error instanceof Error ? error.message : "Unable to load saved Requests.",
      );
      setRequests([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function remove(requestId: string) {
    if (working) return;
    setWorking(requestId);
    setNotice("");
    try {
      const response = await serviceRequestsAuthorizedFetch(
        "/api/requests",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "unsave", requestId }),
        },
        "/requests/saved",
      );
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.error ?? "Unable to remove the saved Request.");
      }
      setRequests((current) => current.filter((item) => item.id !== requestId));
    } catch (error) {
      setNotice(
        error instanceof Error
          ? error.message
          : "Unable to remove the saved Request.",
      );
    } finally {
      setWorking("");
    }
  }

  const activeCount = useMemo(
    () => requests.filter((item) => activeStatuses.has(item.status)).length,
    [requests],
  );
  const responseCount = useMemo(
    () => requests.reduce((sum, item) => sum + item.responseCount, 0),
    [requests],
  );
  const filteredRequests = useMemo(() => {
    const clean = query.trim().toLowerCase();
    return requests.filter((item) => {
      const active = activeStatuses.has(item.status);
      if (view === "active" && !active) return false;
      if (view === "finished" && active) return false;
      if (!clean) return true;
      return [
        item.title,
        item.description,
        item.category,
        item.requesterName,
        item.businessName,
        item.city,
        item.region,
        item.status,
        requestTypeLabel(item.requestType),
        ...item.tags,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(clean));
    });
  }, [query, requests, view]);

  const options: Array<{ value: SavedRequestView; label: string; count: number }> = [
    { value: "all", label: "All saved", count: requests.length },
    { value: "active", label: "Active", count: activeCount },
    {
      value: "finished",
      label: "Finished or unavailable",
      count: requests.length - activeCount,
    },
  ];

  function clear() {
    setQuery("");
    setView("all");
  }

  return (
    <main
      data-requests-editorial="saved"
      className="min-h-screen bg-[color:var(--loombus-page-bg)] px-4 pb-24 pt-5 text-[color:var(--loombus-text)] sm:px-6 lg:px-8"
    >
      <div className="mx-auto max-w-[82rem]">
        <header className="border-b border-[color:var(--loombus-border)] pb-6">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <p className="text-xs font-bold uppercase tracking-[0.28em] text-[color:var(--loombus-gold)]">
                Private follow-up list
              </p>
              <h1 className="mt-2 text-4xl font-semibold tracking-[-0.055em] sm:text-5xl">
                Saved Requests
              </h1>
              <p className="mt-3 max-w-2xl text-base leading-7 text-[color:var(--loombus-text-muted)]">
                Keep public needs within reach without notifying the requester. Saving is
                private and does not create a response, message, or commitment.
              </p>
            </div>
            <div className="flex flex-wrap gap-x-5 gap-y-2">
              <Link href="/requests" className={secondary}>
                <HandHeart size={16} className="text-[color:var(--loombus-gold)]" />
                Browse Requests
              </Link>
              <button type="button" onClick={() => void load()} className={secondary}>
                <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
                Refresh
              </button>
            </div>
          </div>
        </header>

        <section
          className="grid border-b border-[color:var(--loombus-border)] sm:grid-cols-3"
          aria-label="Saved Request signals"
        >
          {[
            ["Saved Requests", requests.length],
            ["Active now", activeCount],
            ["Responses across saved", responseCount],
          ].map(([label, value], index) => (
            <div
              key={String(label)}
              className={`py-5 sm:px-5 ${index > 0 ? "border-t border-[color:var(--loombus-border)] sm:border-l sm:border-t-0" : ""}`}
            >
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-[color:var(--loombus-text-muted)]">
                {label}
              </p>
              <strong className="mt-2 block text-3xl tracking-[-0.04em]">{value}</strong>
            </div>
          ))}
        </section>

        <section className="border-b border-[color:var(--loombus-border)] py-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <label className="block min-w-0 flex-1">
              <span className="mb-2 block text-xs font-bold uppercase tracking-[0.18em] text-[color:var(--loombus-text-muted)]">
                Search saved Requests
              </span>
              <span className="flex items-center gap-3 border-b border-[color:var(--loombus-border)] pb-2 focus-within:border-[color:var(--loombus-gold)]">
                <Search size={17} className="shrink-0 text-[color:var(--loombus-gold)]" />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Request, category, requester, or place"
                  className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-[color:var(--loombus-text-subtle)]"
                />
              </span>
            </label>
            <nav className="flex gap-5 overflow-x-auto" aria-label="Saved Request filters">
              {options.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setView(option.value)}
                  className={`shrink-0 border-b-2 pb-2 text-sm font-semibold transition ${
                    view === option.value
                      ? "border-[color:var(--loombus-gold)] text-[color:var(--loombus-gold)]"
                      : "border-transparent text-[color:var(--loombus-text-muted)] hover:text-[color:var(--loombus-text)]"
                  }`}
                >
                  {option.label} <span className="ml-1 text-xs">{option.count}</span>
                </button>
              ))}
            </nav>
          </div>
        </section>

        {notice ? (
          <section
            className="border-b border-red-500/30 py-4 text-sm text-red-500"
            role="alert"
          >
            {notice}
          </section>
        ) : null}

        {loading ? (
          <section className="py-14 text-center text-[color:var(--loombus-text-muted)]">
            <Loader2 className="mx-auto animate-spin text-[color:var(--loombus-gold)]" size={28} />
            <p className="mt-3">Loading your private Request list…</p>
          </section>
        ) : requests.length === 0 ? (
          <section className="py-14 text-center">
            <Bookmark className="mx-auto text-[color:var(--loombus-gold)]" size={40} />
            <h2 className="mt-4 text-2xl font-semibold">No saved Requests yet.</h2>
            <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-[color:var(--loombus-text-muted)]">
              Save a Request from the public directory to follow it here without notifying
              the requester.
            </p>
            <Link href="/requests" className="mt-5 inline-flex border-b-2 border-[color:var(--loombus-gold)] pb-1 text-sm font-semibold text-[color:var(--loombus-gold)]">
              Browse Requests
            </Link>
          </section>
        ) : filteredRequests.length === 0 ? (
          <section className="py-14 text-center">
            <Search className="mx-auto text-[color:var(--loombus-gold)]" size={36} />
            <h2 className="mt-4 text-2xl font-semibold">No saved Requests match this view.</h2>
            <p className="mt-2 text-sm text-[color:var(--loombus-text-muted)]">
              Clear the search or return to all saved Requests.
            </p>
            <button type="button" onClick={clear} className={`${secondary} mt-4`}>
              Clear search and filters
            </button>
          </section>
        ) : (
          <section className="py-6">
            <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.28em] text-[color:var(--loombus-gold)]">
                  Follow-up list
                </p>
                <h2 className="mt-1 text-2xl font-semibold tracking-[-0.035em]">
                  {filteredRequests.length} Request{filteredRequests.length === 1 ? "" : "s"} in view
                </h2>
              </div>
              <p className="text-xs text-[color:var(--loombus-text-subtle)]">
                Saving remains private until you choose to respond.
              </p>
            </div>

            <div className="divide-y divide-[color:var(--loombus-border)]" aria-label="Saved Requests">
              {filteredRequests.map((item) => {
                const deadline = item.deadline ? formatRequestDate(item.deadline) : "";
                return (
                  <article key={item.id} className="py-6">
                    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_18rem]">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-xs font-semibold text-[color:var(--loombus-text-muted)]">
                          <span className="text-[color:var(--loombus-gold)]">
                            {requestTypeLabel(item.requestType)}
                          </span>
                          <span>{requestUrgencyLabel(item.urgency)}</span>
                          <span className="capitalize">{statusLabel(item.status)}</span>
                        </div>
                        <Link
                          href={`/requests/${item.slug}`}
                          className="mt-2 block text-2xl font-semibold leading-tight tracking-[-0.035em] hover:text-[color:var(--loombus-gold)]"
                        >
                          {item.title}
                        </Link>
                        <p className="mt-3 line-clamp-3 text-sm leading-6 text-[color:var(--loombus-text-muted)]">
                          {item.description}
                        </p>
                        <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-sm text-[color:var(--loombus-text-muted)]">
                          <span className="inline-flex items-center gap-2">
                            <MapPin size={15} className="text-[color:var(--loombus-gold)]" />
                            {requestLocationLabel(item)}
                          </span>
                          <span className="inline-flex items-center gap-2">
                            <BriefcaseBusiness size={15} className="text-[color:var(--loombus-gold)]" />
                            {formatRequestBudget(item)}
                          </span>
                          {deadline ? (
                            <span className="inline-flex items-center gap-2">
                              <Clock3 size={15} className="text-[color:var(--loombus-gold)]" />
                              Deadline {deadline}
                            </span>
                          ) : null}
                        </div>
                      </div>

                      <div className="flex flex-col justify-between gap-4 border-t border-[color:var(--loombus-border)] pt-4 lg:border-l lg:border-t-0 lg:pl-5 lg:pt-0">
                        <div className="text-xs leading-5 text-[color:var(--loombus-text-muted)]">
                          <p>{item.businessName || item.requesterName}</p>
                          <p className="mt-1">{item.responseCount} response{item.responseCount === 1 ? "" : "s"}</p>
                        </div>
                        <div className="flex flex-wrap gap-x-4 gap-y-2">
                          <Link
                            href={`/requests/${item.slug}`}
                            className="inline-flex items-center gap-1 border-b border-[color:var(--loombus-gold)] pb-1 text-xs font-semibold text-[color:var(--loombus-gold)]"
                          >
                            Open Request <ArrowUpRight size={13} />
                          </Link>
                          <button
                            type="button"
                            onClick={() => void remove(item.id)}
                            disabled={Boolean(working)}
                            className="inline-flex items-center gap-1.5 border-b border-red-500/40 pb-1 text-xs font-semibold text-red-500 disabled:opacity-50"
                            aria-label={`Remove ${item.title} from saved Requests`}
                          >
                            {working === item.id ? (
                              <Loader2 className="animate-spin" size={14} />
                            ) : (
                              <Trash2 size={14} />
                            )}
                            Remove
                          </button>
                        </div>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        )}

        <footer className="grid gap-6 border-t border-[color:var(--loombus-border)] py-6 lg:grid-cols-2">
          <section>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-[color:var(--loombus-gold)]">
              Privacy
            </p>
            <p className="mt-2 max-w-xl text-sm leading-6 text-[color:var(--loombus-text-muted)]">
              Requesters cannot see who saved a Request. Saving does not send a response,
              message, or notification.
            </p>
          </section>
          <section>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-[color:var(--loombus-gold)]">
              Connected workspaces
            </p>
            <div className="mt-2 flex flex-wrap gap-x-5 gap-y-2 text-sm font-semibold">
              <Link href="/requests" className="hover:text-[color:var(--loombus-gold)]">Browse Requests</Link>
              <Link href="/requests/manage" className="hover:text-[color:var(--loombus-gold)]">Manage Requests</Link>
              <Link href="/services/saved" className="hover:text-[color:var(--loombus-gold)]">Saved Services</Link>
              <Link href="/search" className="hover:text-[color:var(--loombus-gold)]">Everything Search</Link>
            </div>
          </section>
        </footer>
      </div>
    </main>
  );
}
