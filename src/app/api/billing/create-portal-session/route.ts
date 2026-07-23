import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import Stripe from "stripe";
import { getBillingSupabaseAdmin } from "@/lib/billing-entitlements";

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
const STRIPE_BILLING_PORTAL_CONFIGURATION_ID =
  process.env.STRIPE_BILLING_PORTAL_CONFIGURATION_ID;
const STRIPE_BILLING_PORTAL_MEMBERSHIP_CONFIGURATION_ID =
  process.env.STRIPE_BILLING_PORTAL_MEMBERSHIP_CONFIGURATION_ID;
const STRIPE_BILLING_PORTAL_ROOM_CONFIGURATION_ID =
  process.env.STRIPE_BILLING_PORTAL_ROOM_CONFIGURATION_ID;

type PortalAction = "manage" | "cancel" | "update";
type PortalScope = "membership" | "room";

type BillingRow = {
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
};

type BillingOwnership = {
  customerId: string;
  subscriptionId: string | null;
  scope: PortalScope;
};

function getStripe() {
  if (!STRIPE_SECRET_KEY) {
    throw new Error("STRIPE_SECRET_KEY is not configured.");
  }
  return new Stripe(STRIPE_SECRET_KEY);
}

function getSafeOrigin(request: NextRequest) {
  const candidate =
    process.env.NEXT_PUBLIC_SITE_URL ||
    request.headers.get("origin") ||
    "https://loombus.com";

  try {
    const parsed = new URL(candidate);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
      return "https://loombus.com";
    }
    return parsed.origin;
  } catch {
    return "https://loombus.com";
  }
}

function isPortalAction(value: unknown): value is PortalAction {
  return value === "manage" || value === "cancel" || value === "update";
}

function getPortalConfiguration(scope: PortalScope, action: PortalAction) {
  if (scope === "membership") {
    return (
      STRIPE_BILLING_PORTAL_MEMBERSHIP_CONFIGURATION_ID ??
      STRIPE_BILLING_PORTAL_CONFIGURATION_ID ??
      null
    );
  }

  if (action === "update") {
    return STRIPE_BILLING_PORTAL_ROOM_CONFIGURATION_ID ?? null;
  }

  return (
    STRIPE_BILLING_PORTAL_ROOM_CONFIGURATION_ID ??
    STRIPE_BILLING_PORTAL_CONFIGURATION_ID ??
    null
  );
}

async function resolveBillingOwnership({
  userId,
  subscriptionId,
}: {
  userId: string;
  subscriptionId?: string | null;
}): Promise<BillingOwnership | null> {
  const admin = getBillingSupabaseAdmin();
  const { data: entitlement, error: entitlementError } = await admin
    .from("user_ai_entitlements")
    .select("stripe_customer_id, stripe_subscription_id")
    .eq("user_id", userId)
    .maybeSingle();

  if (entitlementError) {
    throw new Error(`Unable to verify Premium billing: ${entitlementError.message}`);
  }

  const premium = (entitlement ?? null) as BillingRow | null;
  if (
    premium?.stripe_customer_id &&
    (!subscriptionId || premium.stripe_subscription_id === subscriptionId)
  ) {
    return {
      customerId: premium.stripe_customer_id,
      subscriptionId: subscriptionId ?? premium.stripe_subscription_id,
      scope: "membership",
    };
  }

  let roomQuery = admin
    .from("rooms")
    .select("stripe_customer_id, stripe_subscription_id")
    .or(`owner_id.eq.${userId},created_by.eq.${userId}`)
    .not("stripe_customer_id", "is", null)
    .limit(1);

  if (subscriptionId) {
    roomQuery = roomQuery.eq("stripe_subscription_id", subscriptionId);
  }

  const { data: rooms, error: roomError } = await roomQuery;
  if (roomError) {
    throw new Error(`Unable to verify Room billing: ${roomError.message}`);
  }

  const room = ((rooms ?? [])[0] ?? null) as BillingRow | null;
  if (room?.stripe_customer_id) {
    return {
      customerId: room.stripe_customer_id,
      subscriptionId: subscriptionId ?? room.stripe_subscription_id,
      scope: "room",
    };
  }

  return null;
}

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization");
    if (!authHeader) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const token = authHeader.replace("Bearer ", "");
    const authClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        global: { headers: { Authorization: `Bearer ${token}` } },
      }
    );
    const {
      data: { user },
      error: userError,
    } = await authClient.auth.getUser(token);

    if (userError || !user) {
      return NextResponse.json({ error: "Invalid session." }, { status: 401 });
    }

    const body = (await request.json().catch(() => ({}))) as {
      action?: unknown;
      subscriptionId?: unknown;
    };
    const action: PortalAction = isPortalAction(body.action) ? body.action : "manage";
    const subscriptionId =
      typeof body.subscriptionId === "string" && body.subscriptionId.trim()
        ? body.subscriptionId.trim()
        : null;

    if ((action === "cancel" || action === "update") && !subscriptionId) {
      return NextResponse.json(
        { error: "A subscription is required for this billing action." },
        { status: 400 }
      );
    }

    const ownership = await resolveBillingOwnership({
      userId: user.id,
      subscriptionId,
    });

    if (!ownership?.customerId) {
      return NextResponse.json(
        {
          error:
            "No matching Stripe subscription was found for this Loombus account.",
          code: "billing_customer_missing",
        },
        { status: 404 }
      );
    }

    const stripe = getStripe();
    if (ownership.subscriptionId) {
      const subscription = await stripe.subscriptions.retrieve(
        ownership.subscriptionId
      );
      const actualCustomerId =
        typeof subscription.customer === "string"
          ? subscription.customer
          : subscription.customer?.id;

      if (actualCustomerId !== ownership.customerId) {
        return NextResponse.json(
          { error: "The subscription does not match this billing account." },
          { status: 409 }
        );
      }
    }

    const configuration = getPortalConfiguration(ownership.scope, action);
    if (action === "update" && ownership.scope === "room" && !configuration) {
      return NextResponse.json(
        {
          error:
            "Room plan changes are not enabled until the dedicated Stripe Room portal configuration is connected.",
          code: "room_portal_configuration_missing",
        },
        { status: 503 }
      );
    }

    const origin = getSafeOrigin(request);
    const returnUrl = `${origin}/settings?section=plan&billing=returned`;
    const params: Stripe.BillingPortal.SessionCreateParams = {
      customer: ownership.customerId,
      return_url: returnUrl,
      ...(configuration ? { configuration } : {}),
    };

    if (action === "cancel" && ownership.subscriptionId) {
      params.flow_data = {
        type: "subscription_cancel",
        subscription_cancel: {
          subscription: ownership.subscriptionId,
        },
        after_completion: {
          type: "redirect",
          redirect: { return_url: returnUrl },
        },
      };
    } else if (action === "update" && ownership.subscriptionId) {
      params.flow_data = {
        type: "subscription_update",
        subscription_update: {
          subscription: ownership.subscriptionId,
        },
        after_completion: {
          type: "redirect",
          redirect: { return_url: returnUrl },
        },
      };
    }

    const portalSession = await stripe.billingPortal.sessions.create(params);
    if (!portalSession.url) {
      return NextResponse.json(
        { error: "Stripe did not return a billing portal URL." },
        { status: 500 }
      );
    }

    return NextResponse.json({ url: portalSession.url });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown billing portal error";
    console.error("Stripe billing portal session creation failed:", message);

    const configurationProblem =
      message.toLowerCase().includes("portal") ||
      message.toLowerCase().includes("subscription_update") ||
      message.toLowerCase().includes("subscription_cancel");

    return NextResponse.json(
      {
        error: configurationProblem
          ? "Stripe subscription management is not enabled for this billing portal configuration yet."
          : "Unable to open billing management.",
      },
      { status: 500 }
    );
  }
}
