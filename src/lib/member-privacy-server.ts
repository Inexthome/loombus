import "server-only";

import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";
import type { NextRequest } from "next/server";

export type MemberPrivacySettings = {
  user_id: string;
  private_account: boolean;
  discoverable: boolean;
  show_view_identity: boolean;
  created_at?: string;
  updated_at?: string;
};

export const DEFAULT_MEMBER_PRIVACY = {
  private_account: false,
  discoverable: true,
  show_view_identity: true,
} as const;

export const HIDDEN_ACCOUNT_STATUSES = new Set([
  "blocked",
  "deleted",
  "deactivated",
  "suspended",
  "banned",
  "pending_deletion",
  "deletion_requested",
]);

export function createMemberPrivacyServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return null;

  return createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export function createMemberPrivacyRequestClient(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const authorization = request.headers.get("authorization") ?? "";
  if (!url || !anonKey || !authorization) return null;

  return createClient(url, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { headers: { Authorization: authorization } },
  });
}

export async function requireMemberUser(request: NextRequest) {
  const requestClient = createMemberPrivacyRequestClient(request);
  if (!requestClient) return { user: null, requestClient: null };
  const { data, error } = await requestClient.auth.getUser();
  return { user: error ? null : data.user, requestClient };
}

export async function getMemberPrivacy(
  service: SupabaseClient,
  userId: string
): Promise<MemberPrivacySettings> {
  const { data } = await service
    .from("member_privacy_settings")
    .select("user_id, private_account, discoverable, show_view_identity, created_at, updated_at")
    .eq("user_id", userId)
    .maybeSingle();

  return {
    user_id: userId,
    private_account: data?.private_account ?? DEFAULT_MEMBER_PRIVACY.private_account,
    discoverable: data?.discoverable ?? DEFAULT_MEMBER_PRIVACY.discoverable,
    show_view_identity: data?.show_view_identity ?? DEFAULT_MEMBER_PRIVACY.show_view_identity,
    created_at: data?.created_at,
    updated_at: data?.updated_at,
  };
}

export async function isAdmin(service: SupabaseClient, userId: string) {
  const { data } = await service
    .from("profiles")
    .select("is_admin")
    .eq("id", userId)
    .maybeSingle();
  return Boolean(data?.is_admin);
}

export async function hasBlockRelationship(
  service: SupabaseClient,
  firstUserId: string,
  secondUserId: string
) {
  const { data } = await service
    .from("user_blocks")
    .select("id")
    .or(
      `and(blocker_id.eq.${firstUserId},blocked_id.eq.${secondUserId}),and(blocker_id.eq.${secondUserId},blocked_id.eq.${firstUserId})`
    )
    .limit(1)
    .maybeSingle();
  return Boolean(data);
}

export async function isFollower(
  service: SupabaseClient,
  followerId: string,
  targetId: string
) {
  const { data } = await service
    .from("follows")
    .select("id")
    .eq("follower_id", followerId)
    .eq("following_id", targetId)
    .maybeSingle();
  return Boolean(data);
}

export async function canViewMemberProfile(
  service: SupabaseClient,
  profileId: string,
  viewer: User
) {
  if (profileId === viewer.id) return true;
  if (await isAdmin(service, viewer.id)) return true;
  if (await hasBlockRelationship(service, profileId, viewer.id)) return false;
  const privacy = await getMemberPrivacy(service, profileId);
  if (!privacy.private_account) return true;
  return isFollower(service, viewer.id, profileId);
}

export function isActiveAccountStatus(value: unknown) {
  const normalized = String(value ?? "active").trim().toLowerCase();
  return !HIDDEN_ACCOUNT_STATUSES.has(normalized);
}

export function safePageNumber(value: string | null, fallback = 1) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(1, Math.floor(parsed));
}

export function safePageSize(value: string | null, fallback = 24, maximum = 50) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(maximum, Math.max(1, Math.floor(parsed)));
}
