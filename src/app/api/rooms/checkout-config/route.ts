import { NextResponse, type NextRequest } from "next/server";
import { verifyRequestAccountAccess } from "@/lib/request-account-access";
import { createRequestSupabase } from "@/lib/room-operations";
import { getRoomCheckoutConfiguration } from "@/lib/room-billing";
import { getIncludedRoomPlans } from "@/lib/room-plan-capacity";
import { getRoomCheckoutStorageReadiness } from "@/lib/room-checkout-readiness";

function jsonError(message: string, status: number, code?: string) {
  return NextResponse.json(code ? { error: message, code } : { error: message }, {
    status,
    headers: { "Cache-Control": "private, no-store" },
  });
}

export async function GET(request: NextRequest) {
  let requestSupabase;

  try {
    requestSupabase = createRequestSupabase(request);
  } catch {
    return jsonError("Rooms service is not configured.", 500, "rooms_not_configured");
  }

  const accountAccess = await verifyRequestAccountAccess(requestSupabase);
  if (!accountAccess.ok) {
    return jsonError(
      accountAccess.error,
      accountAccess.status,
      accountAccess.code
    );
  }

  const [config, storage, includedPlans] = await Promise.all([
    Promise.resolve(getRoomCheckoutConfiguration()),
    getRoomCheckoutStorageReadiness(),
    getIncludedRoomPlans(accountAccess.user.id).catch(() => ({})),
  ]);
  const coreReady =
    config.stripeSecretKey &&
    config.stripeWebhookSecret &&
    config.supabaseServiceRole &&
    storage.ready;

  return NextResponse.json(
    {
      coreReady,
      monthlyOnly: true,
      plans: config.plans,
      includedPlans,
      storage: {
        ready: storage.ready,
        checkoutIntentsReady: storage.checkoutIntentsReady,
        roomBillingColumnsReady: storage.roomBillingColumnsReady,
        issue: storage.issue,
      },
      checks: {
        stripeSecretKey: config.stripeSecretKey,
        stripeWebhookSecret: config.stripeWebhookSecret,
        siteUrl: config.siteUrl,
        supabaseServiceRole: config.supabaseServiceRole,
        roomCheckoutStorage: storage.ready,
      },
    },
    { headers: { "Cache-Control": "private, no-store" } }
  );
}
