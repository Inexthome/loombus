"use client";

import { Archive, CheckCircle2, CreditCard, Download, Flag, Gauge, Loader2, LogOut, RefreshCw, Shield, Trash2, UserCog, Users } from "lucide-react";
import { useMemo, useState } from "react";

const REASONS = [
  ["spam", "Spam"], ["harassment", "Harassment"], ["safety", "Safety concern"],
  ["privacy", "Privacy"], ["misinformation", "Misinformation"],
  ["inappropriate", "Inappropriate content"], ["other", "Other"],
];
const ROLE_OPTIONS = [["member", "Member"], ["moderator", "Moderator"], ["administrator", "Administrator"]];
const MEMBER_ACTIONS = [["activate", "Restore access"], ["mute", "Mute posting"], ["suspend", "Suspend access"], ["block", "Block"], ["remove", "Remove"]];

function formatDate(value) {
  if (!value) return "Not recorded";
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" }).format(date) : "Not recorded";
}
function formatBytes(value) {
  const amount = Number(value) || 0;
  if (amount < 1024) return `${amount} B`;
  const units = ["KB", "MB", "GB", "TB"]; let size = amount / 1024, index = 0;
  while (size >= 1024 && index < units.length - 1) { size /= 1024; index += 1; }
  return `${size >= 10 ? size.toFixed(0) : size.toFixed(1)} ${units[index]}`;
}
function ratio(used, limit) { return limit ? Math.min(100, Math.round((used / limit) * 100)) : 0; }
function profileName(profile, fallback = "Room member") { return profile?.full_name?.trim() || profile?.username?.trim() || fallback; }

function UsageCard({ label, used, limit, detail, bytes = false }) {
  const percent = ratio(used, limit);
  const shownUsed = bytes ? formatBytes(used) : used;
  const shownLimit = limit == null ? null : bytes ? formatBytes(limit) : limit;
  return <article className="room-operation-metric"><span>{label}</span><strong>{shownUsed}{shownLimit ? ` / ${shownLimit}` : ""}</strong><div><i style={{ width: `${percent}%` }} /></div><small>{detail}</small></article>;
}

function ReportForm({ items, working, onAction }) {
  const [target, setTarget] = useState(""); const [reason, setReason] = useState("safety"); const [details, setDetails] = useState("");
  async function submit(event) {
    event.preventDefault();
    const [targetType, targetId] = target.split(":");
    const ok = await onAction("report_content", { targetType, targetId, reason, details }, "Room report submitted privately.");
    if (ok) { setTarget(""); setDetails(""); }
  }
  return <form className="room-operation-form" onSubmit={submit}>
    <h3>Report Room content or a member</h3>
    <label><span>Room item</span><select value={target} onChange={(event) => setTarget(event.target.value)} required><option value="">Choose an item</option>{items.map((item) => <option key={`${item.targetType}:${item.targetId}`} value={`${item.targetType}:${item.targetId}`}>{item.label} · {item.context}</option>)}</select></label>
    <label><span>Reason</span><select value={reason} onChange={(event) => setReason(event.target.value)}>{REASONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
    <label><span>Details</span><textarea rows={4} maxLength={2000} value={details} onChange={(event) => setDetails(event.target.value)} placeholder="Explain what Room moderators should review" /></label>
    <button type="submit" disabled={!target || working === "report_content"}>{working === "report_content" ? <Loader2 className="is-spinning" /> : <Flag />} Submit report</button>
  </form>;
}

function MemberRow({ member, ownerId, access, working, onAction }) {
  const [role, setRole] = useState(member.role === "owner" ? "member" : member.role);
  const [memberAction, setMemberAction] = useState("activate");
  const [hours, setHours] = useState(24); const [note, setNote] = useState(member.moderationNote || "");
  const owner = member.userId === ownerId || member.role === "owner";
  const restrictedAdmin = access.role === "administrator" && member.role === "administrator";
  async function save() {
    await onAction("member_action", { memberId: member.id, role, memberAction, durationHours: hours, note }, `${member.displayName}'s Room access was updated.`);
  }
  return <article className="room-operation-member">
    <div><strong>{member.displayName}</strong><span>{member.profile?.username ? `@${member.profile.username}` : member.userId}</span><small>{member.role} · {member.status} · joined {formatDate(member.joinedAt)}</small>{member.mutedUntil ? <em>Muted until {formatDate(member.mutedUntil)}</em> : null}{member.suspendedUntil ? <em>Suspended until {formatDate(member.suspendedUntil)}</em> : null}</div>
    {owner ? <b>Owner</b> : restrictedAdmin ? <b>Administrator</b> : <div className="room-operation-member-controls">
      <select value={role} onChange={(event) => setRole(event.target.value)}>{ROLE_OPTIONS.filter(([value]) => access.isOwner || value !== "administrator").map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
      <select value={memberAction} onChange={(event) => setMemberAction(event.target.value)}>{MEMBER_ACTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
      {(memberAction === "mute" || memberAction === "suspend") ? <input type="number" min="1" max="8760" value={hours} onChange={(event) => setHours(Number(event.target.value))} aria-label="Duration in hours" /> : null}
      <input value={note} maxLength={2000} onChange={(event) => setNote(event.target.value)} placeholder="Private administrator note" />
      <button type="button" onClick={save} disabled={working === "member_action"}><UserCog /> Save</button>
    </div>}
  </article>;
}

function ModerationQueue({ management, access, working, onAction }) {
  const pending = management.reports.filter((report) => report.state === "pending");
  return <div className="room-operation-stack">
    <section><h3>Pending reports</h3>{pending.length ? pending.map((report) => {
      const canRemove = access.canManage || ["room_post", "room_member"].includes(report.targetType);
      return <article className="room-operation-report" key={report.id}><header><strong>{report.targetLabel}</strong><span>{report.reason} · {formatDate(report.createdAt)}</span></header>{report.targetSnapshot ? <p>{report.targetSnapshot}</p> : null}{report.details ? <small>Reporter note: {report.details}</small> : null}<div><button type="button" onClick={() => onAction("resolve_report", { reportId: report.id, state: "resolved", moderationAction: "", resolutionNote: "Reviewed and resolved." }, "Report resolved.")} disabled={working === "resolve_report"}><CheckCircle2 /> Resolve</button><button type="button" onClick={() => onAction("resolve_report", { reportId: report.id, state: "dismissed", moderationAction: "", resolutionNote: "Reviewed and dismissed." }, "Report dismissed.")} disabled={working === "resolve_report"}>Dismiss</button>{canRemove ? <button className="is-danger" type="button" onClick={() => onAction("resolve_report", { reportId: report.id, state: "actioned", moderationAction: "remove_target", resolutionNote: "Reported target removed or blocked." }, "Moderation action completed.")} disabled={working === "resolve_report"}><Trash2 /> Remove target</button> : null}</div></article>;
    }) : <p className="room-operation-empty">No pending moderation reports.</p>}</section>
    {access.canManage ? <section><h3>Removed content recovery</h3>{management.removedTargets.length ? management.removedTargets.map((item) => <article className="room-operation-removed" key={`${item.targetType}:${item.targetId}`}><div><strong>{item.label}</strong><span>{item.reason || "Removed by Room moderation"} · {formatDate(item.removedAt)}</span></div><button type="button" onClick={() => onAction("restore_target", { targetType: item.targetType, targetId: item.targetId }, "Room content restored.")} disabled={working === "restore_target"}><RefreshCw /> Restore</button></article>) : <p className="room-operation-empty">No recoverable Room content.</p>}</section> : null}
  </div>;
}

function Lifecycle({ payload, working, onAction, onExport }) {
  const room = payload.room, members = payload.management?.members || [];
  const candidates = members.filter((member) => member.userId !== room.ownerId && member.status === "active" && (!member.suspendedUntil || new Date(member.suspendedUntil).getTime() <= Date.now()));
  const [nextOwnerId, setNextOwnerId] = useState(""); const [confirmName, setConfirmName] = useState(""); const [reason, setReason] = useState("");
  const paidActive = room.subscriptionPlan !== "free" && ["active", "trialing"].includes(room.subscriptionStatus);
  return <div className="room-operation-stack">
    <section className="room-operation-card"><h3>Billing and data</h3><p>{room.planLabel} · subscription {room.subscriptionStatus}{room.currentPeriodEnd ? ` · renews ${formatDate(room.currentPeriodEnd)}` : ""}</p><div className="room-operation-actions">{room.hasBillingPortal ? <button type="button" onClick={() => onAction("open_billing_portal", {}, "Opening secure Stripe Billing.")} disabled={working === "open_billing_portal"}><CreditCard /> Manage billing</button> : null}<button type="button" onClick={onExport} disabled={working === "export"}><Download /> Export Room data</button></div></section>
    <section className="room-operation-card"><h3>Transfer ownership</h3><p>The next owner must be an active member. Active paid billing must be canceled first so the previous owner’s Stripe account is never transferred.</p><select value={nextOwnerId} onChange={(event) => setNextOwnerId(event.target.value)} disabled={paidActive}><option value="">Choose the next owner</option>{candidates.map((member) => <option key={member.userId} value={member.userId}>{member.displayName}</option>)}</select><button type="button" disabled={!nextOwnerId || paidActive || working === "transfer_ownership"} onClick={() => window.confirm("Transfer permanent Room ownership?") && onAction("transfer_ownership", { nextOwnerId }, "Room ownership transferred.")}><Users /> Transfer ownership</button>{paidActive ? <small>Cancel this Room subscription in Stripe Billing before transfer.</small> : null}</section>
    <section className="room-operation-card"><h3>Archive and restore</h3><p>Archived Rooms remain private and readable, but database controls block new posts, events, uploads, records, responses, applications, and invitations.</p>{room.status === "archived" ? <button type="button" onClick={() => onAction("unarchive_room", {}, "Room restored to active operation.")} disabled={working === "unarchive_room"}><RefreshCw /> Restore Room</button> : <button type="button" onClick={() => onAction("archive_room", {}, "Room archived and made read-only.")} disabled={working === "archive_room"}><Archive /> Archive Room</button>}</section>
    <section className="room-operation-card is-danger"><h3>Deletion recovery</h3>{room.status === "pending_deletion" ? <><p>Deletion is scheduled for {formatDate(room.deletionScheduledFor)}. The Room can be restored during this recovery period.</p><button type="button" onClick={() => onAction("restore_deletion", {}, "Room deletion canceled.")} disabled={working === "restore_deletion"}><RefreshCw /> Cancel deletion</button>{room.deletionScheduledFor && new Date(room.deletionScheduledFor).getTime() <= Date.now() ? <button type="button" className="is-danger" onClick={() => window.confirm("Permanently delete this Room and all private data?") && onAction("delete_now", {}, "Room permanently deleted.")} disabled={working === "delete_now"}><Trash2 /> Delete permanently</button> : null}</> : <><p>Scheduling deletion starts a 30-day recovery period. Enter the exact Room name to continue.</p><input value={confirmName} onChange={(event) => setConfirmName(event.target.value)} placeholder={room.name} /><textarea rows={3} value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Optional private deletion reason" /><button type="button" className="is-danger" disabled={confirmName !== room.name || working === "schedule_deletion"} onClick={() => onAction("schedule_deletion", { confirmName, reason }, "Room deletion scheduled with a 30-day recovery period.")}><Trash2 /> Schedule deletion</button></>}</section>
  </div>;
}

export function RoomOperationsPanel({ payload, working, onAction, onExport, onRefresh }) {
  const access = payload.access, management = payload.management;
  const initial = access.canModerate ? "moderation" : "report";
  const [tab, setTab] = useState(initial);
  const tabs = useMemo(() => [
    ["overview", "Overview", Gauge, Boolean(management && access.canManage)],
    ["report", "Report", Flag, true],
    ["members", "Members", Users, Boolean(management && access.canManage)],
    ["moderation", "Moderation", Shield, Boolean(management && access.canModerate)],
    ["lifecycle", "Lifecycle", Archive, Boolean(management && access.isOwner)],
  ].filter((item) => item[3]), [access, management]);
  return <>
    <nav className="room-operation-tabs">{tabs.map(([value, label, Icon]) => <button type="button" key={value} aria-pressed={tab === value} onClick={() => setTab(value)}><Icon /> {label}{value === "moderation" && management?.pendingReportCount ? <strong>{management.pendingReportCount}</strong> : null}</button>)}</nav>
    {tab === "overview" && management ? <div className="room-operation-stack"><section className="room-operation-usage"><UsageCard label="Members" used={management.usage.membersUsed} limit={management.usage.memberLimit} detail="Active members in this Room" /><UsageCard label="Storage" used={management.usage.storageUsedBytes} limit={management.usage.storageLimitBytes || null} bytes detail={`${management.usage.fileCount} private files`} /><UsageCard label="Included Rooms" used={management.usage.includedRoomsUsed} limit={management.usage.includedRoomLimit} detail={`${management.usage.pendingRequests} pending requests · ${management.usage.discussionCount} discussions`} /></section><button type="button" className="room-operation-refresh" onClick={onRefresh}><RefreshCw /> Refresh usage</button></div> : null}
    {tab === "report" ? <div className="room-operation-grid"><ReportForm items={payload.reportables || []} working={working} onAction={onAction} /><section><h3>Your recent reports</h3>{payload.ownReports?.length ? payload.ownReports.map((report) => <article className="room-operation-own-report" key={report.id}><strong>{report.targetLabel}</strong><span>{report.reason} · {report.state}</span><small>{formatDate(report.createdAt)}</small></article>) : <p className="room-operation-empty">No Room reports submitted.</p>}<button type="button" className="room-operation-leave" onClick={() => window.confirm("Leave this private Room?") && onAction("leave_room", {}, "You left the Room.")} disabled={access.isOwner || working === "leave_room"}><LogOut /> Leave Room</button></section></div> : null}
    {tab === "members" && management ? <div className="room-operation-stack"><header className="room-operation-section-heading"><div><h3>Members and access controls</h3><p>Change roles, mute posting, suspend access, block, remove, restore, and keep private administrator notes.</p></div><span>{management.members.length}{management.membersCapped ? "+" : ""} loaded</span></header>{management.members.map((member) => <MemberRow key={member.id} member={member} ownerId={payload.room.ownerId} access={access} working={working} onAction={onAction} />)}</div> : null}
    {tab === "moderation" && management ? <ModerationQueue management={management} access={access} working={working} onAction={onAction} /> : null}
    {tab === "lifecycle" && management ? <Lifecycle payload={payload} working={working} onAction={onAction} onExport={onExport} /> : null}
  </>;
}
