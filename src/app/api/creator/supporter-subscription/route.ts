import { NextRequest, NextResponse } from "next/server";
import { getAccountEnforcementResult } from "@/lib/account-enforcement";
import {
  CreatorSupporterBillingError,
  cancelCreatorSupporterSubscription,
  requestCreatorSupporterRefund,
  resumeCreatorSupporterSubscription,
} from "@/lib/creator-supporter-billing";
import {
  createMemberPrivacyServiceClient,
  requireMemberUser,
} from "@/lib/member-privacy-server";

type ProfileAccess = {
  account_status: string | null;
  enforcement_reason: string | null;
  suspended_until: string | null;
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
  console.error("Creator supporter subscription action failed:", error);
  return jsonError("Creator supporter subscription could not be updated.", 500);
}

export async function POST(request: NextRequest) {
  const service = createMemberPrivacyServiceClient();
  if (!service) return jsonError("Creator billing service is not configured.", 503);
  const { user } = await requireMemberUser(request);
  if (!user) return jsonError("Unauthorized.", 401);

  const { data: profile } = await service
    .from("profiles")
    .select("account_status, enforcement_reason, suspended_until")
    .eq("id", user.id)
    .maybeSingle();
  const enforcement = getAccountEnforcementResult(
    (profile ?? null) as ProfileAccess | null
  );
  if (!enforcement.allowed) {
    return jsonError(
      enforcement.errorMessage ?? "This account cannot manage subscriptions.",
      403
    );
  }

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const action = String(body.action ?? "").trim().toLowerCase();
  const creatorId = String(body.creatorId ?? "").trim();
  if (!UUID_PATTERN.test(creatorId)) return jsonError("Invalid creator id.", 400);

  try {
    if (action === "cancel") {
      const subscription = await cancelCreatorSupporterSubscription({
        creatorId,
        supporterId: user.id,
      });
      return NextResponse.json(
        {
          status: subscription.status,
          cancelAtPeriodEnd: Boolean(subscription.cancel_at_period_end),
        },
        { headers: { "Cache-Control": "private, no-store" } }
      );
    }

    if (action === "resume") {
      const subscription = await resumeCreatorSupporterSubscription({
        creatorId,
        supporterId: user.id,
      });
      return NextResponse.json(
        {
          status: subscription.status,
          cancelAtPeriodEnd: Boolean(subscription.cancel_at_period_end),
        },
        { headers: { "Cache-Control": "private, no-store" } }
      );
    }

    if (action === "request_refund") {
      const reason = typeof body.reason === "string" ? body.reason : "";
      const requestRow = await requestCreatorSupporterRefund({
        creatorId,
        supporterId: user.id,
        requestedBy: user.id,
        reason,
      });
      return NextResponse.json(
        { refundRequest: requestRow },
        { headers: { "Cache-Control": "private, no-store" } }
      );
    }

    return jsonError("Unsupported creator subscription action.", 400);
  } catch (error) {
    return billingError(error);
  }
}
