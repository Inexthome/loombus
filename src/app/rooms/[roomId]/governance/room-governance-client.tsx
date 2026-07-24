"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, CheckCircle2, Crown, Loader2, RefreshCw, ShieldCheck, Users } from "lucide-react";
import { supabase } from "@/lib/supabase/client";

type Member = {
  id: string;
  userId: string;
  role: string;
  status: string;
  profile?: { full_name?: string | null; username?: string | null } | null;
};

type Policy = {
  id: string;
  title: string;
  body: string;
  version: number;
  status: string;
  acknowledgmentCount: number;
  acknowledgedByCurrentUser: boolean;
};

type GovernanceData = {
  room: { id: string; name: string; ownerId?: string };
  access: { role: string | null; canManage: boolean; canModerate?: boolean; isOwner: boolean };
  members?: Member[];
  settings?: { retention_days?: number | null };
  pendingTransfer?: Record<string, unknown> | null;
  moderation?: Array<Record<string, unknown>>;
  policies: Policy[];
  audit?: Array<Record<string, unknown>>;
  error?: string;
};

function memberName(member: Member) {
  return member.profile?.full_name || member.profile?.username || member.userId.slice(0, 8);
}

export default function RoomGovernanceClient() {
  const params = useParams();
  const rawRoomId = params?.roomId;
  const roomId = useMemo(
    () => (Array.isArray(rawRoomId) ? rawRoomId[0] : rawRoomId ?? ""),
    [rawRoomId]
  );
  const [data, setData] = useState<GovernanceData | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [operation, setOperation] = useState("set_role");
  const [role, setRole] = useState("member");
  const [days, setDays] = useState("7");
  const [transferUserId, setTransferUserId] = useState("");
  const [policyTitle, setPolicyTitle] = useState("");
  const [policyBody, setPolicyBody] = useState("");
  const [retentionDays, setRetentionDays] = useState("");
  const [moderationReason, setModerationReason] = useState("");
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const accessToken = useCallback(async () => {
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;
    if (!token) {
      window.location.href = `/login?next=${encodeURIComponent(`/rooms/${roomId}/governance`)}`;
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
      const response = await fetch(`/api/rooms/${encodeURIComponent(roomId)}/governance`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      const result = (await response.json().catch(() => ({}))) as GovernanceData;
      if (!response.ok) throw new Error(result.error || "Governance could not load.");
      setData(result);
      setRetentionDays(result.settings?.retention_days == null ? "" : String(result.settings.retention_days));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Governance could not load.");
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
      const response = await fetch(`/api/rooms/${encodeURIComponent(roomId)}/governance`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ action, ...payload }),
      });
      const result = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) throw new Error(result.error || "Governance action failed.");
      setMessage("Room governance updated.");
      setSelected([]);
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Governance action failed.");
    } finally {
      setWorking("");
    }
  }

  if (loading) {
    return (
      <main className="rooms-live-page">
        <section className="rooms-live-state-card">
          <Loader2 aria-hidden="true" className="is-spinning" />
          <h1>Loading Room governance…</h1>
          <p>Verifying Room permissions and governance records.</p>
        </section>
      </main>
    );
  }

  if (!data) {
    return (
      <main className="rooms-live-page">
        <section className="rooms-live-state-card">
          <h1>Governance unavailable</h1>
          <p>{error || "This Room could not be loaded."}</p>
        </section>
      </main>
    );
  }

  return (
    <main className="rooms-live-page">
      <div className="rooms-live-shell">
        <Link href={`/rooms/${roomId}`} className="rooms-live-back-link">
          <ArrowLeft aria-hidden="true" />
          Back to Room
        </Link>

        <header className="room-workspace-hero">
          <div>
            <p className="rooms-live-eyebrow">Room governance</p>
            <h1>{data.room.name}</h1>
            <p>Ownership, roles, moderation, retention, policies, and audit history.</p>
          </div>
          <button type="button" className="rooms-live-secondary-action" onClick={() => void load()}>
            <RefreshCw aria-hidden="true" />
            Refresh
          </button>
        </header>

        {error ? <div className="rooms-live-notice is-error">{error}</div> : null}
        {message ? <div className="rooms-live-notice">{message}</div> : null}

        {data.pendingTransfer && data.pendingTransfer.id ? (
          <section className="room-workspace-panel">
            <div className="room-workspace-section-heading">
              <div>
                <p className="rooms-live-eyebrow">Ownership invitation</p>
                <h2>Accept Room ownership</h2>
                <p>Accepting makes you the owner and moves the current owner to administrator.</p>
              </div>
              <Crown aria-hidden="true" />
            </div>
            <button
              type="button"
              className="rooms-live-primary-action"
              onClick={() => void act("accept_transfer", { transferId: data.pendingTransfer?.id })}
            >
              Accept ownership
            </button>
          </section>
        ) : null}

        <section className="room-workspace-panel">
          <div className="room-workspace-section-heading">
            <div>
              <p className="rooms-live-eyebrow">Room policies</p>
              <h2>Published policies</h2>
            </div>
            <ShieldCheck aria-hidden="true" />
          </div>
          {data.policies.length ? (
            <div className="room-workspace-overview-grid">
              {data.policies.map((policy) => (
                <article key={policy.id} className="rooms-live-state-card">
                  <h3>{policy.title}</h3>
                  <p>{policy.body}</p>
                  <small>Version {policy.version} · {policy.acknowledgmentCount} acknowledgments</small>
                  {!policy.acknowledgedByCurrentUser && policy.status === "published" ? (
                    <button
                      type="button"
                      className="rooms-live-primary-action"
                      onClick={() => void act("acknowledge_policy", { policyId: policy.id })}
                    >
                      <CheckCircle2 aria-hidden="true" />
                      Acknowledge
                    </button>
                  ) : null}
                </article>
              ))}
            </div>
          ) : (
            <p>No published Room policies.</p>
          )}
        </section>

        {data.access.canManage ? (
          <>
            <section className="room-workspace-panel">
              <div className="room-workspace-section-heading">
                <div>
                  <p className="rooms-live-eyebrow">Member administration</p>
                  <h2>Roles and access</h2>
                </div>
                <Users aria-hidden="true" />
              </div>
              <div className="room-workspace-overview-grid">
                {(data.members ?? []).map((member) => (
                  <label key={member.id} className="rooms-live-state-card">
                    <input
                      type="checkbox"
                      checked={selected.includes(member.id)}
                      disabled={member.userId === data.room.ownerId}
                      onChange={(event) =>
                        setSelected((current) =>
                          event.target.checked
                            ? [...current, member.id]
                            : current.filter((id) => id !== member.id)
                        )
                      }
                    />
                    <strong>{memberName(member)}</strong>
                    <span>{member.role} · {member.status}</span>
                  </label>
                ))}
              </div>
              <div className="rooms-live-access-form">
                <label>
                  Action
                  <select value={operation} onChange={(event) => setOperation(event.target.value)}>
                    <option value="set_role">Set role</option>
                    <option value="suspend">Suspend</option>
                    <option value="reinstate">Reinstate</option>
                    <option value="remove">Remove</option>
                  </select>
                </label>
                {operation === "set_role" ? (
                  <label>
                    Role
                    <select value={role} onChange={(event) => setRole(event.target.value)}>
                      {data.access.isOwner ? <option value="administrator">Administrator</option> : null}
                      <option value="moderator">Moderator</option>
                      <option value="member">Member</option>
                    </select>
                  </label>
                ) : null}
                {operation === "suspend" ? (
                  <label>
                    Suspension days
                    <input value={days} onChange={(event) => setDays(event.target.value)} />
                  </label>
                ) : null}
                <button
                  type="button"
                  className="rooms-live-primary-action"
                  disabled={!selected.length || Boolean(working)}
                  onClick={() => void act("bulk_members", { memberIds: selected, operation, role, days })}
                >
                  Apply to {selected.length} member{selected.length === 1 ? "" : "s"}
                </button>
              </div>
            </section>

            <section className="room-workspace-panel">
              <div className="room-workspace-section-heading">
                <div>
                  <p className="rooms-live-eyebrow">Retention</p>
                  <h2>Data retention policy</h2>
                </div>
              </div>
              <div className="rooms-live-access-form">
                <label>
                  Retention days
                  <input
                    value={retentionDays}
                    onChange={(event) => setRetentionDays(event.target.value)}
                    placeholder="Blank keeps data indefinitely"
                  />
                </label>
                <button
                  type="button"
                  className="rooms-live-primary-action"
                  onClick={() =>
                    void act("update_settings", {
                      retentionDays: retentionDays || null,
                      retainAuditLogs: true,
                      requirePolicyAcknowledgment: true,
                    })
                  }
                >
                  Save retention settings
                </button>
              </div>
            </section>

            <section className="room-workspace-panel">
              <div className="room-workspace-section-heading">
                <div>
                  <p className="rooms-live-eyebrow">Policy publication</p>
                  <h2>Publish a Room policy</h2>
                </div>
              </div>
              <div className="rooms-live-access-form">
                <label>
                  Policy title
                  <input value={policyTitle} onChange={(event) => setPolicyTitle(event.target.value)} />
                </label>
                <label>
                  Policy text
                  <textarea value={policyBody} onChange={(event) => setPolicyBody(event.target.value)} />
                </label>
                <button
                  type="button"
                  className="rooms-live-primary-action"
                  onClick={() => void act("publish_policy", { title: policyTitle, body: policyBody })}
                >
                  Publish policy
                </button>
              </div>
            </section>

            {data.access.isOwner ? (
              <section className="room-workspace-panel">
                <div className="room-workspace-section-heading">
                  <div>
                    <p className="rooms-live-eyebrow">Ownership</p>
                    <h2>Transfer Room ownership</h2>
                  </div>
                  <Crown aria-hidden="true" />
                </div>
                <div className="rooms-live-access-form">
                  <label>
                    New owner user id
                    <input
                      value={transferUserId}
                      onChange={(event) => setTransferUserId(event.target.value)}
                      placeholder="Active Room member user id"
                    />
                  </label>
                  <button
                    type="button"
                    className="rooms-live-primary-action"
                    onClick={() => void act("create_transfer", { toUserId: transferUserId })}
                  >
                    Create seven-day transfer
                  </button>
                </div>
              </section>
            ) : null}

            <section className="room-workspace-panel">
              <div className="room-workspace-section-heading">
                <div>
                  <p className="rooms-live-eyebrow">Moderation queue</p>
                  <h2>Room-specific review</h2>
                </div>
              </div>
              <div className="rooms-live-access-form">
                <label>
                  Reason
                  <textarea
                    value={moderationReason}
                    onChange={(event) => setModerationReason(event.target.value)}
                    placeholder="Describe the content or member that needs review"
                  />
                </label>
                <button
                  type="button"
                  className="rooms-live-primary-action"
                  onClick={() => void act("create_moderation_item", { targetType: "other", reason: moderationReason })}
                >
                  Add to moderation queue
                </button>
              </div>
              {(data.moderation ?? []).map((item) => (
                <article key={String(item.id)} className="rooms-live-state-card">
                  <strong>{String(item.reason || "Moderation item")}</strong>
                  <span>{String(item.status || "open")}</span>
                  {item.status === "open" || item.status === "reviewing" ? (
                    <button
                      type="button"
                      className="rooms-live-secondary-action"
                      onClick={() =>
                        void act("resolve_moderation_item", { itemId: item.id, status: "resolved" })
                      }
                    >
                      Resolve
                    </button>
                  ) : null}
                </article>
              ))}
            </section>

            <section className="room-workspace-panel">
              <div className="room-workspace-section-heading">
                <div>
                  <p className="rooms-live-eyebrow">Audit history</p>
                  <h2>Recent governance activity</h2>
                </div>
              </div>
              {(data.audit ?? []).slice(0, 50).map((entry) => (
                <article key={String(entry.id)} className="rooms-live-state-card">
                  <strong>{String(entry.action || "Room activity")}</strong>
                  <span>{String(entry.createdAt || "")}</span>
                </article>
              ))}
            </section>
          </>
        ) : null}
      </div>
    </main>
  );
}
