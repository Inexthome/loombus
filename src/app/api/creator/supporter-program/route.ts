import { NextRequest, NextResponse } from "next/server";
import { getAccountEnforcementResult } from "@/lib/account-enforcement";
import {
  createMemberPrivacyServiceClient,
  requireMemberUser,
} from "@/lib/member-privacy-server";

type ProfileAccess = {
  account_status: string | null;
  enforcement_reason: string | null;
  suspended_until: string | null;
  is_admin: boolean | null;
};

type SupporterTierInput = {
  id?: string | null;
  name?: string | null;
  description?: string | null;
  benefits?: string[] | null;
  roomId?: string | null;
};

type MembershipRow = {
  id: string;
  supporter_id: string;
  tier_id: string | null;
  joined_at: string;
};

type ProfileSummary = {
  id: string;
  full_name: string | null;
  username: string | null;
  avatar_url: string | null;
};

function jsonError(message: string, status: number) {
  return NextResponse.json(
    { error: message },
    { status, headers: { "Cache-Control": "private, no-store" } }
  );
}

function cleanTierInput(value: unknown): SupporterTierInput[] {
  if (!Array.isArray(value)) return [];

  return value.slice(0, 4).map((item) => {
    const record =
      item && typeof item === "object"
        ? (item as Record<string, unknown>)
        : {};
    const benefits = Array.isArray(record.benefits)
      ? record.benefits
          .filter((benefit): benefit is string => typeof benefit === "string")
          .map((benefit) => benefit.trim())
          .filter(Boolean)
          .slice(0, 8)
      : [];

    return {
      id: typeof record.id === "string" ? record.id : null,
      name: typeof record.name === "string" ? record.name.trim() : "",
      description:
        typeof record.description === "string" ? record.description.trim() : "",
      benefits,
      roomId: typeof record.roomId === "string" ? record.roomId : null,
    };
  });
}

async function loadOwnerPayload(
  service: ReturnType<typeof createMemberPrivacyServiceClient>,
  userId: string,
  isAdmin: boolean
) {
  if (!service) return null;

  const [programResult, tiersResult, membershipsResult, roomsResult, entitlementResult] =
    await Promise.all([
      service
        .from("creator_supporter_programs")
        .select("creator_id, enabled, headline, welcome_message, created_at, updated_at")
        .eq("creator_id", userId)
        .maybeSingle(),
      service
        .from("creator_supporter_tiers")
        .select(
          "id, creator_id, name, description, benefits, room_id, position, is_active, created_at, updated_at"
        )
        .eq("creator_id", userId)
        .eq("is_active", true)
        .order("position", { ascending: true }),
      service
        .from("creator_supporter_memberships")
        .select("id, supporter_id, tier_id, joined_at")
        .eq("creator_id", userId)
        .eq("status", "active")
        .order("joined_at", { ascending: false })
        .limit(250),
      service
        .from("rooms")
        .select("id, name, room_type, subscription_plan, status")
        .or(`owner_id.eq.${userId},created_by.eq.${userId}`)
        .eq("status", "active")
        .order("name", { ascending: true })
        .limit(100),
      service
        .from("user_ai_entitlements")
        .select("tier, ai_assisted_enabled, monthly_summary_limit")
        .eq("user_id", userId)
        .maybeSingle(),
    ]);

  const memberships = (membershipsResult.data ?? []) as MembershipRow[];
  const supporterIds = [...new Set(memberships.map((row) => row.supporter_id))];
  let profiles: ProfileSummary[] = [];

  if (supporterIds.length > 0) {
    const { data } = await service
      .from("profiles")
      .select("id, full_name, username, avatar_url")
      .in("id", supporterIds);
    profiles = (data ?? []) as ProfileSummary[];
  }

  const profileById = new Map(profiles.map((profile) => [profile.id, profile]));
  const entitlement = entitlementResult.data;
  const canManage =
    isAdmin ||
    (entitlement?.ai_assisted_enabled === true &&
      entitlement.tier === "premium" &&
      (entitlement.monthly_summary_limit ?? 0) > 50);

  return {
    canManage,
    program: programResult.data ?? null,
    tiers: tiersResult.data ?? [],
    rooms: roomsResult.data ?? [],
    supporters: memberships.map((membership) => ({
      ...membership,
      profile: profileById.get(membership.supporter_id) ?? null,
    })),
  };
}

export async function GET(request: NextRequest) {
  const service = createMemberPrivacyServiceClient();
  if (!service) return jsonError("Creator supporter service is not configured.", 503);

  const { user } = await requireMemberUser(request);
  if (!user) return jsonError("Unauthorized.", 401);

  const { data: profile } = await service
    .from("profiles")
    .select("account_status, enforcement_reason, suspended_until, is_admin")
    .eq("id", user.id)
    .maybeSingle();

  const enforcement = getAccountEnforcementResult(
    (profile ?? null) as ProfileAccess | null
  );
  if (!enforcement.allowed) {
    return jsonError(
      enforcement.errorMessage ?? "This account cannot manage a supporter program.",
      403
    );
  }

  const payload = await loadOwnerPayload(service, user.id, Boolean(profile?.is_admin));
  return NextResponse.json(payload, {
    headers: { "Cache-Control": "private, no-store" },
  });
}

export async function POST(request: NextRequest) {
  const service = createMemberPrivacyServiceClient();
  if (!service) return jsonError("Creator supporter service is not configured.", 503);

  const { user } = await requireMemberUser(request);
  if (!user) return jsonError("Unauthorized.", 401);

  const { data: profile } = await service
    .from("profiles")
    .select("account_status, enforcement_reason, suspended_until, is_admin")
    .eq("id", user.id)
    .maybeSingle();

  const enforcement = getAccountEnforcementResult(
    (profile ?? null) as ProfileAccess | null
  );
  if (!enforcement.allowed) {
    return jsonError(
      enforcement.errorMessage ?? "This account cannot manage a supporter program.",
      403
    );
  }

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const tiers = cleanTierInput(body.tiers);

  if (tiers.length < 1) {
    return jsonError("Create at least one free supporter tier.", 400);
  }

  const { data, error } = await service.rpc("save_creator_supporter_program", {
    p_creator_id: user.id,
    p_enabled: body.enabled === true,
    p_headline:
      typeof body.headline === "string" ? body.headline.trim() : "Support my work",
    p_welcome_message:
      typeof body.welcomeMessage === "string" ? body.welcomeMessage.trim() : "",
    p_tiers: tiers,
  });

  if (error) return jsonError(error.message, 400);

  if (body.enabled === true) {
    const { data: activeMemberships } = await service
      .from("creator_supporter_memberships")
      .select("supporter_id, tier_id")
      .eq("creator_id", user.id)
      .eq("status", "active");

    for (const membership of activeMemberships ?? []) {
      if (!membership.tier_id) continue;
      const syncResult = await service.rpc("join_creator_supporter_program", {
        p_creator_id: user.id,
        p_supporter_id: membership.supporter_id,
        p_tier_id: membership.tier_id,
      });
      if (syncResult.error) {
        return jsonError(
          `Program saved, but supporter Room access could not be synchronized: ${syncResult.error.message}`,
          409
        );
      }
    }
  }

  const payload = await loadOwnerPayload(service, user.id, Boolean(profile?.is_admin));
  return NextResponse.json(
    { saved: data, ...payload },
    { headers: { "Cache-Control": "private, no-store" } }
  );
}
