"use client";

import {
  CheckCircle2,
  Clock3,
  Copy,
  FileText,
  Loader2,
  Plus,
  RefreshCw,
  Settings,
  ShieldCheck,
  Trash2,
  UserCheck,
} from "lucide-react";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { RoomTierFeature } from "@/components/room-tier-feature";
import { supabase } from "@/lib/supabase/client";

const SPECIALIZED_MODULES = new Set([
  "settings",
  "advanced-controls",
  "enterprise-controls",
  "invites",
  "requests",
  "tasks",
  "member-workflows",
  "high-capacity",
]);

function asString(value) {
  return typeof value === "string" ? value : "";
}

function displayName(profile, fallback = "Room member") {
  return profile?.full_name?.trim() || profile?.username?.trim() || fallback;
}

function formatDate(value) {
  if (!value) return "Not recorded";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "Not recorded";
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

async function accessToken() {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

async function copyText(value) {
  try {
    await navigator.clipboard.writeText(value);
    return true;
  } catch {
    return false;
  }
}

export function RoomTierParityFeature(props) {
  if (!SPECIALIZED_MODULES.has(props.moduleKey)) {
    return <RoomTierFeature {...props} />;
  }
  return <SpecializedRoomTierFeature {...props} />;
}

function SpecializedRoomTierFeature({ moduleKey, label }) {
  const params = useParams();
  const rawRoomId = params?.roomId;
  const roomId = useMemo(
    () => (Array.isArray(rawRoomId) ? rawRoomId[0] : rawRoomId ?? ""),
    [rawRoomId]
  );
  const [manifest, setManifest] = useState(null);
  const [members, setMembers] = useState([]);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [message, setMessage] = useState("");
  const [messageIsError, setMessageIsError] = useState(false);
  const [latestInviteUrl, setLatestInviteUrl] = useState("");
  const [capacityPage, setCapacityPage] = useState(1);
  const [capacitySearch, setCapacitySearch] = useState("");
  const requestIdRef = useRef(0);
  const capacityRef = useRef({ page: 1, search: "" });

  const loadManifest = useCallback(async () => {
    if (!roomId) return null;
    const token = await accessToken();
    if (!token) throw new Error("Sign in again before continuing.");
    const headers = { Authorization: `Bearer ${token}` };
    const [manifestResponse, workspaceResponse] = await Promise.all([
      fetch(`/api/rooms/${encodeURIComponent(roomId)}/modules?module=manifest`, {
        headers,
        cache: "no-store",
      }),
      fetch(`/api/rooms/${encodeURIComponent(roomId)}`, {
        headers,
        cache: "no-store",
      }),
    ]);
    const nextManifest = await manifestResponse.json().catch(() => ({}));
    if (!manifestResponse.ok) {
      throw new Error(nextManifest.error ?? "Room modules could not be loaded.");
    }
    const workspace = await workspaceResponse.json().catch(() => ({}));
    if (!workspaceResponse.ok) {
      throw new Error(workspace.error ?? "Room members could not be loaded.");
    }
    setManifest(nextManifest);
    setMembers(Array.isArray(workspace.members) ? workspace.members : []);
    return nextManifest;
  }, [roomId]);

  const loadData = useCallback(
    async (page = capacityRef.current.page, search = capacityRef.current.search) => {
      if (!roomId) return;
      const requestId = ++requestIdRef.current;
      setLoading(true);
      setMessage("");
      setMessageIsError(false);
      try {
        const token = await accessToken();
        if (!token) throw new Error("Sign in again before continuing.");
        const query = new URLSearchParams({ module: moduleKey });
        if (moduleKey === "high-capacity") {
          query.set("page", String(Math.max(1, page)));
          if (search.trim()) query.set("search", search.trim());
        }
        const response = await fetch(
          `/api/rooms/${encodeURIComponent(roomId)}/modules?${query.toString()}`,
          { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" }
        );
        const result = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(result.error ?? "The Room module could not be loaded.");
        }
        if (requestId !== requestIdRef.current) return;
        setData(result.data ?? null);
      } catch (error) {
        if (requestId !== requestIdRef.current) return;
        setData(null);
        setMessage(
          error instanceof Error
            ? error.message
            : "The Room module could not be loaded."
        );
        setMessageIsError(true);
      } finally {
        if (requestId === requestIdRef.current) setLoading(false);
      }
    },
    [moduleKey, roomId]
  );

  useEffect(() => {
    let live = true;
    requestIdRef.current += 1;
    capacityRef.current = { page: 1, search: "" };
    setCapacityPage(1);
    setCapacitySearch("");
    setLatestInviteUrl("");
    setManifest(null);
    setMembers([]);
    setData(null);
    setLoading(true);
    void (async () => {
      try {
        const nextManifest = await loadManifest();
        const included = nextManifest?.modules?.some(
          (definition) => definition.id === moduleKey
        );
        if (!included) {
          throw new Error(
            "This module is not included for the current Room plan and role."
          );
        }
        if (live) await loadData(1, "");
      } catch (error) {
        if (!live) return;
        setMessage(
          error instanceof Error ? error.message : "Room module could not load."
        );
        setMessageIsError(true);
        setLoading(false);
      }
    })();
    return () => {
      live = false;
      requestIdRef.current += 1;
    };
  }, [loadData, loadManifest, moduleKey]);

  async function action(payload, successMessage) {
    if (!roomId || working) return false;
    setWorking(true);
    setMessage("");
    setMessageIsError(false);
    try {
      const token = await accessToken();
      if (!token) throw new Error("Sign in again before continuing.");
      const response = await fetch(
        `/api/rooms/${encodeURIComponent(roomId)}/modules`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ module: moduleKey, ...payload }),
        }
      );
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(result.error ?? "The Room action could not be completed.");
      }
      const inviteUrl = result.inviteUrl?.trim() ?? "";
      if (payload.action === "create_invite" && !inviteUrl) {
        throw new Error(
          "The invitation was created without a usable link. Revoke it and try again."
        );
      }
      if (inviteUrl) {
        setLatestInviteUrl(inviteUrl);
        const copied = await copyText(inviteUrl);
        setMessage(
          copied
            ? "Secure invitation link created and copied."
            : "Secure invitation link created. Copy it from the field below."
        );
      } else {
        setMessage(successMessage);
      }
      await loadData();
      if (["requests", "settings", "invites"].includes(moduleKey)) {
        await loadManifest();
      }
      window.dispatchEvent(new Event("loombus:room-activity-changed"));
      return true;
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "The Room action could not be completed."
      );
      setMessageIsError(true);
      return false;
    } finally {
      setWorking(false);
    }
  }

  const definition = manifest?.modules?.find((item) => item.id === moduleKey);
  const refresh = () => void loadData();

  return (
    <section className="room-tier-module-panel room-phase3-tier-panel" aria-busy={loading}>
      <header className="room-tier-module-heading">
        <div>
          <p className="rooms-live-eyebrow">{manifest?.plan?.label ?? "Room plan"}</p>
          <h2>{definition?.label ?? label ?? "Room module"}</h2>
          <p>{definition?.description}</p>
        </div>
        <button
          type="button"
          className="rooms-live-secondary-action"
          onClick={refresh}
          disabled={loading}
        >
          {loading ? (
            <Loader2 aria-hidden="true" className="is-spinning" />
          ) : (
            <RefreshCw aria-hidden="true" />
          )}
          Refresh
        </button>
      </header>

      {message ? (
        <div
          className={`rooms-live-notice${messageIsError ? " is-error" : ""}`}
          role={messageIsError ? "alert" : "status"}
        >
          {message}
        </div>
      ) : null}

      {moduleKey === "invites" && latestInviteUrl ? (
        <div className="room-tier-create-card" role="status">
          <label>
            <span>New invitation link</span>
            <input
              type="url"
              value={latestInviteUrl}
              readOnly
              onFocus={(event) => event.currentTarget.select()}
            />
          </label>
          <button
            type="button"
            className="rooms-live-secondary-action"
            onClick={() => void copyText(latestInviteUrl)}
          >
            <Copy aria-hidden="true" /> Copy invitation link
          </button>
          <small>
            Keep this page open until the link is saved. The full token cannot be
            reconstructed after leaving.
          </small>
        </div>
      ) : null}

      {loading && data === null ? (
        <div className="room-tier-module-loading" role="status">
          <Loader2 aria-hidden="true" className="is-spinning" />
          Loading {definition?.label ?? label ?? "Room module"}…
        </div>
      ) : moduleKey === "settings" ||
        moduleKey === "advanced-controls" ||
        moduleKey === "enterprise-controls" ? (
        <SettingsPanel
          moduleKey={moduleKey}
          data={data}
          working={working}
          onSave={(payload) =>
            action(
              { action: "update_settings", ...payload },
              "Room settings saved."
            )
          }
        />
      ) : moduleKey === "invites" ? (
        <InvitesPanel
          data={data}
          working={working}
          onCreate={(payload) =>
            action({ action: "create_invite", ...payload }, "Invitation created.")
          }
          onRevoke={(inviteId) =>
            action({ action: "revoke_invite", inviteId }, "Invitation revoked.")
          }
          onReview={(requestId, state) =>
            action(
              { action: "review_request", requestId, state },
              state === "approved"
                ? "Room membership approved."
                : "Join request declined."
            )
          }
        />
      ) : moduleKey === "high-capacity" ? (
        <HighCapacityPanel
          data={data}
          page={capacityPage}
          search={capacitySearch}
          onSearch={(search) => {
            capacityRef.current = { page: 1, search };
            setCapacityPage(1);
            setCapacitySearch(search);
            void loadData(1, search);
          }}
          onPage={(page) => {
            capacityRef.current = { page, search: capacitySearch };
            setCapacityPage(page);
            void loadData(page, capacitySearch);
          }}
        />
      ) : (
        <OperationalRecordsPanel
          moduleKey={moduleKey}
          records={Array.isArray(data) ? data : []}
          members={members}
          manifest={manifest}
          working={working}
          action={action}
        />
      )}
    </section>
  );
}

function SettingsPanel({ moduleKey, data, working, onSave }) {
  const source = data ?? {};
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [inviteOnly, setInviteOnly] = useState(true);
  const [allowMemberPosts, setAllowMemberPosts] = useState(true);
  const [directoryVisible, setDirectoryVisible] = useState(true);
  const [inviteApproval, setInviteApproval] = useState(false);
  const [domains, setDomains] = useState("");
  const [defaultRole, setDefaultRole] = useState("member");
  const privateSupportThreads = Boolean(
    source.room?.requiredBehaviors?.includes("private_support_threads") ||
      source.room?.roomType === "customer_support"
  );
  const staffOnlyRequests = Boolean(
    source.room?.requiredBehaviors?.includes("staff_only_operational_requests") ||
      source.modelProfile?.requiredBehaviors?.includes(
        "staff_only_operational_requests"
      )
  );

  useEffect(() => {
    setName(source.room?.name ?? "");
    setDescription(source.room?.description ?? "");
    setInviteOnly(source.room?.inviteOnly ?? true);
    setAllowMemberPosts(
      privateSupportThreads ? true : source.settings?.allowMemberPosts ?? true
    );
    setDirectoryVisible(source.settings?.memberDirectoryVisible ?? true);
    setInviteApproval(source.settings?.inviteRequiresApproval ?? false);
    setDomains((source.settings?.allowedEmailDomains ?? []).join("\n"));
    setDefaultRole(source.settings?.defaultInviteRole ?? "member");
  }, [data, privateSupportThreads, source.settings?.allowMemberPosts]);

  const core = moduleKey === "settings";
  return (
    <form
      className="room-tier-create-card"
      onSubmit={(event) => {
        event.preventDefault();
        void onSave({
          room: { name, description, inviteOnly },
          settings: {
            allowMemberPosts: privateSupportThreads ? true : allowMemberPosts,
            memberDirectoryVisible: directoryVisible,
            inviteRequiresApproval: inviteApproval,
            allowedEmailDomains: domains
              .split(/\n|,/)
              .map((item) => item.trim())
              .filter(Boolean),
            defaultInviteRole: defaultRole,
          },
        });
      }}
    >
      {source.modelProfile ? (
        <section className="room-tier-create-heading">
          <ShieldCheck aria-hidden="true" />
          <div>
            <p className="rooms-live-eyebrow">{source.modelProfile.title}</p>
            <h3>{source.modelProfile.workflowSummary}</h3>
            <p>{source.modelProfile.defaultAccessSummary}</p>
            <div className="room-tier-record-details">
              {(source.modelProfile.workflowHighlights ?? []).map((item) => (
                <span key={item} className="room-tier-record-chip">
                  {item}
                </span>
              ))}
            </div>
            {staffOnlyRequests ? (
              <p className="rooms-live-notice">
                Customer Support operations are staff-only and cannot be exposed to
                ordinary customers.
              </p>
            ) : null}
          </div>
        </section>
      ) : null}

      {core ? (
        <>
          <label>
            <span>Room name</span>
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              minLength={3}
              maxLength={80}
              required
            />
          </label>
          <label>
            <span>Room purpose</span>
            <textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              rows={5}
              minLength={10}
              maxLength={600}
              required
            />
          </label>
          <label className="room-tier-checkbox">
            <input
              type="checkbox"
              checked={inviteOnly}
              onChange={(event) => setInviteOnly(event.target.checked)}
            />
            <span>Keep this Room invite-only</span>
          </label>
        </>
      ) : (
        <>
          <label className="room-tier-checkbox">
            <input
              type="checkbox"
              checked={privateSupportThreads ? true : allowMemberPosts}
              disabled={privateSupportThreads}
              onChange={(event) => setAllowMemberPosts(event.target.checked)}
            />
            <span>
              {privateSupportThreads
                ? "Customers can always open and reply to their private support cases"
                : "Allow ordinary members to create discussions"}
            </span>
          </label>
          {privateSupportThreads ? (
            <p className="rooms-live-notice">
              This required Customer Support behavior cannot be disabled.
            </p>
          ) : null}
          <label className="room-tier-checkbox">
            <input
              type="checkbox"
              checked={directoryVisible}
              onChange={(event) => setDirectoryVisible(event.target.checked)}
            />
            <span>Allow members to view the private directory</span>
          </label>
          <label className="room-tier-checkbox">
            <input
              type="checkbox"
              checked={inviteApproval}
              onChange={(event) => setInviteApproval(event.target.checked)}
            />
            <span>Require administrator approval after invitation redemption</span>
          </label>
          <label>
            <span>Allowed invitation email domains, one per line</span>
            <textarea
              rows={5}
              value={domains}
              onChange={(event) => setDomains(event.target.value)}
            />
          </label>
          <label>
            <span>Default invitation role</span>
            <select
              value={defaultRole}
              onChange={(event) => setDefaultRole(event.target.value)}
            >
              <option value="member">Member</option>
              <option value="moderator">Moderator</option>
            </select>
          </label>
        </>
      )}
      <button type="submit" className="rooms-live-primary-action" disabled={working}>
        {working ? (
          <Loader2 aria-hidden="true" className="is-spinning" />
        ) : (
          <Settings aria-hidden="true" />
        )}
        {working ? "Saving…" : "Save settings"}
      </button>
    </form>
  );
}

function InvitesPanel({ data, working, onCreate, onRevoke, onReview }) {
  const source = data ?? {};
  const [label, setLabel] = useState("Room invitation");
  const [role, setRole] = useState("member");
  const [maxUses, setMaxUses] = useState("25");
  const [expiresAt, setExpiresAt] = useState("");
  const pending = (source.joinRequests ?? []).filter(
    (request) => request.state === "pending"
  );

  return (
    <div className="room-tier-records-layout">
      <section className="room-tier-create-card">
        <h3>Pending join requests</h3>
        <p>Review invitation redemptions that require administrator approval.</p>
        {pending.length === 0 ? (
          <div className="room-tier-empty-state">
            <UserCheck aria-hidden="true" />
            <h3>No pending join requests</h3>
            <p>New approval requests will appear here.</p>
          </div>
        ) : (
          <div className="room-tier-record-grid">
            {pending.map((request) => (
              <article key={request.id} className="room-tier-record-card">
                <span className="room-tier-record-chip">Pending</span>
                <h3>{displayName(request.applicant, request.applicantId)}</h3>
                <small>{formatDate(request.createdAt)}</small>
                {request.note ? <p>{request.note}</p> : null}
                <div className="room-tier-inline-actions">
                  <button
                    type="button"
                    className="rooms-live-primary-action"
                    onClick={() => void onReview(request.id, "approved")}
                  >
                    <CheckCircle2 aria-hidden="true" /> Approve
                  </button>
                  <button
                    type="button"
                    className="rooms-live-secondary-action"
                    onClick={() => void onReview(request.id, "declined")}
                  >
                    <Trash2 aria-hidden="true" /> Decline
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <form
        className="room-tier-create-card"
        onSubmit={(event) => {
          event.preventDefault();
          void onCreate({
            label,
            role,
            maxUses: Number(maxUses) || null,
            expiresAt: expiresAt || null,
          });
        }}
      >
        <h3>Create a secure invitation</h3>
        <div className="room-tier-form-grid">
          <label>
            <span>Label</span>
            <input value={label} onChange={(event) => setLabel(event.target.value)} />
          </label>
          <label>
            <span>Role</span>
            <select value={role} onChange={(event) => setRole(event.target.value)}>
              <option value="member">Member</option>
              <option value="moderator">Moderator</option>
            </select>
          </label>
          <label>
            <span>Maximum uses</span>
            <input
              type="number"
              min={1}
              max={10000}
              value={maxUses}
              onChange={(event) => setMaxUses(event.target.value)}
            />
          </label>
          <label>
            <span>Expiration</span>
            <input
              type="datetime-local"
              value={expiresAt}
              onChange={(event) => setExpiresAt(event.target.value)}
            />
          </label>
        </div>
        <button type="submit" className="rooms-live-primary-action" disabled={working}>
          {working ? (
            <Loader2 aria-hidden="true" className="is-spinning" />
          ) : (
            <Copy aria-hidden="true" />
          )}
          {working ? "Creating…" : "Create and copy link"}
        </button>
      </form>

      <div className="room-tier-record-grid">
        {(source.invites ?? []).map((invite) => (
          <article key={invite.id} className="room-tier-record-card">
            <div className="room-tier-record-topline">
              <span className="room-tier-record-chip">
                {invite.revokedAt ? "Revoked" : "Active"}
              </span>
              <small>{formatDate(invite.createdAt)}</small>
            </div>
            <h3>{invite.label}</h3>
            <p>
              Role: {invite.role} · Uses: {invite.useCount}
              {invite.maxUses === null ? "" : ` of ${invite.maxUses}`}
            </p>
            {invite.expiresAt ? <small>Expires {formatDate(invite.expiresAt)}</small> : null}
            {!invite.revokedAt ? (
              <button
                type="button"
                className="rooms-live-secondary-action"
                onClick={() => void onRevoke(invite.id)}
              >
                <Trash2 aria-hidden="true" /> Revoke
              </button>
            ) : null}
          </article>
        ))}
      </div>
    </div>
  );
}

function OperationalRecordsPanel({
  moduleKey,
  records,
  members,
  manifest,
  working,
  action,
}) {
  const canManage = Boolean(manifest?.access?.canManage);
  const currentUserId = manifest?.access?.currentUserId ?? "";
  const profile = manifest?.modelProfile;
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [assigneeId, setAssigneeId] = useState("");
  const [priority, setPriority] = useState("normal");
  const [dueAt, setDueAt] = useState("");
  const [category, setCategory] = useState(
    profile?.request?.defaultCategory ?? "General"
  );
  const [workflowMemberId, setWorkflowMemberId] = useState("");
  const [stage, setStage] = useState("");

  useEffect(() => {
    setCategory(profile?.request?.defaultCategory ?? "General");
  }, [profile?.key, profile?.request?.defaultCategory]);

  async function createRecord(event) {
    event.preventDefault();
    let metadata;
    if (moduleKey === "requests") {
      metadata = {
        category,
        assigneeId: canManage ? assigneeId || null : null,
        priority,
        dueAt: canManage ? dueAt || null : null,
      };
    } else if (moduleKey === "tasks") {
      metadata = {
        assigneeId: assigneeId || null,
        priority,
        dueAt: dueAt || null,
      };
    } else {
      metadata = {
        memberId: workflowMemberId,
        stage,
        dueAt: dueAt || null,
      };
    }
    const completed = await action(
      { action: "create_record", title, body, metadata },
      moduleKey === "requests"
        ? "Operational request submitted."
        : "Room item created."
    );
    if (completed) {
      setTitle("");
      setBody("");
      setAssigneeId("");
      setPriority("normal");
      setDueAt("");
      setWorkflowMemberId("");
      setStage("");
    }
  }

  return (
    <div className="room-tier-records-layout">
      {canManage || moduleKey === "requests" ? (
        <form className="room-tier-create-card" onSubmit={createRecord}>
          <div className="room-tier-create-heading">
            <Plus aria-hidden="true" />
            <div>
              <h3>
                {moduleKey === "requests"
                  ? profile?.request?.submitHeading ?? "Submit an operational request"
                  : "Add to this module"}
              </h3>
              <p>
                {moduleKey === "requests"
                  ? profile?.request?.description ??
                    "Track a Room need from submission through completion."
                  : "New entries remain inside the verified Room boundary."}
              </p>
            </div>
          </div>
          <label>
            <span>{moduleKey === "requests" ? `${profile?.request?.singularLabel ?? "Request"} title` : "Title"}</span>
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              maxLength={200}
              required
            />
          </label>
          <label>
            <span>{moduleKey === "requests" ? profile?.request?.detailsLabel ?? "Request details" : "Description or notes"}</span>
            <textarea
              value={body}
              onChange={(event) => setBody(event.target.value)}
              rows={4}
              maxLength={12000}
            />
          </label>
          {moduleKey === "member-workflows" ? (
            <div className="room-tier-form-grid">
              <label>
                <span>Member</span>
                <select
                  value={workflowMemberId}
                  onChange={(event) => setWorkflowMemberId(event.target.value)}
                  required
                >
                  <option value="">Choose a member</option>
                  {members.map((member) => (
                    <option key={member.userId} value={member.userId}>
                      {displayName(member.profile, member.userId)}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span>Stage</span>
                <input value={stage} onChange={(event) => setStage(event.target.value)} />
              </label>
              <label>
                <span>Follow-up date</span>
                <input
                  type="datetime-local"
                  value={dueAt}
                  onChange={(event) => setDueAt(event.target.value)}
                />
              </label>
            </div>
          ) : (
            <div className="room-tier-form-grid">
              {moduleKey === "requests" ? (
                <label>
                  <span>Category</span>
                  <select value={category} onChange={(event) => setCategory(event.target.value)}>
                    {(profile?.request?.categories ?? ["General", "Other"]).map(
                      (item) => (
                        <option key={item} value={item}>
                          {item}
                        </option>
                      )
                    )}
                  </select>
                </label>
              ) : null}
              <label>
                <span>Priority</span>
                <select value={priority} onChange={(event) => setPriority(event.target.value)}>
                  <option value="normal">Normal</option>
                  <option value="low">Low</option>
                  <option value="high">High</option>
                  <option value="urgent">Urgent</option>
                </select>
              </label>
              {canManage || moduleKey === "tasks" ? (
                <>
                  <label>
                    <span>Assignee</span>
                    <select
                      value={assigneeId}
                      onChange={(event) => setAssigneeId(event.target.value)}
                    >
                      <option value="">Unassigned</option>
                      {members.map((member) => (
                        <option key={member.userId} value={member.userId}>
                          {displayName(member.profile, member.userId)}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    <span>{moduleKey === "requests" ? "Target date" : "Due date"}</span>
                    <input
                      type="datetime-local"
                      value={dueAt}
                      onChange={(event) => setDueAt(event.target.value)}
                    />
                  </label>
                </>
              ) : null}
            </div>
          )}
          <button
            type="submit"
            className="rooms-live-primary-action"
            disabled={working || !title.trim()}
          >
            {working ? (
              <Loader2 aria-hidden="true" className="is-spinning" />
            ) : (
              <Plus aria-hidden="true" />
            )}
            {working
              ? "Saving…"
              : moduleKey === "requests"
                ? "Submit request"
                : "Add item"}
          </button>
        </form>
      ) : null}

      {records.length === 0 ? (
        <div className="room-tier-empty-state">
          <FileText aria-hidden="true" />
          <h3>
            {moduleKey === "requests"
              ? `No ${profile?.request?.label?.toLowerCase() ?? "operational requests"}`
              : "No items have been added."}
          </h3>
          <p>Authorized Room members can add the first item.</p>
        </div>
      ) : (
        <div className="room-tier-record-grid">
          {records.map((record) => (
            <OperationalRecordCard
              key={record.id}
              moduleKey={moduleKey}
              record={record}
              members={members}
              currentUserId={currentUserId}
              canManage={canManage}
              action={action}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function OperationalRecordCard({
  moduleKey,
  record,
  members,
  currentUserId,
  canManage,
  action,
}) {
  const metadata = record.metadata ?? {};
  const assigneeId = asString(metadata.assigneeId);
  const assignee = members.find((member) => member.userId === assigneeId);
  const requester = members.find((member) => member.userId === record.createdBy);
  const workflowMemberId = asString(metadata.memberId);
  const workflowMember = members.find(
    (member) => member.userId === workflowMemberId
  );
  const [selectedAssignee, setSelectedAssignee] = useState(assigneeId);

  useEffect(() => {
    setSelectedAssignee(assigneeId);
  }, [assigneeId, record.id]);

  const assignedToCurrentUser = assigneeId === currentUserId;
  const authoredByCurrentUser = record.createdBy === currentUserId;
  const terminal = ["completed", "declined", "cancelled"].includes(record.status);

  return (
    <article className="room-tier-record-card">
      <div className="room-tier-record-topline">
        <div>
          <span>{record.status}</span>
          <small>{formatDate(record.createdAt)}</small>
        </div>
        {canManage ? (
          <button
            type="button"
            className="room-workspace-icon-action is-danger"
            aria-label={`Remove ${record.title}`}
            onClick={() =>
              void action(
                { action: "archive_record", recordId: record.id },
                "Room item removed."
              )
            }
          >
            <Trash2 aria-hidden="true" />
          </button>
        ) : null}
      </div>
      <h3>{record.title}</h3>
      {record.body ? <p>{record.body}</p> : null}

      {moduleKey === "tasks" ? (
        <div className="room-tier-record-details">
          <span>Priority: {asString(metadata.priority) || "normal"}</span>
          <span>
            Assignee: {assignee ? displayName(assignee.profile, assignee.userId) : "Unassigned"}
          </span>
          {asString(metadata.dueAt) ? (
            <span>Due: {formatDate(asString(metadata.dueAt))}</span>
          ) : null}
          {(canManage || assignedToCurrentUser) && record.status !== "completed" ? (
            <button
              type="button"
              className="rooms-live-secondary-action"
              onClick={() =>
                void action(
                  {
                    action: "update_record",
                    recordId: record.id,
                    status: "completed",
                  },
                  "Task completed."
                )
              }
            >
              <CheckCircle2 aria-hidden="true" /> Mark complete
            </button>
          ) : null}
        </div>
      ) : null}

      {moduleKey === "member-workflows" ? (
        <div className="room-tier-record-details">
          <span>
            Member: {workflowMember
              ? displayName(workflowMember.profile, workflowMember.userId)
              : workflowMemberId || "Not assigned"}
          </span>
          <span>Stage: {asString(metadata.stage) || "New"}</span>
          {asString(metadata.dueAt) ? (
            <span>Follow-up: {formatDate(asString(metadata.dueAt))}</span>
          ) : null}
        </div>
      ) : null}

      {moduleKey === "requests" ? (
        <div className="room-tier-record-details">
          <span>Category: {asString(metadata.category) || "General"}</span>
          <span>Priority: {asString(metadata.priority) || "normal"}</span>
          <span>
            Requested by: {requester
              ? displayName(requester.profile, requester.userId)
              : record.createdBy}
          </span>
          <span>
            Assignee: {assignee
              ? displayName(assignee.profile, assignee.userId)
              : "Unassigned"}
          </span>
          {asString(metadata.dueAt) ? (
            <span>Target: {formatDate(asString(metadata.dueAt))}</span>
          ) : null}

          {canManage ? (
            <div className="room-tier-inline-actions">
              <select
                value={selectedAssignee}
                onChange={(event) => setSelectedAssignee(event.target.value)}
                aria-label={`Assign ${record.title}`}
              >
                <option value="">Unassigned</option>
                {members.map((member) => (
                  <option key={member.userId} value={member.userId}>
                    {displayName(member.profile, member.userId)}
                  </option>
                ))}
              </select>
              <button
                type="button"
                className="rooms-live-secondary-action"
                onClick={() =>
                  void action(
                    {
                      action: "update_record",
                      recordId: record.id,
                      metadata: {
                        ...metadata,
                        assigneeId: selectedAssignee || null,
                      },
                    },
                    "Request assignment saved."
                  )
                }
              >
                <UserCheck aria-hidden="true" /> Save assignment
              </button>
            </div>
          ) : null}

          {(canManage || assignedToCurrentUser) && !terminal ? (
            <div className="room-tier-inline-actions">
              {record.status !== "in_progress" ? (
                <button
                  type="button"
                  className="rooms-live-secondary-action"
                  onClick={() =>
                    void action(
                      {
                        action: "update_record",
                        recordId: record.id,
                        status: "in_progress",
                      },
                      "Request started."
                    )
                  }
                >
                  <Clock3 aria-hidden="true" /> Start
                </button>
              ) : null}
              {record.status !== "waiting" ? (
                <button
                  type="button"
                  className="rooms-live-secondary-action"
                  onClick={() =>
                    void action(
                      {
                        action: "update_record",
                        recordId: record.id,
                        status: "waiting",
                      },
                      "Request marked waiting."
                    )
                  }
                >
                  <Clock3 aria-hidden="true" /> Waiting
                </button>
              ) : null}
              <button
                type="button"
                className="rooms-live-primary-action"
                onClick={() =>
                  void action(
                    {
                      action: "update_record",
                      recordId: record.id,
                      status: "completed",
                    },
                    "Request completed."
                  )
                }
              >
                <CheckCircle2 aria-hidden="true" /> Complete
              </button>
              {canManage ? (
                <>
                  <button
                    type="button"
                    className="rooms-live-secondary-action"
                    onClick={() =>
                      void action(
                        {
                          action: "update_record",
                          recordId: record.id,
                          status: "declined",
                        },
                        "Request declined."
                      )
                    }
                  >
                    <Trash2 aria-hidden="true" /> Decline
                  </button>
                  {!authoredByCurrentUser ? (
                    <button
                      type="button"
                      className="rooms-live-secondary-action"
                      onClick={() =>
                        void action(
                          {
                            action: "update_record",
                            recordId: record.id,
                            status: "cancelled",
                          },
                          "Request cancelled."
                        )
                      }
                    >
                      <Trash2 aria-hidden="true" /> Cancel
                    </button>
                  ) : null}
                </>
              ) : null}
            </div>
          ) : null}

          {authoredByCurrentUser && !terminal && !assignedToCurrentUser ? (
            <button
              type="button"
              className="rooms-live-secondary-action"
              onClick={() =>
                void action(
                  {
                    action: "update_record",
                    recordId: record.id,
                    status: "cancelled",
                  },
                  "Request cancelled."
                )
              }
            >
              <Trash2 aria-hidden="true" /> Cancel request
            </button>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}

function HighCapacityPanel({ data, page, search, onSearch, onPage }) {
  const source = data ?? {};
  const members = source.members ?? [];
  const pageSize = source.pageSize ?? 50;
  const total = source.total ?? members.length;
  const [draftSearch, setDraftSearch] = useState(search);

  useEffect(() => setDraftSearch(search), [search]);

  return (
    <div className="room-tier-records-layout">
      <form
        className="room-tier-search-card"
        onSubmit={(event) => {
          event.preventDefault();
          onSearch(draftSearch);
        }}
      >
        <label>
          <span>Search this member page</span>
          <input
            value={draftSearch}
            onChange={(event) => setDraftSearch(event.target.value)}
            placeholder="Name, username, or user ID"
          />
        </label>
        <button type="submit" className="rooms-live-secondary-action">
          <RefreshCw aria-hidden="true" /> Search
        </button>
      </form>
      <div className="room-tier-capacity-summary">
        <strong>{total}</strong>
        <span>active members · page {page}</span>
      </div>
      <div className="room-tier-member-list">
        {members.map((member) => (
          <article key={member.id || member.userId}>
            <div>
              <strong>{displayName(member.profile, member.userId)}</strong>
              <span>
                {member.profile?.username
                  ? `@${member.profile.username}`
                  : member.userId}
              </span>
            </div>
            <span className="room-tier-record-chip">{member.role}</span>
          </article>
        ))}
      </div>
      <div className="room-tier-inline-actions">
        <button
          type="button"
          className="rooms-live-secondary-action"
          disabled={page <= 1}
          onClick={() => onPage(Math.max(1, page - 1))}
        >
          Previous
        </button>
        <button
          type="button"
          className="rooms-live-secondary-action"
          disabled={page * pageSize >= total}
          onClick={() => onPage(page + 1)}
        >
          Next
        </button>
      </div>
    </div>
  );
}
