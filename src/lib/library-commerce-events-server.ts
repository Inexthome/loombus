import "server-only";

import Stripe from "stripe";
import { getBillingSupabaseAdmin } from "@/lib/billing-entitlements";

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
const LIBRARY_PRODUCT = "loombus_library_book";

function stripe() {
  if (!STRIPE_SECRET_KEY) throw new Error("STRIPE_SECRET_KEY is not configured.");
  return new Stripe(STRIPE_SECRET_KEY);
}

function paymentIntentId(value: string | Stripe.PaymentIntent | null | undefined) {
  if (typeof value === "string") return value;
  return value?.id ?? null;
}

function transferId(value: string | Stripe.Transfer | null | undefined) {
  if (typeof value === "string") return value;
  return value?.id ?? null;
}

function applicationFeeId(value: string | Stripe.ApplicationFee | null | undefined) {
  if (typeof value === "string") return value;
  return value?.id ?? null;
}

async function findPurchaseByPaymentIntent(intentId: string) {
  const admin = getBillingSupabaseAdmin();
  const { data, error } = await (admin.from("library_book_purchases") as any)
    .select("id,status,amount_cents,tax_mode,tax_amount_cents")
    .eq("stripe_payment_intent_id", intentId)
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

async function reconcileFullDestinationChargeLoss(charge: Stripe.Charge, purchaseId: string, reason: "refund" | "chargeback") {
  const destinationTransferId = transferId(charge.transfer);
  if (destinationTransferId) {
    const transfer = await stripe().transfers.retrieve(destinationTransferId);
    const remaining = Math.max(0, transfer.amount - transfer.amount_reversed);
    if (remaining > 0) {
      await stripe().transfers.createReversal(
        destinationTransferId,
        {
          amount: remaining,
          metadata: {
            product: LIBRARY_PRODUCT,
            purchase_id: purchaseId,
            reason: `full_${reason}_reconciliation`,
          },
        },
        { idempotencyKey: `loombus-library-${reason}-transfer-${purchaseId}` }
      );
    }
  }

  const feeId = applicationFeeId(charge.application_fee);
  if (feeId) {
    const fee = await stripe().applicationFees.retrieve(feeId);
    const remainingFee = Math.max(0, fee.amount - fee.amount_refunded);
    if (remainingFee > 0) {
      await stripe().applicationFees.createRefund(
        feeId,
        {
          amount: remainingFee,
          metadata: {
            product: LIBRARY_PRODUCT,
            purchase_id: purchaseId,
            reason: `full_${reason}_reconciliation`,
          },
        },
        { idempotencyKey: `loombus-library-${reason}-fee-${purchaseId}` }
      );
    }
  }
}

async function chargeFromDispute(dispute: Stripe.Dispute) {
  const chargeId = typeof dispute.charge === "string" ? dispute.charge : dispute.charge?.id ?? null;
  if (!chargeId) return null;
  return stripe().charges.retrieve(chargeId);
}

export async function syncLibraryPaymentStripeEvent(event: Stripe.Event) {
  if (event.type === "charge.refunded") {
    const charge = event.data.object as Stripe.Charge;
    const intentId = paymentIntentId(charge.payment_intent);
    if (!intentId) return false;
    const purchase = await findPurchaseByPaymentIntent(intentId);
    if (!purchase?.id) return false;
    if (charge.amount_refunded >= charge.amount) {
      await reconcileFullDestinationChargeLoss(charge, purchase.id, "refund");
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
      const charge = await chargeFromDispute(dispute);
      if (charge) await reconcileFullDestinationChargeLoss(charge, purchase.id, "chargeback");
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
