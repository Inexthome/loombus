"use client";

import Link from "next/link";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Clock3,
  FileWarning,
  Loader2,
  RefreshCw,
  Search,
  ShieldCheck,
  UserRound,
  XCircle,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase/client";

type Profile = {
  id: string;
  full_name: string | null;
  username: string | null;
  avatar_url: string | null;
  account_status: string | null;
  enforcement_reason: string | null;
  ageSafety: {
    age_band: string | null;
    age_state: string | null;
    teen_safety_mode: boolean | null;
    guardian_required: boolean | null;
    turns_18_at: string | null;
  } | null;
};

type Correction = {
  id: string;
  user_id: string;
  current_date_of_birth: string | null;
  requested_date_of_birth: string;
  member_reason: string | null;
  status: string;
  reviewed_by: string | null;
  reviewed_at: string | null;
  decision_note: string | null;
  created_at: string;
};

type UnderageReport = {
  id: string;
  reporter_id: string;
  reported_user_id: string;
  details: string | null;
  status: string;
  reviewed_by: string | null;
  reviewed_at: string | null;
  resolution_note: string | null;
  created_at: string;
};

type ReviewItem = {
  id: string;
  user_id: string;
  source_type: string;
  source_id: string | null;
  reason_code: string;
  status: string;
  reviewed_by: string | null;
  reviewed_at: string | null;
  resolution_note: string | null;
  created_at: string;
};

type Payload = {
  currentAdminId: string;
  generatedAt: string;
  corrections: Correction[];
  underageReports: UnderageReport[];
  reviewItems: ReviewItem[];
  profiles: Record<string, Profile>;
  error?: string;
};

type QueueKind = "correction" | "underage" | "review";
type QueueItem = {
  kind: QueueKind;
  id: string;
  subjectUserId: string;
  status: string;
  createdAt: string;
  title: string;
  summary: string;
  source: Correction | UnderageReport | ReviewItem;
};

async function token() {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? "";
}

function formatDate(value: string | null | undefined) {
  if (!value) return "Not recorded";
  const date = new Date(value.length === 10 ? `${value}T00:00:00` : value);
  if (!Number.isFinite(date.getTime())) return "Not recorded";
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: value.length === 10 ? undefined : "numeric",
    minute: value.length === 10 ? undefined : "2-digit",
  });
}

function label(value: string | null | undefined) {
  return String(value ?? "unknown")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function profileName(profile: Profile | undefined) {
  return profile?.full_name?.trim() || profile?.username?.trim() || "Loombus member";
}

export default function AdminTeenSafetyClient() {
  const [payload, setPayload] = useState<Payload | null>(null);
  const [selectedId, setSelectedId] = useState("");
  const [kindFilter, setKindFilter] = useState<"all" | QueueKind>("all");
  const [statusFilter, setStatusFilter] = useState("open");
  const [query, setQuery] = useState("");
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [working, setWorking] = useState("");
  const [message, setMessage] = useState("");

  const load = useCallback(async (refresh = false) => {
    refresh ? setRefreshing(true) : setLoading(true);
    setMessage("");
    const accessToken = await token();
    if (!accessToken) {
      window.location.href = "/login?next=%2Fadmin%2Fteen-safety";
      return;
    }
    const response = await fetch("/api/admin/teen-safety", {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: "no-store",
    });
    const next = (await response.json().catch(() => ({}))) as Payload;
    if (!response.ok) setMessage(next.error ?? "Unable to load Teen Safety review.");
    else setPayload(next);
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const queue = useMemo<QueueItem[]>(() => {
    if (!payload) return [];
    return [
      ...payload.corrections.map((row) => ({
        kind: "correction" as const,
        id: row.id,
        subjectUserId: row.user_id,
        status: row.status,
        createdAt: row.created_at,
        title: "Age correction",
        summary: `${row.current_date_of_birth ?? "Unknown"} to ${row.requested_date_of_birth}`,
        source: row,
      })),
      ...payload.underageReports.map((row) => ({
        kind: "underage" as const,
        id: row.id,
        subjectUserId: row.reported_user_id,
        status: row.status,
        createdAt: row.created_at,
        title: "Possible underage account",
        summary: row.details ?? "No report context",
        source: row,
      })),
      ...payload.reviewItems.map((row) => ({
        kind: "review" as const,
        id: row.id,
        subjectUserId: row.user_id,
        status: row.status,
        createdAt: row.created_at,
        title: label(row.reason_code),
        summary: `${label(row.source_type)} migration review`,
        source: row,
      })),
    ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [payload]);

  const filtered = useMemo(() => {
    const clean = query.trim().toLowerCase();
    const openStatuses = new Set(["pending", "reviewing", "new", "open"]);
    return queue.filter((item) => {
      if (kindFilter !== "all" && item.kind !== kindFilter) return false;
      if (statusFilter === "open" && !openStatuses.has(item.status)) return false;
      if (statusFilter === "closed" && openStatuses.has(item.status)) return false;
      if (!clean) return true;
      const profile = payload?.profiles[item.subjectUserId];
      return [
        item.title,
        item.summary,
        item.status,
        profile?.full_name,
        profile?.username,
        item.subjectUserId,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(clean);
    });
  }, [kindFilter, payload, query, queue, statusFilter]);

  useEffect(() => {
    if (!filtered.length) {
      setSelectedId("");
      return;
    }
    if (!selectedId || !filtered.some((item) => item.id === selectedId)) {
      setSelectedId(filtered[0].id);
    }
  }, [filtered, selectedId]);

  const selected = queue.find((item) => item.id === selectedId) ?? null;
  const subject = selected ? payload?.profiles[selected.subjectUserId] : undefined;

  const counts = useMemo(() => {
    const open = new Set(["pending", "reviewing", "new", "open"]);
    return {
      total: queue.length,
      open: queue.filter((item) => open.has(item.status)).length,
      corrections: queue.filter((item) => item.kind === "correction").length,
      underage: queue.filter((item) => item.kind === "underage").length,
      migration: queue.filter((item) => item.kind === "review").length,
    };
  }, [queue]);

  async function act(action: string) {
    if (!selected || working) return;
    if (
      [
        "approve_correction",
        "deny_correction",
        "confirm_underage",
        "dismiss_underage",
        "resolve_review_item",
        "dismiss_review_item",
      ].includes(action) &&
      note.trim().length < 5
    ) {
      setMessage("Add a decision note before completing this review.");
      return;
    }

    const confirmed =
      !["approve_correction", "confirm_underage"].includes(action) ||
      window.confirm(
        action === "confirm_underage"
          ? "Confirm that this account is below the Loombus minimum age? Authenticated platform access will be deactivated."
          : "Approve this date-of-birth correction? Age protections and account eligibility will be recalculated immediately.",
      );
    if (!confirmed) return;

    setWorking(action);
    setMessage("");
    const accessToken = await token();
    if (!accessToken) return;
    const response = await fetch("/api/admin/teen-safety", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        action,
        recordId: selected.id,
        note: note.trim(),
      }),
    });
    const result = await response.json().catch(() => ({}));
    setMessage(response.ok ? "Teen Safety review updated." : result.error ?? "Unable to update this review.");
    if (response.ok) {
      setNote("");
      await load(true);
    }
    setWorking("");
  }

  if (loading) {
    return (
      <main className="admin-teen-page">
        <div className="admin-teen-state"><Loader2 className="admin-teen-spin" /> Loading Teen Safety operations...</div>
      </main>
    );
  }

  return (
    <main className="admin-teen-page">
      <section className="admin-teen-shell">
        <header className="admin-teen-hero">
          <div>
            <Link href="/admin"><ArrowLeft aria-hidden="true" size={16} /> Back to Admin Operations</Link>
            <p>Trust and Safety</p>
            <h1>Teen Safety Operations</h1>
            <span>Review age corrections, possible underage accounts, and legacy records that require human verification.</span>
          </div>
          <button type="button" onClick={() => void load(true)} disabled={refreshing}>
            <RefreshCw className={refreshing ? "admin-teen-spin" : ""} aria-hidden="true" size={17} />
            {refreshing ? "Refreshing" : "Refresh"}
          </button>
        </header>

        <section className="admin-teen-metrics">
          <article><ShieldCheck /><strong>{counts.open}</strong><span>Open reviews</span></article>
          <article><Clock3 /><strong>{counts.corrections}</strong><span>Age corrections</span></article>
          <article><AlertTriangle /><strong>{counts.underage}</strong><span>Underage reports</span></article>
          <article><FileWarning /><strong>{counts.migration}</strong><span>Migration reviews</span></article>
        </section>

        {message ? <div className="admin-teen-message" role="status">{message}</div> : null}

        <section className="admin-teen-toolbar">
          <label><Search aria-hidden="true" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search member, status, reason, or record" /></label>
          <select value={kindFilter} onChange={(event) => setKindFilter(event.target.value as typeof kindFilter)}>
            <option value="all">All review types</option>
            <option value="correction">Age corrections</option>
            <option value="underage">Underage reports</option>
            <option value="review">Migration reviews</option>
          </select>
          <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
            <option value="open">Open</option>
            <option value="closed">Closed</option>
            <option value="all">All statuses</option>
          </select>
        </section>

        <section className="admin-teen-workspace">
          <div className="admin-teen-queue">
            {filtered.length ? filtered.map((item) => {
              const profile = payload?.profiles[item.subjectUserId];
              return (
                <button
                  type="button"
                  key={`${item.kind}:${item.id}`}
                  data-selected={selectedId === item.id ? "true" : "false"}
                  onClick={() => { setSelectedId(item.id); setNote(""); }}
                >
                  <span className={`admin-teen-kind is-${item.kind}`}>{label(item.kind)}</span>
                  <strong>{profileName(profile)}</strong>
                  <small>{item.title}</small>
                  <em>{label(item.status)} · {formatDate(item.createdAt)}</em>
                </button>
              );
            }) : <div className="admin-teen-empty">No Teen Safety records match these filters.</div>}
          </div>

          <div className="admin-teen-detail">
            {!selected ? <div className="admin-teen-empty">Select a review item.</div> : (
              <>
                <div className="admin-teen-detail-heading">
                  <div>
                    <span>{label(selected.kind)} · {label(selected.status)}</span>
                    <h2>{profileName(subject)}</h2>
                    <p>{subject?.username ? `@${subject.username}` : selected.subjectUserId}</p>
                  </div>
                  <UserRound aria-hidden="true" />
                </div>

                <section className="admin-teen-context">
                  <div><span>Account</span><strong>{label(subject?.account_status)}</strong></div>
                  <div><span>Age band</span><strong>{label(subject?.ageSafety?.age_band)}</strong></div>
                  <div><span>Age state</span><strong>{label(subject?.ageSafety?.age_state)}</strong></div>
                  <div><span>Turns 18</span><strong>{formatDate(subject?.ageSafety?.turns_18_at)}</strong></div>
                </section>

                {selected.kind === "correction" ? (() => {
                  const row = selected.source as Correction;
                  return <section className="admin-teen-evidence"><h3>Correction request</h3><p><strong>Current:</strong> {formatDate(row.current_date_of_birth)}</p><p><strong>Requested:</strong> {formatDate(row.requested_date_of_birth)}</p><p>{row.member_reason || "No member explanation."}</p></section>;
                })() : null}

                {selected.kind === "underage" ? (() => {
                  const row = selected.source as UnderageReport;
                  const reporter = payload?.profiles[row.reporter_id];
                  return <section className="admin-teen-evidence"><h3>Report context</h3><p>{row.details || "No report context."}</p><small>Reporter: {profileName(reporter)} · confidential</small></section>;
                })() : null}

                {selected.kind === "review" ? (() => {
                  const row = selected.source as ReviewItem;
                  return <section className="admin-teen-evidence"><h3>Migration review</h3><p><strong>{label(row.reason_code)}</strong></p><p>{label(row.source_type)} · {row.source_id ?? "Source unavailable"}</p></section>;
                })() : null}

                <label className="admin-teen-note">
                  <span>Internal decision note</span>
                  <textarea rows={5} maxLength={4000} value={note} onChange={(event) => setNote(event.target.value)} placeholder="Record evidence, context, and the reason for the outcome." />
                </label>

                <div className="admin-teen-actions">
                  {selected.kind === "correction" && ["pending", "reviewing"].includes(selected.status) ? (
                    <>
                      <button onClick={() => void act("start_correction")} disabled={Boolean(working)}><Clock3 /> Start review</button>
                      <button className="is-positive" onClick={() => void act("approve_correction")} disabled={Boolean(working)}><CheckCircle2 /> Approve</button>
                      <button className="is-negative" onClick={() => void act("deny_correction")} disabled={Boolean(working)}><XCircle /> Deny</button>
                    </>
                  ) : null}
                  {selected.kind === "underage" && ["new", "reviewing"].includes(selected.status) ? (
                    <>
                      <button onClick={() => void act("start_underage")} disabled={Boolean(working)}><Clock3 /> Start review</button>
                      <button className="is-negative" onClick={() => void act("confirm_underage")} disabled={Boolean(working)}><AlertTriangle /> Confirm underage</button>
                      <button className="is-positive" onClick={() => void act("dismiss_underage")} disabled={Boolean(working)}><CheckCircle2 /> Not confirmed</button>
                    </>
                  ) : null}
                  {selected.kind === "review" && ["open", "reviewing"].includes(selected.status) ? (
                    <>
                      <button className="is-positive" onClick={() => void act("resolve_review_item")} disabled={Boolean(working)}><CheckCircle2 /> Resolve</button>
                      <button onClick={() => void act("dismiss_review_item")} disabled={Boolean(working)}><XCircle /> Dismiss</button>
                    </>
                  ) : null}
                </div>
              </>
            )}
          </div>
        </section>
      </section>
    </main>
  );
}
