import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { NextRequest } from "next/server";

export type RoomRole = "owner" | "administrator" | "moderator" | "member";
export type RoomRow = Record<string, unknown>;

export type RoomProfile = {
  id: string;
  username: string | null;
  full_name: string | null;
  avatar_url: string | null;
  account_status: string | null;
};

export type NormalizedRoom = {
  id: string;
  name: string;
  description: string;
  roomType: string;
  visibility: string;
  inviteOnly: boolean;
  status: string;
  ownerId: string;
  createdBy: string;
  templateKey: string;
  subscriptionPlan: string;
  subscriptionStatus: string;
  memberLimit: number | null;
  createdAt: string | null;
  updatedAt: string | null;
};

export type RoomAccess = {
  room: NormalizedRoom;
  rawRoom: RoomRow;
  role: RoomRole | null;
  membershipId: string | null;
  membershipStatus: string | null;
  membershipMutedUntil: string | null;
  membershipSuspendedUntil: string | null;
  allowed: boolean;
  isOwner: boolean;
  canManage: boolean;
  canModerate: boolean;
};

export function createRequestSupabase(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Missing Supabase request configuration.");
  }

  const authorization = request.headers.get("authorization") ?? "";

  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
    global: {
      headers: authorization ? { Authorization: authorization } : {},
    },
  });
}

export function createRoomServiceSupabase() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Missing Rooms service configuration.");
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

export function asString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export function asNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

export function asBoolean(value: unknown) {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    return ["true", "private", "locked", "invite_only"].includes(
      value.toLowerCase()
    );
  }
  return false;
}

function normalizedDate(value: unknown) {
  const raw = asString(value);
  if (!raw) return null;
  const date = new Date(raw);
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
}

export function normalizeRoom(row: RoomRow): NormalizedRoom {
  const visibility =
    asString(row.visibility).toLowerCase() ||
    (asBoolean(row.invite_only) || asBoolean(row.is_private)
      ? "private"
      : "private");

  return {
    id: asString(row.id) || asString(row.room_id),
    name:
      asString(row.name) ||
      asString(row.title) ||
      asString(row.display_name) ||
      "Untitled room",
    description:
      asString(row.description) ||
      asString(row.summary) ||
      asString(row.about) ||
      "Private Loombus room.",
    roomType:
      asString(row.room_type) ||
      asString(row.type) ||
      asString(row.category) ||
      "community",
    visibility,
    inviteOnly:
      asBoolean(row.invite_only) ||
      asBoolean(row.is_private) ||
      visibility !== "public",
    status: asString(row.status) || "active",
    ownerId: asString(row.owner_id),
    createdBy: asString(row.created_by),
    templateKey: asString(row.template_key),
    subscriptionPlan: asString(row.subscription_plan) || "free",
    subscriptionStatus: asString(row.subscription_status) || "active",
    memberLimit:
      row.member_limit === null || row.member_limit === undefined
        ? null
        : asNumber(row.member_limit),
    createdAt: asString(row.created_at) || null,
    updatedAt:
      asString(row.last_activity_at) ||
      asString(row.updated_at) ||
      asString(row.created_at) ||
      null,
  };
}

export function normalizeRole(value: unknown, isOwner = false): RoomRole {
  if (isOwner) return "owner";
  const role = asString(value).toLowerCase();
  if (role === "owner") return "owner";
  if (role === "admin" || role === "administrator") return "administrator";
  if (role === "moderator") return "moderator";
  return "member";
}

export async function getRoomAccess(
  serviceSupabase: SupabaseClient,
  roomId: string,
  userId: string
): Promise<RoomAccess | null> {
  const roomResult = await serviceSupabase
    .from("rooms")
    .select("*")
    .eq("id", roomId)
    .maybeSingle();

  if (roomResult.error) {
    throw new Error(roomResult.error.message || "Unable to load the room.");
  }

  if (!roomResult.data) return null;

  const rawRoom = roomResult.data as RoomRow;
  const room = normalizeRoom(rawRoom);
  const isOwner = room.ownerId === userId || room.createdBy === userId;

  const membershipResult = await serviceSupabase
    .from("room_members")
    .select("*")
    .eq("room_id", roomId)
    .eq("user_id", userId)
    .maybeSingle();

  if (membershipResult.error) {
    throw new Error(
      membershipResult.error.message || "Unable to verify room membership."
    );
  }

  const membership = (membershipResult.data ?? null) as RoomRow | null;
  const membershipStatus = membership
    ? asString(membership.status) || "active"
    : null;
  const membershipMutedUntil = membership
    ? normalizedDate(membership.muted_until)
    : null;
  const membershipSuspendedUntil = membership
    ? normalizedDate(membership.suspended_until)
    : null;
  const isSuspended =
    membershipSuspendedUntil !== null &&
    new Date(membershipSuspendedUntil).getTime() > Date.now();
  const membershipIsActive =
    membership !== null &&
    !["blocked", "removed", "inactive"].includes(
      membershipStatus?.toLowerCase() ?? ""
    ) &&
    !isSuspended;
  const role = isOwner
    ? "owner"
    : membershipIsActive
      ? normalizeRole(membership?.role)
      : null;
  const allowed = isOwner || membershipIsActive;

  return {
    room,
    rawRoom,
    role,
    membershipId: membership ? asString(membership.id) || null : null,
    membershipStatus,
    membershipMutedUntil,
    membershipSuspendedUntil,
    allowed,
    isOwner,
    canManage: role === "owner" || role === "administrator",
    canModerate:
      role === "owner" || role === "administrator" || role === "moderator",
  };
}

export async function loadProfiles(
  serviceSupabase: SupabaseClient,
  userIds: string[]
) {
  const uniqueIds = [...new Set(userIds.filter(Boolean))];
  if (uniqueIds.length === 0) return new Map<string, RoomProfile>();

  const profileResult = await serviceSupabase
    .from("profiles")
    .select("id, username, full_name, avatar_url, account_status")
    .in("id", uniqueIds);

  if (profileResult.error) {
    throw new Error(
      profileResult.error.message || "Unable to load room member profiles."
    );
  }

  const profiles = (profileResult.data ?? []) as RoomProfile[];
  return new Map(profiles.map((profile) => [profile.id, profile]));
}

export function profileFor(
  profiles: Map<string, RoomProfile>,
  userId: string
): RoomProfile | null {
  return profiles.get(userId) ?? null;
}

export function safeRoomActionRole(access: RoomAccess) {
  return access.role ?? "member";
}
