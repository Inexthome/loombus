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
      setStatus({
        canUseExternalCalendarSync: Boolean(payload.canUseExternalCalendarSync),
        entitlementAvailable: payload.entitlementAvailable !== false,
        configured: Boolean(payload.configured),
        credential: payload.credential ?? null,
      });
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

  return (
    <section className="bg-[color:var(--loombus-page-bg)] px-4 pt-5 text-[color:var(--loombus-text)] sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[88rem] rounded-[1.75rem] border border-[color:var(--loombus-border)] bg-[color:var(--loombus-surface)] p-5 shadow-xl shadow-black/10 sm:p-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex min-w-0 gap-4">
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-[#CBAB5B]/12 text-[#CBAB5B]">
              <CalendarSync aria-hidden="true" className="h-6 w-6" />
            </span>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-xl font-semibold tracking-[-0.03em]">External calendar subscription</h2>
                <span className="rounded-full border border-[#CBAB5B]/35 bg-[#CBAB5B]/10 px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.16em] text-[#CBAB5B]">
                  Premium Pro
                </span>
              </div>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-[color:var(--loombus-text-muted)]">
                Subscribe a compatible calendar app to a read-only copy of your Loombus schedule. Changes continue to be made in Loombus and flow outward through the private subscription link.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => void loadStatus()}
            disabled={loading || working !== null}
            className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-full border border-[color:var(--loombus-border)] px-4 text-xs font-semibold transition hover:border-[#CBAB5B] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <RefreshCw aria-hidden="true" className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            Refresh status
          </button>
        </div>

        <div className="mt-5 border-t border-[color:var(--loombus-border-muted)] pt-5">
          {loading ? (
            <div className="flex items-center gap-3 text-sm text-[color:var(--loombus-text-muted)]">
              <RefreshCw aria-hidden="true" className="h-4 w-4 animate-spin text-[#CBAB5B]" />
              Checking calendar synchronization access…
            </div>
          ) : !status.entitlementAvailable ? (
            <div className="rounded-2xl bg-[color:var(--loombus-page-bg)] p-4">
              <p className="text-sm font-semibold">Calendar synchronization status is temporarily unavailable.</p>
              <p className="mt-1 text-sm leading-6 text-[color:var(--loombus-text-muted)]">
                No subscription changes were made. Refresh the status before creating a private link.
              </p>
            </div>
          ) : !status.canUseExternalCalendarSync ? (
            <div className="flex flex-col gap-4 rounded-2xl bg-[color:var(--loombus-page-bg)] p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex gap-3">
                <KeyRound aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-[#CBAB5B]" />
                <div>
                  <p className="text-sm font-semibold">Premium Pro unlocks external calendar synchronization.</p>
                  <p className="mt-1 text-sm leading-6 text-[color:var(--loombus-text-muted)]">
                    Your Loombus Calendar remains available normally on Free and Premium.
                  </p>
                </div>
              </div>
              <Link
                href="/premium"
                className="inline-flex h-10 shrink-0 items-center justify-center rounded-full bg-[#CBAB5B] px-5 text-sm font-semibold text-black transition hover:opacity-90"
              >
                View Premium Pro
              </Link>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex flex-col gap-4 rounded-2xl bg-[color:var(--loombus-page-bg)] p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex gap-3">
                  <ShieldCheck aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-[#CBAB5B]" />
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

                <div className="flex shrink-0 flex-wrap gap-2">
                  {!status.configured ? (
                    <button
                      type="button"
                      onClick={() => void createOrRotate("generate")}
                      disabled={working !== null}
                      className="inline-flex h-10 items-center justify-center gap-2 rounded-full bg-[#CBAB5B] px-5 text-sm font-semibold text-black transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
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
                        className="inline-flex h-10 items-center justify-center gap-2 rounded-full border border-[color:var(--loombus-border)] px-4 text-sm font-semibold transition hover:border-[#CBAB5B] disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <RotateCw aria-hidden="true" className="h-4 w-4" />
                        {working === "rotate" ? "Rotating…" : "Rotate link"}
                      </button>
                      <button
                        type="button"
                        onClick={() => void revoke()}
                        disabled={working !== null}
                        className="inline-flex h-10 items-center justify-center gap-2 rounded-full border border-[color:var(--loombus-border)] px-4 text-sm font-semibold transition hover:border-red-400 hover:text-red-500 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <Trash2 aria-hidden="true" className="h-4 w-4" />
                        {working === "revoke" ? "Revoking…" : "Revoke"}
                      </button>
                    </>
                  )}
                </div>
              </div>

              {feedUrl ? (
                <div className="rounded-2xl border border-[#CBAB5B]/30 bg-[#CBAB5B]/8 p-4">
                  <div className="flex items-start gap-3">
                    <KeyRound aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-[#CBAB5B]" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold">Copy this private link now</p>
                      <p className="mt-1 text-xs leading-5 text-[color:var(--loombus-text-muted)]">
                        Treat it like a password. Anyone who has this link can read the limited calendar feed until you rotate or revoke it.
                      </p>
                      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                        <input
                          type="text"
                          readOnly
                          value={feedUrl}
                          onFocus={(event) => event.currentTarget.select()}
                          aria-label="Private calendar subscription link"
                          className="h-11 min-w-0 flex-1 rounded-xl border border-[color:var(--loombus-border)] bg-[color:var(--loombus-surface)] px-3 font-mono text-xs text-[color:var(--loombus-text)] outline-none focus:border-[#CBAB5B]"
                        />
                        <button
                          type="button"
                          onClick={() => void copyFeedUrl()}
                          className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-[#CBAB5B] px-4 text-sm font-semibold text-black transition hover:opacity-90"
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
            <p className="mt-4 text-sm leading-6 text-[color:var(--loombus-text-muted)]" role="status">
              {notice}
            </p>
          ) : null}
        </div>
      </div>
    </section>
  );
}
