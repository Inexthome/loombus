"use client";

import { Flag, Loader2, LogOut } from "lucide-react";
import { useState } from "react";
import { RoomCorePagination } from "@/components/room-core-pagination";
import { formatDate } from "@/components/room-operations-panel-shared";

const REASONS = [
  ["spam", "Spam"],
  ["harassment", "Harassment"],
  ["safety", "Safety concern"],
  ["privacy", "Privacy"],
  ["misinformation", "Misinformation"],
  ["inappropriate", "Inappropriate content"],
  ["other", "Other"],
];
function ReportForm({ items, capped, working, onAction }) {
  const [target, setTarget] = useState("");
  const [reason, setReason] = useState("safety");
  const [details, setDetails] = useState("");

  async function submit(event) {
    event.preventDefault();
    const [targetType, targetId] = target.split(":");
    const ok = await onAction(
      "report_content",
      { targetType, targetId, reason, details },
      "Room report submitted privately."
    );
    if (ok) {
      setTarget("");
      setDetails("");
    }
  }

  return (
    <form className="room-operation-form" onSubmit={submit}>
      <h3>Report Room content or a member</h3>
      {capped ? (
        <p className="room-core-limit-warning" role="status">
          The report menu shows the newest bounded set of Room items. Open the
          item directly before reporting older content.
        </p>
      ) : null}
      <label>
        <span>Room item</span>
        <select
          value={target}
          onChange={(event) => setTarget(event.target.value)}
          required
        >
          <option value="">Choose an item</option>
          {items.map((item) => (
            <option
              key={`${item.targetType}:${item.targetId}`}
              value={`${item.targetType}:${item.targetId}`}
            >
              {item.label} · {item.context}
            </option>
          ))}
        </select>
      </label>
      <label>
        <span>Reason</span>
        <select
          value={reason}
          onChange={(event) => setReason(event.target.value)}
        >
          {REASONS.map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </label>
      <label>
        <span>Details</span>
        <textarea
          rows={4}
          maxLength={2000}
          value={details}
          onChange={(event) => setDetails(event.target.value)}
          placeholder="Explain what Room moderators should review"
        />
      </label>
      <button
        type="submit"
        disabled={!target || working === "report_content"}
      >
        {working === "report_content" ? (
          <Loader2 className="is-spinning" aria-hidden="true" />
        ) : (
          <Flag aria-hidden="true" />
        )}
        Submit report
      </button>
    </form>
  );
}
export function ReportView({ payload, access, loading, working, onAction, onPageChange }) {
  const reports = payload.ownReports || [];
  return (
    <div className="room-operation-grid">
      <ReportForm
        items={payload.reportables || []}
        capped={payload.reportablesCapped}
        working={working}
        onAction={onAction}
      />
      <section>
        <h3>Your recent reports</h3>
        {reports.length ? (
          reports.map((report) => (
            <article className="room-operation-own-report" key={report.id}>
              <strong>{report.targetLabel}</strong>
              <span>
                {report.reason} · {report.state}
              </span>
              <small>{formatDate(report.createdAt)}</small>
            </article>
          ))
        ) : (
          <p className="room-operation-empty">No Room reports submitted.</p>
        )}
        <RoomCorePagination
          pageInfo={payload.pageInfo}
          loading={loading}
          onPageChange={onPageChange}
          itemLabel="reports"
        />
        <button
          type="button"
          className="room-operation-leave"
          onClick={() =>
            window.confirm("Leave this private Room?") &&
            onAction("leave_room", {}, "You left the Room.")
          }
          disabled={access.isOwner || working === "leave_room"}
        >
          <LogOut aria-hidden="true" />
          Leave Room
        </button>
      </section>
    </div>
  );
}
