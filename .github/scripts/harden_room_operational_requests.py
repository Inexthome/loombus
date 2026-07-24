from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    file_path = Path(path)
    text = file_path.read_text()
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f"{path}: expected one match, found {count}")
    file_path.write_text(text.replace(old, new, 1))


replace_once(
    "src/app/api/rooms/[roomId]/modules/route.ts",
    '''        if (!access.canManage && assignedRequest && !assigneeStatuses.includes(status)) {
          return jsonError("The assignee cannot apply that request status.", 403);
        }
        if (
          !access.canManage &&
          !assignedRequest &&
          requestAuthor &&
          status !== "cancelled"
        ) {
          return jsonError("Request authors may only cancel their request.", 403);
        }
        updates.status = status;''',
    '''        if (
          !access.canManage &&
          requestAuthor &&
          status === "cancelled"
        ) {
          updates.status = status;
        } else if (
          !access.canManage &&
          assignedRequest &&
          !assigneeStatuses.includes(status)
        ) {
          return jsonError("The assignee cannot apply that request status.", 403);
        } else if (!access.canManage && requestAuthor && !assignedRequest) {
          return jsonError("Request authors may only cancel their request.", 403);
        } else {
          updates.status = status;
        }''',
)

replace_once(
    "src/components/room-tier-modules-workspace.tsx",
    '''              {canManage ? (
                <button
                  type="button"
                  className="rooms-live-secondary-action"
                  onClick={() => void onUpdate({ status: "declined" })}
                >
                  <Trash2 aria-hidden="true" /> Decline
                </button>
              ) : null}''',
    '''              {canManage ? (
                <>
                  <button
                    type="button"
                    className="rooms-live-secondary-action"
                    onClick={() => void onUpdate({ status: "declined" })}
                  >
                    <Trash2 aria-hidden="true" /> Decline
                  </button>
                  {record.createdBy !== currentUserId ? (
                    <button
                      type="button"
                      className="rooms-live-secondary-action"
                      onClick={() => void onUpdate({ status: "cancelled" })}
                    >
                      <Trash2 aria-hidden="true" /> Cancel
                    </button>
                  ) : null}
                </>
              ) : null}''',
)

replace_once(
    "docs/rooms-entitlement-repair-order.md",
    "- Room owners and administrators may assign, reprioritize, complete, decline, or cancel requests.",
    "- Room owners and administrators may assign requests and control their validated workflow status.",
)
