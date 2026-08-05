"use client";

import Link from "next/link";
import { CalendarClock, Loader2, PackageCheck } from "lucide-react";
import { type FormEvent, useMemo, useState } from "react";
import { scheduleAuthorizedFetch } from "@/lib/schedule-client";

type Props = {
  listingId: string;
  listingTitle: string;
  listingSlug: string;
  pickupAvailable: boolean;
  businessBacked: boolean;
};

const inputClass =
  "w-full rounded-2xl border border-[color:var(--loombus-border)] bg-[color:var(--loombus-page-bg)] px-4 py-3 text-[color:var(--loombus-text)] outline-none transition placeholder:text-[color:var(--loombus-text-subtle)] focus:border-[color:var(--loombus-gold)] focus:ring-4 focus:ring-[color:var(--loombus-gold-soft)]";

export default function MarketplacePickupScheduler({
  listingId,
  listingTitle,
  listingSlug,
  pickupAvailable,
  businessBacked,
}: Props) {
  const [open, setOpen] = useState(false);
  const [requestedStart, setRequestedStart] = useState("");
  const [note, setNote] = useState("");
  const [working, setWorking] = useState(false);
  const [notice, setNotice] = useState("");
  const [created, setCreated] = useState(false);

  const minimum = useMemo(() => {
    const value = new Date(Date.now() + 30 * 60_000);
    value.setMinutes(value.getMinutes() - value.getTimezoneOffset());
    return value.toISOString().slice(0, 16);
  }, []);

  if (!pickupAvailable || !businessBacked) return null;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (working) return;
    setWorking(true);
    setNotice("");
    try {
      const response = await scheduleAuthorizedFetch(
        "/api/marketplace/pickup",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            listingId,
            requestedStart: new Date(requestedStart).toISOString(),
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
            note,
          }),
        },
        `/marketplace/${listingSlug}`
      );
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error ?? "Unable to send the pickup request.");
      setCreated(true);
      setNotice("Pickup request sent. The seller can accept, decline, or propose another time.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Unable to send the pickup request.");
    } finally {
      setWorking(false);
    }
  }

  return (
    <section className="mx-auto mt-6 max-w-[86rem] px-4 sm:px-6 lg:px-8">
      <div className="rounded-[1.75rem] border border-[color:var(--loombus-gold)] bg-[color:var(--loombus-cream)] p-5 text-[color:var(--loombus-cream-contrast)] shadow-xl shadow-black/10 dark:bg-[color:var(--loombus-gold-soft)] dark:text-[color:var(--loombus-text)] sm:p-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex gap-4">
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-[color:var(--loombus-surface)] text-[color:var(--loombus-gold)]">
              <PackageCheck size={22} />
            </span>
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.24em] text-[color:var(--loombus-gold)]">
                Marketplace pickup
              </p>
              <h2 className="mt-1 text-2xl font-semibold tracking-[-0.035em]">
                Schedule pickup for {listingTitle}
              </h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 opacity-80">
                Propose a time through Loombus. The seller must explicitly accept before the pickup is confirmed.
              </p>
            </div>
          </div>
          {!created ? (
            <button
              type="button"
              onClick={() => setOpen((value) => !value)}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-[color:var(--loombus-gold)] px-5 text-sm font-semibold text-[color:var(--loombus-gold-contrast)] transition hover:opacity-90"
            >
              <CalendarClock size={17} /> Schedule pickup
            </button>
          ) : (
            <Link
              href="/appointments"
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-[color:var(--loombus-gold)] px-5 text-sm font-semibold text-[color:var(--loombus-gold-contrast)] transition hover:opacity-90"
            >
              <CalendarClock size={17} /> View appointments
            </Link>
          )}
        </div>

        {open && !created ? (
          <form onSubmit={submit} className="mt-6 grid gap-4 border-t border-black/10 pt-6 dark:border-white/10">
            <label className="grid gap-2 text-sm font-semibold">
              Proposed pickup time
              <input
                type="datetime-local"
                required
                min={minimum}
                value={requestedStart}
                onChange={(event) => setRequestedStart(event.target.value)}
                className={inputClass}
              />
            </label>
            <label className="grid gap-2 text-sm font-semibold">
              Note to seller
              <textarea
                value={note}
                onChange={(event) => setNote(event.target.value)}
                rows={3}
                maxLength={3000}
                placeholder="Mention timing flexibility or pickup details without sharing sensitive information."
                className={inputClass}
              />
            </label>
            <div className="flex flex-wrap gap-3">
              <button
                type="submit"
                disabled={working || !requestedStart}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-[color:var(--loombus-gold)] px-5 text-sm font-semibold text-[color:var(--loombus-gold-contrast)] disabled:opacity-50"
              >
                {working ? <Loader2 className="animate-spin" size={17} /> : <CalendarClock size={17} />}
                Send pickup request
              </button>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="inline-flex min-h-11 items-center justify-center rounded-full border border-[color:var(--loombus-border)] bg-[color:var(--loombus-surface)] px-5 text-sm font-semibold"
              >
                Cancel
              </button>
            </div>
          </form>
        ) : null}

        {notice ? (
          <p className="mt-5 rounded-2xl border border-black/10 bg-[color:var(--loombus-surface)] p-4 text-sm dark:border-white/10" role="status">
            {notice}
          </p>
        ) : null}
      </div>
    </section>
  );
}
