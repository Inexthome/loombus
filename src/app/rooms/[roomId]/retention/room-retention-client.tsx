"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArchiveRestore,
  ArrowLeft,
  FileClock,
  Loader2,
  LockKeyhole,
  RefreshCw,
  ShieldAlert,
} from "lucide-react";
import { supabase } from "@/lib/supabase/client";

type RetentionHold = {
  id: string;
  target_type: string;
  target_id?: string | null;
  reason: string;
  status: string;
  created_at?: string | null;
};

type RetentionRun = {
  id: string;
  mode: string;
  status: string;
  retention_days: number;
  cutoff_at: string;
  candidate_count: number;
  staged_count: number;
  excluded_count: number;
  created_at?: string | null;
};

type RetentionData = {
  room: { id: string; name: string; roomType: string };
  settings: { retention_days?: number | null; retain_audit_logs?: boolean };
  holds: RetentionHold[];
  runs: RetentionRun[];
  permanentDeletionEnabled: boolean;
  error?: string;
};

type RunResult = {
  error?: string;
  candidateCount?: number;
  stagedCount?: number;
  excludedCount?: number;
};

function dateLabel(value?: string | null) {
  if (!value) return "Not available";
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toLocaleString() : value;
}

export default function RoomRetentionClient() {
  const params = useParams();
  const rawRoomId = params?.roomId;
  const roomId = useMemo(
    () => (Array.isArray(rawRoomId) ? rawRoomId[0] : rawRoomId ?? ""),
    [rawRoomId]
  );
  const [data, setData] = useState<RetentionData | null>(null);
  const [targetType, setTargetType] = useState("room");
  const [targetId, setTargetId] = useState("");
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const accessToken = useCallback(async () => {
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;
    if (!token) {
      window.location.href = `/login?next=${encodeURIComponent(`/rooms/${roomId}/retention`)}`;
      return null;
    }
    return token;
  }, [roomId]);

  const load = useCallback(async () => {
    if (!roomId) return;
    setLoading(true);
    setError("");
    try {
      const token = await accessToken();
      if (!token) return;
      const response = await fetch(`/api/rooms/${encodeURIComponent(roomId)}/retention`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      const result = (await response.json().catch(() => ({}))) as RetentionData;
      if (!response.ok) throw new Error(result.error || "Retention could not load.");
      setData(result);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Retention could not load.");
    } finally {
      setLoading(false);
    }
  }, [accessToken, roomId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function act(action: string, payload: Record<string, unknown> = {}) {
    if (working) return;
    setWorking(action);
    setError("");
    setMessage("");
    try {
      const token = await accessToken();
      if (!token) return;
      const response = await fetch(`/api/rooms/${encodeURIComponent(roomId)}/retention`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ action, ...payload }),
      });
      const result = (await response.json().catch(() => ({}))) as RunResult;
      if (!response.ok) throw new Error(result.error || "Retention action failed.");
      if (action === "preview") {
        setMessage(
          `Preview complete: ${result.candidateCount ?? 0} eligible and ${result.excludedCount ?? 0} excluded.`
        );
      } else if (action === "stage") {
        setMessage(
          `Staging complete: ${result.stagedCount ?? 0} records staged and ${result.excludedCount ?? 0} excluded.`
        );
      } else {
        setMessage("Retention controls updated.");
      }
      setReason("");
      setTargetId("");
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Retention action failed.");
    } finally {
      setWorking("");
    }
  }

  if (loading) {
    return (
      <main className="rooms-live-page">
        <section className="rooms-live-state-card">
          <Loader2 aria-hidden="true" className="is-spinning" />
          <h1>Loading Room retention…</h1>
          <p>Verifying ownership and retention records.</p>
        </section>
      </main>
    );
  }

  if (!data) {
    return (
      <main className="rooms-live-page">
        <section className="rooms-live-state-card">
          <h1>Retention unavailable</h1>
          <p>{error || "This Room could not be loaded."}</p>
        </section>
      </main>
    );
  }

  const configured =
    typeof data.settings.retention_days === "number" && data.settings.retention_days >= 30;
  const activeHolds = data.holds.filter((hold) => hold.status === "active");

  return (
    <main className="rooms-live-page">
      <div className="rooms-live-shell">
        <Link href={`/rooms/${roomId}/governance`} className="rooms-live-back-link">
          <ArrowLeft aria-hidden="true" />
          Back to Governance
        </Link>

        <header className="room-workspace-hero">
          <div>
            <p className="rooms-live-eyebrow">Retention enforcement</p>
            <h1>{data.room.name}</h1>
            <p>Preview and stage cleanup candidates before any destructive action is enabled.</p>
          </div>
          <button type="button" className="rooms-live-secondary-action" onClick={() => void load()}>
            <RefreshCw aria-hidden="true" />
            Refresh
          </button>
        </header>

        {error ? <div className="rooms-live-notice is-error">{error}</div> : null}
        {message ? <div className="rooms-live-notice">{message}</div> : null}

        <section className="room-workspace-panel">
          <div className="room-workspace-section-heading">
            <div>
              <p className="rooms-live-eyebrow">Current policy</p>
              <h2>Retention boundary</h2>
              <p>
                {configured
                  ? `Records older than ${data.settings.retention_days} days may be evaluated.`
                  : "Set a retention period in Governance before running a preview."}
              </p>
            </div>
            <FileClock aria-hidden="true" />
          </div>
          <div className="room-workspace-overview-grid">
            <article className="rooms-live-state-card">
              <h3>Audit logs</h3>
              <p>{data.settings.retain_audit_logs === false ? "Not retained" : "Always retained"}</p>
            </article>
            <article className="rooms-live-state-card">
              <h3>Permanent deletion</h3>
              <p>{data.permanentDeletionEnabled ? "Enabled" : "Disabled during verification"}</p>
            </article>
            <article className="rooms-live-state-card">
              <h3>Active holds</h3>
              <p>{activeHolds.length}</p>
            </article>
          </div>
          <div className="rooms-live-actions-row">
            <button
              type="button"
              className="rooms-live-secondary-action"
              disabled={!configured || Boolean(working)}
              onClick={() => void act("preview")}
            >
              {working === "preview" ? <Loader2 aria-hidden="true" className="is-spinning" /> : <FileClock aria-hidden="true" />}
              Preview cleanup
            </button>
            <button
              type="button"
              className="rooms-live-primary-action"
              disabled={!configured || Boolean(working)}
              onClick={() => void act("stage")}
            >
              {working === "stage" ? <Loader2 aria-hidden="true" className="is-spinning" /> : <ArchiveRestore aria-hidden="true" />}
              Stage eligible records
            </button>
          </div>
        </section>

        <section className="room-workspace-panel">
          <div className="room-workspace-section-heading">
            <div>
              <p className="rooms-live-eyebrow">Legal and operational holds</p>
              <h2>Protect records from cleanup</h2>
              <p>A Room-wide hold excludes every record. Targeted holds protect one record.</p>
            </div>
            <LockKeyhole aria-hidden="true" />
          </div>
          <div className="room-workspace-form-grid">
            <label>
              Hold type
              <select value={targetType} onChange={(event) => setTargetType(event.target.value)}>
                <option value="room">Entire Room</option>
                <option value="room_post">Discussion</option>
                <option value="room_post_reply">Reply</option>
                <option value="room_module_record">Module record</option>
                <option value="room_event">Event</option>
                <option value="room_announcement">Announcement</option>
                <option value="room_attachment">Attachment</option>
              </select>
            </label>
            {targetType !== "room" ? (
              <label>
                Record id
                <input
                  value={targetId}
                  onChange={(event) => setTargetId(event.target.value)}
                  placeholder="UUID"
                />
              </label>
            ) : null}
            <label className="room-workspace-form-wide">
              Reason
              <textarea
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                placeholder="Why must this content be retained?"
                maxLength={1000}
              />
            </label>
          </div>
          <button
            type="button"
            className="rooms-live-primary-action"
            disabled={!reason.trim() || (targetType !== "room" && !targetId.trim()) || Boolean(working)}
            onClick={() =>
              void act("create_hold", {
                targetType,
                targetId: targetType === "room" ? null : targetId.trim(),
                reason: reason.trim(),
              })
            }
          >
            <ShieldAlert aria-hidden="true" />
            Create hold
          </button>

          {activeHolds.length ? (
            <div className="room-workspace-overview-grid">
              {activeHolds.map((hold) => (
                <article key={hold.id} className="rooms-live-state-card">
                  <h3>{hold.target_type === "room" ? "Entire Room" : hold.target_type}</h3>
                  <p>{hold.reason}</p>
                  {hold.target_id ? <small>{hold.target_id}</small> : null}
                  <button
                    type="button"
                    className="rooms-live-secondary-action"
                    disabled={Boolean(working)}
                    onClick={() => void act("release_hold", { holdId: hold.id })}
                  >
                    Release hold
                  </button>
                </article>
              ))}
            </div>
          ) : (
            <p>No active retention holds.</p>
          )}
        </section>

        <section className="room-workspace-panel">
          <div className="room-workspace-section-heading">
            <div>
              <p className="rooms-live-eyebrow">Run history</p>
              <h2>Retention evaluations</h2>
            </div>
            <FileClock aria-hidden="true" />
          </div>
          {data.runs.length ? (
            <div className="room-workspace-overview-grid">
              {data.runs.map((run) => (
                <article key={run.id} className="rooms-live-state-card">
                  <h3>{run.mode === "stage" ? "Staging run" : "Preview run"}</h3>
                  <p>
                    {run.candidate_count} eligible · {run.staged_count} staged · {run.excluded_count} excluded
                  </p>
                  <small>
                    Cutoff {dateLabel(run.cutoff_at)} · {run.retention_days} days · {run.status}
                  </small>
                </article>
              ))}
            </div>
          ) : (
            <p>No retention runs yet.</p>
          )}
        </section>
      </div>
    </main>
  );
}
