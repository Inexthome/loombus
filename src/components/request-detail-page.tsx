"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import {
  ArrowLeft,
  ArrowUpRight,
  Bookmark,
  BriefcaseBusiness,
  CalendarClock,
  FileText,
  Flag,
  Loader2,
  MapPin,
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
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-[color:var(--loombus-gold)] px-5 py-3 text-sm font-semibold text-[color:var(--loombus-gold-contrast)] transition hover:opacity-90 disabled:opacity-50";
const secondaryButtonClass =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-[color:var(--loombus-border)] bg-[color:var(--loombus-surface)] px-5 py-3 text-sm font-semibold transition hover:border-[color:var(--loombus-gold)] disabled:opacity-50";
const controlClass =
  "w-full rounded-2xl border border-[color:var(--loombus-border)] bg-[color:var(--loombus-page-bg)] px-4 py-3 text-sm text-[color:var(--loombus-text)] outline-none transition placeholder:text-[color:var(--loombus-text-subtle)] focus:border-[color:var(--loombus-gold)] focus:ring-4 focus:ring-[color:var(--loombus-gold-soft)]";

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
        <div className="mx-auto grid min-h-64 max-w-[88rem] place-items-center rounded-[1.75rem] border border-[color:var(--loombus-border)] bg-[color:var(--loombus-surface)] shadow-xl shadow-black/10">
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
        <div className="mx-auto max-w-3xl rounded-[1.75rem] border border-[color:var(--loombus-border)] bg-[color:var(--loombus-surface)] p-10 text-center shadow-xl shadow-black/10">
          <BriefcaseBusiness className="mx-auto text-[color:var(--loombus-gold)]" size={42} />
          <h1 className="mt-4 text-3xl font-semibold tracking-[-0.04em]">Request unavailable</h1>
          <p className="mt-3 text-[color:var(--loombus-text-muted)]">{notice || "This Request is not public."}</p>
          <Link href="/requests" className={`${secondaryButtonClass} mt-6`}>
            <ArrowLeft size={16} /> Back to Requests
          </Link>
        </div>
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
      <div className="mx-auto max-w-[88rem]">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <Link href="/requests" className="inline-flex items-center gap-2 text-sm font-semibold text-[color:var(--loombus-text-muted)] transition hover:text-[color:var(--loombus-gold)]">
            <ArrowLeft size={16} /> Back to Requests
          </Link>
          <Link href="/services" className="inline-flex items-center gap-2 rounded-full border border-[color:var(--loombus-border)] bg-[color:var(--loombus-surface)] px-4 py-2 text-sm font-semibold transition hover:border-[color:var(--loombus-gold)]">
            Browse Services <ArrowUpRight size={14} />
          </Link>
        </div>

        <header className="rounded-[1.75rem] border border-[color:var(--loombus-border)] bg-[color:var(--loombus-surface)] p-5 shadow-xl shadow-black/10 sm:p-7">
          <div className="flex flex-wrap gap-2 text-xs font-semibold">
            <span className="rounded-full border border-[color:var(--loombus-border)] px-3 py-1.5">{requestTypeLabel(item.requestType)}</span>
            <span className="rounded-full border border-[color:var(--loombus-border)] px-3 py-1.5">{item.category}</span>
            <span className="rounded-full bg-[color:var(--loombus-cream)] px-3 py-1.5 text-[color:var(--loombus-cream-contrast)] dark:bg-[color:var(--loombus-gold-soft)] dark:text-[color:var(--loombus-gold)]">{requestUrgencyLabel(item.urgency)}</span>
          </div>
          <h1 className="mt-4 max-w-5xl text-4xl font-semibold tracking-[-0.055em] sm:text-5xl">{item.title}</h1>
          <p className="mt-3 text-sm font-semibold text-[color:var(--loombus-text-muted)]">Requested by {item.businessName || item.requesterName}</p>
        </header>

        {notice ? (
          <div className="mt-5 rounded-2xl border border-[color:var(--loombus-border)] bg-[color:var(--loombus-surface)] p-4 text-sm shadow-sm" role="status">{notice}</div>
        ) : null}

        <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_21rem]">
          <section className="min-w-0 space-y-5">
            <article className="rounded-[1.75rem] border border-[color:var(--loombus-border)] bg-[color:var(--loombus-surface)] p-5 shadow-xl shadow-black/10 sm:p-6">
              <p className="text-xs font-bold uppercase tracking-[0.28em] text-[color:var(--loombus-gold)]">Request overview</p>
              <h2 className="mt-1 text-2xl font-semibold tracking-[-0.035em]">What is needed</h2>
              <p className="mt-4 whitespace-pre-wrap text-base leading-8 text-[color:var(--loombus-text-muted)]">{item.description}</p>

              <div className="mt-6 grid gap-3 md:grid-cols-3">
                <article className="rounded-2xl bg-[color:var(--loombus-page-bg)] p-4">
                  <MapPin className="text-[color:var(--loombus-gold)]" size={19} />
                  <strong className="mt-3 block text-sm">Location</strong>
                  <span className="mt-1 block text-sm leading-6 text-[color:var(--loombus-text-muted)]">{requestLocationLabel(item)}</span>
                  <small className="mt-2 block text-[color:var(--loombus-text-subtle)]">{requestModeLabel(item.serviceMode)}</small>
                </article>
                <article className="rounded-2xl bg-[color:var(--loombus-page-bg)] p-4">
                  <BriefcaseBusiness className="text-[color:var(--loombus-gold)]" size={19} />
                  <strong className="mt-3 block text-sm">Budget context</strong>
                  <span className="mt-1 block text-sm leading-6 text-[color:var(--loombus-text-muted)]">{formatRequestBudget(item)}</span>
                </article>
                <article className="rounded-2xl bg-[color:var(--loombus-page-bg)] p-4">
                  <CalendarClock className="text-[color:var(--loombus-gold)]" size={19} />
                  <strong className="mt-3 block text-sm">Timing and responses</strong>
                  <span className="mt-1 block text-sm leading-6 text-[color:var(--loombus-text-muted)]">{item.deadline ? `Needed by ${formatRequestDate(item.deadline)}` : "No deadline stated"}</span>
                  <small className="mt-2 block text-[color:var(--loombus-text-subtle)]">{item.responseCount} response{item.responseCount === 1 ? "" : "s"}</small>
                </article>
              </div>
            </article>

            {responseOpen && !item.viewerCanManage && !item.viewerHasResponded ? (
              <form onSubmit={submitResponse} className="rounded-[1.75rem] border border-[color:var(--loombus-border)] bg-[color:var(--loombus-surface)] p-5 shadow-xl shadow-black/10 sm:p-6">
                <p className="text-xs font-bold uppercase tracking-[0.28em] text-[color:var(--loombus-gold)]">Private response</p>
                <h2 className="mt-1 text-2xl font-semibold tracking-[-0.035em]">Explain how you can help</h2>
                <p className="mt-2 text-sm leading-6 text-[color:var(--loombus-text-muted)]">The requester and administrators can review this response. Private messaging begins only if the requester selects it.</p>
                <div className="mt-5 grid gap-4 sm:grid-cols-2">
                  <label className="sm:col-span-2"><span className="mb-2 block text-sm font-semibold">How can you help?</span><textarea required minLength={20} maxLength={8000} rows={6} value={message} onChange={(event) => setMessage(event.target.value)} className={controlClass} /></label>
                  <label className="sm:col-span-2"><span className="mb-2 block text-sm font-semibold">Availability</span><input value={availabilityText} onChange={(event) => setAvailabilityText(event.target.value)} className={controlClass} /></label>
                  <label><span className="mb-2 block text-sm font-semibold">Estimate minimum</span><input type="number" min={0} step="0.01" value={estimateMin} onChange={(event) => setEstimateMin(event.target.value)} className={controlClass} /></label>
                  <label><span className="mb-2 block text-sm font-semibold">Estimate maximum</span><input type="number" min={0} step="0.01" value={estimateMax} onChange={(event) => setEstimateMax(event.target.value)} className={controlClass} /></label>
                  <label><span className="mb-2 block text-sm font-semibold">Currency</span><input maxLength={3} value={currency} onChange={(event) => setCurrency(event.target.value.toUpperCase())} className={controlClass} /></label>
                  <label><span className="mb-2 block text-sm font-semibold">Business attribution</span><select value={businessId} onChange={(event) => { setBusinessId(event.target.value); setAppointmentServiceId(""); }} className={controlClass}><option value="">Personal profile</option>{(payload.responderBusinesses ?? []).map((business) => <option key={business.id} value={business.id}>{business.name}</option>)}</select></label>
                  <label className="sm:col-span-2"><span className="mb-2 block text-sm font-semibold">Appointment service</span><select value={appointmentServiceId} onChange={(event) => setAppointmentServiceId(event.target.value)} className={controlClass}><option value="">No appointment service</option>{appointmentOptions.map((service) => <option key={service.id} value={service.id}>{service.businessName}: {service.name}</option>)}</select></label>
                </div>
                <div className="mt-5 flex flex-wrap gap-3">
                  <button type="submit" disabled={working === "respond"} className={primaryButtonClass}>{working === "respond" ? <Loader2 className="animate-spin" size={16} /> : <Send size={16} />} Submit response</button>
                  <button type="button" onClick={() => setResponseOpen(false)} className={secondaryButtonClass}>Cancel</button>
                </div>
              </form>
            ) : null}

            {item.attachmentUrls.length ? (
              <article className="rounded-[1.75rem] border border-[color:var(--loombus-border)] bg-[color:var(--loombus-surface)] p-5 shadow-xl shadow-black/10 sm:p-6">
                <div className="flex items-center gap-2"><FileText className="text-[color:var(--loombus-gold)]" size={18} /><h2 className="text-xl font-semibold">Attachments</h2></div>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  {item.attachmentUrls.map((url, index) => (
                    <a key={url} href={url} target="_blank" rel="noreferrer" className="rounded-2xl border border-[color:var(--loombus-border)] bg-[color:var(--loombus-page-bg)] p-4 text-sm font-semibold transition hover:border-[color:var(--loombus-gold)]">
                      {item.attachmentNames[index] || `Attachment ${index + 1}`} <ArrowUpRight className="ml-1 inline" size={13} />
                    </a>
                  ))}
                </div>
              </article>
            ) : null}

            {reportOpen ? (
              <section className="rounded-[1.75rem] border border-[color:var(--loombus-border)] bg-[color:var(--loombus-surface)] p-5 shadow-xl shadow-black/10 sm:p-6">
                <p className="text-xs font-bold uppercase tracking-[0.28em] text-[color:var(--loombus-gold)]">Accountability</p>
                <h2 className="mt-1 text-2xl font-semibold tracking-[-0.035em]">Report Request</h2>
                <div className="mt-5 grid gap-4">
                  <select value={reportReason} onChange={(event) => setReportReason(event.target.value)} className={controlClass}><option>Safety concern</option><option>Fraud or misleading information</option><option>Prohibited activity</option><option>Harassment or discrimination</option><option>Other</option></select>
                  <textarea rows={5} maxLength={3000} value={reportDetails} onChange={(event) => setReportDetails(event.target.value)} className={controlClass} placeholder="Explain the concern" />
                  <div className="flex flex-wrap gap-3">
                    <button type="button" onClick={() => void submitReport()} disabled={reportDetails.trim().length < 10 || working === "report"} className={primaryButtonClass}>{working === "report" ? <Loader2 className="animate-spin" size={16} /> : <Flag size={16} />} Submit report</button>
                    <button type="button" onClick={() => setReportOpen(false)} className={secondaryButtonClass}>Cancel</button>
                  </div>
                </div>
              </section>
            ) : null}
          </section>

          <aside className="space-y-5 xl:sticky xl:top-28 xl:self-start">
            <section className="rounded-[1.75rem] border border-[color:var(--loombus-border)] bg-[color:var(--loombus-surface)] p-5 shadow-2xl shadow-black/10">
              <p className="text-xs font-bold uppercase tracking-[0.3em]">Request actions</p>
              <div className="mt-4 grid gap-2">
                {item.viewerCanManage ? (
                  <Link href="/requests/manage" className={primaryButtonClass}>Review responses</Link>
                ) : (
                  <button type="button" onClick={() => setResponseOpen((current) => !current)} disabled={item.viewerHasResponded} className={primaryButtonClass}><Send size={16} /> {item.viewerHasResponded ? "Response submitted" : "Respond to Request"}</button>
                )}
                <button type="button" onClick={() => void action({ action: item.viewerSaved ? "unsave" : "save", requestId: item.id }, "save", item.viewerSaved ? "Request removed from saved items." : "Request saved.")} className={secondaryButtonClass}><Bookmark size={16} /> {item.viewerSaved ? "Saved" : "Save Request"}</button>
              </div>
            </section>

            <section className="rounded-[1.75rem] border border-[color:var(--loombus-border)] bg-[color:var(--loombus-surface)] p-5 shadow-2xl shadow-black/10">
              <p className="text-xs font-bold uppercase tracking-[0.3em]">Requester</p>
              <div className="mt-4 flex items-start gap-3">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-[color:var(--loombus-cream)] text-[color:var(--loombus-gold)] dark:bg-[color:var(--loombus-gold-soft)]"><UserRound size={18} /></span>
                <div className="min-w-0">
                  <strong>{item.businessName || item.requesterName}</strong>
                  {ownerHref ? <Link href={ownerHref} className="mt-2 inline-flex items-center gap-1 text-sm font-semibold text-[color:var(--loombus-gold)] hover:underline">Open attributable profile <ArrowUpRight size={13} /></Link> : null}
                </div>
              </div>
            </section>

            <section className="rounded-[1.75rem] border border-[color:var(--loombus-border)] bg-[color:var(--loombus-surface)] p-5 shadow-2xl shadow-black/10">
              <div className="flex gap-3">
                <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-[color:var(--loombus-gold)]" />
                <div>
                  <h3 className="font-semibold">Safety boundary</h3>
                  <p className="mt-2 text-sm leading-6 text-[color:var(--loombus-text-muted)]">Loombus does not process payments, verify licensing, guarantee credentials, or guarantee completion. Confirm every material detail independently.</p>
                  <Link href="/requests/safety" className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-[color:var(--loombus-gold)] hover:underline">Read Requests safety <ArrowUpRight size={13} /></Link>
                  <button type="button" onClick={() => setReportOpen((current) => !current)} className="mt-4 flex items-center gap-2 text-sm font-semibold text-[color:var(--loombus-gold)]"><Flag size={15} /> Report this Request</button>
                </div>
              </div>
            </section>
          </aside>
        </div>
      </div>
    </main>
  );
}
