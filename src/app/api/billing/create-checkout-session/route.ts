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
    console.error("Stripe checkout session creation failed:", error);

    return NextResponse.json(
      { error: "Unable to start Premium checkout." },
      { status: 500 }
    );
  }
}
