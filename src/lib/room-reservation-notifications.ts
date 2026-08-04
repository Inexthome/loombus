import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { createNotification, createNotifications } from "@/lib/notifications";
import type { RoomAccess } from "@/lib/room-operations";

type Reservation = {
  id?: string;
  resourceId?: string;
  requesterId?: string;
  requestedStart?: string;
  timezone?: string;
  status?: string;
};

type NotificationAction = "request" | "manager_action" | "cancel_own";

type Input = Record<string, unknown>;

function text(value: unknown, fallback = "") {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function formatStart(value: unknown, timezone: unknown) {
  const date = new Date(text(value));
  if (!Number.isFinite(date.getTime())) return "the requested time";
  try {
    return new Intl.DateTimeFormat(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      timeZone: text(timezone, "UTC"),
    }).format(date);
  } catch {
    return date.toLocaleString();
  }
}

async function roomManagerIds(service: SupabaseClient, roomId: string) {
  const [roomResult, memberResult] = await Promise.all([
    service.from("rooms").select("owner_id").eq("id", roomId).maybeSingle(),
    service
      .from("room_members")
      .select("user_id")
      .eq("room_id", roomId)
      .eq("status", "active")
      .in("role", ["owner", "administrator"]),
  ]);

  const ids = new Set<string>();
  const ownerId = text(roomResult.data?.owner_id);
  if (ownerId) ids.add(ownerId);
  for (const member of memberResult.data ?? []) {
    const id = text(member.user_id);
    if (id) ids.add(id);
  }
  return [...ids];
}

async function resourceName(
  service: SupabaseClient,
  roomId: string,
  resourceId: string
) {
  if (!resourceId) return "facility";
  const { data } = await service
    .from("room_reservable_resources")
    .select("name")
    .eq("id", resourceId)
    .eq("room_id", roomId)
    .maybeSingle();
  return text(data?.name, "facility");
}

export async function notifyRoomReservationLifecycle(options: {
  service: SupabaseClient;
  access: RoomAccess;
  actorId: string;
  action: NotificationAction;
  input: Input;
  reservation: Reservation | null | undefined;
}) {
  const { service, access, actorId, action, input, reservation } = options;
  const reservationId = text(reservation?.id);
  const requesterId = text(reservation?.requesterId);
  if (!reservationId || !requesterId) return;

  const roomId = access.room.id;
  const roomName = access.room.name || "Room";
  const facility = await resourceName(
    service,
    roomId,
    text(reservation?.resourceId)
  );
  const starts = formatStart(reservation?.requestedStart, reservation?.timezone);
  const target = {
    actor_id: actorId,
    target_type: "room_reservation",
    target_id: reservationId,
    room_id: roomId,
  };

  if (action === "request") {
    if (reservation.status === "accepted") {
      await createNotification({
        ...target,
        user_id: requesterId,
        type: "room_reservation_confirmed",
        message: `${facility} reservation in ${roomName} is confirmed for ${starts}.`,
      });
      return;
    }

    const managers = (await roomManagerIds(service, roomId)).filter(
      (id) => id !== requesterId
    );
    await createNotifications(
      managers.map((userId) => ({
        ...target,
        user_id: userId,
        type: "room_reservation_requested",
        message: `New ${facility} reservation request in ${roomName} for ${starts}.`,
      }))
    );
    return;
  }

  if (action === "manager_action") {
    const decision = text(input.decision);
    const labels: Record<string, { type: string; verb: string }> = {
      accept: { type: "room_reservation_approved", verb: "approved" },
      decline: { type: "room_reservation_declined", verb: "declined" },
      cancel: { type: "room_reservation_cancelled", verb: "cancelled" },
      complete: { type: "room_reservation_completed", verb: "marked complete" },
    };
    const label = labels[decision];
    if (!label || requesterId === actorId) return;
    await createNotification({
      ...target,
      user_id: requesterId,
      type: label.type,
      message: `Your ${facility} reservation in ${roomName} was ${label.verb}.`,
    });
    return;
  }

  const managers = (await roomManagerIds(service, roomId)).filter(
    (id) => id !== actorId
  );
  await createNotifications(
    managers.map((userId) => ({
      ...target,
      user_id: userId,
      type: "room_reservation_cancelled_by_member",
      message: `${facility} reservation in ${roomName} for ${starts} was cancelled by the member.`,
    }))
  );
}
