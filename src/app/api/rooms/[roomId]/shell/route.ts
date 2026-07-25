import { NextResponse, type NextRequest } from "next/server";
import { getRoomPlanEntitlements } from "@/lib/room-plan-entitlements";
import {
  asString,
  createRequestSupabase,
  createRoomServiceSupabase,
  getRoomAccess,
  type RoomRow,
} from "@/lib/room-operations";
import { verifyRequestAccountAccess } from "@/lib/request-account-access";

type RouteContext = { params: Promise<{ roomId: string }> };

function json(data: unknown, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: { "Cache-Control": "private, no-store" },
  });
}

function validUuid(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value
    )
  );
}

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const account = await verifyRequestAccountAccess(createRequestSupabase(request));
    if (!account.ok) return json({ error: account.error, code: account.code }, account.status);

    const { roomId } = await context.params;
    if (!validUuid(roomId)) return json({ error: "Invalid Room id." }, 400);

    const service = createRoomServiceSupabase();
    const access = await getRoomAccess(service, roomId, account.user.id).catch(() => null);
    if (!access) return json({ error: "Room not found." }, 404);
    if (!access.allowed && !access.isOwner) {
      return json({ error: "Active Room membership is required." }, 403);
    }

    const now = new Date().toISOString();
    const [members, posts, events, announcements, nextEvent, pinnedAnnouncement] =
      await Promise.all([
        service
          .from("room_members")
          .select("id", { count: "exact", head: true })
          .eq("room_id", roomId)
          .not("status", "in", "(blocked,removed,inactive)"),
        service
          .from("room_posts")
          .select("id", { count: "exact", head: true })
          .eq("room_id", roomId)
          .is("deleted_at", null),
        service
          .from("room_events")
          .select("id", { count: "exact", head: true })
          .eq("room_id", roomId)
          .gte("starts_at", now)
          .neq("status", "cancelled"),
        service
          .from("room_announcements")
          .select("id", { count: "exact", head: true })
          .eq("room_id", roomId),
        service
          .from("room_events")
          .select("id, title, starts_at, ends_at, location")
          .eq("room_id", roomId)
          .gte("starts_at", now)
          .neq("status", "cancelled")
          .order("starts_at", { ascending: true })
          .limit(1),
        service
          .from("room_announcements")
          .select("id, title, priority, created_at")
          .eq("room_id", roomId)
          .eq("is_pinned", true)
          .order("created_at", { ascending: false })
          .limit(1),
      ]);

    const failed = [members, posts, events, announcements, nextEvent, pinnedAnnouncement].find(
      (result) => result.error
    );
    if (failed?.error) {
      return json({ error: failed.error.message || "Room shell could not be loaded." }, 503);
    }

    let pendingApplications = 0;
    if (access.canManage) {
      const result = await service
        .from("room_applications")
        .select("id", { count: "exact", head: true })
        .eq("room_id", roomId)
        .eq("state", "pending");
      if (result.error) return json({ error: result.error.message }, 503);
      pendingApplications = result.count ?? 0;
    }

    const plan = getRoomPlanEntitlements(
      access.room.subscriptionPlan,
      access.room.subscriptionStatus
    );
    const rawRoom = access.rawRoom as RoomRow;
    const nextEventRow = (nextEvent.data?.[0] ?? null) as RoomRow | null;
    const announcementRow = (pinnedAnnouncement.data?.[0] ?? null) as RoomRow | null;

    return json({
      room: {
        id: access.room.id,
        name: access.room.name,
        description: asString(rawRoom.description),
        roomType: access.room.roomType,
        status: asString(rawRoom.status) || "active",
        subscriptionPlan: access.room.subscriptionPlan,
        subscriptionStatus: access.room.subscriptionStatus,
        plan: { id: plan.id, label: plan.label },
      },
      access: {
        allowed: access.allowed,
        role: access.role,
        isOwner: access.isOwner,
        canManage: access.canManage,
        canModerate: access.canModerate,
        operationsEnabled: plan.modules.includes("operations"),
      },
      metrics: {
        members: Math.max(members.count ?? 0, access.isOwner ? 1 : 0),
        discussions: posts.count ?? 0,
        upcomingEvents: events.count ?? 0,
        announcements: announcements.count ?? 0,
        pendingApplications,
      },
      nextEvent: nextEventRow
        ? {
            id: asString(nextEventRow.id),
            title: asString(nextEventRow.title),
            startsAt: asString(nextEventRow.starts_at),
            endsAt: asString(nextEventRow.ends_at) || null,
            location: asString(nextEventRow.location) || null,
          }
        : null,
      pinnedAnnouncement: announcementRow
        ? {
            id: asString(announcementRow.id),
            title: asString(announcementRow.title),
            priority: asString(announcementRow.priority) || "normal",
            createdAt: asString(announcementRow.created_at) || null,
          }
        : null,
    });
  } catch {
    return json({ error: "Rooms service is not configured." }, 500);
  }
}
