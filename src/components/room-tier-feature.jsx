"use client";

import {
  CheckCircle2,
  ClipboardList,
  Copy,
  ExternalLink,
  FileText,
  Loader2,
  Plus,
  RefreshCw,
  ScrollText,
  Settings,
  ShieldCheck,
  Trash2,
  UserCheck,
  Vote,
} from "lucide-react";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/lib/supabase/client";

function asString(value) {
  return typeof value === "string" ? value : "";
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function asBoolean(value) {
  return value === true;
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

async function token() {
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

export function RoomTierFeature({ moduleKey, label }) {
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

  const loadManifest = useCallback(async () => {
    if (!roomId) return null;
    const accessToken = await token();
    if (!accessToken) throw new Error("Sign in again before continuing.");
    const headers = { Authorization: `Bearer ${accessToken}` };
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

  const loadModule = useCallback(
    async (page = capacityPage, search = capacitySearch) => {
      if (!roomId || !moduleKey) return;
      const requestId = ++requestIdRef.current;
      setLoading(true);
      setMessage("");
      setMessageIsError(false);
      try {
        const accessToken = await token();
        if (!accessToken) throw new Error("Sign in again before continuing.");
        const query = new URLSearchParams({ module: moduleKey });
        if (moduleKey === "high-capacity") {
          query.set("page", String(Math.max(1, page)));
          if (search.trim()) query.set("search", search.trim());
        }
        const response = await fetch(
          `/api/rooms/${encodeURIComponent(roomId)}/modules?${query.toString()}`,
          {
            headers: { Authorization: `Bearer ${accessToken}` },
            cache: "no-store",
          }
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
    [capacityPage, capacitySearch, moduleKey, roomId]
  );

  useEffect(() => {
    let live = true;
    setLatestInviteUrl("");
    setCapacityPage(1);
    setCapacitySearch("");
    setData(null);
    setLoading(true);
    void (async () => {
      try {
        const nextManifest = await loadManifest();
        const included = nextManifest?.modules?.some(
          (definition) => definition.id === moduleKey
        );
        if (!included) {
          throw new Error("This module is not included for the current Room plan and role.");
        }
        if (live) await loadModule(1, "");
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
  }, [loadManifest, loadModule, moduleKey]);

  async function action(payload, successMessage) {
    if (!roomId || working) return false;
    setWorking(true);
    setMessage("");
    setMessageIsError(false);
    try {
      const accessToken = await token();
      if (!accessToken) throw new Error("Sign in again before continuing.");
      const response = await fetch(
        `/api/rooms/${encodeURIComponent(roomId)}/modules`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
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
        throw new Error("The invitation was created without a usable link.");
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
      await loadModule();
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
          onClick={() => void loadModule()}
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
        </div>
      ) : null}

      {loading && data === null ? (
        <div className="room-tier-module-loading" role="status">
          <Loader2 aria-hidden="true" className="is-spinning" />
          Loading {definition?.label ?? label ?? "Room module"}…
        </div>
      ) : (
        <TierBody
          moduleKey={moduleKey}
          data={data}
          manifest={manifest}
          members={members}
          working={working}
          action={action}
          capacityPage={capacityPage}
          capacitySearch={capacitySearch}
          setCapacityPage={setCapacityPage}
          setCapacitySearch={setCapacitySearch}
          reloadCapacity={(page, search) => void loadModule(page, search)}
        />
      )}
    </section>
  );
}

function TierBody({
  moduleKey,
  data,
  manifest,
  members,
  working,
  action,
  capacityPage,
  capacitySearch,
  setCapacityPage,
  setCapacitySearch,
  reloadCapacity,
}) {
  if (["settings", "advanced-controls", "enterprise-controls"].includes(moduleKey)) {
    return (
      <SettingsView
        moduleKey={moduleKey}
        data={data}
        working={working}
        onSave={(payload) =>
          action({ action: "update_settings", ...payload }, "Room settings saved.")
        }
      />
    );
  }
  if (moduleKey === "invites") {
    return (
      <InvitesView
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
    );
  }
  if (moduleKey === "activity") {
    return <ActivityView entries={Array.isArray(data) ? data : []} />;
  }
  if (["admin-tools", "operations", "community-operations"].includes(moduleKey)) {
    return <OperationsView moduleKey={moduleKey} data={data} />;
  }
  if (moduleKey === "high-capacity") {
    return (
      <HighCapacityView
        data={data}
        page={capacityPage}
        search={capacitySearch}
        setPage={setCapacityPage}
        setSearch={setCapacitySearch}
        reload={reloadCapacity}
      />
    );
  }
  return (
    <RecordsView
      moduleKey={moduleKey}
      records={Array.isArray(data) ? data : []}
      members={members}
      manifest={manifest}
      working={working}
      action={action}
    />
  );
}

function ModuleCreateForm({ moduleKey, members, canManage, modelProfile, working, onCreate }) {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [fieldA, setFieldA] = useState("");
  const [fieldB, setFieldB] = useState("");
  const [fieldC, setFieldC] = useState("");
  const [fieldD, setFieldD] = useState("");
  const [toggle, setToggle] = useState(false);

  useEffect(() => {
    setTitle("");
    setBody("");
    setFieldA(
      moduleKey === "requests"
        ? modelProfile?.request?.defaultCategory ?? "General"
        : ""
    );
    setFieldB("");
    setFieldC("");
    setFieldD("");
    setToggle(false);
  }, [modelProfile?.key, modelProfile?.request?.defaultCategory, moduleKey]);

  async function submit(event) {
    event.preventDefault();
    if (!title.trim() || working) return;
    let metadata = {};
    if (moduleKey === "resources") {
      metadata = { url: fieldA, category: fieldB };
    } else if (moduleKey === "requests") {
      metadata = {
        category: fieldA,
        assigneeId: canManage ? fieldB || null : null,
        priority: fieldC || "normal",
        dueAt: canManage ? fieldD || null : null,
      };
    } else if (moduleKey === "tasks") {
      metadata = {
        assigneeId: fieldA || null,
        dueAt: fieldB || null,
        priority: fieldC || "normal",
      };
    } else if (moduleKey === "polls") {
      metadata = {
        options: fieldA.split("\n").map((item) => item.trim()).filter(Boolean),
        closesAt: fieldB || null,
        allowMultiple: toggle,
      };
    } else if (moduleKey === "directory") {
      metadata = { email: fieldA, phone: fieldB, organization: fieldC };
    } else if (moduleKey === "knowledge") {
      metadata = { category: fieldA };
    } else if (moduleKey === "forms") {
      metadata = {
        fields: fieldA.split("\n").map((item) => item.trim()).filter(Boolean),
      };
    } else if (moduleKey === "services") {
      metadata = { priceLabel: fieldA, url: fieldB, availability: fieldC };
    } else if (moduleKey === "member-workflows") {
      metadata = { memberId: fieldA, stage: fieldB, dueAt: fieldC || null };
    }
    const completed = await onCreate({ title, body, metadata });
    if (completed) {
      setTitle("");
      setBody("");
      setFieldA("");
      setFieldB("");
      setFieldC("");
      setFieldD("");
      setToggle(false);
    }
  }

  return (
    <form className="room-tier-create-card" onSubmit={submit}>
      <div className="room-tier-create-heading">
        <Plus aria-hidden="true" />
        <div>
          <h3>
            {moduleKey === "requests"
              ? modelProfile?.request?.submitHeading ?? "Submit an operational request"
              : "Add to this module"}
          </h3>
          <p>
            {moduleKey === "requests"
              ? modelProfile?.request?.description ??
                "Track a Room need from submission through completion."
              : "New entries remain inside the verified Room boundary."}
          </p>
        </div>
      </div>
      <label>
        <span>{moduleKey === "polls" ? "Poll question" : "Title"}</span>
        <input value={title} onChange={(event) => setTitle(event.target.value)} maxLength={200} required />
      </label>
      <label>
        <span>Description or notes</span>
        <textarea value={body} onChange={(event) => setBody(event.target.value)} rows={4} maxLength={12000} />
      </label>

      {moduleKey === "resources" ? (
        <div className="room-tier-form-grid">
          <label><span>HTTP or HTTPS link</span><input type="url" value={fieldA} onChange={(event) => setFieldA(event.target.value)} required /></label>
          <label><span>Category</span><input value={fieldB} onChange={(event) => setFieldB(event.target.value)} /></label>
        </div>
      ) : null}
      {moduleKey === "requests" ? (
        <div className="room-tier-form-grid">
          <label><span>Category</span><select value={fieldA} onChange={(event) => setFieldA(event.target.value)}>{(modelProfile?.request?.categories ?? ["General", "Other"]).map((category) => <option key={category} value={category}>{category}</option>)}</select></label>
          <label><span>Priority</span><select value={fieldC} onChange={(event) => setFieldC(event.target.value)}><option value="normal">Normal</option><option value="low">Low</option><option value="high">High</option><option value="urgent">Urgent</option></select></label>
          {canManage ? <><label><span>Assignee</span><select value={fieldB} onChange={(event) => setFieldB(event.target.value)}><option value="">Unassigned</option>{members.map((member) => <option key={member.userId} value={member.userId}>{displayName(member.profile, member.userId)}</option>)}</select></label><label><span>Target date</span><input type="datetime-local" value={fieldD} onChange={(event) => setFieldD(event.target.value)} /></label></> : null}
        </div>
      ) : null}
      {moduleKey === "tasks" ? (
        <div className="room-tier-form-grid">
          <label><span>Assignee</span><select value={fieldA} onChange={(event) => setFieldA(event.target.value)}><option value="">Unassigned</option>{members.map((member) => <option key={member.userId} value={member.userId}>{displayName(member.profile, member.userId)}</option>)}</select></label>
          <label><span>Due date</span><input type="datetime-local" value={fieldB} onChange={(event) => setFieldB(event.target.value)} /></label>
          <label><span>Priority</span><select value={fieldC} onChange={(event) => setFieldC(event.target.value)}><option value="normal">Normal</option><option value="low">Low</option><option value="high">High</option><option value="urgent">Urgent</option></select></label>
        </div>
      ) : null}
      {moduleKey === "polls" ? <><label><span>Options, one per line</span><textarea value={fieldA} onChange={(event) => setFieldA(event.target.value)} rows={5} required /></label><div className="room-tier-form-grid"><label><span>Close date</span><input type="datetime-local" value={fieldB} onChange={(event) => setFieldB(event.target.value)} /></label><label className="room-tier-checkbox"><input type="checkbox" checked={toggle} onChange={(event) => setToggle(event.target.checked)} /><span>Allow multiple choices</span></label></div></> : null}
      {moduleKey === "directory" ? <div className="room-tier-form-grid"><label><span>Email</span><input type="email" value={fieldA} onChange={(event) => setFieldA(event.target.value)} /></label><label><span>Phone</span><input value={fieldB} onChange={(event) => setFieldB(event.target.value)} /></label><label><span>Organization or role</span><input value={fieldC} onChange={(event) => setFieldC(event.target.value)} /></label></div> : null}
      {moduleKey === "knowledge" ? <label><span>Category</span><input value={fieldA} onChange={(event) => setFieldA(event.target.value)} placeholder="General" /></label> : null}
      {moduleKey === "forms" ? <label><span>Fields, one per line</span><textarea value={fieldA} onChange={(event) => setFieldA(event.target.value)} rows={5} required /></label> : null}
      {moduleKey === "services" ? <div className="room-tier-form-grid"><label><span>Price or terms</span><input value={fieldA} onChange={(event) => setFieldA(event.target.value)} /></label><label><span>External link</span><input type="url" value={fieldB} onChange={(event) => setFieldB(event.target.value)} /></label><label><span>Availability</span><input value={fieldC} onChange={(event) => setFieldC(event.target.value)} /></label></div> : null}
      {moduleKey === "member-workflows" ? <div className="room-tier-form-grid"><label><span>Member</span><select value={fieldA} onChange={(event) => setFieldA(event.target.value)} required><option value="">Choose a member</option>{members.map((member) => <option key={member.userId} value={member.userId}>{displayName(member.profile, member.userId)}</option>)}</select></label><label><span>Stage</span><input value={fieldB} onChange={(event) => setFieldB(event.target.value)} /></label><label><span>Follow-up date</span><input type="datetime-local" value={fieldC} onChange={(event) => setFieldC(event.target.value)} /></label></div> : null}

      <button type="submit" className="rooms-live-primary-action" disabled={working || !title.trim()}>
        {working ? <Loader2 aria-hidden="true" className="is-spinning" /> : <Plus aria-hidden="true" />}
        {working ? "Saving…" : moduleKey === "requests" ? "Submit request" : "Add item"}
      </button>
    </form>
  );
}

function RecordsView({ moduleKey, records, members, manifest, working, action }) {
  const canManage = Boolean(manifest?.access?.canManage);
  return (
    <div className="room-tier-records-layout">
      {canManage || moduleKey === "requests" ? (
        <ModuleCreateForm
          moduleKey={moduleKey}
          members={members}
          canManage={canManage}
          modelProfile={manifest?.modelProfile}
          working={working}
          onCreate={(payload) =>
            action(
              { action: "create_record", ...payload },
              moduleKey === "requests" ? "Operational request submitted." : "Room item created."
            )
          }
        />
      ) : null}
      {records.length === 0 ? (
        <div className="room-tier-empty-state">
          <FileText aria-hidden="true" />
          <h3>No items have been added.</h3>
          <p>Authorized Room members can add the first item.</p>
        </div>
      ) : (
        <div className="room-tier-record-grid">
          {records.map((record) => (
            <RecordCard
              key={record.id}
              moduleKey={moduleKey}
              record={record}
              canManage={canManage}
              currentUserId={manifest?.access?.currentUserId ?? ""}
              action={action}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function RecordCard({ moduleKey, record, canManage, currentUserId, action }) {
  const metadata = record.metadata ?? {};
  const [pollSelection, setPollSelection] = useState(
    asArray(record.responseSummary?.ownResponse?.optionIds).map(asString)
  );
  const [formValues, setFormValues] = useState({});

  if (moduleKey === "polls") {
    const options = asArray(metadata.options);
    const multiple = asBoolean(metadata.allowMultiple);
    const counts = record.responseSummary?.optionCounts ?? {};
    return (
      <article className="room-tier-record-card">
        <div className="room-tier-record-topline"><div><span>{record.status}</span><small>{record.responseSummary?.totalResponses ?? 0} responses</small></div>{canManage ? <button type="button" className="room-workspace-icon-action is-danger" onClick={() => void action({ action: "archive_record", recordId: record.id }, "Room item removed.")}><Trash2 aria-hidden="true" /></button> : null}</div>
        <h3>{record.title}</h3>{record.body ? <p>{record.body}</p> : null}
        <div className="room-tier-poll-options">{options.map((option) => { const id = asString(option.id); return <label key={id}><input type={multiple ? "checkbox" : "radio"} name={`poll-${record.id}`} checked={pollSelection.includes(id)} onChange={() => setPollSelection((current) => multiple ? current.includes(id) ? current.filter((item) => item !== id) : [...current, id] : [id])} /><span>{asString(option.label)}</span><strong>{counts[id] ?? 0}</strong></label>; })}</div>
        <button type="button" className="rooms-live-primary-action" disabled={!pollSelection.length || record.status === "closed"} onClick={() => void action({ action: "submit_response", recordId: record.id, payload: { optionIds: pollSelection } }, "Vote recorded.")}><Vote aria-hidden="true" /> Record vote</button>
      </article>
    );
  }

  if (moduleKey === "forms") {
    const fields = asArray(metadata.fields);
    return (
      <article className="room-tier-record-card">
        <div className="room-tier-record-topline"><div><span>Form</span><small>{record.responseSummary?.totalResponses ?? 0} submissions</small></div>{canManage ? <button type="button" className="room-workspace-icon-action is-danger" onClick={() => void action({ action: "archive_record", recordId: record.id }, "Room item removed.")}><Trash2 aria-hidden="true" /></button> : null}</div>
        <h3>{record.title}</h3>{record.body ? <p>{record.body}</p> : null}
        <div className="room-tier-form-fields">{fields.map((field) => { const id = asString(field.id); return <label key={id}><span>{asString(field.label)}</span><input value={formValues[id] ?? ""} onChange={(event) => setFormValues((current) => ({ ...current, [id]: event.target.value }))} /></label>; })}</div>
        <button type="button" className="rooms-live-primary-action" onClick={() => void action({ action: "submit_response", recordId: record.id, payload: { values: formValues } }, "Form submitted.")}><ClipboardList aria-hidden="true" /> Submit form</button>
        {canManage && record.responseSummary?.responses?.length ? <details className="room-tier-submissions"><summary>Review submissions</summary>{record.responseSummary.responses.map((response) => <article key={response.id}><strong>{response.responderId ?? "Member submission"}</strong><small>{formatDate(response.createdAt)}</small><pre>{JSON.stringify(response.payload?.values ?? {}, null, 2)}</pre></article>)}</details> : null}
      </article>
    );
  }

  const canUpdateStatus = canManage || asString(metadata.assigneeId) === currentUserId || record.createdBy === currentUserId;
  return (
    <article className="room-tier-record-card">
      <div className="room-tier-record-topline"><div><span>{record.status}</span><small>{formatDate(record.createdAt)}</small></div>{canManage ? <button type="button" className="room-workspace-icon-action is-danger" onClick={() => void action({ action: "archive_record", recordId: record.id }, "Room item removed.")}><Trash2 aria-hidden="true" /></button> : null}</div>
      <h3>{record.title}</h3>{record.body ? <p>{record.body}</p> : null}
      {moduleKey === "resources" && asString(metadata.url) ? <a href={asString(metadata.url)} target="_blank" rel="noopener noreferrer" className="room-tier-record-link"><ExternalLink aria-hidden="true" /> Open {asString(metadata.category) || "resource"}</a> : null}
      {moduleKey === "directory" ? <div className="room-tier-record-details">{asString(metadata.organization) ? <span>{asString(metadata.organization)}</span> : null}{asString(metadata.email) ? <a href={`mailto:${asString(metadata.email)}`}>{asString(metadata.email)}</a> : null}{asString(metadata.phone) ? <a href={`tel:${asString(metadata.phone)}`}>{asString(metadata.phone)}</a> : null}</div> : null}
      {moduleKey === "knowledge" ? <span className="room-tier-record-chip">{asString(metadata.category) || "General"}</span> : null}
      {moduleKey === "services" ? <div className="room-tier-record-details">{asString(metadata.priceLabel) ? <strong>{asString(metadata.priceLabel)}</strong> : null}{asString(metadata.availability) ? <span>{asString(metadata.availability)}</span> : null}{asString(metadata.url) ? <a href={asString(metadata.url)} target="_blank" rel="noopener noreferrer" className="room-tier-record-link"><ExternalLink aria-hidden="true" /> Request or learn more</a> : null}</div> : null}
      {["tasks", "requests"].includes(moduleKey) ? <div className="room-tier-record-details"><span>Priority: {asString(metadata.priority) || "normal"}</span>{asString(metadata.dueAt) ? <span>Due: {formatDate(asString(metadata.dueAt))}</span> : null}{canUpdateStatus && !["completed", "declined", "cancelled"].includes(record.status) ? <div className="room-tier-inline-actions"><button type="button" className="rooms-live-secondary-action" onClick={() => void action({ action: "update_record", recordId: record.id, status: "in_progress" }, "Room item updated.")}><RefreshCw aria-hidden="true" /> Start</button><button type="button" className="rooms-live-primary-action" onClick={() => void action({ action: "update_record", recordId: record.id, status: "completed" }, "Room item completed.")}><CheckCircle2 aria-hidden="true" /> Complete</button>{moduleKey === "requests" && record.createdBy === currentUserId ? <button type="button" className="rooms-live-secondary-action" onClick={() => void action({ action: "update_record", recordId: record.id, status: "cancelled" }, "Request cancelled.")}><Trash2 aria-hidden="true" /> Cancel</button> : null}</div> : null}</div> : null}
      {!["resources", "directory", "knowledge", "services", "tasks", "requests", "member-workflows"].includes(moduleKey) && Object.keys(metadata).length ? <pre className="room-phase3-metadata">{JSON.stringify(metadata, null, 2)}</pre> : null}
    </article>
  );
}

function SettingsView({ moduleKey, data, working, onSave }) {
  const source = data ?? {};
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [inviteOnly, setInviteOnly] = useState(true);
  const [allowMemberPosts, setAllowMemberPosts] = useState(true);
  const [directoryVisible, setDirectoryVisible] = useState(true);
  const [inviteApproval, setInviteApproval] = useState(false);
  const [domains, setDomains] = useState("");
  const [defaultRole, setDefaultRole] = useState("member");

  useEffect(() => {
    setName(source.room?.name ?? "");
    setDescription(source.room?.description ?? "");
    setInviteOnly(source.room?.inviteOnly ?? true);
    setAllowMemberPosts(source.settings?.allowMemberPosts ?? true);
    setDirectoryVisible(source.settings?.memberDirectoryVisible ?? true);
    setInviteApproval(source.settings?.inviteRequiresApproval ?? false);
    setDomains((source.settings?.allowedEmailDomains ?? []).join("\n"));
    setDefaultRole(source.settings?.defaultInviteRole ?? "member");
  }, [data]);

  const core = moduleKey === "settings";
  return (
    <form className="room-tier-create-card" onSubmit={(event) => { event.preventDefault(); void onSave({ room: { name, description, inviteOnly }, settings: { allowMemberPosts, memberDirectoryVisible: directoryVisible, inviteRequiresApproval: inviteApproval, allowedEmailDomains: domains.split(/\n|,/).map((item) => item.trim()).filter(Boolean), defaultInviteRole: defaultRole } }); }}>
      {source.modelProfile ? <section className="room-tier-create-heading"><ShieldCheck aria-hidden="true" /><div><p className="rooms-live-eyebrow">{source.modelProfile.title}</p><h3>{source.modelProfile.workflowSummary}</h3><p>{source.modelProfile.defaultAccessSummary}</p></div></section> : null}
      {core ? <><label><span>Room name</span><input value={name} onChange={(event) => setName(event.target.value)} minLength={3} maxLength={80} required /></label><label><span>Room purpose</span><textarea value={description} onChange={(event) => setDescription(event.target.value)} rows={5} minLength={10} maxLength={600} required /></label><label className="room-tier-checkbox"><input type="checkbox" checked={inviteOnly} onChange={(event) => setInviteOnly(event.target.checked)} /><span>Keep this Room invite-only</span></label></> : <><label className="room-tier-checkbox"><input type="checkbox" checked={allowMemberPosts} onChange={(event) => setAllowMemberPosts(event.target.checked)} /><span>Allow ordinary members to create discussions</span></label><label className="room-tier-checkbox"><input type="checkbox" checked={directoryVisible} onChange={(event) => setDirectoryVisible(event.target.checked)} /><span>Allow members to view the private directory</span></label><label className="room-tier-checkbox"><input type="checkbox" checked={inviteApproval} onChange={(event) => setInviteApproval(event.target.checked)} /><span>Require approval after invitation redemption</span></label><label><span>Allowed email domains, one per line</span><textarea rows={5} value={domains} onChange={(event) => setDomains(event.target.value)} /></label><label><span>Default invitation role</span><select value={defaultRole} onChange={(event) => setDefaultRole(event.target.value)}><option value="member">Member</option><option value="moderator">Moderator</option></select></label></>}
      <button type="submit" className="rooms-live-primary-action" disabled={working}>{working ? <Loader2 aria-hidden="true" className="is-spinning" /> : <Settings aria-hidden="true" />}{working ? "Saving…" : "Save settings"}</button>
    </form>
  );
}

function InvitesView({ data, working, onCreate, onRevoke, onReview }) {
  const source = data ?? {};
  const [label, setLabel] = useState("Room invitation");
  const [role, setRole] = useState("member");
  const [maxUses, setMaxUses] = useState("25");
  const [expiresAt, setExpiresAt] = useState("");
  const pending = (source.joinRequests ?? []).filter((request) => request.state === "pending");
  return (
    <div className="room-tier-records-layout">
      <section className="room-tier-create-card"><h3>Pending join requests</h3>{pending.length === 0 ? <p>No pending join requests.</p> : <div className="room-tier-record-grid">{pending.map((request) => <article key={request.id} className="room-tier-record-card"><span className="room-tier-record-chip">Pending</span><h3>{displayName(request.applicant, request.applicantId)}</h3>{request.note ? <p>{request.note}</p> : null}<div className="room-tier-inline-actions"><button type="button" className="rooms-live-primary-action" onClick={() => void onReview(request.id, "approved")}><CheckCircle2 aria-hidden="true" /> Approve</button><button type="button" className="rooms-live-secondary-action" onClick={() => void onReview(request.id, "declined")}><Trash2 aria-hidden="true" /> Decline</button></div></article>)}</div>}</section>
      <form className="room-tier-create-card" onSubmit={(event) => { event.preventDefault(); void onCreate({ label, role, maxUses: Number(maxUses) || null, expiresAt: expiresAt || null }); }}><h3>Create a secure invitation</h3><div className="room-tier-form-grid"><label><span>Label</span><input value={label} onChange={(event) => setLabel(event.target.value)} /></label><label><span>Role</span><select value={role} onChange={(event) => setRole(event.target.value)}><option value="member">Member</option><option value="moderator">Moderator</option></select></label><label><span>Maximum uses</span><input type="number" min={1} max={10000} value={maxUses} onChange={(event) => setMaxUses(event.target.value)} /></label><label><span>Expiration</span><input type="datetime-local" value={expiresAt} onChange={(event) => setExpiresAt(event.target.value)} /></label></div><button type="submit" className="rooms-live-primary-action" disabled={working}>{working ? <Loader2 aria-hidden="true" className="is-spinning" /> : <Copy aria-hidden="true" />}{working ? "Creating…" : "Create and copy link"}</button></form>
      <div className="room-tier-record-grid">{(source.invites ?? []).map((invite) => <article key={invite.id} className="room-tier-record-card"><div className="room-tier-record-topline"><span className="room-tier-record-chip">{invite.revokedAt ? "Revoked" : "Active"}</span><small>{formatDate(invite.createdAt)}</small></div><h3>{invite.label}</h3><p>Role: {invite.role} · Uses: {invite.useCount}{invite.maxUses === null ? "" : ` of ${invite.maxUses}`}</p>{!invite.revokedAt ? <button type="button" className="rooms-live-secondary-action" onClick={() => void onRevoke(invite.id)}><Trash2 aria-hidden="true" /> Revoke</button> : null}</article>)}</div>
    </div>
  );
}

function ActivityView({ entries }) {
  if (!entries.length) return <div className="room-tier-empty-state"><ScrollText aria-hidden="true" /><h3>No audit activity yet</h3><p>Privileged Room actions will appear here.</p></div>;
  return <div className="room-tier-activity-list">{entries.map((entry, index) => <article key={entry.id ?? index}><ScrollText aria-hidden="true" /><div><strong>{entry.action?.replaceAll(".", " ")}</strong><span>{displayName(entry.actor, entry.actorId ?? "System")} · {entry.targetType}</span></div><small>{formatDate(entry.createdAt)}</small></article>)}</div>;
}

function OperationsView({ moduleKey, data }) {
  const source = data ?? {};
  const summary = source.summary ?? {};
  const labels = { posts: "Discussions", events: "Events", announcements: "Announcements", members: "Members", joinRequests: "Pending join requests", requests: "Operational requests", records: "Module records", resources: "Stored files" };
  return <div className="room-tier-operations-layout"><section className="room-tier-operation-summary">{Object.entries(labels).map(([key, itemLabel]) => <article key={key}><span>{itemLabel}</span><strong>{summary[key] ?? "Unavailable"}</strong></article>)}</section><section className="room-tier-create-card"><h3>{moduleKey === "community-operations" ? "Private community operating boundary" : moduleKey === "admin-tools" ? "Administrative operating view" : "Room operations"}</h3><p>These totals are read from the Room’s verified private data.</p><div className="room-tier-record-details"><span>Plan: {source.plan?.label ?? "Room plan"}</span><span>Member capacity: {source.plan?.memberLimit ?? "Custom"}</span><span>Included Rooms: {source.plan?.roomLimit ?? "Custom"}</span></div></section></div>;
}

function HighCapacityView({ data, page, search, setPage, setSearch, reload }) {
  const source = data ?? {};
  const members = source.members ?? [];
  const pageSize = source.pageSize ?? 50;
  const total = source.total ?? members.length;
  return <div className="room-tier-records-layout"><form className="room-tier-search-card" onSubmit={(event) => { event.preventDefault(); setPage(1); reload(1, search); }}><label><span>Search members</span><input value={search} onChange={(event) => setSearch(event.target.value)} /></label><button type="submit" className="rooms-live-secondary-action"><RefreshCw aria-hidden="true" /> Search</button></form><div className="room-tier-capacity-summary"><strong>{total}</strong><span>active members · page {page}</span></div><div className="room-tier-member-list">{members.map((member) => <article key={member.id || member.userId}><div><strong>{displayName(member.profile, member.userId)}</strong><span>{member.profile?.username ? `@${member.profile.username}` : member.userId}</span></div><span className="room-tier-record-chip">{member.role}</span></article>)}</div><div className="room-tier-inline-actions"><button type="button" className="rooms-live-secondary-action" disabled={page <= 1} onClick={() => { const next = Math.max(1, page - 1); setPage(next); reload(next, search); }}>Previous</button><button type="button" className="rooms-live-secondary-action" disabled={page * pageSize >= total} onClick={() => { const next = page + 1; setPage(next); reload(next, search); }}>Next</button></div></div>;
}
