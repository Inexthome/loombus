import "server-only";

import { randomUUID } from "node:crypto";
import Stripe from "stripe";
import { logAuditEvent } from "@/lib/audit-log";
import { createMemberPrivacyServiceClient } from "@/lib/member-privacy-server";

const PRODUCT_KEY = "loombus_creator_supporter";
const TERMS_VERSION = "creator-supporters-2026-08";
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;

const LIVE_SUBSCRIPTION_STATUSES = new Set([
  "incomplete",
  "trialing",
  "active",
  "past_due",
  "unpaid",
]);

export class CreatorSupporterBillingError extends Error {
  status: number;
  code: string;

  constructor(message: string, status = 500, code = "creator_supporter_billing_error") {
    super(message);
    this.name = "CreatorSupporterBillingError";
    this.status = status;
    this.code = code;
  }
}

function service() {
  const client = createMemberPrivacyServiceClient();
  if (!client) {
    throw new CreatorSupporterBillingError(
      "Creator supporter billing is not configured.",
      503,
      "creator_supporter_service_unavailable"
    );
  }
  return client;
}

function stripe() {
  if (!STRIPE_SECRET_KEY) {
    throw new CreatorSupporterBillingError(
      "Stripe is not configured for creator subscriptions.",
      503,
      "creator_supporter_stripe_unavailable"
    );
  }
  return new Stripe(STRIPE_SECRET_KEY);
}

function enabledFlag(value: string | undefined) {
  return value?.trim().toLowerCase() === "true";
}

function platformFeeBps() {
  const parsed = Number(process.env.CREATOR_SUPPORTER_PLATFORM_FEE_BPS);
  return Number.isInteger(parsed) && parsed >= 0 && parsed <= 5000 ? parsed : null;
}

export function getCreatorSupporterBillingConfiguration() {
  const feeBps = platformFeeBps();
  const betaEnabled = enabledFlag(process.env.CREATOR_SUPPORTER_PAID_BETA_ENABLED);
  const automaticTaxEnabled = enabledFlag(
    process.env.CREATOR_SUPPORTER_AUTOMATIC_TAX_ENABLED
  );
  const stripeReady = Boolean(STRIPE_SECRET_KEY && process.env.STRIPE_WEBHOOK_SECRET);
  const serviceReady = Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  return {
    betaEnabled,
    automaticTaxEnabled,
    stripeReady,
    serviceReady,
    feeBps,
    ready:
      betaEnabled &&
      automaticTaxEnabled &&
      stripeReady &&
      serviceReady &&
      feeBps !== null,
  };
}

function requireBillingReady() {
  const config = getCreatorSupporterBillingConfiguration();
  if (!config.ready || config.feeBps === null) {
    throw new CreatorSupporterBillingError(
      "Paid creator subscriptions are not enabled yet.",
      503,
      "creator_supporter_paid_beta_unavailable"
    );
  }
  return config;
}

function safeOrigin(value: string) {
  try {
    const parsed = new URL(value);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
      throw new Error("Unsupported protocol.");
    }
    return parsed.origin;
  } catch {
    return "https://loombus.com";
  }
}

function idOf(value: string | { id?: string } | null | undefined) {
  if (typeof value === "string") return value;
  return value?.id ?? null;
}

function unixDate(value: number | null | undefined) {
  return value ? new Date(value * 1000).toISOString() : null;
}

function subscriptionPeriod(subscription: Stripe.Subscription) {
  const value = subscription as Stripe.Subscription & {
    current_period_start?: number;
    current_period_end?: number;
  };
  return {
    start: unixDate(value.current_period_start),
    end: unixDate(value.current_period_end),
  };
}

function subscriptionPriceId(subscription: Stripe.Subscription) {
  return subscription.items?.data?.[0]?.price?.id ?? null;
}

function subscriptionAmount(subscription: Stripe.Subscription) {
  return subscription.items?.data?.[0]?.price?.unit_amount ?? null;
}

function subscriptionAllowsAccess(status: string, periodEnd: string | null) {
  if (status === "active" || status === "trialing") return true;
  return status === "past_due" && Boolean(periodEnd && new Date(periodEnd) > new Date());
}

export function isCreatorSupporterProduct(
  value: { metadata?: Record<string, string> | null } | null | undefined
) {
  return value?.metadata?.product === PRODUCT_KEY;
}

async function storePayoutAccount(account: Stripe.Account, creatorId: string) {
  const due = account.requirements?.currently_due ?? [];
  const { error } = await service().from("creator_payout_accounts").upsert(
    {
      creator_id: creatorId,
      stripe_account_id: account.id,
      account_type: "express",
      country: account.country ?? null,
      default_currency: account.default_currency ?? null,
      details_submitted: Boolean(account.details_submitted),
      charges_enabled: Boolean(account.charges_enabled),
      payouts_enabled: Boolean(account.payouts_enabled),
      requirements_due: due,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "creator_id" }
  );
  if (error) {
    throw new CreatorSupporterBillingError(
      `Unable to save creator payout status: ${error.message}`,
      503,
      "creator_payout_storage_failed"
    );
  }
}

export async function refreshCreatorPayoutAccount(creatorId: string) {
  const { data, error } = await service()
    .from("creator_payout_accounts")
    .select("stripe_account_id")
    .eq("creator_id", creatorId)
    .maybeSingle();
  if (error) throw new CreatorSupporterBillingError(error.message, 503);
  if (!data?.stripe_account_id) return null;

  const account = await stripe().accounts.retrieve(data.stripe_account_id);
  if (account.deleted) {
    throw new CreatorSupporterBillingError(
      "The creator payout account is unavailable.",
      409,
      "creator_payout_account_deleted"
    );
  }
  await storePayoutAccount(account, creatorId);
  return account;
}

export async function createCreatorPayoutOnboarding(input: {
  creatorId: string;
  email: string | null;
  origin: string;
  acceptedIp: string | null;
}) {
  requireBillingReady();
  const client = service();
  const { data: existing } = await client
    .from("creator_payout_accounts")
    .select("stripe_account_id")
    .eq("creator_id", input.creatorId)
    .maybeSingle();

  let accountId = existing?.stripe_account_id ?? null;
  if (!accountId) {
    const account = await stripe().accounts.create({
      type: "express",
      email: input.email ?? undefined,
      capabilities: { transfers: { requested: true } },
      metadata: { product: PRODUCT_KEY, creator_id: input.creatorId },
    });
    accountId = account.id;
    const { error } = await client.from("creator_payout_accounts").insert({
      creator_id: input.creatorId,
      stripe_account_id: account.id,
      account_type: "express",
      country: account.country ?? null,
      default_currency: account.default_currency ?? null,
      details_submitted: Boolean(account.details_submitted),
      charges_enabled: Boolean(account.charges_enabled),
      payouts_enabled: Boolean(account.payouts_enabled),
      requirements_due: account.requirements?.currently_due ?? [],
      platform_terms_version: TERMS_VERSION,
      platform_terms_accepted_at: new Date().toISOString(),
      platform_terms_ip: input.acceptedIp,
    });
    if (error) {
      throw new CreatorSupporterBillingError(error.message, 503);
    }
  } else {
    await client
      .from("creator_payout_accounts")
      .update({
        platform_terms_version: TERMS_VERSION,
        platform_terms_accepted_at: new Date().toISOString(),
        platform_terms_ip: input.acceptedIp,
      })
      .eq("creator_id", input.creatorId);
  }

  const origin = safeOrigin(input.origin);
  const link = await stripe().accountLinks.create({
    account: accountId,
    refresh_url: `${origin}/profile?section=creator&payout=refresh`,
    return_url: `${origin}/profile?section=creator&payout=return`,
    type: "account_onboarding",
  });

  await logAuditEvent({
    actor_id: input.creatorId,
    action: "creator_supporter.payout_onboarding_started",
    target_type: "creator_payout_account",
    target_id: input.creatorId,
    metadata: { stripe_account_id: accountId, terms_version: TERMS_VERSION },
  });

  return { url: link.url };
}

export async function createCreatorPayoutDashboardLink(creatorId: string) {
  const account = await refreshCreatorPayoutAccount(creatorId);
  if (!account) {
    throw new CreatorSupporterBillingError(
      "Complete creator payout setup first.",
      409,
      "creator_payout_setup_required"
    );
  }
  if (!account.details_submitted) {
    throw new CreatorSupporterBillingError(
      "Complete creator payout setup first.",
      409,
      "creator_payout_setup_incomplete"
    );
  }
  const link = await stripe().accounts.createLoginLink(account.id);
  return { url: link.url };
}

export async function syncCreatorPayoutAccountEvent(account: Stripe.Account) {
  if (account.metadata?.product !== PRODUCT_KEY || !account.metadata?.creator_id) {
    return false;
  }
  await storePayoutAccount(account, account.metadata.creator_id);
  return true;
}

export async function saveCreatorSupporterTierPricing(input: {
  creatorId: string;
  tierId: string;
  accessMode: "free" | "paid";
  priceCents: number | null;
}) {
  const client = service();
  const { data: tier, error } = await client
    .from("creator_supporter_tiers")
    .select(
      "id, creator_id, name, access_mode, price_cents, stripe_product_id, stripe_price_id, price_version"
    )
    .eq("id", input.tierId)
    .eq("creator_id", input.creatorId)
    .eq("is_active", true)
    .maybeSingle();
  if (error) throw new CreatorSupporterBillingError(error.message, 503);
  if (!tier) {
    throw new CreatorSupporterBillingError("Supporter tier not found.", 404);
  }

  if (input.accessMode === "free") {
    const { error: updateError } = await client
      .from("creator_supporter_tiers")
      .update({
        access_mode: "free",
        price_cents: null,
        currency: null,
        billing_interval: null,
        stripe_product_id: null,
        stripe_price_id: null,
      })
      .eq("id", input.tierId)
      .eq("creator_id", input.creatorId);
    if (updateError) {
      throw new CreatorSupporterBillingError(updateError.message, 400);
    }
    return { accessMode: "free" as const };
  }

  requireBillingReady();
  if (!Number.isInteger(input.priceCents) || !input.priceCents || input.priceCents < 100 || input.priceCents > 100000) {
    throw new CreatorSupporterBillingError(
      "Choose a monthly price between $1 and $1,000.",
      400,
      "creator_supporter_price_invalid"
    );
  }

  const payout = await refreshCreatorPayoutAccount(input.creatorId);
  if (!payout?.details_submitted || !payout.payouts_enabled) {
    throw new CreatorSupporterBillingError(
      "Complete Stripe payout onboarding before enabling a paid tier.",
      409,
      "creator_payout_setup_incomplete"
    );
  }

  let productId = tier.stripe_product_id as string | null;
  if (!productId) {
    const product = await stripe().products.create({
      name: `${tier.name} creator supporter tier`,
      metadata: {
        product: PRODUCT_KEY,
        creator_id: input.creatorId,
        tier_id: input.tierId,
      },
    });
    productId = product.id;
  } else {
    await stripe().products.update(productId, {
      name: `${tier.name} creator supporter tier`,
      active: true,
    });
  }

  let priceId = tier.stripe_price_id as string | null;
  if (tier.access_mode !== "paid" || tier.price_cents !== input.priceCents || !priceId) {
    const price = await stripe().prices.create({
      product: productId,
      currency: "usd",
      unit_amount: input.priceCents,
      recurring: { interval: "month" },
      metadata: {
        product: PRODUCT_KEY,
        creator_id: input.creatorId,
        tier_id: input.tierId,
      },
    });
    priceId = price.id;
  }

  const { error: updateError } = await client
    .from("creator_supporter_tiers")
    .update({
      access_mode: "paid",
      price_cents: input.priceCents,
      currency: "usd",
      billing_interval: "month",
      stripe_product_id: productId,
      stripe_price_id: priceId,
      price_version: Number(tier.price_version ?? 0) + 1,
    })
    .eq("id", input.tierId)
    .eq("creator_id", input.creatorId);
  if (updateError) {
    throw new CreatorSupporterBillingError(updateError.message, 400);
  }

  await logAuditEvent({
    actor_id: input.creatorId,
    action: "creator_supporter.tier_pricing_saved",
    target_type: "creator_supporter_tier",
    target_id: input.tierId,
    metadata: { access_mode: "paid", price_cents: input.priceCents, currency: "usd" },
  });

  return { accessMode: "paid" as const, priceCents: input.priceCents };
}

async function customerForSupporter(supporterId: string, email: string | null) {
  const client = service();
  const { data } = await client
    .from("creator_supporter_customers")
    .select("stripe_customer_id")
    .eq("supporter_id", supporterId)
    .maybeSingle();
  if (data?.stripe_customer_id) return data.stripe_customer_id;

  const customer = await stripe().customers.create({
    email: email ?? undefined,
    metadata: { product: PRODUCT_KEY, supporter_id: supporterId },
  });
  const { error } = await client.from("creator_supporter_customers").insert({
    supporter_id: supporterId,
    stripe_customer_id: customer.id,
  });
  if (error) throw new CreatorSupporterBillingError(error.message, 503);
  return customer.id;
}

export async function startCreatorSupporterCheckout(input: {
  creatorId: string;
  supporterId: string;
  supporterEmail: string | null;
  tierId: string;
  creatorUsername: string;
  origin: string;
}) {
  const config = requireBillingReady();
  const client = service();
  if (input.creatorId === input.supporterId) {
    throw new CreatorSupporterBillingError("You cannot subscribe to your own program.", 400);
  }

  const [{ data: program }, { data: tier }, { data: payout }, { data: existing }] =
    await Promise.all([
      client
        .from("creator_supporter_programs")
        .select("enabled, accepting_new_supporters, billing_hold")
        .eq("creator_id", input.creatorId)
        .maybeSingle(),
      client
        .from("creator_supporter_tiers")
        .select(
          "id, creator_id, access_mode, price_cents, currency, billing_interval, stripe_price_id, is_active"
        )
        .eq("id", input.tierId)
        .eq("creator_id", input.creatorId)
        .maybeSingle(),
      client
        .from("creator_payout_accounts")
        .select("stripe_account_id, details_submitted, payouts_enabled")
        .eq("creator_id", input.creatorId)
        .maybeSingle(),
      client
        .from("creator_supporter_subscriptions")
        .select("status, current_period_end")
        .eq("creator_id", input.creatorId)
        .eq("supporter_id", input.supporterId)
        .maybeSingle(),
    ]);

  if (!program?.enabled || !program.accepting_new_supporters || program.billing_hold) {
    throw new CreatorSupporterBillingError(
      "This creator is not accepting new paid supporters.",
      409,
      "creator_supporter_checkout_closed"
    );
  }
  if (
    !tier?.is_active ||
    tier.access_mode !== "paid" ||
    !tier.price_cents ||
    !tier.stripe_price_id
  ) {
    throw new CreatorSupporterBillingError("Choose an active paid supporter tier.", 400);
  }
  if (!payout?.details_submitted || !payout.payouts_enabled) {
    throw new CreatorSupporterBillingError(
      "This creator has not completed payout setup.",
      409,
      "creator_payout_setup_incomplete"
    );
  }
  if (existing && LIVE_SUBSCRIPTION_STATUSES.has(existing.status)) {
    throw new CreatorSupporterBillingError(
      "You already have a subscription to this creator.",
      409,
      "creator_supporter_subscription_exists"
    );
  }

  const customerId = await customerForSupporter(input.supporterId, input.supporterEmail);
  const intentId = randomUUID();
  const feeBps = config.feeBps as number;
  const metadata = {
    product: PRODUCT_KEY,
    creator_id: input.creatorId,
    supporter_id: input.supporterId,
    tier_id: input.tierId,
    checkout_intent_id: intentId,
    platform_fee_bps: String(feeBps),
  };

  const { error: intentError } = await client
    .from("creator_supporter_checkout_intents")
    .insert({
      id: intentId,
      creator_id: input.creatorId,
      supporter_id: input.supporterId,
      tier_id: input.tierId,
      payout_account_id: payout.stripe_account_id,
      amount_cents: tier.price_cents,
      currency: "usd",
      platform_fee_bps: feeBps,
      status: "pending",
    });
  if (intentError) throw new CreatorSupporterBillingError(intentError.message, 503);

  try {
    const origin = safeOrigin(input.origin);
    const session = await stripe().checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      line_items: [{ price: tier.stripe_price_id, quantity: 1 }],
      client_reference_id: input.supporterId,
      success_url: `${origin}/u/${encodeURIComponent(input.creatorUsername)}?supporter_checkout=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/u/${encodeURIComponent(input.creatorUsername)}?supporter_checkout=cancelled`,
      customer_update: { address: "auto", name: "auto" },
      automatic_tax: { enabled: true },
      metadata,
      subscription_data: {
        metadata,
        transfer_data: {
          destination: payout.stripe_account_id,
          amount_percent: (10000 - feeBps) / 100,
        },
      },
    });
    if (!session.url) throw new Error("Stripe did not return a checkout URL.");

    const { error: updateError } = await client
      .from("creator_supporter_checkout_intents")
      .update({
        stripe_checkout_session_id: session.id,
        expires_at: unixDate(session.expires_at),
      })
      .eq("id", intentId);
    if (updateError) throw new Error(updateError.message);

    await logAuditEvent({
      actor_id: input.supporterId,
      action: "creator_supporter.checkout_started",
      target_type: "creator_supporter_checkout_intent",
      target_id: intentId,
      metadata: {
        creator_id: input.creatorId,
        tier_id: input.tierId,
        amount_cents: tier.price_cents,
        platform_fee_bps: feeBps,
      },
    });

    return { checkoutUrl: session.url };
  } catch (error) {
    const message =
      error instanceof CreatorSupporterBillingError
        ? error.message
        : "Stripe could not start creator supporter checkout.";
    await client
      .from("creator_supporter_checkout_intents")
      .update({ status: "failed", last_error: message })
      .eq("id", intentId);
    if (error instanceof CreatorSupporterBillingError) throw error;
    throw new CreatorSupporterBillingError(message, 503, "creator_supporter_checkout_failed");
  }
}

async function resolveSubscription(session: Stripe.Checkout.Session) {
  if (!session.subscription) return null;
  if (typeof session.subscription !== "string") {
    return session.subscription as Stripe.Subscription;
  }
  return stripe().subscriptions.retrieve(session.subscription);
}

export async function syncCreatorSupporterSubscriptionEvent(
  subscription: Stripe.Subscription
) {
  if (!isCreatorSupporterProduct(subscription)) return false;

  const creatorId = subscription.metadata?.creator_id ?? "";
  const supporterId = subscription.metadata?.supporter_id ?? "";
  const tierId = subscription.metadata?.tier_id ?? "";
  const intentId = subscription.metadata?.checkout_intent_id ?? null;
  const feeBps = Number(subscription.metadata?.platform_fee_bps);
  if (!creatorId || !supporterId || !tierId || !Number.isInteger(feeBps)) {
    throw new CreatorSupporterBillingError(
      "Creator supporter subscription metadata is incomplete.",
      400,
      "creator_supporter_subscription_metadata_invalid"
    );
  }

  const client = service();
  const [{ data: tier }, { data: payout }, { data: existing }] = await Promise.all([
    client
      .from("creator_supporter_tiers")
      .select("id, creator_id, price_cents, currency, stripe_price_id")
      .eq("id", tierId)
      .eq("creator_id", creatorId)
      .maybeSingle(),
    client
      .from("creator_payout_accounts")
      .select("stripe_account_id")
      .eq("creator_id", creatorId)
      .maybeSingle(),
    client
      .from("creator_supporter_subscriptions")
      .select("billing_hold, billing_hold_reason")
      .eq("creator_id", creatorId)
      .eq("supporter_id", supporterId)
      .maybeSingle(),
  ]);
  if (!tier || !payout) {
    throw new CreatorSupporterBillingError(
      "The creator supporter billing contract could not be verified.",
      409,
      "creator_supporter_billing_contract_missing"
    );
  }

  const period = subscriptionPeriod(subscription);
  const priceId = subscriptionPriceId(subscription) ?? tier.stripe_price_id;
  const amount = subscriptionAmount(subscription) ?? tier.price_cents;
  const customerId = idOf(subscription.customer);
  if (!priceId || !amount || !customerId) {
    throw new CreatorSupporterBillingError(
      "Stripe subscription billing identity is incomplete.",
      409,
      "creator_supporter_subscription_identity_invalid"
    );
  }

  const { error } = await client.from("creator_supporter_subscriptions").upsert(
    {
      creator_id: creatorId,
      supporter_id: supporterId,
      tier_id: tierId,
      stripe_subscription_id: subscription.id,
      stripe_customer_id: customerId,
      stripe_price_id: priceId,
      payout_account_id: payout.stripe_account_id,
      status: subscription.status,
      billing_hold: existing?.billing_hold ?? false,
      billing_hold_reason: existing?.billing_hold_reason ?? null,
      cancel_at_period_end: Boolean(subscription.cancel_at_period_end),
      current_period_start: period.start,
      current_period_end: period.end,
      amount_cents: amount,
      currency: tier.currency ?? "usd",
      platform_fee_bps: feeBps,
    },
    { onConflict: "creator_id,supporter_id" }
  );
  if (error) throw new CreatorSupporterBillingError(error.message, 503);

  const allowsAccess =
    !existing?.billing_hold && subscriptionAllowsAccess(subscription.status, period.end);
  if (allowsAccess) {
    const join = await client.rpc("join_creator_supporter_program", {
      p_creator_id: creatorId,
      p_supporter_id: supporterId,
      p_tier_id: tierId,
    });
    if (join.error) throw new CreatorSupporterBillingError(join.error.message, 409);
  } else {
    const ending = await client.rpc("end_creator_supporter_membership", {
      p_creator_id: creatorId,
      p_supporter_id: supporterId,
      p_actor_id: creatorId,
    });
    if (ending.error) throw new CreatorSupporterBillingError(ending.error.message, 409);
  }

  if (intentId) {
    await client
      .from("creator_supporter_checkout_intents")
      .update({
        status: subscriptionAllowsAccess(subscription.status, period.end)
          ? "completed"
          : "failed",
        completed_at: subscriptionAllowsAccess(subscription.status, period.end)
          ? new Date().toISOString()
          : null,
      })
      .eq("id", intentId);
  }

  await logAuditEvent({
    actor_id: supporterId,
    action: "creator_supporter.subscription_synchronized",
    target_type: "creator_supporter_subscription",
    target_id: subscription.id,
    metadata: {
      creator_id: creatorId,
      tier_id: tierId,
      status: subscription.status,
      cancel_at_period_end: Boolean(subscription.cancel_at_period_end),
    },
  });

  return true;
}

export async function fulfillCreatorSupporterCheckoutSession(
  session: Stripe.Checkout.Session
) {
  if (!isCreatorSupporterProduct(session)) return false;
  const subscription = await resolveSubscription(session);
  if (!subscription) {
    throw new CreatorSupporterBillingError(
      "Stripe checkout did not create a subscription.",
      409,
      "creator_supporter_subscription_missing"
    );
  }
  await syncCreatorSupporterSubscriptionEvent(subscription);
  const intentId = session.metadata?.checkout_intent_id;
  if (intentId) {
    await service()
      .from("creator_supporter_checkout_intents")
      .update({
        stripe_checkout_session_id: session.id,
        status: "completed",
        completed_at: new Date().toISOString(),
      })
      .eq("id", intentId);
  }
  await service()
    .from("creator_supporter_subscriptions")
    .update({ stripe_checkout_session_id: session.id })
    .eq("stripe_subscription_id", subscription.id);
  return true;
}

export async function completeCreatorSupporterCheckoutSession(
  sessionId: string,
  supporterId: string
) {
  const session = await stripe().checkout.sessions.retrieve(sessionId, {
    expand: ["subscription"],
  });
  if (
    !isCreatorSupporterProduct(session) ||
    session.metadata?.supporter_id !== supporterId ||
    session.status !== "complete"
  ) {
    throw new CreatorSupporterBillingError(
      "The creator supporter checkout session could not be verified.",
      400,
      "creator_supporter_checkout_mismatch"
    );
  }
  await fulfillCreatorSupporterCheckoutSession(session);
  return {
    creatorId: session.metadata?.creator_id,
    tierId: session.metadata?.tier_id,
  };
}

function invoiceSubscriptionId(invoice: Stripe.Invoice) {
  const value = invoice as unknown as {
    subscription?: string | { id?: string } | null;
    parent?: {
      subscription_details?: { subscription?: string | { id?: string } | null };
    } | null;
  };
  return (
    idOf(value.subscription) ??
    idOf(value.parent?.subscription_details?.subscription) ??
    null
  );
}

function invoicePaymentIntentId(invoice: Stripe.Invoice) {
  const value = invoice as unknown as {
    payment_intent?: string | { id?: string } | null;
    payments?: {
      data?: Array<{
        payment?: {
          payment_intent?: string | { id?: string } | null;
        } | null;
      }>;
    } | null;
  };
  return (
    idOf(value.payment_intent) ??
    idOf(value.payments?.data?.[0]?.payment?.payment_intent) ??
    null
  );
}

export async function syncCreatorSupporterInvoiceEvent(
  invoice: Stripe.Invoice,
  paymentStatus: "paid" | "failed"
) {
  const subscriptionId = invoiceSubscriptionId(invoice);
  if (!subscriptionId) return false;
  const subscription = await stripe().subscriptions.retrieve(subscriptionId);
  if (!isCreatorSupporterProduct(subscription)) return false;

  await syncCreatorSupporterSubscriptionEvent(subscription);
  await service()
    .from("creator_supporter_subscriptions")
    .update({
      last_invoice_id: invoice.id,
      last_payment_intent_id: invoicePaymentIntentId(invoice),
      last_payment_status: paymentStatus,
    })
    .eq("stripe_subscription_id", subscription.id);
  return true;
}

async function disputePaymentIntentId(dispute: Stripe.Dispute) {
  const chargeValue = dispute.charge;
  const charge =
    typeof chargeValue === "string"
      ? await stripe().charges.retrieve(chargeValue)
      : chargeValue;
  if (!charge || charge.deleted) return null;
  return idOf(charge.payment_intent);
}

export async function syncCreatorSupporterDisputeEvent(dispute: Stripe.Dispute) {
  const paymentIntentId = await disputePaymentIntentId(dispute);
  if (!paymentIntentId) return false;
  const client = service();
  const { data: local } = await client
    .from("creator_supporter_subscriptions")
    .select("creator_id, supporter_id, stripe_subscription_id")
    .eq("last_payment_intent_id", paymentIntentId)
    .maybeSingle();
  if (!local) return false;

  const won = dispute.status === "won";
  await client
    .from("creator_supporter_subscriptions")
    .update({
      billing_hold: !won,
      billing_hold_reason: won ? null : `Stripe dispute ${dispute.id} is ${dispute.status}.`,
    })
    .eq("stripe_subscription_id", local.stripe_subscription_id);

  if (won) {
    const subscription = await stripe().subscriptions.retrieve(
      local.stripe_subscription_id
    );
    await syncCreatorSupporterSubscriptionEvent(subscription);
  } else {
    await client.rpc("end_creator_supporter_membership", {
      p_creator_id: local.creator_id,
      p_supporter_id: local.supporter_id,
      p_actor_id: local.creator_id,
    });
  }

  await logAuditEvent({
    actor_id: null,
    action: "creator_supporter.dispute_synchronized",
    target_type: "creator_supporter_subscription",
    target_id: local.stripe_subscription_id,
    metadata: { dispute_id: dispute.id, dispute_status: dispute.status },
  });
  return true;
}

async function localSubscription(creatorId: string, supporterId: string) {
  const { data, error } = await service()
    .from("creator_supporter_subscriptions")
    .select("*")
    .eq("creator_id", creatorId)
    .eq("supporter_id", supporterId)
    .maybeSingle();
  if (error) throw new CreatorSupporterBillingError(error.message, 503);
  if (!data) {
    throw new CreatorSupporterBillingError("Paid supporter subscription not found.", 404);
  }
  return data;
}

export async function cancelCreatorSupporterSubscription(input: {
  creatorId: string;
  supporterId: string;
  immediate?: boolean;
}) {
  const local = await localSubscription(input.creatorId, input.supporterId);
  const subscription = input.immediate
    ? await stripe().subscriptions.cancel(local.stripe_subscription_id)
    : await stripe().subscriptions.update(local.stripe_subscription_id, {
        cancel_at_period_end: true,
      });
  await syncCreatorSupporterSubscriptionEvent(subscription);
  return subscription;
}

export async function resumeCreatorSupporterSubscription(input: {
  creatorId: string;
  supporterId: string;
}) {
  const local = await localSubscription(input.creatorId, input.supporterId);
  const subscription = await stripe().subscriptions.update(
    local.stripe_subscription_id,
    { cancel_at_period_end: false }
  );
  await syncCreatorSupporterSubscriptionEvent(subscription);
  return subscription;
}

export async function requestCreatorSupporterRefund(input: {
  creatorId: string;
  supporterId: string;
  requestedBy: string;
  reason: string;
}) {
  const local = await localSubscription(input.creatorId, input.supporterId);
  const cleanReason = input.reason.trim();
  if (cleanReason.length < 5 || cleanReason.length > 1000) {
    throw new CreatorSupporterBillingError(
      "Provide a refund reason between 5 and 1,000 characters.",
      400
    );
  }
  const { data, error } = await service()
    .from("creator_supporter_refund_requests")
    .insert({
      subscription_id: local.id,
      creator_id: input.creatorId,
      supporter_id: input.supporterId,
      requested_by: input.requestedBy,
      reason: cleanReason,
      requested_amount_cents: local.amount_cents,
      status: "pending_review",
    })
    .select("id, status")
    .single();
  if (error) {
    if (error.code === "23505") {
      throw new CreatorSupporterBillingError(
        "A refund request is already under review.",
        409,
        "creator_supporter_refund_exists"
      );
    }
    throw new CreatorSupporterBillingError(error.message, 503);
  }
  return data;
}

export async function runCreatorSupporterBillingReconciliation() {
  const client = service();
  const { data: jobs, error } = await client
    .from("creator_supporter_billing_reconciliation")
    .select("id, creator_id, attempt_count")
    .eq("status", "queued")
    .order("created_at", { ascending: true })
    .limit(20);
  if (error) throw new CreatorSupporterBillingError(error.message, 503);

  let completed = 0;
  let failed = 0;
  for (const job of jobs ?? []) {
    await client
      .from("creator_supporter_billing_reconciliation")
      .update({ status: "processing", attempt_count: job.attempt_count + 1 })
      .eq("id", job.id)
      .eq("status", "queued");

    try {
      const { data: subscriptions } = await client
        .from("creator_supporter_subscriptions")
        .select("stripe_subscription_id, supporter_id")
        .eq("creator_id", job.creator_id)
        .in("status", ["incomplete", "trialing", "active", "past_due", "unpaid"]);

      for (const local of subscriptions ?? []) {
        const subscription = await stripe().subscriptions.cancel(
          local.stripe_subscription_id
        );
        await syncCreatorSupporterSubscriptionEvent(subscription);
      }

      const finalized = await client.rpc("finalize_creator_supporter_program_shutdown", {
        p_creator_id: job.creator_id,
      });
      if (finalized.error) throw new Error(finalized.error.message);

      await client
        .from("creator_supporter_billing_reconciliation")
        .update({
          status: "completed",
          completed_at: new Date().toISOString(),
          last_error: null,
        })
        .eq("id", job.id);
      completed += 1;
    } catch (jobError) {
      await client
        .from("creator_supporter_billing_reconciliation")
        .update({
          status: "failed",
          last_error:
            jobError instanceof Error ? jobError.message.slice(0, 1000) : "Unknown error",
        })
        .eq("id", job.id);
      failed += 1;
    }
  }

  return { ok: failed === 0, processed: (jobs ?? []).length, completed, failed };
}
