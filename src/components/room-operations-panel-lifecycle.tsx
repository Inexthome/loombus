"use client";

import { Archive, CreditCard, Download, RefreshCw, Trash2, Users } from "lucide-react";
import { useState } from "react";
import { formatDate, UsageCard } from "@/components/room-operations-panel-shared";

export function Lifecycle({ payload, working, onAction, onExport }) {
  const room = payload.room;
  const candidates = payload.candidates || [];
  const [nextOwnerId, setNextOwnerId] = useState("");
  const [confirmName, setConfirmName] = useState("");
  const [reason, setReason] = useState("");
  const paidActive =
    room.subscriptionPlan !== "free" &&
    ["active", "trialing"].includes(room.subscriptionStatus);

  return (
    <div className="room-operation-stack">
      <section className="room-operation-card">
        <h3>Billing and data</h3>
        <p>
          {room.planLabel} · subscription {room.subscriptionStatus}
          {room.currentPeriodEnd
            ? ` · renews ${formatDate(room.currentPeriodEnd)}`
            : ""}
        </p>
        <div className="room-operation-actions">
          {room.hasBillingPortal ? (
            <button
              type="button"
              onClick={() =>
                onAction(
                  "open_billing_portal",
                  {},
                  "Opening secure Stripe Billing."
                )
              }
              disabled={working === "open_billing_portal"}
            >
              <CreditCard aria-hidden="true" />
              Manage billing
            </button>
          ) : null}
          <button
            type="button"
            onClick={onExport}
            disabled={working === "export"}
          >
            <Download aria-hidden="true" />
            Export Room data
          </button>
        </div>
      </section>

      <section className="room-operation-card">
        <h3>Transfer ownership</h3>
        <p>
          The next owner must be an active member. Active paid billing must be
          canceled first so the previous owner&apos;s Stripe account is never
          transferred.
        </p>
        {payload.candidatesCapped ? (
          <p className="room-core-limit-warning" role="status">
            The transfer list reached its private safety limit. Reduce Room
            membership before transferring to an older member not shown here.
          </p>
        ) : null}
        <select
          value={nextOwnerId}
          onChange={(event) => setNextOwnerId(event.target.value)}
          disabled={paidActive}
        >
          <option value="">Choose the next owner</option>
          {candidates.map((member) => (
            <option key={member.userId} value={member.userId}>
              {member.displayName}
            </option>
          ))}
        </select>
        <button
          type="button"
          disabled={
            !nextOwnerId || paidActive || working === "transfer_ownership"
          }
          onClick={() =>
            window.confirm("Transfer permanent Room ownership?") &&
            onAction(
              "transfer_ownership",
              { nextOwnerId },
              "Room ownership transferred."
            )
          }
        >
          <Users aria-hidden="true" />
          Transfer ownership
        </button>
        {paidActive ? (
          <small>
            Cancel this Room subscription in Stripe Billing before transfer.
          </small>
        ) : null}
      </section>

      <section className="room-operation-card">
        <h3>Archive and restore</h3>
        <p>
          Archived Rooms remain private and readable, but database controls
          block new posts, events, uploads, records, responses, applications,
          and invitations.
        </p>
        {room.status === "archived" ? (
          <button
            type="button"
            onClick={() =>
              onAction(
                "unarchive_room",
                {},
                "Room restored to active operation."
              )
            }
            disabled={working === "unarchive_room"}
          >
            <RefreshCw aria-hidden="true" />
            Restore Room
          </button>
        ) : (
          <button
            type="button"
            onClick={() =>
              onAction("archive_room", {}, "Room archived and made read-only.")
            }
            disabled={working === "archive_room"}
          >
            <Archive aria-hidden="true" />
            Archive Room
          </button>
        )}
      </section>

      <section className="room-operation-card is-danger">
        <h3>Deletion recovery</h3>
        {room.status === "pending_deletion" ? (
          <>
            <p>
              Deletion is scheduled for {formatDate(room.deletionScheduledFor)}.
              The Room can be restored during this recovery period.
            </p>
            <button
              type="button"
              onClick={() =>
                onAction(
                  "restore_deletion",
                  {},
                  "Room deletion canceled."
                )
              }
              disabled={working === "restore_deletion"}
            >
              <RefreshCw aria-hidden="true" />
              Cancel deletion
            </button>
            {room.deletionScheduledFor &&
            new Date(room.deletionScheduledFor).getTime() <= Date.now() ? (
              <button
                type="button"
                className="is-danger"
                onClick={() =>
                  window.confirm(
                    "Permanently delete this Room and all private data?"
                  ) &&
                  onAction(
                    "delete_now",
                    {},
                    "Room permanently deleted."
                  )
                }
                disabled={working === "delete_now"}
              >
                <Trash2 aria-hidden="true" />
                Delete permanently
              </button>
            ) : null}
          </>
        ) : (
          <>
            <p>
              Scheduling deletion starts a 30-day recovery period. Enter the
              exact Room name to continue.
            </p>
            <input
              value={confirmName}
              onChange={(event) => setConfirmName(event.target.value)}
              placeholder={room.name}
            />
            <textarea
              rows={3}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder="Optional private deletion reason"
            />
            <button
              type="button"
              className="is-danger"
              disabled={working === "schedule_deletion"}
              onClick={() =>
                onAction(
                  "schedule_deletion",
                  { confirmName, reason },
                  "Room deletion scheduled with a 30-day recovery period."
                )
              }
            >
              <Trash2 aria-hidden="true" />
              Schedule deletion
            </button>
          </>
        )}
      </section>
    </div>
  );
}

export function Overview({ payload }) {
  const usage = payload.usage;
  if (!usage) return null;
  return (
    <div className="room-operation-stack">
      <section className="room-operation-usage">
        <UsageCard
          label="Members"
          used={usage.membersUsed}
          limit={usage.memberLimit}
          detail="Active members in this Room"
        />
        <UsageCard
          label="Storage"
          used={usage.storageUsedBytes}
          limit={usage.storageLimitBytes || null}
          bytes
          detail={`${usage.fileCount} private files`}
        />
        <UsageCard
          label="Included Rooms"
          used={usage.includedRoomsUsed}
          limit={usage.includedRoomLimit}
          detail={`${usage.pendingRequests} pending requests · ${usage.discussionCount} discussions`}
        />
      </section>
    </div>
  );
}
