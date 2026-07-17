import "server-only";

import { ROOM_RESOURCE_BUCKET, SIGNED_RESOURCE_SECONDS, ensureRoomModule, serializeEvent, serializePlan, serializeResource, ExpansionError } from "@/lib/room-expansion-service";
import { asString } from "@/lib/room-operations";

export async function loadCalendar(service, roomId, access, userId) {
  ensureRoomModule(access, "calendar");
  if (!["pro", "organization", "organization-plus", "enterprise"].includes(serializePlan(access).id)) {
    throw new ExpansionError("Expanded calendar operations begin with Room Pro.", 403);
  }
  const eventsResult = await service
    .from("room_events")
    .select("*")
    .eq("room_id", roomId)
    .order("starts_at", { ascending: true })
    .limit(500);
  if (eventsResult.error) throw new ExpansionError(eventsResult.error.message, 503);
  const events = (eventsResult.data ?? []).map(serializeEvent);
  const ids = events.map((event) => event.id);
  const rsvpResult = ids.length
    ? await service
        .from("room_event_rsvps")
        .select("*")
        .eq("room_id", roomId)
        .in("event_id", ids)
    : { data: [], error: null };
  if (rsvpResult.error) throw new ExpansionError(rsvpResult.error.message, 503);
  const rsvps = rsvpResult.data ?? [];
  return events.map((event) => {
    const matching = rsvps.filter((rsvp) => asString(rsvp.event_id) === event.id);
    const counts = { going: 0, maybe: 0, declined: 0, waitlist: 0 };
    for (const rsvp of matching) {
      const status = asString(rsvp.status);
      if (status in counts) counts[status] += 1;
    }
    const own = matching.find((rsvp) => asString(rsvp.user_id) === userId);
    return {
      ...event,
      rsvpCounts: counts,
      ownRsvp: own
        ? {
            status: asString(own.status),
            note: asString(own.note),
            updatedAt: asString(own.updated_at) || null,
          }
        : null,
    };
  });
}

export async function loadFiles(service, roomId, access, userId) {
  const plan = ensureRoomModule(access, "files");
  const result = await service
    .from("room_resources")
    .select("*")
    .eq("room_id", roomId)
    .order("created_at", { ascending: false })
    .limit(1000);
  if (result.error) throw new ExpansionError(result.error.message, 503);
  const rows = result.data ?? [];
  const resources = await Promise.all(
    rows.map(async (row) => {
      const signed = await service.storage
        .from(ROOM_RESOURCE_BUCKET)
        .createSignedUrl(asString(row.storage_path), SIGNED_RESOURCE_SECONDS);
      return serializeResource(
        row,
        signed.data?.signedUrl ?? null,
        access.canManage || asString(row.uploaded_by) === userId
      );
    })
  );
  const usedBytes = resources.reduce((total, resource) => total + resource.fileSizeBytes, 0);
  return { resources, usedBytes, plan };
}
