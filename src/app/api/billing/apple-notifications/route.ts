import { NextRequest, NextResponse } from "next/server";
import {
  activatePremiumForUser,
  deactivatePremiumForUser,
  getBillingSupabaseAdmin,
} from "@/lib/billing-entitlements";
import {
  decodeAppleNotificationTransactionId,
  getCurrentAppleSubscription,
} from "@/lib/apple-app-store-server";

const APPLE_PRODUCT_TO_PLAN = {
  loombus_premium_monthly: "premium_monthly",
  loombus_premium_annual: "premium_annual",
  loombus_premium_plus_monthly: "premium_plus_monthly",
  loombus_premium_plus_annual: "premium_plus_annual",
} as const;

type AppleSubscriptionProductId = keyof typeof APPLE_PRODUCT_TO_PLAN;

function isAppleSubscriptionProductId(
  value: string | null | undefined
): value is AppleSubscriptionProductId {
  return Boolean(value && value in APPLE_PRODUCT_TO_PLAN);
}

function dateFromAppleMilliseconds(value: number | undefined) {
  if (!value || !Number.isFinite(value)) return null;
  return new Date(value).toISOString();
}

async function findAppleSubscriptionOwner(originalTransactionId: string) {
  const supabase = getBillingSupabaseAdmin();

  const { data: subscriptionRow, error: subscriptionError } = await (
    supabase.from("user_general_subscriptions") as any
  )
    .select("user_id")
    .eq("provider", "apple")
    .eq("original_transaction_id", originalTransactionId)
    .maybeSingle();

  if (subscriptionError) {
    throw new Error(
      `Unable to find Apple subscription owner: ${subscriptionError.message}`
    );
  }

  if (subscriptionRow?.user_id) {
    return subscriptionRow.user_id as string;
  }

  const { data: ledgerRow, error: ledgerError } = await (
    supabase.from("apple_iap_transactions") as any
  )
    .select("user_id")
    .eq("original_transaction_id", originalTransactionId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (ledgerError) {
    throw new Error(
      `Unable to find Apple transaction owner: ${ledgerError.message}`
    );
  }

  return (ledgerRow?.user_id as string | undefined) ?? null;
}

async function recordLatestVerifiedAppleTransaction({
  userId,
  originalTransactionId,
  productId,
  environment,
  transaction,
}: {
  userId: string;
  originalTransactionId: string;
  productId: AppleSubscriptionProductId;
  environment: "Production" | "Sandbox";
  transaction: {
    transactionId?: string;
    appAccountToken?: string;
    purchaseDate?: number;
    expiresDate?: number;
    revocationDate?: number;
  };
}) {
  if (!transaction.transactionId) return;

  if (
    transaction.appAccountToken &&
    transaction.appAccountToken.toLowerCase() !== userId.toLowerCase()
  ) {
    throw new Error("Apple notification account binding did not match the owner.");
  }

  const supabase = getBillingSupabaseAdmin();
  const { data: existing, error: existingError } = await (
    supabase.from("apple_iap_transactions") as any
  )
    .select("user_id")
    .eq("transaction_id", transaction.transactionId)
    .maybeSingle();

  if (existingError) {
    throw new Error(
      `Unable to inspect Apple notification transaction: ${existingError.message}`
    );
  }

  if (existing && existing.user_id !== userId) {
    throw new Error("Apple notification transaction is owned by another member.");
  }

  const now = new Date().toISOString();
  const { error } = await (supabase.from("apple_iap_transactions") as any).upsert(
    {
      transaction_id: transaction.transactionId,
      original_transaction_id: originalTransactionId,
      user_id: userId,
      product_id: productId,
      environment,
      app_account_token: transaction.appAccountToken ?? null,
      purchase_date: dateFromAppleMilliseconds(transaction.purchaseDate),
      expires_date: dateFromAppleMilliseconds(transaction.expiresDate),
      revocation_date: dateFromAppleMilliseconds(transaction.revocationDate),
      last_verified_at: now,
      updated_at: now,
    },
    { onConflict: "transaction_id" }
  );

  if (error) {
    throw new Error(
      `Unable to record Apple notification transaction: ${error.message}`
    );
  }
}

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as
    | { signedPayload?: string }
    | null;
  const signedPayload = body?.signedPayload?.trim();

  if (!signedPayload) {
    return NextResponse.json(
      { error: "Missing Apple signedPayload." },
      { status: 400 }
    );
  }

  // The notification JWS is only used to obtain an Apple transaction ID.
  // It never directly authorizes access. Current state is re-fetched from
  // Apple's authenticated App Store Server API below.
  const transactionId = decodeAppleNotificationTransactionId(signedPayload);
  if (!transactionId) {
    // TEST notifications and notifications without transaction data still need
    // a successful response so Apple can validate endpoint reachability.
    return NextResponse.json({ received: true, processed: false });
  }

  try {
    const subscription = await getCurrentAppleSubscription(transactionId);
    const productId = subscription.transaction.productId;

    if (!isAppleSubscriptionProductId(productId)) {
      // The general subscription endpoint intentionally ignores unrelated IAP
      // products such as consumable Extra AI Packs.
      return NextResponse.json({ received: true, processed: false });
    }

    const userId = await findAppleSubscriptionOwner(
      subscription.originalTransactionId
    );

    if (!userId) {
      // An unclaimed StoreKit purchase has no Loombus account to mutate. The
      // authenticated purchase-fulfillment route will bind it when the member
      // returns to the app.
      return NextResponse.json({ received: true, processed: false });
    }

    if (
      subscription.transaction.appAccountToken &&
      subscription.transaction.appAccountToken.toLowerCase() !==
        userId.toLowerCase()
    ) {
      throw new Error("Apple subscription account binding mismatch.");
    }

    await recordLatestVerifiedAppleTransaction({
      userId,
      originalTransactionId: subscription.originalTransactionId,
      productId,
      environment: subscription.environment,
      transaction: subscription.transaction,
    });

    const planKey = APPLE_PRODUCT_TO_PLAN[productId];
    const currentPeriodEnd = dateFromAppleMilliseconds(
      subscription.transaction.expiresDate
    );
    const billingIdentity = {
      provider: "apple" as const,
      providerCustomerId: null,
      providerSubscriptionId: subscription.originalTransactionId,
      providerProductId: productId,
      originalTransactionId: subscription.originalTransactionId,
      appAccountToken: subscription.transaction.appAccountToken ?? null,
      environment: subscription.environment,
      currentPeriodEnd,
      subscriptionStatus: subscription.status,
      lastVerifiedAt: new Date().toISOString(),
    };

    if (
      subscription.status === "active" ||
      subscription.status === "grace_period"
    ) {
      await activatePremiumForUser(
        userId,
        `Apple subscription lifecycle verified from App Store Server Notification for ${subscription.originalTransactionId}.`,
        planKey,
        billingIdentity
      );
    } else {
      await deactivatePremiumForUser(
        userId,
        `Apple subscription lifecycle disabled from App Store Server Notification for ${subscription.originalTransactionId} with status ${subscription.status}.`,
        billingIdentity,
        planKey
      );
    }

    return NextResponse.json({
      received: true,
      processed: true,
      status: subscription.status,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown Apple notification error.";
    console.error("Apple subscription notification sync failed:", { message });

    // A server error causes Apple to retry delivery. We fail closed rather than
    // acknowledging a lifecycle event that Loombus could not verify/synchronize.
    return NextResponse.json(
      { error: "Unable to synchronize Apple subscription notification." },
      { status: 500 }
    );
  }
}
