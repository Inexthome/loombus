import "server-only";

import Stripe from "stripe";
import { logAuditEvent } from "@/lib/audit-log";
import { createRoomServiceSupabase } from "@/lib/room-operations";
import {
  RoomBillingError,
  handleRoomSubscriptionChanged,
  isPaidRoomPlanKey,
} from "@/lib/room-billing";

function getCustomerId(subscription: Stripe.Subscription) {
  if (typeof subscription.customer === "string") return subscription.customer;
  return subscription.customer?.id ?? null;
}

function getPriceId(subscription: Stripe.Subscription) {
  return subscription.items?.data?.[0]?.price?.id ?? null;
}

function getCurrentPeriodEnd(subscription: Stripe.Subscription) {
  const periodEnd = (
    subscription as Stripe.Subscription & { current_period_end?: number }
  ).current_period_end;
  return periodEnd ? new Date(periodEnd * 1000).toISOString() : null;
}

export async function syncRoomSubscriptionEvent(subscription: Stripe.Subscription) {
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

  const serviceSupabase = createRoomServiceSupabase();
  const { data: room, error: roomError } = await serviceSupabase
    .from("rooms")
    .select("id, owner_id, created_by")
    .eq("id", roomId)
    .maybeSingle();

  if (roomError) {
    throw new RoomBillingError(
      "The Room subscription target could not be verified.",
      503,
      "room_subscription_storage_unavailable"
    );
  }

  if (!room && ["active", "trialing"].includes(subscription.status)) {
    return handleRoomSubscriptionChanged(subscription);
  }

  if (!room) {
    return true;
  }

  if (room.owner_id !== userId && room.created_by !== userId) {
    throw new RoomBillingError(
      "The Room subscription owner does not match the Room record.",
      409,
      "room_owner_mismatch"
    );
  }

  const { error } = await serviceSupabase
    .from("rooms")
    .update({
      subscription_plan: planKey,
      subscription_status: subscription.status,
      stripe_customer_id: getCustomerId(subscription),
      stripe_subscription_id: subscription.id,
      stripe_price_id: getPriceId(subscription),
      stripe_current_period_end: getCurrentPeriodEnd(subscription),
      billing_updated_at: new Date().toISOString(),
    })
    .eq("id", roomId);

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
