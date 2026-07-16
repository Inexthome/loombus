import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import {
  type BillingIdentity,
  EXTRA_AI_PACK_CREDITS,
  activatePremiumForUser,
  deactivatePremiumForUser,
  ensureExtraAiPackPurchaseLedger,
  getBillingPlanLabel,
  getBillingSupabaseAdmin,
} from "@/lib/billing-entitlements";
import { fulfillRoomCheckoutSession } from "@/lib/room-billing";
import { syncRoomSubscriptionEvent } from "@/lib/room-subscription-events";

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;

function getStripe() {
  if (!STRIPE_SECRET_KEY) {
    throw new Error("STRIPE_SECRET_KEY is not configured.");
  }

  return new Stripe(STRIPE_SECRET_KEY);
}

function isExtraAiPackPlan(planKey: string | null | undefined) {
  return planKey === "extra_ai_pack";
}

function getUserIdFromCheckoutSession(session: Stripe.Checkout.Session) {
  return session.metadata?.user_id ?? session.client_reference_id ?? null;
}

function getPlanKeyFromCheckoutSession(session: Stripe.Checkout.Session) {
  return session.metadata?.plan_key ?? null;
}

function getCustomerIdFromCheckoutSession(session: Stripe.Checkout.Session) {
  if (typeof session.customer === "string") {
    return session.customer;
  }
  return session.customer?.id ?? null;
}

function getSubscriptionIdFromCheckoutSession(session: Stripe.Checkout.Session) {
  if (typeof session.subscription === "string") {
    return session.subscription;
  }
  return session.subscription?.id ?? null;
}

function getPaymentIntentIdFromCheckoutSession(session: Stripe.Checkout.Session) {
  if (typeof session.payment_intent === "string") {
    return session.payment_intent;
  }
  return session.payment_intent?.id ?? null;
}

function getCustomerIdFromSubscription(subscription: Stripe.Subscription) {
  if (typeof subscription.customer === "string") {
    return subscription.customer;
  }
  return subscription.customer?.id ?? null;
}

function getSubscriptionPriceId(subscription: Stripe.Subscription) {
  const item = subscription.items?.data?.[0];
  return item?.price?.id ?? null;
}

function getSubscriptionPeriodEnd(subscription: Stripe.Subscription) {
  const periodEnd = (
    subscription as Stripe.Subscription & { current_period_end?: number }
  ).current_period_end;

  if (!periodEnd) {
    return null;
  }

  return new Date(periodEnd * 1000).toISOString();
}

function getUserIdFromSubscription(subscription: Stripe.Subscription) {
  return subscription.metadata?.user_id ?? null;
}

function getPlanKeyFromSubscription(subscription: Stripe.Subscription) {
  return subscription.metadata?.plan_key ?? null;
}

async function fulfillExtraAiPackForUser(
  userId: string,
  session: Stripe.Checkout.Session
) {
  const supabase = getBillingSupabaseAdmin();
  const checkoutSessionId = session.id;

  const { data: existingPack, error: existingError } = await (
    supabase.from("ai_extra_credit_packs") as any
  )
    .select("id")
    .eq("stripe_checkout_session_id", checkoutSessionId)
    .maybeSingle();

  if (existingError) {
    throw new Error(
      `Unable to verify Extra AI Pack purchase: ${existingError.message}`
    );
  }

  if (existingPack?.id) {
    await ensureExtraAiPackPurchaseLedger({
      supabase,
      packId: existingPack.id,
      userId,
      checkoutSessionId,
    });
    return;
  }

  const { data: pack, error } = await (
    supabase.from("ai_extra_credit_packs") as any
  )
    .insert({
      user_id: userId,
      stripe_checkout_session_id: checkoutSessionId,
      stripe_payment_intent_id: getPaymentIntentIdFromCheckoutSession(session),
      stripe_customer_id: getCustomerIdFromCheckoutSession(session),
      purchased_credits: EXTRA_AI_PACK_CREDITS,
      remaining_credits: EXTRA_AI_PACK_CREDITS,
      status: "active",
      source: "stripe",
      notes: `Extra AI Pack fulfilled from Stripe checkout session ${checkoutSessionId}.`,
    })
    .select("id")
    .single();

  if (error || !pack?.id) {
    throw new Error(
      `Unable to fulfill Extra AI Pack: ${error?.message ?? "Missing pack id."}`
    );
  }

  await ensureExtraAiPackPurchaseLedger({
    supabase,
    packId: pack.id,
    userId,
    checkoutSessionId,
  });
}

async function handleCheckoutSessionCompleted(session: Stripe.Checkout.Session) {
  if (session.metadata?.product === "loombus_room") {
    await fulfillRoomCheckoutSession(session);
    return;
  }

  const userId = getUserIdFromCheckoutSession(session);
  const planKey = getPlanKeyFromCheckoutSession(session);

  if (!userId) {
    console.warn(
      "Stripe checkout session completed without user_id metadata:",
      session.id
    );
    return;
  }

  if (session.mode === "payment" && isExtraAiPackPlan(planKey)) {
    await fulfillExtraAiPackForUser(userId, session);
    return;
  }

  if (session.mode !== "subscription") return;

  const subscriptionId = getSubscriptionIdFromCheckoutSession(session);
  const checkoutCustomerId = getCustomerIdFromCheckoutSession(session);

  if (subscriptionId) {
    const subscription = await getStripe().subscriptions.retrieve(subscriptionId);

    if (["active", "trialing"].includes(subscription.status)) {
      await activatePremiumForUser(
        userId,
        `Premium AI-Assisted Layer activated from Stripe checkout session ${session.id}.`,
        planKey,
        {
          stripeCustomerId:
            getCustomerIdFromSubscription(subscription) ?? checkoutCustomerId,
          stripeSubscriptionId: subscription.id,
          stripePriceId: getSubscriptionPriceId(subscription),
          stripeCurrentPeriodEnd: getSubscriptionPeriodEnd(subscription),
          stripeSubscriptionStatus: subscription.status,
        }
      );
    }

    return;
  }

  await activatePremiumForUser(
    userId,
    `Premium AI-Assisted Layer activated from Stripe checkout session ${session.id}.`,
    planKey,
    {
      stripeCustomerId: checkoutCustomerId,
      stripeSubscriptionId: subscriptionId,
      stripeSubscriptionStatus: "active",
    }
  );
}

async function handleSubscriptionChanged(subscription: Stripe.Subscription) {
  if (subscription.metadata?.product === "loombus_room") {
    await syncRoomSubscriptionEvent(subscription);
    return;
  }

  const userId = getUserIdFromSubscription(subscription);
  const planKey = getPlanKeyFromSubscription(subscription);

  if (!userId) {
    console.warn(
      "Stripe subscription event missing user_id metadata:",
      subscription.id
    );
    return;
  }

  const billingIdentity: BillingIdentity = {
    stripeCustomerId: getCustomerIdFromSubscription(subscription),
    stripeSubscriptionId: subscription.id,
    stripePriceId: getSubscriptionPriceId(subscription),
    stripeCurrentPeriodEnd: getSubscriptionPeriodEnd(subscription),
    stripeSubscriptionStatus: subscription.status,
  };

  if (["active", "trialing"].includes(subscription.status)) {
    await activatePremiumForUser(
      userId,
      `Premium AI-Assisted Layer active from Stripe subscription ${subscription.id} with status ${subscription.status}.`,
      planKey,
      billingIdentity
    );
    return;
  }

  if (["canceled", "unpaid", "incomplete_expired"].includes(subscription.status)) {
    await deactivatePremiumForUser(
      userId,
      `Premium AI-Assisted Layer disabled from Stripe subscription ${subscription.id} with status ${subscription.status}.`,
      billingIdentity
    );
    return;
  }

  console.log(
    `Stripe subscription ${subscription.id} has status ${subscription.status}; no entitlement change applied.`
  );
}

export async function POST(request: NextRequest) {
  if (!STRIPE_SECRET_KEY || !STRIPE_WEBHOOK_SECRET) {
    return NextResponse.json(
      {
        error:
          "Stripe webhook is not configured yet. Stripe secret key and webhook secret are required.",
        code: "stripe_webhook_not_configured",
      },
      { status: 503 }
    );
  }

  const signature = request.headers.get("stripe-signature");

  if (!signature) {
    return NextResponse.json(
      { error: "Missing Stripe signature." },
      { status: 400 }
    );
  }

  const rawBody = await request.text();

  let event: Stripe.Event;

  try {
    event = getStripe().webhooks.constructEvent(
      rawBody,
      signature,
      STRIPE_WEBHOOK_SECRET
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";

    console.error("Stripe webhook signature verification failed:", message);

    return NextResponse.json(
      { error: "Invalid Stripe webhook signature." },
      { status: 400 }
    );
  }

  try {
    switch (event.type) {
      case "checkout.session.completed":
        await handleCheckoutSessionCompleted(
          event.data.object as Stripe.Checkout.Session
        );
        break;

      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted":
        await handleSubscriptionChanged(
          event.data.object as Stripe.Subscription
        );
        break;

      default:
        console.log(`Unhandled Stripe webhook event: ${event.type}`);
        break;
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("Stripe webhook handling failed:", error);

    return NextResponse.json(
      { error: "Stripe webhook handling failed." },
      { status: 500 }
    );
  }
}
