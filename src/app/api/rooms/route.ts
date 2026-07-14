import { NextResponse, type NextRequest } from "next/server";
import { verifyRequestAccountAccess } from "@/lib/request-account-access";
import {
  asString,
  createRequestSupabase,
  createRoomServiceSupabase,
  normalizeRole,
  normalizeRoom,
  type RoomRow,
} from "@/lib/room-operations";

function jsonError(message: string, status: number, code?: string) {
  return NextResponse.json(code ? { error: message, code } : { error: message }, {
    status,
    headers: { "Cache-Control": "private, no-store" },
  });
}

function incrementCount(counts: Record<string, number>, roomId: string) {
  if (!roomId) return;
  counts[roomId] = (counts[roomId] ?? 0) + 1;
}

export async function GET(request: NextRequest) {
  let requestSupabase;
  let serviceSupabase;

  try {
    requestSupabase = createRequestSupabase(request);
    serviceSupabase = createRoomServiceSupabase();
  } catch {
    return jsonError("Rooms service is not configured.", 500);
  }

  const accountAccess = await verifyRequestAccountAccess(requestSupabase);

  if (!accountAccess.ok) {
    return jsonError(
      accountAccess.error,
      accountAccess.status,
      accountAccess.code
    );
  }

  const userId = accountAccess.user.id;
  const [membershipResult, ownedResult] = await Promise.all([
    serviceSupabase
      .from("room_members")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false }),
    serviceSupabase
      .from("rooms")
      .select("*")
      .or(`owner_id.eq.${userId},created_by.eq.${userId}`)
      .order("updated_at", { ascending: false }),
  ]);

  if (membershipResult.error) {
    return jsonError(
      membershipResult.error.message || "Unable to load room memberships.",
      503,
      "rooms_storage_unavailable"
    );
  }

  if (ownedResult.error) {
    return jsonError(
      ownedResult.error.message || "Unable to load owned rooms.",
      503,
      "rooms_storage_unavailable"
    );
  }

  const memberships = ((membershipResult.data ?? []) as RoomRow[]).filter(
    (membership) =>
      !["blocked", "removed", "inactive"].includes(
        asString(membership.status).toLowerCase()
      )
  );
  const membershipRoomIds = memberships
    .map((membership) => asString(membership.room_id))
    .filter(Boolean);

  let joinedRooms: RoomRow[] = [];

  if (membershipRoomIds.length > 0) {
    const joinedResult = await serviceSupabase
      .from("rooms")
      .select("*")
      .in("id", [...new Set(membershipRoomIds)])
      .order("updated_at", { ascending: false });

    if (joinedResult.error) {
      return jsonError(
        joinedResult.error.message || "Unable to load joined rooms.",
        503,
        "rooms_storage_unavailable"
      );
    }

    joinedRooms = (joinedResult.data ?? []) as RoomRow[];
  }

  const roomRows = new Map<string, RoomRow>();
  for (const room of [
    ...((ownedResult.data ?? []) as RoomRow[]),
    ...joinedRooms,
  ]) {
    const roomId = asString(room.id);
    if (roomId) roomRows.set(roomId, room);
  }

  const roomIds = [...roomRows.keys()];
  const memberCounts: Record<string, number> = {};
  const postCounts: Record<string, number> = {};
  const eventCounts: Record<string, number> = {};
  const announcementCounts: Record<string, number> = {};
  const nextEvents: Record<string, RoomRow> = {};
  const latestActivity: Record<string, string> = {};

  if (roomIds.length > 0) {
    const now = new Date().toISOString();
    const [membersResult, postsResult, eventsResult, announcementsResult] =
      await Promise.all([
        serviceSupabase
          .from("room_members")
          .select("room_id, status")
          .in("room_id", roomIds),
        serviceSupabase
          .from("room_posts")
          .select("room_id, created_at, deleted_at")
          .in("room_id", roomIds)
          .is("deleted_at", null)
          .order("created_at", { ascending: false })
          .limit(1000),
        serviceSupabase
          .from("room_events")
          .select("id, room_id, title, starts_at, ends_at, location")
          .in("room_id", roomIds)
          .gte("starts_at", now)
          .order("starts_at", { ascending: true })
          .limit(500),
        serviceSupabase
          .from("room_announcements")
          .select("room_id, created_at")
          .in("room_id", roomIds)
          .order("created_at", { ascending: false })
          .limit(500),
      ]);

    if (membersResult.error) {
      return jsonError(
        membersResult.error.message || "Unable to load room member counts.",
        503,
        "rooms_storage_unavailable"
      );
    }

    if (postsResult.error) {
      return jsonError(
        postsResult.error.message || "Unable to load room discussion counts.",
        503,
        "rooms_storage_unavailable"
      );
    }

    if (eventsResult.error) {
      return jsonError(
        eventsResult.error.message || "Unable to load room events.",
        503,
        "rooms_storage_unavailable"
      );
    }

    if (announcementsResult.error) {
      return jsonError(
        announcementsResult.error.message || "Unable to load room announcements.",
        503,
        "rooms_storage_unavailable"
      );
    }

    for (const row of (membersResult.data ?? []) as RoomRow[]) {
      const status = asString(row.status).toLowerCase();
      if (["blocked", "removed", "inactive"].includes(status)) continue;
      incrementCount(memberCounts, asString(row.room_id));
    }

    for (const row of (postsResult.data ?? []) as RoomRow[]) {
      const roomId = asString(row.room_id);
      incrementCount(postCounts, roomId);
      const createdAt = asString(row.created_at);
      if (roomId && createdAt && !latestActivity[roomId]) {
        latestActivity[roomId] = createdAt;
      }
    }

    for (const row of (eventsResult.data ?? []) as RoomRow[]) {
      const roomId = asString(row.room_id);
      incrementCount(eventCounts, roomId);
      if (roomId && !nextEvents[roomId]) nextEvents[roomId] = row;
    }

    for (const row of (announcementsResult.data ?? []) as RoomRow[]) {
      incrementCount(announcementCounts, asString(row.room_id));
    }
  }

  const membershipByRoom = new Map(
    memberships.map((membership) => [asString(membership.room_id), membership])
  );

  const rooms = [...roomRows.values()]
    .map((row) => {
      const room = normalizeRoom(row);
      const isOwner = room.ownerId === userId || room.createdBy === userId;
      const membership = membershipByRoom.get(room.id);
      const role = normalizeRole(membership?.role, isOwner);
      const nextEvent = nextEvents[room.id];

      return {
        ...room,
        role,
        memberCount: Math.max(memberCounts[room.id] ?? 0, isOwner ? 1 : 0),
        postCount: postCounts[room.id] ?? 0,
        eventCount: eventCounts[room.id] ?? 0,
        announcementCount: announcementCounts[room.id] ?? 0,
        latestActivityAt: latestActivity[room.id] ?? room.updatedAt,
        nextEvent: nextEvent
          ? {
              id: asString(nextEvent.id),
              title: asString(nextEvent.title) || "Room event",
              startsAt: asString(nextEvent.starts_at),
              endsAt: asString(nextEvent.ends_at) || null,
              location: asString(nextEvent.location) || null,
            }
          : null,
      };
    })
    .filter((room) => room.id)
    .sort((left, right) => {
      const leftTime = new Date(left.latestActivityAt ?? 0).getTime();
      const rightTime = new Date(right.latestActivityAt ?? 0).getTime();
      return rightTime - leftTime;
    });

  return NextResponse.json(
    {
      generatedAt: new Date().toISOString(),
      currentUserId: userId,
      rooms,
      summary: {
        total: rooms.length,
        owned: rooms.filter((room) => room.role === "owner").length,
        joined: rooms.filter((room) => room.role !== "owner").length,
        upcomingEvents: rooms.filter((room) => Boolean(room.nextEvent)).length,
      },
    },
    {
      headers: { "Cache-Control": "private, no-store" },
    }
  );
}
