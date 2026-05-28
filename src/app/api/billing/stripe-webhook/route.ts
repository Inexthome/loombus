import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import Stripe from "stripe";

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const PREMIUM_LIMITS = {
  monthly_summary_limit: 50,
  monthly_writing_limit: 25,
  monthly_research_limit: 10,
  monthly_discovery_limit: 25,
};

const PREMIUM_PLUS_LIMITS = {
  monthly_summary_limit: 150,
  monthly_writing_limit: 75,
  monthly_research_limit: 30,
  monthly_discovery_limit: 75,
};

type StripeBillingIdentity = {
  stripeCustomerId?: string | null;
  stripeSubscriptionId?: string | null;
  stripePriceId?: string | null;
  stripeCurrentPeriodEnd?: string | null;
  stripeSubscriptionStatus?: string | null;
};

function getStripe() {
  if (!STRIPE_SECRET_KEY) {
    throw new Error("STRIPE_SECRET_KEY is not configured.");
  }

  return new Stripe(STRIPE_SECRET_KEY);
}

function getSupabaseAdmin() {
  if (!SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is not configured.");
  }

  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );
}

function getLimitsForPlan(planKey: string | null | undefined) {
  if (planKey?.startsWith("premium_plus")) {
    return PREMIUM_PLUS_LIMITS;
  }

  return PREMIUM_LIMITS;
}

function getPlanLabel(planKey: string | null | undefined) {
  if (planKey === "premium_annual") return "Premium Annual";
  if (planKey === "premium_plus_monthly") return "Premium Plus Monthly";
  if (planKey === "premium_plus_annual") return "Premium Plus Annual";
  return "Premium Monthly";
}

async function activatePremiumForUser(
  userId: string,
  note: string,
  planKey?: string | null,
  billingIdentity: StripeBillingIdentity = {}
) {
  const supabase = getSupabaseAdmin();
  const updatedAt = new Date().toISOString();
  const limits = getLimitsForPlan(planKey);

  const { error } = await supabase.from("user_ai_entitlements").upsert(
    {
      user_id: userId,
      tier: "premium",
      ai_assisted_enabled: true,
      ...limits,
      stripe_customer_id: billingIdentity.stripeCustomerId ?? null,
      stripe_subscription_id: billingIdentity.stripeSubscriptionId ?? null,
      stripe_price_id: billingIdentity.stripePriceId ?? null,
      stripe_current_period_end: billingIdentity.stripeCurrentPeriodEnd ?? null,
      stripe_subscription_status:
        billingIdentity.stripeSubscriptionStatus ?? "active",
      notes: `${note} Plan: ${getPlanLabel(planKey)}.`,
      updated_at: updatedAt,
    },
    {
      onConflict: "user_id",
    }
  );

  if (error) {
    throw new Error(`Unable to activate Premium AI access: ${error.message}`);
  }
}

async function deactivatePremiumForUser(
  userId: string,
  note: string,
  billingIdentity: StripeBillingIdentity = {}
) {
  const supabase = getSupabaseAdmin();
  const updatedAt = new Date().toISOString();

  const { error } = await supabase.from("user_ai_entitlements").upsert(
    {
      user_id: userId,
      tier: "free",
      ai_assisted_enabled: false,
      monthly_summary_limit: 0,
      monthly_writing_limit: 0,
      monthly_research_limit: 0,
      monthly_discovery_limit: 0,
      stripe_customer_id: billingIdentity.stripeCustomerId ?? null,
      stripe_subscription_id: billingIdentity.stripeSubscriptionId ?? null,
      stripe_price_id: billingIdentity.stripePriceId ?? null,
      stripe_current_period_end: billingIdentity.stripeCurrentPeriodEnd ?? null,
      stripe_subscription_status:
        billingIdentity.stripeSubscriptionStatus ?? "canceled",
      notes: note,
      updated_at: updatedAt,
    },
    {
      onConflict: "user_id",
    }
  );

  if (error) {
    throw new Error(`Unable to deactivate Premium AI access: ${error.message}`);
  }
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
  const periodEnd = (subscription as Stripe.Subscription & {
    current_period_end?: number;
  }).current_period_end;

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

async function handleCheckoutSessionCompleted(session: Stripe.Checkout.Session) {
  if (session.mode !== "subscription") return;

  const userId = getUserIdFromCheckoutSession(session);
  const planKey = getPlanKeyFromCheckoutSession(session);

  if (!userId) {
    console.warn("Stripe checkout session completed without user_id metadata:", session.id);
    return;
  }

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
  const userId = getUserIdFromSubscription(subscription);
  const planKey = getPlanKeyFromSubscription(subscription);

  if (!userId) {
    console.warn("Stripe subscription event missing user_id metadata:", subscription.id);
    return;
  }

  const billingIdentity: StripeBillingIdentity = {
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
