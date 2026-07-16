import "server-only";

import { randomUUID } from "node:crypto";
import Stripe from "stripe";
import { logAuditEvent } from "@/lib/audit-log";
import { createRoomServiceSupabase } from "@/lib/room-operations";

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;

export const PAID_ROOM_PLANS = {
  starter: {
    label: "Loombus Room Starter",
    priceLabel: "$19/month",
    priceEnvVar: "STRIPE_ROOM_STARTER_MONTHLY_PRICE_ID",
    memberLimit: 50,
  },
  pro: {
    label: "Loombus Room Pro",
    priceLabel: "$49/month",
    priceEnvVar: "STRIPE_ROOM_PRO_MONTHLY_PRICE_ID",
    memberLimit: 250,
  },
  organization: {
    label: "Loombus Organization Room",
    priceLabel: "$99/month",
    priceEnvVar: "STRIPE_ROOM_ORGANIZATION_MONTHLY_PRICE_ID",
    memberLimit: 500,
  },
  "organization-plus": {
    label: "Loombus Organization Plus",
    priceLabel: "$149/month",
    priceEnvVar: "STRIPE_ROOM_ORGANIZATION_PLUS_MONTHLY_PRICE_ID",
    memberLimit: 2000,
  },
  enterprise: {
    label: "Loombus Organization Enterprise",
    priceLabel: "$199/month",
    priceEnvVar: "STRIPE_ROOM_ORGANIZATION_ENTERPRISE_MONTHLY_PRICE_ID",
    memberLimit: null,
  },
} as const;

export type PaidRoomPlanKey = keyof typeof PAID_ROOM_PLANS;

export type RoomSetupInput = {
  userId: string;
  email: string | null;
  roomName: string;
  description: string;
  modelId: string;
  planKey: string;
  origin: string;
};

type RoomCheckoutIntent = {
  id: string;
  user_id: string;
  room_name: string;
  room_description: string;
  room_type: string;
  template_key: string | null;
  plan_key: string;
  member_limit: number | null;
  stripe_checkout_session_id: string | null;
  status: string;
};

type RoomBillingIdentity = {
  customerId: string | null;
  subscriptionId: string | null;
  priceId: string | null;
  checkoutSessionId: string | null;
  currentPeriodEnd: string | null;
  subscriptionStatus: string;
};

export class RoomBillingError extends Error {
  status: number;
  code: string;

  constructor(message: string, status = 500, code = "room_billing_error") {
    super(message);
    this.name = "RoomBillingError";
    this.status = status;
    this.code = code;
  }
}

function present(value: string | undefined) {
  return Boolean(value && value.trim().length > 0);
}

export function isPaidRoomPlanKey(value: string): value is PaidRoomPlanKey {
  return value in PAID_ROOM_PLANS;
}

export function getRoomCheckoutConfiguration() {
  const plans = Object.fromEntries(
    Object.entries(PAID_ROOM_PLANS).map(([key, plan]) => [
      key,
      present(process.env[plan.priceEnvVar]),
    ])
  ) as Record<PaidRoomPlanKey, boolean>;

  return {
    stripeSecretKey: present(process.env.STRIPE_SECRET_KEY),
    stripeWebhookSecret: present(process.env.STRIPE_WEBHOOK_SECRET),
    siteUrl: present(process.env.NEXT_PUBLIC_SITE_URL),
    supabaseServiceRole: present(process.env.SUPABASE_SERVICE_ROLE_KEY),
    plans,
  };
}

function getStripe() {
  if (!STRIPE_SECRET_KEY) {
    throw new RoomBillingError(
      "Room checkout is not configured yet.",
      503,
      "stripe_room_not_configured"
    );
  }

  return new Stripe(STRIPE_SECRET_KEY);
}

function getRoomPriceId(planKey: PaidRoomPlanKey) {
  const value = process.env[PAID_ROOM_PLANS[planKey].priceEnvVar];
  if (!value) {
    throw new RoomBillingError(
      `${PAID_ROOM_PLANS[planKey].label} checkout is not configured yet.`,
      503,
      "stripe_room_price_missing"
    );
  }
  return value;
}

function getSafeOrigin(value: string) {
  try {
    const parsed = new URL(value);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
      throw new Error("Unsupported origin protocol.");
    }
    return parsed.origin;
  } catch {
    return "https://loombus.com";
  }
}

function getCustomerId(value: Stripe.Checkout.Session | Stripe.Subscription) {
  const customer = value.customer;
  if (typeof customer === "string") return customer;
  return customer?.id ?? null;
}

function getSubscriptionId(session: Stripe.Checkout.Session) {
  if (typeof session.subscription === "string") return session.subscription;
  return session.subscription?.id ?? null;
}

function getSubscriptionPriceId(subscription: Stripe.Subscription | null) {
  return subscription?.items?.data?.[0]?.price?.id ?? null;
}

function getSubscriptionPeriodEnd(subscription: Stripe.Subscription | null) {
  const periodEnd = (
    subscription as (Stripe.Subscription & { current_period_end?: number }) | null
  )?.current_period_end;

  return periodEnd ? new Date(periodEnd * 1000).toISOString() : null;
}

function getNormalizedRoomType(modelId: string) {
  if (modelId === "business-team") return "business";
  if (modelId === "residents") return "residents";
  if (modelId === "classroom") return "classroom";
  if (modelId === "customer-support") return "customer_support";
  return "community";
}

function getStripeErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : "Unknown Stripe error";
  const stripeType =
    error && typeof error === "object" && "type" in error
      ? String((error as { type?: unknown }).type ?? "")
      : "";

  if (stripeType === "StripeAuthenticationError") {
    return "Stripe rejected the configured secret key.";
  }
  if (stripeType === "StripeInvalidRequestError" && message.toLowerCase().includes("no such price")) {
    return "Stripe could not find the selected monthly Room price in the same mode as the configured secret key.";
  }
  if (stripeType === "StripeInvalidRequestError" && message.toLowerCase().includes("recurring")) {
    return "The selected Room price must be a recurring monthly Stripe price.";
  }
  return "Stripe could not start the Room checkout session.";
}

async function getIntent(roomId: string) {
  const serviceSupabase = createRoomServiceSupabase();
  const { data, error } = await serviceSupabase
    .from("room_checkout_intents")
    .select("*")
    .eq("id", roomId)
    .maybeSingle();

  if (error) {
    throw new RoomBillingError(
      "Unable to verify the Room checkout intent.",
      503,
      "room_checkout_storage_unavailable"
    );
  }

  if (!data) {
    throw new RoomBillingError(
      "The Room checkout intent could not be found.",
      404,
      "room_checkout_intent_missing"
    );
  }

  return data as RoomCheckoutIntent;
}

async function ensureOwnerMembership(roomId: string, userId: string) {
  const serviceSupabase = createRoomServiceSupabase();
  const now = new Date().toISOString();
  const { error } = await serviceSupabase.from("room_members").upsert(
    {
      room_id: roomId,
      user_id: userId,
      role: "owner",
      status: "active",
      joined_at: now,
      updated_at: now,
    },
    { onConflict: "room_id,user_id" }
  );

  if (error) {
    throw new RoomBillingError(
      "The Room owner membership could not be created.",
      503,
      "room_membership_provision_failed"
    );
  }
}

export async function provisionFreeRoom(input: RoomSetupInput) {
  const serviceSupabase = createRoomServiceSupabase();
  const roomId = randomUUID();
  const now = new Date().toISOString();
  const { error } = await serviceSupabase.from("rooms").insert({
    id: roomId,
    name: input.roomName,
    description: input.description,
    room_type: getNormalizedRoomType(input.modelId),
    visibility: "private",
    status: "active",
    owner_id: input.userId,
    created_by: input.userId,
    template_key: input.modelId,
    subscription_plan: "free",
    subscription_status: "active",
    member_limit: 10,
    invite_only: true,
    billing_updated_at: now,
  });

  if (error) {
    throw new RoomBillingError(
      "The free Room could not be created.",
      503,
      "room_provision_failed"
    );
  }

  try {
    await ensureOwnerMembership(roomId, input.userId);
  } catch (error) {
    await serviceSupabase.from("rooms").delete().eq("id", roomId);
    throw error;
  }

  await logAuditEvent({
    actor_id: input.userId,
    action: "room.provisioned.free",
    target_type: "room",
    target_id: roomId,
    metadata: {
      room_plan: "free",
      room_model: input.modelId,
      member_limit: 10,
    },
  });

  return { roomId };
}

export async function startPaidRoomCheckout(input: RoomSetupInput) {
  if (!isPaidRoomPlanKey(input.planKey)) {
    throw new RoomBillingError("Invalid paid Room plan.", 400, "invalid_room_plan");
  }

  const plan = PAID_ROOM_PLANS[input.planKey];
  const priceId = getRoomPriceId(input.planKey);
  const serviceSupabase = createRoomServiceSupabase();
  const stripe = getStripe();
  const roomId = randomUUID();
  const now = new Date().toISOString();

  const { error: intentError } = await serviceSupabase
    .from("room_checkout_intents")
    .insert({
      id: roomId,
      user_id: input.userId,
      room_name: input.roomName,
      room_description: input.description,
      room_type: getNormalizedRoomType(input.modelId),
      template_key: input.modelId,
      plan_key: input.planKey,
      member_limit: plan.memberLimit,
      status: "pending",
      created_at: now,
      updated_at: now,
    });

  if (intentError) {
    throw new RoomBillingError(
      "The Room checkout intent could not be saved.",
      503,
      "room_checkout_intent_failed"
    );
  }

  const metadata = {
    product: "loombus_room",
    user_id: input.userId,
    room_id: roomId,
    room_plan: input.planKey,
    room_model: input.modelId,
    plan_label: plan.label,
    member_limit: plan.memberLimit === null ? "custom" : String(plan.memberLimit),
  };

  try {
    const origin = getSafeOrigin(input.origin);
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      payment_method_types: ["card"],
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${origin}/rooms/${encodeURIComponent(roomId)}/billing/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/rooms/new?checkout=cancelled&plan=${encodeURIComponent(input.planKey)}`,
      client_reference_id: roomId,
      customer_email: input.email ?? undefined,
      metadata,
      subscription_data: { metadata },
    });

    if (!session.url) {
      throw new Error("Stripe did not return a checkout URL.");
    }

    const { error: updateError } = await serviceSupabase
      .from("room_checkout_intents")
      .update({
        stripe_checkout_session_id: session.id,
        updated_at: new Date().toISOString(),
      })
      .eq("id", roomId)
      .eq("user_id", input.userId);

    if (updateError) {
      try {
        await stripe.checkout.sessions.expire(session.id);
      } catch {
        // The intent remains unusable because its session identifier was not persisted.
      }
      throw new RoomBillingError(
        "The Room checkout session could not be linked to its intent.",
        503,
        "room_checkout_link_failed"
      );
    }

    await logAuditEvent({
      actor_id: input.userId,
      action: "room.checkout.started",
      target_type: "room_checkout_intent",
      target_id: roomId,
      metadata: {
        room_plan: input.planKey,
        room_model: input.modelId,
        stripe_checkout_session_id: session.id,
      },
    });

    return { roomId, checkoutUrl: session.url };
  } catch (error) {
    const publicMessage =
      error instanceof RoomBillingError ? error.message : getStripeErrorMessage(error);

    await serviceSupabase
      .from("room_checkout_intents")
      .update({
        status: "failed",
        last_error: publicMessage,
        updated_at: new Date().toISOString(),
      })
      .eq("id", roomId);

    if (error instanceof RoomBillingError) throw error;
    throw new RoomBillingError(publicMessage, 503, "stripe_room_checkout_failed");
  }
}

async function resolveSubscription(session: Stripe.Checkout.Session) {
  if (!session.subscription) return null;
  if (typeof session.subscription !== "string") {
    return session.subscription as Stripe.Subscription;
  }
  return getStripe().subscriptions.retrieve(session.subscription);
}

async function provisionPaidRoomFromIntent(
  roomId: string,
  expectedUserId: string,
  expectedPlanKey: PaidRoomPlanKey,
  billing: RoomBillingIdentity
) {
  const intent = await getIntent(roomId);

  if (intent.user_id !== expectedUserId || intent.plan_key !== expectedPlanKey) {
    throw new RoomBillingError(
      "The Stripe Room checkout does not match this account or plan.",
      400,
      "room_checkout_mismatch"
    );
  }

  if (
    billing.checkoutSessionId &&
    intent.stripe_checkout_session_id &&
    intent.stripe_checkout_session_id !== billing.checkoutSessionId
  ) {
    throw new RoomBillingError(
      "The Stripe checkout session does not match this Room intent.",
      400,
      "room_checkout_session_mismatch"
    );
  }

  const serviceSupabase = createRoomServiceSupabase();
  const now = new Date().toISOString();
  const roomPayload = {
    id: roomId,
    name: intent.room_name,
    description: intent.room_description,
    room_type: intent.room_type,
    visibility: "private",
    status: "active",
    owner_id: expectedUserId,
    created_by: expectedUserId,
    template_key: intent.template_key,
    subscription_plan: expectedPlanKey,
    subscription_status: billing.subscriptionStatus,
    member_limit: intent.member_limit,
    invite_only: true,
    stripe_customer_id: billing.customerId,
    stripe_subscription_id: billing.subscriptionId,
    stripe_price_id: billing.priceId,
    stripe_checkout_session_id:
      billing.checkoutSessionId ?? intent.stripe_checkout_session_id,
    stripe_current_period_end: billing.currentPeriodEnd,
    billing_updated_at: now,
  };

  const { data: existingRoom, error: existingError } = await serviceSupabase
    .from("rooms")
    .select("id, owner_id, created_by")
    .eq("id", roomId)
    .maybeSingle();

  if (existingError) {
    throw new RoomBillingError(
      "The Room record could not be verified.",
      503,
      "room_provision_storage_unavailable"
    );
  }

  if (existingRoom) {
    if (
      existingRoom.owner_id !== expectedUserId &&
      existingRoom.created_by !== expectedUserId
    ) {
      throw new RoomBillingError(
        "The Room owner does not match the Stripe checkout account.",
        409,
        "room_owner_mismatch"
      );
    }

    const { error } = await serviceSupabase
      .from("rooms")
      .update(roomPayload)
      .eq("id", roomId);

    if (error) {
      throw new RoomBillingError(
        "The paid Room billing status could not be updated.",
        503,
        "room_billing_update_failed"
      );
    }
  } else {
    const { error } = await serviceSupabase.from("rooms").insert(roomPayload);
    if (error) {
      throw new RoomBillingError(
        "The paid Room could not be provisioned.",
        503,
        "room_provision_failed"
      );
    }
  }

  await ensureOwnerMembership(roomId, expectedUserId);

  const { error: intentUpdateError } = await serviceSupabase
    .from("room_checkout_intents")
    .update({
      status: "completed",
      last_error: null,
      updated_at: now,
    })
    .eq("id", roomId)
    .eq("user_id", expectedUserId);

  if (intentUpdateError) {
    console.error("Room checkout intent completion update failed:", intentUpdateError.message);
  }

  await logAuditEvent({
    actor_id: expectedUserId,
    action: "room.checkout.completed",
    target_type: "room",
    target_id: roomId,
    metadata: {
      room_plan: expectedPlanKey,
      stripe_checkout_session_id: billing.checkoutSessionId,
      stripe_subscription_id: billing.subscriptionId,
      stripe_subscription_status: billing.subscriptionStatus,
    },
  });

  return { roomId, planKey: expectedPlanKey };
}

export async function completeRoomCheckoutSession(
  sessionId: string,
  expectedRoomId: string,
  expectedUserId: string
) {
  const stripe = getStripe();
  const session = await stripe.checkout.sessions.retrieve(sessionId, {
    expand: ["subscription"],
  });

  if (
    session.metadata?.product !== "loombus_room" ||
    session.metadata?.room_id !== expectedRoomId ||
    session.metadata?.user_id !== expectedUserId
  ) {
    throw new RoomBillingError(
      "The Stripe checkout session does not match this Room.",
      400,
      "room_checkout_mismatch"
    );
  }

  if (
    session.status !== "complete" ||
    !["paid", "no_payment_required"].includes(session.payment_status)
  ) {
    throw new RoomBillingError(
      "The Room checkout is not complete yet.",
      409,
      "room_checkout_incomplete"
    );
  }

  const planKey = session.metadata?.room_plan ?? "";
  if (!isPaidRoomPlanKey(planKey)) {
    throw new RoomBillingError(
      "The Stripe checkout contains an invalid Room plan.",
      400,
      "invalid_room_plan"
    );
  }

  const subscription = await resolveSubscription(session);
  if (!subscription || !["active", "trialing"].includes(subscription.status)) {
    throw new RoomBillingError(
      "The Room subscription is not active yet.",
      409,
      "room_subscription_inactive"
    );
  }

  return provisionPaidRoomFromIntent(expectedRoomId, expectedUserId, planKey, {
    customerId: getCustomerId(subscription) ?? getCustomerId(session),
    subscriptionId: subscription.id ?? getSubscriptionId(session),
    priceId: getSubscriptionPriceId(subscription),
    checkoutSessionId: session.id,
    currentPeriodEnd: getSubscriptionPeriodEnd(subscription),
    subscriptionStatus: subscription.status,
  });
}

export async function fulfillRoomCheckoutSession(session: Stripe.Checkout.Session) {
  if (session.metadata?.product !== "loombus_room") return false;

  const roomId = session.metadata?.room_id ?? "";
  const userId = session.metadata?.user_id ?? "";
  const planKey = session.metadata?.room_plan ?? "";

  if (!roomId || !userId || !isPaidRoomPlanKey(planKey)) {
    throw new RoomBillingError(
      "Stripe Room checkout metadata is incomplete.",
      400,
      "room_checkout_metadata_invalid"
    );
  }

  const completeSession =
    session.status === "complete" &&
    ["paid", "no_payment_required"].includes(session.payment_status)
      ? session
      : await getStripe().checkout.sessions.retrieve(session.id, {
          expand: ["subscription"],
        });

  if (
    completeSession.status !== "complete" ||
    !["paid", "no_payment_required"].includes(completeSession.payment_status)
  ) {
    throw new RoomBillingError(
      "Stripe reported an incomplete Room checkout.",
      409,
      "room_checkout_incomplete"
    );
  }

  const subscription = await resolveSubscription(completeSession);
  if (!subscription || !["active", "trialing"].includes(subscription.status)) {
    throw new RoomBillingError(
      "Stripe reported an inactive Room subscription.",
      409,
      "room_subscription_inactive"
    );
  }

  await provisionPaidRoomFromIntent(roomId, userId, planKey, {
    customerId: getCustomerId(subscription) ?? getCustomerId(completeSession),
    subscriptionId: subscription.id ?? getSubscriptionId(completeSession),
    priceId: getSubscriptionPriceId(subscription),
    checkoutSessionId: completeSession.id,
    currentPeriodEnd: getSubscriptionPeriodEnd(subscription),
    subscriptionStatus: subscription.status,
  });

  return true;
}

export async function handleRoomSubscriptionChanged(subscription: Stripe.Subscription) {
  if (subscription.metadata?.product !== "loombus_room") return false;

  const roomId = subscription.metadata?.room_id ?? "";
  const userId = subscription.metadata?.user_id ?? "";
  const planKey = subscription.metadata?.room_plan ?? "";

  if (!roomId || !userId || !isPaidRoomPlanKey(planKey)) {
    throw new RoomBillingError(
      "Stripe Room subscription metadata is incomplete.",
      400,
      "room_subscription_metadata_invalid"
    );
  }

  const billing: RoomBillingIdentity = {
    customerId: getCustomerId(subscription),
    subscriptionId: subscription.id,
    priceId: getSubscriptionPriceId(subscription),
    checkoutSessionId: null,
    currentPeriodEnd: getSubscriptionPeriodEnd(subscription),
    subscriptionStatus: subscription.status,
  };

  if (["active", "trialing"].includes(subscription.status)) {
    await provisionPaidRoomFromIntent(roomId, userId, planKey, billing);
    return true;
  }

  const serviceSupabase = createRoomServiceSupabase();
  const { error } = await serviceSupabase
    .from("rooms")
    .update({
      subscription_plan: planKey,
      subscription_status: subscription.status,
      stripe_customer_id: billing.customerId,
      stripe_subscription_id: billing.subscriptionId,
      stripe_price_id: billing.priceId,
      stripe_current_period_end: billing.currentPeriodEnd,
      billing_updated_at: new Date().toISOString(),
    })
    .eq("id", roomId)
    .or(`owner_id.eq.${userId},created_by.eq.${userId}`);

  if (error) {
    throw new RoomBillingError(
      "The Room subscription status could not be synchronized.",
      503,
      "room_subscription_sync_failed"
    );
  }

  await logAuditEvent({
    actor_id: userId,
    action: "room.subscription.updated",
    target_type: "room",
    target_id: roomId,
    metadata: {
      room_plan: planKey,
      stripe_subscription_id: subscription.id,
      stripe_subscription_status: subscription.status,
    },
  });

  return true;
}
