import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import {
  type BillingIdentity,
  EXTRA_AI_PACK_CREDITS,
  activatePremiumForUser,
  deactivatePremiumForUser,
  ensureExtraAiPackPurchaseLedger,
  getBillingSupabaseAdmin,
} from "@/lib/billing-entitlements";
import {
  fulfillCreatorSupporterCheckoutSession,
  isCreatorSupporterProduct,
  syncCreatorPayoutAccountEvent,
  syncCreatorSupporterDisputeEvent,
  syncCreatorSupporterInvoiceEvent,
  syncCreatorSupporterSubscriptionEvent,
} from "@/lib/creator-supporter-billing";
import { syncAdoptedCreatorPayoutAccountEvent } from "@/lib/creator-supporter-payout-adoption-server";
import { isFloorPlanKey, syncFloorSubscription } from "@/lib/floor-billing";
import { syncLibraryPaymentStripeEvent } from "@/lib/library-commerce-events-server";
import { fulfillLibraryCheckoutSession } from "@/lib/library-commerce-server";
import { syncMemberPayoutAccountEvent } from "@/lib/member-payout-account-server";
import { syncProfessionalBookingPaymentStripeEvent } from "@/lib/professional-booking-payment-server";
import { fulfillRoomCheckoutSession } from "@/lib/room-billing";
import { syncRoomSubscriptionEvent } from "@/lib/room-subscription-events";

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;

const GENERAL_ACCESS_STATUSES = new Set<Stripe.Subscription.Status>([
  "active",
  "trialing",
  "past_due",
]);

const GENERAL_REVOKE_STATUSES = new Set<Stripe.Subscription.Status>([
  "canceled",
  "unpaid",
  "incomplete",
  "incomplete_expired",
  "paused",
]);

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
  if (typeof session.customer === "string") return session.customer;
  return session.customer?.id ?? null;
}

function getSubscriptionIdFromCheckoutSession(session: Stripe.Checkout.Session) {
  if (typeof session.subscription === "string") return session.subscription;
  return session.subscription?.id ?? null;
}

function getPaymentIntentIdFromCheckoutSession(session: Stripe.Checkout.Session) {
  if (typeof session.payment_intent === "string") return session.payment_intent;
  return session.payment_intent?.id ?? null;
}

function getCustomerIdFromSubscription(subscription: Stripe.Subscription) {
  if (typeof subscription.customer === "string") return subscription.customer;
  return subscription.customer?.id ?? null;
}

function getSubscriptionPriceId(subscription: Stripe.Subscription) {
  return subscription.items?.data?.[0]?.price?.id ?? null;
}

function getSubscriptionPeriodEnd(subscription: Stripe.Subscription) {
  const legacyPeriodEnd = (
    subscription as Stripe.Subscription & {
      current_period_end?: number | null;
    }
  ).current_period_end;

  if (
    typeof legacyPeriodEnd === "number" &&
    Number.isFinite(legacyPeriodEnd)
  ) {
    return new Date(legacyPeriodEnd * 1000).toISOString();
  }

  const itemPeriodEnds = subscription.items.data
    .map((item) => item.current_period_end)
    .filter(
      (value): value is number =>
        typeof value === "number" && Number.isFinite(value)
    );

  if (itemPeriodEnds.length === 0) {
    return null;
  }

  return new Date(Math.min(...itemPeriodEnds) * 1000).toISOString();
}

function getUserIdFromSubscription(subscription: Stripe.Subscription) {
  return subscription.metadata?.user_id ?? null;
}

function getPlanKeyFromSubscription(subscription: Stripe.Subscription) {
  return subscription.metadata?.plan_key ?? null;
}

async function resolveGeneralStripeSubscriptionOwnership(
  subscription: Stripe.Subscription
): Promise<{ userId: string; planKey: string | null } | null> {
  const metadataUserId = getUserIdFromSubscription(subscription);
  const metadataPlanKey = getPlanKeyFromSubscription(subscription);

  if (metadataUserId) {
    return { userId: metadataUserId, planKey: metadataPlanKey };
  }

  const supabase = getBillingSupabaseAdmin();
  const { data, error } = await (
    supabase.from("user_general_subscriptions") as any
  )
    .select("user_id, plan_key")
    .eq("provider", "stripe")
    .eq("provider_subscription_id", subscription.id)
    .maybeSingle();

  if (error) {
    throw new Error(
      `Unable to recover Stripe subscription ownership: ${error.message}`
    );
  }

  if (!data?.user_id) return null;

  return {
    userId: data.user_id,
    planKey: metadataPlanKey ?? data.plan_key ?? null,
  };
}

function getGeneralStripeBillingIdentity(
  subscription: Stripe.Subscription,
  fallbackCustomerId?: string | null
): BillingIdentity {
  const customerId =
    getCustomerIdFromSubscription(subscription) ?? fallbackCustomerId ?? null;
  const priceId = getSubscriptionPriceId(subscription);
  const periodEnd = getSubscriptionPeriodEnd(subscription);
  const scheduledCancelAt =
    typeof subscription.cancel_at === "number" &&
    Number.isFinite(subscription.cancel_at)
      ? subscription.cancel_at
      : null;
  const effectivelyCancelsAtPeriodEnd =
    subscription.cancel_at_period_end ||
    (scheduledCancelAt !== null &&
      periodEnd !== null &&
      scheduledCancelAt * 1000 === new Date(periodEnd).getTime());

  return {
    provider: "stripe",
    providerCustomerId: customerId,
    providerSubscriptionId: subscription.id,
    providerProductId: priceId,
    currentPeriodEnd: periodEnd,
    subscriptionStatus: subscription.status,
    cancelAtPeriodEnd: effectivelyCancelsAtPeriodEnd,
    lastVerifiedAt: new Date().toISOString(),
    stripeCustomerId: customerId,
    stripeSubscriptionId: subscription.id,
    stripePriceId: priceId,
    stripeCurrentPeriodEnd: periodEnd,
    stripeSubscriptionStatus: subscription.status,
  };
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

async function syncGeneralStripeSubscription(
  userId: string,
  planKey: string | null,
  subscription: Stripe.Subscription,
  fallbackCustomerId?: string | null,
  source = "Stripe subscription event"
) {
  const billingIdentity = getGeneralStripeBillingIdentity(
    subscription,
    fallbackCustomerId
  );

  if (GENERAL_ACCESS_STATUSES.has(subscription.status)) {
    await activatePremiumForUser(
      userId,
      `General Loombus subscription active from ${source} ${subscription.id} with status ${subscription.status}.`,
      planKey,
      billingIdentity
    );
    return;
  }

  if (GENERAL_REVOKE_STATUSES.has(subscription.status)) {
    await deactivatePremiumForUser(
      userId,
      `General Loombus subscription disabled from ${source} ${subscription.id} with status ${subscription.status}.`,
      billingIdentity,
      planKey
    );
    return;
  }

  console.log(
    `Stripe subscription ${subscription.id} has status ${subscription.status}; no general entitlement change applied.`
  );
}

async function handleCheckoutSessionCompleted(session: Stripe.Checkout.Session) {
  if (await fulfillLibraryCheckoutSession(session)) {
    return;
  }
  if (isCreatorSupporterProduct(session)) {
    await fulfillCreatorSupporterCheckoutSession(session);
    return;
  }
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
  if (!subscriptionId) {
    console.warn(
      "Stripe subscription checkout completed without subscription id:",
      session.id
    );
    return;
  }

  const checkoutCustomerId = getCustomerIdFromCheckoutSession(session);
  const subscription = await getStripe().subscriptions.retrieve(subscriptionId);

  if (session.metadata?.product === "loombus_floor" && isFloorPlanKey(planKey)) {
    await syncFloorSubscription(userId, planKey, subscription.status, {
      stripeCustomerId:
        getCustomerIdFromSubscription(subscription) ?? checkoutCustomerId,
      stripeSubscriptionId: subscription.id,
      stripePriceId: getSubscriptionPriceId(subscription),
      stripeCurrentPeriodEnd: getSubscriptionPeriodEnd(subscription),
      stripeSubscriptionStatus: subscription.status,
    });
    return;
  }

  await syncGeneralStripeSubscription(
    userId,
    planKey,
    subscription,
    checkoutCustomerId,
    `Stripe checkout session ${session.id}`
  );
}

async function handleSubscriptionChanged(subscription: Stripe.Subscription) {
  if (isCreatorSupporterProduct(subscription)) {
    await syncCreatorSupporterSubscriptionEvent(subscription);
    return;
  }
  if (subscription.metadata?.product === "loombus_room") {
    await syncRoomSubscriptionEvent(subscription);
    return;
  }

  const ownership = await resolveGeneralStripeSubscriptionOwnership(subscription);
  if (!ownership) {
    console.warn(
      "Stripe subscription event could not be matched to a Loombus account:",
      subscription.id
    );
    return;
  }

  const { userId, planKey } = ownership;
  const billingIdentity = getGeneralStripeBillingIdentity(subscription);

  if (
    subscription.metadata?.product === "loombus_floor" &&
    isFloorPlanKey(planKey)
  ) {
    await syncFloorSubscription(
      userId,
      planKey,
      subscription.status,
      billingIdentity
    );
    return;
  }

  await syncGeneralStripeSubscription(
    userId,
    planKey,
    subscription,
    null,
    "Stripe webhook"
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
    return NextResponse.json({ error: "Missing Stripe signature." }, { status: 400 });
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
    if (await syncLibraryPaymentStripeEvent(event)) {
      return NextResponse.json({ received: true });
    }
    if (await syncProfessionalBookingPaymentStripeEvent(event)) {
      return NextResponse.json({ received: true });
    }

    switch (event.type) {
      case "checkout.session.completed":
        await handleCheckoutSessionCompleted(
          event.data.object as Stripe.Checkout.Session
        );
        break;
      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted":
      case "customer.subscription.paused":
      case "customer.subscription.resumed":
        await handleSubscriptionChanged(
          event.data.object as Stripe.Subscription
        );
        break;
      case "account.updated": {
        const account = event.data.object as Stripe.Account;
        await syncMemberPayoutAccountEvent(account);
        const adoptedCreatorHandled = await syncAdoptedCreatorPayoutAccountEvent(account);
        if (!adoptedCreatorHandled) {
          await syncCreatorPayoutAccountEvent(account);
        }
        break;
      }
      case "invoice.paid":
        await syncCreatorSupporterInvoiceEvent(
          event.data.object as Stripe.Invoice,
          "paid"
        );
        break;
      case "invoice.payment_failed":
        await syncCreatorSupporterInvoiceEvent(
          event.data.object as Stripe.Invoice,
          "failed"
        );
        break;
      case "charge.dispute.created":
      case "charge.dispute.closed":
        await syncCreatorSupporterDisputeEvent(
          event.data.object as Stripe.Dispute
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
