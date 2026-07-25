"use client";

import { UserCog } from "lucide-react";
import { useState } from "react";
import { RoomCorePagination } from "@/components/room-core-pagination";
import { formatDate } from "@/components/room-operations-panel-shared";

const ROLE_OPTIONS = [
  ["member", "Member"],
  ["moderator", "Moderator"],
  ["administrator", "Administrator"],
];
const MEMBER_ACTIONS = [
  ["activate", "Restore access"],
  ["mute", "Mute posting"],
  ["suspend", "Suspend access"],
  ["block", "Block"],
  ["remove", "Remove"],
];
function MemberRow({ member, ownerId, access, working, onAction }) {
  const [role, setRole] = useState(
    member.role === "owner" ? "member" : member.role
  );
  const [memberAction, setMemberAction] = useState("activate");
  const [hours, setHours] = useState(24);
  const [note, setNote] = useState(member.moderationNote || "");
  const owner = member.userId === ownerId || member.role === "owner";
  const restrictedAdmin =
    access.role === "administrator" && member.role === "administrator";

  async function save() {
    await onAction(
      "member_action",
      {
        memberId: member.id,
        role,
        memberAction,
        durationHours: hours,
        note,
      },
      `${member.displayName}'s Room access was updated.`
    );
  }

  return (
    <article className="room-operation-member">
      <div>
        <strong>{member.displayName}</strong>
        <span>
          {member.profile?.username ? `@${member.profile.username}` : member.userId}
        </span>
        <small>
          {member.role} · {member.status} · joined {formatDate(member.joinedAt)}
        </small>
        {member.mutedUntil ? (
          <em>Muted until {formatDate(member.mutedUntil)}</em>
        ) : null}
        {member.suspendedUntil ? (
          <em>Suspended until {formatDate(member.suspendedUntil)}</em>
        ) : null}
      </div>

      {owner ? (
        <b>Owner</b>
      ) : restrictedAdmin ? (
        <b>Administrator</b>
      ) : (
        <div className="room-operation-member-controls">
          <select value={role} onChange={(event) => setRole(event.target.value)}>
            {ROLE_OPTIONS.filter(
              ([value]) => access.isOwner || value !== "administrator"
            ).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          <select
            value={memberAction}
            onChange={(event) => setMemberAction(event.target.value)}
          >
            {MEMBER_ACTIONS.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          {memberAction === "mute" || memberAction === "suspend" ? (
            <input
              type="number"
              min="1"
              max="8760"
              value={hours}
              onChange={(event) => setHours(Number(event.target.value))}
              aria-label="Duration in hours"
            />
          ) : null}
          <input
            value={note}
            maxLength={2000}
            onChange={(event) => setNote(event.target.value)}
            placeholder="Private administrator note"
          />
          <button
            type="button"
            onClick={save}
            disabled={working === "member_action"}
          >
            <UserCog aria-hidden="true" />
            Save
          </button>
        </div>
      )}
    </article>
  );
}
export function MembersView({ payload, access, loading, working, onAction, onPageChange }) {
  const members = payload.members || [];
  return (
    <div className="room-operation-stack">
      <header className="room-operation-section-heading">
        <div>
          <h3>Members and access controls</h3>
          <p>
            Change roles, mute posting, suspend access, block, remove, restore,
            and keep private administrator notes.
          </p>
        </div>
        <span>{payload.pageInfo?.totalItems ?? members.length} members</span>
      </header>
      {members.map((member) => (
        <MemberRow
          key={member.id}
          member={member}
          ownerId={payload.room.ownerId}
          access={access}
          working={working}
          onAction={onAction}
        />
      ))}
      <RoomCorePagination
        pageInfo={payload.pageInfo}
        loading={loading}
        onPageChange={onPageChange}
        itemLabel="members"
      />
    </div>
  );
}
