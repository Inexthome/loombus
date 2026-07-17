"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import {
  ArrowLeft,
  Building2,
  CalendarDays,
  CheckCircle2,
  ExternalLink,
  Flag,
  Globe2,
  MapPin,
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
        `/events/${slug}`
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
        `/events/${slug}`
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
      <main className="min-h-screen bg-[var(--loombus-page-bg)] px-4 py-10 text-[var(--loombus-text)]">
        <div className="mx-auto max-w-5xl rounded-[2rem] border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-10 text-center text-[var(--loombus-text-muted)]">
          Loading event…
        </div>
      </main>
    );
  }

  if (!event) {
    return (
      <main className="min-h-screen bg-[var(--loombus-page-bg)] px-4 py-10 text-[var(--loombus-text)]">
        <div className="mx-auto max-w-3xl rounded-[2rem] border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-10 text-center">
          <CalendarDays className="mx-auto text-[var(--loombus-text-subtle)]" size={42} />
          <h1 className="mt-4 text-3xl font-semibold">Event unavailable</h1>
          <p className="mt-3 text-[var(--loombus-text-muted)]">{notice || "This event is not public."}</p>
          <Link href="/events" className="mt-6 inline-flex rounded-full border border-[var(--loombus-border)] px-5 py-3 font-semibold">
            Back to Events
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

  return (
    <main className="min-h-screen bg-[var(--loombus-page-bg)] px-4 py-8 text-[var(--loombus-text)] sm:px-6">
      <div className="mx-auto max-w-6xl space-y-5">
        <Link href="/events" className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--loombus-text-muted)]">
          <ArrowLeft size={17} /> Back to Events
        </Link>

        <header className="rounded-[2rem] border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-6 sm:p-9">
          <div className="flex flex-wrap items-center gap-2 text-xs font-semibold">
            <span className="rounded-full border border-[var(--loombus-border)] bg-[var(--loombus-surface-muted)] px-3 py-1.5">
              {event.category}
            </span>
            <span className="rounded-full border border-[var(--loombus-border)] px-3 py-1.5 capitalize">
              {event.format.replaceAll("_", " ")}
            </span>
            <span className="rounded-full border border-[var(--loombus-border)] px-3 py-1.5">
              {eventPriceLabel(event)}
            </span>
          </div>
          <h1 className="mt-5 max-w-4xl text-4xl font-semibold tracking-tight sm:text-6xl">
            {event.title}
          </h1>
          <p className="mt-5 max-w-3xl whitespace-pre-wrap text-base leading-8 text-[var(--loombus-text-muted)]">
            {event.description}
          </p>

          <div className="mt-7 grid gap-4 md:grid-cols-3">
            <article className="rounded-2xl border border-[var(--loombus-border)] bg-[var(--loombus-page-bg)] p-4">
              <CalendarDays size={19} className="text-[var(--loombus-text-subtle)]" />
              <strong className="mt-3 block text-sm">Date and time</strong>
              <span className="mt-1 block text-sm leading-6 text-[var(--loombus-text-muted)]">
                {formatEventDateRange(event.startsAt, event.endsAt, event.timezone)}
              </span>
              <small className="mt-2 block text-[var(--loombus-text-subtle)]">{event.timezone}</small>
            </article>
            <article className="rounded-2xl border border-[var(--loombus-border)] bg-[var(--loombus-page-bg)] p-4">
              {event.format === "online" ? (
                <Globe2 size={19} className="text-[var(--loombus-text-subtle)]" />
              ) : (
                <MapPin size={19} className="text-[var(--loombus-text-subtle)]" />
              )}
              <strong className="mt-3 block text-sm">Location</strong>
              <span className="mt-1 block text-sm leading-6 text-[var(--loombus-text-muted)]">
                {eventLocationLabel(event)}
              </span>
              {address ? <small className="mt-2 block text-[var(--loombus-text-subtle)]">{address}</small> : null}
            </article>
            <article className="rounded-2xl border border-[var(--loombus-border)] bg-[var(--loombus-page-bg)] p-4">
              <Users size={19} className="text-[var(--loombus-text-subtle)]" />
              <strong className="mt-3 block text-sm">Responses</strong>
              <span className="mt-1 block text-sm text-[var(--loombus-text-muted)]">
                {event.goingCount} going · {event.interestedCount} interested
              </span>
              {event.capacity ? (
                <small className="mt-2 block text-[var(--loombus-text-subtle)]">
                  Capacity {event.capacity.toLocaleString()}
                </small>
              ) : null}
            </article>
          </div>
        </header>

        {notice ? (
          <div className="rounded-2xl border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-4 text-sm" role="status">
            {notice}
          </div>
        ) : null}

        <div className="grid gap-5 lg:grid-cols-[1fr_340px]">
          <section className="rounded-[1.6rem] border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-6">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--loombus-text-subtle)]">
              Event actions
            </p>
            <h2 className="mt-2 text-2xl font-semibold">Will you be there?</h2>
            <div className="mt-5 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => void respond(event.viewerResponse === "going" ? "none" : "going")}
                disabled={Boolean(working)}
                className={`inline-flex items-center gap-2 rounded-full px-5 py-3 text-sm font-semibold ${
                  event.viewerResponse === "going"
                    ? "bg-[var(--loombus-primary-bg)] text-[var(--loombus-primary-text)]"
                    : "border border-[var(--loombus-border)]"
                }`}
              >
                <CheckCircle2 size={17} /> Going
              </button>
              <button
                type="button"
                onClick={() => void respond(event.viewerResponse === "interested" ? "none" : "interested")}
                disabled={Boolean(working)}
                className={`rounded-full px-5 py-3 text-sm font-semibold ${
                  event.viewerResponse === "interested"
                    ? "bg-[var(--loombus-primary-bg)] text-[var(--loombus-primary-text)]"
                    : "border border-[var(--loombus-border)]"
                }`}
              >
                Interested
              </button>
              {event.registrationUrl ? (
                <a
                  href={event.registrationUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 rounded-full border border-[var(--loombus-border)] px-5 py-3 text-sm font-semibold"
                >
                  Registration details <ExternalLink size={16} />
                </a>
              ) : null}
              {event.onlineUrl ? (
                <a
                  href={event.onlineUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 rounded-full border border-[var(--loombus-border)] px-5 py-3 text-sm font-semibold"
                >
                  Online event link <ExternalLink size={16} />
                </a>
              ) : null}
            </div>
          </section>

          <aside className="space-y-5">
            <section className="rounded-[1.6rem] border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-5">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--loombus-text-subtle)]">
                Organizer
              </p>
              <div className="mt-4 flex items-start gap-3">
                <Building2 className="mt-0.5 text-[var(--loombus-text-subtle)]" size={20} />
                <div>
                  <strong>{event.businessName || event.organizerName}</strong>
                  {event.businessSlug ? (
                    <Link href={`/businesses/${event.businessSlug}`} className="mt-1 block text-sm underline">
                      Open business profile
                    </Link>
                  ) : event.organizerUsername ? (
                    <Link href={`/u/${event.organizerUsername}`} className="mt-1 block text-sm underline">
                      Open member profile
                    </Link>
                  ) : null}
                </div>
              </div>
            </section>

            <section className="rounded-[1.6rem] border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-5">
              <p className="text-sm leading-6 text-[var(--loombus-text-muted)]">
                Loombus does not guarantee organizers, venues, admission, payments, or event outcomes. Review the organizer and use good judgment before sharing personal information or money.
              </p>
              <button
                type="button"
                onClick={() => setReportOpen((current) => !current)}
                className="mt-4 inline-flex items-center gap-2 text-sm font-semibold"
              >
                <Flag size={16} /> Report this event
              </button>
            </section>
          </aside>
        </div>

        {reportOpen ? (
          <section className="rounded-[1.6rem] border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-6">
            <h2 className="text-xl font-semibold">Report event</h2>
            <div className="mt-4 grid gap-4">
              <label>
                <span className="mb-2 block text-sm font-semibold">Reason</span>
                <select
                  value={reportReason}
                  onChange={(event) => setReportReason(event.target.value)}
                  className="w-full rounded-2xl border border-[var(--loombus-border)] bg-[var(--loombus-page-bg)] px-4 py-3"
                >
                  <option>Safety concern</option>
                  <option>Fraud or misleading information</option>
                  <option>Prohibited activity</option>
                  <option>Harassment or discrimination</option>
                  <option>Other</option>
                </select>
              </label>
              <label>
                <span className="mb-2 block text-sm font-semibold">Details</span>
                <textarea
                  rows={5}
                  maxLength={3000}
                  value={reportDetails}
                  onChange={(event) => setReportDetails(event.target.value)}
                  className="w-full rounded-2xl border border-[var(--loombus-border)] bg-[var(--loombus-page-bg)] px-4 py-3"
                  placeholder="Explain the concern with enough detail for administrator review"
                />
              </label>
              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => void submitReport()}
                  disabled={working === "report" || reportDetails.trim().length < 10}
                  className="rounded-full bg-[var(--loombus-primary-bg)] px-5 py-3 text-sm font-semibold text-[var(--loombus-primary-text)] disabled:opacity-50"
                >
                  Submit report
                </button>
                <button
                  type="button"
                  onClick={() => setReportOpen(false)}
                  className="rounded-full border border-[var(--loombus-border)] px-5 py-3 text-sm font-semibold"
                >
                  Cancel
                </button>
              </div>
            </div>
          </section>
        ) : null}
      </div>
    </main>
  );
}
