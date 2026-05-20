type BlockRow = {
  blocker_id: string;
  blocked_id: string;
};

export type NotificationActorRef = {
  actor_id: string | null;
};

export async function getBlockedRelationshipUserIds(
  supabase: any,
  userId: string
) {
  const { data: blockRows } = await supabase
    .from("user_blocks")
    .select("blocker_id, blocked_id")
    .or(`blocker_id.eq.${userId},blocked_id.eq.${userId}`);

  const blockedRelationshipUserIds = new Set<string>();

  for (const block of (blockRows ?? []) as BlockRow[]) {
    blockedRelationshipUserIds.add(
      block.blocker_id === userId ? block.blocked_id : block.blocker_id
    );
  }

  return blockedRelationshipUserIds;
}

export function filterBlockedActorNotifications<T extends NotificationActorRef>(
  notifications: T[],
  blockedRelationshipUserIds: Set<string>
) {
  return notifications.filter(
    (notification) =>
      !notification.actor_id || !blockedRelationshipUserIds.has(notification.actor_id)
  );
}
