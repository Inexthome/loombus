"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, Bookmark, BriefcaseBusiness, CalendarClock, Clock3, FileText, Flag, MapPin, Send, ShieldCheck, UserRound } from "lucide-react";
import { type FormEvent, type ReactNode, useCallback, useEffect, useState } from "react";
import { formatProviderServiceDuration, formatProviderServicePrice, providerServiceLocationLabel, providerServiceModeLabel, type PublicProviderService } from "@/lib/provider-services";
import { providerServicesAccessToken, providerServicesAuthorizedFetch } from "@/lib/provider-services-client";

type DetailPayload = { service: PublicProviderService; authenticated: boolean; isAdmin: boolean; ownRequests?: Array<{ id: string; title: string; slug: string }> };

export default function ServiceDetailPage() {
  const params = useParams();
  const rawSlug = params?.slug;
  const slug = Array.isArray(rawSlug) ? rawSlug[0] : rawSlug ?? "";
  const [payload, setPayload] = useState<DetailPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState("");
  const [notice, setNotice] = useState("");
  const [inquiryOpen, setInquiryOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [preferredStart, setPreferredStart] = useState("");
  const [preferredEnd, setPreferredEnd] = useState("");
  const [budgetMin, setBudgetMin] = useState("");
  const [budgetMax, setBudgetMax] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [linkedRequestId, setLinkedRequestId] = useState("");
  const [reportOpen, setReportOpen] = useState(false);
  const [reportReason, setReportReason] = useState("Safety concern");
  const [reportDetails, setReportDetails] = useState("");

  const load = useCallback(async () => {
    if (!slug) return;
    setLoading(true); setNotice("");
    try {
      const token = await providerServicesAccessToken().catch(() => "");
      const response = await fetch(`/api/services?slug=${encodeURIComponent(slug)}`, { cache: "no-store", headers: token ? { Authorization: `Bearer ${token}` } : undefined });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error ?? "Unable to load this Service.");
      setPayload(data as DetailPayload);
    } catch (error) { setPayload(null); setNotice(error instanceof Error ? error.message : "Unable to load this Service."); }
    finally { setLoading(false); }
  }, [slug]);
  useEffect(() => { void load(); }, [load]);

  async function post(body: Record<string, unknown>, key: string, success: string) {
    if (!payload?.service || working) return;
    setWorking(key); setNotice("");
    try {
      const response = await providerServicesAuthorizedFetch("/api/services", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }, `/services/${slug}`);
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error ?? "Unable to update the Service.");
      setNotice(success); await load();
    } catch (error) { setNotice(error instanceof Error ? error.message : "Unable to update the Service."); }
    finally { setWorking(""); }
  }

  async function submitInquiry(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const service = payload?.service; if (!service || working) return;
    setWorking("inquiry"); setNotice("");
    try {
      const response = await providerServicesAuthorizedFetch("/api/services", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "inquire", serviceId: service.id, message, preferredStart: preferredStart ? new Date(preferredStart).toISOString() : "", preferredEnd: preferredEnd ? new Date(preferredEnd).toISOString() : "", budgetMin, budgetMax, currency, linkedRequestId }) }, `/services/${slug}`);
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error ?? "Unable to send the Service inquiry.");
      setMessage(""); setPreferredStart(""); setPreferredEnd(""); setBudgetMin(""); setBudgetMax(""); setLinkedRequestId(""); setInquiryOpen(false);
      setNotice("Inquiry sent. The provider must accept before a private conversation begins."); await load();
    } catch (error) { setNotice(error instanceof Error ? error.message : "Unable to send the Service inquiry."); }
    finally { setWorking(""); }
  }

  if (loading) return <main className="min-h-screen bg-[var(--loombus-page-bg)] px-4 py-10 text-[var(--loombus-text)]"><div className="mx-auto max-w-5xl rounded-[2rem] border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-10 text-center">Loading Service…</div></main>;
  if (!payload?.service) return <main className="min-h-screen bg-[var(--loombus-page-bg)] px-4 py-10 text-[var(--loombus-text)]"><div className="mx-auto max-w-3xl rounded-[2rem] border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-10 text-center"><BriefcaseBusiness className="mx-auto" size={42}/><h1 className="mt-4 text-3xl font-semibold">Service unavailable</h1><p className="mt-3 text-[var(--loombus-text-muted)]">{notice || "This Service is not public."}</p><Link href="/services" className="mt-6 inline-flex rounded-full border border-[var(--loombus-border)] px-5 py-3 font-semibold">Back to Services</Link></div></main>;

  const service = payload.service;
  const ownerHref = service.businessSlug ? `/businesses/${service.businessSlug}` : service.providerUsername ? `/u/${service.providerUsername}` : null;
  const appointmentHref = service.businessSlug && service.appointmentServiceId ? `/businesses/${service.businessSlug}?appointmentService=${encodeURIComponent(service.appointmentServiceId)}#appointments` : null;

  return <main className="min-h-screen bg-[var(--loombus-page-bg)] px-4 py-8 text-[var(--loombus-text)] sm:px-6"><div className="mx-auto max-w-6xl space-y-5">
    <Link href="/services" className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--loombus-text-muted)]"><ArrowLeft size={17}/> Back to Services</Link>
    <header className="rounded-[2rem] border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-6 sm:p-9">
      <div className="flex flex-wrap gap-2 text-xs font-semibold"><span className="rounded-full border border-[var(--loombus-border)] px-3 py-1.5">{service.category}</span><span className="rounded-full border border-[var(--loombus-border)] px-3 py-1.5">{providerServiceModeLabel(service.serviceMode)}</span>{service.appointmentServiceId ? <span className="rounded-full border border-[var(--loombus-border)] px-3 py-1.5">Appointment connected</span> : null}</div>
      <h1 className="mt-5 max-w-4xl text-4xl font-semibold tracking-tight sm:text-6xl">{service.title}</h1><p className="mt-5 max-w-3xl whitespace-pre-wrap text-base leading-8 text-[var(--loombus-text-muted)]">{service.description}</p>
      {service.specialties.length ? <div className="mt-5 flex flex-wrap gap-2">{service.specialties.map((item) => <span key={item} className="rounded-full border border-[var(--loombus-border)] px-3 py-1.5 text-xs">{item}</span>)}</div> : null}
      <div className="mt-7 grid gap-4 md:grid-cols-3"><Info icon={<MapPin size={19}/>} label="Service area" value={providerServiceLocationLabel(service)}/><Info icon={<BriefcaseBusiness size={19}/>} label="Price context" value={formatProviderServicePrice(service)}/><Info icon={<Clock3 size={19}/>} label="Typical duration" value={formatProviderServiceDuration(service.typicalDurationMinutes)}/></div>
    </header>
    {notice ? <div className="rounded-2xl border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-4 text-sm" role="status">{notice}</div> : null}
    <div className="grid gap-5 lg:grid-cols-[1fr_340px]"><section className="space-y-5">
      <article className="rounded-[1.6rem] border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-6"><h2 className="text-xl font-semibold">Availability and response</h2><p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-[var(--loombus-text-muted)]">{service.availabilityText || "Availability is confirmed through an inquiry."}</p>{service.responseExpectation ? <p className="mt-3 text-sm">Response expectation: {service.responseExpectation}</p> : null}</article>
      {service.attachmentUrls.length ? <article className="rounded-[1.6rem] border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-6"><div className="flex items-center gap-2"><FileText size={18}/><h2 className="text-xl font-semibold">Examples and documents</h2></div><div className="mt-4 grid gap-3 sm:grid-cols-2">{service.attachmentUrls.map((url, index) => <a key={url} href={url} target="_blank" rel="noreferrer" className="rounded-2xl border border-[var(--loombus-border)] bg-[var(--loombus-page-bg)] p-4 text-sm font-semibold underline">{service.attachmentNames[index] || `Attachment ${index + 1}`}</a>)}</div></article> : null}
      {inquiryOpen && !service.viewerCanManage && !service.viewerHasInquiry ? <form onSubmit={submitInquiry} className="rounded-[1.6rem] border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-6"><h2 className="text-2xl font-semibold">Structured inquiry</h2><p className="mt-2 text-sm text-[var(--loombus-text-muted)]">The provider sees this privately. A conversation begins only after acceptance.</p><div className="mt-4 grid gap-4 sm:grid-cols-2"><label className="sm:col-span-2"><span className="mb-2 block text-sm font-semibold">What do you need?</span><textarea required minLength={20} maxLength={8000} rows={6} value={message} onChange={(event) => setMessage(event.target.value)} className="w-full rounded-2xl border border-[var(--loombus-border)] bg-[var(--loombus-page-bg)] px-4 py-3"/></label><Field label="Preferred start"><input type="datetime-local" value={preferredStart} onChange={(event) => setPreferredStart(event.target.value)} className="field"/></Field><Field label="Preferred end"><input type="datetime-local" value={preferredEnd} onChange={(event) => setPreferredEnd(event.target.value)} className="field"/></Field><Field label="Budget minimum"><input type="number" min={0} step="0.01" value={budgetMin} onChange={(event) => setBudgetMin(event.target.value)} className="field"/></Field><Field label="Budget maximum"><input type="number" min={0} step="0.01" value={budgetMax} onChange={(event) => setBudgetMax(event.target.value)} className="field"/></Field><Field label="Currency"><input maxLength={3} value={currency} onChange={(event) => setCurrency(event.target.value.toUpperCase())} className="field"/></Field><Field label="Connect your Request"><select value={linkedRequestId} onChange={(event) => setLinkedRequestId(event.target.value)} className="field"><option value="">No linked Request</option>{(payload.ownRequests ?? []).map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}</select></Field></div><div className="mt-5 flex gap-3"><button type="submit" disabled={working === "inquiry"} className="inline-flex items-center gap-2 rounded-full bg-[var(--loombus-primary-bg)] px-5 py-3 text-sm font-semibold text-[var(--loombus-primary-text)]"><Send size={16}/> Send inquiry</button><button type="button" onClick={() => setInquiryOpen(false)} className="rounded-full border border-[var(--loombus-border)] px-5 py-3 text-sm font-semibold">Cancel</button></div></form> : null}
    </section><aside className="space-y-5">
      <section className="rounded-[1.6rem] border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-5"><p className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--loombus-text-subtle)]">Provider</p><div className="mt-4 flex gap-3"><UserRound size={20}/><div><strong>{service.businessName || service.providerName}</strong>{ownerHref ? <Link href={ownerHref} className="mt-1 block text-sm underline">Open attributable profile</Link> : null}</div></div></section>
      <section className="rounded-[1.6rem] border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-5"><h2 className="font-semibold">Service actions</h2><div className="mt-4 grid gap-3">{service.viewerCanManage ? <Link href="/services/manage" className="primary-action">Manage Service</Link> : service.viewerHasInquiry ? <span className="secondary-action">Active inquiry already sent</span> : <button type="button" onClick={() => setInquiryOpen(true)} className="primary-action">Send inquiry</button>}{appointmentHref ? <Link href={appointmentHref} className="secondary-action"><CalendarClock size={16}/> Request appointment</Link> : null}<button type="button" onClick={() => void post({ action: service.viewerSaved ? "unsave" : "save", serviceId: service.id }, "save", service.viewerSaved ? "Service removed from saved items." : "Service saved.")} className="secondary-action"><Bookmark size={16}/> {service.viewerSaved ? "Saved" : "Save Service"}</button></div></section>
      <section className="rounded-[1.6rem] border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-5"><div className="flex items-center gap-2"><ShieldCheck size={18}/><strong>Transaction boundary</strong></div><p className="mt-3 text-sm leading-6 text-[var(--loombus-text-muted)]">Loombus does not process payment, guarantee work, verify professional licensing, or perform background checks.</p><button type="button" onClick={() => setReportOpen((value) => !value)} className="mt-4 inline-flex items-center gap-2 text-sm font-semibold"><Flag size={16}/> Report this Service</button></section>
    </aside></div>
    {reportOpen ? <section className="rounded-[1.6rem] border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-6"><h2 className="text-xl font-semibold">Report Service</h2><div className="mt-4 grid gap-4"><select value={reportReason} onChange={(event) => setReportReason(event.target.value)} className="field"><option>Safety concern</option><option>Fraud or misleading information</option><option>Prohibited activity</option><option>Harassment or discrimination</option><option>Other</option></select><textarea rows={5} maxLength={3000} value={reportDetails} onChange={(event) => setReportDetails(event.target.value)} className="field"/><div className="flex gap-3"><button type="button" disabled={working === "report" || reportDetails.trim().length < 10} onClick={() => void post({ action: "report", serviceId: service.id, reason: reportReason, details: reportDetails }, "report", "Report submitted for administrator review.")} className="primary-action">Submit report</button><button type="button" onClick={() => setReportOpen(false)} className="secondary-action">Cancel</button></div></div></section> : null}
    <style jsx>{`.field{width:100%;border:1px solid var(--loombus-border);border-radius:1rem;background:var(--loombus-page-bg);padding:.75rem 1rem}.primary-action,.secondary-action{display:flex;align-items:center;justify-content:center;gap:.5rem;border-radius:9999px;padding:.75rem 1.25rem;font-size:.875rem;font-weight:600}.primary-action{background:var(--loombus-primary-bg);color:var(--loombus-primary-text)}.secondary-action{border:1px solid var(--loombus-border)}`}</style>
  </div></main>;
}

function Info({ icon, label, value }: { icon: ReactNode; label: string; value: string }) { return <article className="rounded-2xl border border-[var(--loombus-border)] bg-[var(--loombus-page-bg)] p-4">{icon}<strong className="mt-3 block text-sm">{label}</strong><span className="mt-1 block text-sm text-[var(--loombus-text-muted)]">{value}</span></article>; }
function Field({ label, children }: { label: string; children: ReactNode }) { return <label><span className="mb-2 block text-sm font-semibold">{label}</span>{children}</label>; }
