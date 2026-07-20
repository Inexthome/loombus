"use client";

import Link from "next/link";
import { ArrowUpRight, Bookmark, BriefcaseBusiness, Clock3, HandHeart, Loader2, MapPin, Search, Trash2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { formatRequestBudget, formatRequestDate, requestLocationLabel, requestTypeLabel, requestUrgencyLabel, type PublicServiceRequest } from "@/lib/service-requests";
import { serviceRequestsAuthorizedFetch } from "@/lib/service-requests-client";
import { SavedControls, SavedEmpty, SavedHeader, SavedLoading, SavedMetrics, SavedRail, type SavedViewOption } from "@/components/saved-directory-ui";

type SavedRequestView = "all" | "active" | "finished";
const activeStatuses = new Set<PublicServiceRequest["status"]>(["open", "reviewing", "in_progress"]);
const statusLabel = (status: PublicServiceRequest["status"]) => status.replaceAll("_", " ");

export default function RequestsSavedPage() {
  const [requests, setRequests] = useState<PublicServiceRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState("");
  const [notice, setNotice] = useState("");
  const [query, setQuery] = useState("");
  const [view, setView] = useState<SavedRequestView>("all");

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
    if (working) return;
    setWorking(requestId); setNotice("");
    try {
      const response = await serviceRequestsAuthorizedFetch("/api/requests", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "unsave", requestId }) }, "/requests/saved");
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error ?? "Unable to remove the saved Request.");
      setRequests((current) => current.filter((item) => item.id !== requestId));
    } catch (error) { setNotice(error instanceof Error ? error.message : "Unable to remove the saved Request."); }
    finally { setWorking(""); }
  }

  const activeCount = useMemo(() => requests.filter((item) => activeStatuses.has(item.status)).length, [requests]);
  const responseCount = useMemo(() => requests.reduce((sum, item) => sum + item.responseCount, 0), [requests]);
  const filteredRequests = useMemo(() => {
    const clean = query.trim().toLowerCase();
    return requests.filter((item) => {
      const active = activeStatuses.has(item.status);
      if (view === "active" && !active) return false;
      if (view === "finished" && active) return false;
      if (!clean) return true;
      return [item.title, item.description, item.category, item.requesterName, item.businessName, item.city, item.region, item.status, requestTypeLabel(item.requestType), ...item.tags].filter(Boolean).some((value) => String(value).toLowerCase().includes(clean));
    });
  }, [query, requests, view]);
  const options: SavedViewOption<SavedRequestView>[] = [
    { value: "all", label: "All saved", count: requests.length },
    { value: "active", label: "Active", count: activeCount },
    { value: "finished", label: "Finished or unavailable", count: requests.length - activeCount },
  ];
  const clear = () => { setQuery(""); setView("all"); };

  return <main className="min-h-screen bg-[color:var(--loombus-page-bg)] px-4 pb-24 pt-5 text-[color:var(--loombus-text)] sm:px-6 lg:px-8"><div className="mx-auto max-w-[86rem]">
    <SavedHeader eyebrow="Private follow-up list" title="Saved Requests" copy="Keep public needs within reach without notifying the requester. Saving is private and does not create a response, message, or commitment." browseHref="/requests" browseLabel="Browse Requests" browseIcon={<HandHeart size={16} className="text-[color:var(--loombus-gold)]"/>} loading={loading} refresh={() => void load()}/>
    <SavedMetrics items={[{ label: "Saved Requests", value: requests.length }, { label: "Active now", value: activeCount }, { label: "Responses across saved", value: responseCount }]}/>
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_21rem]"><section className="min-w-0">
      <SavedControls query={query} setQuery={setQuery} placeholder="Search saved Request, category, requester, or place" view={view} setView={setView} options={options}/>
      {notice ? <section className="mb-5 rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm" role="alert">{notice}</section> : null}
      {loading ? <SavedLoading label="Loading your private Request list…"/> : requests.length === 0 ? <SavedEmpty icon={<Bookmark size={42}/>} title="No saved Requests yet." copy="Save a Request from the public directory to follow it here without notifying the requester." action={<Link href="/requests" className="inline-flex rounded-full bg-[color:var(--loombus-gold)] px-5 py-3 text-sm font-semibold text-[color:var(--loombus-gold-contrast)]">Browse Requests</Link>}/> : filteredRequests.length === 0 ? <SavedEmpty icon={<Search size={38}/>} title="No saved Requests match this view." copy="Clear the search or return to all saved Requests." action={<button type="button" onClick={clear} className="rounded-full border border-[color:var(--loombus-border)] px-5 py-2.5 text-sm font-semibold transition hover:border-[color:var(--loombus-gold)]">Clear search and filters</button>}/> : <section>
        <div className="mb-4"><p className="text-xs font-bold uppercase tracking-[0.28em] text-[color:var(--loombus-gold)]">Follow-up list</p><h2 className="mt-1 text-2xl font-semibold tracking-[-0.035em]">{filteredRequests.length} Request{filteredRequests.length === 1 ? "" : "s"} in view</h2></div>
        <div className="grid gap-4 lg:grid-cols-2" aria-label="Saved Requests">{filteredRequests.map((item) => { const deadline = item.deadline ? formatRequestDate(item.deadline) : ""; return <article key={item.id} className="flex min-h-[365px] flex-col rounded-[1.75rem] border border-[color:var(--loombus-border)] bg-[color:var(--loombus-surface)] p-5 shadow-lg shadow-black/5 transition hover:border-[color:var(--loombus-gold)] hover:shadow-xl">
          <div className="flex items-start justify-between gap-3"><span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-[color:var(--loombus-cream)] text-[color:var(--loombus-gold)] dark:bg-[color:var(--loombus-gold-soft)]"><HandHeart size={20}/></span><div className="flex flex-wrap justify-end gap-2 text-[11px] font-semibold text-[color:var(--loombus-text-muted)]"><span className="rounded-full border border-[color:var(--loombus-border)] px-3 py-1">{requestTypeLabel(item.requestType)}</span><span className={`rounded-full px-3 py-1 ${item.urgency === "urgent" ? "bg-red-500/10 text-red-500" : "border border-[color:var(--loombus-border)]"}`}>{requestUrgencyLabel(item.urgency)}</span><span className="rounded-full bg-[color:var(--loombus-surface-muted)] px-3 py-1 capitalize">{statusLabel(item.status)}</span></div></div>
          <Link href={`/requests/${item.slug}`} className="mt-5 text-2xl font-semibold leading-tight tracking-[-0.035em] hover:underline">{item.title}</Link><p className="mt-3 line-clamp-4 text-sm leading-6 text-[color:var(--loombus-text-muted)]">{item.description}</p>
          <div className="mt-auto space-y-3 pt-6 text-sm text-[color:var(--loombus-text-muted)]"><span className="flex items-start gap-3"><MapPin className="mt-0.5 shrink-0 text-[color:var(--loombus-gold)]" size={16}/>{requestLocationLabel(item)}</span><span className="flex items-start gap-3"><BriefcaseBusiness className="mt-0.5 shrink-0 text-[color:var(--loombus-gold)]" size={16}/>{formatRequestBudget(item)}</span>{deadline ? <span className="flex items-start gap-3"><Clock3 className="mt-0.5 shrink-0 text-[color:var(--loombus-gold)]" size={16}/>Deadline {deadline}</span> : null}</div>
          <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-[color:var(--loombus-border-muted)] pt-4 text-xs text-[color:var(--loombus-text-muted)]"><span>{item.businessName || item.requesterName}</span><span>{item.responseCount} response{item.responseCount === 1 ? "" : "s"}</span><div className="flex items-center gap-3"><Link href={`/requests/${item.slug}`} className="inline-flex items-center gap-1 font-semibold text-[color:var(--loombus-gold)] hover:underline">Open Request <ArrowUpRight size={13}/></Link><button type="button" onClick={() => void remove(item.id)} disabled={Boolean(working)} className="inline-flex items-center gap-1.5 rounded-full border border-red-500/25 px-3 py-2 font-semibold text-red-500 transition hover:bg-red-500/10 disabled:opacity-50" aria-label={`Remove ${item.title} from saved Requests`}>{working === item.id ? <Loader2 className="animate-spin" size={14}/> : <Trash2 size={14}/>}Remove</button></div></div>
        </article>; })}</div>
      </section>}
    </section><SavedRail privacyCopy="Requesters cannot see who saved a Request. Saving does not send a response, message, or notification." tools={[["Browse Requests", "/requests"], ["Create or manage Requests", "/requests/manage"], ["Saved Services", "/services/saved"], ["Everything Search", "/search"]]} safetyTitle="Review before responding" safetyCopy="Confirm scope, identity, qualifications, pricing, timing, and payment terms before moving a Request into private conversation."/></div>
  </div></main>;
}
