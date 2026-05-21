import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import Stripe from "stripe";

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;

const CHECKOUT_PLANS = {
  premium_monthly: {
    label: "Loombus Premium Monthly",
    tier: "premium",
    interval: "monthly",
    priceEnvVar: "STRIPE_PREMIUM_MONTHLY_PRICE_ID",
    fallbackPriceEnvVar: "STRIPE_PREMIUM_PRICE_ID",
  },
  premium_annual: {
    label: "Loombus Premium Annual",
    tier: "premium",
    interval: "annual",
    priceEnvVar: "STRIPE_PREMIUM_ANNUAL_PRICE_ID",
  },
  premium_plus_monthly: {
    label: "Loombus Premium Plus Monthly",
    tier: "premium_plus",
    interval: "monthly",
    priceEnvVar: "STRIPE_PREMIUM_PLUS_MONTHLY_PRICE_ID",
  },
  premium_plus_annual: {
    label: "Loombus Premium Plus Annual",
    tier: "premium_plus",
    interval: "annual",
    priceEnvVar: "STRIPE_PREMIUM_PLUS_ANNUAL_PRICE_ID",
  },
} as const;

type CheckoutPlanKey = keyof typeof CHECKOUT_PLANS;

function isCheckoutPlanKey(value: string): value is CheckoutPlanKey {
  return value in CHECKOUT_PLANS;
}

function getPriceId(planKey: CheckoutPlanKey) {
  const plan = CHECKOUT_PLANS[planKey];
  const primaryPriceId = process.env[plan.priceEnvVar];

  if (primaryPriceId) {
    return primaryPriceId;
  }

  if ("fallbackPriceEnvVar" in plan && plan.fallbackPriceEnvVar) {
    return process.env[plan.fallbackPriceEnvVar];
  }

  return undefined;
}

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization");

    if (!authHeader) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const body = (await request.json().catch(() => ({}))) as {
      planKey?: string;
    };

    const requestedPlanKey = body.planKey ?? "premium_monthly";

    if (!isCheckoutPlanKey(requestedPlanKey)) {
      return NextResponse.json(
        {
          error: "Invalid Premium plan selected.",
          code: "invalid_premium_plan",
        },
        { status: 400 }
      );
    }

    const selectedPlan = CHECKOUT_PLANS[requestedPlanKey];
    const selectedPriceId = getPriceId(requestedPlanKey);

    if (!STRIPE_SECRET_KEY || !selectedPriceId) {
      return NextResponse.json(
        {
          error:
            "Premium checkout is not configured yet. Stripe keys and the selected plan price ID are required.",
          code: "stripe_not_configured",
          detail: `Missing Stripe configuration for ${selectedPlan.label}.`,
        },
        { status: 503 }
      );
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

    const origin =
      process.env.NEXT_PUBLIC_SITE_URL ||
      request.headers.get("origin") ||
      "https://loombus.com";

    const stripe = new Stripe(STRIPE_SECRET_KEY);

    const metadata = {
      user_id: user.id,
      product: "loombus_premium_ai",
      plan_key: requestedPlanKey,
      plan_label: selectedPlan.label,
      tier: selectedPlan.tier,
      billing_interval: selectedPlan.interval,
    };

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      payment_method_types: ["card"],
      line_items: [
        {
          price: selectedPriceId,
          quantity: 1,
        },
      ],
      success_url: `${origin}/premium?checkout=success&plan=${requestedPlanKey}&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/premium?checkout=cancelled&plan=${requestedPlanKey}`,
      client_reference_id: user.id,
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

    const stripeError =
      error && typeof error === "object" && "type" in error
        ? String((error as { type?: unknown }).type ?? "")
        : "";

    const stripeCode =
      error && typeof error === "object" && "code" in error
        ? String((error as { code?: unknown }).code ?? "")
        : "";

    let safeDetail = "Check Stripe checkout configuration in Vercel and Stripe.";

    if (stripeError === "StripeAuthenticationError") {
      safeDetail = "Stripe rejected the secret key. Check STRIPE_SECRET_KEY in Vercel.";
    } else if (
      stripeError === "StripeInvalidRequestError" &&
      message.toLowerCase().includes("no such price")
    ) {
      safeDetail =
        "Stripe could not find the selected plan price. Check the selected Stripe Price ID and make sure it is from the same Stripe mode as the secret key.";
    } else if (
      stripeError === "StripeInvalidRequestError" &&
      message.toLowerCase().includes("recurring")
    ) {
      safeDetail =
        "The selected plan price must be a recurring subscription price, not a one-time price.";
    } else if (stripeCode) {
      safeDetail = `Stripe checkout failed with code: ${stripeCode}. Check the Stripe price and key configuration.`;
    }

    console.error("Stripe checkout session creation failed:", {
      type: stripeError || "unknown",
      code: stripeCode || "unknown",
      message,
    });

    return NextResponse.json(
      {
        error: "Unable to start Premium checkout.",
        detail: safeDetail,
      },
      { status: 500 }
    );
  }
}
