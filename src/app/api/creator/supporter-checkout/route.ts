import { NextRequest, NextResponse } from "next/server";
import { getAccountEnforcementResult } from "@/lib/account-enforcement";
import {
  CreatorSupporterBillingError,
  completeCreatorSupporterCheckoutSession,
  getCreatorSupporterBillingConfiguration,
  startCreatorSupporterCheckout,
} from "@/lib/creator-supporter-billing";
import {
  createMemberPrivacyServiceClient,
  hasBlockRelationship,
  isActiveAccountStatus,
  requireMemberUser,
} from "@/lib/member-privacy-server";

type ProfileAccess = {
  account_status: string | null;
  enforcement_reason: string | null;
  suspended_until: string | null;
};

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const APPROVED_PLATFORM_FEE_BPS = 1500;
const MINIMUM_PAID_TIER_CENTS = 500;
const MAXIMUM_PAID_TIER_CENTS = 100000;

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
  console.error("Creator supporter checkout failed:", error);
  return jsonError("Creator supporter checkout failed.", 500);
}

async function authorizedSupporter(request: NextRequest) {
  const service = createMemberPrivacyServiceClient();
  if (!service) return { error: jsonError("Creator billing service is not configured.", 503) };
  const { user } = await requireMemberUser(request);
  if (!user) return { error: jsonError("Unauthorized.", 401) };

  const { data: profile } = await service
    .from("profiles")
    .select("account_status, enforcement_reason, suspended_until")
    .eq("id", user.id)
    .maybeSingle();
  const enforcement = getAccountEnforcementResult(
    (profile ?? null) as ProfileAccess | null
  );
  if (!enforcement.allowed) {
    return {
      error: jsonError(
        enforcement.errorMessage ?? "This account cannot start a subscription.",
        403
      ),
    };
  }
  return { service, user };
}

export async function POST(request: NextRequest) {
  const authorized = await authorizedSupporter(request);
  if ("error" in authorized) return authorized.error;
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const creatorId = String(body.creatorId ?? "").trim();
  const tierId = String(body.tierId ?? "").trim();
  const purchaseSurface = String(body.purchaseSurface ?? "").trim().toLowerCase();

  if (purchaseSurface !== "web") {
    return jsonError(
      "Paid creator subscriptions are available on the Loombus web experience in this release.",
      409,
      "creator_supporter_web_checkout_only"
    );
  }
  if (!UUID_PATTERN.test(creatorId) || !UUID_PATTERN.test(tierId)) {
    return jsonError("Invalid creator subscription selection.", 400);
  }

  const configuration = getCreatorSupporterBillingConfiguration();
  if (
    !configuration.ready ||
    configuration.feeBps !== APPROVED_PLATFORM_FEE_BPS
  ) {
    return jsonError(
      "Paid creator subscriptions are not enabled with the approved 15% Loombus platform fee.",
      503,
      "creator_supporter_paid_beta_unavailable"
    );
  }

  const [{ data: creator }, { data: tier }] = await Promise.all([
    authorized.service
      .from("profiles")
      .select("id, username, account_status")
      .eq("id", creatorId)
      .maybeSingle(),
    authorized.service
      .from("creator_supporter_tiers")
      .select("id, creator_id, access_mode, price_cents, is_active")
      .eq("id", tierId)
      .eq("creator_id", creatorId)
      .maybeSingle(),
  ]);

  if (!creator || !creator.username || !isActiveAccountStatus(creator.account_status)) {
    return jsonError("Creator profile not found.", 404);
  }
  if (
    !tier?.is_active ||
    tier.access_mode !== "paid" ||
    !Number.isInteger(tier.price_cents) ||
    tier.price_cents < MINIMUM_PAID_TIER_CENTS ||
    tier.price_cents > MAXIMUM_PAID_TIER_CENTS
  ) {
    return jsonError(
      "Choose a paid creator tier priced between $5 and $1,000 per month.",
      400,
      "creator_supporter_price_invalid"
    );
  }
  if (await hasBlockRelationship(authorized.service, creatorId, authorized.user.id)) {
    return jsonError("This creator subscription is unavailable.", 403);
  }

  try {
    const result = await startCreatorSupporterCheckout({
      creatorId,
      supporterId: authorized.user.id,
      supporterEmail: authorized.user.email ?? null,
      tierId,
      creatorUsername: creator.username,
      origin: request.headers.get("origin") ?? request.nextUrl.origin,
    });
    return NextResponse.json(result, {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    return billingError(error);
  }
}

export async function GET(request: NextRequest) {
  const authorized = await authorizedSupporter(request);
  if ("error" in authorized) return authorized.error;
  const sessionId = String(request.nextUrl.searchParams.get("sessionId") ?? "").trim();
  if (!sessionId.startsWith("cs_")) return jsonError("Invalid checkout session.", 400);

  try {
    const result = await completeCreatorSupporterCheckoutSession(
      sessionId,
      authorized.user.id
    );
    return NextResponse.json(result, {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    return billingError(error);
  }
}
