import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import Stripe from "stripe";

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
const STRIPE_PREMIUM_PRICE_ID = process.env.STRIPE_PREMIUM_PRICE_ID;

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization");

    if (!authHeader) {
      return NextResponse.json(
        { error: "Unauthorized." },
        { status: 401 }
      );
    }

    if (!STRIPE_SECRET_KEY || !STRIPE_PREMIUM_PRICE_ID) {
      return NextResponse.json(
        {
          error:
            "Premium checkout is not configured yet. Stripe keys and price ID are required.",
          code: "stripe_not_configured",
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
      return NextResponse.json(
        { error: "Invalid session." },
        { status: 401 }
      );
    }

    const origin =
      process.env.NEXT_PUBLIC_SITE_URL ||
      request.headers.get("origin") ||
      "https://loombus.com";

    const stripe = new Stripe(STRIPE_SECRET_KEY);

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      payment_method_types: ["card"],
      line_items: [
        {
          price: STRIPE_PREMIUM_PRICE_ID,
          quantity: 1,
        },
      ],
      success_url: `${origin}/premium?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/premium?checkout=cancelled`,
      client_reference_id: user.id,
      customer_email: user.email ?? undefined,
      metadata: {
        user_id: user.id,
        product: "loombus_premium_ai",
      },
      subscription_data: {
        metadata: {
          user_id: user.id,
          product: "loombus_premium_ai",
        },
      },
    });

    if (!session.url) {
      return NextResponse.json(
        { error: "Stripe did not return a checkout URL." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      url: session.url,
    });
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
        "Stripe could not find the Premium price. Check STRIPE_PREMIUM_PRICE_ID and make sure it is from the same Stripe mode as the secret key.";
    } else if (
      stripeError === "StripeInvalidRequestError" &&
      message.toLowerCase().includes("recurring")
    ) {
      safeDetail =
        "The Premium price must be a recurring subscription price, not a one-time price.";
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
