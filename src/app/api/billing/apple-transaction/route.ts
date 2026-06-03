import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  EXTRA_AI_PACK_CREDITS,
  activatePremiumForUser,
  getBillingSupabaseAdmin,
  ensureExtraAiPackPurchaseLedger,
} from "@/lib/billing-entitlements";

const APPLE_PRODUCT_TO_PLAN = {
  loombus_premium_monthly: "premium_monthly",
  loombus_premium_annual: "premium_annual",
  loombus_premium_plus_monthly: "premium_plus_monthly",
  loombus_premium_plus_annual: "premium_plus_annual",
  loombus_extra_ai_pack: "extra_ai_pack",
} as const;

type AppleProductId = keyof typeof APPLE_PRODUCT_TO_PLAN;

function isAppleProductId(value: string): value is AppleProductId {
  return value in APPLE_PRODUCT_TO_PLAN;
}

function isExtraAiPack(productId: AppleProductId) {
  return APPLE_PRODUCT_TO_PLAN[productId] === "extra_ai_pack";
}

async function fulfillAppleExtraAiPackForUser({
  userId,
  productId,
  transactionId,
}: {
  userId: string;
  productId: AppleProductId;
  transactionId: string;
}) {
  const supabase = getBillingSupabaseAdmin();

  const { data: existingPack, error: existingError } = await (
    supabase.from("ai_extra_credit_packs") as any
  )
    .select("id")
    .eq("stripe_checkout_session_id", transactionId)
    .maybeSingle();

  if (existingError) {
    throw new Error(`Unable to verify Apple Extra AI Pack purchase: ${existingError.message}`);
  }

  if (existingPack?.id) {
    await ensureExtraAiPackPurchaseLedger({
      supabase,
      packId: existingPack.id,
      userId,
      checkoutSessionId: transactionId,
    });
    return;
  }

  const { data: pack, error } = await (supabase.from("ai_extra_credit_packs") as any)
    .insert({
      user_id: userId,
      stripe_checkout_session_id: transactionId,
      stripe_payment_intent_id: transactionId,
      stripe_customer_id: "apple",
      purchased_credits: EXTRA_AI_PACK_CREDITS,
      remaining_credits: EXTRA_AI_PACK_CREDITS,
      status: "active",
      source: "stripe",
      notes: `Extra AI Pack fulfilled from Apple transaction ${transactionId} for ${productId}.`,
    })
    .select("id")
    .single();

  if (error || !pack?.id) {
    throw new Error(`Unable to fulfill Apple Extra AI Pack: ${error?.message ?? "Missing pack id."}`);
  }

  await ensureExtraAiPackPurchaseLedger({
    supabase,
    packId: pack.id,
    userId,
    checkoutSessionId: transactionId,
  });
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
      productId?: string;
      transactionId?: string;
    };

    const productId = body.productId?.trim();
    const transactionId = body.transactionId?.trim();

    if (!productId || !isAppleProductId(productId)) {
      return NextResponse.json(
        { error: "Invalid Apple product.", code: "invalid_apple_product" },
        { status: 400 }
      );
    }

    if (!transactionId) {
      return NextResponse.json(
        { error: "Missing Apple transaction ID.", code: "missing_apple_transaction" },
        { status: 400 }
      );
    }

    const planKey = APPLE_PRODUCT_TO_PLAN[productId];

    if (isExtraAiPack(productId)) {
      await fulfillAppleExtraAiPackForUser({
        userId: user.id,
        productId,
        transactionId,
      });

      return NextResponse.json({
        ok: true,
        productId,
        planKey,
        credits: EXTRA_AI_PACK_CREDITS,
      });
    }

    await activatePremiumForUser(
      user.id,
      `Premium AI-Assisted Layer activated from Apple transaction ${transactionId}.`,
      planKey,
      {
        stripeCustomerId: "apple",
        stripeSubscriptionId: transactionId,
        stripePriceId: productId,
        stripeCurrentPeriodEnd: null,
        stripeSubscriptionStatus: "active",
      }
    );

    return NextResponse.json({
      ok: true,
      productId,
      planKey,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown Apple transaction error.";
    console.error("Apple transaction fulfillment failed:", { message });

    return NextResponse.json(
      {
        error: "Unable to fulfill Apple purchase.",
        detail: message,
      },
      { status: 500 }
    );
  }
}
