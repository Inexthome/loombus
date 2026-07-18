"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, Bookmark, BriefcaseBusiness, CalendarClock, FileText, Flag, MapPin, Send, ShieldCheck, UserRound } from "lucide-react";
import { type FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import {
  formatRequestBudget,
  formatRequestDate,
  requestLocationLabel,
  requestModeLabel,
  requestTypeLabel,
  requestUrgencyLabel,
  type PublicServiceRequest,
} from "@/lib/service-requests";
import { serviceRequestsAccessToken, serviceRequestsAuthorizedFetch } from "@/lib/service-requests-client";

type BusinessOption = { id: string; name: string; slug: string };
type AppointmentOption = { id: string; businessId: string; businessName: string; name: string; durationMinutes: number };
type DetailPayload = { request: PublicServiceRequest; authenticated: boolean; isAdmin: boolean; responderBusinesses?: BusinessOption[]; appointmentServices?: AppointmentOption[] };

export default function RequestDetailPage() {
  const params = useParams();
  const rawSlug = params?.slug;
  const slug = Array.isArray(rawSlug) ? rawSlug[0] : rawSlug ?? "";
  const [payload, setPayload] = useState<DetailPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState("");
  const [notice, setNotice] = useState("");
  const [responseOpen, setResponseOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [availabilityText, setAvailabilityText] = useState("");
  const [estimateMin, setEstimateMin] = useState("");
  const [estimateMax, setEstimateMax] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [businessId, setBusinessId] = useState("");
  const [appointmentServiceId, setAppointmentServiceId] = useState("");
  const [reportOpen, setReportOpen] = useState(false);
  const [reportReason, setReportReason] = useState("Safety concern");
  const [reportDetails, setReportDetails] = useState("");

  const load = useCallback(async () => {
    if (!slug) return;
    setLoading(true); setNotice("");
    try {
      const token = await serviceRequestsAccessToken().catch(() => "");
      const response = await fetch(`/api/requests?slug=${encodeURIComponent(slug)}`, { cache: "no-store", headers: token ? { Authorization: `Bearer ${token}` } : undefined });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error ?? "Unable to load this Request.");
      setPayload(data as DetailPayload);
    } catch (error) { setPayload(null); setNotice(error instanceof Error ? error.message : "Unable to load this Request."); }
    finally { setLoading(false); }
  }, [slug]);

  useEffect(() => { void load(); }, [load]);
  const appointmentOptions = useMemo(() => {
    const all = payload?.appointmentServices ?? [];
    return businessId ? all.filter((service) => service.businessId === businessId) : all;
  }, [businessId, payload?.appointmentServices]);

  async function action(body: Record<string, unknown>, key: string, success: string) {
    if (working) return; setWorking(key); setNotice("");
    try {
      const response = await serviceRequestsAuthorizedFetch("/api/requests", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }, `/requests/${slug}`);
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error ?? "Unable to update the Request.");
      setNotice(success); await load();
    } catch (error) { setNotice(error instanceof Error ? error.message : "Unable to update the Request."); }
    finally { setWorking(""); }
  }

  async function submitResponse(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!payload?.request || working) return;
    setWorking("respond"); setNotice("");
    try {
      const response = await serviceRequestsAuthorizedFetch("/api/requests", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "respond", requestId: payload.request.id, message, availabilityText, estimateMin, estimateMax, currency, businessId, appointmentServiceId }),
      }, `/requests/${slug}`);
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error ?? "Unable to submit the response.");
      setMessage(""); setAvailabilityText(""); setEstimateMin(""); setEstimateMax(""); setBusinessId(""); setAppointmentServiceId(""); setResponseOpen(false);
      setNotice("Response submitted. The requester can review it from their Requests workspace."); await load();
    } catch (error) { setNotice(error instanceof Error ? error.message : "Unable to submit the response."); }
    finally { setWorking(""); }
  }

  async function submitReport() {
    if (!payload?.request || working) return;
    setWorking("report"); setNotice("");
    try {
      const response = await serviceRequestsAuthorizedFetch("/api/requests", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "report", requestId: payload.request.id, reason: reportReason, details: reportDetails }) }, `/requests/${slug}`);
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error ?? "Unable to submit the report.");
      setReportOpen(false); setReportDetails(""); setNotice("Report submitted for administrator review.");
    } catch (error) { setNotice(error instanceof Error ? error.message : "Unable to submit the report."); }
    finally { setWorking(""); }
  }

  if (loading) return <main className="min-h-screen bg-[var(--loombus-page-bg)] px-4 py-10 text-[var(--loombus-text)]"><div className="mx-auto max-w-5xl rounded-[2rem] border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-10 text-center">Loading Request…</div></main>;
  if (!payload?.request) return <main className="min-h-screen bg-[var(--loombus-page-bg)] px-4 py-10 text-[var(--loombus-text)]"><div className="mx-auto max-w-3xl rounded-[2rem] border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-10 text-center"><h1 className="text-3xl font-semibold">Request unavailable</h1><p className="mt-3 text-[var(--loombus-text-muted)]">{notice || "This Request is not public."}</p><Link href="/requests" className="mt-6 inline-flex rounded-full border border-[var(--loombus-border)] px-5 py-3 font-semibold">Back to Requests</Link></div></main>;

  const item = payload.request;
  const ownerHref = item.businessSlug ? `/businesses/${item.businessSlug}` : item.requesterUsername ? `/u/${item.requesterUsername}` : null;

  return (
    <main className="min-h-screen bg-[var(--loombus-page-bg)] px-4 py-8 text-[var(--loombus-text)] sm:px-6"><div className="mx-auto max-w-6xl space-y-5">
      <Link href="/requests" className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--loombus-text-muted)]"><ArrowLeft size={17} /> Back to Requests</Link>
      <header className="rounded-[2rem] border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-6 sm:p-9"><div className="flex flex-wrap gap-2 text-xs font-semibold"><span className="rounded-full border border-[var(--loombus-border)] px-3 py-1.5">{requestTypeLabel(item.requestType)}</span><span className="rounded-full border border-[var(--loombus-border)] px-3 py-1.5">{item.category}</span><span className="rounded-full border border-[var(--loombus-border)] px-3 py-1.5">{requestUrgencyLabel(item.urgency)}</span></div><h1 className="mt-5 max-w-4xl text-4xl font-semibold tracking-tight sm:text-6xl">{item.title}</h1><p className="mt-5 max-w-3xl whitespace-pre-wrap text-base leading-8 text-[var(--loombus-text-muted)]">{item.description}</p><div className="mt-7 grid gap-4 md:grid-cols-3"><article className="rounded-2xl border border-[var(--loombus-border)] bg-[var(--loombus-page-bg)] p-4"><MapPin size={19} /><strong className="mt-3 block text-sm">Location</strong><span className="mt-1 block text-sm text-[var(--loombus-text-muted)]">{requestLocationLabel(item)}</span><small className="mt-2 block">{requestModeLabel(item.serviceMode)}</small></article><article className="rounded-2xl border border-[var(--loombus-border)] bg-[var(--loombus-page-bg)] p-4"><BriefcaseBusiness size={19} /><strong className="mt-3 block text-sm">Budget context</strong><span className="mt-1 block text-sm text-[var(--loombus-text-muted)]">{formatRequestBudget(item)}</span></article><article className="rounded-2xl border border-[var(--loombus-border)] bg-[var(--loombus-page-bg)] p-4"><CalendarClock size={19} /><strong className="mt-3 block text-sm">Timing</strong><span className="mt-1 block text-sm text-[var(--loombus-text-muted)]">{item.deadline ? `Needed by ${formatRequestDate(item.deadline)}` : "No deadline stated"}</span><small className="mt-2 block">{item.responseCount} response{item.responseCount === 1 ? "" : "s"}</small></article></div></header>
      {notice ? <div className="rounded-2xl border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-4 text-sm" role="status">{notice}</div> : null}
      <div className="grid gap-5 lg:grid-cols-[1fr_340px]"><section className="space-y-5"><article className="rounded-[1.6rem] border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-6"><h2 className="text-2xl font-semibold">Can you help?</h2><p className="mt-2 text-sm leading-6 text-[var(--loombus-text-muted)]">Your response is visible to the requester and administrators, not the public directory. Private messaging starts only if the requester selects your response.</p><div className="mt-5 flex flex-wrap gap-3">{item.viewerCanManage ? <Link href="/requests/manage" className="rounded-full bg-[var(--loombus-primary-bg)] px-5 py-3 text-sm font-semibold text-[var(--loombus-primary-text)]">Review responses</Link> : <button type="button" onClick={() => setResponseOpen((current) => !current)} disabled={item.viewerHasResponded} className="inline-flex items-center gap-2 rounded-full bg-[var(--loombus-primary-bg)] px-5 py-3 text-sm font-semibold text-[var(--loombus-primary-text)] disabled:opacity-50"><Send size={16} /> {item.viewerHasResponded ? "Response already submitted" : "Respond to Request"}</button>}<button type="button" onClick={() => void action({ action: item.viewerSaved ? "unsave" : "save", requestId: item.id }, "save", item.viewerSaved ? "Request removed from saved items." : "Request saved.")} className="inline-flex items-center gap-2 rounded-full border border-[var(--loombus-border)] px-5 py-3 text-sm font-semibold"><Bookmark size={16} /> {item.viewerSaved ? "Saved" : "Save Request"}</button></div></article>
        {responseOpen && !item.viewerCanManage && !item.viewerHasResponded ? <form onSubmit={submitResponse} className="rounded-[1.6rem] border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-6"><h2 className="text-2xl font-semibold">Your response</h2><div className="mt-4 grid gap-4 sm:grid-cols-2"><label className="sm:col-span-2"><span className="mb-2 block text-sm font-semibold">How can you help?</span><textarea required minLength={20} maxLength={8000} rows={6} value={message} onChange={(event: any) => setMessage(event.target.value)} className="w-full rounded-2xl border border-[var(--loombus-border)] bg-[var(--loombus-page-bg)] px-4 py-3" /></label><label className="sm:col-span-2"><span className="mb-2 block text-sm font-semibold">Availability</span><input value={availabilityText} onChange={(event: any) => setAvailabilityText(event.target.value)} className="w-full rounded-2xl border border-[var(--loombus-border)] bg-[var(--loombus-page-bg)] px-4 py-3" /></label><label><span className="mb-2 block text-sm font-semibold">Estimate minimum</span><input type="number" min={0} step="0.01" value={estimateMin} onChange={(event: any) => setEstimateMin(event.target.value)} className="w-full rounded-2xl border border-[var(--loombus-border)] bg-[var(--loombus-page-bg)] px-4 py-3" /></label><label><span className="mb-2 block text-sm font-semibold">Estimate maximum</span><input type="number" min={0} step="0.01" value={estimateMax} onChange={(event: any) => setEstimateMax(event.target.value)} className="w-full rounded-2xl border border-[var(--loombus-border)] bg-[var(--loombus-page-bg)] px-4 py-3" /></label><label><span className="mb-2 block text-sm font-semibold">Currency</span><input maxLength={3} value={currency} onChange={(event: any) => setCurrency(event.target.value.toUpperCase())} className="w-full rounded-2xl border border-[var(--loombus-border)] bg-[var(--loombus-page-bg)] px-4 py-3" /></label><label><span className="mb-2 block text-sm font-semibold">Business attribution</span><select value={businessId} onChange={(event: any) => { setBusinessId(event.target.value); setAppointmentServiceId(""); }} className="w-full rounded-2xl border border-[var(--loombus-border)] bg-[var(--loombus-page-bg)] px-4 py-3"><option value="">Personal profile</option>{(payload.responderBusinesses ?? []).map((business) => <option key={business.id} value={business.id}>{business.name}</option>)}</select></label><label><span className="mb-2 block text-sm font-semibold">Appointment service</span><select value={appointmentServiceId} onChange={(event: any) => setAppointmentServiceId(event.target.value)} className="w-full rounded-2xl border border-[var(--loombus-border)] bg-[var(--loombus-page-bg)] px-4 py-3"><option value="">No appointment service</option>{appointmentOptions.map((service) => <option key={service.id} value={service.id}>{service.businessName}: {service.name}</option>)}</select></label></div><button type="submit" disabled={working === "respond"} className="mt-5 inline-flex items-center gap-2 rounded-full bg-[var(--loombus-primary-bg)] px-5 py-3 text-sm font-semibold text-[var(--loombus-primary-text)]"><Send size={16} /> Submit response</button></form> : null}
        {item.attachmentUrls.length ? <article className="rounded-[1.6rem] border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-6"><div className="flex items-center gap-2"><FileText size={18} /><h2 className="text-xl font-semibold">Attachments</h2></div><div className="mt-4 grid gap-3 sm:grid-cols-2">{item.attachmentUrls.map((url, index) => <a key={url} href={url} target="_blank" rel="noreferrer" className="rounded-2xl border border-[var(--loombus-border)] bg-[var(--loombus-page-bg)] p-4 text-sm font-semibold underline">{item.attachmentNames[index] || `Attachment ${index + 1}`}</a>)}</div></article> : null}</section>
        <aside className="space-y-5"><section className="rounded-[1.6rem] border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-5"><p className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--loombus-text-subtle)]">Requester</p><div className="mt-4 flex items-start gap-3"><UserRound size={20} /><div><strong>{item.businessName || item.requesterName}</strong>{ownerHref ? <Link href={ownerHref} className="mt-1 block text-sm underline">Open attributable profile</Link> : null}</div></div></section><section className="rounded-[1.6rem] border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-5"><div className="flex items-center gap-2"><ShieldCheck size={18} /><strong>Safety boundary</strong></div><p className="mt-3 text-sm leading-6 text-[var(--loombus-text-muted)]">Loombus does not process payments, verify licensing, guarantee credentials, or guarantee completion. Confirm every material detail independently.</p><Link href="/requests/safety" className="mt-3 block text-sm font-semibold underline">Read Requests safety</Link><button type="button" onClick={() => setReportOpen((current) => !current)} className="mt-4 inline-flex items-center gap-2 text-sm font-semibold"><Flag size={16} /> Report this Request</button></section></aside></div>
      {reportOpen ? <section className="rounded-[1.6rem] border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-6"><h2 className="text-xl font-semibold">Report Request</h2><div className="mt-4 grid gap-4"><select value={reportReason} onChange={(event: any) => setReportReason(event.target.value)} className="rounded-2xl border border-[var(--loombus-border)] bg-[var(--loombus-page-bg)] px-4 py-3"><option>Safety concern</option><option>Fraud or misleading information</option><option>Prohibited activity</option><option>Harassment or discrimination</option><option>Other</option></select><textarea rows={5} maxLength={3000} value={reportDetails} onChange={(event: any) => setReportDetails(event.target.value)} className="rounded-2xl border border-[var(--loombus-border)] bg-[var(--loombus-page-bg)] px-4 py-3" /><div className="flex gap-3"><button type="button" onClick={() => void submitReport()} disabled={reportDetails.trim().length < 10 || working === "report"} className="rounded-full bg-[var(--loombus-primary-bg)] px-5 py-3 text-sm font-semibold text-[var(--loombus-primary-text)] disabled:opacity-50">Submit report</button><button type="button" onClick={() => setReportOpen(false)} className="rounded-full border border-[var(--loombus-border)] px-5 py-3 text-sm font-semibold">Cancel</button></div></div></section> : null}
    </div></main>
  );
}
