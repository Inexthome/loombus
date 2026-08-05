import "server-only";
import type Stripe from "stripe";
import { getBillingSupabaseAdmin, type BillingIdentity } from "@/lib/billing-entitlements";

export type FloorPlanKey = "floor_monthly" | "floor_annual";

export function isFloorPlanKey(value: string | null | undefined): value is FloorPlanKey {
  return value === "floor_monthly" || value === "floor_annual";
}

export function floorPlanLabel(planKey: string | null | undefined) {
  return planKey === "floor_annual" ? "The Floor Annual" : "The Floor Monthly";
}

export async function syncFloorSubscription(
  userId: string,
  planKey: FloorPlanKey,
  status: Stripe.Subscription.Status | "active",
  billing: BillingIdentity
) {
  const supabase = getBillingSupabaseAdmin();
  const { error } = await supabase.from("floor_subscriptions").upsert(
    {
      user_id: userId,
      plan_key: planKey,
      status,
      stripe_customer_id: billing.stripeCustomerId ?? null,
      stripe_subscription_id: billing.stripeSubscriptionId ?? null,
      stripe_price_id: billing.stripePriceId ?? null,
      current_period_end: billing.stripeCurrentPeriodEnd ?? null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" }
  );

  if (error) throw new Error(`Unable to synchronize The Floor access: ${error.message}`);
}
