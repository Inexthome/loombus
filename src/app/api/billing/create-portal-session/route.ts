import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import Stripe from "stripe";

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;

function getStripe() {
  if (!STRIPE_SECRET_KEY) {
    throw new Error("STRIPE_SECRET_KEY is not configured.");
  }

  return new Stripe(STRIPE_SECRET_KEY);
}

function getSafeReturnUrl(origin: string, value: unknown) {
  if (value === "/v2/premium") {
    return `${origin}/v2/premium?billing=returned`;
  }

  return `${origin}/settings?billing=returned`;
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

    const { data: entitlement, error: entitlementError } = await supabase
      .from("user_ai_entitlements")
      .select("stripe_customer_id, ai_assisted_enabled")
      .eq("user_id", user.id)
      .maybeSingle();

    if (entitlementError) {
      console.error("Billing portal entitlement lookup failed:", entitlementError.message);
      return NextResponse.json(
        { error: "Unable to load billing information." },
        { status: 400 }
      );
    }

    const stripeCustomerId = entitlement?.stripe_customer_id;

    if (!stripeCustomerId) {
      return NextResponse.json(
        {
          error:
            "No Stripe billing customer was found for this account yet. Use Premium checkout first, or contact support.",
          code: "billing_customer_missing",
        },
        { status: 404 }
      );
    }

    const origin =
      process.env.NEXT_PUBLIC_SITE_URL ||
      request.headers.get("origin") ||
      "https://loombus.com";

    const body = (await request.json().catch(() => ({}))) as {
      returnPath?: string;
    };

    const portalSession = await getStripe().billingPortal.sessions.create({
      customer: stripeCustomerId,
      return_url: getSafeReturnUrl(origin, body.returnPath),
    });

    if (!portalSession.url) {
      return NextResponse.json(
        { error: "Stripe did not return a billing portal URL." },
        { status: 500 }
      );
    }

    return NextResponse.json({ url: portalSession.url });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown billing portal error";

    console.error("Stripe billing portal session creation failed:", message);

    return NextResponse.json(
      { error: "Unable to open billing portal." },
      { status: 500 }
    );
  }
}
