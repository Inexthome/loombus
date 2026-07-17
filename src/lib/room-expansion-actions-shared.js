import "server-only";

import { ExpansionError, validUuid } from "@/lib/room-expansion-service";

export function requireManage(access) {
  if (!access.canManage) throw new ExpansionError("Room management access is required.", 403);
}

export function activeRoom(access) {
  if (access.room.status !== "active") {
    throw new ExpansionError("This Room is read-only while archived or pending deletion.", 409, "room_read_only");
  }
}

export async function getRecord(service, roomId, recordId, moduleKey) {
  if (!validUuid(recordId)) throw new ExpansionError("Invalid Room item.", 400);
  const result = await service.from("room_module_records").select("*")
    .eq("id", recordId).eq("room_id", roomId).eq("module_key", moduleKey)
    .is("archived_at", null).maybeSingle();
  if (result.error) throw new ExpansionError(result.error.message, 503);
  if (!result.data) throw new ExpansionError("Room item not found.", 404);
  return result.data;
}
