"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import {
  ArrowLeft,
  ArrowUpRight,
  Bookmark,
  BriefcaseBusiness,
  CalendarClock,
  ChevronRight,
  Clock3,
  FileText,
  Flag,
  Loader2,
  MapPin,
  Send,
  ShieldCheck,
  Sparkles,
  UserRound,
} from "lucide-react";
import {
  type FormEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useState,
} from "react";
import {
  formatProviderServiceDuration,
  formatProviderServicePrice,
  providerServiceLocationLabel,
  providerServiceModeLabel,
  type PublicProviderService,
} from "@/lib/provider-services";
import {
  providerServicesAccessToken,
  providerServicesAuthorizedFetch,
} from "@/lib/provider-services-client";

type DetailPayload = {
  service: PublicProviderService;
  authenticated: boolean;
  isAdmin: boolean;
  ownRequests?: Array<{ id: string; title: string; slug: string }>;
};

const inputClass =
  "w-full rounded-2xl border border-[color:var(--loombus-border)] bg-[color:var(--loombus-page-bg)] px-4 py-3 text-[color:var(--loombus-text)] outline-none transition placeholder:text-[color:var(--loombus-text-subtle)] focus:border-[color:var(--loombus-gold)] focus:ring-4 focus:ring-[color:var(--loombus-gold-soft)]";
const secondaryButton =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-[color:var(--loombus-border)] bg-[color:var(--loombus-surface)] px-4 text-sm font-semibold transition hover:border-[color:var(--loombus-gold)] hover:bg-[color:var(--loombus-surface-muted)] disabled:opacity-50";
const primaryButton =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-[color:var(--loombus-gold)] px-4 text-sm font-semibold text-[color:var(--loombus-gold-contrast)] transition hover:opacity-90 disabled:opacity-50";

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
    setLoading(true);
    setNotice("");
    try {
      const token = await providerServicesAccessToken().catch(() => "");
      const response = await fetch(`/api/services?slug=${encodeURIComponent(slug)}`, {
        cache: "no-store",
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error ?? "Unable to load this Service.");
      setPayload(data as DetailPayload);
    } catch (error) {
      setPayload(null);
      setNotice(error instanceof Error ? error.message : "Unable to load this Service.");
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    void load();
  }, [load]);

  async function post(body: Record<string, unknown>, key: string, success: string) {
    if (!payload?.service || working) return;
    setWorking(key);
    setNotice("");
    try {
      const response = await providerServicesAuthorizedFetch(
        "/api/services",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
        `/services/${slug}`,
      );
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error ?? "Unable to update the Service.");
      setNotice(success);
      if (key === "report") {
        setReportOpen(false);
        setReportDetails("");
      }
      await load();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Unable to update the Service.");
    } finally {
      setWorking("");
    }
  }

  async function submitInquiry(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const service = payload?.service;
    if (!service || working) return;
    setWorking("inquiry");
    setNotice("");
    try {
      const response = await providerServicesAuthorizedFetch(
        "/api/services",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "inquire",
            serviceId: service.id,
            message,
            preferredStart: preferredStart ? new Date(preferredStart).toISOString() : "",
            preferredEnd: preferredEnd ? new Date(preferredEnd).toISOString() : "",
            budgetMin,
            budgetMax,
            currency,
            linkedRequestId,
          }),
        },
        `/services/${slug}`,
      );
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error ?? "Unable to send the Service inquiry.");
      setMessage("");
      setPreferredStart("");
      setPreferredEnd("");
      setBudgetMin("");
      setBudgetMax("");
      setLinkedRequestId("");
      setInquiryOpen(false);
      setNotice("Inquiry sent. The provider must accept before a private conversation begins.");
      await load();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Unable to send the Service inquiry.");
    } finally {
      setWorking("");
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-[color:var(--loombus-page-bg)] px-4 pb-24 pt-5 text-[color:var(--loombus-text)] sm:px-6 lg:px-8">
        <div className="mx-auto grid min-h-64 max-w-[84rem] place-items-center rounded-[1.75rem] border border-[color:var(--loombus-border)] bg-[color:var(--loombus-surface)] shadow-xl shadow-black/10">
          <span className="inline-flex items-center gap-2 text-sm font-semibold text-[color:var(--loombus-text-muted)]">
            <Loader2 className="animate-spin text-[color:var(--loombus-gold)]" size={18} /> Loading Service
          </span>
        </div>
      </main>
    );
  }

  if (!payload?.service) {
    return (
      <main className="min-h-screen bg-[color:var(--loombus-page-bg)] px-4 pb-24 pt-8 text-[color:var(--loombus-text)] sm:px-6">
        <section className="mx-auto max-w-3xl rounded-[1.75rem] border border-[color:var(--loombus-border)] bg-[color:var(--loombus-surface)] p-10 text-center shadow-xl shadow-black/10">
          <BriefcaseBusiness className="mx-auto text-[color:var(--loombus-gold)]" size={42} />
          <h1 className="mt-4 text-3xl font-semibold tracking-[-0.04em]">Service unavailable</h1>
          <p className="mt-3 text-[color:var(--loombus-text-muted)]">{notice || "This Service is not public."}</p>
          <Link href="/services" className={`${secondaryButton} mt-6`}>
            <ArrowLeft size={16} /> Back to Services
          </Link>
        </section>
      </main>
    );
  }

  const service = payload.service;
  const ownerHref = service.businessSlug
    ? `/businesses/${service.businessSlug}`
    : service.providerUsername
      ? `/u/${service.providerUsername}`
      : null;
  const appointmentHref =
    service.businessSlug && service.appointmentServiceId
      ? `/businesses/${service.businessSlug}?appointmentService=${encodeURIComponent(service.appointmentServiceId)}#appointments`
      : null;

  return (
    <main className="min-h-screen bg-[color:var(--loombus-page-bg)] px-4 pb-24 pt-5 text-[color:var(--loombus-text)] sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[84rem]">
        <Link href="/services" className="inline-flex items-center gap-2 text-sm font-semibold text-[color:var(--loombus-text-muted)] transition hover:text-[color:var(--loombus-gold)]">
          <ArrowLeft size={16} /> Services
        </Link>

        <header className="mt-5 border-b border-[color:var(--loombus-border-muted)] pb-6">
          <div className="flex flex-wrap items-center gap-2 text-xs font-semibold">
            <span className="rounded-full border border-[color:var(--loombus-border)] bg-[color:var(--loombus-surface)] px-3 py-1.5">{service.category}</span>
            <span className="rounded-full border border-[color:var(--loombus-border)] bg-[color:var(--loombus-surface)] px-3 py-1.5">{providerServiceModeLabel(service.serviceMode)}</span>
            {service.appointmentServiceId ? (
              <span className="rounded-full bg-[color:var(--loombus-cream)] px-3 py-1.5 text-[color:var(--loombus-cream-contrast)] dark:bg-[color:var(--loombus-gold-soft)] dark:text-[color:var(--loombus-gold)]">
                Appointment connected
              </span>
            ) : null}
          </div>
          <h1 className="mt-4 max-w-4xl text-4xl font-semibold tracking-[-0.055em] sm:text-5xl">{service.title}</h1>
          <p className="mt-3 text-base font-semibold text-[color:var(--loombus-text-muted)]">
            {service.businessName || service.providerName}
          </p>
        </header>

        <section className="my-6 grid gap-3 sm:grid-cols-3">
          <Info icon={<MapPin size={18} />} label="Service area" value={providerServiceLocationLabel(service)} featured />
          <Info icon={<BriefcaseBusiness size={18} />} label="Price context" value={formatProviderServicePrice(service)} />
          <Info icon={<Clock3 size={18} />} label="Typical duration" value={formatProviderServiceDuration(service.typicalDurationMinutes)} />
        </section>

        {notice ? (
          <div className="mb-6 rounded-2xl border border-[color:var(--loombus-border)] bg-[color:var(--loombus-surface)] p-4 text-sm shadow-sm" role="status">
            {notice}
          </div>
        ) : null}

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_21rem]">
          <section className="min-w-0 space-y-5">
            <article className="rounded-[1.75rem] border border-[color:var(--loombus-border)] bg-[color:var(--loombus-surface)] p-6 shadow-xl shadow-black/10 sm:p-7">
              <p className="text-xs font-bold uppercase tracking-[0.28em] text-[color:var(--loombus-gold)]">Service overview</p>
              <h2 className="mt-1 text-2xl font-semibold tracking-[-0.035em]">What is being offered</h2>
              <p className="mt-4 whitespace-pre-wrap text-base leading-8 text-[color:var(--loombus-text-muted)]">{service.description}</p>
              {service.specialties.length > 0 ? (
                <div className="mt-6 border-t border-[color:var(--loombus-border-muted)] pt-5">
                  <h3 className="text-sm font-semibold">Specialties</h3>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {service.specialties.map((item) => (
                      <span key={item} className="rounded-full border border-[color:var(--loombus-border)] bg-[color:var(--loombus-page-bg)] px-3 py-1.5 text-xs text-[color:var(--loombus-text-muted)]">{item}</span>
                    ))}
                  </div>
                </div>
              ) : null}
            </article>

            <article className="rounded-[1.75rem] border border-[color:var(--loombus-border)] bg-[color:var(--loombus-surface)] p-6 shadow-xl shadow-black/10 sm:p-7">
              <div className="flex items-center gap-3">
                <span className="grid h-10 w-10 place-items-center rounded-2xl bg-[color:var(--loombus-cream)] text-[color:var(--loombus-gold)] dark:bg-[color:var(--loombus-gold-soft)]"><Clock3 size={19} /></span>
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.22em] text-[color:var(--loombus-text-muted)]">Timing</p>
                  <h2 className="text-xl font-semibold">Availability and response</h2>
                </div>
              </div>
              <p className="mt-4 whitespace-pre-wrap text-sm leading-7 text-[color:var(--loombus-text-muted)]">{service.availabilityText || "Availability is confirmed through an inquiry."}</p>
              {service.responseExpectation ? (
                <p className="mt-4 rounded-2xl bg-[color:var(--loombus-page-bg)] p-4 text-sm"><strong>Response expectation:</strong> {service.responseExpectation}</p>
              ) : null}
            </article>

            {service.attachmentUrls.length > 0 ? (
              <article className="rounded-[1.75rem] border border-[color:var(--loombus-border)] bg-[color:var(--loombus-surface)] p-6 shadow-xl shadow-black/10 sm:p-7">
                <div className="flex items-center gap-2"><FileText className="text-[color:var(--loombus-gold)]" size={19} /><h2 className="text-xl font-semibold">Examples and documents</h2></div>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  {service.attachmentUrls.map((url, index) => (
                    <a key={url} href={url} target="_blank" rel="noreferrer" className="flex items-center justify-between rounded-2xl border border-[color:var(--loombus-border)] bg-[color:var(--loombus-page-bg)] p-4 text-sm font-semibold transition hover:border-[color:var(--loombus-gold)]">
                      <span className="truncate">{service.attachmentNames[index] || `Attachment ${index + 1}`}</span>
                      <ArrowUpRight className="h-4 w-4 shrink-0 text-[color:var(--loombus-gold)]" />
                    </a>
                  ))}
                </div>
              </article>
            ) : null}

            {inquiryOpen && !service.viewerCanManage && !service.viewerHasInquiry ? (
              <form onSubmit={submitInquiry} className="rounded-[1.75rem] border border-[color:var(--loombus-gold)] bg-[color:var(--loombus-surface)] p-6 shadow-xl shadow-black/10 sm:p-7">
                <p className="text-xs font-bold uppercase tracking-[0.28em] text-[color:var(--loombus-gold)]">Private request</p>
                <h2 className="mt-1 text-2xl font-semibold tracking-[-0.035em]">Structured inquiry</h2>
                <p className="mt-2 text-sm leading-6 text-[color:var(--loombus-text-muted)]">The provider sees this privately. A conversation begins only after acceptance.</p>
                <div className="mt-5 grid gap-4 sm:grid-cols-2">
                  <Field label="What do you need?" wide>
                    <textarea required minLength={20} maxLength={8000} rows={6} value={message} onChange={(event) => setMessage(event.target.value)} className={inputClass} />
                  </Field>
                  <Field label="Preferred start"><input type="datetime-local" value={preferredStart} onChange={(event) => setPreferredStart(event.target.value)} className={inputClass} /></Field>
                  <Field label="Preferred end"><input type="datetime-local" value={preferredEnd} onChange={(event) => setPreferredEnd(event.target.value)} className={inputClass} /></Field>
                  <Field label="Budget minimum"><input type="number" min={0} step="0.01" value={budgetMin} onChange={(event) => setBudgetMin(event.target.value)} className={inputClass} /></Field>
                  <Field label="Budget maximum"><input type="number" min={0} step="0.01" value={budgetMax} onChange={(event) => setBudgetMax(event.target.value)} className={inputClass} /></Field>
                  <Field label="Currency"><input maxLength={3} value={currency} onChange={(event) => setCurrency(event.target.value.toUpperCase())} className={inputClass} /></Field>
                  <Field label="Connect your Request">
                    <select value={linkedRequestId} onChange={(event) => setLinkedRequestId(event.target.value)} className={inputClass}>
                      <option value="">No linked Request</option>
                      {(payload.ownRequests ?? []).map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}
                    </select>
                  </Field>
                </div>
                <div className="mt-5 flex flex-wrap gap-3">
                  <button type="submit" disabled={working === "inquiry"} className={primaryButton}>
                    {working === "inquiry" ? <Loader2 className="animate-spin" size={16} /> : <Send size={16} />} Send inquiry
                  </button>
                  <button type="button" onClick={() => setInquiryOpen(false)} className={secondaryButton}>Cancel</button>
                </div>
              </form>
            ) : null}

            {reportOpen ? (
              <section className="rounded-[1.75rem] border border-red-500/30 bg-[color:var(--loombus-surface)] p-6 shadow-xl shadow-black/10 sm:p-7">
                <h2 className="text-xl font-semibold">Report Service</h2>
                <p className="mt-2 text-sm leading-6 text-[color:var(--loombus-text-muted)]">Reports go to administrator review and do not contact the provider.</p>
                <div className="mt-4 grid gap-4">
                  <select value={reportReason} onChange={(event) => setReportReason(event.target.value)} className={inputClass}>
                    <option>Safety concern</option>
                    <option>Fraud or misleading information</option>
                    <option>Prohibited activity</option>
                    <option>Harassment or discrimination</option>
                    <option>Other</option>
                  </select>
                  <textarea rows={5} maxLength={3000} value={reportDetails} onChange={(event) => setReportDetails(event.target.value)} className={inputClass} placeholder="Explain the material concern" />
                  <div className="flex flex-wrap gap-3">
                    <button type="button" disabled={working === "report" || reportDetails.trim().length < 10} onClick={() => void post({ action: "report", serviceId: service.id, reason: reportReason, details: reportDetails }, "report", "Report submitted for administrator review.")} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-red-600 px-4 text-sm font-semibold text-white disabled:opacity-50">
                      {working === "report" ? <Loader2 className="animate-spin" size={16} /> : <Flag size={16} />} Submit report
                    </button>
                    <button type="button" onClick={() => setReportOpen(false)} className={secondaryButton}>Cancel</button>
                  </div>
                </div>
              </section>
            ) : null}
          </section>

          <aside className="space-y-5 xl:sticky xl:top-28 xl:self-start">
            <section className="rounded-[1.75rem] border border-[color:var(--loombus-border)] bg-[color:var(--loombus-surface)] p-5 shadow-2xl shadow-black/10">
              <p className="text-xs font-bold uppercase tracking-[0.3em]">Provider</p>
              <div className="mt-4 flex gap-3">
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-[color:var(--loombus-cream)] text-[color:var(--loombus-gold)] dark:bg-[color:var(--loombus-gold-soft)]"><UserRound size={20} /></span>
                <div className="min-w-0">
                  <strong className="block truncate">{service.businessName || service.providerName}</strong>
                  <span className="mt-1 block text-xs text-[color:var(--loombus-text-muted)]">Attributable provider</span>
                </div>
              </div>
              {ownerHref ? (
                <Link href={ownerHref} className="mt-4 flex items-center justify-between rounded-2xl bg-[color:var(--loombus-page-bg)] px-4 py-3 text-sm font-semibold transition hover:bg-[color:var(--loombus-surface-muted)]">
                  Open provider profile <ChevronRight className="h-4 w-4 text-[color:var(--loombus-gold)]" />
                </Link>
              ) : null}
            </section>

            <section className="rounded-[1.75rem] border border-[color:var(--loombus-border)] bg-[color:var(--loombus-surface)] p-5 shadow-2xl shadow-black/10">
              <p className="text-xs font-bold uppercase tracking-[0.3em]">Service actions</p>
              <div className="mt-4 grid gap-2">
                {service.viewerCanManage ? (
                  <Link href="/services/manage" className={primaryButton}>Manage Service</Link>
                ) : service.viewerHasInquiry ? (
                  <span className="rounded-2xl bg-[color:var(--loombus-page-bg)] px-4 py-3 text-center text-sm font-semibold">Active inquiry already sent</span>
                ) : (
                  <button type="button" onClick={() => setInquiryOpen(true)} className={primaryButton}><Send size={16} /> Send inquiry</button>
                )}
                {appointmentHref ? <Link href={appointmentHref} className={secondaryButton}><CalendarClock size={16} /> Request appointment</Link> : null}
                <button type="button" onClick={() => void post({ action: service.viewerSaved ? "unsave" : "save", serviceId: service.id }, "save", service.viewerSaved ? "Service removed from saved items." : "Service saved.")} className={secondaryButton}>
                  {working === "save" ? <Loader2 className="animate-spin" size={16} /> : <Bookmark size={16} />} {service.viewerSaved ? "Saved" : "Save Service"}
                </button>
              </div>
            </section>

            <section className="rounded-[1.75rem] border border-[color:var(--loombus-border)] bg-[color:var(--loombus-surface)] p-5 shadow-2xl shadow-black/10">
              <div className="flex gap-3">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-[color:var(--loombus-cream)] text-[color:var(--loombus-gold)] dark:bg-[color:var(--loombus-gold-soft)]"><Sparkles size={18} /></span>
                <div>
                  <h3 className="font-semibold">How contact works</h3>
                  <p className="mt-1 text-sm leading-6 text-[color:var(--loombus-text-muted)]">Your inquiry remains private. The provider must accept it before a private conversation begins.</p>
                </div>
              </div>
            </section>

            <section className="rounded-[1.75rem] border border-[color:var(--loombus-border)] bg-[color:var(--loombus-surface)] p-5 shadow-2xl shadow-black/10">
              <div className="flex gap-3">
                <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-[color:var(--loombus-gold)]" />
                <div>
                  <h3 className="font-semibold">Transaction boundary</h3>
                  <p className="mt-1 text-sm leading-6 text-[color:var(--loombus-text-muted)]">Loombus does not process payment, guarantee work, verify professional licensing, or perform background checks.</p>
                  <button type="button" onClick={() => setReportOpen((value) => !value)} className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-red-600 dark:text-red-400"><Flag size={16} /> Report this Service</button>
                </div>
              </div>
            </section>
          </aside>
        </div>
      </div>
    </main>
  );
}

function Info({
  icon,
  label,
  value,
  featured = false,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  featured?: boolean;
}) {
  return (
    <article className={`rounded-[1.4rem] border p-4 shadow-sm ${featured ? "border-[color:var(--loombus-gold)] bg-[color:var(--loombus-cream)] text-[color:var(--loombus-cream-contrast)] dark:bg-[color:var(--loombus-gold-soft)] dark:text-[color:var(--loombus-text)]" : "border-[color:var(--loombus-border)] bg-[color:var(--loombus-surface)]"}`}>
      <span className="text-[color:var(--loombus-gold)]">{icon}</span>
      <strong className="mt-3 block text-xs uppercase tracking-[0.16em] text-[color:var(--loombus-text-muted)]">{label}</strong>
      <span className="mt-1 block text-sm font-semibold">{value}</span>
    </article>
  );
}

function Field({
  label,
  children,
  wide = false,
}: {
  label: string;
  children: ReactNode;
  wide?: boolean;
}) {
  return (
    <label className={wide ? "sm:col-span-2" : ""}>
      <span className="mb-2 block text-sm font-semibold">{label}</span>
      {children}
    </label>
  );
}
