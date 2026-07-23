import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import Stripe from "stripe";
import {
  getBillingSupabaseAdmin,
  getPremiumPlanKeyFromPriceId,
} from "@/lib/billing-entitlements";

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;

type EntitlementRow = {
  tier: string | null;
  ai_assisted_enabled: boolean | null;
  monthly_summary_limit: number | null;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  stripe_price_id: string | null;
  stripe_current_period_end: string | null;
  stripe_subscription_status: string | null;
  notes: string | null;
};

type RoomRow = {
  id: string;
  name: string | null;
  subscription_plan: string | null;
  subscription_status: string | null;
  member_limit: number | null;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  stripe_price_id: string | null;
  stripe_current_period_end: string | null;
};

type SubscriptionItem = {
  id: string;
  scope: "membership" | "room";
  label: string;
  planLabel: string;
  provider: "stripe" | "apple" | "admin" | "included" | "none";
  status: string;
  subscriptionId: string | null;
  amount: number | null;
  currency: string | null;
  interval: string | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  canManage: boolean;
  roomIds: string[];
  roomNames: string[];
  memberLimit: number | null;
};

function getStripe() {
  if (!STRIPE_SECRET_KEY) return null;
  return new Stripe(STRIPE_SECRET_KEY);
}

function getMembershipPlan(entitlement: EntitlementRow | null) {
  if (entitlement?.tier === "admin") return "Admin";
  if (!entitlement?.ai_assisted_enabled) return "Free";
  if (
    entitlement.tier === "premium_plus" ||
    (entitlement.tier === "premium" && (entitlement.monthly_summary_limit ?? 0) > 50)
  ) {
    return "Premium Plus";
  }
  return "Premium";
}

function getProvider(entitlement: EntitlementRow | null): SubscriptionItem["provider"] {
  if (entitlement?.tier === "admin") return "admin";
  if (entitlement?.stripe_subscription_id || entitlement?.stripe_customer_id) return "stripe";
  if (entitlement?.ai_assisted_enabled) {
    const notes = entitlement.notes?.toLowerCase() ?? "";
    return notes.includes("apple") || notes.includes("app store") ? "apple" : "included";
  }
  return "none";
}

function roomPlanLabel(value: string | null) {
  if (!value) return "Paid Room";
  return value
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function getSubscriptionPriceId(subscription: Stripe.Subscription) {
  return subscription.items.data[0]?.price?.id ?? null;
}

function getPeriodEnd(subscription: Stripe.Subscription) {
  const value = (subscription as Stripe.Subscription & { current_period_end?: number })
    .current_period_end;
  return value ? new Date(value * 1000).toISOString() : null;
}

function isManageableStatus(status: Stripe.Subscription.Status) {
  return ["active", "trialing", "past_due"].includes(status);
}

async function reconcileLegacyMembershipSubscription({
  entitlement,
  userId,
  stripe,
  admin,
}: {
  entitlement: EntitlementRow | null;
  userId: string;
  stripe: Stripe | null;
  admin: ReturnType<typeof getBillingSupabaseAdmin>;
}): Promise<EntitlementRow | null> {
  if (
    !stripe ||
    !entitlement?.stripe_customer_id ||
    entitlement.stripe_subscription_id
  ) {
    return entitlement;
  }

  try {
    const subscriptions = await stripe.subscriptions.list({
      customer: entitlement.stripe_customer_id,
      status: "all",
      limit: 100,
    });

    const candidates = subscriptions.data
      .filter((subscription) => {
        const priceId = getSubscriptionPriceId(subscription);
        return (
          subscription.metadata?.product === "loombus_premium_ai" ||
          Boolean(getPremiumPlanKeyFromPriceId(priceId))
        );
      })
      .sort((left, right) => {
        const leftActive = isManageableStatus(left.status) ? 1 : 0;
        const rightActive = isManageableStatus(right.status) ? 1 : 0;
        if (leftActive !== rightActive) return rightActive - leftActive;
        return right.created - left.created;
      });

    const subscription = candidates[0];
    if (!subscription) return entitlement;

    const priceId = getSubscriptionPriceId(subscription);
    const currentPeriodEnd = getPeriodEnd(subscription);
    const reconciled: EntitlementRow = {
      ...entitlement,
      stripe_subscription_id: subscription.id,
      stripe_price_id: priceId,
      stripe_current_period_end: currentPeriodEnd,
      stripe_subscription_status: subscription.status,
    };

    const { error } = await admin
      .from("user_ai_entitlements")
      .update({
        stripe_subscription_id: subscription.id,
        stripe_price_id: priceId,
        stripe_current_period_end: currentPeriodEnd,
        stripe_subscription_status: subscription.status,
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", userId);

    if (error) {
      console.error("Legacy Premium subscription reconciliation could not persist:", {
        userId,
        subscriptionId: subscription.id,
        message: error.message,
      });
    }

    return reconciled;
  } catch (error) {
    console.error("Legacy Premium subscription reconciliation failed:", {
      userId,
      customerId: entitlement.stripe_customer_id,
      message: error instanceof Error ? error.message : "Unknown Stripe error",
    });
    return entitlement;
  }
}

async function enrichFromStripe(
  item: SubscriptionItem,
  stripe: Stripe | null
): Promise<SubscriptionItem> {
  if (!stripe || !item.subscriptionId) return item;

  try {
    const subscription = await stripe.subscriptions.retrieve(item.subscriptionId, {
      expand: ["items.data.price.product"],
    });
    const price = subscription.items.data[0]?.price;
    const product = price?.product;
    const productName =
      product && typeof product !== "string" && "name" in product
        ? product.name
        : null;

    return {
      ...item,
      label: item.scope === "membership" && productName ? productName : item.label,
      status: subscription.status,
      amount: price?.unit_amount ?? null,
      currency: price?.currency ?? null,
      interval: price?.recurring?.interval ?? null,
      currentPeriodEnd: getPeriodEnd(subscription) ?? item.currentPeriodEnd,
      cancelAtPeriodEnd: Boolean(subscription.cancel_at_period_end),
      canManage: true,
    };
  } catch (error) {
    console.error("Unable to enrich subscription from Stripe:", {
      subscriptionId: item.subscriptionId,
      message: error instanceof Error ? error.message : "Unknown Stripe error",
    });
    return item;
  }
}

export async function GET(request: NextRequest) {
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

    const admin = getBillingSupabaseAdmin();
    const stripe = getStripe();
    const [entitlementResult, roomResult] = await Promise.all([
      admin
        .from("user_ai_entitlements")
        .select(
          "tier, ai_assisted_enabled, monthly_summary_limit, stripe_customer_id, stripe_subscription_id, stripe_price_id, stripe_current_period_end, stripe_subscription_status, notes"
        )
        .eq("user_id", user.id)
        .maybeSingle(),
      admin
        .from("rooms")
        .select(
          "id, name, subscription_plan, subscription_status, member_limit, stripe_customer_id, stripe_subscription_id, stripe_price_id, stripe_current_period_end"
        )
        .or(`owner_id.eq.${user.id},created_by.eq.${user.id}`)
        .not("stripe_subscription_id", "is", null),
    ]);

    if (entitlementResult.error) {
      throw new Error(`Unable to load membership billing: ${entitlementResult.error.message}`);
    }
    if (roomResult.error) {
      throw new Error(`Unable to load Room billing: ${roomResult.error.message}`);
    }

    const entitlement = await reconcileLegacyMembershipSubscription({
      entitlement: (entitlementResult.data ?? null) as EntitlementRow | null,
      userId: user.id,
      stripe,
      admin,
    });
    const rooms = (roomResult.data ?? []) as RoomRow[];
    const membershipPlan = getMembershipPlan(entitlement);
    const membershipProvider = getProvider(entitlement);

    const membership: SubscriptionItem = {
      id: "loombus-membership",
      scope: "membership",
      label: "Loombus membership",
      planLabel: membershipPlan,
      provider: membershipProvider,
      status:
        entitlement?.stripe_subscription_status ??
        (membershipPlan === "Free" ? "free" : membershipProvider === "admin" ? "admin" : "active"),
      subscriptionId: entitlement?.stripe_subscription_id ?? null,
      amount: null,
      currency: null,
      interval: null,
      currentPeriodEnd: entitlement?.stripe_current_period_end ?? null,
      cancelAtPeriodEnd: false,
      canManage: membershipProvider === "stripe" && Boolean(entitlement?.stripe_customer_id),
      roomIds: [],
      roomNames: [],
      memberLimit: null,
    };

    const groupedRooms = new Map<string, RoomRow[]>();
    for (const room of rooms) {
      if (!room.stripe_subscription_id) continue;
      const current = groupedRooms.get(room.stripe_subscription_id) ?? [];
      current.push(room);
      groupedRooms.set(room.stripe_subscription_id, current);
    }

    const roomSubscriptions: SubscriptionItem[] = Array.from(groupedRooms.entries()).map(
      ([subscriptionId, entries]) => {
        const anchor = entries[0];
        const includedCount = Math.max(0, entries.length - 1);
        return {
          id: `room-${subscriptionId}`,
          scope: "room",
          label:
            includedCount > 0
              ? `${anchor.name || "Loombus Room"} and ${includedCount} included Room${includedCount === 1 ? "" : "s"}`
              : anchor.name || "Loombus Room",
          planLabel: `${roomPlanLabel(anchor.subscription_plan)} Room`,
          provider: "stripe",
          status: anchor.subscription_status ?? "active",
          subscriptionId,
          amount: null,
          currency: null,
          interval: null,
          currentPeriodEnd: anchor.stripe_current_period_end,
          cancelAtPeriodEnd: false,
          canManage: Boolean(anchor.stripe_customer_id),
          roomIds: entries.map((entry) => entry.id),
          roomNames: entries.map((entry) => entry.name || "Loombus Room"),
          memberLimit: anchor.member_limit,
        } satisfies SubscriptionItem;
      }
    );

    const [enrichedMembership, enrichedRooms] = await Promise.all([
      enrichFromStripe(membership, stripe),
      Promise.all(roomSubscriptions.map((item) => enrichFromStripe(item, stripe))),
    ]);

    return NextResponse.json(
      {
        membership: enrichedMembership,
        roomSubscriptions: enrichedRooms,
        recurringCount:
          (enrichedMembership.subscriptionId ? 1 : 0) + enrichedRooms.length,
      },
      {
        headers: { "Cache-Control": "private, no-store, max-age=0" },
      }
    );
  } catch (error) {
    console.error("Settings subscription lookup failed:", error);
    return NextResponse.json(
      { error: "Unable to load subscription information." },
      { status: 500 }
    );
  }
}
