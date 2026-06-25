import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

type RoomRow = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  room_type: string;
  visibility: string;
  status: string;
  member_count: number | null;
  discussion_count: number | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
};

function getBearerToken(request: NextRequest) {
  const authHeader = request.headers.get("authorization");

  if (!authHeader?.startsWith("Bearer ")) {
    return null;
  }

  return authHeader.replace("Bearer ", "").trim() || null;
}

function normalizeLimit(value: string | null) {
  const parsed = Number.parseInt(value ?? "20", 10);

  if (Number.isNaN(parsed)) {
    return 20;
  }

  return Math.min(Math.max(parsed, 1), 50);
}

export async function GET(request: NextRequest) {
  try {
    const token = getBearerToken(request);
    const searchParams = request.nextUrl.searchParams;
    const limit = normalizeLimit(searchParams.get("limit"));
    const roomType = searchParams.get("type");

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      token
        ? {
            global: {
              headers: {
                Authorization: `Bearer ${token}`,
              },
            },
          }
        : undefined
    );

    let query = supabase
      .from("loombus_rooms")
      .select("id, slug, name, description, room_type, visibility, status, member_count, discussion_count, metadata, created_at, updated_at")
      .eq("status", "active")
      .order("updated_at", { ascending: false })
      .limit(limit);

    if (roomType) {
      query = query.eq("room_type", roomType);
    }

    const { data: rooms, error } = await query;

    if (error) {
      console.error("V2 rooms lookup failed:", error.message);

      return NextResponse.json({ rooms: [], configured: false });
    }

    return NextResponse.json({
      rooms: ((rooms ?? []) as RoomRow[]).map((room) => ({
        id: room.id,
        slug: room.slug,
        name: room.name,
        description: room.description ?? "",
        type: room.room_type,
        visibility: room.visibility,
        memberCount: room.member_count ?? 0,
        discussionCount: room.discussion_count ?? 0,
        metadata: room.metadata ?? {},
        updatedAt: room.updated_at,
      })),
      configured: true,
    });
  } catch (error) {
    console.error("Unexpected V2 rooms API failure:", error);

    return NextResponse.json({ rooms: [], configured: false }, { status: 200 });
  }
}
