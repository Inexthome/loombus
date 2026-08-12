import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  EXTRA_AI_PACK_CREDITS,
  activatePremiumForUser,
  getBillingSupabaseAdmin,
  ensureExtraAiPackPurchaseLedger,
} from "@/lib/billing-entitlements";
import {
  getCurrentAppleSubscription,
  verifyAppleTransactionById,
  type AppleEnvironment,
  type AppleTransactionPayload,
} from "@/lib/apple-app-store-server";

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

function dateFromAppleMilliseconds(value: number | undefined) {
  if (!value || !Number.isFinite(value)) return null;
  return new Date(value).toISOString();
}

function assertTransactionAccountBinding(
  transaction: AppleTransactionPayload,
  userId: string
) {
  if (
    transaction.appAccountToken &&
    transaction.appAccountToken.toLowerCase() !== userId.toLowerCase()
  ) {
    throw new Error("apple_account_binding_mismatch");
  }
}

async function claimAppleTransaction({
  userId,
  productId,
  environment,
  transaction,
}: {
  userId: string;
  productId: AppleProductId;
  environment: AppleEnvironment;
  transaction: AppleTransactionPayload;
}) {
  if (!transaction.transactionId) {
    throw new Error("apple_transaction_missing_id");
  }

  assertTransactionAccountBinding(transaction, userId);

  const supabase = getBillingSupabaseAdmin();
  const { data: existing, error: existingError } = await (
    supabase.from("apple_iap_transactions") as any
  )
    .select("user_id, product_id")
    .eq("transaction_id", transaction.transactionId)
    .maybeSingle();

  if (existingError) {
    throw new Error(`Unable to check Apple transaction ownership: ${existingError.message}`);
  }

  if (existing && existing.user_id !== userId) {
    throw new Error("apple_transaction_already_claimed");
  }

  if (existing && existing.product_id !== productId) {
    throw new Error("apple_transaction_product_conflict");
  }

  const record = {
    transaction_id: transaction.transactionId,
    original_transaction_id: transaction.originalTransactionId ?? null,
    user_id: userId,
    product_id: productId,
    environment,
    app_account_token: transaction.appAccountToken ?? null,
    purchase_date: dateFromAppleMilliseconds(transaction.purchaseDate),
    expires_date: dateFromAppleMilliseconds(transaction.expiresDate),
    revocation_date: dateFromAppleMilliseconds(transaction.revocationDate),
    last_verified_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const { error } = await (supabase.from("apple_iap_transactions") as any).upsert(
    record,
    { onConflict: "transaction_id" }
  );

  if (error) {
    throw new Error(`Unable to record verified Apple transaction: ${error.message}`);
  }
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
      // These column names are legacy Stripe-era names. The source field is
      // authoritative and now correctly records Apple.
      stripe_checkout_session_id: transactionId,
      stripe_payment_intent_id: transactionId,
      stripe_customer_id: null,
      purchased_credits: EXTRA_AI_PACK_CREDITS,
      remaining_credits: EXTRA_AI_PACK_CREDITS,
      status: "active",
      source: "apple",
      notes: `Extra AI Pack fulfilled from verified Apple transaction ${transactionId} for ${productId}.`,
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

function errorStatus(message: string) {
  if (message.includes("not configured")) return 503;
  if (message === "apple_account_binding_mismatch") return 403;
  if (
    message === "apple_transaction_already_claimed" ||
    message === "apple_transaction_product_conflict"
  ) {
    return 409;
  }
  return 500;
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

    const requestedProductId = body.productId?.trim();
    const transactionId = body.transactionId?.trim();

    if (!requestedProductId || !isAppleProductId(requestedProductId)) {
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

    // The client values above are lookup hints only. Entitlements are based on
    // data returned by Apple's authenticated App Store Server API.
    const verified = await verifyAppleTransactionById(transactionId);
    const verifiedProductId = verified.transaction.productId;

    if (!verifiedProductId || !isAppleProductId(verifiedProductId)) {
      return NextResponse.json(
        { error: "Apple transaction is not for a Loombus product.", code: "apple_product_not_allowed" },
        { status: 400 }
      );
    }

    if (verifiedProductId !== requestedProductId) {
      return NextResponse.json(
        { error: "Apple transaction product did not match the requested product.", code: "apple_product_mismatch" },
        { status: 409 }
      );
    }

    assertTransactionAccountBinding(verified.transaction, user.id);

    if (verified.transaction.revocationDate) {
      return NextResponse.json(
        { error: "This Apple transaction has been revoked.", code: "apple_transaction_revoked" },
        { status: 409 }
      );
    }

    await claimAppleTransaction({
      userId: user.id,
      productId: verifiedProductId,
      environment: verified.environment,
      transaction: verified.transaction,
    });

    if (isExtraAiPack(verifiedProductId)) {
      await fulfillAppleExtraAiPackForUser({
        userId: user.id,
        productId: verifiedProductId,
        transactionId,
      });

      return NextResponse.json({
        ok: true,
        productId: verifiedProductId,
        planKey: APPLE_PRODUCT_TO_PLAN[verifiedProductId],
        credits: EXTRA_AI_PACK_CREDITS,
        verifiedBy: "app_store_server_api",
      });
    }

    const subscription = await getCurrentAppleSubscription(
      transactionId,
      verified.environment
    );
    const currentProductId = subscription.transaction.productId;

    if (!currentProductId || !isAppleProductId(currentProductId) || isExtraAiPack(currentProductId)) {
      return NextResponse.json(
        { error: "Apple did not return a current Loombus subscription product.", code: "apple_subscription_product_invalid" },
        { status: 409 }
      );
    }

    assertTransactionAccountBinding(subscription.transaction, user.id);

    if (subscription.transaction.transactionId) {
      await claimAppleTransaction({
        userId: user.id,
        productId: currentProductId,
        environment: subscription.environment,
        transaction: subscription.transaction,
      });
    }

    if (!(["active", "grace_period"] as const).includes(subscription.status as "active" | "grace_period")) {
      return NextResponse.json(
        {
          error: "Apple subscription is not currently active.",
          code: "apple_subscription_inactive",
          status: subscription.status,
        },
        { status: 409 }
      );
    }

    const planKey = APPLE_PRODUCT_TO_PLAN[currentProductId];
    const currentPeriodEnd = dateFromAppleMilliseconds(
      subscription.transaction.expiresDate
    );

    await activatePremiumForUser(
      user.id,
      `Premium access verified through Apple App Store Server API transaction ${transactionId}.`,
      planKey,
      {
        provider: "apple",
        providerCustomerId: null,
        providerSubscriptionId: subscription.originalTransactionId,
        providerProductId: currentProductId,
        originalTransactionId: subscription.originalTransactionId,
        appAccountToken: subscription.transaction.appAccountToken ?? null,
        environment: subscription.environment,
        currentPeriodEnd,
        subscriptionStatus: subscription.status,
        lastVerifiedAt: new Date().toISOString(),
      }
    );

    return NextResponse.json({
      ok: true,
      productId: currentProductId,
      planKey,
      subscriptionStatus: subscription.status,
      currentPeriodEnd,
      verifiedBy: "app_store_server_api",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown Apple transaction error.";
    const status = errorStatus(message);
    console.error("Apple transaction fulfillment failed:", { message });

    return NextResponse.json(
      {
        error:
          status === 503
            ? "Apple purchase verification is not configured yet."
            : status === 403
              ? "This Apple purchase belongs to a different Loombus account."
              : status === 409
                ? "This Apple transaction cannot be applied to this account."
                : "Unable to verify and fulfill Apple purchase.",
        code:
          message === "apple_account_binding_mismatch"
            ? "apple_account_binding_mismatch"
            : message === "apple_transaction_already_claimed"
              ? "apple_transaction_already_claimed"
              : "apple_verification_failed",
        detail: status === 500 ? message : undefined,
      },
      { status }
    );
  }
}
