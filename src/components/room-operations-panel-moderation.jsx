"use client";

import { CheckCircle2, RefreshCw, Trash2 } from "lucide-react";
import { RoomCorePagination } from "@/components/room-core-pagination";
import { formatDate } from "@/components/room-operations-panel-shared";

function ModerationQueue({ payload, access, working, onAction }) {
  const reports = payload.reports || [];
  const removedTargets = payload.removedTargets || [];
  return (
    <div className="room-operation-stack">
      <section>
        <h3>Pending reports</h3>
        {reports.length ? (
          reports.map((report) => {
            const canRemove =
              access.canManage ||
              ["room_post", "room_member"].includes(report.targetType);
            return (
              <article className="room-operation-report" key={report.id}>
                <header>
                  <strong>{report.targetLabel}</strong>
                  <span>
                    {report.reason} · {formatDate(report.createdAt)}
                  </span>
                </header>
                {report.targetSnapshot ? <p>{report.targetSnapshot}</p> : null}
                {report.details ? (
                  <small>Reporter note: {report.details}</small>
                ) : null}
                <div>
                  <button
                    type="button"
                    onClick={() =>
                      onAction(
                        "resolve_report",
                        {
                          reportId: report.id,
                          state: "resolved",
                          moderationAction: "",
                          resolutionNote: "Reviewed and resolved.",
                        },
                        "Report resolved."
                      )
                    }
                    disabled={working === "resolve_report"}
                  >
                    <CheckCircle2 aria-hidden="true" />
                    Resolve
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      onAction(
                        "resolve_report",
                        {
                          reportId: report.id,
                          state: "dismissed",
                          moderationAction: "",
                          resolutionNote: "Reviewed and dismissed.",
                        },
                        "Report dismissed."
                      )
                    }
                    disabled={working === "resolve_report"}
                  >
                    Dismiss
                  </button>
                  {canRemove ? (
                    <button
                      className="is-danger"
                      type="button"
                      onClick={() =>
                        onAction(
                          "resolve_report",
                          {
                            reportId: report.id,
                            state: "actioned",
                            moderationAction: "remove_target",
                            resolutionNote:
                              "Reported target removed or blocked.",
                          },
                          "Moderation action completed."
                        )
                      }
                      disabled={working === "resolve_report"}
                    >
                      <Trash2 aria-hidden="true" />
                      Remove target
                    </button>
                  ) : null}
                </div>
              </article>
            );
          })
        ) : (
          <p className="room-operation-empty">No pending moderation reports.</p>
        )}
      </section>

      {access.canManage ? (
        <section>
          <h3>Removed content recovery</h3>
          {payload.recoveryCapped ? (
            <p className="room-core-limit-warning" role="status">
              Recovery shows the newest bounded set of removed discussions and
              archived Room records.
            </p>
          ) : null}
          {removedTargets.length ? (
            removedTargets.map((item) => (
              <article
                className="room-operation-removed"
                key={`${item.targetType}:${item.targetId}`}
              >
                <div>
                  <strong>{item.label}</strong>
                  <span>
                    {item.reason || "Removed by Room moderation"} ·{" "}
                    {formatDate(item.removedAt)}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    onAction(
                      "restore_target",
                      {
                        targetType: item.targetType,
                        targetId: item.targetId,
                      },
                      "Room content restored."
                    )
                  }
                  disabled={working === "restore_target"}
                >
                  <RefreshCw aria-hidden="true" />
                  Restore
                </button>
              </article>
            ))
          ) : (
            <p className="room-operation-empty">
              No recoverable Room content.
            </p>
          )}
        </section>
      ) : null}
    </div>
  );
}

export function ModerationView({ payload, access, loading, working, onAction, onPageChange }) {
  return (
    <>
      <ModerationQueue payload={payload} access={access} working={working} onAction={onAction} />
      <RoomCorePagination
        pageInfo={payload.pageInfo}
        loading={loading}
        onPageChange={onPageChange}
        itemLabel="pending reports"
      />
    </>
  );
}
