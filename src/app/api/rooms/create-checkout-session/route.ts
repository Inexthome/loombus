import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import Stripe from "stripe";

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;

const ROOM_CHECKOUT_PLANS = {
  starter: {
    label: "Loombus Room Starter",
    plan: "starter",
    mode: "subscription",
    priceEnvVar: "STRIPE_ROOM_STARTER_MONTHLY_PRICE_ID",
    memberLimit: "50 members",
  },
  pro: {
    label: "Loombus Room Pro",
    plan: "pro",
    mode: "subscription",
    priceEnvVar: "STRIPE_ROOM_PRO_MONTHLY_PRICE_ID",
    memberLimit: "250 members",
  },
  organization: {
    label: "Loombus Organization Room",
    plan: "organization",
    mode: "subscription",
    priceEnvVar: "STRIPE_ROOM_ORGANIZATION_MONTHLY_PRICE_ID",
    memberLimit: "Up to 3 rooms, 500 members",
  },
  organization_plus: {
    label: "Loombus Organization Plus",
    plan: "organization_plus",
    mode: "subscription",
    priceEnvVar: "STRIPE_ROOM_ORGANIZATION_PLUS_MONTHLY_PRICE_ID",
    memberLimit: "Up to 10 rooms, 2,000 members",
  },
  organization_enterprise: {
    label: "Loombus Organization Enterprise",
    plan: "organization_enterprise",
    mode: "subscription",
    priceEnvVar: "STRIPE_ROOM_ORGANIZATION_ENTERPRISE_MONTHLY_PRICE_ID",
    memberLimit: "Unlimited/custom rooms, large membership, dedicated support",
  },
} as const;

type RoomCheckoutPlanKey = keyof typeof ROOM_CHECKOUT_PLANS;

function isRoomCheckoutPlanKey(value: string): value is RoomCheckoutPlanKey {
  return value in ROOM_CHECKOUT_PLANS;
}

function getPriceId(planKey: RoomCheckoutPlanKey) {
  return process.env[ROOM_CHECKOUT_PLANS[planKey].priceEnvVar];
}

function getSafeRoomId(value: unknown) {
  return typeof value === "string" && /^[0-9a-fA-F-]{20,80}$/.test(value) ? value : "";
}

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization");

    if (!authHeader) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const token = authHeader.replace("Bearer ", "");
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        global: {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      }
    );

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser(token);

    if (userError || !user) {
      return NextResponse.json({ error: "Invalid session." }, { status: 401 });
    }

    const body = (await request.json().catch(() => ({}))) as {
      roomId?: unknown;
      planKey?: unknown;
    };

    const roomId = getSafeRoomId(body.roomId);
    const requestedPlanKey = typeof body.planKey === "string" ? body.planKey : "";

    if (!roomId) {
      return NextResponse.json(
        { error: "A valid room ID is required.", code: "invalid_room_id" },
        { status: 400 }
      );
    }

    if (!isRoomCheckoutPlanKey(requestedPlanKey)) {
      return NextResponse.json(
        { error: "Invalid room plan selected.", code: "invalid_room_plan" },
        { status: 400 }
      );
    }

    const { data: membership, error: membershipError } = await supabase
      .from("room_members")
      .select("role")
      .eq("room_id", roomId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (membershipError || membership?.role !== "owner") {
      return NextResponse.json(
        { error: "Only the room owner can start room billing.", code: "not_room_owner" },
        { status: 403 }
      );
    }

    const selectedPlan = ROOM_CHECKOUT_PLANS[requestedPlanKey];
    const selectedPriceId = getPriceId(requestedPlanKey);

    if (!STRIPE_SECRET_KEY || !selectedPriceId) {
      return NextResponse.json(
        {
          error: "Room checkout is not configured yet.",
          code: "stripe_room_not_configured",
          detail: `Missing Stripe configuration for ${selectedPlan.label}.`,
        },
        { status: 503 }
      );
    }

    const origin =
      process.env.NEXT_PUBLIC_SITE_URL ||
      request.headers.get("origin") ||
      "https://loombus.com";

    const stripe = new Stripe(STRIPE_SECRET_KEY);
    const metadata = {
      product: "loombus_room",
      user_id: user.id,
      room_id: roomId,
      room_plan: selectedPlan.plan,
      plan_key: requestedPlanKey,
      plan_label: selectedPlan.label,
      member_limit_label: selectedPlan.memberLimit,
    };

    const session = await stripe.checkout.sessions.create({
      mode: selectedPlan.mode,
      payment_method_types: ["card"],
      line_items: [
        {
          price: selectedPriceId,
          quantity: 1,
        },
      ],
      success_url: `${origin}/rooms/${encodeURIComponent(roomId)}/billing/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/rooms/${encodeURIComponent(roomId)}?room_checkout=cancelled&plan=${requestedPlanKey}`,
      client_reference_id: roomId,
      customer_email: user.email ?? undefined,
      metadata,
      subscription_data: {
        metadata,
      },
    });

    if (!session.url) {
      return NextResponse.json(
        { error: "Stripe did not return a checkout URL." },
        { status: 500 }
      );
    }

    return NextResponse.json({ url: session.url });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown checkout error";
    console.error("Room checkout session creation failed:", message);

    return NextResponse.json(
      {
        error: "Unable to start room checkout.",
        detail: "Check Stripe room price configuration in Vercel and Stripe.",
      },
      { status: 500 }
    );
  }
}
