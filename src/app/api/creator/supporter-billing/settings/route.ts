import { NextRequest, NextResponse } from "next/server";
import { getAccountEnforcementResult } from "@/lib/account-enforcement";
import {
  CreatorSupporterBillingError,
  createCreatorPayoutDashboardLink,
  createCreatorPayoutOnboarding,
  getCreatorSupporterBillingConfiguration,
  refreshCreatorPayoutAccount,
  saveCreatorSupporterTierPricing,
} from "@/lib/creator-supporter-billing";
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

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function jsonError(message: string, status: number, code?: string) {
  return NextResponse.json(code ? { error: message, code } : { error: message }, {
    status,
    headers: { "Cache-Control": "private, no-store" },
  });
}

function billingError(error: unknown) {
  if (error instanceof CreatorSupporterBillingError) {
    return jsonError(error.message, error.status, error.code);
  }
  console.error("Creator supporter billing settings failed:", error);
  return jsonError("Creator supporter billing could not be updated.", 500);
}

function requestOrigin(request: NextRequest) {
  return request.headers.get("origin") ?? request.nextUrl.origin;
}

function requestIp(request: NextRequest) {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || request.headers.get("x-real-ip")?.trim() || null;
}

async function authorizedCreator(request: NextRequest) {
  const service = createMemberPrivacyServiceClient();
  if (!service) return { error: jsonError("Creator billing service is not configured.", 503) };
  const { user } = await requireMemberUser(request);
  if (!user) return { error: jsonError("Unauthorized.", 401) };

  const { data: profile } = await service
    .from("profiles")
    .select("account_status, enforcement_reason, suspended_until, is_admin")
    .eq("id", user.id)
    .maybeSingle();
  const enforcement = getAccountEnforcementResult(
    (profile ?? null) as ProfileAccess | null
  );
  if (!enforcement.allowed) {
    return {
      error: jsonError(
        enforcement.errorMessage ?? "This account cannot manage creator billing.",
        403
      ),
    };
  }

  return { service, user, profile };
}

async function ownerPayload(
  service: NonNullable<ReturnType<typeof createMemberPrivacyServiceClient>>,
  creatorId: string
) {
  const [payoutResult, tierResult, subscriptionResult, refundResult] =
    await Promise.all([
      service
        .from("creator_payout_accounts")
        .select(
          "details_submitted, charges_enabled, payouts_enabled, requirements_due, country, default_currency, updated_at"
        )
        .eq("creator_id", creatorId)
        .maybeSingle(),
      service
        .from("creator_supporter_tiers")
        .select(
          "id, name, access_mode, price_cents, currency, billing_interval, stripe_product_id, stripe_price_id, price_version, is_active"
        )
        .eq("creator_id", creatorId)
        .eq("is_active", true)
        .order("position", { ascending: true }),
      service
        .from("creator_supporter_subscriptions")
        .select(
          "id, supporter_id, tier_id, status, billing_hold, billing_hold_reason, cancel_at_period_end, current_period_end, amount_cents, currency, last_payment_status, updated_at"
        )
        .eq("creator_id", creatorId)
        .order("updated_at", { ascending: false })
        .limit(250),
      service
        .from("creator_supporter_refund_requests")
        .select(
          "id, subscription_id, supporter_id, requested_by, reason, requested_amount_cents, status, resolution_note, created_at"
        )
        .eq("creator_id", creatorId)
        .order("created_at", { ascending: false })
        .limit(100),
    ]);

  const supporterIds = [
    ...new Set(
      (subscriptionResult.data ?? []).map((row) => row.supporter_id).filter(Boolean)
    ),
  ];
  let profiles: Array<{
    id: string;
    full_name: string | null;
    username: string | null;
  }> = [];
  if (supporterIds.length) {
    const result = await service
      .from("profiles")
      .select("id, full_name, username")
      .in("id", supporterIds);
    profiles = result.data ?? [];
  }
  const profileById = new Map(profiles.map((profile) => [profile.id, profile]));

  return {
    configuration: getCreatorSupporterBillingConfiguration(),
    payout: payoutResult.data ?? null,
    tiers: tierResult.data ?? [],
    subscriptions: (subscriptionResult.data ?? []).map((subscription) => ({
      ...subscription,
      profile: profileById.get(subscription.supporter_id) ?? null,
    })),
    refundRequests: refundResult.data ?? [],
  };
}

export async function GET(request: NextRequest) {
  const authorized = await authorizedCreator(request);
  if ("error" in authorized) return authorized.error;
  return NextResponse.json(
    await ownerPayload(authorized.service, authorized.user.id),
    { headers: { "Cache-Control": "private, no-store" } }
  );
}

export async function POST(request: NextRequest) {
  const authorized = await authorizedCreator(request);
  if ("error" in authorized) return authorized.error;
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const action = String(body.action ?? "").trim().toLowerCase();

  try {
    if (action === "start_onboarding") {
      const result = await createCreatorPayoutOnboarding({
        creatorId: authorized.user.id,
        email: authorized.user.email ?? null,
        origin: requestOrigin(request),
        acceptedIp: requestIp(request),
      });
      return NextResponse.json(result, {
        headers: { "Cache-Control": "private, no-store" },
      });
    }

    if (action === "open_dashboard") {
      const result = await createCreatorPayoutDashboardLink(authorized.user.id);
      return NextResponse.json(result, {
        headers: { "Cache-Control": "private, no-store" },
      });
    }

    if (action === "refresh_payout") {
      await refreshCreatorPayoutAccount(authorized.user.id);
      return NextResponse.json(
        await ownerPayload(authorized.service, authorized.user.id),
        { headers: { "Cache-Control": "private, no-store" } }
      );
    }

    if (action === "save_pricing") {
      const tierId = String(body.tierId ?? "").trim();
      const accessMode = body.accessMode === "paid" ? "paid" : "free";
      if (!UUID_PATTERN.test(tierId)) return jsonError("Invalid supporter tier.", 400);
      const priceCents =
        accessMode === "paid" ? Math.round(Number(body.priceCents)) : null;
      await saveCreatorSupporterTierPricing({
        creatorId: authorized.user.id,
        tierId,
        accessMode,
        priceCents,
      });
      return NextResponse.json(
        await ownerPayload(authorized.service, authorized.user.id),
        { headers: { "Cache-Control": "private, no-store" } }
      );
    }

    return jsonError("Unsupported creator billing action.", 400);
  } catch (error) {
    return billingError(error);
  }
}
