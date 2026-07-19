"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import {
  ArrowLeft,
  ArrowUpRight,
  Building2,
  CalendarDays,
  CheckCircle2,
  ExternalLink,
  Flag,
  Globe2,
  Loader2,
  MapPin,
  ShieldCheck,
  Users,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import {
  eventLocationLabel,
  eventPriceLabel,
  formatEventDateRange,
  type EventResponse,
  type PublicEvent,
} from "@/lib/events";
import { scheduleAccessToken, scheduleAuthorizedFetch } from "@/lib/schedule-client";

const primaryButtonClass =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-[color:var(--loombus-gold)] px-5 py-3 text-sm font-semibold text-[color:var(--loombus-gold-contrast)] transition hover:opacity-90 disabled:opacity-50";
const secondaryButtonClass =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-[color:var(--loombus-border)] bg-[color:var(--loombus-surface)] px-5 py-3 text-sm font-semibold transition hover:border-[color:var(--loombus-gold)] disabled:opacity-50";
const controlClass =
  "w-full rounded-2xl border border-[color:var(--loombus-border)] bg-[color:var(--loombus-page-bg)] px-4 py-3 text-sm text-[color:var(--loombus-text)] outline-none transition focus:border-[color:var(--loombus-gold)] focus:ring-4 focus:ring-[color:var(--loombus-gold-soft)]";

export default function EventDetailPage() {
  const params = useParams();
  const rawSlug = params?.slug;
  const slug = Array.isArray(rawSlug) ? rawSlug[0] : rawSlug ?? "";
  const [event, setEvent] = useState<PublicEvent | null>(null);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState("");
  const [notice, setNotice] = useState("");
  const [reportOpen, setReportOpen] = useState(false);
  const [reportReason, setReportReason] = useState("Safety concern");
  const [reportDetails, setReportDetails] = useState("");

  const load = useCallback(async () => {
    if (!slug) return;
    setLoading(true);
    setNotice("");
    try {
      const token = await scheduleAccessToken().catch(() => "");
      const response = await fetch(`/api/events?slug=${encodeURIComponent(slug)}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        cache: "no-store",
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error ?? "Unable to load this event.");
      setEvent(payload.event ?? null);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Unable to load this event.");
      setEvent(null);
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    void load();
  }, [load]);

  async function respond(responseValue: EventResponse | "none") {
    if (!event || working) return;
    setWorking(`response:${responseValue}`);
    setNotice("");
    try {
      const response = await scheduleAuthorizedFetch(
        "/api/events",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "respond",
            eventId: event.id,
            response: responseValue,
          }),
        },
        `/events/${slug}`,
      );
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error ?? "Unable to save your response.");
      await load();
      setNotice(responseValue === "none" ? "Event response removed." : "Event response saved.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Unable to save your response.");
    } finally {
      setWorking("");
    }
  }

  async function submitReport() {
    if (!event || working) return;
    setWorking("report");
    setNotice("");
    try {
      const response = await scheduleAuthorizedFetch(
        "/api/events",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "report",
            eventId: event.id,
            reason: reportReason,
            details: reportDetails,
          }),
        },
        `/events/${slug}`,
      );
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error ?? "Unable to submit the report.");
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
            <Loader2 className="animate-spin text-[color:var(--loombus-gold)]" size={18} /> Loading Event
          </span>
        </div>
      </main>
    );
  }

  if (!event) {
    return (
      <main className="min-h-screen bg-[color:var(--loombus-page-bg)] px-4 py-10 text-[color:var(--loombus-text)] sm:px-6">
        <div className="mx-auto max-w-3xl rounded-[1.75rem] border border-[color:var(--loombus-border)] bg-[color:var(--loombus-surface)] p-10 text-center shadow-xl shadow-black/10">
          <CalendarDays className="mx-auto text-[color:var(--loombus-gold)]" size={42} />
          <h1 className="mt-4 text-3xl font-semibold tracking-[-0.04em]">Event unavailable</h1>
          <p className="mt-3 text-[color:var(--loombus-text-muted)]">{notice || "This Event is not public."}</p>
          <Link href="/events" className={`${secondaryButtonClass} mt-6`}>
            <ArrowLeft size={16} /> Back to Events
          </Link>
        </div>
      </main>
    );
  }

  const address = [
    event.addressLine1,
    event.addressLine2,
    event.city,
    event.region,
    event.postalCode,
  ]
    .filter(Boolean)
    .join(", ");
  const organizerHref = event.businessSlug
    ? `/businesses/${event.businessSlug}`
    : event.organizerUsername
      ? `/u/${event.organizerUsername}`
      : "";

  return (
    <main className="min-h-screen bg-[color:var(--loombus-page-bg)] px-4 pb-20 pt-5 text-[color:var(--loombus-text)] sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[88rem]">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <Link href="/events" className="inline-flex items-center gap-2 text-sm font-semibold text-[color:var(--loombus-text-muted)] transition hover:text-[color:var(--loombus-gold)]">
            <ArrowLeft size={16} /> Back to Events
          </Link>
          <Link href="/calendar" className="inline-flex items-center gap-2 rounded-full border border-[color:var(--loombus-border)] bg-[color:var(--loombus-surface)] px-4 py-2 text-sm font-semibold transition hover:border-[color:var(--loombus-gold)]">
            Open Calendar <ArrowUpRight size={14} />
          </Link>
        </div>

        <header className="rounded-[1.75rem] border border-[color:var(--loombus-border)] bg-[color:var(--loombus-surface)] p-5 shadow-xl shadow-black/10 sm:p-7">
          <div className="flex flex-wrap items-center gap-2 text-xs font-semibold">
            <span className="rounded-full border border-[color:var(--loombus-border)] px-3 py-1.5">{event.category}</span>
            <span className="rounded-full border border-[color:var(--loombus-border)] px-3 py-1.5 capitalize">{event.format.replaceAll("_", " ")}</span>
            <span className="rounded-full bg-[color:var(--loombus-cream)] px-3 py-1.5 text-[color:var(--loombus-cream-contrast)] dark:bg-[color:var(--loombus-gold-soft)] dark:text-[color:var(--loombus-gold)]">{eventPriceLabel(event)}</span>
          </div>
          <h1 className="mt-4 max-w-5xl text-4xl font-semibold tracking-[-0.055em] sm:text-5xl">{event.title}</h1>
          <p className="mt-3 text-sm font-semibold text-[color:var(--loombus-text-muted)]">
            Organized by {event.businessName || event.organizerName}
          </p>
        </header>

        {notice ? (
          <div className="mt-5 rounded-2xl border border-[color:var(--loombus-border)] bg-[color:var(--loombus-surface)] p-4 text-sm shadow-sm" role="status">{notice}</div>
        ) : null}

        <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_21rem]">
          <section className="min-w-0 space-y-5">
            <article className="rounded-[1.75rem] border border-[color:var(--loombus-border)] bg-[color:var(--loombus-surface)] p-5 shadow-xl shadow-black/10 sm:p-6">
              <p className="text-xs font-bold uppercase tracking-[0.28em] text-[color:var(--loombus-gold)]">Event overview</p>
              <h2 className="mt-1 text-2xl font-semibold tracking-[-0.035em]">About this Event</h2>
              <p className="mt-4 whitespace-pre-wrap text-base leading-8 text-[color:var(--loombus-text-muted)]">{event.description}</p>

              <div className="mt-6 grid gap-3 md:grid-cols-3">
                <article className="rounded-2xl bg-[color:var(--loombus-page-bg)] p-4">
                  <CalendarDays className="text-[color:var(--loombus-gold)]" size={19} />
                  <strong className="mt-3 block text-sm">Date and time</strong>
                  <span className="mt-1 block text-sm leading-6 text-[color:var(--loombus-text-muted)]">{formatEventDateRange(event.startsAt, event.endsAt, event.timezone)}</span>
                  <small className="mt-2 block text-[color:var(--loombus-text-subtle)]">{event.timezone}</small>
                </article>
                <article className="rounded-2xl bg-[color:var(--loombus-page-bg)] p-4">
                  {event.format === "online" ? <Globe2 className="text-[color:var(--loombus-gold)]" size={19} /> : <MapPin className="text-[color:var(--loombus-gold)]" size={19} />}
                  <strong className="mt-3 block text-sm">Location</strong>
                  <span className="mt-1 block text-sm leading-6 text-[color:var(--loombus-text-muted)]">{eventLocationLabel(event)}</span>
                  {address ? <small className="mt-2 block text-[color:var(--loombus-text-subtle)]">{address}</small> : null}
                </article>
                <article className="rounded-2xl bg-[color:var(--loombus-page-bg)] p-4">
                  <Users className="text-[color:var(--loombus-gold)]" size={19} />
                  <strong className="mt-3 block text-sm">Member responses</strong>
                  <span className="mt-1 block text-sm text-[color:var(--loombus-text-muted)]">{event.goingCount} going · {event.interestedCount} interested</span>
                  {event.capacity ? <small className="mt-2 block text-[color:var(--loombus-text-subtle)]">Capacity {event.capacity.toLocaleString()}</small> : null}
                </article>
              </div>
            </article>

            {reportOpen ? (
              <section className="rounded-[1.75rem] border border-[color:var(--loombus-border)] bg-[color:var(--loombus-surface)] p-5 shadow-xl shadow-black/10 sm:p-6">
                <p className="text-xs font-bold uppercase tracking-[0.28em] text-[color:var(--loombus-gold)]">Accountability</p>
                <h2 className="mt-1 text-2xl font-semibold tracking-[-0.035em]">Report Event</h2>
                <div className="mt-5 grid gap-4">
                  <label>
                    <span className="mb-2 block text-sm font-semibold">Reason</span>
                    <select value={reportReason} onChange={(changeEvent) => setReportReason(changeEvent.target.value)} className={controlClass}>
                      <option>Safety concern</option>
                      <option>Fraud or misleading information</option>
                      <option>Prohibited activity</option>
                      <option>Harassment or discrimination</option>
                      <option>Other</option>
                    </select>
                  </label>
                  <label>
                    <span className="mb-2 block text-sm font-semibold">Details</span>
                    <textarea rows={5} maxLength={3000} value={reportDetails} onChange={(changeEvent) => setReportDetails(changeEvent.target.value)} className={controlClass} placeholder="Explain the concern with enough detail for administrator review" />
                  </label>
                  <div className="flex flex-wrap gap-3">
                    <button type="button" onClick={() => void submitReport()} disabled={working === "report" || reportDetails.trim().length < 10} className={primaryButtonClass}>
                      {working === "report" ? <Loader2 className="animate-spin" size={16} /> : <Flag size={16} />} Submit report
                    </button>
                    <button type="button" onClick={() => setReportOpen(false)} className={secondaryButtonClass}>Cancel</button>
                  </div>
                </div>
              </section>
            ) : null}
          </section>

          <aside className="space-y-5 xl:sticky xl:top-28 xl:self-start">
            <section className="rounded-[1.75rem] border border-[color:var(--loombus-border)] bg-[color:var(--loombus-surface)] p-5 shadow-2xl shadow-black/10">
              <p className="text-xs font-bold uppercase tracking-[0.3em]">Your response</p>
              <h2 className="mt-2 text-xl font-semibold">Will you be there?</h2>
              <div className="mt-4 grid gap-2">
                <button type="button" onClick={() => void respond(event.viewerResponse === "going" ? "none" : "going")} disabled={Boolean(working)} className={event.viewerResponse === "going" ? primaryButtonClass : secondaryButtonClass}>
                  <CheckCircle2 size={16} /> {event.viewerResponse === "going" ? "Going" : "Mark going"}
                </button>
                <button type="button" onClick={() => void respond(event.viewerResponse === "interested" ? "none" : "interested")} disabled={Boolean(working)} className={event.viewerResponse === "interested" ? primaryButtonClass : secondaryButtonClass}>
                  {event.viewerResponse === "interested" ? "Interested" : "Mark interested"}
                </button>
              </div>
              <div className="mt-4 grid gap-2 border-t border-[color:var(--loombus-border-muted)] pt-4">
                {event.registrationUrl ? (
                  <a href={event.registrationUrl} target="_blank" rel="noreferrer" className={secondaryButtonClass}>Registration details <ExternalLink size={15} /></a>
                ) : null}
                {event.onlineUrl ? (
                  <a href={event.onlineUrl} target="_blank" rel="noreferrer" className={secondaryButtonClass}>Online Event link <ExternalLink size={15} /></a>
                ) : null}
              </div>
            </section>

            <section className="rounded-[1.75rem] border border-[color:var(--loombus-border)] bg-[color:var(--loombus-surface)] p-5 shadow-2xl shadow-black/10">
              <p className="text-xs font-bold uppercase tracking-[0.3em]">Organizer</p>
              <div className="mt-4 flex items-start gap-3">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-[color:var(--loombus-cream)] text-[color:var(--loombus-gold)] dark:bg-[color:var(--loombus-gold-soft)]">
                  <Building2 size={18} />
                </span>
                <div className="min-w-0">
                  <strong>{event.businessName || event.organizerName}</strong>
                  {organizerHref ? (
                    <Link href={organizerHref} className="mt-2 inline-flex items-center gap-1 text-sm font-semibold text-[color:var(--loombus-gold)] hover:underline">Open attributable profile <ArrowUpRight size={13} /></Link>
                  ) : null}
                </div>
              </div>
            </section>

            <section className="rounded-[1.75rem] border border-[color:var(--loombus-border)] bg-[color:var(--loombus-surface)] p-5 shadow-2xl shadow-black/10">
              <div className="flex gap-3">
                <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-[color:var(--loombus-gold)]" />
                <div>
                  <h3 className="font-semibold">Event boundary</h3>
                  <p className="mt-2 text-sm leading-6 text-[color:var(--loombus-text-muted)]">Loombus does not guarantee organizers, venues, admission, payments, or Event outcomes. Review the organizer before sharing personal information or money.</p>
                  <button type="button" onClick={() => setReportOpen((current) => !current)} className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-[color:var(--loombus-gold)]">
                    <Flag size={15} /> Report this Event
                  </button>
                </div>
              </div>
            </section>
          </aside>
        </div>
      </div>
    </main>
  );
}
