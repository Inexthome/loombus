import "server-only";

import Stripe from "stripe";
import { getBillingSupabaseAdmin } from "@/lib/billing-entitlements";

function paymentIntentId(value: string | Stripe.PaymentIntent | null | undefined) {
  if (typeof value === "string") return value;
  return value?.id ?? null;
}

async function findPurchaseByPaymentIntent(paymentIntentId: string) {
  const admin = getBillingSupabaseAdmin();
  const { data, error } = await (admin.from("library_book_purchases") as any)
    .select("id,status,amount_cents")
    .eq("stripe_payment_intent_id", paymentIntentId)
    .maybeSingle();
  if (error) throw new Error(`Unable to resolve Library purchase payment: ${error.message}`);
  return data ?? null;
}

async function updatePurchase(id: string, values: Record<string, unknown>) {
  const admin = getBillingSupabaseAdmin();
  const { error } = await (admin.from("library_book_purchases") as any)
    .update({ ...values, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(`Unable to update Library purchase state: ${error.message}`);
}

export async function syncLibraryPaymentStripeEvent(event: Stripe.Event) {
  if (event.type === "charge.refunded") {
    const charge = event.data.object as Stripe.Charge;
    const intentId = paymentIntentId(charge.payment_intent);
    if (!intentId) return false;
    const purchase = await findPurchaseByPaymentIntent(intentId);
    if (!purchase?.id) return false;
    if (charge.amount_refunded >= charge.amount) {
      await updatePurchase(purchase.id, {
        status: "refunded",
        refunded_at: new Date().toISOString(),
      });
    }
    return true;
  }

  if (event.type === "charge.dispute.created" || event.type === "charge.dispute.closed") {
    const dispute = event.data.object as Stripe.Dispute;
    const intentId = paymentIntentId(dispute.payment_intent);
    if (!intentId) return false;
    const purchase = await findPurchaseByPaymentIntent(intentId);
    if (!purchase?.id) return false;

    if (event.type === "charge.dispute.created") {
      await updatePurchase(purchase.id, {
        status: "disputed",
        disputed_at: new Date().toISOString(),
      });
      return true;
    }

    if (dispute.status === "won" || dispute.status === "warning_closed") {
      await updatePurchase(purchase.id, { status: "paid" });
    } else if (dispute.status === "lost") {
      await updatePurchase(purchase.id, {
        status: "chargeback",
        disputed_at: new Date().toISOString(),
      });
    } else {
      await updatePurchase(purchase.id, {
        status: "disputed",
        disputed_at: new Date().toISOString(),
      });
    }
    return true;
  }

  return false;
}
