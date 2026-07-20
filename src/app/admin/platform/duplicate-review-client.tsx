"use client";

import Link from "next/link";
import {
  CheckCircle2,
  CopyCheck,
  FileSearch,
  Fingerprint,
  RefreshCw,
  ScanSearch,
  ShieldCheck,
  XCircle,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import {
  AdminMetricCard,
  AdminPlatformShell,
  AdminPlatformState,
  AdminQueueSection,
  AdminStatusBadge,
} from "./admin-platform-foundation";

type Source = {
  mediaId: string;
  ownerName: string;
  sourceTypeLabel: string;
  title: string;
  sourceStatus: string | null;
  href: string | null;
  fileName: string;
  mimeType: string;
  mediaKind: string;
  byteSize: number | null;
  scannedAt: string | null;
};

type Signal = {
  id: string;
  confidence: number;
  crossAccount: boolean;
  status: "open" | "confirmed" | "dismissed";
  reviewedAt: string | null;
  reviewNote: string | null;
  createdAt: string;
  left: Source;
  right: Source;
};

type ReviewData = {
  isAdmin: boolean;
  metrics: {
    pendingScans: number;
    scanErrors: number;
    readyMedia: number;
    openSignals: number;
    confirmedSignals: number;
    dismissedSignals: number;
  };
  signals: Signal[];
  boundaries: {
    automaticRemoval: boolean;
    automaticMerge: boolean;
    accountEnforcementMutation: boolean;
    sourceLifecycleMutation: boolean;
    privateRoomMediaCataloged: boolean;
    rawStoragePathsExposed: boolean;
  };
};

type Access = "checking" | "allowed" | "denied" | "error";
const button = "inline-flex min-h-10 items-center justify-center gap-2 rounded-full border border-[var(--loombus-border)] px-4 py-2 text-sm font-semibold transition hover:border-[var(--loombus-gold)] disabled:cursor-not-allowed disabled:opacity-50";
const primary = "inline-flex min-h-10 items-center justify-center gap-2 rounded-full bg-[var(--loombus-gold)] px-4 py-2 text-sm font-semibold text-[var(--loombus-gold-contrast)] transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50";

class RequestError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

async function request<T>(token: string, init?: RequestInit): Promise<T> {
  const response = await fetch("/api/admin/platform/duplicates", {
    ...init,
    cache: "no-store",
    headers: {
      Authorization: `Bearer ${token}`,
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...(init?.headers ?? {}),
    },
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new RequestError(
      typeof payload.error === "string"
        ? payload.error
        : "Media Duplicate Review could not complete this request.",
      response.status,
    );
  }
  return payload as T;
}

function date(value: string | null) {
  if (!value) return "Not recorded";
  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime())
    ? new Intl.DateTimeFormat(undefined, {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(parsed)
    : "Not recorded";
}

function bytes(value: number | null) {
  if (!value || value <= 0) return "Size unavailable";
  if (value < 1024) return `${value} B`;
  if (value < 1024 ** 2) return `${(value / 1024).toFixed(1)} KB`;
  if (value < 1024 ** 3) return `${(value / 1024 ** 2).toFixed(1)} MB`;
  return `${(value / 1024 ** 3).toFixed(2)} GB`;
}

function tone(status: Signal["status"]) {
  return status === "open"
    ? ("attention" as const)
    : status === "confirmed"
      ? ("unavailable" as const)
      : ("ready" as const);
}

function statusLabel(status: Signal["status"]) {
  return status === "open"
    ? "Needs review"
    : status === "confirmed"
      ? "Confirmed match"
      : "Dismissed";
}

function SourceCard({ source, label }: { source: Source; label: string }) {
  return (
    <article className="rounded-2xl border border-[var(--loombus-border)] bg-[var(--loombus-page-bg)] p-4">
      <p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--loombus-gold)]">
        {label}
      </p>
      <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold">{source.title}</h3>
          <p className="mt-1 text-sm text-[var(--loombus-text-muted)]">
            {source.sourceTypeLabel} by {source.ownerName}
          </p>
        </div>
        <span className="rounded-full border border-[var(--loombus-border)] px-2.5 py-1 text-xs font-semibold capitalize text-[var(--loombus-text-muted)]">
          {source.sourceStatus?.replaceAll("_", " ") || "Stored upload"}
        </span>
      </div>
      <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
        <div><dt className="text-[var(--loombus-text-subtle)]">File</dt><dd className="mt-1 break-words font-medium">{source.fileName}</dd></div>
        <div><dt className="text-[var(--loombus-text-subtle)]">Media</dt><dd className="mt-1 font-medium capitalize">{source.mediaKind} · {bytes(source.byteSize)}</dd></div>
        <div><dt className="text-[var(--loombus-text-subtle)]">Type</dt><dd className="mt-1 break-words font-medium">{source.mimeType}</dd></div>
        <div><dt className="text-[var(--loombus-text-subtle)]">Scanned</dt><dd className="mt-1 font-medium">{date(source.scannedAt)}</dd></div>
      </dl>
      {source.href ? (
        <Link href={source.href} className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-[var(--loombus-gold)]">
          Open source record <FileSearch size={15} aria-hidden="true" />
        </Link>
      ) : (
        <p className="mt-4 text-xs text-[var(--loombus-text-subtle)]">No source route is exposed for this upload.</p>
      )}
    </article>
  );
}

export default function DuplicateReviewClient() {
  const [access, setAccess] = useState<Access>("checking");
  const [token, setToken] = useState("");
  const [data, setData] = useState<ReviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState("");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [notes, setNotes] = useState<Record<string, string>>({});

  const load = useCallback(async (accessToken: string) => {
    setLoading(true);
    setError("");
    try {
      const result = await request<ReviewData>(accessToken);
      if (!result.isAdmin) {
        setAccess("denied");
        setData(null);
      } else {
        setAccess("allowed");
        setData(result);
      }
    } catch (caught) {
      if (caught instanceof RequestError && caught.status === 403) {
        setAccess("denied");
      } else {
        setAccess("error");
        setError(caught instanceof Error ? caught.message : "Media Duplicate Review could not load.");
      }
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    void supabase.auth.getSession().then(async ({ data: sessionData, error: sessionError }) => {
      if (!active) return;
      if (sessionError) {
        setAccess("error");
        setError("Administrator access could not be verified.");
        setLoading(false);
        return;
      }
      const accessToken = sessionData.session?.access_token ?? "";
      if (!accessToken) {
        window.location.replace(`/login?next=${encodeURIComponent("/admin/platform/duplicates")}`);
        return;
      }
      setToken(accessToken);
      await load(accessToken);
    });
    return () => { active = false; };
  }, [load]);

  async function act(key: string, payload: Record<string, unknown>, success: string) {
    if (!token || working) return;
    setWorking(key);
    setNotice("");
    setError("");
    try {
      const result = await request<{ operation?: Record<string, unknown> }>(token, {
        method: "POST",
        body: JSON.stringify(payload),
      });
      if (key === "scan") {
        const operation = result.operation ?? {};
        setNotice(`Media scan completed: ${Number(operation.scanned ?? 0)} scanned, ${Number(operation.signalsCreated ?? 0)} new signals, ${Number(operation.failed ?? 0)} failed.`);
      } else {
        setNotice(success);
      }
      await load(token);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The duplicate operation could not be completed.");
    } finally {
      setWorking("");
    }
  }

  const open = useMemo(() => data?.signals.filter((signal) => signal.status === "open") ?? [], [data]);
  const reviewed = useMemo(() => data?.signals.filter((signal) => signal.status !== "open") ?? [], [data]);

  if (access === "checking") {
    return <AdminPlatformState title="Loading Media Duplicate Review" description="Loombus is verifying your administrator role and loading protected fingerprint diagnostics." loading />;
  }
  if (access === "denied") {
    return (
      <AdminPlatformState title="Administrator access is required" description="This workspace is restricted to Loombus administrators. No media fingerprints or duplicate signals were displayed." tone="warning">
        <Link href="/discussions" className={primary}>Return to Loombus</Link>
      </AdminPlatformState>
    );
  }
  if (access === "error" || !data) {
    return (
      <AdminPlatformState title="Media Duplicate Review could not load" description={error || "Refresh the page and try again."} tone="danger">
        <button type="button" onClick={() => window.location.reload()} className={primary}>Reload module</button>
        <Link href="/admin/platform" className={button}>Platform overview</Link>
      </AdminPlatformState>
    );
  }

  const metrics = data.metrics;
  const backlog = metrics.pendingScans + metrics.scanErrors;

  return (
    <AdminPlatformShell
      active="overview"
      eyebrow="Administrator module"
      title="Media Duplicate Review"
      description="Catalog public-platform media, compare complete stored bytes, and review cross-account matches without opening private Room content or changing source records."
      notice={notice}
      error={error}
      actions={
        <>
          <button type="button" onClick={() => void load(token)} disabled={loading || Boolean(working)} className={button}>
            <RefreshCw size={16} className={loading ? "animate-spin" : ""} aria-hidden="true" /> Refresh
          </button>
          <button type="button" onClick={() => void act("scan", { action: "scan_pending", limit: 5 }, "")} disabled={!backlog || Boolean(working)} className={primary}>
            <ScanSearch size={16} className={working === "scan" ? "animate-pulse" : ""} aria-hidden="true" /> Scan pending media
          </button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <AdminMetricCard label="Open signals" value={metrics.openSignals} description="Cross-account exact-content matches awaiting review." icon={<CopyCheck size={20} aria-hidden="true" />} featured />
        <AdminMetricCard label="Pending scans" value={metrics.pendingScans} description="Cataloged objects waiting for a protected SHA-256 scan." icon={<ScanSearch size={20} aria-hidden="true" />} />
        <AdminMetricCard label="Fingerprint ready" value={metrics.readyMedia} description="Images, videos, and PDFs with completed fingerprints." icon={<Fingerprint size={20} aria-hidden="true" />} />
        <AdminMetricCard label="Scan errors" value={metrics.scanErrors} description="Objects that could not be downloaded or fingerprinted." icon={<ShieldCheck size={20} aria-hidden="true" />} />
      </div>

      <div className="mt-5">
        <AdminQueueSection eyebrow="Review queue" title="Cross-account exact matches" description="A signal means the complete stored object is identical. It is a review aid, not an automatic fraud finding, removal, merge, or account action." action={<AdminStatusBadge status={open.length ? "attention" : "ready"}>{open.length ? `${open.length} open` : "Queue clear"}</AdminStatusBadge>}>
          {open.length ? (
            <div className="grid gap-4">
              {open.map((signal) => (
                <article key={signal.id} className="rounded-[1.55rem] border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-5 shadow-sm sm:p-6">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--loombus-gold)]">Exact stored-byte match</p>
                      <h2 className="mt-2 text-xl font-semibold">Two accounts uploaded identical media</h2>
                      <p className="mt-2 text-sm leading-6 text-[var(--loombus-text-muted)]">SHA-256 matched the complete stored object. Loombus has not removed either source or changed either account.</p>
                    </div>
                    <AdminStatusBadge status="attention">Needs review</AdminStatusBadge>
                  </div>
                  <div className="mt-5 grid gap-4 xl:grid-cols-2">
                    <SourceCard source={signal.left} label="First source" />
                    <SourceCard source={signal.right} label="Matching source" />
                  </div>
                  <p className="mt-4 text-xs text-[var(--loombus-text-subtle)]">Confidence: {Math.round(signal.confidence * 100)}% · Created: {date(signal.createdAt)} · Cross-account: {signal.crossAccount ? "Yes" : "No"}</p>
                  <div className="mt-5 border-t border-[var(--loombus-border)] pt-5">
                    <textarea value={notes[signal.id] ?? ""} onChange={(event) => setNotes((current) => ({ ...current, [signal.id]: event.target.value }))} maxLength={1000} rows={3} placeholder="Optional administrator note" className="w-full rounded-2xl border border-[var(--loombus-border)] bg-[var(--loombus-page-bg)] px-4 py-3 text-sm outline-none focus:border-[var(--loombus-gold)]" />
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button type="button" disabled={Boolean(working)} onClick={() => void act(signal.id, { action: "review_signal", signalId: signal.id, decision: "confirmed", note: notes[signal.id] ?? "" }, "Media match confirmed and recorded in the administrator audit log.")} className={primary}><CheckCircle2 size={16} aria-hidden="true" /> Confirm match</button>
                      <button type="button" disabled={Boolean(working)} onClick={() => void act(signal.id, { action: "review_signal", signalId: signal.id, decision: "dismissed", note: notes[signal.id] ?? "" }, "Media signal dismissed and recorded in the administrator audit log.")} className={button}><XCircle size={16} aria-hidden="true" /> Dismiss signal</button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-[var(--loombus-border)] bg-[var(--loombus-page-bg)] p-8 text-center">
              <CheckCircle2 className="mx-auto text-emerald-600 dark:text-emerald-300" size={30} aria-hidden="true" />
              <h3 className="mt-3 text-lg font-semibold">No exact cross-account matches need review</h3>
              <p className="mt-2 text-sm text-[var(--loombus-text-muted)]">Scan pending media when the fingerprint backlog is above zero.</p>
            </div>
          )}
        </AdminQueueSection>
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-2">
        <AdminQueueSection eyebrow="Resolved history" title="Reviewed signals" description="Confirmed and dismissed decisions remain visible as protected operational history.">
          {reviewed.length ? reviewed.slice(0, 25).map((signal) => (
            <article key={signal.id} className="mb-3 rounded-2xl border border-[var(--loombus-border)] bg-[var(--loombus-page-bg)] p-4 last:mb-0">
              <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-semibold">{signal.left.title} and {signal.right.title}</p><p className="mt-1 text-sm text-[var(--loombus-text-muted)]">{signal.left.ownerName} · {signal.right.ownerName}</p></div><AdminStatusBadge status={tone(signal.status)}>{statusLabel(signal.status)}</AdminStatusBadge></div>
              <p className="mt-3 text-xs text-[var(--loombus-text-subtle)]">Reviewed {date(signal.reviewedAt)}{signal.reviewNote ? ` · ${signal.reviewNote}` : ""}</p>
            </article>
          )) : <p className="rounded-2xl border border-dashed border-[var(--loombus-border)] bg-[var(--loombus-page-bg)] p-6 text-sm text-[var(--loombus-text-muted)]">No media duplicate decisions have been recorded yet.</p>}
        </AdminQueueSection>

        <AdminQueueSection eyebrow="Operational boundaries" title="What this module cannot do" description="The review queue is intentionally diagnostic and auditable.">
          <div className="grid gap-3 text-sm">
            {[
              ["Automatic removal", data.boundaries.automaticRemoval],
              ["Automatic merge", data.boundaries.automaticMerge],
              ["Account enforcement changes", data.boundaries.accountEnforcementMutation],
              ["Source lifecycle changes", data.boundaries.sourceLifecycleMutation],
              ["Private Room media cataloged", data.boundaries.privateRoomMediaCataloged],
              ["Raw storage paths exposed", data.boundaries.rawStoragePathsExposed],
            ].map(([label, enabled]) => (
              <div key={String(label)} className="flex items-center justify-between gap-4 rounded-2xl bg-[var(--loombus-page-bg)] p-4"><span>{String(label)}</span><strong className={enabled ? "text-amber-600" : "text-emerald-600 dark:text-emerald-300"}>{enabled ? "Enabled" : "Disabled"}</strong></div>
            ))}
          </div>
          <p className="mt-4 rounded-2xl border border-[var(--loombus-border)] p-4 text-sm leading-6 text-[var(--loombus-text-muted)]">Exact fingerprinting covers Discussion attachments, Marketplace photos, Request attachments, and Service attachments. Private Room posts, files, calendars, resources, and member workspaces are excluded.</p>
        </AdminQueueSection>
      </div>
    </AdminPlatformShell>
  );
}
