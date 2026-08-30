"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import {
  ArrowLeft,
  ArrowUpRight,
  Bookmark,
  FileText,
  Flag,
  Loader2,
  Send,
  ShieldCheck,
  UserRound,
} from "lucide-react";
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
import {
  serviceRequestsAccessToken,
  serviceRequestsAuthorizedFetch,
} from "@/lib/service-requests-client";

type BusinessOption = { id: string; name: string; slug: string };
type AppointmentOption = {
  id: string;
  businessId: string;
  businessName: string;
  name: string;
  durationMinutes: number;
};
type DetailPayload = {
  request: PublicServiceRequest;
  authenticated: boolean;
  isAdmin: boolean;
  responderBusinesses?: BusinessOption[];
  appointmentServices?: AppointmentOption[];
};

const primaryButtonClass =
  "inline-flex min-h-11 items-center justify-center gap-2 border-b-2 border-[color:var(--loombus-gold)] bg-transparent px-0 py-2 text-sm font-semibold text-[color:var(--loombus-text)] transition hover:text-[color:var(--loombus-gold)] disabled:cursor-not-allowed disabled:opacity-50";
const secondaryButtonClass =
  "inline-flex min-h-11 items-center justify-center gap-2 border-b border-[color:var(--loombus-border)] bg-transparent px-0 py-2 text-sm font-semibold text-[color:var(--loombus-text-muted)] transition hover:border-[color:var(--loombus-gold)] hover:text-[color:var(--loombus-text)] disabled:cursor-not-allowed disabled:opacity-50";
const controlClass =
  "w-full rounded-none border-0 border-b border-[color:var(--loombus-border)] bg-transparent px-0 py-3 text-sm text-[color:var(--loombus-text)] outline-none transition placeholder:text-[color:var(--loombus-text-subtle)] focus:border-[color:var(--loombus-gold)] focus:ring-0";

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
    setLoading(true);
    setNotice("");
    try {
      const token = await serviceRequestsAccessToken().catch(() => "");
      const response = await fetch(`/api/requests?slug=${encodeURIComponent(slug)}`, {
        cache: "no-store",
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error ?? "Unable to load this Request.");
      setPayload(data as DetailPayload);
    } catch (error) {
      setPayload(null);
      setNotice(error instanceof Error ? error.message : "Unable to load this Request.");
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    void load();
  }, [load]);

  const appointmentOptions = useMemo(() => {
    const all = payload?.appointmentServices ?? [];
    return businessId
      ? all.filter((service) => service.businessId === businessId)
      : all;
  }, [businessId, payload?.appointmentServices]);

  async function action(
    body: Record<string, unknown>,
    key: string,
    success: string,
  ) {
    if (working) return;
    setWorking(key);
    setNotice("");
    try {
      const response = await serviceRequestsAuthorizedFetch(
        "/api/requests",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
        `/requests/${slug}`,
      );
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error ?? "Unable to update the Request.");
      setNotice(success);
      await load();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Unable to update the Request.");
    } finally {
      setWorking("");
    }
  }

  async function submitResponse(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!payload?.request || working) return;
    setWorking("respond");
    setNotice("");
    try {
      const response = await serviceRequestsAuthorizedFetch(
        "/api/requests",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "respond",
            requestId: payload.request.id,
            message,
            availabilityText,
            estimateMin,
            estimateMax,
            currency,
            businessId,
            appointmentServiceId,
          }),
        },
        `/requests/${slug}`,
      );
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error ?? "Unable to submit the response.");
      setMessage("");
      setAvailabilityText("");
      setEstimateMin("");
      setEstimateMax("");
      setBusinessId("");
      setAppointmentServiceId("");
      setResponseOpen(false);
      setNotice("Response submitted. The requester can review it from their Requests workspace.");
      await load();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Unable to submit the response.");
    } finally {
      setWorking("");
    }
  }

  async function submitReport() {
    if (!payload?.request || working) return;
    setWorking("report");
    setNotice("");
    try {
      const response = await serviceRequestsAuthorizedFetch(
        "/api/requests",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "report",
            requestId: payload.request.id,
            reason: reportReason,
            details: reportDetails,
          }),
        },
        `/requests/${slug}`,
      );
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error ?? "Unable to submit the report.");
      setReportOpen(false);
      setReportDetails("");
      setNotice("Report submitted for administrator review.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Unable to submit the report.");
    } finally {
      setWorking("");
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-[color:var(--loombus-page-bg)] px-4 py-10 text-[color:var(--loombus-text)] sm:px-6">
        <div className="mx-auto flex min-h-56 max-w-5xl items-center justify-center border-y border-[color:var(--loombus-border)]">
          <span className="inline-flex items-center gap-2 text-sm font-semibold text-[color:var(--loombus-text-muted)]">
            <Loader2 className="animate-spin text-[color:var(--loombus-gold)]" size={18} /> Loading Request
          </span>
        </div>
      </main>
    );
  }

  if (!payload?.request) {
    return (
      <main className="min-h-screen bg-[color:var(--loombus-page-bg)] px-4 py-10 text-[color:var(--loombus-text)] sm:px-6">
        <section className="mx-auto max-w-3xl border-y border-[color:var(--loombus-border)] py-14 text-center">
          <p className="text-xs font-bold uppercase tracking-[0.28em] text-[color:var(--loombus-gold)]">Requests</p>
          <h1 className="mt-3 text-3xl font-semibold tracking-[-0.04em]">Request unavailable</h1>
          <p className="mt-3 text-[color:var(--loombus-text-muted)]">{notice || "This Request is not public."}</p>
          <Link href="/requests" className={`${secondaryButtonClass} mt-6`}>
            <ArrowLeft size={16} /> Back to Requests
          </Link>
        </section>
      </main>
    );
  }

  const item = payload.request;
  const ownerHref = item.businessSlug
    ? `/businesses/${item.businessSlug}`
    : item.requesterUsername
      ? `/u/${item.requesterUsername}`
      : "";

  return (
    <main className="min-h-screen bg-[color:var(--loombus-page-bg)] px-4 pb-20 pt-5 text-[color:var(--loombus-text)] sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl">
        <nav className="flex flex-wrap items-center justify-between gap-4 border-b border-[color:var(--loombus-border)] pb-4" aria-label="Request navigation">
          <Link href="/requests" className="inline-flex items-center gap-2 text-sm font-semibold text-[color:var(--loombus-text-muted)] transition hover:text-[color:var(--loombus-gold)]">
            <ArrowLeft size={16} /> Back to Requests
          </Link>
          <div className="flex flex-wrap items-center gap-5">
            <Link href="/requests/saved" className="text-sm font-semibold text-[color:var(--loombus-text-muted)] transition hover:text-[color:var(--loombus-gold)]">Saved</Link>
            <Link href="/requests/manage" className="text-sm font-semibold text-[color:var(--loombus-text-muted)] transition hover:text-[color:var(--loombus-gold)]">Manage</Link>
            <Link href="/services" className="inline-flex items-center gap-1 text-sm font-semibold text-[color:var(--loombus-text-muted)] transition hover:text-[color:var(--loombus-gold)]">Services <ArrowUpRight size={13} /></Link>
          </div>
        </nav>

        <header className="border-b border-[color:var(--loombus-border)] py-8 sm:py-10">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs font-semibold uppercase tracking-[0.18em] text-[color:var(--loombus-text-muted)]">
            <span>{requestTypeLabel(item.requestType)}</span>
            <span aria-hidden="true">/</span>
            <span>{item.category}</span>
            <span aria-hidden="true">/</span>
            <span className="text-[color:var(--loombus-gold)]">{requestUrgencyLabel(item.urgency)}</span>
          </div>
          <h1 className="mt-4 max-w-4xl text-4xl font-semibold tracking-[-0.055em] sm:text-5xl">{item.title}</h1>
          <p className="mt-3 text-sm font-semibold text-[color:var(--loombus-text-muted)]">Requested by {item.businessName || item.requesterName}</p>
        </header>

        {notice ? (
          <div className="border-b border-[color:var(--loombus-border)] py-4 text-sm text-[color:var(--loombus-text-muted)]" role="status">{notice}</div>
        ) : null}

        <section className="border-b border-[color:var(--loombus-border)] py-7" aria-labelledby="request-facts-heading">
          <p id="request-facts-heading" className="sr-only">Request facts</p>
          <dl className="grid gap-x-8 gap-y-5 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <dt className="text-xs font-bold uppercase tracking-[0.2em] text-[color:var(--loombus-text-subtle)]">Location</dt>
              <dd className="mt-2 text-sm font-semibold">{requestLocationLabel(item)}</dd>
              <dd className="mt-1 text-xs text-[color:var(--loombus-text-muted)]">{requestModeLabel(item.serviceMode)}</dd>
            </div>
            <div>
              <dt className="text-xs font-bold uppercase tracking-[0.2em] text-[color:var(--loombus-text-subtle)]">Budget</dt>
              <dd className="mt-2 text-sm font-semibold">{formatRequestBudget(item)}</dd>
            </div>
            <div>
              <dt className="text-xs font-bold uppercase tracking-[0.2em] text-[color:var(--loombus-text-subtle)]">Timing</dt>
              <dd className="mt-2 text-sm font-semibold">{item.deadline ? `Needed by ${formatRequestDate(item.deadline)}` : "No deadline stated"}</dd>
            </div>
            <div>
              <dt className="text-xs font-bold uppercase tracking-[0.2em] text-[color:var(--loombus-text-subtle)]">Responses</dt>
              <dd className="mt-2 text-sm font-semibold">{item.responseCount} response{item.responseCount === 1 ? "" : "s"}</dd>
            </div>
          </dl>
        </section>

        <section className="border-b border-[color:var(--loombus-border)] py-8" aria-labelledby="request-overview-heading">
          <p className="text-xs font-bold uppercase tracking-[0.28em] text-[color:var(--loombus-gold)]">Request overview</p>
          <h2 id="request-overview-heading" className="mt-2 text-2xl font-semibold tracking-[-0.035em]">What is needed</h2>
          <p className="mt-5 max-w-4xl whitespace-pre-wrap text-base leading-8 text-[color:var(--loombus-text-muted)]">{item.description}</p>
        </section>

        <section className="border-b border-[color:var(--loombus-border)] py-6" aria-labelledby="request-actions-heading">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p id="request-actions-heading" className="text-xs font-bold uppercase tracking-[0.28em] text-[color:var(--loombus-text-subtle)]">Request actions</p>
              <p className="mt-2 text-sm text-[color:var(--loombus-text-muted)]">Respond privately, save this Request, or review responses you manage.</p>
            </div>
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
              {item.viewerCanManage ? (
                <Link href="/requests/manage" className={primaryButtonClass}>Review responses</Link>
              ) : (
                <button type="button" onClick={() => setResponseOpen((current) => !current)} disabled={item.viewerHasResponded} className={primaryButtonClass}><Send size={16} /> {item.viewerHasResponded ? "Response submitted" : "Respond to Request"}</button>
              )}
              <button type="button" onClick={() => void action({ action: item.viewerSaved ? "unsave" : "save", requestId: item.id }, "save", item.viewerSaved ? "Request removed from saved items." : "Request saved.")} className={secondaryButtonClass}><Bookmark size={16} /> {item.viewerSaved ? "Saved" : "Save Request"}</button>
            </div>
          </div>
        </section>

        {responseOpen && !item.viewerCanManage && !item.viewerHasResponded ? (
          <form onSubmit={submitResponse} className="border-b border-[color:var(--loombus-border)] py-8">
            <p className="text-xs font-bold uppercase tracking-[0.28em] text-[color:var(--loombus-gold)]">Private response</p>
            <h2 className="mt-2 text-2xl font-semibold tracking-[-0.035em]">Explain how you can help</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-[color:var(--loombus-text-muted)]">The requester and administrators can review this response. Private messaging begins only if the requester selects it.</p>
            <div className="mt-6 grid gap-x-6 gap-y-5 sm:grid-cols-2">
              <label className="sm:col-span-2"><span className="block text-xs font-bold uppercase tracking-[0.18em] text-[color:var(--loombus-text-subtle)]">How can you help?</span><textarea required minLength={20} maxLength={8000} rows={6} value={message} onChange={(event) => setMessage(event.target.value)} className={controlClass} /></label>
              <label className="sm:col-span-2"><span className="block text-xs font-bold uppercase tracking-[0.18em] text-[color:var(--loombus-text-subtle)]">Availability</span><input value={availabilityText} onChange={(event) => setAvailabilityText(event.target.value)} className={controlClass} /></label>
              <label><span className="block text-xs font-bold uppercase tracking-[0.18em] text-[color:var(--loombus-text-subtle)]">Estimate minimum</span><input type="number" min={0} step="0.01" value={estimateMin} onChange={(event) => setEstimateMin(event.target.value)} className={controlClass} /></label>
              <label><span className="block text-xs font-bold uppercase tracking-[0.18em] text-[color:var(--loombus-text-subtle)]">Estimate maximum</span><input type="number" min={0} step="0.01" value={estimateMax} onChange={(event) => setEstimateMax(event.target.value)} className={controlClass} /></label>
              <label><span className="block text-xs font-bold uppercase tracking-[0.18em] text-[color:var(--loombus-text-subtle)]">Currency</span><input maxLength={3} value={currency} onChange={(event) => setCurrency(event.target.value.toUpperCase())} className={controlClass} /></label>
              <label><span className="block text-xs font-bold uppercase tracking-[0.18em] text-[color:var(--loombus-text-subtle)]">Business attribution</span><select value={businessId} onChange={(event) => { setBusinessId(event.target.value); setAppointmentServiceId(""); }} className={controlClass}><option value="">Personal profile</option>{(payload.responderBusinesses ?? []).map((business) => <option key={business.id} value={business.id}>{business.name}</option>)}</select></label>
              <label className="sm:col-span-2"><span className="block text-xs font-bold uppercase tracking-[0.18em] text-[color:var(--loombus-text-subtle)]">Appointment service</span><select value={appointmentServiceId} onChange={(event) => setAppointmentServiceId(event.target.value)} className={controlClass}><option value="">No appointment service</option>{appointmentOptions.map((service) => <option key={service.id} value={service.id}>{service.businessName}: {service.name}</option>)}</select></label>
            </div>
            <div className="mt-6 flex flex-wrap gap-x-6 gap-y-2">
              <button type="submit" disabled={working === "respond"} className={primaryButtonClass}>{working === "respond" ? <Loader2 className="animate-spin" size={16} /> : <Send size={16} />} Submit response</button>
              <button type="button" onClick={() => setResponseOpen(false)} className={secondaryButtonClass}>Cancel</button>
            </div>
          </form>
        ) : null}

        {item.attachmentUrls.length ? (
          <section className="border-b border-[color:var(--loombus-border)] py-8" aria-labelledby="request-attachments-heading">
            <div className="flex items-center gap-2"><FileText className="text-[color:var(--loombus-gold)]" size={18} /><h2 id="request-attachments-heading" className="text-xl font-semibold">Attachments</h2></div>
            <div className="mt-4 divide-y divide-[color:var(--loombus-border)] border-y border-[color:var(--loombus-border)]">
              {item.attachmentUrls.map((url, index) => (
                <a key={url} href={url} target="_blank" rel="noreferrer" className="flex items-center justify-between gap-4 py-4 text-sm font-semibold transition hover:text-[color:var(--loombus-gold)]">
                  <span>{item.attachmentNames[index] || `Attachment ${index + 1}`}</span><ArrowUpRight size={14} />
                </a>
              ))}
            </div>
          </section>
        ) : null}

        <section className="grid border-b border-[color:var(--loombus-border)] py-8 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] md:divide-x md:divide-[color:var(--loombus-border)]" aria-label="Requester and safety">
          <div className="pb-7 md:pb-0 md:pr-8">
            <p className="text-xs font-bold uppercase tracking-[0.28em] text-[color:var(--loombus-text-subtle)]">Requester</p>
            <div className="mt-4 flex items-start gap-3">
              <UserRound className="mt-0.5 shrink-0 text-[color:var(--loombus-gold)]" size={18} />
              <div className="min-w-0">
                <strong>{item.businessName || item.requesterName}</strong>
                {ownerHref ? <Link href={ownerHref} className="mt-2 flex items-center gap-1 text-sm font-semibold text-[color:var(--loombus-gold)] hover:underline">Open attributable profile <ArrowUpRight size={13} /></Link> : null}
              </div>
            </div>
          </div>
          <div className="border-t border-[color:var(--loombus-border)] pt-7 md:border-t-0 md:pl-8 md:pt-0">
            <div className="flex gap-3">
              <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-[color:var(--loombus-gold)]" />
              <div>
                <h3 className="font-semibold">Safety boundary</h3>
                <p className="mt-2 text-sm leading-6 text-[color:var(--loombus-text-muted)]">Loombus does not process payments, verify licensing, guarantee credentials, or guarantee completion. Confirm every material detail independently.</p>
                <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2">
                  <Link href="/requests/safety" className="inline-flex items-center gap-1 text-sm font-semibold text-[color:var(--loombus-gold)] hover:underline">Read Requests safety <ArrowUpRight size={13} /></Link>
                  <button type="button" onClick={() => setReportOpen((current) => !current)} className="flex items-center gap-2 text-sm font-semibold text-[color:var(--loombus-gold)]"><Flag size={15} /> Report this Request</button>
                </div>
              </div>
            </div>
          </div>
        </section>

        {reportOpen ? (
          <section className="border-b border-[color:var(--loombus-border)] py-8">
            <p className="text-xs font-bold uppercase tracking-[0.28em] text-[color:var(--loombus-gold)]">Accountability</p>
            <h2 className="mt-2 text-2xl font-semibold tracking-[-0.035em]">Report Request</h2>
            <div className="mt-6 grid max-w-3xl gap-5">
              <label><span className="sr-only">Report reason</span><select value={reportReason} onChange={(event) => setReportReason(event.target.value)} className={controlClass}><option>Safety concern</option><option>Fraud or misleading information</option><option>Prohibited activity</option><option>Harassment or discrimination</option><option>Other</option></select></label>
              <label><span className="sr-only">Report details</span><textarea rows={5} maxLength={3000} value={reportDetails} onChange={(event) => setReportDetails(event.target.value)} className={controlClass} placeholder="Explain the concern" /></label>
              <div className="flex flex-wrap gap-x-6 gap-y-2">
                <button type="button" onClick={() => void submitReport()} disabled={reportDetails.trim().length < 10 || working === "report"} className={primaryButtonClass}>{working === "report" ? <Loader2 className="animate-spin" size={16} /> : <Flag size={16} />} Submit report</button>
                <button type="button" onClick={() => setReportOpen(false)} className={secondaryButtonClass}>Cancel</button>
              </div>
            </div>
          </section>
        ) : null}
      </div>
    </main>
  );
}
