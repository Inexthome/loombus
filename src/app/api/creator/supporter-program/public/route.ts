import { NextRequest, NextResponse } from "next/server";
import { getCreatorSupporterBillingConfiguration } from "@/lib/creator-supporter-billing";
import {
  createMemberPrivacyServiceClient,
  hasBlockRelationship,
  isActiveAccountStatus,
  requireMemberUser,
} from "@/lib/member-privacy-server";

function jsonError(message: string, status: number) {
  return NextResponse.json(
    { error: message },
    { status, headers: { "Cache-Control": "private, no-store" } }
  );
}

export async function GET(request: NextRequest) {
  const service = createMemberPrivacyServiceClient();
  if (!service) return jsonError("Creator supporter service is not configured.", 503);

  const { user } = await requireMemberUser(request);
  if (!user) return jsonError("Log in to view supporter programs.", 401);

  const username = decodeURIComponent(
    String(request.nextUrl.searchParams.get("username") ?? "")
  )
    .replace(/^@+/, "")
    .trim()
    .toLowerCase();

  if (!/^[a-z0-9_]{3,30}$/.test(username)) {
    return jsonError("Invalid creator profile.", 400);
  }

  const { data: creator, error: creatorError } = await service
    .from("profiles")
    .select("id, full_name, username, avatar_url, account_status, is_admin")
    .eq("username", username)
    .maybeSingle();

  if (creatorError) return jsonError(creatorError.message, 500);
  if (!creator || !isActiveAccountStatus(creator.account_status)) {
    return jsonError("Creator profile not found.", 404);
  }
  if (await hasBlockRelationship(service, creator.id, user.id)) {
    return jsonError("Creator profile not found.", 404);
  }

  const [
    { data: entitlement },
    { data: program },
    { data: tiers },
    { data: membership },
    { data: subscription },
    { data: payout },
    supporterCountResult,
    refundResult,
  ] = await Promise.all([
    service
      .from("user_ai_entitlements")
      .select("tier, ai_assisted_enabled, monthly_summary_limit")
      .eq("user_id", creator.id)
      .maybeSingle(),
    service
      .from("creator_supporter_programs")
      .select(
        "creator_id, enabled, headline, welcome_message, accepting_new_supporters, billing_hold, billing_hold_reason"
      )
      .eq("creator_id", creator.id)
      .eq("enabled", true)
      .maybeSingle(),
    service
      .from("creator_supporter_tiers")
      .select(
        "id, name, description, benefits, room_id, position, access_mode, price_cents, currency, billing_interval"
      )
      .eq("creator_id", creator.id)
      .eq("is_active", true)
      .order("position", { ascending: true }),
    service
      .from("creator_supporter_memberships")
      .select("id, tier_id, status, joined_at")
      .eq("creator_id", creator.id)
      .eq("supporter_id", user.id)
      .maybeSingle(),
    service
      .from("creator_supporter_subscriptions")
      .select(
        "id, tier_id, status, billing_hold, billing_hold_reason, cancel_at_period_end, current_period_end, amount_cents, currency, last_payment_status"
      )
      .eq("creator_id", creator.id)
      .eq("supporter_id", user.id)
      .maybeSingle(),
    service
      .from("creator_payout_accounts")
      .select("details_submitted, payouts_enabled")
      .eq("creator_id", creator.id)
      .maybeSingle(),
    service
      .from("creator_supporter_memberships")
      .select("id", { count: "exact", head: true })
      .eq("creator_id", creator.id)
      .eq("status", "active"),
    service
      .from("creator_supporter_refund_requests")
      .select("id, status")
      .eq("creator_id", creator.id)
      .eq("supporter_id", user.id)
      .eq("status", "pending_review")
      .maybeSingle(),
  ]);

  const creatorEligible =
    Boolean(creator.is_admin) ||
    (entitlement?.ai_assisted_enabled === true &&
      entitlement.tier === "premium" &&
      (entitlement.monthly_summary_limit ?? 0) > 50);

  if (!creatorEligible || !program) {
    return NextResponse.json(
      {
        active: false,
        creator: {
          id: creator.id,
          fullName: creator.full_name,
          username: creator.username,
          avatarUrl: creator.avatar_url,
        },
      },
      { headers: { "Cache-Control": "private, no-store" } }
    );
  }

  const billing = getCreatorSupporterBillingConfiguration();
  return NextResponse.json(
    {
      active: true,
      isOwner: user.id === creator.id,
      creator: {
        id: creator.id,
        fullName: creator.full_name,
        username: creator.username,
        avatarUrl: creator.avatar_url,
      },
      program: {
        headline: program.headline,
        welcomeMessage: program.welcome_message,
        acceptingNewSupporters: program.accepting_new_supporters,
        billingHold: program.billing_hold,
        billingHoldReason: program.billing_hold_reason,
      },
      tiers: tiers ?? [],
      membership:
        membership?.status === "active"
          ? {
              id: membership.id,
              tierId: membership.tier_id,
              joinedAt: membership.joined_at,
            }
          : null,
      subscription: subscription
        ? {
            id: subscription.id,
            tierId: subscription.tier_id,
            status: subscription.status,
            billingHold: subscription.billing_hold,
            billingHoldReason: subscription.billing_hold_reason,
            cancelAtPeriodEnd: subscription.cancel_at_period_end,
            currentPeriodEnd: subscription.current_period_end,
            amountCents: subscription.amount_cents,
            currency: subscription.currency,
            lastPaymentStatus: subscription.last_payment_status,
          }
        : null,
      supporterCount: supporterCountResult.count ?? 0,
      refundRequestPending: Boolean(refundResult.data),
      paidCheckout: {
        ready:
          billing.ready &&
          Boolean(payout?.details_submitted) &&
          Boolean(payout?.payouts_enabled) &&
          program.accepting_new_supporters &&
          !program.billing_hold,
        webOnly: true,
      },
    },
    { headers: { "Cache-Control": "private, no-store" } }
  );
}
