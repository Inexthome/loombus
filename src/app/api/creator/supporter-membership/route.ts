import { NextRequest, NextResponse } from "next/server";
import { getAccountEnforcementResult } from "@/lib/account-enforcement";
import {
  CreatorSupporterBillingError,
  cancelCreatorSupporterSubscription,
  requestCreatorSupporterRefund,
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
  console.error("Creator supporter membership billing action failed:", error);
  return jsonError("Unable to update paid supporter access.", 500);
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
      enforcement.errorMessage ?? "This account cannot change supporter memberships.",
      403
    );
  }

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const action = String(body.action ?? "join").trim().toLowerCase();
  const creatorId = String(body.creatorId ?? "").trim();

  if (!UUID_PATTERN.test(creatorId)) {
    return jsonError("Invalid creator id.", 400);
  }

  if (action === "join" || action === "change_tier") {
    const tierId = String(body.tierId ?? "").trim();
    if (!UUID_PATTERN.test(tierId)) return jsonError("Choose a valid supporter tier.", 400);

    const [{ data: tier }, { data: paidSubscription }] = await Promise.all([
      service
        .from("creator_supporter_tiers")
        .select("access_mode")
        .eq("id", tierId)
        .eq("creator_id", creatorId)
        .eq("is_active", true)
        .maybeSingle(),
      service
        .from("creator_supporter_subscriptions")
        .select("status")
        .eq("creator_id", creatorId)
        .eq("supporter_id", user.id)
        .maybeSingle(),
    ]);

    if (!tier) return jsonError("Choose an active supporter tier.", 400);
    if (tier.access_mode === "paid") {
      return jsonError(
        "Paid supporter tiers require web checkout.",
        409,
        "creator_supporter_checkout_required"
      );
    }
    if (
      paidSubscription &&
      ["incomplete", "trialing", "active", "past_due", "unpaid"].includes(
        paidSubscription.status
      )
    ) {
      return jsonError(
        "Cancel the paid subscription before moving to a free tier.",
        409,
        "creator_supporter_paid_subscription_active"
      );
    }

    const { data, error } = await service.rpc("join_creator_supporter_program", {
      p_creator_id: creatorId,
      p_supporter_id: user.id,
      p_tier_id: tierId,
    });

    if (error) return jsonError(error.message, error.code === "42501" ? 403 : 400);
    return NextResponse.json(
      { membership: data },
      { headers: { "Cache-Control": "private, no-store" } }
    );
  }

  if (action === "leave") {
    const { data: paidSubscription } = await service
      .from("creator_supporter_subscriptions")
      .select("status")
      .eq("creator_id", creatorId)
      .eq("supporter_id", user.id)
      .maybeSingle();

    if (
      paidSubscription &&
      ["incomplete", "trialing", "active", "past_due", "unpaid"].includes(
        paidSubscription.status
      )
    ) {
      try {
        const subscription = await cancelCreatorSupporterSubscription({
          creatorId,
          supporterId: user.id,
        });
        return NextResponse.json(
          {
            paidSubscription: true,
            status: subscription.status,
            cancelAtPeriodEnd: Boolean(subscription.cancel_at_period_end),
          },
          { headers: { "Cache-Control": "private, no-store" } }
        );
      } catch (error) {
        return billingError(error);
      }
    }

    const { data, error } = await service.rpc("end_creator_supporter_membership", {
      p_creator_id: creatorId,
      p_supporter_id: user.id,
      p_actor_id: user.id,
    });
    if (error) return jsonError(error.message, error.code === "42501" ? 403 : 400);
    return NextResponse.json(
      { membership: data },
      { headers: { "Cache-Control": "private, no-store" } }
    );
  }

  if (action === "remove") {
    const supporterId = String(body.supporterId ?? "").trim();
    if (!UUID_PATTERN.test(supporterId)) {
      return jsonError("Invalid supporter id.", 400);
    }
    if (user.id !== creatorId && !profile?.is_admin) {
      return jsonError("You cannot remove this supporter.", 403);
    }

    const { data: paidSubscription } = await service
      .from("creator_supporter_subscriptions")
      .select("status")
      .eq("creator_id", creatorId)
      .eq("supporter_id", supporterId)
      .maybeSingle();

    if (
      paidSubscription &&
      ["incomplete", "trialing", "active", "past_due", "unpaid"].includes(
        paidSubscription.status
      )
    ) {
      try {
        await cancelCreatorSupporterSubscription({
          creatorId,
          supporterId,
          immediate: true,
        });
        await requestCreatorSupporterRefund({
          creatorId,
          supporterId,
          requestedBy: user.id,
          reason:
            "Creator ended paid supporter access. Review the unused billing period for a manual refund.",
        }).catch(() => null);
        return NextResponse.json(
          { removed: true, paidSubscriptionCancelled: true, refundReviewQueued: true },
          { headers: { "Cache-Control": "private, no-store" } }
        );
      } catch (error) {
        return billingError(error);
      }
    }

    const { data, error } = await service.rpc("end_creator_supporter_membership", {
      p_creator_id: creatorId,
      p_supporter_id: supporterId,
      p_actor_id: user.id,
    });
    if (error) return jsonError(error.message, error.code === "42501" ? 403 : 400);
    return NextResponse.json(
      { membership: data },
      { headers: { "Cache-Control": "private, no-store" } }
    );
  }

  return jsonError("Unsupported supporter action.", 400);
}
