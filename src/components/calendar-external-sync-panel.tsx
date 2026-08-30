"use client";

import Link from "next/link";
import {
  CalendarSync,
  Check,
  Copy,
  KeyRound,
  RefreshCw,
  RotateCw,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { scheduleAuthorizedFetch } from "@/lib/schedule-client";

type CredentialMetadata = {
  tokenHint: string;
  createdAt: string;
  updatedAt: string;
  revokedAt: string | null;
};

type SyncStatus = {
  canUseExternalCalendarSync: boolean;
  entitlementAvailable: boolean;
  configured: boolean;
  credential: CredentialMetadata | null;
};

const EMPTY_STATUS: SyncStatus = {
  canUseExternalCalendarSync: false,
  entitlementAvailable: true,
  configured: false,
  credential: null,
};

const focusClass =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--loombus-gold)] focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--loombus-page-bg)]";

function formatCredentialDate(value: string | null | undefined) {
  if (!value) return null;
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime())) return null;
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(parsed);
}

function feedUrlMatchesCredential(url: string, tokenHint: string | null | undefined) {
  if (!tokenHint) return false;
  try {
    const token = decodeURIComponent(new URL(url).pathname.split("/").filter(Boolean).at(-1) ?? "");
    return token.endsWith(tokenHint);
  } catch {
    return false;
  }
}

export default function CalendarExternalSyncPanel() {
  const [status, setStatus] = useState<SyncStatus>(EMPTY_STATUS);
  const [feedUrl, setFeedUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState<"generate" | "rotate" | "revoke" | null>(null);
  const [notice, setNotice] = useState("");
  const [copied, setCopied] = useState(false);

  const loadStatus = useCallback(async () => {
    setLoading(true);
    setNotice("");
    try {
      const response = await scheduleAuthorizedFetch(
        "/api/calendar/external-feed",
        { cache: "no-store" },
        "/calendar"
      );
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.error ?? "Unable to load calendar synchronization settings.");
      }
      const nextStatus: SyncStatus = {
        canUseExternalCalendarSync: Boolean(payload.canUseExternalCalendarSync),
        entitlementAvailable: payload.entitlementAvailable !== false,
        configured: Boolean(payload.configured),
        credential: payload.credential ?? null,
      };
      setStatus(nextStatus);
      setFeedUrl((current) =>
        current &&
        nextStatus.configured &&
        feedUrlMatchesCredential(current, nextStatus.credential?.tokenHint)
          ? current
          : null
      );
    } catch (error) {
      setNotice(
        error instanceof Error
          ? error.message
          : "Unable to load calendar synchronization settings."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadStatus();
  }, [loadStatus]);

  async function createOrRotate(action: "generate" | "rotate") {
    if (working) return;
    setWorking(action);
    setNotice("");
    setCopied(false);
    try {
      const response = await scheduleAuthorizedFetch(
        "/api/calendar/external-feed",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action }),
        },
        "/calendar"
      );
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.error ?? "Unable to create the private calendar link.");
      }
      if (typeof payload.feedUrl !== "string" || !payload.feedUrl) {
        throw new Error("The private calendar link could not be returned.");
      }
      setFeedUrl(payload.feedUrl);
      setStatus({
        canUseExternalCalendarSync: true,
        entitlementAvailable: true,
        configured: true,
        credential: payload.credential ?? null,
      });
      setNotice(
        action === "rotate"
          ? "A new private calendar link is active. Your previous link no longer works."
          : "Your private calendar subscription link is ready."
      );
    } catch (error) {
      setNotice(
        error instanceof Error ? error.message : "Unable to create the private calendar link."
      );
    } finally {
      setWorking(null);
    }
  }

  async function revoke() {
    if (working) return;
    setWorking("revoke");
    setNotice("");
    setCopied(false);
    try {
      const response = await scheduleAuthorizedFetch(
        "/api/calendar/external-feed",
        { method: "DELETE" },
        "/calendar"
      );
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.error ?? "Unable to revoke the private calendar link.");
      }
      setFeedUrl(null);
      setStatus((current) => ({
        ...current,
        configured: false,
        credential: payload.credential ?? current.credential,
      }));
      setNotice("The private calendar link has been revoked.");
    } catch (error) {
      setNotice(
        error instanceof Error ? error.message : "Unable to revoke the private calendar link."
      );
    } finally {
      setWorking(null);
    }
  }

  async function copyFeedUrl() {
    if (!feedUrl) return;
    setCopied(false);
    try {
      await navigator.clipboard.writeText(feedUrl);
      setCopied(true);
      setNotice("Private calendar link copied.");
    } catch {
      setNotice("Copy failed. Select the private link below and copy it manually.");
    }
  }

  const lastChanged = formatCredentialDate(status.credential?.updatedAt);

  const revokeButton = status.configured ? (
    <button
      type="button"
      onClick={() => void revoke()}
      disabled={working !== null}
      className={`inline-flex min-h-11 items-center justify-center gap-2 border-b border-[color:var(--loombus-border)] px-1 py-2 text-sm font-semibold transition hover:border-red-400 hover:text-red-500 disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transition-none ${focusClass}`}
    >
      <Trash2 aria-hidden="true" className="h-4 w-4" />
      {working === "revoke" ? "Revoking…" : "Revoke old link"}
    </button>
  ) : null;

  return (
    <section
      data-calendar-editorial="external-sync"
      className="bg-[color:var(--loombus-page-bg)] px-4 pt-7 text-[color:var(--loombus-text)] sm:px-6 lg:px-8"
      aria-labelledby="external-calendar-heading"
    >
      <div className="mx-auto max-w-[78rem] border-y border-[color:var(--loombus-border)] py-6">
        <header className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start">
          <div className="grid min-w-0 grid-cols-[auto_minmax(0,1fr)] gap-3">
            <CalendarSync aria-hidden="true" className="mt-1 h-5 w-5 text-[color:var(--loombus-gold)]" />
            <div className="min-w-0">
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-[color:var(--loombus-gold)]">
                Premium Pro
              </p>
              <h2 id="external-calendar-heading" className="mt-1 text-xl font-semibold tracking-[-0.03em]">
                External calendar subscription
              </h2>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-[color:var(--loombus-text-muted)]">
                Subscribe a compatible calendar app to a read-only copy of your Loombus schedule. Changes continue to be made in Loombus and flow outward through the private subscription link.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => void loadStatus()}
            disabled={loading || working !== null}
            className={`inline-flex min-h-11 items-center justify-center gap-2 border-b border-[color:var(--loombus-border)] px-1 py-2 text-xs font-semibold transition hover:border-[color:var(--loombus-gold)] hover:text-[color:var(--loombus-gold)] disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transition-none ${focusClass}`}
          >
            <RefreshCw
              aria-hidden="true"
              className={`h-3.5 w-3.5 ${loading ? "animate-spin motion-reduce:animate-none" : ""}`}
            />
            Refresh status
          </button>
        </header>

        <div className="mt-6 border-t border-[color:var(--loombus-border-muted)] pt-5">
          {loading ? (
            <div className="flex items-center gap-3 text-sm text-[color:var(--loombus-text-muted)]">
              <RefreshCw aria-hidden="true" className="h-4 w-4 animate-spin text-[color:var(--loombus-gold)] motion-reduce:animate-none" />
              Checking calendar synchronization access…
            </div>
          ) : !status.entitlementAvailable ? (
            <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
              <div>
                <p className="text-sm font-semibold">Calendar synchronization status is temporarily unavailable.</p>
                <p className="mt-1 text-sm leading-6 text-[color:var(--loombus-text-muted)]">
                  No subscription changes were made. Refresh the status before creating or rotating a private link.
                </p>
                {status.configured ? (
                  <p className="mt-2 text-xs font-semibold text-[color:var(--loombus-text-subtle)]">
                    An existing private link is still configured. You can revoke it without waiting for billing status to recover.
                  </p>
                ) : null}
              </div>
              {revokeButton}
            </div>
          ) : !status.canUseExternalCalendarSync ? (
            <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
              <div className="flex gap-3">
                <KeyRound aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-[color:var(--loombus-gold)]" />
                <div>
                  <p className="text-sm font-semibold">Premium Pro unlocks external calendar synchronization.</p>
                  <p className="mt-1 text-sm leading-6 text-[color:var(--loombus-text-muted)]">
                    Your Loombus Calendar remains available normally on Free and Premium.
                  </p>
                  {status.configured ? (
                    <p className="mt-2 text-xs font-semibold text-[color:var(--loombus-text-subtle)]">
                      Your previous subscription link is disabled while this account is not Premium Pro. You can revoke it permanently below.
                    </p>
                  ) : null}
                </div>
              </div>
              <div className="flex flex-wrap gap-x-5 gap-y-2">
                {revokeButton}
                <Link
                  href="/premium"
                  className={`inline-flex min-h-11 items-center justify-center border-b-2 border-[color:var(--loombus-gold)] px-1 py-2 text-sm font-semibold text-[color:var(--loombus-gold)] ${focusClass}`}
                >
                  View Premium Pro
                </Link>
              </div>
            </div>
          ) : (
            <div>
              <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
                <div className="flex gap-3">
                  <ShieldCheck aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-[color:var(--loombus-gold)]" />
                  <div>
                    <p className="text-sm font-semibold">
                      {status.configured ? "Private subscription link active" : "No private subscription link yet"}
                    </p>
                    <p className="mt-1 text-sm leading-6 text-[color:var(--loombus-text-muted)]">
                      {status.configured
                        ? feedUrl
                          ? "This link is shown only in this session. Copy it before leaving or refreshing the page."
                          : "For security, Loombus does not store the original private link. Rotate it to receive a new copy."
                        : "Generate a private link when you are ready to subscribe another calendar app."}
                    </p>
                    {status.credential?.tokenHint ? (
                      <p className="mt-2 text-xs font-semibold text-[color:var(--loombus-text-subtle)]">
                        Active link ending in …{status.credential.tokenHint}{lastChanged ? ` · Updated ${lastChanged}` : ""}
                      </p>
                    ) : null}
                  </div>
                </div>

                <div className="flex flex-wrap gap-x-5 gap-y-2">
                  {!status.configured ? (
                    <button
                      type="button"
                      onClick={() => void createOrRotate("generate")}
                      disabled={working !== null}
                      className={`inline-flex min-h-11 items-center justify-center gap-2 border-b-2 border-[color:var(--loombus-gold)] px-1 py-2 text-sm font-semibold text-[color:var(--loombus-gold)] transition disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transition-none ${focusClass}`}
                    >
                      <KeyRound aria-hidden="true" className="h-4 w-4" />
                      {working === "generate" ? "Generating…" : "Generate link"}
                    </button>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() => void createOrRotate("rotate")}
                        disabled={working !== null}
                        className={`inline-flex min-h-11 items-center justify-center gap-2 border-b border-[color:var(--loombus-border)] px-1 py-2 text-sm font-semibold transition hover:border-[color:var(--loombus-gold)] hover:text-[color:var(--loombus-gold)] disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transition-none ${focusClass}`}
                      >
                        <RotateCw aria-hidden="true" className="h-4 w-4" />
                        {working === "rotate" ? "Rotating…" : "Rotate link"}
                      </button>
                      <button
                        type="button"
                        onClick={() => void revoke()}
                        disabled={working !== null}
                        className={`inline-flex min-h-11 items-center justify-center gap-2 border-b border-[color:var(--loombus-border)] px-1 py-2 text-sm font-semibold transition hover:border-red-400 hover:text-red-500 disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transition-none ${focusClass}`}
                      >
                        <Trash2 aria-hidden="true" className="h-4 w-4" />
                        {working === "revoke" ? "Revoking…" : "Revoke"}
                      </button>
                    </>
                  )}
                </div>
              </div>

              {feedUrl ? (
                <div className="mt-5 border-t border-[color:var(--loombus-gold)]/35 pt-5">
                  <div className="flex items-start gap-3">
                    <KeyRound aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-[color:var(--loombus-gold)]" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold">Copy this private link now</p>
                      <p className="mt-1 text-xs leading-5 text-[color:var(--loombus-text-muted)]">
                        Treat it like a password. Anyone who has this link can read the limited calendar feed until you rotate or revoke it.
                      </p>
                      <div className="mt-3 grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
                        <label className="block min-w-0">
                          <span className="sr-only">Private calendar subscription link</span>
                          <input
                            type="text"
                            readOnly
                            value={feedUrl}
                            onFocus={(event) => event.currentTarget.select()}
                            aria-label="Private calendar subscription link"
                            className={`min-h-11 w-full border-b border-[color:var(--loombus-border)] bg-transparent px-0 py-2 font-mono text-xs text-[color:var(--loombus-text)] outline-none focus:border-[color:var(--loombus-gold)] ${focusClass}`}
                          />
                        </label>
                        <button
                          type="button"
                          onClick={() => void copyFeedUrl()}
                          className={`inline-flex min-h-11 items-center justify-center gap-2 border-b-2 border-[color:var(--loombus-gold)] px-1 py-2 text-sm font-semibold text-[color:var(--loombus-gold)] transition motion-reduce:transition-none ${focusClass}`}
                        >
                          {copied ? <Check aria-hidden="true" className="h-4 w-4" /> : <Copy aria-hidden="true" className="h-4 w-4" />}
                          {copied ? "Copied" : "Copy link"}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          )}

          {notice ? (
            <p className="mt-4 border-t border-[color:var(--loombus-border-muted)] pt-4 text-sm leading-6 text-[color:var(--loombus-text-muted)]" role="status">
              {notice}
            </p>
          ) : null}
        </div>
      </div>
    </section>
  );
}
