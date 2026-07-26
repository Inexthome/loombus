import "server-only";

import Stripe from "stripe";
import { logAuditEvent } from "@/lib/audit-log";
import {
  PAID_ROOM_PLANS,
  RoomBillingError,
  isPaidRoomPlanKey,
  isSelfServeRoomPlanKey,
  type PaidRoomPlanKey,
} from "@/lib/room-billing";
import {
  ROOM_PLAN_ENTITLEMENTS,
  getRoomPlanEntitlements,
  normalizeRoomPlanKey,
  type RoomPlanKey,
} from "@/lib/room-plan-entitlements";
import { createRoomServiceSupabase, type RoomRow } from "@/lib/room-operations";

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;

function getStripe() {
  if (!STRIPE_SECRET_KEY) {
    throw new RoomBillingError(
      "Room billing is not configured yet.",
      503,
      "stripe_room_not_configured"
    );
  }
  return new Stripe(STRIPE_SECRET_KEY);
}

function safeOrigin(value: string) {
  try {
    const parsed = new URL(value);
    if (!["http:", "https:"].includes(parsed.protocol)) throw new Error("Invalid protocol");
    return parsed.origin;
  } catch {
    return "https://loombus.com";
  }
}

function priceIdFor(planKey: PaidRoomPlanKey) {
  if (!PAID_ROOM_PLANS[planKey].selfServe) {
    throw new RoomBillingError(
      "Organization Enterprise uses a custom agreement. Contact Loombus Enterprise sales.",
      409,
      "enterprise_contact_required"
    );
  }
  const priceId = process.env[PAID_ROOM_PLANS[planKey].priceEnvVar];
  if (!priceId) {
    throw new RoomBillingError(
      `${PAID_ROOM_PLANS[planKey].label} billing is not configured yet.`,
      503,
      "stripe_room_price_missing"
    );
  }
  return priceId;
}

function periodEnd(subscription: Stripe.Subscription) {
  const value = (subscription as Stripe.Subscription & { current_period_end?: number })
    .current_period_end;
  return value ? new Date(value * 1000).toISOString() : null;
}

function customerId(subscription: Stripe.Subscription) {
  return typeof subscription.customer === "string"
    ? subscription.customer
    : subscription.customer?.id ?? null;
}

function pricePlanKey(priceId: string | null | undefined): PaidRoomPlanKey | null {
  if (!priceId) return null;
  for (const key of Object.keys(PAID_ROOM_PLANS) as PaidRoomPlanKey[]) {
    if (process.env[PAID_ROOM_PLANS[key].priceEnvVar] === priceId) return key;
  }
  return null;
}

function subscriptionPriceLabel(subscription: Stripe.Subscription | null) {
  const price = subscription?.items.data[0]?.price;
  if (!price) return null;
  const unitAmount = price.unit_amount;
  if (unitAmount === null || unitAmount === undefined) return null;
  const currency = (price.currency || "usd").toUpperCase();
  const value = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: unitAmount % 100 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(unitAmount / 100);
  const interval = price.recurring?.interval;
  return interval ? `${value}/${interval}` : value;
}

async function loadOwnedRoom(roomId: string, userId: string) {
  const service = createRoomServiceSupabase();
  const result = await service
    .from("rooms")
    .select("*")
    .eq("id", roomId)
    .or(`owner_id.eq.${userId},created_by.eq.${userId}`)
    .maybeSingle();

  if (result.error) {
    throw new RoomBillingError(
      "The Room billing record could not be loaded.",
      503,
      "room_billing_storage_unavailable"
    );
  }
  if (!result.data) {
    throw new RoomBillingError(
      "Only the Room owner can manage billing.",
      403,
      "room_billing_owner_required"
    );
  }
  return result.data as RoomRow;
}

async function activeMemberCount(roomId: string) {
  const service = createRoomServiceSupabase();
  const result = await service
    .from("room_members")
    .select("id", { count: "exact", head: true })
    .eq("room_id", roomId)
    .not("status", "in", "(blocked,removed,inactive)");
  if (result.error) {
    throw new RoomBillingError(
      "Room member usage could not be verified.",
      503,
      "room_member_usage_unavailable"
    );
  }
  return result.count ?? 0;
}

async function storageUsage(roomId: string) {
  const service = createRoomServiceSupabase();
  const result = await service
    .from("room_resource_attachments")
    .select("size_bytes")
    .eq("room_id", roomId);
  if (result.error) return null;
  return ((result.data ?? []) as Array<{ size_bytes?: number | string | null }>).reduce(
    (total, item) => total + Number(item.size_bytes ?? 0),
    0
  );
}

function planSummary(planKey: RoomPlanKey, priceOverride: string | null = null) {
  const plan = ROOM_PLAN_ENTITLEMENTS[planKey];
  const paid = isPaidRoomPlanKey(planKey) ? PAID_ROOM_PLANS[planKey] : null;
  return {
    id: plan.id,
    label: plan.label,
    priceLabel: priceOverride ?? paid?.priceLabel ?? "$0/month",
    memberLimit: plan.memberLimit,
    roomLimit: plan.roomLimit,
    storageBytes: plan.storageBytes,
    features: plan.features,
    selfServe: paid?.selfServe ?? false,
    contactSales: planKey === "enterprise",
  };
}

export async function getRoomBillingOverview(roomId: string, userId: string) {
  const room = await loadOwnedRoom(roomId, userId);
  const planKey = normalizeRoomPlanKey(room.subscription_plan);
  const memberCount = await activeMemberCount(roomId);
  const usedStorageBytes = await storageUsage(roomId);
  const subscriptionId = String(room.stripe_subscription_id ?? "");
  const customer = String(room.stripe_customer_id ?? "");

  let subscription: Stripe.Subscription | null = null;
  let invoices: Array<{
    id: string;
    number: string | null;
    status: string | null;
    amountPaid: number;
    currency: string;
    createdAt: string;
    hostedInvoiceUrl: string | null;
    invoicePdf: string | null;
  }> = [];

  if (subscriptionId && STRIPE_SECRET_KEY) {
    subscription = await getStripe().subscriptions.retrieve(subscriptionId);
  }
  if (customer && STRIPE_SECRET_KEY) {
    const listed = await getStripe().invoices.list({ customer, limit: 12 });
    invoices = listed.data.map((invoice) => ({
      id: invoice.id,
      number: invoice.number,
      status: invoice.status,
      amountPaid: invoice.amount_paid,
      currency: invoice.currency,
      createdAt: new Date(invoice.created * 1000).toISOString(),
      hostedInvoiceUrl: invoice.hosted_invoice_url ?? null,
      invoicePdf: invoice.invoice_pdf ?? null,
    }));
  }

  const subscriptionStatus =
    subscription?.status ?? String(room.subscription_status ?? "active");
  const effectivePlan = getRoomPlanEntitlements(planKey, subscriptionStatus);

  return {
    room: {
      id: String(room.id),
      name: String(room.name ?? "Room"),
      planKey: effectivePlan.id,
      subscribedPlanKey: planKey,
      subscriptionStatus,
      currentPeriodEnd: subscription ? periodEnd(subscription) : room.stripe_current_period_end ?? null,
      cancelAtPeriodEnd: subscription?.cancel_at_period_end ?? false,
      canceledAt: subscription?.canceled_at
        ? new Date(subscription.canceled_at * 1000).toISOString()
        : null,
    },
    currentPlan: planSummary(effectivePlan.id, subscriptionPriceLabel(subscription)),
    availablePlans: (Object.keys(ROOM_PLAN_ENTITLEMENTS) as RoomPlanKey[]).map((planKey) => planSummary(planKey)),
    usage: {
      memberCount,
      memberLimit: effectivePlan.memberLimit,
      usedStorageBytes,
      storageLimitBytes: effectivePlan.storageBytes,
      overMemberLimit:
        effectivePlan.memberLimit !== null && memberCount > effectivePlan.memberLimit,
      overStorageLimit:
        usedStorageBytes !== null && usedStorageBytes > effectivePlan.storageBytes,
    },
    billingConfigured: Boolean(STRIPE_SECRET_KEY),
    hasStripeSubscription: Boolean(subscriptionId),
    invoices,
  };
}

export async function createRoomBillingPortal(
  roomId: string,
  userId: string,
  origin: string
) {
  const room = await loadOwnedRoom(roomId, userId);
  const customer = String(room.stripe_customer_id ?? "");
  if (!customer) {
    throw new RoomBillingError(
      "This Room does not have a Stripe billing profile yet.",
      409,
      "room_billing_customer_missing"
    );
  }
  const session = await getStripe().billingPortal.sessions.create({
    customer,
    return_url: `${safeOrigin(origin)}/rooms/${encodeURIComponent(roomId)}/billing`,
  });
  return { url: session.url };
}

export async function startExistingRoomUpgrade(
  roomId: string,
  userId: string,
  email: string | null,
  targetPlan: string,
  origin: string
) {
  if (!isSelfServeRoomPlanKey(targetPlan)) {
    throw new RoomBillingError(
      targetPlan === "enterprise"
        ? "Organization Enterprise uses a custom agreement. Contact Loombus Enterprise sales."
        : "Choose a self-service paid Room plan.",
      targetPlan === "enterprise" ? 409 : 400,
      targetPlan === "enterprise" ? "enterprise_contact_required" : "invalid_room_plan"
    );
  }
  const room = await loadOwnedRoom(roomId, userId);
  if (room.stripe_subscription_id) {
    throw new RoomBillingError(
      "Use Change plan for an existing paid Room.",
      409,
      "room_subscription_already_exists"
    );
  }

  const service = createRoomServiceSupabase();
  const now = new Date().toISOString();
  const intent = await service.from("room_checkout_intents").upsert({
    id: roomId,
    user_id: userId,
    room_name: String(room.name ?? "Room"),
    room_description: String(room.description ?? "Private Loombus Room"),
    room_type: String(room.room_type ?? "community"),
    template_key: room.template_key ?? null,
    plan_key: targetPlan,
    member_limit: PAID_ROOM_PLANS[targetPlan].memberLimit,
    status: "pending",
    last_error: null,
    created_at: now,
    updated_at: now,
  });
  if (intent.error) {
    throw new RoomBillingError(
      "The Room upgrade could not be prepared.",
      503,
      "room_upgrade_intent_failed"
    );
  }

  const metadata = {
    product: "loombus_room",
    user_id: userId,
    room_id: roomId,
    room_plan: targetPlan,
    room_model: String(room.template_key ?? room.room_type ?? "community"),
    plan_label: PAID_ROOM_PLANS[targetPlan].label,
    member_limit:
      PAID_ROOM_PLANS[targetPlan].memberLimit === null
        ? "custom"
        : String(PAID_ROOM_PLANS[targetPlan].memberLimit),
  };
  const session = await getStripe().checkout.sessions.create({
    mode: "subscription",
    payment_method_types: ["card"],
    line_items: [{ price: priceIdFor(targetPlan), quantity: 1 }],
    success_url: `${safeOrigin(origin)}/rooms/${encodeURIComponent(roomId)}/billing/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${safeOrigin(origin)}/rooms/${encodeURIComponent(roomId)}/billing?checkout=cancelled`,
    client_reference_id: roomId,
    customer_email: email ?? undefined,
    metadata,
    subscription_data: { metadata },
  });
  if (!session.url) {
    throw new RoomBillingError(
      "Stripe did not return an upgrade link.",
      503,
      "room_upgrade_checkout_missing"
    );
  }
  await service
    .from("room_checkout_intents")
    .update({ stripe_checkout_session_id: session.id, updated_at: new Date().toISOString() })
    .eq("id", roomId)
    .eq("user_id", userId);

  await logAuditEvent({
    actor_id: userId,
    action: "room.billing.upgrade_started",
    target_type: "room",
    target_id: roomId,
    metadata: { room_plan: targetPlan, stripe_checkout_session_id: session.id },
  });
  return { url: session.url };
}

export async function changeRoomPaidPlan(
  roomId: string,
  userId: string,
  targetPlan: string
) {
  if (!isSelfServeRoomPlanKey(targetPlan)) {
    throw new RoomBillingError(
      targetPlan === "enterprise"
        ? "Organization Enterprise uses a custom agreement. Contact Loombus Enterprise sales."
        : "Choose a self-service paid Room plan.",
      targetPlan === "enterprise" ? 409 : 400,
      targetPlan === "enterprise" ? "enterprise_contact_required" : "invalid_room_plan"
    );
  }
  const room = await loadOwnedRoom(roomId, userId);
  const subscriptionId = String(room.stripe_subscription_id ?? "");
  if (!subscriptionId) {
    throw new RoomBillingError(
      "This Room does not have an active paid subscription.",
      409,
      "room_subscription_missing"
    );
  }

  const memberCount = await activeMemberCount(roomId);
  const usedStorageBytes = await storageUsage(roomId);
  const targetLimit = PAID_ROOM_PLANS[targetPlan].memberLimit;
  const targetStorageBytes = ROOM_PLAN_ENTITLEMENTS[targetPlan].storageBytes;
  if (targetLimit !== null && memberCount > targetLimit) {
    throw new RoomBillingError(
      `This Room has ${memberCount} active members. Reduce membership to ${targetLimit} or fewer before changing to ${PAID_ROOM_PLANS[targetPlan].label}.`,
      409,
      "room_plan_member_limit_exceeded"
    );
  }
  if (usedStorageBytes !== null && usedStorageBytes > targetStorageBytes) {
    throw new RoomBillingError(
      `This Room uses ${usedStorageBytes} bytes of storage. Remove files until usage is within the ${targetStorageBytes}-byte allowance before changing to ${PAID_ROOM_PLANS[targetPlan].label}.`,
      409,
      "room_plan_storage_limit_exceeded"
    );
  }

  const stripe = getStripe();
  const subscription = await stripe.subscriptions.retrieve(subscriptionId);
  const item = subscription.items.data[0];
  if (!item) {
    throw new RoomBillingError(
      "The Stripe subscription has no billable Room item.",
      409,
      "room_subscription_item_missing"
    );
  }
  const updated = await stripe.subscriptions.update(subscriptionId, {
    items: [{ id: item.id, price: priceIdFor(targetPlan) }],
    proration_behavior: "create_prorations",
    cancel_at_period_end: false,
    metadata: {
      ...subscription.metadata,
      product: "loombus_room",
      user_id: userId,
      room_id: roomId,
      room_plan: targetPlan,
      plan_label: PAID_ROOM_PLANS[targetPlan].label,
      member_limit: targetLimit === null ? "custom" : String(targetLimit),
    },
  });

  const service = createRoomServiceSupabase();
  const result = await service
    .from("rooms")
    .update({
      subscription_plan: targetPlan,
      subscription_status: updated.status,
      member_limit: targetLimit,
      stripe_price_id: updated.items.data[0]?.price?.id ?? null,
      stripe_current_period_end: periodEnd(updated),
      billing_updated_at: new Date().toISOString(),
    })
    .eq("id", roomId)
    .or(`owner_id.eq.${userId},created_by.eq.${userId}`);
  if (result.error) {
    throw new RoomBillingError(
      "Stripe changed the plan, but Loombus could not synchronize the Room record.",
      503,
      "room_plan_sync_failed"
    );
  }

  await logAuditEvent({
    actor_id: userId,
    action: "room.billing.plan_changed",
    target_type: "room",
    target_id: roomId,
    metadata: {
      previous_room_plan: normalizeRoomPlanKey(room.subscription_plan),
      room_plan: targetPlan,
      stripe_subscription_id: subscriptionId,
    },
  });
  return { planKey: targetPlan, status: updated.status };
}

export async function setRoomCancellation(
  roomId: string,
  userId: string,
  cancelAtPeriodEnd: boolean
) {
  const room = await loadOwnedRoom(roomId, userId);
  const subscriptionId = String(room.stripe_subscription_id ?? "");
  if (!subscriptionId) {
    throw new RoomBillingError(
      "Free Rooms do not have a subscription to cancel.",
      409,
      "room_subscription_missing"
    );
  }
  if (cancelAtPeriodEnd) {
    const memberCount = await activeMemberCount(roomId);
    const usedStorageBytes = await storageUsage(roomId);
    const freePlan = ROOM_PLAN_ENTITLEMENTS.free;
    if (freePlan.memberLimit !== null && memberCount > freePlan.memberLimit) {
      throw new RoomBillingError(
        `Reduce active membership to ${freePlan.memberLimit} or fewer before scheduling cancellation to Free.`,
        409,
        "room_free_member_limit_exceeded"
      );
    }
    if (usedStorageBytes !== null && usedStorageBytes > freePlan.storageBytes) {
      throw new RoomBillingError(
        "Remove paid Room files before scheduling cancellation to Free.",
        409,
        "room_free_storage_limit_exceeded"
      );
    }
  }
  const subscription = await getStripe().subscriptions.update(subscriptionId, {
    cancel_at_period_end: cancelAtPeriodEnd,
  });
  const service = createRoomServiceSupabase();
  await service
    .from("rooms")
    .update({
      subscription_status: subscription.status,
      stripe_current_period_end: periodEnd(subscription),
      billing_updated_at: new Date().toISOString(),
    })
    .eq("id", roomId)
    .or(`owner_id.eq.${userId},created_by.eq.${userId}`);

  await logAuditEvent({
    actor_id: userId,
    action: cancelAtPeriodEnd
      ? "room.billing.cancellation_scheduled"
      : "room.billing.cancellation_resumed",
    target_type: "room",
    target_id: roomId,
    metadata: {
      stripe_subscription_id: subscriptionId,
      cancel_at_period_end: cancelAtPeriodEnd,
      current_period_end: periodEnd(subscription),
    },
  });
  return {
    cancelAtPeriodEnd: subscription.cancel_at_period_end,
    currentPeriodEnd: periodEnd(subscription),
  };
}

export function configuredPlanForPrice(priceId: string | null | undefined) {
  return pricePlanKey(priceId);
}
